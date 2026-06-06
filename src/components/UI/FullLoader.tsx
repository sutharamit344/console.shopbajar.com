import React from "react";

interface FullLoaderProps {
  message?: string;
}

const FullLoader: React.FC<FullLoaderProps> = ({ message = "Initializing Network..." }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F7F7F5] dark:bg-zinc-950 overflow-hidden selection:bg-[#FF6A00]/10 selection:text-[#FF6A00]">
      {/* Center Content */}
      <div className="relative flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
        {/* Animated Business Container */}
        <div className="relative mb-10">
          <div className="absolute inset-[-20px] border border-black/[0.03] dark:border-zinc-800 rounded-full animate-pulse" />
          <div className="relative w-16 h-16 bg-white dark:bg-zinc-900 rounded-md flex items-center justify-center shadow-2xl border border-black/[0.05] dark:border-zinc-800 z-10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-black/[0.02] dark:from-zinc-900 dark:to-zinc-950" />
            <img
              src="/sb-logo.png"
              alt="ShopBajar logo"
              className="relative z-10 h-11 w-11 object-contain animate-in zoom-in-50 duration-500"
            />
          </div>
          {/* Scanning Line */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#FF6A00]/40 to-transparent animate-scan" />
        </div>

        {/* Branding & Status */}
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2">
            <h2 className="text-[24px] font-bold tracking-tight text-[#0A0A0F] dark:text-zinc-100">
              Shop<span className="text-[#FF6A00]">Bajar</span>
            </h2>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-ping" />
              <p className="text-[11px] font-bold text-[#0A0A0F]/30 dark:text-zinc-500 uppercase tracking-[0.25em]">
                {message}
              </p>
            </div>

            {/* Minimal High-Density Loader */}
            <div className="w-40 h-[1.5px] bg-black/[0.03] dark:bg-zinc-800 rounded-full overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FF6A00] to-transparent w-full -translate-x-full animate-loading-bar" />
            </div>
          </div>
        </div>
      </div>

      {/* Infrastructure Note */}
      <div className="absolute bottom-12 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-[#0A0A0F]/15 dark:text-zinc-700">Distributed Network Architecture</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(-20px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(80px); opacity: 0; }
        }
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        .animate-loading-bar {
          animation: loading-bar 1.5s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
        }
      `}} />
    </div>
  );
};

export default FullLoader;
