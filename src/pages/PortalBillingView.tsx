import React, { useState, useEffect } from "react";
import { useShopOwner } from "@/hooks/useShopOwner";
import BillingPosTab from "@/components/Shop/BillingPosTab";
import { Loader2, Store, ArrowLeft, ChefHat, Bell, Table2, Maximize2, Minimize2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function PortalBillingView() {
  const { shop, loading, error } = useShopOwner();

  // Fullscreen state detection
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-955 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#FF6A00]" />
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-955 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-md shadow-sm">
          <Store
            size={40}
            className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4"
          />
          <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
            {error || "No shop found."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-955 text-zinc-900 dark:text-zinc-150 transition-colors duration-200 pb-12">
      <div className="w-full px-4 md:px-8 py-4">
        {/* Unified High-Density Header Row (Sticky and Glassmorphic on mobile) */}
        {!isFullscreen && (
          <div className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-black/[0.05] dark:border-zinc-800 p-2 flex items-center justify-between -mx-4 sm:mx-0 sm:rounded-md sm:border sm:mb-3 mb-2 shadow-2xs transition-all">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              to={`/portal/tables?shopId=${shop.id}`}
              className="w-7 h-7 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-[#0A0A0F]/40 dark:text-zinc-400 hover:text-[#0A0A0F] dark:hover:text-zinc-150 transition-colors shadow-sm shrink-0"
              title="Back to Seating Map"
            >
              <ArrowLeft size={13} />
            </Link>
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                {shop.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/portal/tables?shopId=${shop.id}`}
              className="h-8 px-2.5 sm:px-3 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-[#0A0A0F]/60 dark:text-zinc-300 hover:text-[#0A0A0F] dark:hover:text-zinc-150 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Table2 size={11} className="text-[#FF6A00]" />
              <span className="hidden xs:inline">Floor Plan</span>
            </Link>
            <Link
              to={`/portal/waiter?shopId=${shop.id}`}
              className="h-8 px-2.5 sm:px-3 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-[#0A0A0F]/60 dark:text-zinc-300 hover:text-[#0A0A0F] dark:hover:text-zinc-150 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Bell size={11} className="text-[#FF6A00]" />
              <span className="hidden xs:inline">Waiter</span>
            </Link>
            <Link
              to={`/portal/kitchen?shopId=${shop.id}`}
              className="h-8 px-2.5 sm:px-3 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-[#0A0A0F]/60 dark:text-zinc-300 hover:text-[#0A0A0F] dark:hover:text-zinc-150 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <ChefHat size={11} className="text-[#FF6A00]" />
              <span className="hidden xs:inline">Kitchen</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch((err) => {
                    console.error("Failed to enter fullscreen:", err);
                  });
                } else {
                  document.exitFullscreen().catch((err) => {
                    console.error("Failed to exit fullscreen:", err);
                  });
                }
              }}
              className="h-8 w-8 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all shadow-sm shrink-0 cursor-pointer"
              title="Enter Fullscreen"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      )}

        <div className="w-full">
          <BillingPosTab shop={shop} />
        </div>
      </div>

      {/* Floating Exit Fullscreen Button */}
      {isFullscreen && (
        <button
          onClick={() => {
            if (document.exitFullscreen) {
              document.exitFullscreen().catch((err) => console.log(err));
            }
          }}
          className="fixed bottom-6 right-6 z-[9999] w-10 h-10 rounded-full bg-zinc-900/90 dark:bg-zinc-800/90 hover:bg-zinc-950 dark:hover:bg-zinc-700 text-white dark:text-zinc-100 backdrop-blur-md border border-zinc-800 dark:border-zinc-700 flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer animate-in fade-in duration-200"
          title="Exit Fullscreen"
        >
          <Minimize2 size={16} />
        </button>
      )}
    </div>
  );
}
