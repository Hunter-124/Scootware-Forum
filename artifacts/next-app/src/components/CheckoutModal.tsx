import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bitcoin, ShieldCheck } from "lucide-react";
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
  const [method, setMethod] = useState<"crypto">("crypto");
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

          <div className="mb-6">
            <div className="text-center p-3 rounded-lg border border-primary bg-primary/10">
              <Bitcoin className="w-5 h-5 mb-1 mx-auto" />
              <span className="text-xs font-bold uppercase text-primary">Crypto Payment</span>
            </div>
          </div>

          <div className="min-h-[200px]">
            <div className="animate-in fade-in">
              <CryptoCheckout 
                productIds={productIds} 
                onSuccess={(requestId) => {
                  setTimeout(() => onPaymentSuccess(requestId), 2000);
                }} 
              />
            </div>
          </div>
        </div>


      </DialogContent>
    </Dialog>
  );
}
