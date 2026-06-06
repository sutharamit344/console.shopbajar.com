import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { useShopOwner } from "@/hooks/useShopOwner";
import { DOMAIN, MAIN_APP_URL } from "@/lib/config";
import {
  listenTables,
  listenSessions,
  listenAllOrders,
  approveSession,
  closeSession,
  updateOrderItemStatus,
  updateTable,
  updateOrderStatus
} from "@/lib/rtdb";
import Card from "@/components/UI/Card";
import Button from "@/components/UI/Button";
import Dialog from "@/components/UI/Dialog";
import {
  Bell, Clock, Check, X, Loader2, Table2, Printer, Coins,
  ChefHat, ArrowLeft, UtensilsCrossed, AlertCircle, CheckCircle2,
  Store, User, Phone, ShoppingBag, Calculator
} from "lucide-react";

export default function WaiterClient() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { shop: initialShop, loading: shopLoading, error } = useShopOwner();
  const isPortal = window.location.pathname.startsWith("/portal");
  const [shop, setShop] = useState<any>(null);

  const [tables, setTables] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("tables"); // "tables" | "deliver" | "approvals"
  const [servingItemId, setServingItemId] = useState<any>(null); // { orderId, itemIndex }
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<any>(null); // { message, onConfirm }

  useEffect(() => {
    if (initialShop) {
      setShop(initialShop);
    }
  }, [initialShop]);

  // Realtime listeners
  useEffect(() => {
    if (!shop?.id) return;
    const unsubTables = listenTables(shop.id, setTables);
    const unsubSessions = listenSessions(shop.id, setSessions);
    const unsubOrders = listenAllOrders(shop.id, setOrders);
    return () => {
      unsubTables();
      unsubSessions();
      unsubOrders();
    };
  }, [shop?.id]);

  const getSessionCode = (sid) => {
    if (!sid) return "";
    let hash = 0;
    for (let i = 0; i < sid.length; i++) {
      hash += sid.charCodeAt(i);
    }
    return ((hash % 90) + 10).toString();
  };

  const getGuestNames = (session) => {
    if (!session) return "Guest";
    const code = getSessionCode(session.id || session.sessionId);
    const codeSuffix = code ? ` [#${code}]` : "";
    if (session.guests && Object.keys(session.guests).length > 0) {
      return Object.values(session.guests).map((g: any) => g.name).join(", ") + codeSuffix;
    }
    return (session.customerName || "Guest") + codeSuffix;
  };

  const getGuestPhones = (session) => {
    if (!session) return "";
    if (session.guests && Object.keys(session.guests).length > 0) {
      return Object.values(session.guests).map((g: any) => g.phone).filter(Boolean).join(", ");
    }
    return session.customerPhone || "";
  };

  // Filter sessions
  const activeSessions = sessions.filter((s) => s.status === "active");
  const pendingSessions = sessions.filter((s) => s.status === "pending");

  // Determine items that are "Ready to Serve"
  const readyToServeItems: any[] = [];
  orders.forEach((order) => {
    const session = activeSessions.find((s) => s.id === order.sessionId);
    if (!session) return;

    if (order.items && order.items.length > 0) {
      order.items.forEach((item, idx) => {
        if (item.status === "ready") {
          readyToServeItems.push({
            orderId: order.id,
            sessionId: order.sessionId,
            itemIndex: idx,
            name: item.name,
            qty: item.qty,
            tableName: order.tableName || session.tableName,
            customerName: getGuestNames(session),
          });
        }
      });
    }
  });

  const handleApproveSession = (session) => {
    setConfirmAction({
      title: "Approve Scan Request",
      message: `Allow "${getGuestNames(session)}" to start placing orders at ${session.tableName}?`,
      onConfirm: async () => {
        if (!shop?.id) return;
        await approveSession(shop.id, session.id, session.tableId);
      }
    });
  };

  const handleRejectSession = (session) => {
    setConfirmAction({
      title: "Reject Scan Request",
      message: `Deny and close the table session request for "${getGuestNames(session)}" at ${session.tableName}?`,
      onConfirm: async () => {
        if (!shop?.id) return;
        await closeSession(shop.id, session.id, session.tableId);
      }
    });
  };

  const handleMarkServed = async (serveItem) => {
    if (!shop?.id) return;
    setServingItemId({ orderId: serveItem.orderId, itemIndex: serveItem.itemIndex });
    try {
      await updateOrderItemStatus(
        shop.id,
        serveItem.sessionId,
        serveItem.orderId,
        serveItem.itemIndex,
        "served"
      );
    } catch (err) {
      console.error("Failed to serve item:", err);
    } finally {
      setServingItemId(null);
    }
  };

  const handlePrintSlip = (session, activeTableOrders) => {
    const printWindow = window.open("", "_blank", "width=420,height=700");
    if (!printWindow) return;

    const dateStr = new Date().toLocaleDateString("en-IN");
    const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    // Consolidate ordered items
    const consolidatedItems = {};
    activeTableOrders.forEach((order) => {
      if (order.status === "cancelled") return;
      order.items?.forEach((item: any) => {
        const price = parseFloat(item.price || 0);
        if (consolidatedItems[item.name]) {
          consolidatedItems[item.name].qty += parseInt(item.qty || 1);
        } else {
          consolidatedItems[item.name] = {
            name: item.name,
            price: price,
            qty: parseInt(item.qty || 1),
          };
        }
      });
    });

    const itemsArray = Object.values(consolidatedItems) as any[];
    const finalTotal = itemsArray.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0);

    const itemRows = itemsArray.map((item: any) => {
      const lineTotal = item.qty * item.price;
      return `
        <div class="item">
          <div class="item-top">
            <span class="item-name">${item.name || "Item"}</span>
            <span class="item-total">₹${lineTotal.toFixed(0)}</span>
          </div>
          <div class="item-meta">${item.qty} x ₹${item.price.toFixed(0)}</div>
        </div>
      `;
    }).join("");

    const guestName = getGuestNames(session);
    const guestPhone = getGuestPhones(session);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>POS Slip - ${shop.name} - ${session.tableName}</title>
        <style>
          @page { size: 80mm auto; margin: 6mm; }
          body {
            font-family: "Courier New", monospace;
            color: #111;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.4;
          }
          .slip {
            width: 72mm;
            margin: 0 auto;
          }
          .center { text-align: center; }
          .title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 4px;
            text-transform: uppercase;
          }
          .muted {
            color: #444;
            font-size: 11px;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 10px 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin: 2px 0;
          }
          .label {
            color: #444;
          }
          .item {
            padding: 6px 0;
            border-bottom: 1px dashed #ccc;
          }
          .item-top {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            align-items: flex-start;
          }
          .item-name {
            font-weight: 700;
            word-break: break-word;
          }
          .item-total {
            font-weight: 700;
            white-space: nowrap;
          }
          .item-meta {
            color: #444;
            font-size: 11px;
            margin-top: 2px;
          }
          .grand-total {
            font-size: 15px;
            font-weight: 700;
            margin-top: 8px;
          }
          .footer {
            margin-top: 15px;
            text-align: center;
            font-size: 11px;
          }
          .paid-stamp {
            border: 2px solid #000;
            color: #000;
            font-size: 14px;
            font-weight: bold;
            padding: 4px 8px;
            margin: 12px auto;
            width: fit-content;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="slip">
          <div class="center">
            <div class="title">${shop.name}</div>
            <div class="muted">${shop.category || "Store"}</div>
            ${shop.phone ? `<div class="muted">Ph: ${shop.phone}</div>` : ""}
            <div class="muted">${[shop.area, shop.city].filter(Boolean).join(", ")}</div>
          </div>

          <div class="divider"></div>

          <div class="row"><span class="label">Table</span><span><strong>${session.tableName || "Table"}</strong></span></div>
          <div class="row"><span class="label">Session ID</span><span>#${session.id?.substring(0, 6).toUpperCase() || "-"}</span></div>
          <div class="row"><span class="label">Date</span><span>${dateStr}</span></div>
          <div class="row"><span class="label">Time</span><span>${timeStr}</span></div>

          <div class="divider"></div>

          <div class="row"><span class="label">Customer</span><span>${guestName || "Guest"}</span></div>
          ${guestPhone ? `<div class="row"><span class="label">Phone</span><span>${guestPhone}</span></div>` : ""}

          <div class="divider"></div>

          ${itemRows || '<div class="center muted">No items ordered</div>'}

          <div class="divider"></div>

          <div class="row grand-total">
            <span>TOTAL AMOUNT</span>
            <span>₹${finalTotal.toFixed(0)}</span>
          </div>

          <div class="paid-stamp">PAID</div>

          <div class="footer">
            <div>Thank you for dining with us!</div>
            <div>Powered by ShopBajar</div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleCheckoutSession = (session, activeTableOrders) => {
    setConfirmAction({
      title: "Checkout & Close Table",
      message: `Finalize checkout for "${getGuestNames(session)}" at ${session.tableName}? This prints a POS receipt and frees up the table.`,
      onConfirm: async () => {
        if (!shop?.id) return;
        setCheckoutLoading(true);
        try {
          // Print POS Receipt
          handlePrintSlip(session, activeTableOrders);

          // Close session in DB
          await closeSession(shop.id, session.id, session.tableId);

          // Find linked tables to clear currentSessionId
          const linkedTables = tables.filter((t) => t.currentSessionId === session.id);
          for (const lt of linkedTables) {
            await updateTable(shop.id, lt.id, { currentSessionId: null });
          }

          setSelectedTableId(null);
        } catch (e) {
          console.error("Checkout failed:", e);
        } finally {
          setCheckoutLoading(false);
        }
      }
    });
  };

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
          <Store size={40} className="mx-auto text-zinc-350 dark:text-zinc-600 mb-4" />
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
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6A00]/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

            <div className="flex flex-col items-center text-center space-y-4 z-10 relative">
              <div className="w-12 h-12 rounded-md bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#FF6A00] shadow-2xs">
                <Bell size={22} />
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 rounded border border-black/[0.04] text-[9px] font-black uppercase tracking-wider text-[#FF6A00]">
                  SaaS Add-on Feature
                </div>
                <h2 className="text-base font-bold text-[#0A0A0F] tracking-tight">Waiter Live Dashboard</h2>
                <p className="text-[12px] text-[#0A0A0F]/55 max-w-sm font-medium leading-relaxed">
                  Unlock the waiter live console for table session approvals, instant FOH service notifications, and POS checkout management.
                </p>
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
                  icon={Check}
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

  // Get selected table and its active session/orders
  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const activeTableSession = selectedTable
    ? activeSessions.find((s) => s.id === selectedTable.currentSessionId || (s.tableId === selectedTable.id && s.status === "active"))
    : null;

  const activeTableOrders = activeTableSession
    ? orders.filter((o) => o.sessionId === activeTableSession.id)
    : [];

  // Consolidate bill quantities for details panel
  const billSummaryItems = {};
  activeTableOrders.forEach((order) => {
    if (order.status === "cancelled") return;
    order.items?.forEach((item: any) => {
      const price = parseFloat(item.price || 0);
      if (billSummaryItems[item.name]) {
        billSummaryItems[item.name].qty += parseInt(item.qty || 1);
      } else {
        billSummaryItems[item.name] = {
          name: item.name,
          price: price,
          qty: parseInt(item.qty || 1),
        };
      }
    });
  });

  const billItemsArray = Object.values(billSummaryItems) as any[];
  const billGrandTotal = billItemsArray.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0);

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-150 pb-24 sm:pb-6 transition-colors duration-200">
      <div className="w-full px-4 md:px-6 py-6 max-w-7xl mx-auto">

        {/* Unified High-Density Header Row (Sticky and Glassmorphic on mobile) */}
        <div className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-black/[0.05] dark:border-zinc-800 p-3.5 flex items-center justify-between -mx-4 sm:mx-0 sm:rounded-md sm:border sm:mb-6 mb-4 shadow-2xs transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <Link to={`${isPortal ? "/portal" : ""}/tables?shopId=${shop.id}`} className="w-8 h-8 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-[#0A0A0F]/40 dark:text-zinc-400 hover:text-[#0A0A0F] dark:hover:text-zinc-150 transition-colors shadow-sm shrink-0" title="Back to Seating Map">
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-[16px] font-bold text-[#0A0A0F] dark:text-zinc-100 tracking-tight leading-none truncate">Waiter Console</h1>
                {activeSessions.length > 0 && (
                  <span className="text-[9px] sm:text-[10px] font-black bg-[#FF6A00] text-white px-2 py-0.5 rounded-full shrink-0">
                    {activeSessions.length} active
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-[#0A0A0F]/40 dark:text-zinc-400 font-medium mt-1 truncate">{shop.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Copy Staff Portal Link Button (Only for Owner) */}
            {!isPortal && (
              <button
                type="button"
                onClick={() => {
                  const staffUrl = `${window.location.origin}/portal/waiter?shopId=${shop.id}`;
                  navigator.clipboard.writeText(staffUrl);
                  alert("Copied Staff Waiter Link to clipboard!\nShare this with your staff. PIN: " + (shop.staffPin || "1234"));
                }}
                className="h-8 px-2.5 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
              >
                <User size={12} className="text-zinc-400" />
                <span className="hidden md:inline">Share Staff URL</span>
              </button>
            )}

            <Link
              to={`${isPortal ? "/portal" : ""}/kitchen?shopId=${shop.id}`}
              className="h-8 px-2.5 sm:px-3 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-[#0A0A0F]/60 dark:text-zinc-300 hover:text-[#0A0A0F] dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <ChefHat size={11} className="text-[#FF6A00]" />
              <span className="hidden xs:inline">Kitchen</span>
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

        {/* Mobile-First Tab Navigation (Fixed to bottom on mobile, inline at top on desktop) */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-black/[0.08] dark:border-zinc-850 p-2.5 flex items-center gap-1 shadow-lg sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:z-auto sm:bg-zinc-150 sm:dark:bg-zinc-900 sm:border sm:border-black/[0.05] sm:dark:border-zinc-800 sm:p-1 sm:rounded-md sm:mb-6 sm:shadow-none">
          {[
            { id: "tables", label: "Tables Floor", icon: Table2, badge: activeSessions.length, badgeColor: "bg-emerald-500 text-white" },
            { id: "deliver", label: "Ready to Serve", icon: UtensilsCrossed, badge: readyToServeItems.length, badgeColor: "bg-amber-500 text-white" },
            { id: "approvals", label: "Entry Requests", icon: Bell, badge: pendingSessions.length, badgeColor: "bg-[#FF6A00] text-white" }
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 sm:py-2 px-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 leading-none ${
                  isActive
                    ? "bg-[#0A0A0F] text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-955"
                    : "text-zinc-455 hover:text-zinc-650 dark:text-zinc-500 dark:hover:text-zinc-300"
                }`}
              >
                <div className="relative shrink-0 flex items-center justify-center">
                  <TabIcon size={14} className={isActive ? "text-[#FF6A00] sm:text-inherit" : "text-inherit"} />
                  {tab.badge > 0 && (
                    <span className={`absolute -top-2.5 -right-3.5 text-[8px] font-black h-4 px-1 flex items-center justify-center rounded-full ${tab.badgeColor} scale-90`}>
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] mt-1 sm:mt-0">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Workspace */}
        <div className="space-y-6">

          {/* Tab 1: Entry Requests */}
          {activeTab === "approvals" && (
            <div>
              <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                Pending Entry Requests ({pendingSessions.length})
              </p>
              {pendingSessions.length === 0 ? (
                <div className="py-16 text-center bg-white dark:bg-zinc-900 border border-black/[0.04] dark:border-zinc-800 p-6 rounded-md shadow-2xs">
                  <Bell size={32} className="mx-auto text-zinc-250 dark:text-zinc-700 mb-2.5" />
                  <p className="text-xs font-bold text-zinc-400 dark:text-zinc-550">No pending scan requests</p>
                  <p className="text-[10px] text-zinc-400/80 dark:text-zinc-500 mt-0.5">When customers scan a QR code, their request will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingSessions.map((session) => (
                    <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-amber-900/40 rounded-md shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-amber-50 dark:bg-amber-955/20 border border-amber-100 dark:border-amber-900/30 flex items-center justify-center text-amber-550 shrink-0">
                          <Table2 size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-[#0A0A0F] dark:text-zinc-150">
                            {session.tableName} <span className="text-[#0A0A0F]/30 dark:text-zinc-505 font-medium font-mono text-[11px]">#{session.id?.substring(0, 4).toUpperCase()}</span>
                          </p>
                          <p className="text-[11px] text-[#0A0A0F]/50 dark:text-zinc-400 mt-0.5 truncate">
                            Customer: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{getGuestNames(session)}</span>
                            {getGuestPhones(session) && ` (📞 ${getGuestPhones(session)})`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          onClick={() => handleRejectSession(session)}
                          className="flex-1 sm:flex-none h-10 sm:h-8 px-4 rounded-md border border-rose-100 dark:border-rose-950 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 text-[11px] font-bold hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-all cursor-pointer flex items-center justify-center"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveSession(session)}
                          className="flex-1 sm:flex-none h-10 sm:h-8 px-4.5 rounded-md bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Check size={12} className="stroke-[3]" /> Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Ready to Serve Pickup Tray */}
          {activeTab === "deliver" && (
            <div>
              <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <UtensilsCrossed size={12} />
                Ready to Serve Pickup Tray
              </p>
              {readyToServeItems.length === 0 ? (
                <div className="py-16 text-center bg-white dark:bg-zinc-900 rounded-md border border-black/[0.04] dark:border-zinc-800 p-6 shadow-2xs">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500/20 mb-2.5" />
                  <p className="text-[12px] font-bold text-zinc-400 dark:text-zinc-550">All items are delivered</p>
                  <p className="text-[10px] text-zinc-400/70 dark:text-zinc-500 mt-0.5">Prepared dishes will show up here to be delivered to tables.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {readyToServeItems.map((serveItem, idx) => {
                    const isServing = servingItemId?.orderId === serveItem.orderId && servingItemId?.itemIndex === serveItem.itemIndex;
                    return (
                      <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-emerald-50/40 dark:bg-emerald-955/10 border border-emerald-100 dark:border-emerald-900/30 rounded-md shadow-2xs">
                        <div className="min-w-0">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[8px] font-black uppercase tracking-wider mb-1.5">
                            Ready
                          </span>
                          <p className="text-[13px] font-bold text-[#0A0A0F] dark:text-zinc-150 truncate">
                            <span className="text-[#FF6A00] font-black">{serveItem.qty}×</span> {serveItem.name}
                          </p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold mt-0.5">
                            📍 {serveItem.tableName} · {serveItem.customerName}
                          </p>
                        </div>
                        <button
                          disabled={isServing}
                          onClick={() => handleMarkServed(serveItem)}
                          className="h-10 sm:h-8 px-3.5 rounded-md bg-[#0A0A0F] dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 text-[11px] font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                        >
                          {isServing ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} className="stroke-[3]" />
                          )}
                          Served
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Tables Floor Map */}
          {activeTab === "tables" && (
            <div>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
                Tables Floor map seating ({tables.length} tables)
              </p>
              {tables.length === 0 ? (
                <div className="py-16 text-center bg-white dark:bg-zinc-900 rounded-md border border-dashed border-black/[0.1] dark:border-zinc-800">
                  <Table2 size={36} className="mx-auto text-zinc-250 dark:text-zinc-700 mb-3" />
                  <p className="text-xs font-bold text-zinc-450 dark:text-zinc-500">No tables configured.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {tables.map((table) => {
                    const session = activeSessions.find(
                      (s) => s.id === table.currentSessionId || (s.tableId === table.id && s.status === "active")
                    );
                    const isPending = pendingSessions.some((s) => s.tableId === table.id);
                    const isSelected = selectedTableId === table.id;

                    return (
                      <button
                        key={table.id}
                        onClick={() => setSelectedTableId(isSelected ? null : table.id)}
                        className={`flex flex-col items-center justify-between text-center p-3.5 rounded-md border transition-all relative cursor-pointer min-h-[100px] ${
                          isPending
                            ? "bg-amber-50/50 dark:bg-amber-955/10 border-amber-250 dark:border-amber-900/60 hover:border-amber-355 text-[#0A0A0F] dark:text-zinc-100"
                            : session
                            ? "bg-emerald-50/40 dark:bg-emerald-955/10 border-emerald-250 dark:border-emerald-900/60 hover:border-emerald-355 text-[#0A0A0F] dark:text-zinc-100"
                            : "bg-white dark:bg-zinc-900 border-black/[0.06] dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-750 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                        } ${isSelected ? "ring-2 ring-[#FF6A00] ring-offset-2 dark:ring-offset-zinc-950 border-transparent scale-[1.02]" : ""}`}
                      >
                        <div className="flex flex-col items-center">
                          <Table2 size={20} className={isPending ? "text-amber-500" : session ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-700"} />
                          <span className="text-[12px] font-extrabold tracking-tight mt-1.5 block">{table.name}</span>
                        </div>

                        <div className="mt-2 w-full">
                          {isPending ? (
                            <span className="text-[8.5px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-955/30 px-1.5 py-0.5 rounded tracking-wider animate-pulse">
                              Pending
                            </span>
                          ) : session ? (
                            <span className="text-[8.5px] font-bold text-emerald-700 dark:text-emerald-450 max-w-[90px] truncate block mx-auto">
                              {session.customerName || "Dining"}
                            </span>
                          ) : (
                            <span className="text-[8.5px] font-medium text-zinc-400 dark:text-zinc-500 block">
                              Empty · {table.capacity}p
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Dynamic Table Details Drawer/Dialog Overlay for Mobile and Desktop Checkouts */}
      {selectedTable && (
        <Dialog
          isOpen={!!selectedTableId}
          onClose={() => setSelectedTableId(null)}
          title={`Checkout — ${selectedTable.name}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-2 text-left">
            {activeTableSession ? (
              <div className="space-y-4">
                {/* Guest details card */}
                <div className="text-xs space-y-1 bg-zinc-50 dark:bg-zinc-950 border border-black/[0.03] dark:border-zinc-850 p-3 rounded-md">
                  <p className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <User size={13} className="text-[#FF6A00]" />
                    <span className="font-extrabold">{getGuestNames(activeTableSession)}</span>
                  </p>
                  {getGuestPhones(activeTableSession) && (
                    <p className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                      <Phone size={11} />
                      <span>{getGuestPhones(activeTableSession)}</span>
                    </p>
                  )}
                </div>

                {/* Consolidated billing summary list */}
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-505 uppercase tracking-widest border-b border-black/[0.04] dark:border-zinc-800 pb-1.5">
                    Consolidated Bill Details
                  </p>
                  {billItemsArray.length === 0 ? (
                    <p className="text-[11px] text-zinc-450 dark:text-zinc-500 italic text-center py-4">No active items ordered yet.</p>
                  ) : (
                    <div className="divide-y divide-black/[0.04] dark:divide-zinc-800 space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {billItemsArray.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-xs pt-2 first:pt-0">
                          <div className="min-w-0">
                            <p className="font-bold text-[#0A0A0F] dark:text-zinc-200 truncate">{item.name}</p>
                            <p className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-0.5">
                              {item.qty} × ₹{item.price}
                            </p>
                          </div>
                          <span className="font-bold text-zinc-800 dark:text-zinc-300">
                            ₹{item.price * item.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Billing Summary Total */}
                {billGrandTotal > 0 && (
                  <div className="pt-3.5 border-t border-black/[0.06] dark:border-zinc-850 flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-450">Bill Grand Total</span>
                    <span className="text-base font-black text-[#FF6A00]">₹{billGrandTotal}</span>
                  </div>
                )}

                {/* checkout CTA actions */}
                <div className="pt-3 border-t border-black/[0.05] dark:border-zinc-855 space-y-2">
                  <button
                    onClick={() => handlePrintSlip(activeTableSession, activeTableOrders)}
                    disabled={billGrandTotal === 0}
                    className="w-full h-10 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-[11px] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-50 text-zinc-650 dark:text-zinc-300"
                  >
                    <Printer size={12} />
                    Print Receipt Summary
                  </button>

                  <button
                    onClick={() => handleCheckoutSession(activeTableSession, activeTableOrders)}
                    disabled={checkoutLoading || billGrandTotal === 0}
                    className="w-full h-11 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {checkoutLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Coins size={12} />
                    )}
                    Collect Payment & Close Table
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-400 space-y-2">
                <UtensilsCrossed size={28} className="mx-auto text-zinc-200" />
                <p className="text-xs font-bold text-zinc-500">Table is vacant</p>
                <p className="text-[10px] text-zinc-400/80 leading-relaxed px-2">
                  Guest scanning table QR and waiter approvals will trigger ordering sessions.
                </p>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Action confirmation dialog */}
      {confirmAction && (
        <Dialog
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          title={confirmAction.title || "Confirm Action"}
          maxWidth="max-w-sm"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-zinc-500 font-semibold leading-relaxed">{confirmAction.message}</p>
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-9 font-bold text-xs"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </Button>
              <Button
                variant="dark"
                className="flex-1 h-9 font-bold text-xs"
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
  );
}
