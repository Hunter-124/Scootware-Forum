import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Bitcoin, Wallet, CircleDollarSign, ShieldCheck, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CryptoCheckout } from "./CryptoCheckout";

export function CheckoutModal({ 
  isOpen, 
  onClose, 
  clientSecret, 
  totalAmount, 
  paymentConfig,
  productIds,
  onPaymentSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  clientSecret: string | null;
  totalAmount: number;
  paymentConfig: any;
  productIds: string[];
  onPaymentSuccess: (requestId?: number) => void;
}) {
  const [method, setMethod] = useState<"crypto" | "gpay">("crypto");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSimulatePayment = () => {
    setIsProcessing(true);
    // Simulate network request to payment processor
    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSuccess();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-primary/20 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> SECURE CHECKOUT
          </DialogTitle>
          <DialogDescription>
            Complete your purchase to securely unlock product access.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/10 mb-6">
            <span className="text-muted-foreground font-medium uppercase tracking-wider text-sm">Total Amount Due</span>
            <span className="text-3xl font-display font-bold text-white">${totalAmount.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-6">
            <button 
              onClick={() => setMethod("crypto")}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${method === "crypto" ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"}`}
            >
              <Bitcoin className="w-5 h-5 mb-1" />
              <span className="text-xs font-bold uppercase">Crypto</span>
            </button>
            <button 
              onClick={() => setMethod("gpay")}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${method === "gpay" ? "border-white bg-white/10 text-white" : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"}`}
            >
              <Wallet className="w-5 h-5 mb-1" />
              <span className="text-xs font-bold uppercase">GPay</span>
            </button>
          </div>

          <div className="min-h-[200px]">
            {method === "crypto" && (
              <div className="animate-in fade-in">
                <CryptoCheckout 
                  productIds={productIds} 
                  onSuccess={(requestId) => {
                    setTimeout(() => onPaymentSuccess(requestId), 2000);
                  }} 
                />
              </div>
            )}

            {method === "gpay" && (
              <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center animate-in fade-in h-full border border-white/5 bg-black/20 rounded-xl">
                <Wallet className="w-12 h-12 text-white" />
                <p className="text-sm text-muted-foreground">Pay instantly with your saved Google Pay methods.</p>
                <Button className="w-full bg-white text-black hover:bg-gray-200" onClick={handleSimulatePayment} disabled={isProcessing}>
                  {isProcessing ? "Processing..." : "Pay with GPay"}
                </Button>
              </div>
            )}
          </div>
        </div>


      </DialogContent>
    </Dialog>
  );
}
