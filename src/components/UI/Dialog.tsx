import React, { useEffect } from "react";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  maxWidth?: string;
  showClose?: boolean;
  showHeader?: boolean;
  padding?: boolean;
  footer?: React.ReactNode;
  rounded?: string;
}

export default function Dialog({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  icon: Icon,
  maxWidth = "max-w-md",
  showClose = true,
  showHeader = true,
  padding = true,
  footer,
  rounded = "rounded-md"
}: DialogProps) {
  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center sm:p-4 bg-[#0A0A0F]/40 dark:bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-zinc-900 rounded-t-2xl sm:${rounded} w-full ${maxWidth} shadow-2xl border-t sm:border border-black/[0.05] dark:border-zinc-800 animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 relative max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle Indicator */}
        <div className="w-12 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto my-2.5 sm:hidden flex-shrink-0 animate-pulse" />

        {/* Header */}
        {showHeader && (
          <div className="flex items-center justify-between px-4 pb-4 sm:pt-4 border-b border-black/[0.05] dark:border-zinc-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="w-8 h-8 rounded-md bg-[#FF6A00]/10 flex items-center justify-center text-[#FF6A00]">
                  <Icon size={16} />
                </div>
              )}
              <div>
                <h3 className="text-[15px] font-semibold text-[#0A0A0F] dark:text-zinc-100 tracking-tight leading-none">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-[12px] text-[#0A0A0F]/40 dark:text-zinc-400 mt-1 leading-none font-medium">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {showClose && (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#0A0A0F]/30 hover:bg-black/[0.04] hover:text-[#0A0A0F] dark:text-zinc-550 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-all cursor-pointer"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={`${padding ? "p-4" : ""} overflow-y-auto flex-1 custom-scrollbar text-[#0A0A0F] dark:text-zinc-350`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-black/[0.05] dark:border-zinc-800 flex-shrink-0 bg-[#F7F7F5]/50 dark:bg-zinc-950/50 backdrop-blur-sm">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
