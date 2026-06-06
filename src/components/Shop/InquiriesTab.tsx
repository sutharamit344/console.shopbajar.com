import React, { useState, useEffect } from "react";
import { getShopInquiries, updateInquiryStatus, updateInquiryItems } from "../../lib/db";
import { MessageSquare, Phone, Calendar, Loader2, ShoppingBag, CheckCircle2, Clock, Check, X, FileText, Printer, Download, Eye, Mail, Search, Plus, Trash2 } from "lucide-react";
import Button from "../UI/Button";
import Dialog from "../UI/Dialog";

interface InquiriesTabProps {
  shop: any;
}

const InquiriesTab: React.FC<InquiriesTabProps> = ({ shop }) => {
  const hasInvoiceTools = !!shop?.paidFeatures?.billing_system?.enabled || !!shop?.paidFeatures?.invoice_tools?.enabled;
  const hasPosSlipTools = !!shop?.paidFeatures?.billing_system?.enabled || !!shop?.paidFeatures?.pos_slip_tools?.enabled;
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);

  const [editItems, setEditItems] = useState<any[]>([]);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  const allShopItems = React.useMemo(() => {
    if (!shop?.menu) return [];
    const items: any[] = [];
    shop.menu.forEach((cat: any) => {
      if (cat.items && Array.isArray(cat.items)) {
        cat.items.forEach((item: any) => {
          items.push({
            name: item.name || "",
            price: Number(item.price || 0)
          });
        });
      }
    });
    return items;
  }, [shop?.menu]);

  const getSuggestions = (query: string) => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return allShopItems.slice(0, 5);
    return allShopItems.filter(item =>
      item.name.toLowerCase().includes(q)
    ).slice(0, 5);
  };

  const handleSelectSuggestion = (index: number, prod: any) => {
    setEditItems(prev =>
      prev.map((item, idx) => {
        if (idx === index) {
          return {
            ...item,
            name: prod.name,
            price: prod.price
          };
        }
        return item;
      })
    );
    setFocusedIndex(null);
  };

  useEffect(() => {
    if (selectedInquiry) {
      setEditItems(selectedInquiry.items || []);
    } else {
      setEditItems([]);
      setPendingDeleteIndex(null);
    }
  }, [selectedInquiry]);

  const editTotal = editItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );

  const handleEditItemField = (index: number, field: string, value: any) => {
    setEditItems(prev =>
      prev.map((item, idx) => {
        if (idx === index) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (index: number) => {
    setEditItems(prev => prev.filter((_, idx) => idx !== index));
    setPendingDeleteIndex(null);
  };

  const handleAddNewItem = () => {
    setEditItems(prev => [...prev, { name: "", quantity: 1, price: 0 }]);
  };

  const handleSaveInvoice = async () => {
    if (!selectedInquiry) return;
    setSavingInvoice(true);
    const result = await updateInquiryItems(selectedInquiry.id, editItems, editTotal);
    if (result.success) {
      setInquiries(prev =>
        prev.map(inq => {
          if (inq.id === selectedInquiry.id) {
            return {
              ...inq,
              items: editItems,
              totalAmount: editTotal
            };
          }
          return inq;
        })
      );
      setSelectedInquiry(prev => ({
        ...prev,
        items: editItems,
        totalAmount: editTotal
      }));
    } else {
      alert("Failed to save invoice changes: " + result.error);
    }
    setSavingInvoice(false);
  };

  const filteredInquiries = inquiries.filter(inquiry => {
    if (inquiry.type !== "Dashboard Inquiry") return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();

    const nameMatch = inquiry.customerName?.toLowerCase().includes(query);
    const phoneMatch = inquiry.customerPhone?.toLowerCase().includes(query);
    const emailMatch = inquiry.customerEmail?.toLowerCase().includes(query);
    const itemMatch = inquiry.items?.some((item: any) => item.name?.toLowerCase().includes(query));

    return nameMatch || phoneMatch || emailMatch || itemMatch;
  });

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window === "undefined") return;
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 200
      ) {
        setVisibleCount(prev => Math.min(prev + 10, filteredInquiries.length));
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [filteredInquiries.length]);

  const fetchInquiries = async () => {
    if (!shop?.id) return;
    setLoading(true);
    const data = await getShopInquiries(shop.id);
    setInquiries(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchInquiries();
  }, [shop?.id]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    await updateInquiryStatus(id, newStatus);
    await fetchInquiries();
    setUpdatingId(null);
  };

  const handleWhatsAppReply = (phone: string, items: any[], total: number) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, "");
    const itemList = (items || []).map(i => `${i.name} (${i.quantity})`).join(", ");
    const message = `Hi! This is *${shop.name}*. We received your inquiry for:\n\n${itemList}\nEstimated Total: ₹${total}\n\nWe are pleased to confirm your order details. How would you like to proceed?`;
    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handlePrintInvoice = (inquiry: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStr = inquiry.createdAt ? new Date(inquiry.createdAt).toLocaleDateString() : new Date().toLocaleDateString();

    const itemListHTML = (inquiry.items || []).map((item: any, index: number) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${index + 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: bold;">${item.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${item.price ? `₹${item.price}` : 'N/A'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${item.price ? `₹${item.price * item.quantity}` : 'N/A'}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${shop.name}</title>
        <style>
          body { font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; padding: 40px; margin: 0 auto; max-width: 800px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; }
          .shop-details h1 { margin: 0 0 5px 0; color: #FF6A00; font-size: 28px; }
          .shop-details p { margin: 0; color: #666; font-size: 14px;}
          .invoice-details { text-align: right; }
          .invoice-details h2 { margin: 0 0 5px 0; color: #333; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
          .invoice-details p { margin: 0; color: #666; font-size: 14px;}
          .customer-details { margin-bottom: 40px; }
          .customer-details p { margin:0; }
          .customer-details h3 { margin: 0 0 10px 0; color: #333; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px; display: inline-block;}
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 14px; }
          th { background: #f9f9f9; text-align: left; padding: 12px; font-weight: bold; color: #333; border-bottom: 2px solid #eee; }
          th.center { text-align: center; }
          th.right { text-align: right; }
          .total-section { display: flex; justify-content: flex-end; }
          .total-box { background: #f9f9f9; padding: 20px; border-radius: 8px; min-width: 250px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;}
          .total-row.grand-total { font-size: 18px; font-weight: bold; color: #FF6A00; border-top: 2px solid #eee; padding-top: 10px; margin-bottom: 0; }
          .footer { margin-top: 60px; text-align: center; color: #888; font-size: 13px; border-top: 1px solid #eee; padding-top: 20px; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-details">
            <h1>${shop.name}</h1>
            <p>${shop.category || 'Store'}</p>
            <p>${shop.phone ? `Ph: ${shop.phone}` : ''}</p>
            <p>${[shop.area, shop.city].filter(Boolean).join(', ')}</p>
          </div>
          <div class="invoice-details">
            <h2>PROFORMA INVOICE</h2>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Ref ID:</strong> ${inquiry.id?.substring(0, 8).toUpperCase()}</p>
            <p><strong>Status:</strong> ${inquiry.status || 'Submitted'}</p>
          </div>
        </div>

        <div class="customer-details">
          <h3>Billed To</h3>
          ${inquiry.customerName ? `<p><strong>Name:</strong> ${inquiry.customerName}</p>` : ''}
          <p><strong>Phone:</strong> ${inquiry.customerPhone || 'Guest'}</p>
          ${inquiry.customerEmail ? `<p><strong>Email:</strong> ${inquiry.customerEmail}</p>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item Description</th>
              <th class="center">Qty</th>
              <th class="right">Rate</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemListHTML}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-box">
            <div class="total-row grand-total">
              <span>Total Amount:</span>
              <span>₹${inquiry.totalAmount || 0}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for your inquiry!</p>
          <p>This is a system generated proforma invoice.</p>
        </div>
        
        <script>
          window.onload = function() { window.print(); window.onafterprint = function() { window.close(); } }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintPosSlip = (inquiry: any) => {
    const printWindow = window.open("", "_blank", "width=420,height=700");
    if (!printWindow) return;

    const dateObj = inquiry.createdAt ? new Date(inquiry.createdAt) : new Date();
    const dateStr = dateObj.toLocaleDateString("en-IN");
    const timeStr = dateObj.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const itemRows = (inquiry.items || []).map((item: any) => {
      const quantity = Number(item.quantity || 1);
      const price = Number(item.price || 0);
      const lineTotal = quantity * price;

      return `
        <div class="item">
          <div class="item-top">
            <span class="item-name">${item.name || "Item"}</span>
            <span class="item-total">Rs ${lineTotal.toFixed(0)}</span>
          </div>
          <div class="item-meta">${quantity} x Rs ${price.toFixed(0)}</div>
        </div>
      `;
    }).join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>POS Slip - ${shop.name}</title>
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
          }
          .footer {
            margin-top: 12px;
            text-align: center;
            font-size: 11px;
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

          <div class="row"><span class="label">Ref</span><span>${inquiry.id?.substring(0, 8).toUpperCase() || "-"}</span></div>
          <div class="row"><span class="label">Date</span><span>${dateStr}</span></div>
          <div class="row"><span class="label">Time</span><span>${timeStr}</span></div>
          <div class="row"><span class="label">Status</span><span>${inquiry.status || "Submitted"}</span></div>

          <div class="divider"></div>

          <div class="row"><span class="label">Customer</span><span>${inquiry.customerName || "Guest"}</span></div>
          <div class="row"><span class="label">Phone</span><span>${inquiry.customerPhone || "-"}</span></div>

          <div class="divider"></div>

          ${itemRows || '<div class="center muted">No items</div>'}

          <div class="divider"></div>

          <div class="row grand-total">
            <span>Total</span>
            <span>Rs ${Number(inquiry.totalAmount || 0).toFixed(0)}</span>
          </div>

          <div class="footer">
            <div>Customer Inquiry Slip</div>
            <div>Thank you</div>
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

  if (loading) {
    return (
      <div className="py-12 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 flex flex-col items-center justify-center gap-2 shadow-sm">
        <Loader2 size={24} className="text-[#FF6A00] animate-spin" />
        <p className="text-xs font-bold text-zinc-400 tracking-wider uppercase animate-pulse">Loading customer inquiries...</p>
      </div>
    );
  }

  if (filteredInquiries.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-3.5 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Customer Inquiries & Leads
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              Manage incoming product requests and reply instantly via WhatsApp.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-450 dark:text-zinc-500" size={12} />
              <input
                type="text"
                placeholder="Search by name, phone, item..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(10); }}
                className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/20 focus:border-[#FF6A00] transition-all h-8"
              />
            </div>
            <div className="px-2.5 py-1 bg-[#FF6A00]/10 border border-[#FF6A00]/20 rounded-md text-xs font-bold text-[#FF6A00] text-center whitespace-nowrap">
              0 Inquiries
            </div>
          </div>
        </div>

        <div className="py-12 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 text-center px-4 shadow-sm space-y-3">
          <div className="w-12 h-12 bg-zinc-105 dark:bg-zinc-800 rounded-md flex items-center justify-center mx-auto border border-zinc-200/80 dark:border-zinc-700">
            {searchQuery ? <Search size={24} className="text-zinc-400" /> : <MessageSquare size={24} className="text-zinc-400" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">
              {searchQuery ? "No matching inquiries found" : "No Inquiries Received Yet"}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium max-w-sm mx-auto">
              {searchQuery
                ? "Try searching for a different keyword or customer details."
                : "When customers submit product inquiries or order requests to your dashboard, they will appear here."}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs font-bold text-[#FF6A00] hover:text-[#e65f00] underline"
              >
                Clear search query
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-3.5 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Customer Inquiries & Leads
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
            Manage incoming product requests and reply instantly via WhatsApp.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${hasInvoiceTools
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
              }`}>
              Invoice Tools {hasInvoiceTools ? "On" : "Locked"}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${hasPosSlipTools
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
              }`}>
              POS Slip {hasPosSlipTools ? "On" : "Locked"}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative min-w-[220px] w-full sm:w-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-450 dark:text-zinc-500" size={12} />
            <input
              type="text"
              placeholder="Search by name, phone, item..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(10); }}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/20 focus:border-[#FF6A00] transition-all h-8"
            />
          </div>
          <div className="px-2.5 py-1 bg-[#FF6A00]/10 border border-[#FF6A00]/20 rounded-md text-xs font-bold text-[#FF6A00] text-center whitespace-nowrap">
            {filteredInquiries.length} {filteredInquiries.length === 1 ? "Inquiry" : "Inquiries"}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredInquiries.slice(0, visibleCount).map((inquiry) => (
          <div
            key={inquiry.id}
            className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-3.5 shadow-sm hover:border-[#FF6A00]/30 hover:shadow-md transition-all duration-300 relative flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            {updatingId === inquiry.id && (
              <div className="absolute inset-0 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center z-10 rounded-md">
                <Loader2 size={20} className="text-[#FF6A00] animate-spin" />
              </div>
            )}

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 flex-1 min-w-0">
              {/* Customer Info (Column 1) */}
              <div className="flex items-start gap-2.5 w-56 flex-shrink-0">
                <div className="w-8 h-8 rounded-md bg-[#FF6A00]/10 flex items-center justify-center text-[#FF6A00] font-black text-xs border border-[#FF6A00]/20 flex-shrink-0 uppercase">
                  {(inquiry.customerName || "G")[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate" title={inquiry.customerName || inquiry.customerPhone || "Guest Customer"}>
                    {inquiry.customerName || inquiry.customerPhone || "Guest Customer"}
                  </h4>
                  {inquiry.customerName && inquiry.customerPhone && (
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate flex items-center gap-1 mt-0.5" title={inquiry.customerPhone}>
                      <Phone size={9} className="shrink-0 text-[#FF6A00]" />
                      <span>{inquiry.customerPhone}</span>
                    </div>
                  )}
                  {inquiry.customerEmail && (
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate flex items-center gap-1 mt-0.5" title={inquiry.customerEmail}>
                      <Mail size={9} className="shrink-0 text-zinc-400" />
                      <span>{inquiry.customerEmail}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[9.5px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5 truncate">
                    <Calendar size={9} />
                    <span>
                      {inquiry.createdAt ? new Date(inquiry.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                      }) : "Recently"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Details (Column 2) */}
              {inquiry.items?.length > 0 && (
                <div className="flex-1 min-w-0 border-t md:border-t-0 md:border-l md:border-r border-zinc-100 dark:border-zinc-800 px-0 md:px-4 py-2 md:py-0 self-stretch flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-5.5 h-5.5 rounded bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 flex items-center justify-center flex-shrink-0 shadow-2xs">
                      <ShoppingBag size={10} className="text-zinc-500 dark:text-zinc-400" />
                    </div>
                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                      Inquired Items ({inquiry.items.length})
                    </span>
                  </div>
                  <div className="space-y-1 max-h-[75px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                    {inquiry.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-[10.5px] text-zinc-655 dark:text-zinc-400">
                        <span className="truncate pr-4 font-semibold">
                          {item.name} <span className="text-zinc-400 dark:text-zinc-505 font-black">x {item.quantity}</span>
                        </span>
                        {item.price && (
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 shrink-0">
                            ₹{item.price * item.quantity}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions & Status (Column 3) */}
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-end sm:items-center lg:items-end xl:items-center gap-3 flex-shrink-0 w-full lg:w-auto">
              <div className="flex items-center justify-between lg:justify-end gap-2 w-full lg:w-auto">
                {inquiry.totalAmount > 0 && (
                  <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded-md border border-zinc-200/80 dark:border-zinc-700">
                    ₹{inquiry.totalAmount}
                  </span>
                )}

                <select
                  value={inquiry.status || "Submitted"}
                  onChange={(e) => handleStatusChange(inquiry.id, e.target.value)}
                  className="text-xs font-bold bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 rounded-md px-2 py-1 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/50 cursor-pointer shadow-2xs w-28"
                >
                  <option value="Submitted">🟡 Submitted</option>
                  <option value="Reviewed">🔵 Reviewed</option>
                  <option value="Confirmed">🟢 Confirmed</option>
                  <option value="Completed">✅ Completed</option>
                  <option value="Cancelled">🔴 Cancelled</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto lg:w-full xl:w-auto justify-end border-t sm:border-t-0 lg:border-t xl:border-t-0 border-zinc-100 dark:border-zinc-800 pt-2 sm:pt-0 lg:pt-2 xl:pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  icon={FileText}
                  onClick={() => hasInvoiceTools && setSelectedInquiry(inquiry)}
                  disabled={!hasInvoiceTools}
                  className="text-zinc-650 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 !px-2.5 flex-1 sm:flex-initial h-8 text-[11px]"
                  title={hasInvoiceTools ? "View Invoice" : "Unlock Inquiry Invoice Tools from Paid Features"}
                >
                  <span>Invoice</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Printer}
                  onClick={() => hasPosSlipTools && handlePrintPosSlip(inquiry)}
                  disabled={!hasPosSlipTools}
                  className="text-zinc-650 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 !px-2.5 flex-1 sm:flex-initial h-8 text-[11px]"
                  title={hasPosSlipTools ? "Print POS Slip" : "Unlock POS Slip Printing from Paid Features"}
                >
                  <span>POS Slip</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Phone}
                  onClick={() => handleWhatsAppReply(inquiry.customerPhone, inquiry.items, inquiry.totalAmount)}
                  disabled={!inquiry.customerPhone}
                  className="!px-2.5 flex-1 sm:flex-initial h-8 text-[11px]"
                  title="Reply on WhatsApp"
                >
                  <span>Reply</span>
                </Button>
              </div>
            </div>
          </div>
        ))}

        {filteredInquiries.length > visibleCount && (
          <div className="py-6 text-center text-xs font-black text-zinc-400 dark:text-zinc-505 tracking-wider flex items-center justify-center gap-2">
            <Loader2 size={12} className="animate-spin text-[#FF6A00]" />
            <span>SCROLL DOWN TO LOAD MORE INQUIRIES</span>
          </div>
        )}
      </div>

      {/* INVOICE DIALOG */}
      <Dialog
        isOpen={!!selectedInquiry && hasInvoiceTools}
        onClose={() => setSelectedInquiry(null)}
        title="Proforma Invoice"
        subtitle={`Ref: ${selectedInquiry?.id?.substring(0, 8).toUpperCase()}`}
        maxWidth="max-w-3xl"
      >
        {selectedInquiry && (
          <div className="space-y-6 pt-4">
            {/* INVOICE PREVIEW UI */}
            <div className="bg-white dark:bg-zinc-950 p-6 sm:p-8 rounded-md border border-zinc-200 dark:border-zinc-800">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-zinc-100 dark:border-zinc-800 pb-6 mb-6">
                <div>
                  <h2 className="text-2xl font-black text-[#FF6A00] tracking-tight mb-1">{shop.name}</h2>
                  <p className="text-sm text-zinc-500 font-medium">{shop.category || 'Store'}</p>
                  <p className="text-sm text-zinc-500 font-medium mt-2">{shop.phone ? `Ph: ${shop.phone}` : ''}</p>
                  <p className="text-sm text-zinc-500 font-medium">{[shop.area, shop.city].filter(Boolean).join(', ')}</p>
                </div>
                <div className="sm:text-right">
                  <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-widest uppercase mb-2">Invoice</h3>
                  <div className="text-sm text-zinc-500 font-medium space-y-1">
                    <p><span className="text-zinc-400 w-16 inline-block">Date:</span> {selectedInquiry.createdAt ? new Date(selectedInquiry.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
                    <p><span className="text-zinc-400 w-16 inline-block">Status:</span> <span className="font-bold text-zinc-700 dark:text-zinc-300">{selectedInquiry.status || 'Submitted'}</span></p>
                  </div>
                </div>
              </div>

              <div className="mb-6 space-y-1">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 border-b border-zinc-100 dark:border-zinc-800 pb-1 inline-block">Billed To</h4>
                {selectedInquiry.customerName && (
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedInquiry.customerName}</p>
                )}
                <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">
                  {selectedInquiry.customerPhone ? `Ph: ${selectedInquiry.customerPhone}` : 'No Phone Number'}
                </p>
                {selectedInquiry.customerEmail && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">{selectedInquiry.customerEmail}</p>
                )}
              </div>

              <div className="overflow-visible border border-zinc-200 dark:border-zinc-800 rounded-md mb-6 bg-white dark:bg-zinc-950">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-3 font-bold">Item Description</th>
                      <th className="px-4 py-3 font-bold text-center w-24">Qty</th>
                      <th className="px-4 py-3 font-bold text-right w-32">Rate</th>
                      <th className="px-4 py-3 font-bold text-right w-32">Amount</th>
                      <th className="px-4 py-3 font-bold text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {editItems.map((item, idx) => (
                      <tr key={idx} className="bg-white dark:bg-zinc-950">
                        <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100 relative">
                          <input
                            type="text"
                            value={item.name || ""}
                            onChange={(e) => handleEditItemField(idx, "name", e.target.value)}
                            onFocus={() => setFocusedIndex(idx)}
                            onBlur={() => setFocusedIndex(null)}
                            placeholder="Search or enter item name"
                            className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-[#FF6A00] focus:ring-0 text-xs font-semibold py-1 px-1 transition-all text-zinc-900 dark:text-zinc-100"
                          />
                          {focusedIndex === idx && (
                            <div className="absolute left-4 top-full z-50 mt-1 w-64 rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg py-1 max-h-48 overflow-y-auto">
                              {getSuggestions(item.name).length > 0 ? (
                                getSuggestions(item.name).map((prod, pIdx) => (
                                  <div
                                    key={pIdx}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleSelectSuggestion(idx, prod);
                                    }}
                                    className="px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer flex justify-between items-center text-xs text-zinc-800 dark:text-zinc-200 transition-colors"
                                  >
                                    <span className="font-semibold truncate mr-2">{prod.name}</span>
                                    <span className="text-[#FF6A00] font-bold">₹{prod.price}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-[10px] text-zinc-400 font-medium animate-pulse">
                                  No matching catalog items
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center text-zinc-500">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity || 1}
                            onChange={(e) => handleEditItemField(idx, "quantity", parseInt(e.target.value) || 1)}
                            className="w-16 bg-transparent border-0 border-b border-transparent hover:border-zinc-305 dark:hover:border-zinc-700 focus:border-[#FF6A00] focus:ring-0 text-xs font-medium py-1 px-1 text-center transition-all text-zinc-800 dark:text-zinc-200"
                          />
                        </td>
                        <td className="px-4 py-2 text-right text-zinc-505">
                          <div className="inline-flex items-center gap-1 justify-end w-full">
                            <span className="text-zinc-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={item.price || 0}
                              onChange={(e) => handleEditItemField(idx, "price", parseFloat(e.target.value) || 0)}
                              className="w-20 bg-transparent border-0 border-b border-transparent hover:border-zinc-305 dark:hover:border-zinc-700 focus:border-[#FF6A00] focus:ring-0 text-xs font-medium py-1 px-1 text-right transition-all text-zinc-800 dark:text-zinc-200"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-zinc-900 dark:text-zinc-100">
                          ₹{((item.price || 0) * (item.quantity || 1)).toFixed(0)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setPendingDeleteIndex(idx)}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                            title="Delete Item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-zinc-50/50 dark:bg-zinc-900/20">
                      <td colSpan={5} className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={handleAddNewItem}
                          className="text-xs font-bold text-[#FF6A00] hover:text-[#e65f00] flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus size={14} />
                          Add Invoice Item
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-md p-4 min-w-[240px] border border-zinc-100 dark:border-zinc-800">
                  <div className="flex justify-between items-center text-lg font-black text-[#FF6A00]">
                    <span>Total:</span>
                    <span>₹{editTotal || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
              <div className="text-zinc-400 dark:text-zinc-500 text-[10px] font-medium self-start sm:self-center">
                * Edit details inline. Click Save Changes to update database.
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  icon={Download}
                  onClick={() => handlePrintInvoice(selectedInquiry)}
                  className="w-full sm:w-auto text-xs h-9"
                >
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  icon={Printer}
                  onClick={() => handlePrintPosSlip(selectedInquiry)}
                  disabled={!hasPosSlipTools}
                  className="w-full sm:w-auto text-zinc-700 dark:text-zinc-300 text-xs h-9"
                >
                  POS Slip
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  icon={Printer}
                  onClick={() => handlePrintInvoice(selectedInquiry)}
                  className="w-full sm:w-auto text-zinc-700 dark:text-zinc-300 text-xs h-9"
                >
                  Print
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  icon={Check}
                  loading={savingInvoice}
                  disabled={savingInvoice}
                  onClick={handleSaveInvoice}
                  className="w-full sm:w-auto bg-[#FF6A00] hover:bg-[#e65f00] text-white border-none text-xs h-9"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={pendingDeleteIndex !== null}
        onClose={() => setPendingDeleteIndex(null)}
        title="Delete Invoice Item"
        subtitle="Are you sure you want to remove this item from the invoice?"
        maxWidth="max-w-[420px]"
      >
        <div className="pt-4 space-y-4">
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:text-red-300">
            {pendingDeleteIndex !== null && editItems[pendingDeleteIndex]
              ? `This will remove "${editItems[pendingDeleteIndex].name || "Untitled item"}" from the invoice draft.`
              : "This item will be removed from the invoice draft."}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="flex-1 h-9"
              onClick={() => setPendingDeleteIndex(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1 h-9 bg-red-550 hover:bg-red-600 border-red-550 text-white font-bold"
              onClick={() => pendingDeleteIndex !== null && handleDeleteItem(pendingDeleteIndex)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default InquiriesTab;
