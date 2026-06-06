import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getShopsByOwner } from "../lib/db";
import { Link, useNavigate } from "react-router-dom";
import Card from "../components/UI/Card";
import Button from "../components/UI/Button";
import HistoryDialog from "../components/Shop/HistoryDialog";
import { MAIN_APP_URL } from "../lib/config";
import { slugify } from "../lib/slugify";
import {
  Store,
  Clock,
  Eye,
  TrendingUp,
  Search,
  Plus,
  History,
  ExternalLink,
  Settings,
  LogOut,
  MapPin,
  CircleAlert,
  LayoutDashboard,
  ArrowRight
} from "lucide-react";

export default function MerchantDashboard() {
  const { user, loading: authLoading, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();

  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [historyShop, setHistoryShop] = useState<any | null>(null);

  useEffect(() => {
    document.title = "My Businesses — ShopBajar Console";
  }, []);

  useEffect(() => {
    if (user) {
      const fetchMyShops = async () => {
        setLoading(true);
        const data = await getShopsByOwner(user.uid);
        setShops(data);
        setLoading(false);
      };
      fetchMyShops();
    }
  }, [user]);

  // If there is exactly one shop and it is approved, auto-select it!
  useEffect(() => {
    if (!loading && shops.length === 1 && shops[0].status === "approved") {
      // Auto-redirect to configure panel for this shop
      navigate(`/manage?id=${shops[0].id}`, { replace: true });
    }
  }, [loading, shops, navigate]);

  const totalViews = shops.reduce((acc, shop) => acc + (shop.views || 0), 0);
  const totalLeads = shops.reduce((acc, shop) => acc + (shop.leads || 0), 0);
  const approvedShops = shops.filter((s) => s.status === "approved").length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Authenticating Console</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-12 text-center shadow-2xl bg-white dark:bg-zinc-900 border border-black/[0.05] dark:border-zinc-800">
          <div className="w-16 h-16 bg-[#FF6A00]/10 rounded-md flex items-center justify-center mx-auto mb-8 border border-[#FF6A00]/25">
            <Store size={32} className="text-[#FF6A00]" />
          </div>
          <h1 className="text-[28px] font-bold text-zinc-900 dark:text-zinc-100 mb-3 tracking-tight">
            Sign in to manage
          </h1>
          <p className="text-[14px] text-zinc-500 dark:text-zinc-400 mb-10 max-w-sm mx-auto font-medium">
            Access your merchant console and real-time performance analytics.
          </p>
          <Button
            onClick={loginWithGoogle}
            variant="dark"
            size="xl"
            icon={ArrowRight}
            className="w-full h-11"
          >
            Sign In with Google
          </Button>
        </Card>
      </div>
    );
  }

  const filteredShops = shops.filter(
    (shop) =>
      !searchQuery ||
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );



  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto flex flex-col h-full">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF6A00] rounded-md flex items-center justify-center text-white shrink-0 shadow-lg">
              <Store size={22} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#FF6A00]/5 dark:bg-[#FF6A00]/10 text-[#FF6A00] rounded border border-[#FF6A00]/15 mb-0.5">
                <LayoutDashboard size={10} />
                <span className="text-[9px] font-bold uppercase tracking-widest font-mono">Merchant Center</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Active Businesses</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link to="/create" className="flex-1 sm:flex-initial">
              <Button variant="dark" icon={Plus} size="sm" className="w-full h-9 text-xs">
                Deploy New Business
              </Button>
            </Link>
          </div>
        </header>

        {/* Stats High-Density */}
        {shops.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Active Businesses", value: approvedShops, icon: Store },
              { label: "Pending Approval", value: shops.length - approvedShops, icon: Clock },
              { label: "Gross Views", value: totalViews.toLocaleString(), icon: Eye },
              { label: "Network Leads", value: totalLeads.toLocaleString(), icon: TrendingUp },
            ].map((stat, i) => (
              <Card key={i} padding={false} className="p-3.5 border-black/[0.03] dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-6 h-6 rounded bg-[#FF6A00]/5 dark:bg-[#FF6A00]/10 flex items-center justify-center text-[#FF6A00]">
                    <stat.icon size={12} />
                  </div>
                  <div className="text-[8.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{stat.label}</div>
                </div>
                <div className="text-[20px] font-bold text-zinc-900 dark:text-zinc-100 leading-none">{stat.value}</div>
              </Card>
            ))}
          </div>
        )}

        {/* Search Toolbar */}
        <div className="mb-6 relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 group-focus-within:text-[#FF6A00] transition-colors" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter businesses by name, category or city..."
            className="w-full h-10 pl-10 pr-4 bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-zinc-800 rounded-md focus:outline-none focus:border-[#FF6A00]/40 focus:ring-1 focus:ring-[#FF6A00]/10 text-xs font-medium text-zinc-900 dark:text-zinc-100 transition-all shadow-sm"
          />
        </div>

        {/* Business Listings */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white dark:bg-zinc-900 rounded-md animate-pulse border border-black/[0.05] dark:border-zinc-800 shadow-sm" />
            ))}
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-md border border-dashed border-black/[0.1] dark:border-zinc-800 shadow-sm">
            <div className="w-14 h-14 bg-[#FF6A00]/5 dark:bg-[#FF6A00]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Store size={24} className="text-[#FF6A00]" />
            </div>
            <h3 className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              {searchQuery ? "No matching businesses" : "No businesses yet"}
            </h3>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium mb-5">
              {searchQuery
                ? "Try refining your search parameters."
                : "Get started by deploying your first business profile."}
            </p>
            {!searchQuery && (
              <Link to="/create">
                <Button variant="dark" icon={Plus} size="sm" className="h-9 text-xs">
                  Deploy First Business
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredShops.map((shop) => (
              <Card key={shop.id} padding={false} className="p-4 bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:border-[#FF6A00]/40 dark:hover:border-[#FF6A00]/50 transition-all duration-300">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                  <div className="w-12 h-12 rounded-md bg-black/[0.02] dark:bg-zinc-800 border border-black/[0.05] dark:border-zinc-700 overflow-hidden relative shrink-0">
                    {shop.logo ? (
                      <img src={shop.logo.includes(" ") ? shop.logo.replace(/\s/g, "%20") : shop.logo} alt="logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#FF6A00] font-bold text-lg">{shop.name.charAt(0)}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{shop.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${shop.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' :
                        shop.status === 'rejected' ? 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:bg-amber-550/20 dark:text-amber-400'
                        }`}>
                        {shop.status === 'approved' ? 'Operational' : shop.status === 'rejected' ? 'Rejected' : 'Provisioning'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                      <span className="flex items-center gap-1"><Store size={11} className="text-[#FF6A00]" /> {shop.category}</span>
                      <span className="flex items-center gap-1"><MapPin size={11} /> {shop.city}</span>
                      <span className="flex items-center gap-1"><TrendingUp size={11} /> {shop.views || 0} views</span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={History}
                      className="h-9 w-9 p-0 shrink-0 border border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900 cursor-pointer"
                      title="Audit History"
                      onClick={() => setHistoryShop(shop)}
                    />
                    <a
                      href={`${MAIN_APP_URL}/shop/${slugify(shop.slug || shop.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 md:flex-none"
                    >
                      <Button variant="outline" size="sm" icon={ExternalLink} className="w-full h-9 text-[11px] border border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900 cursor-pointer">
                        View Page
                      </Button>
                    </a>
                    <Link to={`/manage?id=${shop.id}`} className="flex-1 md:flex-none">
                      <Button variant="dark" size="sm" icon={Settings} className="w-full h-9 text-[11px]">
                        Configure
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <HistoryDialog shop={historyShop} isOpen={!!historyShop} onClose={() => setHistoryShop(null)} />
    </div>
  );
}
