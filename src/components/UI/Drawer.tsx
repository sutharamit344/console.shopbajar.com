import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  side?: "left" | "right";
  width?: string;
  footer?: React.ReactNode;
  showClose?: boolean;
}

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  side = "left",
  width = "w-72",
  footer,
  showClose = true,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const slideClass =
    side === "right"
      ? isOpen
        ? "translate-x-0"
        : "translate-x-full"
      : isOpen
        ? "translate-x-0"
        : "-translate-x-full";

  const positionClass = side === "right" ? "right-0" : "left-0";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[200] bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Drawer"}
        className={`fixed inset-y-0 ${positionClass} z-[201] ${width} max-w-[90vw] flex flex-col
          bg-white dark:bg-zinc-900
          border-${side === "right" ? "l" : "r"} border-zinc-200/80 dark:border-zinc-800
          shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${slideClass}`}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <div className="min-w-0">
              {title && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 leading-none mb-0.5">
                  {title}
                </p>
              )}
              {subtitle && (
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                  {subtitle}
                </p>
              )}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                aria-label="Close drawer"
                className="w-8 h-8 shrink-0 rounded-md border border-zinc-200/80 dark:border-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
