export interface Table {
  id: string;
  name: string;
  capacity: number;
  shape: string;
  active: boolean;
  currentSessionId?: string | null;
  mergedInto?: string | null;
  createdAt: number;
  bookingPrice?: number;
}

export interface SessionGuest {
  name: string;
  phone?: string;
  joinedAt: number;
}

export interface Session {
  id: string;
  tableId: string;
  tableName: string;
  sessionId: string;
  customerName: string;
  customerPhone?: string;
  guests?: Record<string, SessionGuest>;
  guestCount?: number;
  status: 'pending' | 'active' | 'closed' | 'rejected';
  createdAt: number;
  closedAt?: number;
}

export interface OrderItem {
  name: string;
  price: number;
  qty: number;
  unit?: string;
  status?: 'placed' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
}

export interface Order {
  id: string;
  sessionId: string;
  items: OrderItem[];
  status: 'placed' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
  note?: string;
  tableId: string;
  tableName: string;
  placedAt: number;
  confirmedAt?: number;
  preparingAt?: number;
  readyAt?: number;
  servedAt?: number;
  cancelledAt?: number;
}

export interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  notes?: string;
  tablePreference?: string;
  tableId?: string;
  tableName?: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'seated' | 'cancelled' | 'no_show';
  createdAt: number;
  updatedAt?: number;
  seatedAt?: number;
  sessionId?: string;
  bookingPrice?: number;
  paymentStatus?: 'paid' | 'unpaid';
  paymentTxnId?: string;
  payoutStatus?: 'unpaid' | 'paid';
  payoutTxnId?: string;
  payoutSettledAt?: number;
  cancelledBy?: 'customer' | 'merchant';
  refundAmount?: number;
  cancellationCharges?: number;
  refundStatus?: 'none' | 'pending' | 'refunded';
  refundTxnId?: string;
  refundSettledAt?: number;
}
