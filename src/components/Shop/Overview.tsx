import React, { useRef, useState } from "react";
import {
  Eye,
  MessageSquare,
  Star,
  ShoppingBag,
  QrCode,
  Download,
  Share2,
  Zap,
  History,
  ExternalLink,
  ChevronRight,
  CircleCheckBig,
  Sparkles,
  TrendingUp,
  RefreshCw,
  MapPin,
  Store,
  Check,
  Copy
} from "lucide-react";
import { getWeeklyViewStats, getProfileCompletion } from "../../lib/shopUtils";
import { MAIN_APP_URL, getCustomerAppUrl } from "../../lib/config";
import { slugify } from "../../lib/slugify";
import Dialog from "../UI/Dialog";
import Button from "../UI/Button";

interface OverviewProps {
  shop: any;
  onSelectView: (view: string) => void;
  onShowAlert: (config: { title: string; message: string; type: "success" | "error" | "info" }) => void;
  onShowHistory: () => void;
}

const Overview: React.FC<OverviewProps> = ({
  shop,
  onSelectView,
  onShowAlert,
  onShowHistory
}) => {
  const qrRef = useRef<HTMLDivElement>(null);
  const [downloadingQR, setDownloadingQR] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const catalogCount =
    shop?.menu?.reduce((acc: number, cat: any) => acc + (cat.items?.length || 0), 0) || 0;

  const handleDownloadQR = async () => {
    if (!qrRef.current) return;
    setDownloadingQR(true);
    try {
      const { toPng } = await import("html-to-image");
      await new Promise((r) => setTimeout(r, 500));
      const dataUrl = await toPng(qrRef.current, {
        quality: 1,
        pixelRatio: 4,
        backgroundColor: "#ffffff",
        cacheBust: true,
        style: { visibility: "visible" },
      });
      const link = document.createElement("a");
      link.download = `${shop.name?.replace(/\s+/g, "_")}_QRCode.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("QR Download failed:", err);
      const directUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(
        getCustomerAppUrl("/shop/" + slugify(shop.slug || shop.name))
      )}`;
      window.open(directUrl, "_blank");
    } finally {
      setDownloadingQR(false);
    }
  };

  const handleDownloadDiscoveryQR = () => {
    const directUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(
      getCustomerAppUrl("/shop/" + slugify(shop?.slug || shop?.name || ""))
    )}&color=0A0A0F&bgcolor=FFFFFF`;
    window.open(directUrl, "_blank");
  };

  const handleShareLink = () => {
    const url = getCustomerAppUrl(`/shop/${slugify(shop?.slug || shop?.name)}`);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowAlert({
      title: "Link Copied",
      message: "The shop link has been copied to your clipboard.",
      type: "success",
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-550">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Views", value: shop?.views || 0, icon: Eye },
          {
            label: "WhatsApp Leads",
            value: shop?.leads || 0,
            icon: MessageSquare,
          },
          {
            label: "Avg Rating",
            value: shop?.avgRating || "5.0",
            icon: Star,
          },
          { label: "Catalog Items", value: catalogCount, icon: ShoppingBag },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white p-3.5 rounded-md border border-zinc-200/80 shadow-sm dark:bg-zinc-900 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-7 h-7 rounded-md bg-[#FF6A00]/10 flex items-center justify-center text-[#FF6A00]">
                <stat.icon size={14} />
              </div>
            </div>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-0.5 tracking-tight">
              {stat.value}
            </div>
            <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Performance Chart Card */}
      <div className="w-full bg-white rounded-md border border-zinc-200/80 shadow-sm p-4 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Weekly Views
            </h3>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Last 7 days performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQRModal(true)}
              className="h-8 px-2.5 bg-zinc-50 border border-zinc-200/80 text-zinc-700 dark:bg-zinc-850 dark:border-zinc-750 dark:text-zinc-300 text-xs font-bold rounded-md flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <QrCode size={12} className="text-[#FF6A00]" /> Shop QR
            </button>
            <div className="px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-[9px] font-bold text-zinc-500 uppercase tracking-widest dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
              7 Days
            </div>
          </div>
        </div>
        <div className="h-28 flex items-end gap-1.5 pt-2">
          {(() => {
            const stats = getWeeklyViewStats(shop);
            const maxViews = Math.max(...stats.map((s: any) => s.views), 1);
            return stats.map((s: any, i: number) => {
              const heightPct = Math.max((s.views / maxViews) * 100, 6);
              const isToday = i === stats.length - 1;
              return (
                <div key={i} className="flex-1 relative group flex items-end h-full">
                  <div
                    className={`w-full transition-all rounded-md ${isToday
                      ? "bg-[#FF6A00]"
                      : "bg-[#FF6A00]/20 hover:bg-[#FF6A00]/40 dark:bg-[#FF6A00]/30 dark:hover:bg-[#FF6A00]/50"
                      }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[9px] px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-sm dark:bg-zinc-800 dark:text-zinc-100 border border-transparent dark:border-zinc-700 font-bold">
                    {s.views} view{s.views !== 1 ? "s" : ""}
                  </div>
                </div>
              );
            });
          })()}
        </div>
        <div className="flex justify-between mt-2.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider border-t border-zinc-100 dark:border-zinc-800 pt-1.5">
          {getWeeklyViewStats(shop).map((s: any, i: number) => (
            <span key={i} className={i === 6 ? "text-[#FF6A00]" : ""}>
              {s.day}
            </span>
          ))}
        </div>
      </div>

      {/* Quick Shortcuts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => onSelectView("catalog")}
          className="bg-white p-3.5 rounded-md border border-zinc-200/80 text-left hover:border-[#FF6A00]/40 hover:shadow-sm transition-all group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-[#FF6A00]/50 cursor-pointer"
        >
          <div className="w-8 h-8 bg-[#FF6A00]/10 rounded-md flex items-center justify-center mb-2">
            <ShoppingBag size={14} className="text-[#FF6A00]" />
          </div>
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-0.5">
            Catalog
          </h3>
          <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Items & prices
          </p>
          <div className="mt-1.5 text-[#FF6A00] text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            Manage <ChevronRight size={10} />
          </div>
        </button>

        <button
          onClick={() => onSelectView("gallery")}
          className="bg-white p-3.5 rounded-md border border-zinc-200/80 text-left hover:border-blue-500/40 hover:shadow-sm transition-all group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-blue-500/50 cursor-pointer"
        >
          <div className="w-8 h-8 bg-blue-500/10 rounded-md flex items-center justify-center mb-2">
            <Sparkles size={14} className="text-blue-500" />
          </div>
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-0.5">
            Gallery
          </h3>
          <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Photos & media
          </p>
          <div className="mt-1.5 text-blue-500 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            Upload <ChevronRight size={10} />
          </div>
        </button>

        <button
          onClick={() => onSelectView("hours")}
          className="bg-white p-3.5 rounded-md border border-zinc-200/80 text-left hover:border-emerald-500/40 hover:shadow-sm transition-all group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-emerald-500/50 cursor-pointer"
        >
          <div className="w-8 h-8 bg-emerald-500/10 rounded-md flex items-center justify-center mb-2">
            <TrendingUp size={14} className="text-emerald-500" />
          </div>
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-0.5">
            Hours
          </h3>
          <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Opening schedule
          </p>
          <div className="mt-1.5 text-emerald-500 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            Edit <ChevronRight size={10} />
          </div>
        </button>

        <button
          onClick={() => onSelectView("reviews")}
          className="bg-white p-3.5 rounded-md border border-zinc-200/80 text-left hover:border-amber-500/40 hover:shadow-sm transition-all group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-amber-500/50 cursor-pointer"
        >
          <div className="w-8 h-8 bg-amber-500/10 rounded-md flex items-center justify-center mb-2">
            <Star size={14} className="text-amber-500" />
          </div>
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-0.5">
            Reviews
          </h3>
          <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Customer ratings
          </p>
          <div className="mt-1.5 text-amber-500 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            View <ChevronRight size={10} />
          </div>
        </button>
      </div>

      {/* Onboarding Profile Checklist */}
      {(() => {
        const { score, items } = getProfileCompletion(shop);
        if (score === 100) return null;
        return (
          <div className="bg-white rounded-md border border-zinc-200/80 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <div className="p-3.5 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Complete Your Profile
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                    More complete = higher customer conversion
                  </p>
                </div>
                <span className="text-base font-black text-[#FF6A00]">
                  {score}%
                </span>
              </div>
              <div className="h-1 bg-zinc-100 dark:bg-zinc-850 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FF6A00] to-[#FF9A72] rounded-full transition-all duration-700"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
            <div className="p-2 space-y-0.5">
              {items.map((item: any, i: number) => (
                <button
                  key={i}
                  onClick={() => !item.done && onSelectView(item.tab)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-md text-left transition-all ${item.done
                    ? "opacity-50 cursor-default"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group cursor-pointer"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border transition-all ${item.done
                      ? "bg-[#FF6A00] border-[#FF6A00]"
                      : "border-zinc-300 dark:border-zinc-700 group-hover:border-[#FF6A00]/50"
                      }`}
                  >
                    {item.done && (
                      <CircleCheckBig size={10} className="text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[11px] font-bold ${item.done
                        ? "line-through text-zinc-400 dark:text-zinc-600"
                        : "text-zinc-900 dark:text-zinc-100"
                        }`}
                    >
                      {item.label}
                    </p>
                    {!item.done && (
                      <p className="text-[9.5px] text-zinc-400 dark:text-zinc-500 truncate font-medium">
                        {item.hint}
                      </p>
                    )}
                  </div>
                  {!item.done && (
                    <ChevronRight
                      size={12}
                      className="text-zinc-400 group-hover:text-[#FF6A00] transition-colors shrink-0"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Growth Insight Banner */}
      <div className="bg-gradient-to-r from-[#FF6A00]/10 to-transparent rounded-md p-3.5 border border-[#FF6A00]/20 dark:from-[#FF6A00]/20 dark:to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#FF6A00]/20 rounded-md flex items-center justify-center shrink-0">
            <Zap size={14} className="text-[#FF6A00]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-0.5 tracking-tight">
              Growth Insight
            </h4>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-medium">
              Businesses with complete catalogs see{" "}
              <span className="font-bold text-[#FF6A00]">2.4x higher</span>{" "}
              customer conversion rates.
            </p>
          </div>
        </div>
      </div>

      {/* System Navigation Links */}
      <div className="bg-white rounded-md border border-zinc-200/80 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
        <button
          onClick={() => setShowQRModal(true)}
          className="w-full flex items-center justify-between p-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-xs font-bold text-zinc-650 dark:text-zinc-300 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <QrCode size={12} className="text-[#FF6A00]" />
            <span>Store Discovery QR Poster</span>
          </div>
          <ChevronRight size={12} />
        </button>

        <button
          onClick={onShowHistory}
          className="w-full flex items-center justify-between p-3.5 border-t border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-xs font-bold text-zinc-650 dark:text-zinc-300 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <History size={12} />
            <span>Audit History</span>
          </div>
          <ChevronRight size={12} />
        </button>
        <a
          href={getCustomerAppUrl(`/shop/${slugify(shop?.slug || shop?.name || "")}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between p-3.5 border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-xs font-bold text-zinc-650 dark:text-zinc-300 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ExternalLink size={12} />
            <span>View Live Page</span>
          </div>
          <ChevronRight size={12} />
        </a>
      </div>

      {/* Discovery QR Code Modal */}
      <Dialog
        isOpen={showQRModal}
        onClose={() => !downloadingQR && setShowQRModal(false)}
        title="Store QR Code"
        subtitle="Customers can scan this code to discover and visit your digital shop home page"
        maxWidth="max-w-[380px]"
      >
        <div className="space-y-5 py-2 flex flex-col items-center text-center">
          <div className="p-4 bg-white dark:bg-white rounded-xl border border-zinc-200 shadow-md relative">
            <div className="w-44 h-44 flex items-center justify-center bg-white">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  getCustomerAppUrl("/shop/" + slugify(shop?.slug || shop?.name || ""))
                )}&color=0A0A0F&bgcolor=FFFFFF`}
                alt="Store QR"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#FF6A00] text-white text-[9px] font-black uppercase tracking-widest rounded shadow-md border border-[#FF6A00]/20">
              Discover Shop
            </div>
          </div>

          <div className="w-full space-y-3">
            <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 text-left font-mono">
              <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-505 uppercase tracking-widest block mb-1 font-sans">
                Shop URL
              </span>
              <span className="text-xs font-semibold text-zinc-650 dark:text-zinc-400 truncate block leading-none">
                {getCustomerAppUrl(`/shop/${slugify(shop?.slug || shop?.name || "")}`)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                loading={downloadingQR}
                className="w-full text-xs font-bold gap-1.5 h-10 bg-[#FF6A00] hover:bg-[#e65f00] border-none text-white cursor-pointer"
                onClick={handleDownloadQR}
              >
                <Download size={13} />
                <span>Download Shop Poster</span>
              </Button>
              
              <div className="flex gap-2">
                <Button
                  variant="dark"
                  size="sm"
                  className="flex-1 text-xs font-bold gap-1.5 h-9"
                  onClick={handleDownloadDiscoveryQR}
                >
                  <QrCode size={13} />
                  <span>QR Code Only</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs font-bold gap-1.5 h-9 border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-800 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  onClick={handleShareLink}
                >
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  <span>{copied ? "Copied" : "Copy Link"}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Hidden Printable QR Card (for html-to-image rendering) */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none">
        <div
          ref={qrRef}
          className="w-[400px] bg-white rounded-[32px] p-8 flex flex-col items-center text-center border shadow-sm"
        >
          <div className="w-20 h-20 bg-[#FF6A00]/10 rounded-md flex items-center justify-center mb-5 overflow-hidden shadow-inner">
            {shop?.logo ? (
              <img
                src={`https://images.weserv.nl/?url=${encodeURIComponent(
                  shop.logo
                )}&output=png&t=${Date.now()}`}
                alt="Shop Logo"
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <Store size={32} className="text-[#FF6A00]" />
            )}
          </div>

          <h2 className="text-2xl font-black text-zinc-900 mb-1 tracking-tight">
            {shop?.name}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-zinc-550 tracking-widest mb-6 font-bold">
            <MapPin size={14} className="text-[#FF6A00]" />
            {[shop?.zone, shop?.area, shop?.city].filter(Boolean).join(", ")}
          </div>

          <div className="p-6 bg-white border-4 border-zinc-900 rounded-[40px] mb-6 shadow-sm">
            <img
              src={`https://images.weserv.nl/?url=${encodeURIComponent(
                `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
                  getCustomerAppUrl("/shop/" + slugify(shop?.slug || shop?.name || ""))
                )}`
              )}&output=png`}
              alt="QR Code"
              className="w-44 h-44 object-contain"
              crossOrigin="anonymous"
              onError={(e: any) => {
                e.target.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
                  getCustomerAppUrl("/shop/" + slugify(shop?.slug || shop?.name || ""))
                )}`;
              }}
            />
          </div>

          <p className="text-base font-black text-zinc-900 uppercase tracking-wider mb-1">
            Scan to explore
          </p>
          <p className="text-[11px] text-zinc-400 font-bold tracking-wide">
            Powered by ShopBajar
          </p>
        </div>
      </div>
    </div>
  );
};

export default Overview;
