import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  Search,
  LayoutDashboard,
  ListFilter,
  Image as ImageIcon,
  CalendarDays,
  Star,
  Settings2,
  Table2,
  ChefHat,
  Users,
  LogOut,
  ArrowLeft,
  QrCode,
  Sparkles,
  MessageSquare,
  Calculator
} from "lucide-react";
import Dialog from "./Dialog";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  shop: any;
}

export default function CommandPalette({ isOpen, onClose, shop }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset search and active index when palette opens
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const shopId = shop?.id || "";

  // Define commands group list
  const commands = useMemo(() => {
    const list = [
      // Navigation
      {
        id: "nav-overview",
        label: "Overview & Analytics",
        category: "Navigation",
        icon: LayoutDashboard,
        action: () => {
          navigate(`/manage?id=${shopId}&view=overview`);
          onClose();
        },
        shortcut: "G O"
      },
      {
        id: "nav-catalog",
        label: "Catalog Manager",
        category: "Navigation",
        icon: ListFilter,
        action: () => {
          navigate(`/manage?id=${shopId}&view=catalog`);
          onClose();
        },
        shortcut: "G C"
      },
      {
        id: "nav-gallery",
        label: "Photo Gallery",
        category: "Navigation",
        icon: ImageIcon,
        action: () => {
          navigate(`/manage?id=${shopId}&view=gallery`);
          onClose();
        },
        shortcut: "G G"
      },
      {
        id: "nav-hours",
        label: "Business Hours",
        category: "Navigation",
        icon: CalendarDays,
        action: () => {
          navigate(`/manage?id=${shopId}&view=hours`);
          onClose();
        },
        shortcut: "G H"
      },
      {
        id: "nav-reviews",
        label: "Customer Reviews",
        category: "Navigation",
        icon: Star,
        action: () => {
          navigate(`/manage?id=${shopId}&view=reviews`);
          onClose();
        },
        shortcut: "G R"
      },
      {
        id: "nav-settings",
        label: "Shop Settings",
        category: "Navigation",
        icon: Settings2,
        action: () => {
          navigate(`/manage?id=${shopId}&view=settings`);
          onClose();
        },
        shortcut: "G S"
      },
      // Real-Time Operations
      {
        id: "ops-tables",
        label: "Tables Floor plan & QR Map",
        category: "Operations",
        icon: Table2,
        action: () => {
          navigate(`/tables?shopId=${shopId}`);
          onClose();
        },
        shortcut: "O T"
      },
      {
        id: "ops-kitchen",
        label: "Kitchen Live View",
        category: "Operations",
        icon: ChefHat,
        action: () => {
          navigate(`/kitchen?shopId=${shopId}`);
          onClose();
        },
        shortcut: "O K"
      },
      {
        id: "ops-waiter",
        label: "Waiter Live Console",
        category: "Operations",
        icon: Users,
        action: () => {
          navigate(`/waiter?shopId=${shopId}`);
          onClose();
        },
        shortcut: "O W"
      },
      // Actions
      {
        id: "act-dashboard",
        label: "Back to All Businesses",
        category: "Actions",
        icon: ArrowLeft,
        action: () => {
          navigate("/dashboard");
          onClose();
        },
        shortcut: "ESC"
      },
      {
        id: "act-logout",
        label: "Sign Out of Console",
        category: "Actions",
        icon: LogOut,
        action: () => {
          logout();
          onClose();
        }
      }
    ];

    return list;
  }, [shopId, navigate, logout, onClose]);

  // Filter commands by search term
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    const term = search.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(term) ||
        c.category.toLowerCase().includes(term) ||
        c.shortcut?.toLowerCase().includes(term)
    );
  }, [search, commands]);

  // Handle keyboard navigation inside list
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[activeIndex]) {
          filteredCommands[activeIndex].action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeIndex, filteredCommands]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  // Group filtered items by category for rendering
  const renderedItems = useMemo(() => {
    let indexTracker = 0;
    const categories: Record<string, any[]> = {};

    filteredCommands.forEach((cmd) => {
      const currentIdx = indexTracker++;
      if (!categories[cmd.category]) {
        categories[cmd.category] = [];
      }
      categories[cmd.category].push({ ...cmd, listIndex: currentIdx });
    });

    return categories;
  }, [filteredCommands]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      showHeader={false}
      padding={false}
      maxWidth="max-w-[460px]"
      rounded="rounded-lg"
    >
      <div className="flex flex-col bg-white dark:bg-zinc-900 overflow-hidden font-sans">
        {/* Search bar */}
        <div className="relative border-b border-black/[0.06] dark:border-zinc-800 flex items-center px-3">
          <Search size={15} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type a command or search..."
            className="w-full h-11 pl-2.5 pr-8 bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
          />
          <div className="absolute right-3 px-1.5 py-0.5 rounded bg-zinc-50 border border-zinc-200 text-[8px] font-black text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500 uppercase tracking-wider select-none">
            ESC
          </div>
        </div>

        {/* List of commands */}
        {filteredCommands.length > 0 ? (
          <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-3 custom-scrollbar">
            {Object.entries(renderedItems).map(([category, items]) => (
              <div key={category} className="space-y-0.5">
                <span className="px-2.5 text-[8.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">
                  {category}
                </span>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isSelected = activeIndex === item.listIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setActiveIndex(item.listIndex)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md transition-all text-left cursor-pointer ${
                          isSelected
                            ? "bg-[#FF6A00] text-white shadow-sm"
                            : "text-zinc-650 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            size={14}
                            className={`shrink-0 ${isSelected ? "text-white" : "text-zinc-400 dark:text-zinc-500"}`}
                          />
                          <span className="text-xs font-bold truncate leading-none">
                            {item.label}
                          </span>
                        </div>
                        {item.shortcut && (
                          <span
                            className={`text-[8.5px] font-bold font-mono px-1 py-0.5 rounded shrink-0 ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-zinc-50 border border-zinc-250/60 text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500"
                            }`}
                          >
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-zinc-400 dark:text-zinc-500 space-y-1">
            <Search size={22} className="mx-auto opacity-40 mb-1.5" />
            <p className="text-xs font-bold">No results found</p>
            <p className="text-[10px] text-zinc-400/80">No matching commands found for "{search}"</p>
          </div>
        )}

        {/* Command hints footer */}
        <div className="px-3.5 py-2 border-t border-black/[0.04] dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/20 flex items-center justify-between text-[9px] font-bold text-zinc-400 dark:text-zinc-500 select-none">
          <div className="flex items-center gap-2.5">
            <span>↑↓ to navigate</span>
            <span>·</span>
            <span>enter to select</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Toggle with</span>
            <kbd className="px-1 py-0.5 bg-zinc-50 border border-zinc-250/60 dark:bg-zinc-850 dark:border-zinc-700 rounded font-mono text-[8px] font-black leading-none">
              ⌘K
            </kbd>
            <span>or</span>
            <kbd className="px-1 py-0.5 bg-zinc-50 border border-zinc-250/60 dark:bg-zinc-850 dark:border-zinc-700 rounded font-mono text-[8px] font-black leading-none">
              Ctrl+K
            </kbd>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
