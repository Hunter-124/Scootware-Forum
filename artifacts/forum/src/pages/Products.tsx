import React, { useState, useEffect } from "react";
import { useGetProducts, usePurchaseProduct, useVerifyPayment } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, ShoppingCart, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { CheckoutModal } from "@/components/CheckoutModal";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatUpgradeDisplay } from "@/lib/utils";
import { PRODUCT_IMAGES } from "@/lib/product-assets";



export default function Products() {
  const { data: products, isLoading } = useGetProducts();
  const { isAuthenticated, invalidateAuth } = useAuth();
  const purchase = usePurchaseProduct();
  const verify = useVerifyPayment();
  const [, setLocation] = useLocation();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    try {
      const savedCart = sessionStorage.getItem("guest_cart");
      return savedCart ? JSON.parse(savedCart) : [];
    } catch {
      return [];
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);

  useEffect(() => {
    sessionStorage.setItem("guest_cart", JSON.stringify(selectedIds));
  }, [selectedIds]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const getCartCalculations = () => {
    if (!products) return { original: 0, discounted: 0 };
    
    let original = 0;
    let discounted = 0;
    
    const selectedProducts = selectedIds
      .map(id => products.find(u => u.id === id)!)
      .filter(Boolean)
      .sort((a, b) => b.price - a.price);

    selectedProducts.forEach((product, idx) => {
      original += product.price;
      if (idx === 0) discounted += product.price;
      else if (idx === 1) discounted += product.price * 0.75;
      else discounted += product.price * 0.50;
    });
    
    return { original, discounted };
  };

  const handleCheckout = async () => {
    if (selectedIds.length === 0) return;

    if (!isAuthenticated) {
      setLocation("/login");
      return;
    }

    try {
      const res = await purchase.mutateAsync({ data: { productIds: selectedIds } });
      setCheckoutData(res);
      // If server returned a Stripe Checkout URL, redirect immediately
      if (res && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      setIsModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePaymentSuccess = async (requestId?: number) => {
    try {
      if (!requestId) {
        await verify.mutateAsync({
          data: {
            clientSecret: checkoutData.clientSecret,
            productIds: selectedIds
          }
        });
      }
      setIsModalOpen(false);
      setSelectedIds([]);
      sessionStorage.removeItem("guest_cart");
      invalidateAuth();
      window.location.href = "/";
    } catch (err) {
      console.error(err);
    }
  };

  const { original, discounted } = getCartCalculations();

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 relative">
      {/* Background Mesh Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-primary/10 blur-[120px] rounded-full -z-10" />
      
      <div className="text-center mb-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest mb-6"
        >
          <Sparkles className="w-3 h-3" /> Premium Software Hub
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-display font-black text-white mb-6 tracking-tighter leading-none"
        >
          ELEVATE YOUR <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary animate-gradient-x">GAMEPLAY</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium"
        >
          Industry-leading gaming products designed for aggressive performance. 
          Establish dominance with low-detection, high-precision tools.
        </motion.p>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-32">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[450px] rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-40"
          >
            {products?.map((product, idx) => {
              const isSelected = selectedIds.includes(product.id);
              const productImage = PRODUCT_IMAGES[product.id];
              const isInviteOnly = (product as any).inviteOnly === true;
              
              return (
                <motion.div 
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "group relative glass-panel rounded-[2rem] flex flex-col border transition-all duration-500 overflow-hidden",
                    isInviteOnly
                      ? "border-white/5 bg-white/[0.02] cursor-not-allowed opacity-60"
                      : isSelected 
                        ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20 scale-[1.02] shadow-[0_20px_50px_rgba(168,85,247,0.15)] cursor-pointer" 
                        : "border-white/10 hover:border-white/30 hover:bg-white/5 cursor-pointer"
                  )}
                  onClick={() => !isInviteOnly && toggleSelection(product.id)}
                >
                  {/* Product Image Header */}
                  <div className="relative h-48 w-full overflow-hidden">
                    <div className={cn(
                      "absolute inset-0 z-10",
                      isInviteOnly ? "bg-black/40" : "bg-gradient-to-t from-background via-transparent to-transparent"
                    )} />
                    <motion.img 
                      src={`${import.meta.env.BASE_URL}${productImage}`} 
                      alt={product.name}
                      className={cn(
                        "w-full h-full object-cover transition-transform duration-700",
                        isInviteOnly ? "grayscale" : "group-hover:scale-110"
                      )}
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                    />
                    
                    {/* Invite Only Badge */}
                    {isInviteOnly && (
                      <div className="absolute inset-0 flex items-center justify-center z-20">
                        <div className="bg-black/70 px-4 py-2 rounded-lg border border-amber-500/50">
                          <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                            Invite Only
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Selection Indicator Overlay */}
                    <AnimatePresence>
                      {isSelected && !isInviteOnly && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-accent to-primary z-20"
                        />
                      )}
                    </AnimatePresence>

                    {/* Selected Checkmark Overlay */}
                    {isSelected && !isInviteOnly && (
                      <div className="absolute top-4 right-4 z-20">
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="bg-primary text-white p-1 rounded-full shadow-lg"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </motion.div>
                      </div>
                    )}
                  </div>

                  <div className="p-8 pt-4 flex flex-col flex-1">
                    <h3 className={cn(
                      "text-2xl font-display font-black tracking-tight uppercase transition-colors mb-2",
                      isInviteOnly 
                        ? "text-muted-foreground" 
                        : "text-white group-hover:text-primary"
                    )}>
                      {formatUpgradeDisplay(product.name)}
                    </h3>
                    
                    <p className={cn(
                      "text-sm font-medium leading-relaxed mb-8 transition-colors",
                      isInviteOnly 
                        ? "text-muted-foreground/60" 
                        : "text-muted-foreground group-hover:text-white/70"
                    )}>
                      {product.description}
                    </p>
                    
                    <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-6">
                      <div className="flex items-baseline gap-2">
                        <span className={cn(
                          "text-4xl font-display font-black tracking-tighter",
                          isInviteOnly ? "text-muted-foreground/60" : "text-white"
                        )}>
                          ${product.price}
                        </span>
                        <span className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/10">
                          {product.durationDays === 36500 ? 'LIFETIME' : `${product.durationDays}D ACCESS`}
                        </span>
                      </div>

                      <ul className="space-y-3">
                        {product.features.slice(0, 3).map((feature: string, i: number) => (
                          <li key={i} className={cn(
                            "flex items-center gap-3 text-xs font-bold",
                            isInviteOnly
                              ? "text-muted-foreground/40"
                              : "text-muted-foreground group-hover:text-gray-300"
                          )}>
                            <CheckCircle2 className={cn(
                              "w-3.5 h-3.5",
                              isInviteOnly ? "text-muted-foreground/40" : "text-primary opacity-50"
                            )} />
                            <span className="uppercase tracking-wider">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button 
                        variant={isSelected && !isInviteOnly ? "outline" : "glow"} 
                        disabled={isInviteOnly}
                        className={cn(
                          "w-full py-6 rounded-2xl font-black uppercase tracking-widest text-xs",
                          isInviteOnly
                            ? "bg-white/5 text-muted-foreground/50 cursor-not-allowed border-white/5"
                            : isSelected ? "border-primary/40 text-primary" : ""
                        )}
                      >
                        {isInviteOnly ? "Invite Required" : isSelected ? "Selected" : "Add to Cart"}
                      </Button>
                    </div>
                  </div>

                  {/* Aesthetic Corner Flare */}
                  <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-primary/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Floating Modern Checkout Hub */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 inset-x-0 px-4 z-50 flex justify-center pointer-events-none"
          >
             <div className="glass-panel border border-primary/30 bg-background/80 backdrop-blur-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5),0_0_40px_rgba(168,85,247,0.2)] rounded-[2.5rem] p-2 pr-6 flex items-center gap-8 max-w-3xl w-full pointer-events-auto ring-1 ring-white/10">
               <div className="p-4 bg-primary/20 rounded-[2rem] border border-primary/20 text-primary hidden md:block">
                 <ShoppingCart className="w-8 h-8" />
               </div>
               
               <div className="flex-1 min-w-0 pl-4 md:pl-0">
                 <div className="flex items-center gap-3 mb-1">
                   <span className="font-black text-white uppercase tracking-tighter text-lg">
                     {selectedIds.length} PRODUCT{selectedIds.length > 1 ? 'S' : ''}
                   </span>
                   {selectedIds.length > 1 && (
                     <span className="bg-green-500/10 text-green-500 text-[9px] font-black px-2 py-0.5 rounded border border-green-500/20 uppercase tracking-widest">
                       Multi-Buy Deal
                     </span>
                   )}
                 </div>
                 <p className="text-xs text-muted-foreground font-bold truncate uppercase tracking-widest opacity-60">
                   Secure checkout encrypted by Scootware
                 </p>
               </div>
               
               <div className="flex items-center gap-6">
                 <div className="text-right">
                   {selectedIds.length > 1 && (
                     <div className="text-[10px] text-muted-foreground line-through font-bold opacity-50">
                       ${original.toFixed(2)}
                     </div>
                   )}
                   <div className="text-3xl font-display font-black text-white tracking-tighter">
                     ${discounted.toFixed(2)}
                   </div>
                 </div>
                 
                 <Button 
                    variant="glow" 
                    size="lg" 
                    className="h-16 px-10 rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                    onClick={handleCheckout}
                    disabled={purchase.isPending}
                 >
                   {purchase.isPending ? "Syncing..." : (isAuthenticated ? "Checkout" : "Login")}
                 </Button>
               </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {checkoutData && (
        <CheckoutModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          clientSecret={checkoutData.clientSecret}
          totalAmount={checkoutData.totalAmount}
          paymentConfig={checkoutData.config}
          productIds={selectedIds}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
