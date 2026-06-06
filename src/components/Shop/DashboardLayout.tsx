import React, { useState, useEffect } from "react";
import { Link, useLocation, useSearchParams, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useShopOwner } from "../../hooks/useShopOwner";
import {
  Store,
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
  ChevronLeft,
  ChevronRight,
  Menu as MenuIcon,
  X,
  LogOut,
  ArrowLeft,
  Loader2,
  CircleAlert
} from "lucide-react";
import Button from "../UI/Button";

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

  // Sidebar states
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved === "true";
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Sync collapse state with localStorage
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(isCollapsed));
  }, [isCollapsed]);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-955 flex items-center justify-center">
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
          <div className="w-12 h-12 bg-red-100 dark:bg-red-950/30 rounded-md flex items-center justify-center mx-auto text-red-500">
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
  ];

  const growthGroup = [
    ...(hasBilling ? [{
      id: "billing",
      label: "Billing & POS",
      icon: Calculator,
      path: `/manage?id=${shopId}&view=billing`,
    }] : []),
    ...(hasInquiries ? [{
      id: "inquiries",
      label: "Customer Inquiries",
      icon: MessageSquare,
      path: `/manage?id=${shopId}&view=inquiries`,
    }] : []),
    {
      id: "features",
      label: "Paid Features",
      icon: Sparkles,
      path: `/manage?id=${shopId}&view=features`,
    },
  ];

  // Helper to check if a navigation item is active
  const isItemActive = (item: { id: string; path: string }) => {
    if (location.pathname === "/manage") {
      const currentView = searchParams.get("view") || "overview";
      return item.id === currentView;
    }
    // Check if location matches standard route (e.g. /tables matches /tables)
    const itemPathname = item.path.split("?")[0];
    return location.pathname === itemPathname;
  };

  const renderNavGroup = (title: string, items: typeof operationsGroup) => {
    return (
      <div className="space-y-0.5">
        {!isCollapsed ? (
          <h3 className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-3 mb-1 font-mono">
            {title}
          </h3>
        ) : (
          <div className="mx-2 my-1 border-t border-zinc-100 dark:border-zinc-800" />
        )}
        {items.map((item) => {
          const active = isItemActive(item);
          return (
            <Link
              key={item.id}
              to={item.path}
              title={item.label}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group text-xs font-bold ${
                isCollapsed ? "justify-center px-0" : ""
              } ${
                active
                  ? "bg-[#FF6A00] text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60"
              }`}
            >
              <item.icon size={16} className={`shrink-0 ${active ? "" : "text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100"}`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-zinc-200/80 dark:border-zinc-800 transition-all duration-300">
      {/* Header */}
      <div className="h-14 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded bg-[#FF6A00] flex items-center justify-center text-white shrink-0 font-bold shadow-md">
            {shop.logo ? (
              <img src={shop.logo} alt="" className="w-full h-full object-cover rounded" />
            ) : (
              shop.name.charAt(0).toUpperCase()
            )}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 leading-none">
              <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate tracking-tight mb-0.5 font-sans">
                {shop.name}
              </h2>
              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-mono">
                Console
              </span>
            </div>
          )}
        </div>
        <Link
          to="/dashboard"
          className="p-1.5 text-zinc-400 hover:text-[#FF6A00] hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
          title="Back to All Businesses"
        >
          <ArrowLeft size={14} />
        </Link>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6 scrollbar-thin">
        {hasQrOrdering && renderNavGroup("Real-Time Operations", operationsGroup)}
        {renderNavGroup("Management Suite", managementGroup)}
        {renderNavGroup("Growth & Billing", growthGroup)}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
        <div className={`py-1.5 mb-1 flex items-center gap-2 rounded-md bg-zinc-50 dark:bg-zinc-800/50 ${
          isCollapsed ? "justify-center px-1" : "px-2"
        }`}>
          <div className="w-6 h-6 rounded-full shrink-0 overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span>{user?.email?.charAt(0).toUpperCase() || "M"}</span>
            )}
          </div>
          {!isCollapsed && user && (
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
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer ${
            isCollapsed ? "justify-center" : ""
          }`}
          title="Sign Out"
        >
          <LogOut size={16} className="shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>

        {/* Collapser button on desktop */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex w-full items-center justify-center py-1.5 text-zinc-400 hover:text-zinc-650 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded transition-all cursor-pointer mt-1"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-955 flex text-zinc-900 dark:text-zinc-150">
      {/* Sidebar - Desktop */}
      <aside
        className={`hidden md:block shrink-0 transition-all duration-300 sticky top-0 h-screen ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - Mobile Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 md:hidden transition-transform duration-300 transform bg-white dark:bg-zinc-900 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="absolute top-4 right-4 z-50 md:hidden">
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-500"
          >
            <X size={16} />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header Bar */}
        <header className="h-14 bg-white dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800 md:hidden flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 dark:text-zinc-400 cursor-pointer"
            >
              <MenuIcon size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-0.5">
                {shop.name}
              </p>
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-44 leading-none">
                {VIEW_LABELS[searchParams.get("view") || location.pathname.replace("/", "")] || "Dashboard"}
              </p>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="text-[10px] font-bold uppercase tracking-widest text-[#FF6A00] bg-[#FF6A00]/5 px-2.5 py-1 rounded border border-[#FF6A00]/15"
          >
            ← All Shops
          </Link>
        </header>

        {/* Content View Workspace */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
