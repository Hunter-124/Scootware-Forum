import React, { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Zap, ShoppingCart, Calendar } from "lucide-react";
import { useGetProducts } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { cn, formatUpgradeDisplay } from "@/lib/utils";

export default function Upgrades() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { data: products } = useGetProducts();

  // Get active products from user.activeProducts array
  const activeProducts = user?.activeProducts?.filter((p: any) => 
    p.expiresAt && new Date(p.expiresAt) > new Date()
  ) || [];
  
  const hasActiveSubscription = activeProducts.length > 0;
  
  // Map product IDs to product details
  const activeProductDetails = activeProducts.map((ap: any) => {
    const product = products?.find(p => p.id === ap.productId);
    return {
      ...product,
      expiresAt: ap.expiresAt,
    };
  }).filter(Boolean);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    if (!hasActiveSubscription) {
      setLocation(`/profile/${user.id}`);
    }
  }, [isAuthenticated, user, hasActiveSubscription, setLocation]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="glass-panel p-12 text-center rounded-2xl border-destructive/30">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-display font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-6">Please log in to view your subscription status.</p>
          <Button variant="glow" onClick={() => setLocation("/login")}>Initialize Login</Button>
        </div>
      </div>
    );
  }

  if (!hasActiveSubscription) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="glass-panel p-12 text-center rounded-2xl border-primary/30">
          <p className="text-muted-foreground">No active subscription found—redirecting to your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-bold tracking-widest mb-6 uppercase">
          <Zap className="w-3 h-3" /> Subscription Portal
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
          Your Upgrades
        </h1>
        <p className="text-lg text-muted-foreground">
          Manage and view your active subscriptions and upgrade options.
        </p>
      </div>

      {/* Current Active Subscriptions */}
      <div className="glass-panel p-8 rounded-xl border border-white/10 mb-12">
        <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
          <Zap className="w-6 h-6 text-accent" />
          Active Subscriptions ({activeProductDetails.length})
        </h2>

        {hasActiveSubscription ? (
          <div className="space-y-6">
            {activeProductDetails.map((product: any) => (
              <div key={product.id} className="bg-primary/5 border border-primary/30 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{formatUpgradeDisplay(product.name)}</h3>
                    <p className="text-muted-foreground">{product.description}</p>
                  </div>
                  <Check className="w-8 h-8 text-accent flex-shrink-0 mt-1" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-primary/20">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-2">Type</div>
                    <div className={cn("inline-block text-sm font-bold uppercase tracking-widest px-2 py-1 rounded border", 
                      product.tier === "lifetime"
                        ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
                        : "bg-primary/20 border-primary/50 text-primary"
                    )}>
                      {formatUpgradeDisplay(product.tier || "premium")}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-2">Expires In</div>
                    <div className="text-lg font-bold text-white">
                      {formatDistanceToNow(new Date(product.expiresAt || Date.now()), { addSuffix: true })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-2">Price</div>
                    <div className="text-lg font-bold text-white">${product.price?.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-2">Expires On</div>
                    <div className="text-lg font-bold text-white">
                      {new Date(product.expiresAt || Date.now()).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="outline" className="flex-1" onClick={() => setLocation("/store")}>
                <ShoppingCart className="w-4 h-4 mr-2" /> Buy More Products
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-muted/30 border border-muted/50 rounded-lg p-8 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">No Active Subscription</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              You don't currently have an active subscription. Upgrade now to access premium features and exclusive content.
            </p>
            <Button variant="glow" onClick={() => setLocation("/store")}>
              <ShoppingCart className="w-4 h-4 mr-2" /> View Store
            </Button>
          </div>
        )}
      </div>

      {/* Available Upgrades */}
      <div className="glass-panel p-8 rounded-xl border border-white/10">
        <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
          <ShoppingCart className="w-6 h-6 text-primary" />
          Available Products
        </h2>

        {products && products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const isOwned = activeProducts.some(ap => ap.productId === product.id);
              const ownedProduct = activeProducts.find(ap => ap.productId === product.id);
              return (
                <div
                  key={product.id}
                  className={`rounded-lg border p-6 transition-all ${
                    isOwned
                      ? "border-primary/50 bg-primary/5"
                      : "border-white/10 bg-white/5 hover:border-primary/30"
                  }`}
                >
                  <h3 className="text-lg font-bold text-white mb-2">{formatUpgradeDisplay(product.name)}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{product.description}</p>
                  
                  <div className="mb-6 pt-4 border-t border-white/5">
                    <div className="text-3xl font-bold text-white">
                      ${product.price?.toFixed(2)}
                    </div>
                  </div>

                  {isOwned ? (
                    <div>
                      <Button
                        disabled
                        className="w-full mb-2"
                        variant="outline"
                      >
                        <Check className="w-4 h-4 mr-2" /> Active Until
                      </Button>
                      <div className="text-xs text-muted-foreground text-center">
                        {new Date(ownedProduct?.expiresAt || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="glow"
                      className="w-full"
                      onClick={() => setLocation("/store")}
                    >
                      Add to Cart
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No upgrades available at this time.
          </div>
        )}
      </div>
    </div>
  );
}
