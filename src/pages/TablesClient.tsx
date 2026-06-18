import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { useShopOwner } from "@/hooks/useShopOwner";
import { updateShop, createBill } from "@/lib/db";
import { ChairsRenderer } from "@/components/Tables/ChairsRenderer";
import { printPosSlip } from "@/lib/printPosSlip";
import {
  addTable,
  deleteTable,
  listenTables,
  updateTable,
  closeSession,
  listenSessions,
  mergeTables,
  unmergeTable,
  listenSessionOrders,
  updateSessionStatus,
  updateOrderStatus,
  approveSession,
  getSessionOrders,
} from "@/lib/rtdb";
import { DOMAIN, MAIN_APP_URL, getCustomerAppUrl } from "@/lib/config";
import Card from "@/components/UI/Card";
import Button from "@/components/UI/Button";
import Dialog from "@/components/UI/Dialog";
import {
  QrCode,
  Plus,
  Trash2,
  Users,
  ArrowLeft,
  ChefHat,
  Copy,
  Check,
  Printer,
  ToggleLeft,
  ToggleRight,
  Table2,
  ExternalLink,
  Loader2,
  Store,
  Settings2,
  Lock,
  ArrowRight,
  LayoutGrid,
  Clock,
  Coins,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Bell,
  Calculator,
  Maximize2,
  Minimize2,
} from "lucide-react";

export default function TablesClient() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { shop: initialShop, loading: shopLoading, error } = useShopOwner();
  const [shop, setShop] = useState<any>(null);
  const isPortal = window.location.pathname.startsWith("/portal");

  // Fullscreen state detection
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (initialShop) {
      setShop(initialShop);
    }
  }, [initialShop]);

  const [tables, setTables] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [showAddDialog, setShowAddDialog] = useState<boolean>(false);
  const [showQrDialog, setShowQrDialog] = useState<any>(null); // table object
  const [addForm, setAddForm] = useState<any>({
    name: "",
    capacity: "4",
    shape: "round",
    bookingPrice: "0",
  });
  const [isEditingTable, setIsEditingTable] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<any>({
    name: "",
    capacity: "4",
    shape: "round",
    bookingPrice: "0",
  });

  const [adding, setAdding] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteTable, setPendingDeleteTable] = useState<any>(null); // table object to delete
  const [pendingMergeTable, setPendingMergeTable] = useState<any>(null); // table object to merge
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [viewMode, setViewMode] = useState<string>("map"); // 'grid' | 'map'
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null); // tableId string for detail dialog

  useEffect(() => {
    if (selectedTableId) {
      const tbl = tables.find((t) => t.id === selectedTableId);
      if (tbl) {
        setEditForm({
          name: tbl.name || "",
          capacity: String(tbl.capacity || 4),
          shape: tbl.shape || "round",
          bookingPrice: String(tbl.bookingPrice || 0),
        });
      }
    }
    setIsEditingTable(false);
  }, [selectedTableId, tables]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]); // running orders for active session
  const [gridCols, setGridCols] = useState<number>(4); // dynamic grid columns count
  const [confirmAction, setConfirmAction] = useState<any>(null); // { message, onConfirm }
  const [activeSessionTab, setActiveSessionTab] = useState<string>("all"); // 'all' | sessionId
  const [expandedSessions, setExpandedSessions] = useState<any>({}); // sessionId -> boolean (default true)
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
  const [expandedHistorySessionId, setExpandedHistorySessionId] = useState<
    string | null
  >(null);

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
      return (
        Object.values(session.guests)
          .map((g: any) => g.name)
          .join(", ") + codeSuffix
      );
    }
    return (session.customerName || "Guest") + codeSuffix;
  };

  const getGuestPhones = (session) => {
    if (session.guests && Object.keys(session.guests).length > 0) {
      return Object.values(session.guests)
        .map((g: any) => g.phone)
        .filter(Boolean)
        .join(", ");
    }
    return session.customerPhone || "";
  };

  // Listen to tables in realtime
  useEffect(() => {
    if (!shop?.id) return;
    const unsub = listenTables(shop.id, setTables);
    return unsub;
  }, [shop?.id]);

  // Listen to sessions in realtime
  useEffect(() => {
    if (!shop?.id) return;
    const unsub = listenSessions(shop.id, setSessions);
    return unsub;
  }, [shop?.id]);

  // Listen to orders for all active sessions of the selected table group
  useEffect(() => {
    if (!shop?.id || !selectedTableId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveOrders([]);
      return;
    }

    const currentTable = tables.find((t) => t.id === selectedTableId);
    if (!currentTable) return;

    const targetTableId = currentTable.mergedInto || currentTable.id;
    const groupTables = tables.filter(
      (t) => (t.mergedInto || t.id) === targetTableId,
    );

    // Get all active sessions for the group
    const groupSessIds = sessions
      .filter(
        (s) =>
          groupTables.some((gt) => gt.id === s.tableId) &&
          s.status === "active",
      )
      .map((s) => s.id);

    if (groupSessIds.length === 0) {
      setActiveOrders([]);
      return;
    }

    // Register a listener for each active session
    const unsubs = [];
    const sessionOrdersMap = {};

    groupSessIds.forEach((sId) => {
      const unsub = listenSessionOrders(shop.id, sId, (orders) => {
        sessionOrdersMap[sId] = (orders || []).map((o) => ({
          ...o,
          sessionId: sId,
        }));

        // Merge and sort all orders
        const allOrders = Object.values(sessionOrdersMap).flat();
        const sorted = allOrders.sort(
          (a: any, b: any) => (a.placedAt || 0) - (b.placedAt || 0),
        );
        setActiveOrders(sorted);
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [shop?.id, selectedTableId, tables, sessions]);

  // Reset selected customer tab when details modal changes
  useEffect(() => {
    setActiveSessionTab("all");
  }, [selectedTableId]);

  const handleAddTable = async () => {
    if (!addForm.name.trim() || !shop?.id) return;
    setAdding(true);
    await addTable(shop.id, {
      name: addForm.name.trim(),
      capacity: parseInt(addForm.capacity) || 4,
      shape: addForm.shape || "round",
      bookingPrice: parseInt(addForm.bookingPrice) || 0,
    });
    setAddForm({ name: "", capacity: "4", shape: "round", bookingPrice: "0" });
    setShowAddDialog(false);
    setAdding(false);
  };

  const handleSaveTableEdit = async () => {
    if (!selectedTableId || !shop?.id || !editForm.name.trim()) return;
    try {
      await updateTable(shop.id, selectedTableId, {
        name: editForm.name.trim(),
        capacity: Number(editForm.capacity) || 4,
        shape: editForm.shape || "round",
        bookingPrice: Number(editForm.bookingPrice) || 0,
      });
      setIsEditingTable(false);
    } catch (err) {
      console.error("Error editing table: ", err);
    }
  };

  const handleDeleteTable = async () => {
    if (!shop?.id || !pendingDeleteTable) return;
    const tableId = pendingDeleteTable.id;
    setPendingDeleteTable(null);
    setDeletingId(tableId);
    await deleteTable(shop.id, tableId);
    setDeletingId(null);
  };

  const handleForceCloseSession = (session) => {
    const isPending = session.status === "pending";
    setConfirmAction({
      message: isPending
        ? `Are you sure you want to reject the scan request for "${getGuestNames(session)}" at ${session.tableName}?`
        : `Are you sure you want to end and close the session for "${getGuestNames(session)}" at ${session.tableName}? This will clear the table occupancy and finalize the session.`,
      onConfirm: async () => {
        if (!shop?.id) return;
        const linkedTables = tables.filter(
          (t) => t.currentSessionId === session.id,
        );

        let sessionOrders: any[] = [];
        let itemsArray: any[] = [];
        let subtotal = 0;

        // Print the POS Slip and save Firestore bill only if the session is not pending
        if (!isPending) {
          try {
            sessionOrders = await getSessionOrders(shop.id, session.id);

            const consolidatedItems: Record<string, any> = {};
            sessionOrders.forEach((order) => {
              if (order.status === "cancelled") return;
              order.items?.forEach((item: any) => {
                if (item.status === "cancelled") return;
                const price = parseFloat(item.price || 0);
                const key = `${item.name}_${price}`;
                if (consolidatedItems[key]) {
                  consolidatedItems[key].quantity += parseInt(item.qty || 1);
                } else {
                  consolidatedItems[key] = {
                    name: item.name,
                    category: item.category || "Table Order",
                    price: price,
                    quantity: parseInt(item.qty || 1),
                  };
                }
              });
            });

            itemsArray = Object.values(consolidatedItems);
            subtotal = itemsArray.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0,
            );

            if (itemsArray.length > 0) {
              await createBill({
                shopId: shop.id,
                shopName: shop.name || "",
                ownerId: user?.uid || shop.ownerId || "",
                billNumber: `QR-${session.tableName.replace(/\s+/g, "").toUpperCase()}-${String(Date.now()).slice(-6)}`,
                customerName: getGuestNames(session),
                customerPhone: getGuestPhones(session) || "",
                customerEmail: "",
                customerGst: "",
                billingAddress: "",
                notes: `Table: ${session.tableName} · Session: ${session.id}`,
                paymentMethod: "Cash",
                discount: 0,
                taxPercent: 0,
                taxAmount: 0,
                subtotal: subtotal,
                totalAmount: subtotal,
                status: "paid",
                source: "qr_table_checkout",
                tableId: session.tableId,
                tableName: session.tableName,
                sessionId: session.id,
                collectedBy: "Dashboard Seating",
                items: itemsArray.map((item) => ({
                  name: item.name || "",
                  category: item.category || "Table Order",
                  quantity: Number(item.quantity) || 1,
                  price: Number(item.price) || 0,
                })),
              });
            }

            // Print the POS Slip passing the fetched orders
            printPosSlip(shop, session, sessionOrders);
          } catch (err) {
            console.error(
              "Error creating bill or fetching orders for checkout: ",
              err,
            );
          }
        }

        const checkoutData =
          !isPending && itemsArray.length > 0
            ? {
                collectedBy: "Dashboard Seating",
                paymentMethod: "Cash",
                billAmount: subtotal,
                items: itemsArray.map((item) => ({
                  name: item.name,
                  qty: item.quantity,
                  price: item.price,
                })),
              }
            : undefined;

        await closeSession(shop.id, session.id, session.tableId, checkoutData);
        for (const lt of linkedTables) {
          if (lt.id !== session.tableId) {
            await updateTable(shop.id, lt.id, { currentSessionId: null });
          }
        }
      },
    });
  };

  const handleApproveSession = (sessionId, tableId) => {
    const sess = sessions.find((s) => s.id === sessionId);
    const name = sess ? getGuestNames(sess) : "this customer";
    const tableName = sess ? sess.tableName : `Table ${tableId}`;
    setConfirmAction({
      message: `Are you sure you want to approve the session for "${name}" at ${tableName}?`,
      onConfirm: async () => {
        if (!shop?.id) return;
        await approveSession(shop.id, sessionId, tableId);
      },
    });
  };

  const handleUpdateOrderStatus = (sessionId, orderId, currentStatus) => {
    if (currentStatus === "served") return; // Served is the final status for orders
    const order = activeOrders.find((o) => o.id === orderId);
    const itemsList =
      order && order.items
        ? order.items.map((i) => `${i.qty}x ${i.name}`).join(", ")
        : "";
    const tableName = order ? order.tableName : "";
    let nextStatus = "placed";
    if (currentStatus === "placed") nextStatus = "preparing";
    else if (currentStatus === "preparing") nextStatus = "served";
    setConfirmAction({
      message: `Are you sure you want to update order status to "${nextStatus.toUpperCase()}"${tableName ? ` for ${tableName}` : ""}? Items: ${itemsList}`,
      onConfirm: async () => {
        if (!shop?.id) return;
        await updateOrderStatus(shop.id, sessionId, orderId, nextStatus as any);
      },
    });
  };

  const handleMergeTables = async () => {
    if (!shop?.id || !pendingMergeTable || !mergeTargetId) return;
    await mergeTables(shop.id, pendingMergeTable.id, mergeTargetId);
    setPendingMergeTable(null);
    setMergeTargetId("");
  };

  const handleUnmergeTable = async (table) => {
    if (!shop?.id) return;
    await unmergeTable(shop.id, table.id);
  };

  const toggleWaiterApproval = async () => {
    if (!shop) return;
    const currentVal = shop.qrOrderingConfig?.requireWaiterApproval ?? false;
    const updatedConfig = {
      ...shop.qrOrderingConfig,
      requireWaiterApproval: !currentVal,
    };

    // Optimistic UI update
    setShop((prev) => ({
      ...prev,
      qrOrderingConfig: updatedConfig,
    }));

    const result = await updateShop(shop.id, {
      ...shop,
      qrOrderingConfig: updatedConfig,
    });

    if (!result.success) {
      // Revert if error
      setShop((prev) => ({
        ...prev,
        qrOrderingConfig: {
          ...prev.qrOrderingConfig,
          requireWaiterApproval: currentVal,
        },
      }));
    }
  };

  const getTableQrUrl = (tableId) =>
    getCustomerAppUrl(`/table/${shop?.slug}/${tableId}`);

  const handleCopyUrl = (tableId) => {
    navigator.clipboard.writeText(getTableQrUrl(tableId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = (tableId, tableName) => {
    const url = getTableQrUrl(tableId);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&color=0A0A0F&bgcolor=FFFFFF`;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>QR — ${tableName}</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fff; }
        .card { border: 2px solid #eee; border-radius: 24px; padding: 40px; text-align: center; max-width: 380px; }
        img { width: 280px; height: 280px; margin-bottom: 20px; }
        h2 { font-size: 22px; font-weight: 900; margin: 0 0 6px; color: #0A0A0F; }
        p { font-size: 13px; color: #666; margin: 0; }
        .brand { font-size: 12px; color: #FF6A00; font-weight: 700; margin-top: 20px; letter-spacing: .05em; text-transform: uppercase; }
      </style></head><body>
      <div class="card">
        <img src="${qrUrl}" alt="QR Code" />
        <h2>${tableName}</h2>
        <p>Scan to browse menu & place order</p>
        <p class="brand">ShopBajar · Table Ordering</p>
      </div>
      <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    win.document.close();
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
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-950 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 py-16 text-center bg-white dark:bg-zinc-900 border border-black/[0.05] dark:border-zinc-800 rounded-md shadow-lg">
          <Store
            size={40}
            className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4"
          />
          <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
            {error || "No shop found."}
          </p>
          {!isPortal && (
            <Button
              variant="dark"
              className="mt-6"
              onClick={() =>
                (window.location.href = "https://shopbajar.com/create")
              }
            >
              Create Shop
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Check paid feature gate
  const hasQrOrdering = !!shop?.paidFeatures?.qr_ordering?.enabled;
  const hasBilling =
    !!shop?.paidFeatures?.billing_system?.enabled ||
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
                <QrCode size={22} />
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 rounded border border-black/[0.04] text-[9px] font-black uppercase tracking-wider text-[#FF6A00]">
                  SaaS Add-on Feature
                </div>
                <h2 className="text-base font-bold text-[#0A0A0F] tracking-tight">
                  QR Table Ordering
                </h2>
                <p className="text-[12px] text-[#0A0A0F]/55 max-w-sm font-medium leading-relaxed">
                  Let customers scan table QR codes, browse your menu, and place
                  orders directly — no waiter needed.
                </p>
              </div>

              {/* Value Propositions */}
              <div className="w-full grid grid-cols-1 gap-2 pt-2 text-left">
                <div className="p-3 bg-zinc-50 border border-black/[0.04] rounded-md flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                    <Check size={12} className="stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-[#0A0A0F]">
                      Waiter Verification Option
                    </h4>
                    <p className="text-[10px] text-[#0A0A0F]/40 font-medium">
                      Approve sessions before ordering to prevent fake / remote
                      orders.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 border border-black/[0.04] rounded-md flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                    <Check size={12} className="stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-[#0A0A0F]">
                      Real-time Syncing
                    </h4>
                    <p className="text-[10px] text-[#0A0A0F]/40 font-medium">
                      Zero-latency kitchen tickets and order status tracking.
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full pt-4 border-t border-black/[0.06] flex items-center justify-end gap-2.5">
                <Button
                  variant="ghost"
                  className="text-xs h-9 font-bold"
                  onClick={() => navigate("/dashboard")}
                >
                  Back to Dashboard
                </Button>
                <Button
                  variant="dark"
                  icon={ArrowRight}
                  className="text-xs h-9 shadow-sm font-bold"
                  onClick={() =>
                    navigate(`/manage?shopId=${shop.id}&view=features`)
                  }
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

  const activeTableCount = tables.filter((t) =>
    sessions.some(
      (s) =>
        s.tableId === t.id && (s.status === "active" || s.status === "pending"),
    ),
  ).length;

  const totalSeats = tables.reduce((acc, t) => acc + t.capacity, 0);
  const occupiedSeats = tables.reduce((acc, t) => {
    const tableSessions = sessions.filter(
      (s) =>
        s.tableId === t.id && (s.status === "active" || s.status === "pending"),
    );
    if (tableSessions.length === 0) return acc;
    const count = tableSessions.reduce(
      (sum, s) => sum + (s.guestCount ? Number(s.guestCount) : 1),
      0,
    );
    return acc + count;
  }, 0);

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-955 text-zinc-900 dark:text-zinc-150 transition-colors duration-200">
      <div className="w-full px-4 md:px-8 py-4">
        {/* Unified High-Density Header Row (Sticky and Glassmorphic on mobile) */}
        {!isFullscreen && (
          <div className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-black/[0.05] dark:border-zinc-800 p-2 flex items-center justify-between -mx-4 sm:mx-0 sm:rounded-md sm:border sm:mb-3 mb-2 shadow-2xs transition-all">
            {/* Left: Back button + Title & Shop Stats */}
            <div className="flex items-center gap-2.5 min-w-0">
              {!isPortal && (
                <a
                  href={getCustomerAppUrl("/dashboard")}
                  className="w-7 h-7 rounded-md border border-black/[0.08] dark:border-zinc-755 bg-white dark:bg-zinc-800 flex items-center justify-center text-[#0A0A0F]/40 dark:text-zinc-400 hover:text-[#0A0A0F]/60 dark:hover:text-zinc-200 transition-colors shadow-sm shrink-0"
                >
                  <ArrowLeft size={13} />
                </a>
              )}
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  {shop.name} · {tables.length} tables · {activeTableCount}{" "}
                  active
                </span>
              </div>
            </div>

            {/* Right Section: View Mode & Kitchen Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-0.5 bg-zinc-50 dark:bg-zinc-900 border border-black/[0.08] dark:border-zinc-800 p-0.5 h-8 rounded-md shrink-0">
                <button
                  onClick={() => setViewMode("map")}
                  className={`h-6.5 px-2 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    viewMode === "map"
                      ? "bg-[#0A0A0F] text-white dark:bg-zinc-800 dark:text-zinc-100 shadow-2xs"
                      : "text-[#0A0A0F]/50 dark:text-zinc-400 hover:text-[#0A0A0F] dark:hover:text-zinc-200"
                  }`}
                  title="Seating Floor Map"
                >
                  <Table2 size={11} />
                  <span className="hidden xs:inline">Map</span>
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`h-6.5 px-2 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-[#0A0A0F] text-white dark:bg-zinc-800 dark:text-zinc-100 shadow-2xs"
                      : "text-[#0A0A0F]/50 dark:text-[#0A0A0F]/50 dark:text-zinc-400 hover:text-[#0A0A0F] dark:hover:text-zinc-200"
                  }`}
                  title="Cards Grid"
                >
                  <LayoutGrid size={11} />
                  <span className="hidden xs:inline">Grid</span>
                </button>
              </div>

              {/* Copy Staff Portal Link Button (Only for Owner) */}
              {!isPortal && (
                <button
                  type="button"
                  onClick={() => {
                    const staffUrl = `${window.location.origin}/portal/tables?shopId=${shop.id}`;
                    navigator.clipboard.writeText(staffUrl);
                    alert(
                      "Copied Staff Tables Link to clipboard!\nShare this with your staff. PIN: " +
                        (shop.staffPin || "1234"),
                    );
                  }}
                  className="h-8 px-2.5 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
                >
                  <Copy size={12} className="text-zinc-400" />
                  <span className="hidden md:inline">Share Staff URL</span>
                </button>
              )}

              {/* Kitchen Link (Compact on mobile) */}
              <Link
                to={`${isPortal ? "/portal" : ""}/kitchen?shopId=${shop.id}`}
                className="h-8 w-8 sm:w-auto sm:px-2.5 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-[#0A0A0F]/60 dark:text-zinc-300 hover:text-[#0A0A0F] dark:hover:text-zinc-155 hover:bg-black/[0.02] dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                title="Kitchen View"
              >
                <ChefHat size={12} className="text-[#FF6A00]" />
                <span className="hidden sm:inline">Kitchen</span>
              </Link>

              {/* Waiter Link (Compact on mobile) */}
              <Link
                to={`${isPortal ? "/portal" : ""}/waiter?shopId=${shop.id}`}
                className="h-8 w-8 sm:w-auto sm:px-2.5 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-[#0A0A0F]/60 dark:text-zinc-300 hover:text-[#0A0A0F] dark:hover:text-zinc-155 hover:bg-black/[0.02] dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                title="Waiter Console"
              >
                <Bell size={12} className="text-[#FF6A00]" />
                <span className="hidden sm:inline">Waiter</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  if (!document.fullscreenElement) {
                    document.documentElement
                      .requestFullscreen()
                      .catch((err) => {
                        console.error("Failed to enter fullscreen:", err);
                      });
                  } else {
                    document.exitFullscreen().catch((err) => {
                      console.error("Failed to exit fullscreen:", err);
                    });
                  }
                }}
                className="h-8 w-8 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all shadow-sm shrink-0 cursor-pointer"
                title="Enter Fullscreen"
              >
                <Maximize2 size={13} />
              </button>
            </div>
          </div>
        )}

        {/* ── TWO-COLUMN GRID LAYOUT (Rearranged for mobile layout ordering) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left Column: Settings Panel */}
          <div className="lg:col-span-1 space-y-4 order-last lg:order-first">
            {/* Occupancy & Live Status Card */}
            <div className="bg-white dark:bg-zinc-900 border border-black/[0.05] dark:border-zinc-800 rounded-md p-4 shadow-2xs">
              <h3 className="text-[12px] font-bold text-[#0A0A0F] dark:text-zinc-200 mb-3 uppercase tracking-wider">
                Live Seating Stats
              </h3>
              <div className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex justify-between items-center">
                  <span>Occupancy</span>
                  <span className="font-bold text-[#0A0A0F] dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 border border-black/[0.04] dark:border-zinc-850 px-2 py-0.5 rounded">
                    {occupiedSeats} / {totalSeats} seats
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Active Tables</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-2 py-0.5 rounded">
                    {activeTableCount} / {tables.length} tables
                  </span>
                </div>
              </div>
            </div>

            {/* Ordering Policy Settings */}
            <div className="bg-white dark:bg-zinc-900 border border-black/[0.05] dark:border-zinc-800 rounded-md p-4 shadow-2xs">
              <h3 className="text-[12px] font-bold text-[#0A0A0F] dark:text-zinc-200 mb-3 uppercase tracking-wider">
                Ordering Rules
              </h3>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0A0A0F] dark:text-zinc-250">
                      Waiter Verification
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium leading-relaxed">
                      Require approval before client can place orders.
                    </p>
                  </div>
                  <button
                    onClick={toggleWaiterApproval}
                    className="shrink-0 cursor-pointer text-zinc-300 dark:text-zinc-700"
                  >
                    {shop.qrOrderingConfig?.requireWaiterApproval ? (
                      <ToggleRight size={24} className="text-[#FF6A00]" />
                    ) : (
                      <ToggleLeft size={24} className="text-current" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Layout Column Controls (Only in map mode) */}
            {viewMode === "map" && (
              <div className="bg-white dark:bg-zinc-900 border border-black/[0.05] dark:border-zinc-800 rounded-md p-4 shadow-2xs">
                <h3 className="text-[12px] font-bold text-[#0A0A0F] dark:text-zinc-200 mb-3 uppercase tracking-wider">
                  Layout Grid Cols
                </h3>
                <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 border border-black/[0.06] dark:border-zinc-850 p-1 rounded-md">
                  {[3, 4, 5, 6, 8].map((c) => (
                    <button
                      key={c}
                      onClick={() => setGridCols(c)}
                      className={`flex-1 h-7.5 rounded-md font-bold text-xs transition-all cursor-pointer flex items-center justify-center ${
                        gridCols === c
                          ? "bg-[#0A0A0F] dark:bg-zinc-800 text-white dark:text-zinc-100 shadow-2xs"
                          : "text-zinc-400 dark:text-zinc-500 hover:text-[#0A0A0F] dark:hover:text-zinc-300"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Legend Card */}
            <div className="bg-white dark:bg-zinc-900 border border-black/[0.05] dark:border-zinc-800 rounded-md p-4 shadow-2xs">
              <h3 className="text-[12px] font-bold text-[#0A0A0F] dark:text-zinc-200 mb-3 uppercase tracking-wider">
                Seating Legend
              </h3>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-[#0A0A0F]/70 dark:text-zinc-400">
                <div className="flex items-center gap-1.5 p-1.5 bg-zinc-50 dark:bg-zinc-950 rounded-md border border-black/[0.02] dark:border-zinc-850">
                  <div className="w-2 h-2 rounded-full border border-black/10 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
                  <span>Empty</span>
                </div>
                <div className="flex items-center gap-1.5 p-1.5 bg-zinc-50 dark:bg-zinc-955 rounded-md border border-black/[0.02] dark:border-zinc-850">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Active</span>
                </div>
                <div className="flex items-center gap-1.5 p-1.5 bg-zinc-50 dark:bg-zinc-955 rounded-md border border-black/[0.02] dark:border-zinc-850">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Pending</span>
                </div>
                <div className="flex items-center gap-1.5 p-1.5 bg-zinc-50 dark:bg-zinc-955 rounded-md border border-black/[0.02] dark:border-zinc-850">
                  <div className="w-2 h-2 rounded-full bg-orange-400" />
                  <span>Merged</span>
                </div>
              </div>
            </div>

            {/* Embedded Add Table Card */}
            <div className="bg-white dark:bg-zinc-900 border border-black/[0.05] dark:border-zinc-800 rounded-md p-4 shadow-2xs">
              <h3 className="text-[12px] font-bold text-[#0A0A0F] dark:text-zinc-200 mb-3 uppercase tracking-wider">
                Add New Table
              </h3>
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Table Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Table 1, VIP"
                    value={addForm.name}
                    onChange={(e) =>
                      setAddForm({ ...addForm, name: e.target.value })
                    }
                    className="w-full h-8.5 px-2.5 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-955 text-[12px] font-medium outline-none focus:border-[#FF6A00]/40 focus:bg-white dark:focus:bg-zinc-900 text-[#0A0A0F] dark:text-zinc-200 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={addForm.capacity}
                    onChange={(e) =>
                      setAddForm({ ...addForm, capacity: e.target.value })
                    }
                    className="w-full h-8.5 px-2.5 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-955 text-[12px] font-medium outline-none focus:border-[#FF6A00]/40 focus:bg-white dark:focus:bg-zinc-900 text-[#0A0A0F] dark:text-zinc-200 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Shape
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAddForm({ ...addForm, shape: "round" })}
                      className={`flex-1 h-7.5 rounded-md border text-[11px] font-bold transition-all cursor-pointer ${
                        addForm.shape === "round"
                          ? "bg-[#0A0A0F] dark:bg-zinc-800 border-[#0A0A0F] dark:border-zinc-700 text-white dark:text-zinc-100 shadow-2xs"
                          : "bg-zinc-50 dark:bg-zinc-955 border-black/[0.06] dark:border-zinc-800 text-[#0A0A0F]/65 dark:text-zinc-400 hover:border-black/20 dark:hover:border-zinc-700"
                      }`}
                    >
                      Round
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAddForm({ ...addForm, shape: "rectangle" })
                      }
                      className={`flex-1 h-7.5 rounded-md border text-[11px] font-bold transition-all cursor-pointer ${
                        addForm.shape === "rectangle"
                          ? "bg-[#0A0A0F] dark:bg-zinc-800 border-[#0A0A0F] dark:border-zinc-700 text-white dark:text-zinc-100 shadow-2xs"
                          : "bg-zinc-50 dark:bg-zinc-955 border-black/[0.06] dark:border-zinc-800 text-[#0A0A0F]/65 dark:text-zinc-400 hover:border-black/20 dark:hover:border-zinc-700"
                      }`}
                    >
                      Rectangle
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Booking Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 for free"
                    value={addForm.bookingPrice}
                    onChange={(e) =>
                      setAddForm({ ...addForm, bookingPrice: e.target.value })
                    }
                    className="w-full h-8.5 px-2.5 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-955 text-[12px] font-medium outline-none focus:border-[#FF6A00]/40 focus:bg-white dark:focus:bg-zinc-900 text-[#0A0A0F] dark:text-zinc-200 transition-all"
                  />
                </div>
                <Button
                  variant="dark"
                  icon={Plus}
                  className="w-full h-8.5 text-[12px] font-bold mt-2"
                  onClick={handleAddTable}
                  disabled={adding || !addForm.name.trim()}
                >
                  {adding ? "Adding..." : "Add Table"}
                </Button>
              </div>
            </div>

            {/* Session History Panel */}
            <div className="bg-white dark:bg-zinc-900 border border-black/[0.05] dark:border-zinc-800 rounded-md shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-black/[0.04] dark:border-zinc-800 flex items-center justify-between gap-3">
                <h3 className="text-[12px] font-bold text-[#0A0A0F] dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={12} className="text-[#FF6A00]" />
                  Session History
                </h3>
                <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-950 border border-black/[0.04] dark:border-zinc-850 px-1.5 py-0.5 rounded">
                  {
                    sessions.filter(
                      (s) => s.status === "closed" || s.status === "rejected",
                    ).length
                  }{" "}
                  records
                </span>
              </div>

              <div className="p-3 border-b border-black/[0.04] dark:border-zinc-800">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-zinc-400">
                    <ChevronRight size={11} className="rotate-90" />
                  </span>
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Search customer or table..."
                    className="w-full h-7.5 pl-6 pr-2.5 rounded border border-black/[0.08] dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-955 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#FF6A00] focus:bg-white dark:focus:bg-zinc-900"
                  />
                </div>
              </div>

              {(() => {
                const pastSessions = sessions
                  .filter(
                    (s) => s.status === "closed" || s.status === "rejected",
                  )
                  .sort(
                    (a, b) =>
                      (b.closedAt || b.createdAt || 0) -
                      (a.closedAt || a.createdAt || 0),
                  );

                const filteredPast = pastSessions.filter((s) => {
                  const query = historySearchQuery.trim().toLowerCase();
                  if (!query) return true;
                  return (
                    (s.customerName || "").toLowerCase().includes(query) ||
                    (s.tableName || "").toLowerCase().includes(query)
                  );
                });

                if (filteredPast.length === 0) {
                  return (
                    <div className="p-6 text-center">
                      <Clock
                        size={24}
                        className="mx-auto text-zinc-250 dark:text-zinc-700 mb-2"
                      />
                      <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-550">
                        No past sessions
                      </p>
                      <p className="text-[9.5px] text-zinc-350 dark:text-zinc-500 mt-0.5 leading-relaxed">
                        Completed dining sessions will appear here.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-black/[0.04] dark:divide-zinc-800 max-h-[420px] overflow-y-auto">
                    {filteredPast.map((sess) => {
                      const isExpanded = expandedHistorySessionId === sess.id;
                      const dateStr = sess.closedAt
                        ? new Date(sess.closedAt).toLocaleString("en-IN", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : sess.createdAt
                          ? new Date(sess.createdAt).toLocaleString("en-IN", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—";
                      return (
                        <div key={sess.id}>
                          <div
                            onClick={() =>
                              setExpandedHistorySessionId(
                                isExpanded ? null : sess.id,
                              )
                            }
                            className="px-3.5 py-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-extrabold text-zinc-800 dark:text-zinc-200">
                                  {sess.tableName}
                                </span>
                                <span
                                  className={`text-[8px] font-black uppercase px-1 py-0.5 rounded tracking-wider ${
                                    sess.status === "closed"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  }`}
                                >
                                  {sess.status === "closed"
                                    ? "Paid"
                                    : "Rejected"}
                                </span>
                              </div>
                              <p className="text-[9.5px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5 truncate">
                                {getGuestNames(sess)} · {dateStr}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {sess.status === "closed" && (
                                <div className="text-right">
                                  <p className="text-[11px] font-black text-[#FF6A00]">
                                    {sess.billAmount !== undefined
                                      ? `₹${sess.billAmount}`
                                      : "—"}
                                  </p>
                                  <p className="text-[8.5px] text-zinc-400 font-bold uppercase">
                                    {sess.paymentMethod || "Cash"}
                                  </p>
                                </div>
                              )}
                              <ChevronDown
                                size={13}
                                className={`text-zinc-350 dark:text-zinc-600 transition-transform duration-200 ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-3.5 pb-3.5 pt-0 bg-zinc-50/60 dark:bg-zinc-950/30 space-y-2.5 border-t border-black/[0.03] dark:border-zinc-850">
                              <div className="grid grid-cols-2 gap-2 text-[10px] pt-2.5">
                                <div>
                                  <span className="text-[8.5px] font-bold text-zinc-400 uppercase tracking-wider block">
                                    Waiter
                                  </span>
                                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                    {sess.collectedBy || "Unknown"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[8.5px] font-bold text-zinc-400 uppercase tracking-wider block">
                                    Payment
                                  </span>
                                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                    {sess.paymentMethod || "Cash"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[8.5px] font-bold text-zinc-400 uppercase tracking-wider block">
                                    Customer
                                  </span>
                                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate block">
                                    {getGuestNames(sess)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[8.5px] font-bold text-zinc-400 uppercase tracking-wider block">
                                    Phone
                                  </span>
                                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 font-mono">
                                    {getGuestPhones(sess) || "—"}
                                  </span>
                                </div>
                              </div>
                              {sess.items && sess.items.length > 0 && (
                                <div className="space-y-1 pt-1.5 border-t border-black/[0.04] dark:border-zinc-800">
                                  <p className="text-[8.5px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                                    Items ({sess.items.length})
                                  </p>
                                  {sess.items.map((it: any, itIdx: number) => (
                                    <div
                                      key={itIdx}
                                      className="flex justify-between text-[10px]"
                                    >
                                      <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                                        <span className="font-bold text-zinc-400 mr-0.5">
                                          {it.qty || it.quantity}×
                                        </span>{" "}
                                        {it.name}
                                      </span>
                                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                        ₹
                                        {(it.qty || it.quantity) *
                                          (it.price || 0)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right Column: Tables Chart (Seating Floor Map or Grid) */}
          <div className="lg:col-span-3 order-first lg:order-last">
            {/* Tables Display */}
            {tables.length === 0 ? (
              <div className="py-24 text-center bg-white dark:bg-zinc-900 rounded-md border border-dashed border-black/[0.1] dark:border-zinc-800">
                <Table2
                  size={40}
                  className="mx-auto text-[#0A0A0F]/10 dark:text-zinc-700 mb-4"
                />
                <h3 className="text-[15px] font-bold text-[#0A0A0F] dark:text-zinc-200 mb-1">
                  No tables yet
                </h3>
                <p className="text-[13px] text-[#0A0A0F]/40 dark:text-zinc-550 font-medium mb-6">
                  Add your first table in the settings panel to generate a QR
                  code for it.
                </p>
              </div>
            ) : viewMode === "map" ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Visual Floor Layout */}
                <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-black/[0.06] dark:border-zinc-800 rounded-md relative overflow-hidden min-h-[440px] sm:min-h-[480px] flex items-center justify-center shadow-inner select-none p-4 sm:p-6">
                  {/* Floor grid design pattern */}
                  <div className="absolute inset-0 bg-[radial-gradient(#0a0a0f/[0.03]_1.5px,transparent_1.5px)] [background-size:24px_24px] pointer-events-none" />

                  {/* Tables placement container with horizontal scroll support */}
                  <div className="w-full overflow-x-auto py-8 flex justify-center custom-scrollbar">
                    <div
                      className="grid gap-x-6 gap-y-10 justify-items-center relative z-10 p-6"
                      style={{
                        gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                        minWidth: `${gridCols * 110}px`,
                        maxWidth: `${gridCols * 130}px`,
                      }}
                    >
                      {(() => {
                        // Group tables by their root table ID
                        const groupsMap: { [rootId: string]: any[] } = {};
                        tables.forEach((t) => {
                          const rootId = t.mergedInto || t.id;
                          if (!groupsMap[rootId]) {
                            groupsMap[rootId] = [];
                          }
                          groupsMap[rootId].push(t);
                        });

                        // Keep original order of groups based on the appearance of their root tables
                        const orderedRootIds: string[] = [];
                        tables.forEach((t) => {
                          const rootId = t.mergedInto || t.id;
                          if (!orderedRootIds.includes(rootId)) {
                            orderedRootIds.push(rootId);
                          }
                        });

                        const tableGroups = orderedRootIds.map((rootId) => {
                          const groupTables = groupsMap[rootId];
                          // Sort group tables: parent (one without mergedInto) first, then children
                          groupTables.sort((a, b) => {
                            if (!a.mergedInto) return -1;
                            if (!b.mergedInto) return 1;
                            return a.name.localeCompare(b.name);
                          });
                          return {
                            id: rootId,
                            tables: groupTables,
                          };
                        });

                        return tableGroups.map((group) => {
                          const isGroupMerged = group.tables.length > 1;
                          const spanCols = Math.min(
                            group.tables.length,
                            gridCols,
                          );

                          // Find sessions for all tables in this group
                          const groupTableIds = group.tables.map((t) => t.id);
                          const groupSessions = sessions.filter(
                            (s) =>
                              groupTableIds.includes(s.tableId) &&
                              (s.status === "active" || s.status === "pending"),
                          );
                          const isGroupActive = groupSessions.length > 0;
                          const isGroupPending = groupSessions.some(
                            (s) => s.status === "pending",
                          );

                          const groupActiveSessions = groupSessions.filter(
                            (s) => s.status === "active",
                          );
                          const groupPendingSessions = groupSessions.filter(
                            (s) => s.status === "pending",
                          );
                          const groupActiveGuestCount =
                            groupActiveSessions.reduce(
                              (sum, s) =>
                                sum + (s.guestCount ? Number(s.guestCount) : 1),
                              0,
                            );
                          const groupPendingGuestCount =
                            groupPendingSessions.reduce(
                              (sum, s) =>
                                sum + (s.guestCount ? Number(s.guestCount) : 1),
                              0,
                            );
                          const groupTotalGuestCount =
                            groupActiveGuestCount + groupPendingGuestCount;
                          const groupCapacity = group.tables.reduce(
                            (sum, t) => sum + t.capacity,
                            0,
                          );

                          let remainingActive = groupActiveGuestCount;
                          let remainingPending = groupPendingGuestCount;

                          return (
                            <div
                              key={group.id}
                              className={`relative flex items-center justify-center gap-6 p-4.5 transition-all duration-300 ${
                                isGroupMerged
                                  ? "border border-dashed border-orange-400 bg-orange-500/[0.01] rounded-2xl shadow-xs"
                                  : ""
                              }`}
                              style={{
                                gridColumn: `span ${spanCols}`,
                              }}
                            >
                              {/* Group badge at top left */}
                              {isGroupMerged && (
                                <span className="absolute -top-2 left-3 bg-orange-500 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider shadow-xs z-20 select-none">
                                  Merged
                                </span>
                              )}

                              {group.tables.map((table, idx) => {
                                // Distribute guest count to this table
                                const tableActiveCount = Math.min(
                                  remainingActive,
                                  table.capacity,
                                );
                                remainingActive -= tableActiveCount;

                                const tablePendingCount = Math.min(
                                  remainingPending,
                                  table.capacity - tableActiveCount,
                                );
                                remainingPending -= tablePendingCount;

                                const totalGuestCount =
                                  tableActiveCount + tablePendingCount;

                                // Individual table session filter
                                const tableSessions = sessions.filter(
                                  (s) =>
                                    s.tableId === table.id &&
                                    (s.status === "active" ||
                                      s.status === "pending"),
                                );
                                const isActive = tableSessions.length > 0;
                                const isPending = tableSessions.some(
                                  (s) => s.status === "pending",
                                );

                                const isMerged = !!table.mergedInto;
                                const targetTable = isMerged
                                  ? tables.find(
                                      (t) => t.id === table.mergedInto,
                                    )
                                  : null;
                                const mergedSources = tables.filter(
                                  (t) => t.mergedInto === table.id,
                                );

                                return (
                                  <div
                                    key={table.id}
                                    className="relative w-24 h-24 flex items-center justify-center group"
                                  >
                                    {/* Chairs placed absolute around the table shape */}
                                    <ChairsRenderer
                                      capacity={table.capacity}
                                      shape={table.shape}
                                      activeCount={tableActiveCount}
                                      pendingCount={tablePendingCount}
                                    />

                                    {/* Main Table shape */}
                                    <button
                                      onClick={() =>
                                        setSelectedTableId(table.id)
                                      }
                                      className={`absolute flex flex-col items-center justify-center shadow-xs transition-all duration-200 active:scale-95 hover:scale-105 z-10 cursor-pointer ${
                                        table.shape === "round" ||
                                        (!table.shape && table.capacity <= 4)
                                          ? "w-[56px] h-[56px] rounded-full"
                                          : "w-[68px] h-[48px] rounded-md"
                                      } ${
                                        isPending
                                          ? "bg-amber-50/80 border border-amber-400 text-amber-900 shadow-xs"
                                          : isActive
                                            ? "bg-emerald-50/80 border border-emerald-500 text-emerald-955 shadow-xs"
                                            : isMerged
                                              ? "bg-orange-50/80 border border-orange-400 text-orange-955 shadow-xs"
                                              : "bg-white border border-black/[0.08] hover:border-black/30 text-[#0A0A0F]"
                                      }`}
                                    >
                                      {/* Table Label */}
                                      <span className="text-[11px] font-black tracking-tight">
                                        {table.name}
                                      </span>

                                      {/* Sub details */}
                                      {isMerged ? (
                                        <span className="text-[7px] font-bold text-orange-550 bg-orange-100/60 px-1 py-0.2 rounded mt-0.5 uppercase tracking-wide">
                                          → {targetTable?.name || "Target"}
                                        </span>
                                      ) : mergedSources.length > 0 ? (
                                        <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                          <span className="text-[6.5px] font-bold text-orange-600 bg-orange-50 px-1 py-0.2 rounded uppercase tracking-wide border border-orange-100/40">
                                            🔗 +
                                            {mergedSources
                                              .map((s) => s.name)
                                              .join(",")}
                                          </span>
                                          {isGroupActive && (
                                            <span
                                              className={`text-[6.5px] font-bold px-1 py-0.2 rounded uppercase tracking-wide ${isGroupPending ? "text-amber-600 bg-amber-100/60" : "text-emerald-600 bg-emerald-100/60"}`}
                                            >
                                              👤 {groupTotalGuestCount}/
                                              {groupCapacity}
                                            </span>
                                          )}
                                        </div>
                                      ) : isPending ? (
                                        <span className="text-[7px] font-bold text-amber-600 bg-amber-100/60 px-1 py-0.2 rounded mt-0.5 uppercase tracking-wide animate-pulse">
                                          Pending ({totalGuestCount})
                                        </span>
                                      ) : isActive ? (
                                        <span className="text-[7px] font-bold text-emerald-600 bg-emerald-100/60 px-1 py-0.2 rounded mt-0.5 uppercase tracking-wide">
                                          👤 {totalGuestCount}/{table.capacity}
                                        </span>
                                      ) : (
                                        <div className="flex flex-col items-center">
                                          <span className="text-[8.5px] text-[#0A0A0F]/30 font-bold uppercase mt-0.5">
                                            {table.capacity}p
                                          </span>
                                          {table.bookingPrice > 0 && (
                                            <span className="text-[8px] font-black text-[#FF6A00] mt-0.5 leading-none">
                                              ₹{table.bookingPrice}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </button>

                                    {/* Tooltip / Quick action indicator on hover */}
                                    <div className="absolute bottom-[-24px] bg-[#0A0A0F] text-white text-[9px] font-bold py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-sm uppercase tracking-wider">
                                      Manage Table
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in duration-200">
                {tables.map((table) => {
                  const tableSessions = sessions.filter(
                    (s) =>
                      s.tableId === table.id &&
                      (s.status === "active" || s.status === "pending"),
                  );
                  const isActive = tableSessions.length > 0;
                  const tableUrl = getTableQrUrl(table.id);
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(tableUrl)}&color=0A0A0F&bgcolor=FFFFFF`;
                  const targetMergeTable = table.mergedInto
                    ? tables.find((t) => t.id === table.mergedInto)
                    : null;
                  return (
                    <Card
                      key={table.id}
                      padding={false}
                      className="overflow-hidden bg-white border border-black/[0.06] rounded-md hover:shadow-md transition-all"
                    >
                      {/* Status bar */}
                      <div
                        className={`h-1 w-full ${isActive ? "bg-emerald-500" : "bg-black/[0.05]"}`}
                      />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className="cursor-pointer font-bold"
                            onClick={() => setSelectedTableId(table.id)}
                          >
                            <h3 className="text-[15px] font-bold text-[#0A0A0F] tracking-tight flex items-center gap-1.5 flex-wrap hover:text-[#FF6A00] transition-colors">
                              <span>{table.name}</span>
                              {targetMergeTable && (
                                <span className="text-[9px] font-bold text-orange-500 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                  → {targetMergeTable.name}
                                </span>
                              )}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-[#0A0A0F]/45 font-medium flex items-center gap-1">
                                <Users size={10} />{" "}
                                {isActive
                                  ? `${tableSessions.reduce((sum, s) => sum + (s.guestCount ? Number(s.guestCount) : 1), 0)} / ${table.capacity} occupied`
                                  : `${table.capacity} seats`}
                              </span>
                              {table.bookingPrice > 0 && (
                                <span className="text-[10px] text-[#FF6A00] font-black bg-orange-50 dark:bg-orange-950/20 border border-orange-100/30 px-1.5 py-0.2 rounded">
                                  ₹{table.bookingPrice}
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${isActive ? (tableSessions.some((s) => s.status === "pending") ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100") : "bg-zinc-50 text-zinc-400 border border-zinc-100"}`}
                              >
                                {isActive
                                  ? tableSessions.some(
                                      (s) => s.status === "pending",
                                    )
                                    ? "Pending"
                                    : "Active"
                                  : "Empty"}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => setPendingDeleteTable(table)}
                            disabled={deletingId === table.id || isActive}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-[#0A0A0F]/20 hover:text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title={
                              isActive
                                ? "Close active sessions first"
                                : "Delete table"
                            }
                          >
                            {deletingId === table.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </div>

                        {/* QR Preview */}
                        <div
                          className="flex items-center gap-3 p-3 bg-zinc-50 rounded-md border border-black/[0.04] mb-3 cursor-pointer"
                          onClick={() => setSelectedTableId(table.id)}
                        >
                          <div className="w-16 h-16 rounded-md overflow-hidden border border-black/[0.06] bg-white flex-shrink-0">
                            <img
                              src={qrUrl}
                              alt="QR"
                              className="w-full h-full"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-[#0A0A0F]/30 uppercase tracking-widest mb-0.5">
                              Scan URL
                            </p>
                            <p className="text-[10px] text-[#0A0A0F]/50 font-medium truncate">
                              {tableUrl}
                            </p>
                          </div>
                        </div>

                        {/* Active Sessions List */}
                        {tableSessions.length > 0 && (
                          <div className="mb-3 space-y-1.5 border-t border-black/[0.05] pt-3">
                            <p className="text-[9px] font-bold text-[#0A0A0F]/30 uppercase tracking-widest">
                              Active Customers ({tableSessions.length})
                            </p>
                            <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                              {tableSessions.map((session) => (
                                <div
                                  key={session.id}
                                  className="flex items-center justify-between gap-2 p-1.5 bg-zinc-50 border border-black/[0.03] rounded-md text-[11px] font-semibold text-[#0A0A0F]"
                                >
                                  <div
                                    className="min-w-0 cursor-pointer"
                                    onClick={() => setSelectedTableId(table.id)}
                                  >
                                    <p className="truncate hover:text-[#FF6A00] transition-colors">
                                      {getGuestNames(session)}
                                      {session.status === "pending" && (
                                        <span className="text-amber-500 text-[9px] ml-1 uppercase font-black tracking-wider">
                                          pending
                                        </span>
                                      )}
                                    </p>
                                    {getGuestPhones(session) && (
                                      <p className="text-[9px] text-[#0A0A0F]/45 font-medium">
                                        📞 {getGuestPhones(session)}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() =>
                                      handleForceCloseSession(session)
                                    }
                                    className="h-6 px-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100 font-bold text-[9px] transition-all shrink-0 cursor-pointer"
                                  >
                                    Close
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedTableId(table.id)}
                            className="flex-1 h-8 rounded-md bg-[#0A0A0F] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#0A0A0F]/80 transition-all cursor-pointer"
                          >
                            <Table2 size={12} /> Details
                          </button>
                          {!table.mergedInto ? (
                            <button
                              onClick={() => setPendingMergeTable(table)}
                              className="px-2.5 h-8 rounded-md border border-black/[0.08] bg-white text-[#0A0A0F]/65 hover:text-[#0A0A0F] hover:bg-black/[0.02] text-[11px] font-bold transition-all cursor-pointer"
                              title="Merge this table into another table"
                            >
                              Merge
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnmergeTable(table)}
                              className="px-2.5 h-8 rounded-md border border-orange-200 bg-orange-50 text-orange-600 text-[11px] font-bold hover:bg-orange-100 transition-all cursor-pointer"
                              title={`Merged into ${targetMergeTable?.name || "another table"}. Click to unmerge.`}
                            >
                              Unmerge
                            </button>
                          )}

                          <button
                            onClick={() => handlePrint(table.id, table.name)}
                            className="w-8 h-8 rounded-md border border-black/[0.08] bg-white text-[#0A0A0F]/50 hover:text-[#0A0A0F] hover:bg-black/[0.03] flex items-center justify-center transition-all cursor-pointer"
                            title="Print QR"
                          >
                            <Printer size={13} />
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Full View Dialog */}
      {showQrDialog && (
        <Dialog
          isOpen={!!showQrDialog}
          onClose={() => setShowQrDialog(null)}
          title={showQrDialog.name}
          subtitle="Scan to open ordering page"
          maxWidth="max-w-[320px]"
        >
          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="p-4 bg-white rounded-md border border-black/[0.08] shadow-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(getTableQrUrl(showQrDialog.id))}&color=0A0A0F&bgcolor=FFFFFF`}
                alt="QR Code"
                className="w-[240px] h-[240px]"
              />
            </div>
            <p className="text-[11px] text-[#0A0A0F]/40 font-medium text-center px-2 break-all">
              {getTableQrUrl(showQrDialog.id)}
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => handleCopyUrl(showQrDialog.id)}
                className="flex-1 h-9 rounded-md border border-black/[0.08] bg-white text-[12px] font-bold text-[#0A0A0F]/60 hover:text-[#0A0A0F] flex items-center justify-center gap-1.5 transition-all"
              >
                {copied ? (
                  <Check size={13} className="text-emerald-500" />
                ) : (
                  <Copy size={13} />
                )}
                {copied ? "Copied!" : "Copy URL"}
              </button>
              <button
                onClick={() => handlePrint(showQrDialog.id, showQrDialog.name)}
                className="flex-1 h-9 rounded-md bg-[#0A0A0F] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#0A0A0F]/80 transition-all"
              >
                <Printer size={13} /> Print QR
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete Table Confirmation Dialog */}
      <Dialog
        isOpen={!!pendingDeleteTable}
        onClose={() => setPendingDeleteTable(null)}
        title="Delete Table"
        subtitle="Are you sure you want to delete this table?"
        maxWidth="max-w-[400px]"
      >
        <div className="pt-2 space-y-4">
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-300 font-medium">
            This will permanently delete &ldquo;{pendingDeleteTable?.name}
            &rdquo; and disable its QR code. This action cannot be undone.
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="flex-1 h-9"
              onClick={() => setPendingDeleteTable(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1 h-9"
              onClick={handleDeleteTable}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Merge Table Dialog */}
      <Dialog
        isOpen={!!pendingMergeTable}
        onClose={() => {
          setPendingMergeTable(null);
          setMergeTargetId("");
        }}
        title={`Merge ${pendingMergeTable?.name}`}
        subtitle="Select the target table to merge this table into"
        maxWidth="max-w-[400px]"
      >
        <div className="pt-2 space-y-4">
          <div className="rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-500/10 px-4 py-3 text-xs text-orange-700 dark:text-orange-300 font-medium">
            Merging will point &ldquo;{pendingMergeTable?.name}&rdquo;&apos;s QR
            code to the target table&apos;s active session. Both tables will
            order and pay under a single shared session.
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#0A0A0F]/45 uppercase tracking-widest">
              Select Target Table
            </label>
            <select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-black/[0.08] bg-zinc-50 text-[13px] font-medium outline-none focus:border-[#FF6A00]/40 transition-all cursor-pointer"
            >
              <option value="">-- Choose Table --</option>
              {tables
                .filter((t) => t.id !== pendingMergeTable?.id && !t.mergedInto)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{" "}
                    {sessions.some(
                      (s) =>
                        s.tableId === t.id &&
                        (s.status === "active" || s.status === "pending"),
                    )
                      ? "(Active)"
                      : "(Empty)"}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="flex-1 h-9"
              onClick={() => {
                setPendingMergeTable(null);
                setMergeTargetId("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="dark"
              className="flex-1 h-9"
              disabled={!mergeTargetId}
              onClick={handleMergeTables}
            >
              Confirm Merge
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Table Detail Dialog */}
      {selectedTableId &&
        (() => {
          const detailTable = tables.find((t) => t.id === selectedTableId);
          if (!detailTable) return null;

          // Resolve group leader
          const targetTableId = detailTable.mergedInto || detailTable.id;
          const targetTable =
            tables.find((t) => t.id === targetTableId) || detailTable;
          const groupTables = tables.filter(
            (t) => (t.mergedInto || t.id) === targetTableId,
          );
          const sortedGroupTables = [...groupTables].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, {
              numeric: true,
              sensitivity: "base",
            }),
          );

          const groupSessions = sessions.filter(
            (s) =>
              groupTables.some((gt) => gt.id === s.tableId) &&
              (s.status === "active" || s.status === "pending"),
          );
          const targetMergeTable = detailTable.mergedInto
            ? tables.find((t) => t.id === detailTable.mergedInto)
            : null;
          const tableUrl = getTableQrUrl(detailTable.id);
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(tableUrl)}&color=0A0A0F&bgcolor=FFFFFF`;

          const displayedOrders =
            activeSessionTab === "all"
              ? activeOrders
              : activeOrders.filter(
                  (order) => order.sessionId === activeSessionTab,
                );

          const runningTotal = displayedOrders.reduce((sum, order) => {
            if (order.status === "cancelled") return sum;
            const orderSum =
              order.items?.reduce(
                (oSum, item) =>
                  oSum + parseFloat(item.price) * parseInt(item.qty || 1),
                0,
              ) || 0;
            return sum + orderSum;
          }, 0);

          const joinedNames = sortedGroupTables.map((t) => t.name).join(" + ");

          return (
            <Dialog
              isOpen={!!selectedTableId}
              onClose={() => setSelectedTableId(null)}
              title={
                isEditingTable
                  ? `Edit Table: ${detailTable.name}`
                  : groupTables.length > 1
                    ? `${joinedNames} Details`
                    : `${detailTable.name} Details`
              }
              subtitle={
                isEditingTable
                  ? "Update table configuration including shape, capacity, and booking price."
                  : groupTables.length > 1
                    ? `${groupTables.reduce((acc, t) => acc + t.capacity, 0)} Seats Total (${groupSessions.reduce((sum, s) => sum + (s.guestCount ? Number(s.guestCount) : 1), 0)} occupied) · ${
                        groupSessions.length > 0
                          ? groupSessions.some((s) => s.status === "pending")
                            ? "Pending Approval"
                            : "Active Session"
                          : "Empty"
                      }`
                    : `${detailTable.capacity} Seats (${groupSessions.reduce((sum, s) => sum + (s.guestCount ? Number(s.guestCount) : 1), 0)} occupied) · ${detailTable.bookingPrice ? `₹${detailTable.bookingPrice} Booking Price` : "Free Booking"} · ${
                        groupSessions.length > 0
                          ? groupSessions.some((s) => s.status === "pending")
                            ? "Pending Approval"
                            : "Active Session"
                          : "Empty"
                      }`
              }
              maxWidth="max-w-3xl"
            >
              {isEditingTable ? (
                <div className="space-y-4 pt-1 text-left animate-in fade-in duration-200">
                  <div className="bg-white dark:bg-zinc-900 border border-black/[0.05] dark:border-zinc-800 rounded-md p-4 space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider">
                        Table Name
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                        className="w-full h-8.5 px-2.5 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-955 text-xs font-medium outline-none focus:border-[#FF6A00]/40 focus:bg-white dark:focus:bg-zinc-900 text-[#0A0A0F] dark:text-zinc-200 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-555 uppercase tracking-wider">
                        Capacity (Seats)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={editForm.capacity}
                        onChange={(e) =>
                          setEditForm({ ...editForm, capacity: e.target.value })
                        }
                        className="w-full h-8.5 px-2.5 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-955 text-xs font-medium outline-none focus:border-[#FF6A00]/40 focus:bg-white dark:focus:bg-zinc-900 text-[#0A0A0F] dark:text-zinc-200 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-555 uppercase tracking-wider font-semibold block mb-1">
                        Shape
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm({ ...editForm, shape: "round" })
                          }
                          className={`flex-1 h-8 rounded-md border text-xs font-bold transition-all cursor-pointer ${
                            editForm.shape === "round"
                              ? "bg-[#0A0A0F] dark:bg-zinc-800 border-[#0A0A0F] dark:border-zinc-700 text-white dark:text-zinc-100 shadow-2xs"
                              : "bg-zinc-50 dark:bg-zinc-955 border border-black/[0.06] dark:border-zinc-800 text-[#0A0A0F]/65 dark:text-zinc-400 hover:border-black/20"
                          }`}
                        >
                          Round
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm({ ...editForm, shape: "rectangle" })
                          }
                          className={`flex-1 h-8 rounded-md border text-xs font-bold transition-all cursor-pointer ${
                            editForm.shape === "rectangle"
                              ? "bg-[#0A0A0F] dark:bg-zinc-800 border-[#0A0A0F] dark:border-zinc-700 text-white dark:text-zinc-100 shadow-2xs"
                              : "bg-zinc-50 dark:bg-zinc-955 border border-black/[0.06] dark:border-zinc-800 text-[#0A0A0F]/65 dark:text-zinc-400 hover:border-black/20"
                          }`}
                        >
                          Rectangle
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-555 uppercase tracking-wider">
                        Booking Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.bookingPrice}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            bookingPrice: e.target.value,
                          })
                        }
                        className="w-full h-8.5 px-2.5 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-955 text-xs font-medium outline-none focus:border-[#FF6A00]/40 focus:bg-white dark:focus:bg-zinc-900 text-[#0A0A0F] dark:text-zinc-200 transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-black/[0.05] dark:border-zinc-800 flex justify-end gap-2.5">
                    <Button
                      variant="outline"
                      className="h-9 px-4 text-xs font-bold"
                      onClick={() => setIsEditingTable(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="dark"
                      className="h-9 px-6 text-xs font-bold shadow-sm"
                      onClick={handleSaveTableEdit}
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-1 text-left animate-in fade-in duration-200">
                  {/* Top Section: Table Meta & Actions (Merge, QR Code) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Table Merge Control */}
                    {detailTable.mergedInto ? (
                      <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-md p-3 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-md bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                          <Table2 size={15} />
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div>
                            <h4 className="text-xs font-bold text-orange-950 dark:text-orange-200">
                              Merged Table
                            </h4>
                            <p className="text-[11px] text-orange-700 dark:text-orange-400 font-medium">
                              This table is merged into{" "}
                              <span className="font-bold">
                                {targetTable?.name || "another table"}
                              </span>
                              .
                            </p>
                          </div>
                          <button
                            onClick={() => handleUnmergeTable(detailTable)}
                            className="px-2.5 py-1 rounded bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/50 dark:hover:bg-orange-900/80 text-orange-800 dark:text-orange-200 text-[10px] font-bold transition-all cursor-pointer"
                          >
                            Unmerge Table
                          </button>
                        </div>
                      </div>
                    ) : groupTables.length > 1 ? (
                      /* Merged Tables List Card */
                      <div className="bg-zinc-50 dark:bg-zinc-900 border border-black/[0.04] dark:border-zinc-800 p-3 rounded-md space-y-2">
                        <span className="text-[10px] font-bold text-[#0A0A0F]/30 dark:text-zinc-500 uppercase tracking-widest block">
                          Merged Tables
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {sortedGroupTables
                            .filter((gt) => gt.id !== targetTableId)
                            .map((gt) => (
                              <div
                                key={gt.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-900/30 text-orange-800 dark:text-orange-350 text-[10px] font-bold transition-all hover:bg-orange-100/50"
                              >
                                <span>{gt.name}</span>
                                <button
                                  onClick={() => handleUnmergeTable(gt)}
                                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-orange-200/80 text-orange-600 hover:text-orange-950 transition-colors cursor-pointer"
                                  title={`Unmerge ${gt.name}`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                  </svg>
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-zinc-50 dark:bg-zinc-900 border border-black/[0.04] dark:border-zinc-800 p-3 rounded-md flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-[#0A0A0F] dark:text-zinc-200">
                            Merge Table
                          </h4>
                          <p className="text-[10px] text-[#0A0A0F]/40 dark:text-zinc-500 font-medium">
                            Link this table to place shared orders.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setPendingMergeTable(detailTable);
                            setSelectedTableId(null);
                          }}
                          className="px-3 h-7 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[#0A0A0F]/65 dark:text-zinc-300 hover:text-[#0A0A0F] dark:hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                        >
                          Merge Table
                        </button>
                      </div>
                    )}

                    {/* QR Panel Card */}
                    <div className="bg-zinc-50 dark:bg-zinc-900 border border-black/[0.04] dark:border-zinc-800 p-3 rounded-md flex items-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-md border border-black/[0.06] overflow-hidden p-0.5 shrink-0 flex items-center justify-center">
                        <img
                          src={qrUrl}
                          alt="QR Code"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <p className="text-[10px] text-[#0A0A0F]/50 dark:text-zinc-500 font-medium truncate">
                          {tableUrl}
                        </p>
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleCopyUrl(detailTable.id)}
                            className="px-2 py-1 rounded-md border border-black/[0.06] dark:border-zinc-750 hover:border-black/[0.12] bg-white dark:bg-zinc-800 text-[9px] font-bold text-[#0A0A0F]/60 dark:text-zinc-350 hover:text-[#0A0A0F] dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                          >
                            {copied ? (
                              <Check size={8} className="text-emerald-500" />
                            ) : (
                              <Copy size={8} />
                            )}
                            <span>Copy Link</span>
                          </button>
                          <button
                            onClick={() =>
                              handlePrint(detailTable.id, detailTable.name)
                            }
                            className="px-2 py-1 rounded-md border border-black/[0.06] dark:border-zinc-750 hover:border-black/[0.12] bg-white dark:bg-zinc-800 text-[9px] font-bold text-[#0A0A0F]/60 dark:text-zinc-350 hover:text-[#0A0A0F] dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Printer size={8} />
                            <span>Print</span>
                          </button>
                          <a
                            href={tableUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-md border border-black/[0.06] dark:border-zinc-750 hover:border-black/[0.12] bg-white dark:bg-zinc-800 text-[9px] font-bold text-[#0A0A0F]/60 dark:text-zinc-350 hover:text-[#0A0A0F] dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <ExternalLink size={8} />
                            <span>Guest View</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Section: Customer Session cards (2-Column Grid Layout, Collapsible, Single-Column inside) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-black/[0.04] dark:border-zinc-800 pb-1.5">
                      <span className="text-[10px] font-black text-[#0A0A0F]/30 dark:text-zinc-500 uppercase tracking-widest">
                        Active Customer Sessions ({groupSessions.length})
                      </span>
                    </div>

                    {groupSessions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groupSessions.map((sess) => {
                          const isSessPending = sess.status === "pending";
                          const isSessActive = sess.status === "active";
                          const isExpanded =
                            expandedSessions[sess.id] !== false;

                          // Filter orders for this session specifically
                          const sessionOrders = activeOrders.filter(
                            (order) => order.sessionId === sess.id,
                          );

                          // Calculate total for this session
                          const sessionTotal = sessionOrders.reduce(
                            (sum, order) => {
                              if (order.status === "cancelled") return sum;
                              return (
                                sum +
                                (order.items?.reduce(
                                  (oSum, item) =>
                                    oSum +
                                    parseFloat(item.price) *
                                      parseInt(item.qty || 1),
                                  0,
                                ) || 0)
                              );
                            },
                            0,
                          );

                          return (
                            <div
                              key={sess.id}
                              className="bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-zinc-800 rounded-md overflow-hidden shadow-2xs flex flex-col h-fit"
                            >
                              {/* Card Header: Clickable to Collapse, details on top */}
                              <div
                                onClick={() =>
                                  setExpandedSessions((prev) => ({
                                    ...prev,
                                    [sess.id]: !isExpanded,
                                  }))
                                }
                                className="bg-zinc-50/75 dark:bg-zinc-900/50 border-b border-black/[0.04] dark:border-zinc-800/80 px-3.5 py-2.5 flex flex-col gap-1.5 cursor-pointer select-none hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 transition-colors"
                              >
                                {/* Customer name + status + chevron */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <h4 className="text-[12.5px] font-bold text-[#0A0A0F] dark:text-zinc-100 leading-none truncate">
                                      {getGuestNames(sess)}
                                    </h4>
                                    <span
                                      className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0 ${
                                        isSessPending
                                          ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 border border-amber-100 dark:border-amber-900/30"
                                          : isSessActive
                                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-black/[0.04]"
                                      }`}
                                    >
                                      {isSessPending ? "Pending" : "Active"}
                                    </span>
                                  </div>
                                  <div className="text-zinc-400 dark:text-zinc-555 shrink-0">
                                    {isExpanded ? (
                                      <ChevronUp size={14} />
                                    ) : (
                                      <ChevronDown size={14} />
                                    )}
                                  </div>
                                </div>

                                {/* Timestamps, contact info, total bill */}
                                <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-[#0A0A0F]/50 dark:text-zinc-400">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="flex items-center gap-0.5 shrink-0">
                                      <Clock size={10} className="opacity-60" />
                                      {new Date(
                                        sess.createdAt,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                    {getGuestPhones(sess) && (
                                      <span className="truncate">
                                        📞 {getGuestPhones(sess)}
                                      </span>
                                    )}
                                    <span className="shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-455 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                      👤 {sess.guestCount || 1}{" "}
                                      {(sess.guestCount || 1) === 1
                                        ? "guest"
                                        : "guests"}
                                    </span>
                                  </div>
                                  <span className="text-[11.5px] font-black text-[#FF6A00] bg-orange-50 dark:bg-orange-950/10 border border-orange-100/50 dark:border-orange-900/20 px-2 py-0.5 rounded shrink-0">
                                    ₹{sessionTotal}
                                  </span>
                                </div>
                              </div>

                              {/* Card Body: Show only when expanded */}
                              {isExpanded && (
                                <div className="p-3 border-t border-black/[0.03] dark:border-zinc-800/50 bg-zinc-50/20 dark:bg-zinc-900/10 flex-1 flex flex-col min-h-[120px]">
                                  <div className="text-[9.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center justify-between shrink-0 mb-2">
                                    <span>Orders Feed</span>
                                    <span>
                                      {sessionOrders.length} order
                                      {sessionOrders.length !== 1
                                        ? "s"
                                        : ""}{" "}
                                      placed
                                    </span>
                                  </div>

                                  <div className="space-y-2 overflow-y-auto max-h-[200px] pr-1 custom-scrollbar flex-1">
                                    {sessionOrders.length === 0 ? (
                                      <div className="h-full flex flex-col items-center justify-center text-center py-6 px-4 space-y-1.5 my-auto">
                                        <div className="w-7 h-7 rounded-full bg-black/[0.03] dark:bg-zinc-800/80 flex items-center justify-center text-[#0A0A0F]/30 dark:text-zinc-500">
                                          <ChefHat size={13} />
                                        </div>
                                        <p className="text-[10.5px] font-bold text-[#0A0A0F]/40 dark:text-zinc-555">
                                          No orders placed yet
                                        </p>
                                      </div>
                                    ) : (
                                      sessionOrders.map((order) => (
                                        <div
                                          key={order.id}
                                          className="bg-zinc-50/75 dark:bg-zinc-900/40 border border-black/[0.03] dark:border-zinc-800/80 rounded-md p-2.5 space-y-2 text-left"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-semibold text-[#0A0A0F]/45 dark:text-zinc-455">
                                              {new Date(
                                                order.placedAt,
                                              ).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })}
                                            </span>

                                            {/* Order Status Badge */}
                                            <button
                                              onClick={() =>
                                                handleUpdateOrderStatus(
                                                  order.sessionId,
                                                  order.id,
                                                  order.status,
                                                )
                                              }
                                              className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                                                order.status === "placed"
                                                  ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30"
                                                  : order.status === "preparing"
                                                    ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30 animate-pulse"
                                                    : order.status === "served"
                                                      ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30"
                                                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-100 dark:border-zinc-700"
                                              }`}
                                              title="Click to progress order status"
                                            >
                                              {order.status}
                                            </button>
                                          </div>

                                          {/* Items List */}
                                          <div className="space-y-1">
                                            {order.items?.map((item, idx) => (
                                              <div
                                                key={idx}
                                                className="flex justify-between items-start text-[11px] font-semibold text-[#0A0A0F] dark:text-zinc-200"
                                              >
                                                <span className="truncate">
                                                  {item.qty}x {item.name}
                                                </span>
                                                <span className="text-[#0A0A0F]/50 dark:text-zinc-500 shrink-0 ml-2">
                                                  ₹
                                                  {parseFloat(item.price) *
                                                    parseInt(item.qty || 1)}
                                                </span>
                                              </div>
                                            ))}
                                          </div>

                                          {/* Order Note */}
                                          {order.note && (
                                            <div className="text-[9.5px] text-amber-700 dark:text-amber-455 bg-amber-50/50 dark:bg-amber-950/10 px-2 py-1 rounded border border-amber-100/50 dark:border-amber-900/20 font-medium">
                                              📝 {order.note}
                                            </div>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>

                                  {/* Action controls inside the card body (below orders feed) */}
                                  <div className="mt-3 pt-2.5 border-t border-black/[0.04] dark:border-zinc-800/40 flex flex-col gap-2 shrink-0">
                                    <div className="flex gap-2 w-full">
                                      {isSessPending && (
                                        <button
                                          onClick={() =>
                                            handleApproveSession(
                                              sess.id,
                                              sess.tableId,
                                            )
                                          }
                                          className="flex-1 h-8 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center"
                                        >
                                          Approve
                                        </button>
                                      )}
                                      <button
                                        onClick={() => {
                                          handleForceCloseSession(sess);
                                          setSelectedTableId(null);
                                        }}
                                        className={`flex-1 h-8 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center ${
                                          isSessPending
                                            ? "border border-black/[0.08] dark:border-zinc-700 hover:bg-black/[0.02] dark:hover:bg-zinc-800 text-[#0A0A0F]/60 dark:text-zinc-300"
                                            : "bg-red-600 text-white hover:bg-red-700 shadow-2xs w-full"
                                        }`}
                                      >
                                        {isSessPending
                                          ? "Reject Scan"
                                          : `Check Out Customer (₹${sessionTotal})`}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-zinc-50 dark:bg-zinc-900 border border-black/[0.04] dark:border-zinc-800 p-4 rounded-md text-center py-6">
                        <p className="text-xs font-semibold text-[#0A0A0F]/45 dark:text-zinc-450">
                          No active customer sessions checked in.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Dialog footer actions */}
                  <div className="pt-2 border-t border-black/[0.05] dark:border-zinc-800 flex justify-end gap-2.5">
                    {groupTables.length === 1 && (
                      <Button
                        variant="outline"
                        className="h-9 px-4 text-xs font-bold"
                        onClick={() => setIsEditingTable(true)}
                      >
                        Edit Table
                      </Button>
                    )}
                    <Button
                      variant="dark"
                      className="h-9 px-6 text-xs font-bold shadow-sm"
                      onClick={() => setSelectedTableId(null)}
                    >
                      Close Details
                    </Button>
                  </div>
                </div>
              )}
            </Dialog>
          );
        })()}
      {/* Confirmation Dialog */}
      {confirmAction && (
        <Dialog
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          title={confirmAction.title || "Confirm Action"}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {confirmAction.message}
            </p>

            {confirmAction.details && (
              <div className="bg-zinc-50 dark:bg-zinc-900 border border-black/[0.04] dark:border-zinc-800 rounded-md p-3.5 space-y-3 text-xs text-left">
                {confirmAction.details.summary && (
                  <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] dark:border-zinc-850">
                    <span className="font-bold text-zinc-400 dark:text-zinc-500 uppercase text-[9px] tracking-wider">
                      Action Details
                    </span>
                    {confirmAction.details.badge && (
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${confirmAction.details.badgeColor || "bg-zinc-100 text-zinc-650"}`}
                      >
                        {confirmAction.details.badge}
                      </span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {confirmAction.details.table && (
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                        Table
                      </span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {confirmAction.details.table}
                      </span>
                    </div>
                  )}
                  {confirmAction.details.customer && (
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                        Customer
                      </span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate block">
                        {confirmAction.details.customer}
                      </span>
                    </div>
                  )}
                </div>

                {confirmAction.details.items &&
                  confirmAction.details.items.length > 0 && (
                    <div className="pt-2 border-t border-black/[0.04] dark:border-zinc-850 space-y-1.5">
                      <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                        Order Items
                      </span>
                      <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                        {confirmAction.details.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 py-0.5"
                          >
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

      {/* Floating Exit Fullscreen Button (only needed in standalone portal mode) */}
      {isFullscreen && isPortal && (
        <button
          onClick={() => {
            if (document.exitFullscreen) {
              document.exitFullscreen().catch((err) => console.log(err));
            }
          }}
          className="fixed bottom-6 right-6 z-[9999] w-10 h-10 rounded-full bg-zinc-900/90 dark:bg-zinc-800/90 hover:bg-zinc-950 dark:hover:bg-zinc-700 text-white dark:text-zinc-100 backdrop-blur-md border border-zinc-800 dark:border-zinc-700 flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer animate-in fade-in duration-200"
          title="Exit Fullscreen"
        >
          <Minimize2 size={16} />
        </button>
      )}
    </div>
  );
}
