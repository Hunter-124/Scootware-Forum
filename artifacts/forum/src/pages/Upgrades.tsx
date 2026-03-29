import React from "react";
import { useGetUpgrades, usePurchaseUpgrade } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Cpu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

export default function Upgrades() {
  const { data: upgrades, isLoading } = useGetUpgrades();
  const { isAuthenticated } = useAuth();
  const purchase = usePurchaseUpgrade();

  const handlePurchase = (upgradeId: string) => {
    // In a real app this would redirect to stripe
    alert("Payment integration simulation: Initiating secure handshake...");
    purchase.mutate({ data: { upgradeId } }, {
      onSuccess: () => alert("Handshake successful. Upgrade applied.")
    });
  };

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/20 text-accent mb-6 shadow-[0_0_30px_rgba(217,70,239,0.3)]">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-extrabold text-white mb-4 tracking-tight">
          ELEVATE YOUR <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">CAPABILITIES</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-light">
          Unlock restricted sectors, gain access to specialized driver configurations, and establish dominance with premium hardware integrations.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => <div key={i} className="h-96 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
          {upgrades?.map((upgrade, idx) => {
            const isPopular = upgrade.name.toLowerCase().includes('premium');
            
            return (
              <div 
                key={upgrade.id} 
                className={`relative glass-panel rounded-3xl p-8 flex flex-col border overflow-hidden transition-transform duration-300 hover:-translate-y-2 hover:shadow-2xl ${
                  isPopular 
                    ? "border-primary/50 shadow-[0_0_30px_rgba(168,85,247,0.15)] md:-mt-8 md:pb-12" 
                    : "border-white/10"
                }`}
              >
                {isPopular && (
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-accent" />
                )}
                
                <div className="mb-8">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-2xl font-display font-bold text-white uppercase tracking-wider">{upgrade.name}</h3>
                    {isPopular && <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Most Popular</span>}
                  </div>
                  <p className="text-sm text-muted-foreground h-10">{upgrade.description}</p>
                </div>
                
                <div className="mb-8 flex items-baseline gap-2">
                  <span className="text-5xl font-display font-bold text-white">${upgrade.price}</span>
                  <span className="text-muted-foreground">/{upgrade.durationDays === 36500 ? 'lifetime' : `${upgrade.durationDays}d`}</span>
                </div>

                <div className="mb-8 relative w-32 h-32 mx-auto mix-blend-screen opacity-80">
                   {/* We use an image depending on the upgrade name to make it look cool */}
                   <img 
                     src={`${import.meta.env.BASE_URL}images/upgrade-${upgrade.name.toLowerCase()}.png`} 
                     onError={(e) => { e.currentTarget.style.display='none' }}
                     className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" 
                     alt=""
                   />
                </div>

                <ul className="space-y-4 mb-8 flex-1">
                  {upgrade.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                      <div className="mt-0.5 rounded-full bg-primary/20 p-0.5 border border-primary/30 shrink-0">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {!isAuthenticated ? (
                  <Link href="/login" className="mt-auto">
                    <Button variant={isPopular ? "glow" : "secondary"} className="w-full py-6 text-lg rounded-xl">Initialize Login</Button>
                  </Link>
                ) : (
                  <Button 
                    variant={isPopular ? "glow" : "outline"} 
                    className={`w-full py-6 text-lg rounded-xl ${!isPopular && 'border-white/20 hover:bg-white/10'}`}
                    onClick={() => handlePurchase(upgrade.id)}
                    disabled={purchase.isPending}
                  >
                    {purchase.isPending ? "Processing..." : "Acquire Access"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      <div className="mt-16 p-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-4 text-muted-foreground text-sm max-w-2xl mx-auto text-center">
        <Cpu className="w-5 h-5 opacity-50" /> All transactions are encrypted. Instant hardware access upon confirmation.
      </div>
    </div>
  );
}
