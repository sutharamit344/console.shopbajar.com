import { rtdb } from "./firebase";
import {
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  off,
} from "firebase/database";

import { Table, SessionGuest, Session, OrderItem, Order, Booking } from "../types";
export type { Table, SessionGuest, Session, OrderItem, Order, Booking };

// ─── TABLE MANAGEMENT ────────────────────────────────────────────

export async function getTables(shopId: string): Promise<Table[]> {
  const snap = await get(ref(rtdb, `qr_tables/${shopId}`));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
}

export async function addTable(
  shopId: string, 
  { name, capacity = 4, shape = "round", bookingPrice = 0 }: { name: string; capacity?: number | string; shape?: string; bookingPrice?: number | string }
) {
  const tableRef = push(ref(rtdb, `qr_tables/${shopId}`));
  await set(tableRef, {
    name,
    capacity: Number(capacity),
    shape,
    active: true,
    currentSessionId: null,
    createdAt: Date.now(),
    bookingPrice: Number(bookingPrice) || 0,
  });
  return tableRef.key;
}

export async function updateTable(shopId: string, tableId: string, data: Partial<Table>) {
  await update(ref(rtdb, `qr_tables/${shopId}/${tableId}`), data);
}

export async function deleteTable(shopId: string, tableId: string) {
  await remove(ref(rtdb, `qr_tables/${shopId}/${tableId}`));
}

export function listenTables(shopId: string, callback: (tables: Table[]) => void) {
  const r = ref(rtdb, `qr_tables/${shopId}`);
  const handler = (snap: any) => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.val();
    callback(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

export async function getTable(shopId: string, tableId: string): Promise<Table | null> {
  const snap = await get(ref(rtdb, `qr_tables/${shopId}/${tableId}`));
  if (!snap.exists()) return null;
  return { id: snap.key!, ...snap.val() };
}

export async function mergeTables(shopId: string, sourceTableId: string, targetTableId: string) {
  await update(ref(rtdb, `qr_tables/${shopId}/${sourceTableId}`), {
    mergedInto: targetTableId,
  });
  const targetSnap = await get(ref(rtdb, `qr_tables/${shopId}/${targetTableId}/currentSessionId`));
  if (targetSnap.exists() && targetSnap.val()) {
    await set(ref(rtdb, `qr_tables/${shopId}/${sourceTableId}/currentSessionId`), targetSnap.val());
  }
}

export async function unmergeTable(shopId: string, tableId: string) {
  await update(ref(rtdb, `qr_tables/${shopId}/${tableId}`), {
    mergedInto: null,
    currentSessionId: null,
  });
}

// ─── SESSION MANAGEMENT ───────────────────────────────────────────

export async function getTableName(shopId: string, tableId: string): Promise<string> {
  const snap = await get(ref(rtdb, `qr_tables/${shopId}/${tableId}`));
  if (!snap.exists()) return `Table ${tableId}`;
  return snap.val().name || `Table ${tableId}`;
}

export async function createSession(shopId: string, tableId: string, tableName: string, requireApproval: boolean, customerName = "", customerPhone = "", customerId = "", guestCount = 1) {
  const sessRef = push(ref(rtdb, `qr_sessions/${shopId}`));
  const sessionId = sessRef.key!;

  const creatorId = customerId || "creator_" + Math.random().toString(36).substring(2, 11);
  const guests: Record<string, SessionGuest> = {};
  if (customerName) {
    guests[creatorId] = {
      name: customerName,
      phone: customerPhone,
      joinedAt: Date.now()
    };
  }

  await set(sessRef, {
    tableId,
    tableName,
    sessionId,
    customerName,
    customerPhone,
    guests,
    guestCount: Number(guestCount) || 1,
    status: requireApproval ? "pending" : "active",
    createdAt: Date.now(),
  });

  try {
    const tableSnap = await get(ref(rtdb, `qr_tables/${shopId}/${tableId}`));
    const tableVal = tableSnap.val();
    const leaderId = (tableVal && tableVal.mergedInto) ? tableVal.mergedInto : tableId;

    const tablesSnap = await get(ref(rtdb, `qr_tables/${shopId}`));
    const updates: Record<string, string | null> = {};
    
    if (tablesSnap.exists()) {
      const allTables = tablesSnap.val();
      Object.keys(allTables).forEach((tId) => {
        const t = allTables[tId];
        const tLeaderId = t.mergedInto || tId;
        if (tLeaderId === leaderId) {
          updates[`${tId}/currentSessionId`] = sessionId;
        }
      });
    } else {
      updates[`${tableId}/currentSessionId`] = sessionId;
    }

    await update(ref(rtdb, `qr_tables/${shopId}`), updates);
  } catch (err) {
    console.error("Error setting currentSessionId for group: ", err);
    await set(ref(rtdb, `qr_tables/${shopId}/${tableId}/currentSessionId`), sessionId);
  }
  
  return sessionId;
}

export async function joinSession(shopId: string, sessionId: string, customerName: string, customerPhone: string, customerId: string) {
  if (!customerId || !sessionId) return;
  const guestRef = ref(rtdb, `qr_sessions/${shopId}/${sessionId}/guests/${customerId}`);
  await set(guestRef, {
    name: customerName,
    phone: customerPhone,
    joinedAt: Date.now()
  });
}

export async function getSession(shopId: string, sessionId: string): Promise<Session | null> {
  const snap = await get(ref(rtdb, `qr_sessions/${shopId}/${sessionId}`));
  if (!snap.exists()) return null;
  return { id: snap.key!, ...snap.val() };
}

export function listenSession(shopId: string, sessionId: string, callback: (session: Session | null) => void) {
  const r = ref(rtdb, `qr_sessions/${shopId}/${sessionId}`);
  const handler = (snap: any) => {
    if (!snap.exists()) { callback(null); return; }
    callback({ id: snap.key!, ...snap.val() });
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

export async function updateSessionStatus(shopId: string, sessionId: string, status: Session['status']) {
  await update(ref(rtdb, `qr_sessions/${shopId}/${sessionId}`), { status });
}

export async function approveSession(shopId: string, sessionId: string, tableId: string) {
  await update(ref(rtdb, `qr_sessions/${shopId}/${sessionId}`), { status: "active" });

  try {
    const sessionSnap = await get(ref(rtdb, `qr_sessions/${shopId}/${sessionId}`));
    if (sessionSnap.exists()) {
      const sessionVal = sessionSnap.val();
      const customerPhone = sessionVal.customerPhone;
      const sessionTableId = sessionVal.tableId || tableId;

      const bookingsSnap = await get(ref(rtdb, `qr_bookings/${shopId}`));
      if (bookingsSnap.exists()) {
        const bookingsVal = bookingsSnap.val();
        let matchedBookingId: string | null = null;

        for (const [bId, booking] of Object.entries<any>(bookingsVal)) {
          if (booking.status === "seated" || booking.status === "cancelled") {
            continue;
          }

          if (customerPhone && booking.customerPhone &&
              customerPhone.trim().replace(/\D/g, "") === booking.customerPhone.trim().replace(/\D/g, "")) {
            matchedBookingId = bId;
            break;
          }

          const todayStr = new Date().toISOString().split("T")[0];
          if (booking.tableId === sessionTableId && booking.date === todayStr) {
            matchedBookingId = bId;
          }
        }

        if (matchedBookingId) {
          const matchedBooking = bookingsVal[matchedBookingId];
          await update(ref(rtdb, `qr_bookings/${shopId}/${matchedBookingId}`), {
            status: 'seated',
            tableId: sessionTableId,
            tableName: sessionVal.tableName || matchedBooking.tableName || "",
            sessionId: sessionId,
            seatedAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    }
  } catch (err) {
    console.error("Error auto-seating booking on session approval:", err);
  }

  try {
    const tableSnap = await get(ref(rtdb, `qr_tables/${shopId}/${tableId}`));
    const tableVal = tableSnap.val();
    const leaderId = (tableVal && tableVal.mergedInto) ? tableVal.mergedInto : tableId;

    const tablesSnap = await get(ref(rtdb, `qr_tables/${shopId}`));
    const updates: Record<string, string | null> = {};
    
    if (tablesSnap.exists()) {
      const allTables = tablesSnap.val();
      Object.keys(allTables).forEach((tId) => {
        const t = allTables[tId];
        const tLeaderId = t.mergedInto || tId;
        if (tLeaderId === leaderId) {
          updates[`${tId}/currentSessionId`] = sessionId;
        }
      });
    } else {
      updates[`${tableId}/currentSessionId`] = sessionId;
    }

    await update(ref(rtdb, `qr_tables/${shopId}`), updates);
  } catch (err) {
    console.error("Error setting currentSessionId on approval: ", err);
    await set(ref(rtdb, `qr_tables/${shopId}/${tableId}/currentSessionId`), sessionId);
  }
}

export async function closeSession(
  shopId: string,
  sessionId: string,
  tableId: string,
  checkoutData?: {
    collectedBy?: string;
    paymentMethod?: string;
    billAmount?: number;
    items?: any[];
  }
) {
  let isPending = false;
  try {
    const sessionSnap = await get(ref(rtdb, `qr_sessions/${shopId}/${sessionId}`));
    if (sessionSnap.exists()) {
      const sVal = sessionSnap.val();
      isPending = sVal && sVal.status === "pending";
    }
  } catch (e) {
    console.error("Error checking session status before close:", e);
  }

  const updateData: any = {
    status: isPending ? "rejected" : "closed",
    closedAt: Date.now(),
  };

  if (checkoutData) {
    if (checkoutData.collectedBy !== undefined) updateData.collectedBy = checkoutData.collectedBy;
    if (checkoutData.paymentMethod !== undefined) updateData.paymentMethod = checkoutData.paymentMethod;
    if (checkoutData.billAmount !== undefined) updateData.billAmount = checkoutData.billAmount;
    if (checkoutData.items !== undefined) updateData.items = checkoutData.items;
  }

  await update(ref(rtdb, `qr_sessions/${shopId}/${sessionId}`), updateData);

  let nextSessionId: string | null = null;
  try {
    const tableSnap = await get(ref(rtdb, `qr_tables/${shopId}/${tableId}`));
    const tableVal = tableSnap.val();
    const leaderId = (tableVal && tableVal.mergedInto) ? tableVal.mergedInto : tableId;

    const sessionsSnap = await get(ref(rtdb, `qr_sessions/${shopId}`));
    const tablesSnap = await get(ref(rtdb, `qr_tables/${shopId}`));
    
    if (sessionsSnap.exists() && tablesSnap.exists()) {
      const allSessions = sessionsSnap.val();
      const allTables = tablesSnap.val();
      
      const otherActive = Object.values(allSessions).find((s: any) => {
        if (s.sessionId === sessionId || (s.status !== "active" && s.status !== "pending")) return false;
        const sTable = allTables[s.tableId];
        const sTableLeaderId = (sTable && sTable.mergedInto) ? sTable.mergedInto : s.tableId;
        return sTableLeaderId === leaderId;
      });

      if (otherActive) {
        nextSessionId = (otherActive as any).sessionId;
      }
    }

    const updates: Record<string, string | null> = {};
    if (tablesSnap.exists()) {
      const allTables = tablesSnap.val();
      Object.keys(allTables).forEach((tId) => {
        const t = allTables[tId];
        const tLeaderId = t.mergedInto || tId;
        if (tLeaderId === leaderId) {
          updates[`${tId}/currentSessionId`] = nextSessionId;
        }
      });
    } else {
      updates[`${tableId}/currentSessionId`] = nextSessionId;
    }

    await update(ref(rtdb, `qr_tables/${shopId}`), updates);
  } catch (err) {
    console.error("Error updating group session reference on close: ", err);
    await set(ref(rtdb, `qr_tables/${shopId}/${tableId}/currentSessionId`), null);
  }
}

export function listenSessions(shopId: string, callback: (sessions: Session[]) => void) {
  const r = ref(rtdb, `qr_sessions/${shopId}`);
  const handler = (snap: any) => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.val();
    callback(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

// ─── ORDER MANAGEMENT ─────────────────────────────────────────────

export async function placeOrder(shopId: string, sessionId: string, tableId: string, tableName: string, items: OrderItem[], note = "") {
  const orderRef = push(ref(rtdb, `qr_orders/${shopId}/${sessionId}`));
  await set(orderRef, {
    items,
    status: "placed",
    note,
    tableId,
    tableName,
    placedAt: Date.now(),
  });
  return orderRef.key;
}

export async function updateOrderStatus(shopId: string, sessionId: string, orderId: string, status: Order['status']) {
  await update(ref(rtdb, `qr_orders/${shopId}/${sessionId}/${orderId}`), {
    status,
    [`${status}At`]: Date.now(),
  });
}

export async function updateOrderItemStatus(shopId: string, sessionId: string, orderId: string, itemIndex: number, status: OrderItem['status']) {
  const itemRef = ref(rtdb, `qr_orders/${shopId}/${sessionId}/${orderId}/items/${itemIndex}`);
  await update(itemRef, { status });

  const orderRef = ref(rtdb, `qr_orders/${shopId}/${sessionId}/${orderId}`);
  const snap = await get(orderRef);
  if (snap.exists()) {
    const order = snap.val();
    if (order.items && order.items.length > 0) {
      const itemStatuses = order.items.map((item: any, idx: number) => 
        idx === itemIndex ? status : (item.status || "placed")
      );
      
      const nonCancelled = itemStatuses.filter((s: string) => s !== "cancelled");
      if (nonCancelled.length === 0) {
        await update(orderRef, { status: "cancelled", cancelledAt: Date.now() });
      } else {
        if (nonCancelled.every((s: string) => s === "served")) {
          await update(orderRef, { status: "served", servedAt: Date.now() });
        } else if (nonCancelled.every((s: string) => s === "ready" || s === "served")) {
          await update(orderRef, { status: "ready", readyAt: Date.now() });
        } else if (nonCancelled.some((s: string) => s === "preparing" || s === "ready" || s === "served")) {
          await update(orderRef, { status: "preparing", preparingAt: Date.now() });
        } else if (nonCancelled.some((s: string) => s === "confirmed")) {
          await update(orderRef, { status: "confirmed", confirmedAt: Date.now() });
        } else {
          await update(orderRef, { status: "placed" });
        }
      }
    }
  }
}

export function listenSessionOrders(shopId: string, sessionId: string, callback: (orders: Order[]) => void) {
  const r = ref(rtdb, `qr_orders/${shopId}/${sessionId}`);
  const handler = (snap: any) => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.val();
    callback(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

export function listenAllOrders(shopId: string, callback: (orders: Order[]) => void) {
  const r = ref(rtdb, `qr_orders/${shopId}`);
  const handler = (snap: any) => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.val();
    const allOrders: Order[] = [];
    Object.entries(data).forEach(([sessionId, orders]: [string, any]) => {
      Object.entries(orders).forEach(([orderId, order]: [string, any]) => {
        allOrders.push({ id: orderId, sessionId, ...order });
      });
    });
    callback(allOrders);
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

export async function getSessionOrders(shopId: string, sessionId: string): Promise<Order[]> {
  const snap = await get(ref(rtdb, `qr_orders/${shopId}/${sessionId}`));
  if (!snap.exists()) return [];
  const data = snap.val();
  const allOrders: Order[] = [];
  Object.entries(data).forEach(([orderId, order]: [string, any]) => {
    allOrders.push({ id: orderId, sessionId, ...order });
  });
  return allOrders;
}

// ─── TABLE BOOKING MANAGEMENT ─────────────────────────────────────



export async function createBooking(shopId: string, data: Omit<Booking, 'id' | 'status' | 'createdAt'>) {
  const bookingRef = push(ref(rtdb, `qr_bookings/${shopId}`));
  await set(bookingRef, {
    ...data,
    status: 'pending',
    createdAt: Date.now(),
  });
  return bookingRef.key;
}

export function listenBookings(shopId: string, callback: (bookings: Booking[]) => void) {
  const r = ref(rtdb, `qr_bookings/${shopId}`);
  const handler = (snap: any) => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.val();
    callback(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export async function updateBooking(shopId: string, bookingId: string, data: Partial<Booking>) {
  await update(ref(rtdb, `qr_bookings/${shopId}/${bookingId}`), {
    ...data,
    updatedAt: Date.now(),
  });
}

export async function confirmBooking(shopId: string, bookingId: string) {
  await update(ref(rtdb, `qr_bookings/${shopId}/${bookingId}`), {
    status: 'confirmed',
    updatedAt: Date.now(),
  });
}

export async function rejectBooking(shopId: string, bookingId: string) {
  await update(ref(rtdb, `qr_bookings/${shopId}/${bookingId}`), {
    status: 'rejected',
    updatedAt: Date.now(),
  });
}

export async function cancelBooking(shopId: string, bookingId: string) {
  await update(ref(rtdb, `qr_bookings/${shopId}/${bookingId}`), {
    status: 'cancelled',
    updatedAt: Date.now(),
  });
}

export async function seatBooking(
  shopId: string,
  bookingId: string,
  tableId: string,
  tableName: string,
  sessionId: string
) {
  await update(ref(rtdb, `qr_bookings/${shopId}/${bookingId}`), {
    status: 'seated',
    tableId,
    tableName,
    sessionId,
    seatedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

// ─── APPOINTMENT BOOKING MANAGEMENT ─────────────────────────────────

export interface AppointmentBooking {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceId: string;
  serviceName: string;
  duration: number;
  price: number;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  endTime: string; // HH:mm
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'rejected';
  paymentStatus: 'unpaid' | 'paid';
  paymentTxnId?: string;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
}

export async function createAppointmentBooking(shopId: string, data: Omit<AppointmentBooking, 'id' | 'status' | 'createdAt'>) {
  const bookingRef = push(ref(rtdb, `appointment_bookings/${shopId}`));
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );
  await set(bookingRef, {
    ...cleanData,
    status: 'pending',
    createdAt: Date.now(),
  });
  return bookingRef.key;
}

export function listenAppointmentBookings(shopId: string, callback: (bookings: AppointmentBooking[]) => void) {
  const r = ref(rtdb, `appointment_bookings/${shopId}`);
  const handler = (snap: any) => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.val();
    callback(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val } as AppointmentBooking)));
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export async function updateAppointmentBooking(shopId: string, bookingId: string, data: Partial<AppointmentBooking>) {
  await update(ref(rtdb, `appointment_bookings/${shopId}/${bookingId}`), {
    ...data,
    updatedAt: Date.now(),
  });
}

export async function confirmAppointmentBooking(shopId: string, bookingId: string) {
  await update(ref(rtdb, `appointment_bookings/${shopId}/${bookingId}`), {
    status: 'confirmed',
    updatedAt: Date.now(),
  });
}

export async function rejectAppointmentBooking(shopId: string, bookingId: string) {
  await update(ref(rtdb, `appointment_bookings/${shopId}/${bookingId}`), {
    status: 'rejected',
    updatedAt: Date.now(),
  });
}

export async function cancelAppointmentBooking(shopId: string, bookingId: string) {
  await update(ref(rtdb, `appointment_bookings/${shopId}/${bookingId}`), {
    status: 'cancelled',
    updatedAt: Date.now(),
  });
}


