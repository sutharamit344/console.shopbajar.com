import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useShopOwner } from "@/hooks/useShopOwner";
import {
  listenBookings,
  listenTables,
  createSession,
  updateBooking,
  confirmBooking,
  rejectBooking,
  cancelBooking,
  seatBooking,
  createBooking,
  Booking,
} from "@/lib/rtdb";
import { updateShop, db } from "@/lib/db";
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc } from "firebase/firestore";
import {
  CalendarDays,
  IndianRupee,
  CreditCard,
  Clock,
  Users,
  Phone,
  User,
  Plus,
  Check,
  X,
  Loader2,
  ChevronRight,
  LayoutList,
  LayoutGrid,
  Filter,
  CheckCircle2,
  XCircle,
  UserX,
  Hash,
  MessageSquare,
  RefreshCcw,
  SlidersHorizontal,
  Calendar,
  Bell,
  ArrowRight,
  ChevronDown,
  Search,
  Printer,
  Table2,
  UserCheck,
  Armchair,
  Settings2,
  Save,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import Card from "@/components/UI/Card";
import Button from "@/components/UI/Button";
import Dialog from "@/components/UI/Dialog";
import { getCustomerAppUrl } from "@/lib/config";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  seated: {
    label: "Seated",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-zinc-500",
    bg: "bg-zinc-50",
    border: "border-zinc-200",
  },
  no_show: {
    label: "No Show",
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
};

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(timeStr: string) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function BookingsClient() {
  const { user } = useAuth();
  const { shop, loading: shopLoading } = useShopOwner();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [filter, setFilter] = useState<"today" | "upcoming" | "all" | "past">(
    "today",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [showSettings, setShowSettings] = useState(false);

  // Payments integration state
  const [activeTab, setActiveTab] = useState<"bookings" | "payments">("bookings");
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Booking config state (synced from shop.bookingConfig)
  const [bookingConfig, setBookingConfig] = useState({
    maxPerSlot: 5,
    maxPartySize: 10,
    slotInterval: 30,
    advanceDays: 30,
    autoConfirm: false,
    cancellationHours: 24,
    cancellationCharges: 10,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Modals
  const [confirmAction, setConfirmAction] = useState<any>(null);
  const [showNewBookingDialog, setShowNewBookingDialog] = useState(false);
  const [showSeatDialog, setShowSeatDialog] = useState<{
    booking: Booking;
  } | null>(null);
  const [selectedTableId, setSelectedTableId] = useState("");

  // New booking form
  const [newForm, setNewForm] = useState({
    customerName: "",
    customerPhone: "",
    partySize: "2",
    date: getTodayStr(),
    time: "12:00",
    notes: "",
    tablePreference: "",
  });
  const [newFormErrors, setNewFormErrors] = useState<any>({});
  const [savingNew, setSavingNew] = useState(false);

  // Listen to bookings
  useEffect(() => {
    if (!shop?.id) return;
    const unsub = listenBookings(shop.id, setBookings);
    return unsub;
  }, [shop?.id]);

  // Listen to customer payments from Firestore (Realtime DB & Firestore synchronization)
  useEffect(() => {
    if (!shop?.id) return;
    setLoadingPayments(true);
    const q = query(
      collection(db, "booking_payments"),
      where("shopId", "==", shop.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const pList: any[] = [];
      snapshot.forEach((doc) => {
        pList.push({ id: doc.id, ...doc.data() });
      });
      // Sort client-side by createdAt desc
      pList.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setPayments(pList);
      setLoadingPayments(false);
    }, (error) => {
      console.error("Error loading payments:", error);
      setLoadingPayments(false);
    });
    return unsub;
  }, [shop?.id]);

  // Listen to tables
  useEffect(() => {
    if (!shop?.id) return;
    const unsub = listenTables(shop.id, setTables);
    return unsub;
  }, [shop?.id]);

  // Sync bookingConfig from Firestore shop doc
  useEffect(() => {
    if (!shop?.bookingConfig) return;
    setBookingConfig((prev) => ({
      ...prev,
      ...shop.bookingConfig,
      cancellationHours: shop.bookingConfig.cancellationHours ?? 24,
      cancellationCharges: shop.bookingConfig.cancellationCharges ?? 10,
    }));
  }, [shop?.bookingConfig]);

  const handleSaveConfig = async () => {
    if (!shop?.id) return;
    setSavingConfig(true);
    try {
      await updateShop(shop.id, { bookingConfig });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    } finally {
      setSavingConfig(false);
    }
  };

  const today = getTodayStr();

  const filteredBookings = bookings
    .filter((b) => {
      if (filter === "today") return b.date === today;
      if (filter === "upcoming") return b.date > today;
      if (filter === "past") return b.date < today;
      return true; // all
    })
    .filter((b) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        b.customerName?.toLowerCase().includes(q) ||
        b.customerPhone?.includes(q)
      );
    })
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });

  // Stats
  const todayBookings = bookings.filter((b) => b.date === today);
  const stats = {
    todayTotal: todayBookings.length,
    pending: todayBookings.filter((b) => b.status === "pending").length,
    confirmed: todayBookings.filter((b) => b.status === "confirmed").length,
    seated: todayBookings.filter((b) => b.status === "seated").length,
  };

  const handleConfirm = (booking: Booking) => {
    setConfirmAction({
      title: "Confirm Booking",
      message: `Confirm the reservation for ${booking.customerName || "Guest"} on ${formatDate(booking.date)} at ${formatTime(booking.time)}?`,
      variant: "primary",
      onConfirm: async () => {
        if (!shop?.id) return;
        await confirmBooking(shop.id, booking.id);
      },
    });
  };

  const handleReject = (booking: Booking) => {
    setConfirmAction({
      title: "Reject Booking",
      message: `Reject the reservation for ${booking.customerName}? They will not be notified automatically.`,
      variant: "danger",
      onConfirm: async () => {
        if (!shop?.id) return;
        await rejectBooking(shop.id, booking.id);
      },
    });
  };

  const handleNoShow = (booking: Booking) => {
    setConfirmAction({
      title: "Mark No Show",
      message: `Mark ${booking.customerName} as a no-show for their booking on ${formatDate(booking.date)} at ${formatTime(booking.time)}?`,
      variant: "danger",
      onConfirm: async () => {
        if (!shop?.id) return;
        await updateBooking(shop.id, booking.id, { status: "no_show" });
      },
    });
  };

  const handleCancelBookingMerchant = (booking: Booking) => {
    setConfirmAction({
      title: "Cancel Booking",
      message: `Are you sure you want to cancel the booking for ${booking.customerName || "Guest"}? A 100% refund of ₹${booking.bookingPrice || 0} will be requested.`,
      variant: "danger",
      onConfirm: async () => {
        if (!shop?.id) return;

        const isPaid = booking.paymentStatus === "paid";
        const refundAmt = booking.bookingPrice || 0;

        const updateData: Partial<Booking> = {
          status: "cancelled",
          cancelledBy: "merchant",
          refundAmount: isPaid ? refundAmt : 0,
          cancellationCharges: 0,
          refundStatus: isPaid ? "pending" : "none",
        };
        await updateBooking(shop.id, booking.id, updateData);

        if (isPaid) {
          try {
            const q = query(
              collection(db, "booking_payments"),
              where("bookingId", "==", booking.id)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
              const paymentDoc = snap.docs[0];
              await updateDoc(doc(db, "booking_payments", paymentDoc.id), {
                status: "cancelled",
                cancelledBy: "merchant",
                refundAmount: refundAmt,
                cancellationCharges: 0,
                refundStatus: "pending",
                updatedAt: new Date().toISOString(),
              });
            }
          } catch (err) {
            console.error("Error updating booking payment in Firestore:", err);
          }
        }
      },
    });
  };

  const handleSeatNow = async (booking: Booking) => {
    // If a specific table was pre-assigned during booking, seat directly
    if (booking.tableId && shop?.id) {
      const targetTable = tables.find((t) => t.id === booking.tableId);
      if (targetTable) {
        const isActive = !!targetTable.currentSessionId;
        if (isActive) {
          alert(`Selected table (${targetTable.name}) is currently occupied. Please choose another table.`);
        } else {
          try {
            const sessionId = await createSession(
              shop.id,
              targetTable.id,
              targetTable.name,
              false, // Direct seating from booking does not need approval
              booking.customerName,
              booking.customerPhone,
              "",
              booking.partySize,
            );
            await seatBooking(shop.id, booking.id, targetTable.id, targetTable.name, sessionId);
            alert(`Seated ${booking.customerName} at ${targetTable.name}!`);
            return;
          } catch (err) {
            console.error("Error seating directly: ", err);
          }
        }
      }
    }

    // Auto-select the smallest available table that can fit the party
    const party = Number(booking.partySize) || 1;
    const fittingTables = availableTables
      .filter((t) => Number(t.capacity) >= party)
      .sort((a, b) => Number(a.capacity) - Number(b.capacity)); // smallest fitting first
    const bestFit = fittingTables[0];
    setShowSeatDialog({ booking });
    setSelectedTableId(bestFit?.id || "");
  };

  const handleConfirmSeat = async () => {
    if (!shop?.id || !showSeatDialog) return;
    const { booking } = showSeatDialog;
    const table = tables.find((t) => t.id === selectedTableId);
    if (!table) return;

    const sessionId = await createSession(
      shop.id,
      table.id,
      table.name,
      false, // Direct seating from booking does not need approval
      booking.customerName,
      booking.customerPhone,
      "",
      booking.partySize,
    );
    await seatBooking(shop.id, booking.id, table.id, table.name, sessionId);
    setShowSeatDialog(null);
  };

  const validateNewForm = () => {
    const errors: any = {};
    if (!newForm.customerName.trim()) errors.customerName = "Required";
    if (!newForm.customerPhone.trim()) errors.customerPhone = "Required";
    else if (!/^\d{10}$/.test(newForm.customerPhone.trim()))
      errors.customerPhone = "10-digit number";
    if (!newForm.date) errors.date = "Required";
    if (!newForm.time) errors.time = "Required";
    setNewFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveNewBooking = async () => {
    if (!shop?.id || !validateNewForm()) return;
    setSavingNew(true);
    try {
      await createBooking(shop.id, {
        customerName: newForm.customerName.trim(),
        customerPhone: newForm.customerPhone.trim(),
        partySize: parseInt(newForm.partySize) || 2,
        date: newForm.date,
        time: newForm.time,
        notes: newForm.notes.trim(),
        tablePreference: newForm.tablePreference.trim(),
      });
      setShowNewBookingDialog(false);
      setNewForm({
        customerName: "",
        customerPhone: "",
        partySize: "2",
        date: getTodayStr(),
        time: "12:00",
        notes: "",
        tablePreference: "",
      });
    } finally {
      setSavingNew(false);
    }
  };

  const availableTables = tables.filter(
    (t) => !t.currentSessionId && !t.mergedInto,
  );

  if (shopLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 size={24} className="animate-spin text-[#FF6A00]" />
      </div>
    );
  }

  // ── PAYWALL ─────────────────────────────────────────────────────
  const hasTableBooking = !!shop?.paidFeatures?.table_booking?.enabled;
  if (!hasTableBooking) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-950 py-12 flex items-center justify-center">
        <div className="max-w-xl mx-auto px-4">
          <Card className="p-6 bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-zinc-800 rounded-md shadow-lg relative overflow-hidden">
            {/* Glow accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6A00]/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

            <div className="flex flex-col items-center text-center space-y-4 relative z-10">
              <div className="w-12 h-12 rounded-md bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#FF6A00] shadow-2xs">
                <CalendarDays size={22} />
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded border border-black/[0.04] dark:border-zinc-700 text-[9px] font-black uppercase tracking-wider text-[#FF6A00]">
                  SaaS Add-on · ₹399/mo
                </div>
                <h2 className="text-base font-bold text-[#0A0A0F] dark:text-zinc-100 tracking-tight">
                  Table Reservations
                </h2>
                <p className="text-[12px] text-[#0A0A0F]/55 dark:text-zinc-400 max-w-sm font-medium leading-relaxed">
                  Let customers pre-book tables from your public shop profile with real-time slot availability and full reservation management.
                </p>
              </div>

              {/* Value Props */}
              <div className="w-full grid grid-cols-1 gap-2 pt-2 text-left">
                {[
                  { title: "Customer Booking Flow", desc: "5-step wizard: date → party size → time slot → contact → confirmation" },
                  { title: "Real-Time Slot Availability", desc: "Slots auto-fill based on existing bookings vs. total table capacity" },
                  { title: "Full Reservation Management", desc: "Confirm, reject, seat, or mark no-show from the Bookings console" },
                  { title: "One-Click Seat Now", desc: "Promote a confirmed booking to an active session in your Tables view" },
                ].map((vp, i) => (
                  <div key={i} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-zinc-700 rounded-md flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                      <Check size={12} className="stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-[#0A0A0F] dark:text-zinc-100">{vp.title}</h4>
                      <p className="text-[10px] text-[#0A0A0F]/40 dark:text-zinc-500 font-medium">{vp.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="w-full pt-4 border-t border-black/[0.06] dark:border-zinc-800 flex items-center justify-end gap-2.5">
                <Button
                  variant="ghost"
                  className="text-xs h-9 font-bold"
                  onClick={() => window.history.back()}
                >
                  Go Back
                </Button>
                <Button
                  variant="dark"
                  icon={ArrowRight}
                  className="text-xs h-9 shadow-sm font-bold"
                  onClick={() =>
                    (window.location.href = `/manage?id=${shop?.id}&view=features`)
                  }
                >
                  Activate · ₹399/mo
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 space-y-5">
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-7 h-7 rounded-md bg-[#FF6A00]/10 flex items-center justify-center">
                <CalendarDays size={14} className="text-[#FF6A00]" />
              </div>
              <div className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                Table Reservations
              </div>
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Bookings
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setViewMode((v) => (v === "list" ? "kanban" : "list"))
              }
              className="h-8 px-3 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 hover:border-[#FF6A00]/40 transition-all"
            >
              {viewMode === "list" ? (
                <LayoutGrid size={13} />
              ) : (
                <LayoutList size={13} />
              )}
              {viewMode === "list" ? "Kanban" : "List"}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="h-8 w-8 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center hover:border-[#FF6A00]/40 hover:text-[#FF6A00] transition-all"
              title="Booking Settings"
            >
              <Settings2 size={14} />
            </button>
            <Button
              variant="dark"
              size="sm"
              icon={Plus}
              className="h-8 text-xs"
              onClick={() => setShowNewBookingDialog(true)}
            >
              New Booking
            </Button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("bookings")}
            className={`px-4 py-2 border-b-2 text-xs font-bold transition-all -mb-[1px] ${
              activeTab === "bookings"
                ? "border-[#FF6A00] text-[#FF6A00]"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            Reservations
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-2 border-b-2 text-xs font-bold transition-all -mb-[1px] flex items-center gap-1.5 ${
              activeTab === "payments"
                ? "border-[#FF6A00] text-[#FF6A00]"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <CreditCard size={12} />
            Customer Payments
          </button>
        </div>

        {activeTab === "bookings" ? (
          <>
            {/* ── STATS BAR ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Today Total",
              value: stats.todayTotal,
              icon: Calendar,
              color: "text-zinc-600 dark:text-zinc-300",
            },
            {
              label: "Pending",
              value: stats.pending,
              icon: Bell,
              color: "text-amber-600",
            },
            {
              label: "Confirmed",
              value: stats.confirmed,
              icon: CheckCircle2,
              color: "text-blue-600",
            },
            {
              label: "Seated",
              value: stats.seated,
              icon: UserCheck,
              color: "text-emerald-600",
            },
          ].map((s, i) => (
            <Card
              key={i}
              padding={false}
              className="p-3 bg-white dark:bg-zinc-900 border-black/[0.04] dark:border-zinc-800 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <s.icon size={12} className={s.color} />
                <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                  {s.label}
                </span>
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                {s.value}
              </div>
            </Card>
          ))}
        </div>

        {/* ── FILTER + SEARCH BAR ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-0.5 gap-0.5 shadow-sm">
            {(["today", "upcoming", "all", "past"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 h-7 rounded text-xs font-bold capitalize transition-all ${
                  filter === f
                    ? "bg-[#FF6A00] text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full h-8 pl-8 pr-3 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium outline-none focus:border-[#FF6A00]/40 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 ml-auto">
            {filteredBookings.length} booking
            {filteredBookings.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* ── LIST VIEW ── */}
        {viewMode === "list" && (
          <div className="space-y-2">
            {filteredBookings.length === 0 ? (
              <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <CalendarDays
                  size={32}
                  className="mx-auto text-zinc-200 dark:text-zinc-700 mb-3"
                />
                <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                  No bookings found
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  {filter === "today"
                    ? "No reservations for today."
                    : `No ${filter} bookings.`}
                </p>
              </div>
            ) : (
              filteredBookings.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                  onNoShow={handleNoShow}
                  onSeatNow={handleSeatNow}
                  onCancel={handleCancelBookingMerchant}
                />
              ))
            )}
          </div>
        )}

        {/* ── KANBAN VIEW ── */}
        {viewMode === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["pending", "confirmed", "seated"] as const).map((status) => {
              const cfg = STATUS_CONFIG[status];
              const cols = filteredBookings.filter((b) => b.status === status);
              return (
                <div
                  key={status}
                  className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                >
                  <div
                    className={`px-4 py-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 ${cfg.bg} dark:bg-zinc-800/50`}
                  >
                    <span
                      className={`text-[11px] font-black uppercase tracking-widest ${cfg.color}`}
                    >
                      {cfg.label}
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${cfg.color} ${cfg.bg} border ${cfg.border}`}
                    >
                      {cols.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[120px]">
                    {cols.length === 0 ? (
                      <p className="text-[11px] text-zinc-300 dark:text-zinc-600 font-medium text-center py-6">
                        Empty
                      </p>
                    ) : (
                      cols.map((b) => (
                        <BookingCard
                          key={b.id}
                          booking={b}
                          compact
                          onConfirm={handleConfirm}
                          onReject={handleReject}
                          onNoShow={handleNoShow}
                          onSeatNow={handleSeatNow}
                          onCancel={handleCancelBookingMerchant}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Customer Payments</h3>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">History of reservation fees collected via Razorpay</p>
              </div>
              <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                {payments.length} payment{payments.length !== 1 ? "s" : ""}
              </div>
            </div>

            {loadingPayments ? (
              <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <Loader2 size={24} className="animate-spin text-[#FF6A00] mx-auto mb-2" />
                <p className="text-xs text-zinc-400 font-medium">Loading payments history...</p>
              </div>
            ) : payments.length === 0 ? (
              <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <CreditCard size={32} className="mx-auto text-zinc-200 dark:text-zinc-700 mb-3" />
                <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-1">No payment records found</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">When customers book tables with a fee, their transaction history will appear here.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Reservation</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4">Payment Txn ID</th>
                        <th className="py-3 px-4">Payout Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit"
                            }) : "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100">{p.customerName}</div>
                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{p.customerPhone}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div>Table {p.tableName}</div>
                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                              <span>{formatDate(p.bookingDate)}</span>
                              <span>•</span>
                              <span>{formatTime(p.bookingTime)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                            {p.status === "cancelled" ? (
                              <div className="space-y-0.5 text-right">
                                <span className="text-zinc-400 dark:text-zinc-500 line-through text-[10px]">₹{p.amount}</span>
                                <div className="text-[10px] text-red-500 font-black">Fee Retained: ₹{p.cancellationCharges || 0}</div>
                              </div>
                            ) : (
                              <span>₹{p.amount}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                            {p.paymentTxnId}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {p.status === "cancelled" && (p.cancellationCharges ?? 0) === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold">
                                No Payout (100% Refunded)
                              </span>
                            ) : (p.payoutStatus === "settled" || p.payoutStatus === "paid") ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 text-[10px] font-bold text-emerald-600 dark:text-emerald-450">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Settled {p.status === "cancelled" ? `(₹${p.cancellationCharges})` : ""}
                                </span>
                                {p.payoutTxnId && (
                                  <div className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
                                    Txn: {p.payoutTxnId}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 text-[10px] font-bold text-amber-600 dark:text-amber-450">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Pending Admin Settlement {p.status === "cancelled" ? `(₹${p.cancellationCharges})` : ""}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CONFIRM ACTION DIALOG ── */}
      {confirmAction && (
        <Dialog
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          title={confirmAction.title}
          subtitle={confirmAction.message}
          maxWidth="max-w-sm"
        >
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 text-xs"
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction.variant === "danger" ? "danger" : "dark"}
              size="sm"
              className="flex-1 h-9 text-xs"
              onClick={async () => {
                try {
                  await confirmAction.onConfirm?.();
                  setConfirmAction(null);
                } catch (err: any) {
                  console.error("Action failed:", err);
                  alert("Failed to complete action: " + err.message);
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </Dialog>
      )}

      {/* ── SEAT NOW DIALOG ── */}
      {showSeatDialog && (() => {
        const party = Number(showSeatDialog.booking.partySize) || 1;
        // Sort: fitting tables first (by closest capacity), then undersized
        const sortedTables = [...availableTables].sort((a, b) => {
          const aFits = Number(a.capacity) >= party;
          const bFits = Number(b.capacity) >= party;
          if (aFits && !bFits) return -1;
          if (!aFits && bFits) return 1;
          // Both fit: prefer smallest that fits
          if (aFits && bFits) return Number(a.capacity) - Number(b.capacity);
          // Both undersize: prefer largest undersize
          return Number(b.capacity) - Number(a.capacity);
        });
        const fitsCount = sortedTables.filter(t => Number(t.capacity) >= party).length;

        return (
          <Dialog
            isOpen={!!showSeatDialog}
            onClose={() => setShowSeatDialog(null)}
            title="Seat Customer"
            subtitle={`Assign a table for ${showSeatDialog.booking.customerName}`}
            maxWidth="max-w-sm"
          >
            <div className="mt-3 space-y-3">

              {/* Party summary */}
              <div className="flex items-center gap-3 p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                <div className="w-9 h-9 rounded-md bg-[#FF6A00]/10 border border-[#FF6A00]/20 flex items-center justify-center shrink-0">
                  <Users size={15} className="text-[#FF6A00]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {showSeatDialog.booking.customerName}
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                    Party of <span className="font-black text-[#FF6A00]">{party}</span>
                    {showSeatDialog.booking.time && ` · ${formatTime(showSeatDialog.booking.time)}`}
                    {showSeatDialog.booking.date && ` · ${formatDate(showSeatDialog.booking.date)}`}
                  </p>
                </div>
                {fitsCount === 0 && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                    No ideal fit
                  </span>
                )}
              </div>

              {/* Table grid */}
              <div>
                <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
                  {fitsCount > 0
                    ? `${fitsCount} table${fitsCount !== 1 ? 's' : ''} fit this party`
                    : "All tables are undersized — choose carefully"}
                </p>
                {availableTables.length === 0 ? (
                  <div className="py-8 text-center text-zinc-400 text-sm font-medium border border-dashed rounded-xl">
                    No free tables right now
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {sortedTables.map((t) => {
                      const capacity = Number(t.capacity);
                      const fits = capacity >= party;
                      const isSelected = selectedTableId === t.id;
                      const tooSmall = !fits;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTableId(t.id)}
                          className={`py-2.5 px-2 rounded-md border text-xs font-bold transition-all flex flex-col items-center gap-1 relative ${
                            isSelected
                              ? "bg-[#FF6A00] border-[#FF6A00] text-white shadow-md"
                              : fits
                                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:border-emerald-400"
                                : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-500 hover:border-amber-300"
                          }`}
                        >
                          <Table2 size={13} />
                          <span className="truncate w-full text-center">{t.name}</span>
                          <span className={`text-[9px] font-bold ${
                            isSelected ? "text-white/80" : fits ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"
                          }`}>
                            {capacity} seats
                          </span>
                          {/* Fit indicator dot */}
                          {!isSelected && (
                            <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                              fits ? "bg-emerald-400" : "bg-amber-400"
                            }`} />
                          )}
                          {tooSmall && !isSelected && (
                            <span className="absolute -top-1 -left-1 text-[7px] font-black bg-amber-400 text-white px-1 rounded">
                              SMALL
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-[9px] font-bold text-zinc-400 dark:text-zinc-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Fits party</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Undersized</span>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 text-xs"
                  onClick={() => setShowSeatDialog(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="dark"
                  size="sm"
                  className="flex-1 h-9 text-xs"
                  disabled={!selectedTableId}
                  onClick={handleConfirmSeat}
                >
                  Seat Now
                </Button>
              </div>
            </div>
          </Dialog>
        );
      })()}

      {/* ── NEW BOOKING DIALOG ── */}
      <Dialog
        isOpen={showNewBookingDialog}
        onClose={() => setShowNewBookingDialog(false)}
        title="New Reservation"
        subtitle="Manually create a table reservation"
        maxWidth="max-w-md"
      >
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                Name *
              </label>
              <input
                value={newForm.customerName}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, customerName: e.target.value }))
                }
                placeholder="Guest name"
                className={`w-full h-9 px-3 rounded-md border text-xs font-medium outline-none transition-all bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 ${newFormErrors.customerName ? "border-red-400" : "border-zinc-200 dark:border-zinc-700 focus:border-[#FF6A00]/50"}`}
              />
              {newFormErrors.customerName && (
                <p className="text-[10px] text-red-500 mt-0.5">
                  {newFormErrors.customerName}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                Phone *
              </label>
              <input
                value={newForm.customerPhone}
                onChange={(e) =>
                  setNewForm((f) => ({
                    ...f,
                    customerPhone: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10),
                  }))
                }
                placeholder="10-digit mobile"
                className={`w-full h-9 px-3 rounded-md border text-xs font-medium outline-none transition-all bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 ${newFormErrors.customerPhone ? "border-red-400" : "border-zinc-200 dark:border-zinc-700 focus:border-[#FF6A00]/50"}`}
              />
              {newFormErrors.customerPhone && (
                <p className="text-[10px] text-red-500 mt-0.5">
                  {newFormErrors.customerPhone}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                Date *
              </label>
              <input
                type="date"
                value={newForm.date}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, date: e.target.value }))
                }
                className="w-full h-9 px-2 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs font-medium outline-none focus:border-[#FF6A00]/50 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                Time *
              </label>
              <input
                type="time"
                value={newForm.time}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, time: e.target.value }))
                }
                className="w-full h-9 px-2 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs font-medium outline-none focus:border-[#FF6A00]/50 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                Party
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={newForm.partySize}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, partySize: e.target.value }))
                }
                className="w-full h-9 px-2 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs font-medium outline-none focus:border-[#FF6A00]/50 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
              Notes
            </label>
            <textarea
              value={newForm.notes}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Special requests..."
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs font-medium outline-none focus:border-[#FF6A00]/50 resize-none bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 text-xs"
              onClick={() => setShowNewBookingDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="dark"
              size="sm"
              className="flex-1 h-9 text-xs"
              loading={savingNew}
              onClick={handleSaveNewBooking}
            >
              Create Booking
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── BOOKING SETTINGS DIALOG ── */}
      <Dialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Booking Settings"
        subtitle="Configure reservation rules for your shop"
        icon={Settings2}
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
              Saved settings apply to the customer booking wizard immediately.
            </p>
            <Button
              variant={configSaved ? "secondary" : "dark"}
              size="sm"
              icon={configSaved ? Check : Save}
              className="h-8 text-xs min-w-[110px]"
              loading={savingConfig}
              onClick={handleSaveConfig}
            >
              {configSaved ? "Saved!" : "Save Settings"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 py-1">

          {/* Max bookings per slot */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                  Max Bookings per Time Slot
                </label>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
                  How many reservations allowed at the same date + time
                </p>
              </div>
              <span className="text-base font-black text-[#FF6A00] min-w-[28px] text-right">
                {bookingConfig.maxPerSlot}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={bookingConfig.maxPerSlot}
              onChange={(e) =>
                setBookingConfig((c) => ({ ...c, maxPerSlot: Number(e.target.value) }))
              }
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-[#FF6A00]"
            />
            <div className="flex justify-between text-[9px] font-bold text-zinc-400 mt-1">
              <span>1</span><span>10</span><span>20</span>
            </div>
          </div>

          {/* Max party size */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                  Max Party Size
                </label>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
                  Maximum guests per single booking
                </p>
              </div>
              <span className="text-base font-black text-[#FF6A00] min-w-[28px] text-right">
                {bookingConfig.maxPartySize}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={bookingConfig.maxPartySize}
              onChange={(e) =>
                setBookingConfig((c) => ({ ...c, maxPartySize: Number(e.target.value) }))
              }
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-[#FF6A00]"
            />
            <div className="flex justify-between text-[9px] font-bold text-zinc-400 mt-1">
              <span>1</span><span>15</span><span>30</span>
            </div>
          </div>

          {/* Slot interval */}
          <div>
            <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block mb-2">
              Time Slot Interval
              <span className="ml-1.5 text-[9px] font-medium text-zinc-400">
                — spacing between available slots
              </span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 60, 90].map((mins) => (
                <button
                  key={mins}
                  onClick={() =>
                    setBookingConfig((c) => ({ ...c, slotInterval: mins }))
                  }
                  className={`h-9 rounded-md border text-[11px] font-bold transition-all ${
                    bookingConfig.slotInterval === mins
                      ? "border-[#FF6A00] bg-[#FF6A00]/10 text-[#FF6A00]"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900"
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Advance booking window */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                  Advance Booking Window
                </label>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
                  How many days ahead customers can book
                </p>
              </div>
              <span className="text-base font-black text-[#FF6A00] min-w-[42px] text-right">
                {bookingConfig.advanceDays}d
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={90}
              value={bookingConfig.advanceDays}
              onChange={(e) =>
                setBookingConfig((c) => ({ ...c, advanceDays: Number(e.target.value) }))
              }
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-[#FF6A00]"
            />
            <div className="flex justify-between text-[9px] font-bold text-zinc-400 mt-1">
              <span>1 day</span><span>30 days</span><span>90 days</span>
            </div>
          </div>

          {/* Cancellation window */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                  Cancellation Time Window
                </label>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
                  Hours before reservation a customer can cancel
                </p>
              </div>
              <span className="text-base font-black text-[#FF6A00] min-w-[42px] text-right">
                {bookingConfig.cancellationHours ?? 24}h
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={72}
              value={bookingConfig.cancellationHours ?? 24}
              onChange={(e) =>
                setBookingConfig((c) => ({ ...c, cancellationHours: Number(e.target.value) }))
              }
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-[#FF6A00]"
            />
            <div className="flex justify-between text-[9px] font-bold text-zinc-400 mt-1">
              <span>0 hours</span><span>24 hours</span><span>72 hours</span>
            </div>
          </div>

          {/* Cancellation charges */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                  Cancellation Fee Charges
                </label>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
                  Percentage fee charged to customer on cancellation
                </p>
              </div>
              <span className="text-base font-black text-[#FF6A00] min-w-[42px] text-right">
                {bookingConfig.cancellationCharges ?? 10}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={bookingConfig.cancellationCharges ?? 10}
              onChange={(e) =>
                setBookingConfig((c) => ({ ...c, cancellationCharges: Number(e.target.value) }))
              }
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-[#FF6A00]"
            />
            <div className="flex justify-between text-[9px] font-bold text-zinc-400 mt-1">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>

          {/* Auto-confirm toggle */}
          <div className="flex items-center justify-between p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <div>
              <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                Auto-Confirm Bookings
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
                Skip pending — new bookings are instantly confirmed
              </p>
            </div>
            <button
              onClick={() =>
                setBookingConfig((c) => ({ ...c, autoConfirm: !c.autoConfirm }))
              }
              className="ml-4 flex-shrink-0 transition-colors"
            >
              {bookingConfig.autoConfirm ? (
                <ToggleRight size={28} className="text-[#FF6A00]" />
              ) : (
                <ToggleLeft size={28} className="text-zinc-400 dark:text-zinc-600" />
              )}
            </button>
          </div>

        </div>
      </Dialog>
    </div>
  );
}

// ── BOOKING CARD COMPONENT ────────────────────────────────────────

function BookingCard({
  booking,
  compact = false,
  onConfirm,
  onReject,
  onNoShow,
  onSeatNow,
  onCancel,
}: {
  booking: Booking;
  compact?: boolean;
  onConfirm: (b: Booking) => void;
  onReject: (b: Booking) => void;
  onNoShow: (b: Booking) => void;
  onSeatNow: (b: Booking) => void;
  onCancel: (b: Booking) => void;
}) {
  const cfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const shortRef = booking.id?.slice(-5).toUpperCase() || "";
  const isActionable =
    booking.status === "pending" || booking.status === "confirmed";

  if (compact) {
    return (
      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/60 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {booking.customerName}
            </p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
              {booking.customerPhone}
            </p>
          </div>
          <span
            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border} whitespace-nowrap flex-shrink-0`}
          >
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <Calendar size={10} />
            {formatDate(booking.date)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {formatTime(booking.time)}
          </span>
          <span className="flex items-center gap-1">
            <Users size={10} />
            {booking.partySize}
          </span>
        </div>
        {booking.bookingPrice !== undefined && booking.bookingPrice > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {booking.paymentStatus === "paid" ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                ₹{booking.bookingPrice} Paid
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-[9px] font-bold text-red-600 dark:text-red-400">
                ₹{booking.bookingPrice} Unpaid
              </span>
            )}
            {booking.paymentStatus === "paid" && (
              booking.status === "cancelled" && (booking.cancellationCharges ?? 0) === 0 ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[9px] font-bold border border-zinc-200 dark:border-zinc-700">
                  Payout: None (Refunded)
                </span>
              ) : (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  booking.payoutStatus === "paid"
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                    : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-450 border border-amber-100 dark:border-amber-900"
                }`}>
                  Payout: {booking.payoutStatus === "paid" ? "Settled" : "Pending"}{booking.status === "cancelled" ? ` (₹${booking.cancellationCharges})` : ""}
                </span>
              )
            )}
          </div>
        )}
        {isActionable && (
          <div className="flex gap-1 pt-0.5">
            {booking.status === "pending" && booking.paymentStatus !== "paid" && (
              <>
                <button
                  onClick={() => onConfirm(booking)}
                  className="flex-1 h-6 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-[10px] font-bold hover:bg-blue-100 transition-all"
                >
                  Confirm
                </button>
                <button
                  onClick={() => onReject(booking)}
                  className="h-6 w-6 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all"
                  title="Reject"
                >
                  <X size={10} />
                </button>
              </>
            )}
            {/* Paid pending: skip confirm/reject — payment is the confirmation */}
            {(booking.status === "confirmed" || (booking.status === "pending" && booking.paymentStatus === "paid")) && (
              <>
                <button
                  onClick={() => onSeatNow(booking)}
                  className="flex-1 h-6 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold hover:bg-emerald-100 transition-all"
                >
                  Seat
                </button>
                <button
                  onClick={() => onCancel(booking)}
                  className="h-6 w-6 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-550 flex items-center justify-center hover:bg-red-100 transition-all"
                  title="Cancel Booking"
                >
                  <X size={10} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card
      padding={false}
      className="p-3.5 bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Left: Identity */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 font-bold text-sm text-zinc-600 dark:text-zinc-300">
            {booking.customerName?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {booking.customerName}
              </p>
              <span
                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}
              >
                {cfg.label}
              </span>
              {booking.bookingPrice !== undefined && booking.bookingPrice > 0 && (
                <>
                  {booking.paymentStatus === "paid" ? (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-250 dark:border-emerald-850">
                      ₹{booking.bookingPrice} Paid
                    </span>
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border text-red-650 bg-red-50 dark:bg-red-950/30 border-red-250 dark:border-red-850">
                      ₹{booking.bookingPrice} Unpaid
                    </span>
                  )}
                  {booking.paymentStatus === "paid" && (
                    booking.status === "cancelled" && (booking.cancellationCharges ?? 0) === 0 ? (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border text-zinc-500 bg-zinc-100 dark:bg-zinc-850 border-zinc-250 dark:border-zinc-750">
                        Payout: None
                      </span>
                    ) : (
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        booking.payoutStatus === "paid"
                          ? "text-zinc-650 bg-zinc-100 dark:bg-zinc-850 border-zinc-250 dark:border-zinc-750"
                          : "text-amber-650 bg-amber-50 dark:bg-amber-950/30 border-amber-250 dark:border-amber-850"
                      }`}>
                        Payout: {booking.payoutStatus === "paid" ? "Settled" : "Pending"}{booking.status === "cancelled" ? ` (₹${booking.cancellationCharges})` : ""}
                      </span>
                    )
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Phone size={10} />
                {booking.customerPhone}
              </span>
              <span className="flex items-center gap-1">
                <Hash size={10} />
                {shortRef}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Details */}
        <div className="flex items-center gap-4 text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 flex-wrap sm:flex-nowrap">
          <span className="flex items-center gap-1.5">
            <Calendar size={12} className="text-[#FF6A00]" />
            {formatDate(booking.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} className="text-[#FF6A00]" />
            {formatTime(booking.time)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={12} className="text-[#FF6A00]" />
            {booking.partySize} {booking.partySize === 1 ? "guest" : "guests"}
          </span>
          {booking.tableName && (
            <span className="flex items-center gap-1.5">
              <Table2 size={12} className="text-emerald-500" />
              {booking.tableName}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        {isActionable && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {booking.status === "pending" && booking.paymentStatus !== "paid" && (
              <>
                <button
                  onClick={() => onConfirm(booking)}
                  className="h-7 px-2.5 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-[11px] font-bold flex items-center gap-1 hover:bg-blue-100 transition-all"
                >
                  <Check size={11} /> Confirm
                </button>
                <button
                  onClick={() => onReject(booking)}
                  className="h-7 px-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-500 text-[11px] font-bold flex items-center gap-1 hover:bg-red-100 transition-all"
                  title="Reject booking"
                >
                  <X size={11} /> Reject
                </button>
              </>
            )}
            {/* Paid pending: payment = confirmation, skip confirm/reject → show Seat Now */}
            {(booking.status === "confirmed" || (booking.status === "pending" && booking.paymentStatus === "paid")) && (
              <>
                <button
                  onClick={() => onSeatNow(booking)}
                  className="h-7 px-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-450 text-[11px] font-bold flex items-center gap-1 hover:bg-emerald-100 transition-all"
                >
                  <Armchair size={11} /> Seat Now
                </button>
                <button
                  onClick={() => onNoShow(booking)}
                  className="h-7 px-2 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-orange-500 text-[11px] font-bold flex items-center gap-1 hover:bg-orange-100 transition-all"
                  title="Mark as No Show"
                >
                  <UserX size={11} /> No Show
                </button>
                <button
                  onClick={() => onCancel(booking)}
                  className="h-7 px-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-550 text-[11px] font-bold flex items-center gap-1 hover:bg-red-100 transition-all"
                  title="Cancel booking"
                >
                  <X size={11} /> Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Notes row */}
      {booking.notes && (
        <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium italic">
            &ldquo;{booking.notes}&rdquo;
          </p>
        </div>
      )}
    </Card>
  );
}
