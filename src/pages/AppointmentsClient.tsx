import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useShopOwner } from "@/hooks/useShopOwner";
import { useModal } from "@/hooks/useModal";
import { useNavigate } from "react-router-dom";
import { DataTable, Column } from "@/components/UI/DataTable";
import {
  createAppointmentBooking,
  listenAppointmentBookings,
  updateAppointmentBooking,
  confirmAppointmentBooking,
  rejectAppointmentBooking,
  cancelAppointmentBooking,
  AppointmentBooking
} from "@/lib/rtdb";
import {
  updateShop,
  getStaff,
  addStaff,
  updateStaff,
  deleteStaff,
  getCustomers,
  addCustomer,
  updateCustomer,
  upsertCustomerFromBooking,
  db
} from "@/lib/db";
import {
  CalendarDays,
  Clock,
  User,
  Users,
  Phone,
  Plus,
  Check,
  X,
  Loader2,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  Search,
  Bell,
  ArrowRight,
  Settings2,
  Scissors,
  DollarSign,
  ShieldAlert,
  UserCheck,
  Trash2,
  Sparkles,
  ChevronDown
} from "lucide-react";
import Card from "@/components/UI/Card";
import Button from "@/components/UI/Button";
import Dialog from "@/components/UI/Dialog";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-900/30",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-900/30",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-900/30",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-900/30",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-zinc-500 dark:text-zinc-400",
    bg: "bg-zinc-50 dark:bg-zinc-800/30",
    border: "border-zinc-200 dark:border-zinc-700/30",
  },
  no_show: {
    label: "No Show",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    border: "border-orange-200 dark:border-orange-900/30",
  },
};

const DEFAULT_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function formatTime12(tStr: string) {
  if (!tStr) return "";
  const [h, m] = tStr.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function getLocalTodayStr() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split("T")[0];
}

export default function AppointmentsClient() {
  const { shop, loading: shopLoading } = useShopOwner();
  const { showAlert, showConfirm } = useModal();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"appointments" | "scheduler" | "staff" | "customers" | "settings">("appointments");

  // State lists
  const [bookings, setBookings] = useState<AppointmentBooking[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  // Loading states
  const [loadingData, setLoadingData] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);
  const [savingManual, setSavingManual] = useState(false);

  // Filters & Search
  const [filter, setFilter] = useState<"today" | "upcoming" | "all" | "past">("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaffFilter, setSelectedStaffFilter] = useState("all");

  // Configuration Form
  const [configForm, setConfigForm] = useState({
    slotInterval: 30,
    bufferTime: 10,
    maxBookingsPerSlot: 4,
    advanceDays: 30,
    minNoticeHours: 2,
    autoConfirm: false,
    bookingFeeType: "free",
    depositAmount: 100,
    cancellationHours: 24,
    cancellationCharges: 10,
    cancellationChargeType: "flat"
  });

  // Staff Form
  const [showStaffDialog, setShowStaffDialog] = useState<any>(null); // null, 'create', or staffObj for edit
  const [staffForm, setStaffForm] = useState({
    name: "",
    role: "",
    active: true,
    maxConcurrentClients: 1,
    assignedServices: [] as string[],
    weeklySchedule: DEFAULT_DAYS.reduce((acc, day) => {
      acc[day] = { isClosed: day === "sunday", shifts: [{ open: "09:00", close: "18:00" }] };
      return acc;
    }, {} as Record<string, any>)
  });

  // Manual Booking Form (Walk-in)
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [selectedCRMUser, setSelectedCRMUser] = useState<any | null>(null);
  const [manualForm, setManualForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    serviceName: "",
    price: 0,
    duration: 30,
    staffId: "",
    date: getLocalTodayStr(),
    time: "10:00",
    notes: ""
  });

  // Action Dialogs
  const [confirmAction, setConfirmAction] = useState<any>(null);

  // Load Bookings, Staff, and Customers
  useEffect(() => {
    if (!shop?.id) return;

    // Listen to bookings in real-time
    const unsubBookings = listenAppointmentBookings(shop.id, (data) => {
      setBookings(data);
    });

    const loadFirestoreData = async () => {
      setLoadingData(true);
      try {
        const staff = await getStaff(shop.id);
        const custs = await getCustomers(shop.id);
        setStaffList(staff);
        setCustomers(custs);
      } catch (e) {
        console.error("Error loading firestore data", e);
      } finally {
        setLoadingData(false);
      }
    };
    loadFirestoreData();

    return () => {
      unsubBookings();
    };
  }, [shop?.id]);

  // Load initial settings from shop profile
  useEffect(() => {
    if (shop?.appointmentConfig) {
      setConfigForm({
        ...configForm,
        ...shop.appointmentConfig
      });
    }
  }, [shop?.appointmentConfig]);

  const handleSaveConfig = async () => {
    if (!shop?.id) return;
    setSavingConfig(true);
    try {
      await updateShop(shop.id, {
        appointmentConfig: configForm
      });
      showAlert({
        title: "Settings Saved",
        message: "Settings saved successfully!",
        type: "success",
      });
    } catch (e: any) {
      showAlert({
        title: "Save Failed",
        message: "Error saving settings: " + e.message,
        type: "error",
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveStaff = async () => {
    if (!shop?.id || !staffForm.name.trim()) return;
    setSavingStaff(true);
    try {
      if (showStaffDialog === "create") {
        await addStaff(shop.id, staffForm);
      } else {
        await updateStaff(shop.id, showStaffDialog.id, staffForm);
      }
      // Reload staff list
      const staff = await getStaff(shop.id);
      setStaffList(staff);
      setShowStaffDialog(null);
      resetStaffForm();
    } catch (e: any) {
      showAlert({
        title: "Save Failed",
        message: "Error saving staff: " + e.message,
        type: "error",
      });
    } finally {
      setSavingStaff(false);
    }
  };

  const resetStaffForm = () => {
    setStaffForm({
      name: "",
      role: "",
      active: true,
      maxConcurrentClients: 1,
      assignedServices: [],
      weeklySchedule: DEFAULT_DAYS.reduce((acc, day) => {
        acc[day] = { isClosed: day === "sunday", shifts: [{ open: "09:00", close: "18:00" }] };
        return acc;
      }, {} as Record<string, any>)
    });
  };

  const handleDeleteStaff = (staffId: string) => {
    if (!shop?.id) return;
    showConfirm({
      title: "Delete Staff Member",
      message: "Are you sure you want to delete this staff member?",
      type: "confirm",
      onConfirm: async () => {
        try {
          await deleteStaff(shop.id, staffId);
          setStaffList(staffList.filter(s => s.id !== staffId));
        } catch (e: any) {
          showAlert({
            title: "Delete Failed",
            message: "Error deleting: " + e.message,
            type: "error",
          });
        }
      }
    });
  };

  // Perform CRM sync and create walk-in booking
  const handleCreateManualBooking = async () => {
    if (!shop?.id || !manualForm.customerName.trim() || !manualForm.customerPhone.trim() || !manualForm.serviceName.trim()) {
      showAlert({
        title: "Missing Fields",
        message: "Please fill in Name, Phone, and Service details.",
        type: "info",
      });
      return;
    }
    const todayStr = getLocalTodayStr();
    if (manualForm.date < todayStr) {
      showAlert({
        title: "Invalid Date",
        message: "Cannot book appointments in the past.",
        type: "error",
      });
      return;
    }
    if (manualForm.date === todayStr) {
      const now = new Date();
      const currentTimeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      if (manualForm.time < currentTimeStr) {
        showAlert({
          title: "Invalid Time",
          message: "Cannot book appointments in the past.",
          type: "error",
        });
        return;
      }
    }
    setSavingManual(true);
    try {
      // 1. CRM Customer lookup/insertion
      const customerId = await upsertCustomerFromBooking(shop.id, {
        name: manualForm.customerName.trim(),
        phone: manualForm.customerPhone.trim(),
        email: manualForm.customerEmail.trim(),
        bookingPrice: Number(manualForm.price) || 0
      });

      // Find staff name
      const staffMember = staffList.find(s => s.id === manualForm.staffId);
      const staffName = staffMember ? staffMember.name : "Any Staff";

      // Calculate end time
      const [h, m] = manualForm.time.split(":").map(Number);
      const totalMins = h * 60 + m + Number(manualForm.duration);
      const endH = Math.floor(totalMins / 60);
      const endM = totalMins % 60;
      const endTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

      // 2. Write booking to RTDB
      await createAppointmentBooking(shop.id, {
        customerId,
        customerName: manualForm.customerName.trim(),
        customerPhone: manualForm.customerPhone.trim(),
        customerEmail: manualForm.customerEmail.trim(),
        serviceId: manualForm.serviceName.toLowerCase().replace(/\s+/g, "_"),
        serviceName: manualForm.serviceName.trim(),
        duration: Number(manualForm.duration) || 30,
        price: Number(manualForm.price) || 0,
        staffId: manualForm.staffId || "any",
        staffName,
        date: manualForm.date,
        time: manualForm.time,
        endTime,
        notes: manualForm.notes.trim(),
        paymentStatus: "unpaid"
      });

      // Reload Customers CRM list
      const custs = await getCustomers(shop.id);
      setCustomers(custs);

      setShowManualDialog(false);
      // Reset walk-in form
      setManualForm({
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        serviceName: "",
        price: 0,
        duration: 30,
        staffId: "",
        date: getLocalTodayStr(),
        time: "10:00",
        notes: ""
      });
      setSelectedCRMUser(null);
      setCustomerSearchQuery("");
      showAlert({
        title: "Booking Success",
        message: "Walk-in appointment booked successfully!",
        type: "success",
      });
    } catch (e: any) {
      showAlert({
        title: "Booking Failed",
        message: "Booking failed: " + e.message,
        type: "error",
      });
    } finally {
      setSavingManual(false);
    }
  };

  // Confirm / Complete / Cancel appointments
  const handleUpdateStatus = (booking: AppointmentBooking, newStatus: AppointmentBooking['status']) => {
    const messages = {
      confirmed: `Confirm appointment for ${booking.customerName} on ${booking.date} at ${booking.time}?`,
      completed: `Mark appointment for ${booking.customerName} as Completed? This will update their CRM lifetime spends.`,
      cancelled: `Cancel appointment for ${booking.customerName}?`,
      no_show: `Mark ${booking.customerName} as No Show?`
    };

    setConfirmAction({
      title: `${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} Booking`,
      message: messages[newStatus] || "Are you sure you want to perform this action?",
      variant: newStatus === "completed" || newStatus === "confirmed" ? "primary" : "danger",
      onConfirm: async () => {
        if (!shop?.id) return;
        
        // Update status in RTDB
        await updateAppointmentBooking(shop.id, booking.id, { status: newStatus });
        
        // If booking is completed and CRM lookup exists, let's update CRM record stats
        if (newStatus === "completed" && booking.customerId) {
          try {
            await upsertCustomerFromBooking(shop.id, {
              name: booking.customerName,
              phone: booking.customerPhone,
              email: booking.customerEmail,
              bookingPrice: booking.price // Add spend to CRM
            });
            // Reload Customers CRM list
            const custs = await getCustomers(shop.id);
            setCustomers(custs);
          } catch (e) {
            console.error("Failed to update CRM spend on completion", e);
          }
        }
      }
    });
  };

  // Extract services from current shop catalog menu
  const catalogServices = shop?.menu?.flatMap((cat: any) => 
    (cat.items || []).filter((item: any) => item.serviceDetails?.isService)
  ) || [];

  // Filter Bookings
  const todayStr = getLocalTodayStr();
  const filteredBookings = bookings
    .filter((b) => {
      if (filter === "today") return b.date === todayStr;
      if (filter === "upcoming") return b.date > todayStr;
      if (filter === "past") return b.date < todayStr;
      return true;
    })
    .filter((b) => {
      if (selectedStaffFilter === "all") return true;
      return b.staffId === selectedStaffFilter;
    })
    .filter((b) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        b.customerName?.toLowerCase().includes(q) ||
        b.customerPhone?.includes(q) ||
        b.serviceName?.toLowerCase().includes(q) ||
        b.customerId?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });

  const columns: Column<AppointmentBooking>[] = [
    {
      key: "date",
      header: "Date & Time",
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-zinc-900 dark:text-zinc-100">{row.date}</span>
          <span className="text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold mt-0.5">
            {formatTime12(row.time)} - {formatTime12(row.endTime)}
          </span>
        </div>
      ),
    },
    {
      key: "customerName",
      header: "Customer Info",
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-zinc-900 dark:text-zinc-150 leading-snug">{row.customerName}</span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono font-semibold">
            {row.customerId || "Walk-in"} • {row.customerPhone}
          </span>
          {row.customerEmail && (
            <span className="text-[9px] text-zinc-400 dark:text-zinc-550 font-medium">
              {row.customerEmail}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "serviceName",
      header: "Service & Staff",
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-zinc-800 dark:text-zinc-200 leading-snug">{row.serviceName}</span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold">
            {row.duration} mins · {row.staffName}
          </span>
          {row.notes && (
            <span className="text-[9px] text-amber-600 dark:text-amber-500 font-medium italic mt-0.5 max-w-xs truncate" title={row.notes}>
              Note: {row.notes}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "price",
      header: "Price & Payment",
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-black text-zinc-900 dark:text-zinc-100">₹{row.price}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${row.paymentStatus === "paid" ? "text-emerald-600 dark:text-emerald-450" : "text-zinc-450"}`}>
            {row.paymentStatus === "paid" ? "Paid" : "Unpaid"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => {
        const cfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.pending;
        return (
          <span className={`text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded border inline-block ${cfg.color} ${cfg.bg} ${cfg.border}`}>
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex items-center gap-1.5 justify-end">
          {row.status === "pending" && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(row, "rejected"); }}
                className="h-7 px-2.5 rounded-md border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 text-[10px] font-bold transition-all cursor-pointer"
              >
                Reject
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(row, "confirmed"); }}
                className="h-7 px-2.5 rounded-md bg-[#FF6A00] text-white hover:bg-[#e55a00] text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <Check size={11} /> Confirm
              </button>
            </>
          )}
          {row.status === "confirmed" && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(row, "no_show"); }}
                className="h-7 px-2.5 rounded-md border border-orange-200 dark:border-orange-900/40 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-[10px] font-bold transition-all cursor-pointer"
              >
                No Show
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(row, "cancelled"); }}
                className="h-7 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-[10px] font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(row, "completed"); }}
                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <UserCheck size={11} /> Complete
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const staffColumns: Column<any>[] = [
    {
      key: "name",
      header: "Provider Name",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full ${row.active ? "bg-emerald-500" : "bg-red-400"}`} title={row.active ? "Active" : "Inactive"} />
          <div className="flex flex-col">
            <span className="font-bold text-zinc-900 dark:text-zinc-150 leading-snug">{row.name}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#FF6A00] font-mono leading-none mt-0.5">{row.role}</span>
          </div>
        </div>
      ),
    },
    {
      key: "assignedServices",
      header: "Assigned Services",
      render: (row) => (
        <div className="flex flex-wrap gap-1 max-w-sm">
          {row.assignedServices?.length > 0 ? (
            row.assignedServices.map((srv: string, idx: number) => (
              <span key={idx} className="px-2 py-0.5 rounded bg-zinc-50 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-655 dark:text-zinc-350 border border-zinc-100 dark:border-zinc-700">
                {srv}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-zinc-400 italic">No services assigned</span>
          )}
        </div>
      ),
    },
    {
      key: "maxConcurrentClients",
      header: "Concurrency Limit",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-zinc-650 dark:text-zinc-350 font-semibold">
          {row.maxConcurrentClients || 1} client(s) per slot
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex gap-1.5 justify-end">
          <button
            onClick={() => { setStaffForm({ ...row, active: row.active !== false }); setShowStaffDialog(row); }}
            className="p-1.5 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-300 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
            title="Edit Provider"
          >
            <Settings2 size={13} />
          </button>
          <button
            onClick={() => handleDeleteStaff(row.id)}
            className="p-1.5 border border-red-100 dark:border-red-950/20 text-red-400 hover:text-red-550 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
            title="Delete Provider"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  const crmColumns: Column<any>[] = [
    {
      key: "customerId",
      header: "Customer ID",
      sortable: true,
      render: (row) => <span className="font-bold font-mono text-[#FF6A00]">{row.customerId}</span>,
    },
    {
      key: "name",
      header: "Client Details",
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-zinc-900 dark:text-zinc-150 leading-snug">{row.name}</span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold">
            {row.phone} {row.email ? `· ${row.email}` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "visits",
      header: "Visits",
      sortable: true,
      render: (row) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{row.stats?.totalAppointments || 0}</span>,
    },
    {
      key: "spend",
      header: "Lifetime Spend",
      sortable: true,
      render: (row) => <span className="font-black text-zinc-900 dark:text-zinc-100">₹{row.stats?.totalSpend || 0}</span>,
    },
    {
      key: "lastVisit",
      header: "Last Visit",
      sortable: true,
      render: (row) => <span className="font-medium text-zinc-700 dark:text-zinc-300">{row.stats?.lastBookingDate || "N/A"}</span>,
    },
    {
      key: "notes",
      header: "CRM Notes",
      render: (row) => (
        <span className="font-medium text-zinc-500 italic max-w-xs truncate block" title={row.notes}>
          {row.notes || "—"}
        </span>
      ),
    },
  ];

  // Calculate scheduler grid slots (9 AM to 6 PM)
  const hourSlots = Array.from({ length: 10 }, (_, i) => i + 9); // [9, 10, 11, ..., 18]

  // Paywall checks
  const isFeatureEnabled = !!shop?.paidFeatures?.appointment_booking?.enabled;

  if (shopLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-955">
        <Loader2 size={24} className="animate-spin text-[#FF6A00]" />
      </div>
    );
  }

  // ── PAYWALL SCREEN ──────────────────────────────────────────────────
  if (!isFeatureEnabled) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-950 py-12 flex items-center justify-center">
        <div className="max-w-xl mx-auto px-4">
          <Card className="p-6 bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-zinc-800 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6A00]/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

            <div className="flex flex-col items-center text-center space-y-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#FF6A00]">
                <CalendarDays size={22} />
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-850 rounded border border-black/[0.04] dark:border-zinc-700 text-[9px] font-black uppercase tracking-wider text-[#FF6A00]">
                  SaaS Add-on · ₹499/mo
                </div>
                <h2 className="text-base font-bold text-[#0A0A0F] dark:text-zinc-100 tracking-tight">
                  Service Appointments & Scheduling
                </h2>
                <p className="text-[12px] text-[#0A0A0F]/55 dark:text-zinc-400 max-w-sm font-medium leading-relaxed">
                  Provide seamless slot booking for your services. Perfect for salons, clinics, consultants, and fitness centers.
                </p>
              </div>

              {/* Value Props */}
              <div className="w-full grid grid-cols-1 gap-2 pt-2 text-left">
                {[
                  { title: "Staff & Resource Scheduling", desc: "Define provider hours, active days, and custom breaks/shifts" },
                  { title: "Dual Concurrency Constraints", desc: "Define booking capacity limit per slot globally and check individual staff availability" },
                  { title: "Walk-in & Customer CRM", desc: "Manage client details, auto-fill by search, assign Customer IDs, and track spends" },
                  { title: "Payment Deposits & Cancellation Policies", desc: "Integrate Razorpay to charge appointment booking fees and enforce late-cancel penalties" }
                ].map((vp, i) => (
                  <div key={i} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-zinc-700 rounded-xl flex items-start gap-2.5">
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
                  onClick={() => navigate("/dashboard")}
                >
                  Back to Dashboard
                </Button>
                <Button
                  variant="dark"
                  icon={ArrowRight}
                  className="text-xs h-9 shadow-sm font-bold"
                  onClick={() => navigate(`/manage?shopId=${shop?.id}&view=features`)}
                >
                  Activate Add-on
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
              <div className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-mono">
                Scheduling Console
              </div>
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Service Appointments
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="dark"
              size="sm"
              icon={Plus}
              className="h-8 text-xs font-bold shadow-xs"
              onClick={() => setShowManualDialog(true)}
            >
              Add Appointment
            </Button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto scrollbar-none">
          {[
            { id: "appointments", label: "Appointments List" },
            { id: "scheduler", label: "Daily Calendar" },
            { id: "staff", label: "Staff & Shifts" },
            { id: "customers", label: "Customer CRM" },
            { id: "settings", label: "Booking Settings" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 border-b-2 text-xs font-bold transition-all -mb-[1px] whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#FF6A00] text-[#FF6A00]"
                  : "border-transparent text-zinc-550 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── LOADER SKELETON ── */}
        {loadingData ? (
          <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <Loader2 className="animate-spin text-[#FF6A00] mx-auto mb-2" size={24} />
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider font-mono">Loading data...</p>
          </div>
        ) : (
          <>
            {/* ── APPOINTMENTS LIST VIEW ── */}
            {activeTab === "appointments" && (
              <div className="space-y-4">
                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-lg p-0.5 gap-0.5 shadow-3xs">
                    {(["today", "upcoming", "all", "past"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 h-7 rounded-md text-xs font-bold capitalize transition-all ${
                          filter === f
                            ? "bg-[#FF6A00] text-white shadow-3xs"
                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Staff filter */}
                  <select
                    value={selectedStaffFilter}
                    onChange={(e) => setSelectedStaffFilter(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-650 outline-none"
                  >
                    <option value="all">All Staff</option>
                    <option value="any">Unassigned/Any</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>

                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search customer, ID, service..."
                      className="w-full h-8 pl-8 pr-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 text-xs font-medium outline-none focus:border-[#FF6A00]/40 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* Data Table List View */}
                <div className="w-full">
                  <DataTable
                    columns={columns}
                    data={filteredBookings}
                    loading={loadingData}
                    pageSize={10}
                    searchPlaceholder="Search customer, ID, service..."
                  />
                </div>
              </div>
            )}

            {/* ── DAILY SCHEDULER VIEW ── */}
            {activeTab === "scheduler" && (
              <div className="space-y-4">
                <div className="p-3 bg-white dark:bg-zinc-900 border border-black/[0.04] dark:border-zinc-800 rounded-2xl shadow-sm overflow-x-auto scrollbar-thin">
                  <div className="min-w-[600px]">
                    <div className="grid grid-cols-[100px_1fr] border-b border-zinc-100 dark:border-zinc-800 pb-2">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Hour Slot</div>
                      <div className="grid grid-flow-col auto-cols-fr gap-2 text-center text-xs font-bold text-zinc-800 dark:text-zinc-150">
                        {staffList.length === 0 ? (
                          <div>General Capacity</div>
                        ) : (
                          staffList.map((s) => (
                            <div key={s.id} className="border-l border-zinc-100 dark:border-zinc-800 pl-2">
                              {s.name} <span className="text-[9px] font-semibold text-zinc-400">({s.role})</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="divide-y divide-zinc-100 dark:divide-zinc-850">
                      {hourSlots.map((hour) => {
                        const timeString = `${hour.toString().padStart(2, "0")}:00`;
                        const displayHour = `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "AM" : "PM"}`;
                        return (
                          <div key={hour} className="grid grid-cols-[100px_1fr] py-3.5 items-center">
                            <div className="text-xs font-black text-zinc-700 dark:text-zinc-350 font-mono">{displayHour}</div>
                            <div className="grid grid-flow-col auto-cols-fr gap-2 text-center">
                              {staffList.length === 0 ? (
                                // No staff defined - show global bookings for slot
                                (() => {
                                  const slotBookings = bookings.filter((b) => b.date === todayStr && b.time.startsWith(hour.toString().padStart(2, "0")));
                                  return (
                                    <div className="flex flex-col gap-1 items-center">
                                      {slotBookings.length > 0 ? (
                                        slotBookings.map((sb) => (
                                          <div key={sb.id} className="px-2.5 py-1 text-[10px] font-bold bg-[#FF6A00]/10 border border-[#FF6A00]/15 text-[#FF6A00] rounded-md truncate max-w-full">
                                            {sb.customerName} · {sb.serviceName}
                                          </div>
                                        ))
                                      ) : (
                                        <span className="text-[10px] font-medium text-zinc-300 dark:text-zinc-650">Empty</span>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : (
                                staffList.map((staff) => {
                                  const staffBooking = bookings.find(
                                    (b) => b.date === todayStr && b.staffId === staff.id && b.time.startsWith(hour.toString().padStart(2, "0"))
                                  );
                                  // Check if staff is off at this time
                                  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
                                  const sched = staff.weeklySchedule?.[weekday];
                                  const isOff = sched?.isClosed;
                                  
                                  return (
                                    <div key={staff.id} className="border-l border-zinc-150 dark:border-zinc-800 pl-2">
                                      {isOff ? (
                                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider font-mono">Off Day</span>
                                      ) : staffBooking ? (
                                        <div className="px-2.5 py-1 text-[10px] font-bold bg-[#FF6A00]/10 border border-[#FF6A00]/15 text-[#FF6A00] rounded-md truncate text-left shadow-3xs">
                                          <p className="truncate font-black">{staffBooking.customerName}</p>
                                          <p className="text-[8px] text-zinc-400 font-semibold truncate">{staffBooking.serviceName}</p>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] font-medium text-zinc-300 dark:text-zinc-650 italic">Available</span>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── STAFF LIST TAB ── */}
            {activeTab === "staff" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Service Providers</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={Plus}
                    className="h-8 text-xs font-bold"
                    onClick={() => { resetStaffForm(); setShowStaffDialog("create"); }}
                  >
                    Add Staff Member
                  </Button>
                </div>

                <div className="w-full">
                  <DataTable
                    columns={staffColumns}
                    data={staffList}
                    loading={loadingData}
                    pageSize={10}
                    searchKey="name"
                    searchPlaceholder="Search staff by name..."
                  />
                </div>
              </div>
            )}              {/* ── CUSTOMER CRM TAB ── */}
            {activeTab === "customers" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Customer CRM</h3>
                    <p className="text-[11px] text-zinc-400 leading-none mt-1">Unique Customer IDs and total service values logs.</p>
                  </div>
                  <div className="text-[11px] font-bold text-zinc-400 font-mono">
                    {customers.length} Clients Registered
                  </div>
                </div>

                <div className="w-full">
                  <DataTable
                    columns={crmColumns}
                    data={customers}
                    loading={loadingData}
                    pageSize={10}
                    searchKey="name"
                    searchPlaceholder="Search customer by name..."
                  />
                </div>
              </div>
            )}

            {/* ── SETTINGS TAB ── */}
            {activeTab === "settings" && (
              <Card className="p-6 bg-white border border-black/[0.04] dark:border-zinc-800/80 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">Appointment Constraints</h3>
                  <p className="text-[11px] text-zinc-400 font-medium">Global rules governing slot creation and concurrency.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Slot duration */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Time Slot Interval</label>
                    <select
                      value={configForm.slotInterval}
                      onChange={(e) => setConfigForm({ ...configForm, slotInterval: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-250 outline-none"
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes</option>
                      <option value={60}>60 Minutes</option>
                    </select>
                  </div>

                  {/* Buffer time */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Buffer Time (Between Bookings)</label>
                    <input
                      type="number"
                      value={configForm.bufferTime}
                      onChange={(e) => setConfigForm({ ...configForm, bufferTime: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                    />
                  </div>

                  {/* Max Bookings per Slot */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Max Bookings Per Slot (Global Shop Limit)</label>
                    <input
                      type="number"
                      value={configForm.maxBookingsPerSlot}
                      onChange={(e) => setConfigForm({ ...configForm, maxBookingsPerSlot: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                    />
                  </div>

                  {/* Advance Booking Window */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Booking Window (Days in Advance)</label>
                    <input
                      type="number"
                      value={configForm.advanceDays}
                      onChange={(e) => setConfigForm({ ...configForm, advanceDays: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-150 dark:border-zinc-800/80 pt-6">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">Charges & Cancellation Policy</h3>
                  <p className="text-[11px] text-zinc-400 font-medium">Configure booking fees and cancel window thresholds.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Fee type */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Pricing Model</label>
                    <select
                      value={configForm.bookingFeeType}
                      onChange={(e) => setConfigForm({ ...configForm, bookingFeeType: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-250 outline-none"
                    >
                      <option value="free">Free Booking (Pay at Shop)</option>
                      <option value="deposit">Token Deposit Required</option>
                      <option value="full">100% Prepayment Required</option>
                    </select>
                  </div>

                  {/* Deposit Amount */}
                  {configForm.bookingFeeType === "deposit" && (
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Token Deposit Amount (₹)</label>
                      <input
                        type="number"
                        value={configForm.depositAmount}
                        onChange={(e) => setConfigForm({ ...configForm, depositAmount: Number(e.target.value) })}
                        className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                      />
                    </div>
                  )}

                  {/* Cancellation Hours */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Cancellation Notice Period (Hours)</label>
                    <input
                      type="number"
                      value={configForm.cancellationHours}
                      onChange={(e) => setConfigForm({ ...configForm, cancellationHours: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                    />
                  </div>

                  {/* Cancellation Charges */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Late Cancellation Penalty Rate</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={configForm.cancellationCharges}
                        onChange={(e) => setConfigForm({ ...configForm, cancellationCharges: Number(e.target.value) })}
                        className="flex-1 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                      />
                      <select
                        value={configForm.cancellationChargeType}
                        onChange={(e) => setConfigForm({ ...configForm, cancellationChargeType: e.target.value })}
                        className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                      >
                        <option value="flat">₹ Flat</option>
                        <option value="percent">% Percent</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800/80 flex justify-end">
                  <Button
                    variant="dark"
                    size="sm"
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="font-bold h-9 text-xs"
                  >
                    {savingConfig ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* ── MANUAL WALK-IN BOOKING DIALOG ── */}
      {showManualDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-black/[0.08] dark:border-zinc-800 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Add Walk-in Appointment</h3>
              <button onClick={() => setShowManualDialog(false)} className="text-zinc-450"><X size={16} /></button>
            </div>

            <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto scrollbar-thin">
              {/* Customer Lookup Search */}
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase">Lookup CRM Customer by Phone</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter phone number..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="flex-1 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                  />
                  <button
                    onClick={() => {
                      const user = customers.find(c => c.phone === customerSearchQuery);
                      if (user) {
                        setSelectedCRMUser(user);
                        setManualForm({
                          ...manualForm,
                          customerName: user.name,
                          customerPhone: user.phone,
                          customerEmail: user.email || ""
                        });
                        showAlert({
                          title: "Customer Linked",
                          message: `Found customer: ${user.name} (${user.customerId})`,
                          type: "success",
                        });
                      } else {
                        showAlert({
                          title: "No Record Found",
                          message: "Customer not found. You can fill out details below to create a new profile.",
                          type: "info",
                        });
                        setSelectedCRMUser(null);
                      }
                    }}
                    className="px-3 bg-zinc-100 border border-zinc-200 text-zinc-650 hover:bg-zinc-150 rounded-lg text-xs font-bold"
                  >
                    Search
                  </button>
                </div>
                {selectedCRMUser && (
                  <p className="text-[10px] text-emerald-600 font-bold">
                    ✓ Linked to Customer ID: {selectedCRMUser.customerId}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase">Customer Name</label>
                  <input
                    type="text"
                    value={manualForm.customerName}
                    onChange={(e) => setManualForm({ ...manualForm, customerName: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase">Customer Phone</label>
                  <input
                    type="text"
                    value={manualForm.customerPhone}
                    disabled={!!selectedCRMUser}
                    onChange={(e) => setManualForm({ ...manualForm, customerPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none disabled:bg-zinc-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase">Email (Optional)</label>
                <input
                  type="email"
                  value={manualForm.customerEmail}
                  onChange={(e) => setManualForm({ ...manualForm, customerEmail: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase">Service Name</label>
                  <select
                    value={manualForm.serviceName}
                    onChange={(e) => {
                      const selected = catalogServices.find(s => s.name === e.target.value);
                      setManualForm({
                        ...manualForm,
                        serviceName: e.target.value,
                        price: selected ? Number(selected.price) || 0 : 0,
                        duration: selected ? Number(selected.serviceDetails?.duration) || 30 : 30
                      });
                    }}
                    className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                  >
                    <option value="">Select Service...</option>
                    {catalogServices.map((cs: any, idx: number) => (
                      <option key={idx} value={cs.name}>{cs.name} (₹{cs.price})</option>
                    ))}
                    <option value="custom">Custom Service...</option>
                  </select>
                </div>
                {manualForm.serviceName === "custom" && (
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase">Custom Service Name</label>
                    <input
                      type="text"
                      placeholder="E.g. Full Beard Trim"
                      onChange={(e) => setManualForm({ ...manualForm, serviceName: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase">Price (₹)</label>
                  <input
                    type="number"
                    value={manualForm.price}
                    onChange={(e) => setManualForm({ ...manualForm, price: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase">Duration (mins)</label>
                  <input
                    type="number"
                    value={manualForm.duration}
                    onChange={(e) => setManualForm({ ...manualForm, duration: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase">Staff Assigned</label>
                  <select
                    value={manualForm.staffId}
                    onChange={(e) => setManualForm({ ...manualForm, staffId: e.target.value })}
                    className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                  >
                    <option value="">Any Stylist/Doctor</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase">Time Slot</label>
                  <input
                    type="time"
                    value={manualForm.time}
                    onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase">Date</label>
                <input
                  type="date"
                  value={manualForm.date}
                  min={getLocalTodayStr()}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase">Special Instructions</label>
                <textarea
                  value={manualForm.notes}
                  rows={2}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-zinc-100 dark:border-zinc-800 justify-end bg-zinc-50 dark:bg-zinc-900/50">
              <button
                onClick={() => setShowManualDialog(false)}
                className="h-9 px-4 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-650"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateManualBooking}
                disabled={savingManual}
                className="h-9 px-4 rounded-xl bg-[#FF6A00] hover:bg-[#e55a00] text-white text-xs font-bold disabled:opacity-60 flex items-center gap-1.5"
              >
                {savingManual ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />} Book Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STAFF EDIT/CREATE DIALOG ── */}
      {showStaffDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-black/[0.08] dark:border-zinc-800 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {showStaffDialog === "create" ? "Add Staff Member" : `Edit Staff: ${staffForm.name}`}
              </h3>
              <button onClick={() => setShowStaffDialog(null)} className="text-zinc-450"><X size={16} /></button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase">Staff Name</label>
                  <input
                    type="text"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase">Role / Title</label>
                  <input
                    type="text"
                    placeholder="E.g. Stylist, Surgeon"
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase">Max Concurrency Limit</label>
                  <input
                    type="number"
                    value={staffForm.maxConcurrentClients}
                    onChange={(e) => setStaffForm({ ...staffForm, maxConcurrentClients: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold outline-none"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-650 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={staffForm.active}
                      onChange={(e) => setStaffForm({ ...staffForm, active: e.target.checked })}
                      className="rounded border-zinc-250 text-[#FF6A00]"
                    />
                    Is Provider Active
                  </label>
                </div>
              </div>

              {/* Service Assignments */}
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Services Assigned</label>
                <div className="grid grid-cols-2 gap-2 border border-zinc-100 p-2.5 rounded-lg max-h-36 overflow-y-auto bg-zinc-50 dark:bg-zinc-950/20">
                  {catalogServices.map((cs: any, idx: number) => {
                    const isChecked = staffForm.assignedServices?.includes(cs.name);
                    return (
                      <label key={idx} className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-350 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let list = staffForm.assignedServices || [];
                            if (e.target.checked) {
                              list = [...list, cs.name];
                            } else {
                              list = list.filter(item => item !== cs.name);
                            }
                            setStaffForm({ ...staffForm, assignedServices: list });
                          }}
                          className="rounded border-zinc-250 text-[#FF6A00]"
                        />
                        {cs.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Weekly Shift Hours */}
              <div className="border-t border-zinc-100 pt-3">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-2">Weekly Schedule Shifts</label>
                <div className="space-y-2">
                  {DEFAULT_DAYS.map((day) => {
                    const daySched = staffForm.weeklySchedule?.[day] || { isClosed: true, shifts: [] };
                    return (
                      <div key={day} className="flex items-center gap-3 justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/20">
                        <span className="text-xs capitalize font-bold text-zinc-700 w-16">{day.slice(0, 3)}</span>
                        <div className="flex-1 flex gap-2 items-center">
                          {daySched.isClosed ? (
                            <span className="text-[10px] font-bold text-red-400 uppercase">Closed / Off Day</span>
                          ) : (
                            daySched.shifts?.map((shift: any, sIdx: number) => (
                              <div key={sIdx} className="flex items-center gap-1.5 text-xs">
                                <input
                                  type="time"
                                  value={shift.open}
                                  onChange={(e) => {
                                    const shifts = [...daySched.shifts];
                                    shifts[sIdx].open = e.target.value;
                                    setStaffForm({
                                      ...staffForm,
                                      weeklySchedule: {
                                        ...staffForm.weeklySchedule,
                                        [day]: { ...daySched, shifts }
                                      }
                                    });
                                  }}
                                  className="h-7 px-1.5 border border-zinc-200 rounded text-xs outline-none bg-white font-medium"
                                />
                                <span className="text-zinc-400 font-bold">-</span>
                                <input
                                  type="time"
                                  value={shift.close}
                                  onChange={(e) => {
                                    const shifts = [...daySched.shifts];
                                    shifts[sIdx].close = e.target.value;
                                    setStaffForm({
                                      ...staffForm,
                                      weeklySchedule: {
                                        ...staffForm.weeklySchedule,
                                        [day]: { ...daySched, shifts }
                                      }
                                    });
                                  }}
                                  className="h-7 px-1.5 border border-zinc-200 rounded text-xs outline-none bg-white font-medium"
                                />
                              </div>
                            ))
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const newDaySched = {
                              isClosed: !daySched.isClosed,
                              shifts: daySched.isClosed ? [{ open: "09:00", close: "18:00" }] : []
                            };
                            setStaffForm({
                              ...staffForm,
                              weeklySchedule: {
                                ...staffForm.weeklySchedule,
                                [day]: newDaySched
                              }
                            });
                          }}
                          className={`h-7 px-2.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-colors ${
                            daySched.isClosed
                              ? "border-emerald-250 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                              : "border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                          }`}
                        >
                          {daySched.isClosed ? "Open" : "Close"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-zinc-100 dark:border-zinc-800 justify-end bg-zinc-50 dark:bg-zinc-900/50">
              <button
                onClick={() => setShowStaffDialog(null)}
                className="h-9 px-4 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-650"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStaff}
                disabled={savingStaff}
                className="h-9 px-4 rounded-xl bg-[#0A0A0F] hover:bg-black text-white text-xs font-bold disabled:opacity-60 flex items-center gap-1.5"
              >
                {savingStaff ? <Loader2 size={12} className="animate-spin" /> : <Check size={14} />} Save Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <Dialog
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          title={confirmAction.title}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs font-semibold text-zinc-650 dark:text-zinc-400 leading-relaxed">
              {confirmAction.message}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="h-8 px-3.5 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-650 hover:bg-zinc-50 cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={async () => {
                  await confirmAction.onConfirm();
                  setConfirmAction(null);
                }}
                className={`h-8 px-3.5 rounded-lg text-white text-xs font-bold cursor-pointer ${
                  confirmAction.variant === "danger"
                    ? "bg-red-500 hover:bg-red-600 shadow-sm"
                    : "bg-[#FF6A00] hover:bg-[#e55a00] shadow-sm"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
