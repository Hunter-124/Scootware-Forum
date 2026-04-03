import React from "react";
import Products from "./Products";
import { ShoppingCart } from "lucide-react";

export default function Store() {
  return (
    <div className="w-full">
      {/* Custom Header for Store */}
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 py-12 md:py-20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-primary/10 blur-[120px] rounded-full -z-10" />
        
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-6">
            <ShoppingCart className="w-8 h-8 text-primary" />
            <span className="text-sm font-bold tracking-widest uppercase text-primary">The Store</span>
          </div>
          
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-black text-white mb-4 tracking-tighter">
              Premium Products
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl">
              Discover our exclusive collection of gaming software and tools designed to maximize your performance and competitive edge.
            </p>
          </div>
        </div>
      </div>

      {/* Products Component */}
      <Products />
    </div>
  );
}
