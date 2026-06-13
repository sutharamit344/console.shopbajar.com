import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useSearchParams, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useShopOwner } from "../../hooks/useShopOwner";
import {
  LayoutDashboard,
  ListFilter,
  Image as ImageIcon,
  CalendarDays,
  Star,
  Settings2,
  Sparkles,
  Calculator,
  MessageSquare,
  Table2,
  ChefHat,
  Users,
  Menu as MenuIcon,
  X,
  LogOut,
  ArrowLeft,
  Loader2,
  CircleAlert,
  Search,
  ChevronDown,
  Store
} from "lucide-react";
import Button from "../UI/Button";
import CommandPalette from "../UI/CommandPalette";


const VIEW_LABELS: Record<string, string> = {
  overview: "Overview & Analytics",
  catalog: "Catalog Manager",
  gallery: "Photo Gallery",
  hours: "Business Hours",
  reviews: "Customer Reviews",
  settings: "Shop Settings",
  billing: "Billing & POS",
  inquiries: "Customer Inquiries",
  features: "Paid Features",
  tables: "Tables & QR",
  kitchen: "Kitchen View",
  waiter: "Waiter Console",
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { shop, loading, error } = useShopOwner();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Mobile drawer state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Command Palette state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // User dropdown menu state
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on route change or when clicking outside
  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  // Global keydown handler for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Update document.title per route/view
  useEffect(() => {
    const view = searchParams.get("view");
    const pathname = location.pathname.replace("/", "");
    const viewLabel = view ? VIEW_LABELS[view] : VIEW_LABELS[pathname];
    const shopName = shop?.name || "Console";
    document.title = viewLabel
      ? `${viewLabel} — ${shopName} · ShopBajar`
      : `${shopName} · ShopBajar Console`;
  }, [location, searchParams, shop]);

  // Dynamically set favicon to shop's logo
  useEffect(() => {
    const setFavicon = (href: string) => {
      // Remove all existing favicons
      document.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove());
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.href = href;
      document.head.appendChild(link);
    };

    if (shop?.logo) {
      // Use a proxy to avoid CORS issues with external image URLs
      const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(shop.logo)}&output=png&w=64&h=64&fit=cover`;
      setFavicon(proxyUrl);
    } else {
      setFavicon("/favicon.ico");
    }

    // Restore default favicon on unmount
    return () => {
      setFavicon("/favicon.ico");
    };
  }, [shop?.logo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6A00] mx-auto" />
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            Loading Console Workspace...
          </p>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-955 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-md shadow-sm">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-950/30 rounded-md flex items-center justify-center mx-auto text-red-550">
            <CircleAlert size={24} />
          </div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Workspace Error
          </h2>
          <p className="text-xs text-zinc-550 dark:text-zinc-400 font-medium leading-relaxed font-sans">
            {error || "Unable to load business details. Please confirm you own this shop."}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/dashboard")}
              variant="outline"
              size="sm"
              className="w-full h-9 text-xs"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const shopId = shop.id;
  const hasQrOrdering = !!shop?.paidFeatures?.qr_ordering?.enabled;
  const hasBilling =
    !!shop?.paidFeatures?.billing_system?.enabled ||
    !!shop?.paidFeatures?.invoice_tools?.enabled ||
    !!shop?.paidFeatures?.pos_slip_tools?.enabled;
  const hasInquiries = !!shop?.paidFeatures?.whatsapp_checkout?.enabled || !!shop?.paidFeatures?.dashboard_checkout?.enabled;

  // Navigation Items Definitions
  const operationsGroup = [
    {
      id: "tables",
      label: "Tables & QR",
      icon: Table2,
      path: `/tables?shopId=${shopId}`,
    },
    {
      id: "kitchen",
      label: "Kitchen View",
      icon: ChefHat,
      path: `/kitchen?shopId=${shopId}`,
    },
    {
      id: "waiter",
      label: "Waiter Console",
      icon: Users,
      path: `/waiter?shopId=${shopId}`,
    },
    ...(hasBilling ? [{
      id: "billing",
      label: "Billing & POS",
      icon: Calculator,
      path: `/manage?id=${shopId}&view=billing`,
    }] : []),
  ];

  const managementGroup = [
    {
      id: "overview",
      label: "Overview & Analytics",
      icon: LayoutDashboard,
      path: `/manage?id=${shopId}&view=overview`,
    },
    {
      id: "catalog",
      label: "Catalog Manager",
      icon: ListFilter,
      path: `/manage?id=${shopId}&view=catalog`,
    },
    {
      id: "gallery",
      label: "Photo Gallery",
      icon: ImageIcon,
      path: `/manage?id=${shopId}&view=gallery`,
    },
    {
      id: "hours",
      label: "Business Hours",
      icon: CalendarDays,
      path: `/manage?id=${shopId}&view=hours`,
    },
    {
      id: "reviews",
      label: "Customer Reviews",
      icon: Star,
      path: `/manage?id=${shopId}&view=reviews`,
    },
    {
      id: "settings",
      label: "Shop Settings",
      icon: Settings2,
      path: `/manage?id=${shopId}&view=settings`,
    },
    {
      id: "features",
      label: "Paid Features",
      icon: Sparkles,
      path: `/manage?id=${shopId}&view=features`,
    },
  ];

  const growthGroup = [
    ...(hasInquiries ? [{
      id: "inquiries",
      label: "Customer Inquiries",
      icon: MessageSquare,
      path: `/manage?id=${shopId}&view=inquiries`,
    }] : []),
  ];

  // Helper to check if a navigation item is active
  const isItemActive = (item: { id: string; path: string }) => {
    if (location.pathname === "/manage") {
      const currentView = searchParams.get("view") || "overview";
      return item.id === currentView;
    }
    const itemPathname = item.path.split("?")[0];
    return location.pathname === itemPathname;
  };

  // Determine current active group
  const getActiveGroupId = () => {
    if (operationsGroup.some(item => isItemActive(item))) {
      return "operations";
    }
    if (growthGroup.some(item => isItemActive(item))) {
      return "growth";
    }
    return "management"; // default fallback
  };

  const activeGroupId = getActiveGroupId();

  // Switch to the correct group and navigate to its first available link
  const handleGroupClick = (groupId: string) => {
    if (groupId === "operations") {
      navigate(`/tables?shopId=${shopId}`);
    } else if (groupId === "management") {
      navigate(`/manage?id=${shopId}&view=overview`);
    } else if (groupId === "growth") {
      const firstGrowthItem = growthGroup[0];
      if (firstGrowthItem) {
        navigate(firstGrowthItem.path);
      }
    }
  };

  const currentGroupItems =
    activeGroupId === "operations"
      ? operationsGroup
      : activeGroupId === "growth"
      ? growthGroup
      : managementGroup;

  const renderMobileNavGroup = (title: string, items: typeof operationsGroup) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <h3 className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-2.5 mb-1.5 font-mono">
          {title}
        </h3>
        {items.map((item) => {
          const active = isItemActive(item);
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-xs font-bold ${
                active
                  ? "bg-[#FF6A00] text-white shadow-xs"
                  : "text-zinc-650 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60"
              }`}
            >
              <item.icon size={15} className={`shrink-0 ${active ? "" : "text-zinc-400 dark:text-zinc-500"}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-950 flex flex-col text-zinc-900 dark:text-zinc-150">
      
      {/* Sticky Topbar Header (Responsive) */}
      <header className="sticky top-0 z-40 w-full flex flex-col border-b border-zinc-200/80 dark:border-zinc-850 bg-white dark:bg-zinc-900 shadow-xs">
        
        {/* Tier 1 - Brand, Modules, User Controls */}
        <div className="h-14 px-4 md:px-6 flex items-center justify-between">
          
          {/* Left: Shop Identity & Brand */}
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
              title="Back to All Businesses"
            >
              <ArrowLeft size={16} />
            </Link>
            
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#FF6A00] flex items-center justify-center text-white shrink-0 font-bold shadow-xs">
                {shop.logo ? (
                  <img src={shop.logo} alt="" className="w-full h-full object-cover rounded" />
                ) : (
                  shop.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="leading-none hidden sm:block">
                <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[150px] tracking-tight mb-0.5">
                  {shop.name}
                </h2>
                <span className="text-[8px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-mono">
                  Console
                </span>
              </div>
            </div>
          </div>

          {/* Middle: Desktop Module Switcher */}
          <nav className="hidden md:flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-200/40 dark:border-zinc-800/80">
            {(hasQrOrdering || hasBilling) && (
              <button
                onClick={() => handleGroupClick("operations")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeGroupId === "operations"
                    ? "bg-white dark:bg-zinc-800 text-[#FF6A00] dark:text-white shadow-xs"
                    : "text-zinc-550 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Operations
              </button>
            )}
            <button
              onClick={() => handleGroupClick("management")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeGroupId === "management"
                  ? "bg-white dark:bg-zinc-800 text-[#FF6A00] dark:text-white shadow-xs"
                  : "text-zinc-550 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Management
            </button>
            <button
              onClick={() => handleGroupClick("growth")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeGroupId === "growth"
                  ? "bg-white dark:bg-zinc-800 text-[#FF6A00] dark:text-white shadow-xs"
                  : "text-zinc-550 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Growth & Billing
            </button>
          </nav>

          {/* Right: User Menu & Mobile Trigger */}
          <div className="flex items-center gap-2">
            
            {/* Desktop User Info & Sign Out */}
            <div className="hidden md:flex items-center gap-2.5">
              {/* Search Trigger (Command Palette) */}
              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                className="flex items-center gap-2 px-2.5 h-7.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800 rounded-md border border-zinc-200/55 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-zinc-650 dark:text-zinc-500 dark:hover:text-zinc-350 transition-colors cursor-pointer"
                title="Search or type a command (⌘K)"
              >
                <Search size={12} className="shrink-0 text-zinc-400 dark:text-zinc-500" />
                <span>Search...</span>
                <kbd className="hidden lg:inline-flex items-center px-1 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-250/60 dark:border-zinc-700 font-mono text-[8px] leading-none text-zinc-400 dark:text-zinc-550 select-none shadow-3xs">
                  ⌘K
                </kbd>
              </button>

              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 px-2.5 py-1 bg-zinc-50 hover:bg-zinc-100/80 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/80 rounded-md border border-zinc-200/50 dark:border-zinc-800/80 cursor-pointer select-none transition-all duration-200 focus:outline-hidden"
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                >
                  <div className="w-5.5 h-5.5 rounded-full shrink-0 overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-650 dark:text-zinc-300">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span>{user?.email?.charAt(0).toUpperCase() || "M"}</span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-zinc-650 dark:text-zinc-350 truncate max-w-[100px]">
                    {user?.displayName || "Merchant"}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-zinc-400 dark:text-zinc-500 transition-transform duration-200 shrink-0 ${
                      isUserMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-56 rounded-lg border border-zinc-200/80 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 shadow-md py-1.5 z-50 animate-in fade-in-50 slide-in-from-top-1 duration-150 origin-top-right">
                    {/* User Header */}
                    <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/80">
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {user?.displayName || "Merchant"}
                      </p>
                      <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                        {user?.email}
                      </p>
                    </div>

                    {/* Navigation Actions */}
                    <div className="p-1">
                      <Link
                        to="/dashboard"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-zinc-650 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <Store size={13} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
                        <span>All Businesses</span>
                      </Link>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setIsCommandPaletteOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-zinc-650 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer text-left"
                      >
                        <Search size={13} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
                        <span className="flex-1">Command Palette</span>
                        <kbd className="hidden lg:inline-flex items-center px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-205/60 dark:border-zinc-700 font-mono text-[8px] leading-none text-zinc-400 dark:text-zinc-550 select-none shadow-3xs">
                          ⌘K
                        </kbd>
                      </button>
                    </div>

                    <div className="border-t border-zinc-100 dark:border-zinc-800/80 my-1" />

                    {/* Logout Action */}
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-955/20 transition-all cursor-pointer text-left"
                      >
                        <LogOut size={13} className="shrink-0" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Header Bar Details */}
            <div className="flex items-center gap-2 md:hidden">
              {/* Mobile Command Palette Trigger */}
              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-zinc-500 dark:text-zinc-400 cursor-pointer"
                title="Search / Actions"
              >
                <Search size={18} />
              </button>

              {/* Hamburger Toggle */}
              <button
                onClick={() => setIsMobileOpen(true)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-zinc-500 dark:text-zinc-400 cursor-pointer"
              >
                <MenuIcon size={20} />
              </button>
              
              <div className="min-w-0 flex flex-col leading-none justify-center">
                <p className="text-[8px] font-bold text-zinc-450 dark:text-zinc-550 uppercase tracking-widest mb-0.5">
                  {shop.name}
                </p>
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[120px]">
                  {VIEW_LABELS[searchParams.get("view") || location.pathname.replace("/", "")] || "Dashboard"}
                </p>
              </div>
            </div>
            
            <Link
              to="/dashboard"
              className="text-[9px] font-bold uppercase tracking-widest text-[#FF6A00] bg-[#FF6A00]/5 px-2.5 py-1.5 rounded-md border border-[#FF6A00]/15 md:hidden"
            >
              All Shops
            </Link>
          </div>
        </div>

        {/* Tier 2 - Sub-navigation Bar (Desktop Only) */}
        <div className="hidden md:flex h-10 px-6 border-t border-zinc-100 dark:border-zinc-800/60 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 h-full w-full">
            {currentGroupItems.map((item) => {
              const active = isItemActive(item);
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 h-full border-b-2 transition-all text-xs font-semibold ${
                    active
                      ? "border-[#FF6A00] text-[#FF6A00]"
                      : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-150"
                  }`}
                >
                  <item.icon size={13} className="shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer Content */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 md:hidden transition-transform duration-300 transform bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Drawer Header */}
          <div className="h-14 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[#FF6A00] flex items-center justify-center text-white shrink-0 font-bold shadow-xs">
                {shop.logo ? (
                  <img src={shop.logo} alt="" className="w-full h-full object-cover rounded" />
                ) : (
                  shop.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="leading-none">
                <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[140px] tracking-tight">
                  {shop.name}
                </h2>
                <span className="text-[8px] font-bold text-zinc-455 dark:text-zinc-500 uppercase tracking-widest font-mono">
                  Console
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-500 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Body (Scrollable lists) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
            {(hasQrOrdering || hasBilling) && renderMobileNavGroup("Real-Time Operations", operationsGroup)}
            {renderMobileNavGroup("Management Suite", managementGroup)}
            {renderMobileNavGroup("Growth & Billing", growthGroup)}
          </div>

          {/* Drawer Footer */}
          <div className="p-3 border-t border-zinc-100 dark:border-zinc-850 space-y-2">
            <div className="py-2 px-3 flex items-center gap-2 rounded-md bg-zinc-50 dark:bg-zinc-800/50">
              <div className="w-6 h-6 rounded-full shrink-0 overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-650 dark:text-zinc-350">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>{user?.email?.charAt(0).toUpperCase() || "M"}</span>
                )}
              </div>
              {user && (
                <div className="min-w-0 text-[10px] font-medium leading-none">
                  <p className="font-bold text-zinc-700 dark:text-zinc-300 truncate mb-0.5">
                    {user.displayName || "Merchant"}
                  </p>
                  <p className="text-zinc-400 dark:text-zinc-500 truncate">
                    {user.email}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-2 border border-red-200 dark:border-red-950/40 rounded-md text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-955/20 transition-all cursor-pointer"
            >
              <LogOut size={14} className="shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Body Content */}
      <main className="flex-1 w-full overflow-y-auto">
        <Outlet />
      </main>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        shop={shop}
      />

    </div>
  );
}
