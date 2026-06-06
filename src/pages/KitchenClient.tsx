import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { useShopOwner } from "@/hooks/useShopOwner";
import { MAIN_APP_URL } from "@/lib/config";
import {
  listenAllOrders,
  listenSessions,
  updateOrderStatus,
  updateOrderItemStatus,
  updateSessionStatus,
  closeSession,
  approveSession,
} from "@/lib/rtdb";
import Card from "@/components/UI/Card";
import Button from "@/components/UI/Button";
import Dialog from "@/components/UI/Dialog";
import {
  ChefHat, ArrowLeft, Bell, BellOff, Check, Clock,
  Loader2, Table2, ShoppingBag, CircleAlert, QrCode,
  CheckCircle2, UtensilsCrossed, X, Store, ArrowRight, Calculator
} from "lucide-react";

// ── Order Status Config ───────────────────────────────────────────
const STATUS_CONFIG = {
  placed: { label: "New Order", color: "bg-[#FF6A00] text-white", next: "confirmed", nextLabel: "Confirm" },
  confirmed: { label: "Confirmed", color: "bg-blue-500 text-white", next: "preparing", nextLabel: "Start Preparing" },
  preparing: { label: "Preparing", color: "bg-amber-500 text-white", next: "ready", nextLabel: "Mark Ready" },
  ready: { label: "Ready!", color: "bg-emerald-500 text-white", next: "served", nextLabel: "Mark Served" },
  served: { label: "Served", color: "bg-indigo-500 text-white", next: null, nextLabel: null },
};

// ── Notification Helper ───────────────────────────────────────────
function sendNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/sb-logo.png",
      badge: "/sb-logo.png",
    });
  }
}

export default function KitchenClient() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { shop, loading: shopLoading, error } = useShopOwner();
  const isPortal = window.location.pathname.startsWith("/portal");

  const [orders, setOrders] = useState<any[]>([]);          // all orders, flat list
  const [sessions, setSessions] = useState<any[]>([]);       // all sessions
  const [notifEnabled, setNotifEnabled] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const prevOrderIds = useRef<Set<string>>(new Set());
  const prevPendingIds = useRef<Set<string>>(new Set());

  const [activeItemMenu, setActiveItemMenu] = useState<any>(null); // { orderId, itemIndex }
  const [updatingItem, setUpdatingItem] = useState<any>(null); // { orderId, itemIndex }
  const [confirmAction, setConfirmAction] = useState<any>(null); // { message, onConfirm }

  const handleUpdateItemStatus = async (order: any, itemIndex: number, newStatus: string) => {
    if (!shop?.id) return;
    setUpdatingItem({ orderId: order.id, itemIndex });
    try {
      await updateOrderItemStatus(shop.id, order.sessionId, order.id, itemIndex, newStatus as any);
    } catch (err) {
      console.error("Failed to update item status:", err);
    } finally {
      setUpdatingItem(null);
    }
  };

  const getSessionCode = (sessionId) => {
    if (!sessionId) return "";
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      hash += sessionId.charCodeAt(i);
    }
    return ((hash % 90) + 10).toString();
  };

  const getGuestNames = (session) => {
    const code = getSessionCode(session.id || session.sessionId);
    const codeSuffix = code ? ` [#${code}]` : "";
    if (session.guests && Object.keys(session.guests).length > 0) {
      return Object.values(session.guests).map((g: any) => g.name).join(", ") + codeSuffix;
    }
    return (session.customerName || "Guest") + codeSuffix;
  };

  const getGuestPhones = (session) => {
    if (session.guests && Object.keys(session.guests).length > 0) {
      return Object.values(session.guests).map((g: any) => g.phone).filter(Boolean).join(", ");
    }
    return session.customerPhone || "";
  };

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Notification.permission === "granted") {
      setNotifEnabled(true);
    }
  }, []);

  const requestNotifications = async () => {
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === "granted");
  };

  // Listen to all orders
  useEffect(() => {
    if (!shop?.id) return;
    const unsub = listenAllOrders(shop.id, (incoming) => {
      // Fire notification for new orders
      const newIds = new Set(incoming.map((o) => o.id));
      incoming.forEach((order) => {
        if (!prevOrderIds.current.has(order.id) && order.status === "placed") {
          sendNotification(
            `New Order — ${order.tableName}`,
            order.items.map((i) => `${i.qty}x ${i.name}`).join(", ")
          );
        }
      });
      prevOrderIds.current = newIds;
      setOrders(incoming);
    });
    return unsub;
  }, [shop?.id]);

  // Listen to all sessions (for pending approval)
  useEffect(() => {
    if (!shop?.id) return;
    const unsub = listenSessions(shop.id, (incoming) => {
      const pending = incoming.filter((s) => s.status === "pending");
      pending.forEach((s) => {
        if (!prevPendingIds.current.has(s.id)) {
          sendNotification(
            "Table Waiting Approval",
            `${s.tableName} is waiting for waiter approval`
          );
        }
      });
      prevPendingIds.current = new Set(pending.map((s) => s.id));
      setSessions(incoming);
    });
    return unsub;
  }, [shop?.id]);

  const handleNextStatus = (order) => {
    const cfg = STATUS_CONFIG[order.status];
    if (!cfg?.next || !shop?.id) return;
    const badgeColors = {
      placed: "bg-orange-100 text-orange-600 border border-orange-200",
      confirmed: "bg-blue-100 text-blue-650 border border-blue-200",
      preparing: "bg-amber-100 text-amber-650 border border-amber-200",
      ready: "bg-emerald-100 text-emerald-650 border border-emerald-200",
      served: "bg-indigo-100 text-indigo-650 border border-indigo-200",
      done: "bg-zinc-100 text-zinc-600 border border-zinc-200"
    };
    const tableSession = activeSessions.find(s => s.id === order.sessionId);
    const guestNames = tableSession ? getGuestNames(tableSession) : "Guest";
    setConfirmAction({
      title: "Update Order Status",
      message: "Are you sure you want to progress this order's status?",
      details: {
        summary: true,
        badge: cfg.nextLabel,
        badgeColor: badgeColors[cfg.next] || "bg-zinc-100 text-zinc-650",
        table: order.tableName,
        customer: guestNames,
        items: order.items || []
      },
      onConfirm: async () => {
        setUpdatingId(order.id);
        await updateOrderStatus(shop.id, order.sessionId, order.id, cfg.next);
        setUpdatingId(null);
      }
    });
  };


  // Filter active orders based on whether their session is still active or pending
  const activeOrders = orders.filter((o) => {
    const session = sessions.find((s) => s.id === o.sessionId);
    return session && (session.status === "active" || session.status === "pending");
  });
  const pendingSessions = sessions.filter((s) => s.status === "pending");
  const activeSessions = sessions.filter((s) => s.status === "active");
  const doneOrders = activeOrders.filter((o) => o.status === "served");

  // Group active orders by sessionId
  const ordersBySession = activeOrders.reduce((acc, order) => {
    const key = order.sessionId;
    if (!acc[key]) acc[key] = { tableName: order.tableName, tableId: order.tableId, sessionId: key, orders: [] };
    acc[key].orders.push(order);
    return acc;
  }, {});

  if (shopLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#FF6A00]" />
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-955 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 py-16 text-center bg-white dark:bg-zinc-900 border border-black/[0.05] dark:border-zinc-800 rounded-md shadow-lg">
          <Store size={40} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
          <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">{error || "No shop found."}</p>
          {!isPortal && (
            <Button variant="dark" className="mt-6" onClick={() => window.location.href = `${MAIN_APP_URL}/dashboard`}>Go to Dashboard</Button>
          )}
        </div>
      </div>
    );
  }

  // Check paid feature gate
  const hasQrOrdering = !!shop?.paidFeatures?.qr_ordering?.enabled;
  const hasBilling = !!shop?.paidFeatures?.billing_system?.enabled ||
                     !!shop?.paidFeatures?.invoice_tools?.enabled ||
                     !!shop?.paidFeatures?.pos_slip_tools?.enabled;

  if (!hasQrOrdering) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] py-12 flex items-center justify-center">
        <div className="max-w-xl mx-auto px-4">
          <Card className="p-6 bg-white border border-black/[0.06] rounded-md shadow-lg relative overflow-hidden">
            {/* Orange gradient accent glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6A00]/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

            <div className="flex flex-col items-center text-center space-y-4 relative z-10">
              <div className="w-12 h-12 rounded-md bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#FF6A00] shadow-2xs">
                <ChefHat size={22} />
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 rounded border border-black/[0.04] text-[9px] font-black uppercase tracking-wider text-[#FF6A00]">
                  SaaS Add-on Feature
                </div>
                <h2 className="text-base font-bold text-[#0A0A0F] tracking-tight">Live Kitchen Dashboard</h2>
                <p className="text-[12px] text-[#0A0A0F]/55 max-w-sm font-medium leading-relaxed">
                  Unlock real-time kitchen ticket management, waiter approvals, and status tracking for your restaurant.
                </p>
              </div>

              {/* Value Propositions */}
              <div className="w-full grid grid-cols-1 gap-2 pt-2 text-left">
                <div className="p-3 bg-zinc-50 border border-black/[0.04] rounded-md flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                    <Check size={12} className="stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-[#0A0A0F]">Real-time Kitchen Tickets</h4>
                    <p className="text-[10px] text-[#0A0A0F]/40 font-medium">Instantly receive and process table orders placed by customers.</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 border border-black/[0.04] rounded-md flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                    <Check size={12} className="stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-[#0A0A0F]">Waiter Verification Panels</h4>
                    <p className="text-[10px] text-[#0A0A0F]/40 font-medium">Approve scanning sessions dynamically before allowing menu ordering.</p>
                  </div>
                </div>
              </div>

              <div className="w-full pt-4 border-t border-black/[0.06] flex items-center justify-end gap-2.5">
                <Button
                  variant="ghost"
                  className="text-xs h-9 font-bold"
                  onClick={() => window.location.href = `${MAIN_APP_URL}/dashboard`}
                >
                  Back to Dashboard
                </Button>
                <Button
                  variant="dark"
                  icon={ArrowRight}
                  className="text-xs h-9 shadow-sm font-bold"
                  onClick={() => window.location.href = `${MAIN_APP_URL}/dashboard/manage?id=${shop.id}&view=features`}
                >
                  Upgrade & Activate Add-on
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-955 text-zinc-900 dark:text-zinc-150 transition-colors duration-200">
      <div className="w-full px-4 md:px-6 py-6 max-w-7xl mx-auto">

        {/* Unified High-Density Header Row (Sticky and Glassmorphic on mobile) */}
        <div className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-black/[0.05] dark:border-zinc-800 p-3.5 flex items-center justify-between -mx-4 sm:mx-0 sm:rounded-md sm:border sm:mb-6 mb-4 shadow-2xs transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <Link to={`${isPortal ? "/portal" : ""}/tables?shopId=${shop.id}`} className="w-8 h-8 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-[#0A0A0F]/40 dark:text-zinc-400 hover:text-[#0A0A0F] dark:hover:text-zinc-150 transition-colors shadow-sm shrink-0">
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-[16px] font-bold text-[#0A0A0F] dark:text-zinc-100 tracking-tight leading-none truncate">Kitchen Live</h1>
                {activeOrders.length > 0 && (
                  <span className="text-[9px] sm:text-[10px] font-black bg-[#FF6A00] text-white px-2 py-0.5 rounded-full animate-pulse shrink-0">
                    {activeOrders.length} active
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-[#0A0A0F]/40 dark:text-zinc-400 font-medium mt-1 truncate">{shop.name}</p>
            </div>
          </div>

          {/* Right actions: Notification toggle & Waiter Link */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Copy Staff Portal Link Button (Only for Owner) */}
            {!isPortal && (
              <button
                type="button"
                onClick={() => {
                  const staffUrl = `${window.location.origin}/portal/kitchen?shopId=${shop.id}`;
                  navigator.clipboard.writeText(staffUrl);
                  alert("Copied Staff Kitchen Link to clipboard!\nShare this with your staff. PIN: " + (shop.staffPin || "1234"));
                }}
                className="h-8 px-2.5 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
              >
                <ShoppingBag size={12} className="text-zinc-400" />
                <span className="hidden md:inline">Share Staff URL</span>
              </button>
            )}

            <button
              onClick={notifEnabled ? undefined : requestNotifications}
              className={`h-8 px-2.5 sm:px-3 rounded-md border text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 ${notifEnabled
                ? "border-emerald-250 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400"
                : "border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[#0A0A0F]/50 dark:text-zinc-400 hover:text-[#0A0A0F] dark:hover:text-zinc-150 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                }`}
            >
              {notifEnabled ? <Bell size={11} /> : <BellOff size={11} />}
              <span className="hidden xs:inline">{notifEnabled ? "On" : "Alerts"}</span>
            </button>

            <Link
              to={`${isPortal ? "/portal" : ""}/waiter?shopId=${shop.id}`}
              className="h-8 px-2.5 sm:px-3 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-[#0A0A0F]/60 dark:text-zinc-300 hover:text-[#0A0A0F] dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Bell size={11} className="text-[#FF6A00]" />
              <span className="hidden xs:inline">Waiter</span>
            </Link>

            {hasBilling && (
              <Link
                to={`${isPortal ? "/portal" : ""}/billing?shopId=${shop.id}`}
                className="h-8 px-2.5 sm:px-3 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-[#0A0A0F]/60 dark:text-zinc-300 hover:text-[#0A0A0F] dark:hover:text-zinc-105 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0"
                title="Billing & POS Console"
              >
                <Calculator size={11} className="text-[#FF6A00]" />
                <span className="hidden xs:inline">Billing</span>
              </Link>
            )}
          </div>
        </div>

        {/* Active Orders by Session */}
        {Object.keys(ordersBySession).length === 0 ? (
          <div className="py-24 text-center bg-white dark:bg-zinc-900 rounded-md border border-dashed border-black/[0.1] dark:border-zinc-800">
            <UtensilsCrossed size={40} className="mx-auto text-[#0A0A0F]/10 dark:text-zinc-700 mb-4" />
            <h3 className="text-[15px] font-bold text-[#0A0A0F] dark:text-zinc-200 mb-1">No active orders</h3>
            <p className="text-[13px] text-[#0A0A0F]/40 dark:text-zinc-500 font-medium">Orders will appear here when customers scan their table QR and place orders.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.values(ordersBySession).map(({ tableName, tableId, sessionId, orders: sessionOrders }) => {
              const tableSession = activeSessions.find((s) => s.id === sessionId);
              return (
                <div key={sessionId} className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <Table2 size={13} className="text-[#0A0A0F]/40 dark:text-zinc-550 shrink-0" />
                      <span className="text-[13px] font-extrabold text-[#0A0A0F] dark:text-zinc-200 truncate">
                        {tableName} {tableSession ? `· ${getGuestNames(tableSession)}` : ""}
                      </span>
                      {tableSession && getGuestPhones(tableSession) && (
                        <span className="text-[10.5px] text-zinc-500 dark:text-zinc-450 font-medium hidden xs:inline">
                          (📞 {getGuestPhones(tableSession)})
                        </span>
                      )}
                      <span className="text-[9.5px] font-bold text-[#0A0A0F]/30 dark:text-zinc-500 uppercase tracking-widest shrink-0">
                        {sessionOrders.length} ticket{sessionOrders.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                     {sessionOrders
                       .sort((a, b) => a.placedAt - b.placedAt)
                       .map((order) => {
                         const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.placed;
                         const isUpdating = updatingId === order.id;
                         const minutesAgo = Math.floor((Date.now() - order.placedAt) / 60000);
                         return (
                           <div key={order.id} className="bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-zinc-800 rounded-md relative transition-all duration-300 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                             {/* Status bar */}
                             <div className={`px-3 py-2.5 flex items-center justify-between ${cfg.color} rounded-t-[5px]`}>
                               <span className="text-[11px] font-black uppercase tracking-wider">{cfg.label}</span>
                               <span className="text-[10px] font-medium opacity-80 flex items-center gap-1">
                                 <Clock size={10} /> {minutesAgo === 0 ? "Just now" : `${minutesAgo}m ago`}
                               </span>
                             </div>
                             <div className="p-3.5 space-y-3">
                               {/* Items list */}
                               <div className="space-y-1.5">
                                 {order.items.map((item, i) => {
                                   const itemStatus = item.status || "placed";
                                   const isMenuOpen = activeItemMenu?.orderId === order.id && activeItemMenu?.itemIndex === i;
                                   const isItemUpdating = updatingItem?.orderId === order.id && updatingItem?.itemIndex === i;
                                   const isCancelled = itemStatus === "cancelled";
                                   const isReady = itemStatus === "ready";
                                   const isServed = itemStatus === "served";

                                   return (
                                     <div key={i} className="relative flex items-center justify-between gap-2.5 py-1.5 px-1.5 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                                       <div className="flex items-center gap-2.5 min-w-0">
                                         {/* Status Toggle Button (Large thumb target on mobile) */}
                                         <button
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             setActiveItemMenu(isMenuOpen ? null : { orderId: order.id, itemIndex: i });
                                           }}
                                           disabled={isItemUpdating}
                                           className={`w-7 h-7 sm:w-5.5 sm:h-5.5 rounded-md flex items-center justify-center border transition-all shrink-0 hover:scale-105 active:scale-95 cursor-pointer ${isItemUpdating
                                               ? "bg-zinc-55 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"
                                               : itemStatus === "placed"
                                                 ? "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:border-zinc-400"
                                                 : itemStatus === "preparing"
                                                   ? "border-amber-250 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 hover:bg-amber-100"
                                                   : itemStatus === "ready"
                                                     ? "border-emerald-250 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100"
                                                     : itemStatus === "served"
                                                       ? "border-indigo-250 bg-indigo-50 dark:bg-indigo-955/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100"
                                                       : "border-rose-250 bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-455 hover:bg-rose-100"
                                             }`}
                                           title={`Change item status (Current: ${itemStatus})`}
                                         >
                                           {isItemUpdating ? (
                                             <Loader2 size={11} className="animate-spin text-zinc-450" />
                                           ) : itemStatus === "placed" ? (
                                             <Clock size={10} />
                                           ) : itemStatus === "preparing" ? (
                                             <ChefHat size={11} className="animate-pulse" />
                                           ) : itemStatus === "ready" ? (
                                             <Check size={11} className="stroke-[3]" />
                                           ) : itemStatus === "served" ? (
                                             <CheckCircle2 size={10} />
                                           ) : (
                                             <X size={11} />
                                           )}
                                         </button>

                                         <span className={`text-[12.5px] font-semibold text-[#0A0A0F] dark:text-zinc-200 truncate ${isCancelled ? "line-through text-zinc-400 dark:text-zinc-600 font-medium" :
                                             isReady ? "text-emerald-700 dark:text-emerald-400 font-extrabold" :
                                               isServed ? "text-indigo-700 dark:text-indigo-400 opacity-60" : ""
                                           }`}>
                                           <span className={`font-black ${isCancelled ? "text-zinc-400 dark:text-zinc-655" : "text-[#FF6A00]"}`}>{item.qty}×</span> {item.name}
                                         </span>
                                       </div>

                                       {/* Right side: Price */}
                                       {item.price && (
                                         <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-550 shrink-0">
                                           ₹{item.price * item.qty}
                                         </span>
                                       )}

                                      {/* Dropdown Menu */}
                                      {isMenuOpen && (
                                        <>
                                          <div
                                            className="fixed inset-0 z-40 cursor-default"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveItemMenu(null);
                                            }}
                                          />
                                          <div
                                            className="absolute left-0 top-8 z-50 min-w-[145px] bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-zinc-800 rounded-md shadow-xl py-1 text-left animate-in fade-in slide-in-from-top-1 duration-150"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <p className="px-3 py-1 text-[9px] font-bold text-zinc-400 dark:text-zinc-555 uppercase tracking-widest border-b border-black/[0.04] dark:border-zinc-800 mb-1">
                                              Set Item Status
                                            </p>
                                            {[
                                              { value: "placed", label: "New/Placed", icon: Clock, color: "text-zinc-655 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800" },
                                              { value: "preparing", label: "Preparing", icon: ChefHat, color: "text-amber-600 dark:text-amber-450 hover:bg-amber-50/50 dark:hover:bg-amber-955/20" },
                                              { value: "ready", label: "Ready", icon: Check, color: "text-emerald-600 dark:text-emerald-455 hover:bg-emerald-50/50 dark:hover:bg-emerald-955/20" },
                                              { value: "served", label: "Served", icon: CheckCircle2, color: "text-indigo-600 dark:text-indigo-455 hover:bg-indigo-50/50 dark:hover:bg-indigo-955/20" },
                                              { value: "cancelled", label: "Cancelled", icon: X, color: "text-rose-600 dark:text-rose-455 hover:bg-rose-50/50 dark:hover:bg-rose-955/20" }
                                            ].map((opt) => {
                                              const Icon = opt.icon;
                                              const isSelected = itemStatus === opt.value;
                                              return (
                                                <button
                                                  key={opt.value}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleUpdateItemStatus(order, i, opt.value);
                                                    setActiveItemMenu(null);
                                                  }}
                                                  className={`w-full px-3 py-2.5 sm:px-2.5 sm:py-1.5 text-[11.5px] font-bold flex items-center gap-2 transition-colors cursor-pointer ${opt.color} ${isSelected ? "bg-zinc-50 dark:bg-zinc-800" : ""
                                                    }`}
                                                >
                                                  <Icon size={12} className={isSelected ? "stroke-[3]" : ""} />
                                                  <span className="flex-1 text-left">{opt.label}</span>
                                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Note */}
                              {order.note && (
                                <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5 font-medium">
                                  📝 {order.note}
                                </p>
                              )}

                              {/* Action button (large target on mobile) */}
                              {cfg.next && (
                                <button
                                  onClick={() => handleNextStatus(order)}
                                  disabled={isUpdating}
                                  className="w-full h-10 sm:h-8 rounded-md bg-[#0A0A0F] dark:bg-zinc-100 hover:bg-[#0A0A0F]/80 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                                >
                                  {isUpdating ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <><Check size={12} className="stroke-[2.5]" /> {cfg.nextLabel}</>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Done orders count */}
        {doneOrders.length > 0 && (
          <p className="text-center text-[11px] text-[#0A0A0F]/25 dark:text-zinc-600 font-medium mt-8">
            <CheckCircle2 size={12} className="inline mr-1" />
            {doneOrders.length} completed order{doneOrders.length !== 1 ? "s" : ""} this session
          </p>
        )}
        {/* Confirmation Dialog */}
        {confirmAction && (
          <Dialog
            isOpen={!!confirmAction}
            onClose={() => setConfirmAction(null)}
            title={confirmAction.title || "Confirm Action"}
            maxWidth="max-w-md"
          >
            <div className="space-y-4 pt-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{confirmAction.message}</p>

              {confirmAction.details && (
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-black/[0.04] dark:border-zinc-800 rounded-md p-3.5 space-y-3 text-xs text-left">
                  {confirmAction.details.summary && (
                    <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] dark:border-zinc-850">
                      <span className="font-bold text-zinc-400 dark:text-zinc-500 uppercase text-[9px] tracking-wider">Action Details</span>
                      {confirmAction.details.badge && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${confirmAction.details.badgeColor || 'bg-zinc-100 text-zinc-650'}`}>
                          {confirmAction.details.badge}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {confirmAction.details.table && (
                      <div>
                        <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Table</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">{confirmAction.details.table}</span>
                      </div>
                    )}
                    {confirmAction.details.customer && (
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Customer</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate block">{confirmAction.details.customer}</span>
                      </div>
                    )}
                  </div>

                  {confirmAction.details.items && confirmAction.details.items.length > 0 && (
                    <div className="pt-2 border-t border-black/[0.04] dark:border-zinc-850 space-y-1.5">
                      <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Order Items</span>
                      <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                        {confirmAction.details.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 py-0.5">
                            <span className="font-black text-[#FF6A00] bg-[#FF6A00]/5 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                              {item.qty}×
                            </span>
                            <span className="truncate">{item.name}</span>
                            {item.price && (
                              <span className="text-zinc-400 dark:text-zinc-500 font-bold ml-auto shrink-0">
                                ₹{item.price * item.qty}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-9 font-bold"
                  onClick={() => setConfirmAction(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="dark"
                  className="flex-1 h-9 font-bold"
                  onClick={() => {
                    confirmAction.onConfirm();
                    setConfirmAction(null);
                  }}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </Dialog>
        )}
      </div>
    </div>
  );
}
