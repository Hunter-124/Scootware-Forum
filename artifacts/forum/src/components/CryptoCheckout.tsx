import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { 
  CheckCircle2, 
  Copy, 
  Loader2, 
  AlertCircle, 
  RefreshCw,
  ArrowRight,
  Bitcoin,
  Coins,
  ShieldCheck,
  QrCode,
  ExternalLink,
  Clock
} from "lucide-react";

interface CryptoCheckoutProps {
  productIds: string[];
  onSuccess: (requestId: number) => void;
}

type CoinType = "BTC" | "ETH" | "LTC" | "USDT_ERC20" | "USDC_ERC20" | "SOL";

interface PaymentRequest {
  requestId: number;
  walletAddress: string;
  expectedAmount: number;
  coin: CoinType;
  expiresAt: string;
  usdAmount: number;
  microOffsetCents: number;
  message: string;
}

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  details: {
    coinGecko: boolean;
    missingWallets: string[] | null;
    etherscan: boolean;
  };
}

export function CryptoCheckout({ productIds, onSuccess }: CryptoCheckoutProps) {
  const [step, setStep] = useState<"selection" | "payment" | "status" | "error" | "loading">("loading");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<CoinType | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentRequest | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // 1. Initial Health Check
  useEffect(() => {
    checkHealth();
    return () => {
      stopPolling();
      stopSSE();
    };
  }, []);

  const checkHealth = async () => {
    try {
      setStep("loading");
      const res = await fetch("/api/products/crypto/health");
      const data = await res.json();
      setHealth(data);
      
      if (data.status === "unhealthy" || (data.status === "degraded" && !data.details.coinGecko)) {
        setError("Our crypto payment processing system is currently undergoing maintenance. Please try an alternative payment method or try again later.");
        setStep("error");
      } else {
        setStep("selection");
      }
    } catch (err) {
      setError("Failed to connect to payment gateway. Please check your connection.");
      setStep("error");
    }
  };

  // 2. Initiate Payment
  const initiatePayment = async (coin: CoinType) => {
    try {
      setSelectedCoin(coin);
      setStep("loading");
      
      const res = await fetch("/api/products/crypto/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, coin })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to initiate payment");
      }
      
      const data = await res.json();
      setPaymentData(data);
      setStep("payment");
      
      // Setup expiry countdown
      const expiry = new Date(data.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setTimeLeft(remaining);
      
      startPolling(data.requestId);
    } catch (err: any) {
      setError(err.message);
      setStep("error");
    }
  };

  // 3. Status Polling
  const startPolling = (requestId: number) => {
    stopPolling();
    stopSSE();
    
    // Start SSE subscription for real-time notifications
    startSSE(requestId);
    
    // Keep polling as fallback (every 30 seconds)
    const POLL_INTERVAL_MS = 30000;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/products/crypto/status/${requestId}`);
        if (!res.ok) return;
        const data = await res.json();
        
        setPaymentStatus(data.status);
        
        if (data.status === "confirmed") {
          stopPolling();
          stopSSE();
          // Show brief success animation before calling onSuccess
          setTimeout(() => onSuccess(requestId), 1500);
        } else if (data.status === "expired") {
          stopPolling();
          stopSSE();
          setStep("error");
          setError("This payment request has expired. Please create a new one.");
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }
    }, POLL_INTERVAL_MS);
  };

  // 3b. Server-Sent Events subscription
  const startSSE = (requestId: number) => {
    try {
      const sse = new EventSource("/api/upgrades/crypto/subscribe");
      
      sse.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "payment-confirmed" && data.requestId === requestId) {
            // Payment detected immediately!
            setPaymentStatus("confirmed");
            stopPolling();
            stopSSE();
            
            // Show success animation before calling onSuccess
            setTimeout(() => onSuccess(requestId), 1500);
            
            // Optional: Play a success sound or notification
            try {
              const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj==");
              audio.play().catch(() => {}); // Silently fail if audio fails
            } catch {}
          }
        } catch (e) {
          console.warn("Failed to parse SSE message:", e);
        }
      });
      
      sse.onerror = () => {
        console.warn("SSE connection error, relying on polling");
        stopSSE();
      };
      
      sseRef.current = sse;
    } catch (err) {
      console.warn("Failed to start SSE:", err);
      // Fallback to polling only
    }
  };

  const stopSSE = () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  };

  const stopPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
  };

  // 4. Countdown Timer
  useEffect(() => {
    if (step !== "payment" || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, step]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // UI Render Logic
  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse font-display uppercase tracking-widest text-sm text-center">
            Initializing Secure Vault...
        </p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center text-center p-6 bg-red-500/5 rounded-2xl border border-red-500/20">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">System Fault Detected</h3>
        <p className="text-sm text-red-200/60 mb-6 max-w-xs">{error}</p>
        <Button variant="outline" className="border-white/10 text-white" onClick={checkHealth}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Link
        </Button>
      </div>
    );
  }

  if (step === "selection") {
    const coins = [
      { id: "BTC", name: "Bitcoin", icon: <Bitcoin className="text-orange-400" />, desc: "Secure & Decentralized" },
      { id: "ETH", name: "Ethereum", icon: <Coins className="text-indigo-400" />, desc: "Smart Contracts" },
      { id: "SOL", name: "Solana", icon: <Coins className="text-purple-400" />, desc: "Flash Fast Transfers" },
      { id: "LTC", name: "Litecoin", icon: <Coins className="text-blue-200" />, desc: "Legacy Efficiency" },
      { id: "USDT_ERC20", name: "USDT (ERC20)", icon: <ShieldCheck className="text-green-400" />, desc: "Pure Stability" },
      { id: "USDC_ERC20", name: "USDC (ERC20)", icon: <ShieldCheck className="text-blue-500" />, desc: "Trust & Transparency" },
    ] as const;

    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
            <p className="text-muted-foreground text-sm uppercase tracking-widest mb-1 font-display">Select Network</p>
            <h3 className="text-white text-2xl font-bold uppercase tracking-tight">Crypto Checkout</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {coins.map((c) => {
            const isDisabled = health?.details.missingWallets?.includes(c.id);
            return (
              <button
                key={c.id}
                disabled={isDisabled}
                onClick={() => initiatePayment(c.id)}
                className={`p-4 rounded-2xl bg-white/5 border text-left transition-all group relative overflow-hidden ${
                  isDisabled 
                    ? "opacity-40 grayscale cursor-not-allowed border-transparent" 
                    : "border-white/10 hover:border-primary/50 hover:bg-white/10 active:scale-95"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-xl bg-background/50 border border-white/5 group-hover:border-primary/30 transition-colors">
                        {c.icon}
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
                </div>
                <div className="text-white font-bold">{c.name}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.desc}</div>
                {isDisabled && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[8px] text-red-400 uppercase font-bold tracking-tighter">
                        Unavailable
                    </div>
                )}
              </button>
            );
          })}
        </div>
        
        <div className="p-4 rounded-xl bg-orange-400/5 border border-orange-400/10 flex gap-3 text-xs text-orange-200/60 leading-relaxed">
            <AlertCircle className="w-5 h-5 text-orange-400 shrink-0" />
            <p>Orders use unique <b>Fingerprinted Amounts</b> (e.g. $19.9914) to identify your payment. Send the <b>EXACT</b> coin amount shown on the next screen.</p>
        </div>
      </div>
    );
  }

  if (step === "payment" && paymentData) {
    return (
      <div className="space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="flex items-center justify-between">
            <button onClick={() => setStep("selection")} className="text-muted-foreground hover:text-white text-xs uppercase font-bold tracking-widest flex items-center gap-1 transition-colors">
                <ArrowRight className="w-3 h-3 rotate-180" />
                Back
            </button>
            <div className={`px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase items-center flex gap-1.5`}>
                <Loader2 className="w-3 h-3 animate-spin" />
                Tracking Network
            </div>
        </div>

        <div className="text-center">
            <h3 className="text-muted-foreground text-xs uppercase tracking-[0.2em] font-display mb-1">Total Requested</h3>
            <div className="text-4xl font-display font-black text-white flex flex-col items-center">
                <span>{paymentData.expectedAmount} <span className="text-primary">{paymentData.coin}</span></span>
                <span className="text-sm text-muted-foreground mt-1 line-through opacity-30 tracking-widest font-sans font-light">${paymentData.usdAmount}</span>
            </div>
        </div>

        <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 relative group">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1.5">Destination Address</p>
                <div className="text-xs font-mono break-all text-white read-only bg-transparent border-none p-0 w-full mb-1">
                    {paymentData.walletAddress}
                </div>
                <button 
                    onClick={() => copyToClipboard(paymentData.walletAddress)}
                    className="absolute top-4 right-4 p-2 rounded-lg bg-background hover:bg-primary/20 hover:text-primary transition-all active:scale-90"
                >
                    <Copy className="w-4 h-4" />
                </button>
            </div>

            <div className="flex gap-3">
                <Button 
                    variant="outline" 
                    className="flex-1 py-6 rounded-2xl border-white/10 hover:bg-white/5 text-white gap-2"
                    onClick={() => copyToClipboard(paymentData.expectedAmount.toString())}
                >
                    <Copy className="w-4 h-4" />
                    Copy Amount
                </Button>
                <Button 
                    variant="outline" 
                    className="p-4 py-6 rounded-2xl border-white/10 hover:bg-white/5 text-white"
                >
                    <QrCode className="w-6 h-6" />
                </Button>
            </div>
        </div>

        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-white font-bold uppercase tracking-tight">
                <Clock className="w-4 h-4 text-primary" />
                Order Expiry: {formatTime(timeLeft)}
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-primary transition-all duration-1000" 
                    style={{ width: `${(timeLeft / 1800) * 100}%` }}
                />
            </div>
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                Your transaction will be detected automatically within 2-5 minutes of hitting the mempool. <br/>
                <a href={`https://blockstream.info/address/${paymentData.walletAddress}`} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 mt-1">
                    View on Blockchain <ExternalLink className="w-2 h-2" />
                </a>
            </p>
        </div>

        {paymentStatus === "confirmed" && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500 rounded-3xl z-10">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 mb-6 shadow-[0_0_40px_rgba(34,197,94,0.4)]">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 italic">Access Granted</h3>
                <p className="text-muted-foreground text-sm uppercase tracking-widest font-light">Payment Synchronized Successfully</p>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-12">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
    </div>
  );
}
