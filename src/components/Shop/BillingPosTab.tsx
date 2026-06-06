import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Calculator,
  FileText,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Printer,
  Receipt,
  Save,
  Search,
  ShoppingBag,
  Trash2,
  User,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
} from "lucide-react";
import Button from "../UI/Button";
import Dialog from "../UI/Dialog";
import Input from "../UI/Input";
import Textarea from "../UI/Textarea";
import { createBill, deleteBill, getShopBills, updateBill, finalizeBillWithTransaction } from "../../lib/db";
import { auth } from "../../lib/firebase";
import { useDispatch } from "react-redux";
import { updateShopLocalState } from "../../redux/slices/dashboardSlice";
import { AppDispatch } from "../../redux/store";

const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "Credit"];

const createBillNumber = () => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const timePart = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `SB-${datePart}-${timePart}-${randomPart}`;
};

const createEmptyBill = () => ({
  id: null as string | null,
  billNumber: createBillNumber(),
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  customerGst: "",
  billingAddress: "",
  notes: "",
  paymentMethod: "Cash",
  discount: 0,
  taxPercent: 0,
  status: "draft",
  items: [] as any[],
});

interface BillingPosTabProps {
  shop: any;
}

const BillingPosTab: React.FC<BillingPosTabProps> = ({ shop }) => {
  const dispatch = useDispatch<AppDispatch>();
  const isPortal = window.location.pathname.startsWith("/portal");
  const hasInvoiceTools = !!shop?.paidFeatures?.billing_system?.enabled || !!shop?.paidFeatures?.invoice_tools?.enabled;
  const hasPosSlipTools = !!shop?.paidFeatures?.billing_system?.enabled || !!shop?.paidFeatures?.pos_slip_tools?.enabled;
  const canManageBills = hasInvoiceTools || hasPosSlipTools;
  const storageKey = `billing_pos_draft_${shop?.id || "default"}`;

  // Wizard and output states
  const [activeStep, setActiveStep] = useState(1);
  const [docType, setDocType] = useState(hasInvoiceTools ? "invoice" : hasPosSlipTools ? "pos" : "invoice");

  const [bill, setBill] = useState(createEmptyBill);
  const [savedBills, setSavedBills] = useState<any[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [savingBill, setSavingBill] = useState(false);
  const [submittingBill, setSubmittingBill] = useState(false);
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [billSearchQuery, setBillSearchQuery] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);

  const menu = shop?.menu;

  // Extract catalog items with stock
  const catalogItems = useMemo(() => {
    if (!menu) return [];

    const items: any[] = [];
    menu.forEach((category: any) => {
      (category.items || []).forEach((item: any) => {
        items.push({
          category: category.name || category.category || "Catalog",
          name: item.name || "",
          price: Number(item.price || 0),
          description: item.description || "",
          stock: item.stock !== undefined && item.stock !== null ? Number(item.stock) : null,
        });
      });
    });
    return items;
  }, [menu]);

  // Extract customer directory from saved bills
  const customerDirectory = useMemo(() => {
    const customersMap = new Map();
    savedBills.forEach((savedBill) => {
      const name = (savedBill.customerName || "").trim();
      const phone = (savedBill.customerPhone || "").trim();
      const email = (savedBill.customerEmail || "").trim();

      if (!name && !phone && !email) return;

      const key = phone ? phone : `${name}_${email}`;
      if (!customersMap.has(key)) {
        customersMap.set(key, {
          name: name || "Unknown Customer",
          phone,
          email,
          gst: savedBill.customerGst || "",
          address: savedBill.billingAddress || "",
          billCount: 0,
          totalSpent: 0,
          lastActive: null as number | null,
        });
      }

      const profile = customersMap.get(key);
      profile.billCount += 1;
      profile.totalSpent += Number(savedBill.totalAmount || 0);

      const billTime = new Date(savedBill.updatedAt || savedBill.createdAt || 0).getTime();
      if (!profile.lastActive || billTime > profile.lastActive) {
        profile.lastActive = billTime;
        if (savedBill.customerGst) profile.gst = savedBill.customerGst;
        if (savedBill.billingAddress) profile.address = savedBill.billingAddress;
        if (name) profile.name = name;
        if (phone) profile.phone = phone;
        if (email) profile.email = email;
      }
    });

    return Array.from(customersMap.values());
  }, [savedBills]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearchQuery.trim().toLowerCase();
    if (!query) return customerDirectory.slice(0, 10);
    return customerDirectory
      .filter((c: any) =>
        c.name.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [customerDirectory, customerSearchQuery]);

  const filteredCatalogItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return catalogItems.slice(0, 12);
    return catalogItems
      .filter((item: any) =>
        [item.name, item.category, item.description].some((value) =>
          (value || "").toLowerCase().includes(query)
        )
      )
      .slice(0, 12);
  }, [catalogItems, searchQuery]);

  const filteredSavedBills = useMemo(() => {
    const query = billSearchQuery.trim().toLowerCase();
    if (!query) return savedBills;
    return savedBills.filter((savedBill) =>
      [
        savedBill.billNumber,
        savedBill.customerName,
        savedBill.customerPhone,
        savedBill.status,
      ].some((value) => (value || "").toLowerCase().includes(query))
    );
  }, [savedBills, billSearchQuery]);

  // Restores draft and syncs draft item prices
  useEffect(() => {
    if (typeof window === "undefined" || draftLoaded || catalogItems.length === 0) return;
    const savedDraft = window.localStorage.getItem(storageKey);
    if (!savedDraft) {
      const timer = setTimeout(() => setDraftLoaded(true), 0);
      return () => clearTimeout(timer);
    }

    try {
      const parsed = JSON.parse(savedDraft);
      const syncedItems = (Array.isArray(parsed.items) ? parsed.items : []).map((draftItem) => {
        const catalogItem = catalogItems.find(
          (ci) => ci.name.toLowerCase().trim() === (draftItem.name || "").toLowerCase().trim() &&
                  ci.category.toLowerCase().trim() === (draftItem.category || "").toLowerCase().trim()
        );
        return {
          ...draftItem,
          price: catalogItem ? catalogItem.price : draftItem.price,
        };
      });

      const timer = setTimeout(() => {
        setBill((prev) => ({
          ...prev,
          ...parsed,
          id: null,
          items: syncedItems,
        }));
        setDraftLoaded(true);
      }, 0);
      return () => clearTimeout(timer);
    } catch (error) {
      console.error("Failed to load billing draft:", error);
      const timer = setTimeout(() => setDraftLoaded(true), 0);
      return () => clearTimeout(timer);
    }
  }, [storageKey, catalogItems, draftLoaded]);

  // Auto-saves draft changes
  useEffect(() => {
    if (typeof window === "undefined" || !draftLoaded) return;
    window.localStorage.setItem(storageKey, JSON.stringify({
      ...bill,
      id: null,
    }));
  }, [bill, storageKey, draftLoaded]);

  const subtotal = bill.items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );
  const discountAmount = Number(bill.discount || 0);
  const taxableAmount = Math.max(subtotal - discountAmount, 0);
  const taxAmount = taxableAmount * (Number(bill.taxPercent || 0) / 100);
  const grandTotal = taxableAmount + taxAmount;

  const clearStatusMessage = () => setStatusMessage("");

  const shopId = shop?.id;
  const loadBills = useCallback(async () => {
    if (!shopId || !canManageBills) return;
    setLoadingBills(true);
    const results = await getShopBills(shopId);
    setSavedBills(results);
    setLoadingBills(false);
  }, [shopId, canManageBills]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBills();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadBills]);

  const updateBillField = (field: string, value: any) => {
    clearStatusMessage();
    setBill((prev) => ({ ...prev, [field]: value }));
  };

  const addCatalogItem = (item: any) => {
    clearStatusMessage();
    if (item.stock !== undefined && item.stock !== null && item.stock <= 0) {
      setStatusMessage(`"${item.name}" is out of stock!`);
      return;
    }

    setBill((prev) => {
      const existingIndex = prev.items.findIndex(
        (entry) => entry.name === item.name && entry.category === item.category
      );

      if (existingIndex >= 0) {
        const currentQty = Number(prev.items[existingIndex].quantity || 1);
        if (item.stock !== undefined && item.stock !== null && currentQty >= item.stock) {
          setStatusMessage(`Cannot add more "${item.name}". Stock limit reached (${item.stock}).`);
          return prev;
        }
        return {
          ...prev,
          items: prev.items.map((entry, index) =>
            index === existingIndex
              ? { ...entry, quantity: currentQty + 1 }
              : entry
          ),
        };
      }

      return {
        ...prev,
        items: [
          ...prev.items,
          {
            name: item.name,
            category: item.category,
            quantity: 1,
            price: Number(item.price || 0),
          },
        ],
      };
    });
  };

  const addManualItem = () => {
    clearStatusMessage();
    setBill((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          name: "",
          category: "Manual",
          quantity: 1,
          price: 0,
        },
      ],
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    clearStatusMessage();
    setBill((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleUpdateItemQuantity = (index: number, value: any) => {
    const item = bill.items[index];
    const catalogItem = catalogItems.find(
      (ci) => ci.name.toLowerCase().trim() === (item.name || "").toLowerCase().trim() &&
              ci.category.toLowerCase().trim() === (item.category || "").toLowerCase().trim()
    );

    let nextQty = Math.max(1, Number(value) || 1);
    if (catalogItem && catalogItem.stock !== undefined && catalogItem.stock !== null) {
      if (nextQty > catalogItem.stock) {
        nextQty = catalogItem.stock;
        setStatusMessage(`Stock limit reached for "${item.name}". Setting quantity to ${catalogItem.stock}.`);
      }
    }
    updateItem(index, "quantity", nextQty);
  };

  const removeItem = (index: number) => {
    clearStatusMessage();
    setBill((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const resetBill = () => {
    setBill(createEmptyBill());
    setSearchQuery("");
    setCustomerSearchQuery("");
    setStatusMessage("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
  };

  const toPersistedBillPayload = () => ({
    shopId: shop.id,
    shopName: shop.name || "",
    ownerId: auth.currentUser?.uid || shop.ownerId || "",
    billNumber: bill.billNumber,
    customerName: bill.customerName || "",
    customerPhone: bill.customerPhone || "",
    customerEmail: bill.customerEmail || "",
    customerGst: bill.customerGst || "",
    billingAddress: bill.billingAddress || "",
    notes: bill.notes || "",
    paymentMethod: bill.paymentMethod || "Cash",
    discount: discountAmount,
    taxPercent: Number(bill.taxPercent || 0),
    taxAmount,
    subtotal,
    totalAmount: grandTotal,
    status: bill.status || "draft",
    items: bill.items.map((item) => ({
      name: item.name || "",
      category: item.category || "Manual",
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
    })),
  });

  const validateBill = () => {
    if (!canManageBills) {
      setStatusMessage("Unlock invoice tools or POS slip tools to generate bills.");
      return false;
    }
    if (!shop?.id) {
      setStatusMessage("Shop is not loaded yet.");
      return false;
    }
    if (bill.items.length === 0) {
      setStatusMessage("Add at least one billing item.");
      return false;
    }
    if (bill.items.some((item) => !item.name?.trim())) {
      setStatusMessage("Every bill item needs a name.");
      return false;
    }
    return true;
  };

  const handleSaveBill = async () => {
    if (!validateBill()) return;

    setSavingBill(true);
    const payload = toPersistedBillPayload();
    const result = bill.id
      ? await updateBill(bill.id, payload)
      : await createBill(payload);

    if (result.success) {
      const nextId = bill.id || (result as any).id;
      setBill((prev) => ({ ...prev, id: nextId }));
      setStatusMessage(bill.id ? "Draft updated successfully." : "Draft saved successfully.");
      await loadBills();
    } else {
      setStatusMessage("Failed to save draft.");
    }
    setSavingBill(false);
  };

  const handleGenerateAndPrint = async () => {
    if (!validateBill()) return;

    if (docType === "invoice" && !hasInvoiceTools) {
      setStatusMessage("Unlock Invoice Engine to print invoices.");
      return;
    }
    if (docType === "pos" && !hasPosSlipTools) {
      setStatusMessage("Unlock POS Slip features to print slips.");
      return;
    }

    setSubmittingBill(true);
    setStatusMessage("Validating stock and submitting payment transaction...");

    const itemsToDeduct = bill.items
      .filter((item) => item.category && item.category !== "Manual")
      .map((item) => ({
        name: item.name,
        category: item.category,
        quantity: Number(item.quantity || 1),
      }));

    const payload = {
      ...toPersistedBillPayload(),
      status: "paid",
    };

    const result = await finalizeBillWithTransaction(bill.id, payload, shop.id, itemsToDeduct);

    if (result.success) {
      setStatusMessage("Transaction successful! Opening print window...");
      if (result.menu) {
        dispatch(updateShopLocalState({ menu: result.menu }));
      }

      const finalizedBill = {
        ...bill,
        id: result.billId as string,
        status: "paid",
      };

      if (docType === "invoice") {
        printInvoiceHelper(finalizedBill);
      } else {
        printPosSlipHelper(finalizedBill);
      }

      resetBill();
      setActiveStep(1);
      await loadBills();
    } else {
      setStatusMessage(`Checkout failed: ${result.error}`);
    }
    setSubmittingBill(false);
  };

  const handleSelectCustomer = (customer: any) => {
    setBill((prev) => ({
      ...prev,
      customerName: customer.name || "",
      customerPhone: customer.phone || "",
      customerEmail: customer.email || "",
      customerGst: customer.gst || "",
      billingAddress: customer.address || "",
    }));
    setStatusMessage(`Restored customer profile: ${customer.name}`);
  };

  const handleEditSavedBill = (savedBill: any) => {
    setBill({
      id: savedBill.id,
      billNumber: savedBill.billNumber || createBillNumber(),
      customerName: savedBill.customerName || "",
      customerPhone: savedBill.customerPhone || "",
      customerEmail: savedBill.customerEmail || "",
      customerGst: savedBill.customerGst || "",
      billingAddress: savedBill.billingAddress || "",
      notes: savedBill.notes || "",
      paymentMethod: savedBill.paymentMethod || "Cash",
      discount: Number(savedBill.discount || 0),
      taxPercent: Number(savedBill.taxPercent || 0),
      status: savedBill.status || "draft",
      items: Array.isArray(savedBill.items)
        ? savedBill.items.map((item: any) => ({
          name: item.name || "",
          category: item.category || "Manual",
          quantity: Number(item.quantity || 1),
          price: Number(item.price || 0),
        }))
        : [],
    });
    setActiveStep(1);
    setManageDialogOpen(false);
    setStatusMessage(`Loaded bill ${savedBill.billNumber} for editing.`);
  };

  const [pendingDeleteBill, setPendingDeleteBill] = useState<any>(null);

  const handleDeleteSavedBill = async () => {
    if (!pendingDeleteBill) return;
    const savedBillId = pendingDeleteBill.id;
    setPendingDeleteBill(null);
    setDeletingBillId(savedBillId);
    const result = await deleteBill(savedBillId);
    if (result.success) {
      if (bill.id === savedBillId) {
        resetBill();
      }
      await loadBills();
      setStatusMessage("Bill deleted successfully.");
    } else {
      setStatusMessage("Failed to delete bill.");
    }
    setDeletingBillId(null);
  };

  const printInvoiceHelper = (printBill: any) => {
    if (printBill.items.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rows = printBill.items
      .map((item: any, index: number) => {
        const qty = Number(item.quantity || 1);
        const rate = Number(item.price || 0);
        const lineTotal = qty * rate;

        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #eee;">${index + 1}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;font-weight:700;">${item.name || "Item"}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">Rs ${rate.toFixed(0)}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">Rs ${lineTotal.toFixed(0)}</td>
          </tr>
        `;
      })
      .join("");

    const itemSubtotal = printBill.items.reduce(
      (sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 1),
      0
    );
    const itemDiscount = Number(printBill.discount || 0);
    const itemTaxable = Math.max(itemSubtotal - itemDiscount, 0);
    const itemTaxAmount = itemTaxable * (Number(printBill.taxPercent || 0) / 100);
    const itemGrandTotal = itemTaxable + itemTaxAmount;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${printBill.billNumber}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; padding: 32px; max-width: 900px; margin: 0 auto; }
          .header { display:flex; justify-content:space-between; gap:24px; border-bottom:2px solid #f0f0f0; padding-bottom:18px; margin-bottom:24px; }
          .title { color:#FF6A00; font-size:28px; font-weight:800; margin:0 0 4px; }
          .muted { color:#666; font-size:13px; margin:2px 0; }
          .section { margin-bottom:24px; }
          .section-title { font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#777; font-weight:800; margin-bottom:8px; }
          table { width:100%; border-collapse:collapse; margin-bottom:24px; font-size:14px; }
          th { text-align:left; background:#fafafa; padding:10px; border-bottom:2px solid #eee; }
          .right { text-align:right; }
          .center { text-align:center; }
          .totals { margin-left:auto; width:320px; background:#fafafa; border:1px solid #eee; border-radius:12px; padding:16px; }
          .totals-row { display:flex; justify-content:space-between; margin:8px 0; font-size:14px; }
          .grand { font-size:18px; font-weight:800; color:#FF6A00; border-top:2px solid #e8e8e8; padding-top:12px; margin-top:12px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${shop?.name || "Shop Bajar Merchant"}</h1>
            <p class="muted">${shop?.category || "Store"}</p>
            ${shop?.phone ? `<p class="muted">Ph: ${shop.phone}</p>` : ""}
            ${shop?.gst ? `<p class="muted">GSTIN: ${shop.gst}</p>` : ""}
            <p class="muted">${[shop?.area, shop?.city].filter(Boolean).join(", ")}</p>
          </div>
          <div style="text-align:right;">
            <h2 style="margin:0 0 6px;font-size:24px;">Tax Invoice</h2>
            <p class="muted"><strong>Bill No:</strong> ${printBill.billNumber}</p>
            <p class="muted"><strong>Date:</strong> ${new Date().toLocaleDateString("en-IN")}</p>
            <p class="muted"><strong>Payment:</strong> ${printBill.paymentMethod}</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Bill To</div>
          <p style="margin:4px 0;font-weight:700;">${printBill.customerName || "Walk-in Customer"}</p>
          <p class="muted">${printBill.customerPhone || "-"}</p>
          ${printBill.customerEmail ? `<p class="muted">${printBill.customerEmail}</p>` : ""}
          ${printBill.customerGst ? `<p class="muted">GSTIN: ${printBill.customerGst}</p>` : ""}
          ${printBill.billingAddress ? `<p class="muted">${printBill.billingAddress}</p>` : ""}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th class="center">Qty</th>
              <th class="right">Rate</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><span>Rs ${itemSubtotal.toFixed(0)}</span></div>
          <div class="totals-row"><span>Discount</span><span>Rs ${itemDiscount.toFixed(0)}</span></div>
          <div class="totals-row"><span>Tax (${Number(printBill.taxPercent || 0).toFixed(0)}%)</span><span>Rs ${itemTaxAmount.toFixed(0)}</span></div>
          <div class="totals-row grand"><span>Total</span><span>Rs ${itemGrandTotal.toFixed(0)}</span></div>
        </div>

        ${printBill.notes ? `<div class="section"><div class="section-title">Notes</div><p class="muted">${printBill.notes}</p></div>` : ""}

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

  const printPosSlipHelper = (printBill: any) => {
    if (printBill.items.length === 0) return;

    const printWindow = window.open("", "_blank", "width=420,height=700");
    if (!printWindow) return;

    const itemRows = printBill.items
      .map((item: any) => {
        const qty = Number(item.quantity || 1);
        const rate = Number(item.price || 0);
        const lineTotal = qty * rate;
        return `
          <div class="item">
            <div class="row strong"><span>${item.name || "Item"}</span><span>Rs ${lineTotal.toFixed(0)}</span></div>
            <div class="meta">${qty} x Rs ${rate.toFixed(0)}</div>
          </div>
        `;
      })
      .join("");

    const itemSubtotal = printBill.items.reduce(
      (sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 1),
      0
    );
    const itemDiscount = Number(printBill.discount || 0);
    const itemTaxable = Math.max(itemSubtotal - itemDiscount, 0);
    const itemTaxAmount = itemTaxable * (Number(printBill.taxPercent || 0) / 100);
    const itemGrandTotal = itemTaxable + itemTaxAmount;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>POS Slip - ${printBill.billNumber}</title>
        <style>
          @page { size: 80mm auto; margin: 6mm; }
          body { font-family: "Courier New", monospace; margin:0; color:#111; font-size:12px; }
          .slip { width:72mm; margin:0 auto; }
          .center { text-align:center; }
          .title { font-size:18px; font-weight:700; margin-bottom:4px; }
          .muted { color:#444; font-size:11px; }
          .divider { border-top:1px dashed #000; margin:10px 0; }
          .row { display:flex; justify-content:space-between; gap:8px; margin:2px 0; }
          .strong { font-weight:700; }
          .meta { color:#444; font-size:11px; }
          .item { padding:6px 0; border-bottom:1px dashed #ccc; }
          .grand { font-size:15px; font-weight:700; }
        </style>
      </head>
      <body>
        <div class="slip">
          <div class="center">
            <div class="title">${shop?.name || "Shop Bajar Merchant"}</div>
            <div class="muted">${shop?.category || "Store"}</div>
            ${shop?.phone ? `<div class="muted">Ph: ${shop.phone}</div>` : ""}
            ${shop?.gst ? `<div class="muted">GSTIN: ${shop.gst}</div>` : ""}
          </div>
          <div class="divider"></div>
          <div class="row"><span>Bill No</span><span>${printBill.billNumber}</span></div>
          <div class="row"><span>Date</span><span>${new Date().toLocaleDateString("en-IN")}</span></div>
          <div class="row"><span>Time</span><span>${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></div>
          <div class="row"><span>Payment</span><span>${printBill.paymentMethod}</span></div>
          <div class="row"><span>Customer</span><span>${printBill.customerName || "Walk-in"}</span></div>
          ${printBill.customerGst ? `<div class="row"><span>GSTIN</span><span>${printBill.customerGst}</span></div>` : ""}
          <div class="divider"></div>
          ${itemRows}
          <div class="divider"></div>
          <div class="row"><span>Subtotal</span><span>Rs ${itemSubtotal.toFixed(0)}</span></div>
          <div class="row"><span>Discount</span><span>Rs ${itemDiscount.toFixed(0)}</span></div>
          <div class="row"><span>Tax</span><span>Rs ${itemTaxAmount.toFixed(0)}</span></div>
          <div class="row grand"><span>Total</span><span>Rs ${itemGrandTotal.toFixed(0)}</span></div>
          <div class="divider"></div>
          <div class="center muted">Thank you for your purchase</div>
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

  const renderStockBadge = (item: any) => {
    if (item.stock === undefined || item.stock === null) {
      return null;
    }
    if (item.stock <= 0) {
      return <span className="text-[10px] text-red-500 font-bold">Out of stock</span>;
    }
    if (item.stock <= 5) {
      return <span className="text-[10px] text-amber-550 font-bold">{item.stock} left</span>;
    }
    return <span className="text-[10px] text-emerald-600 font-semibold">{item.stock} available</span>;
  };

  return (
    <div className="space-y-4 pb-12">
      <div className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Billing & POS Manager
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-1">
              Create real bills, sync item stock dynamically, search directories, and output invoices or POS slips.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${hasInvoiceTools ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"}`}>
                Invoice Engine {hasInvoiceTools ? "On" : "Locked"}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${hasPosSlipTools ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"}`}>
                POS Slip {hasPosSlipTools ? "On" : "Locked"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-start lg:justify-end">
            {!isPortal && (
              <button
                type="button"
                onClick={() => {
                  const staffUrl = `${window.location.origin}/portal/billing?shopId=${shop.id}`;
                  navigator.clipboard.writeText(staffUrl);
                  alert("Copied Staff Billing & POS Portal Link to clipboard!\nShare this with your staff. PIN: " + (shop.staffPin || "1234"));
                }}
                className="h-8 px-2.5 rounded-md border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
              >
                <User size={12} className="text-zinc-400" />
                <span>Share Staff URL</span>
              </button>
            )}
            <Button variant="outline" size="sm" icon={Receipt} disabled={!canManageBills} onClick={() => { setManageDialogOpen(true); clearStatusMessage(); }} className="h-8 text-[11px]">
              Manage Bills
            </Button>
            <Button variant="outline" size="sm" icon={Plus} onClick={() => { resetBill(); setActiveStep(1); }} className="h-8 text-[11px]">
              New Bill
            </Button>
            <Button variant="outline" size="sm" icon={FileText} disabled={!bill.id || !hasInvoiceTools} onClick={() => printInvoiceHelper(bill)} className="h-8 text-[11px]">
              Print Invoice
            </Button>
            <Button variant="outline" size="sm" icon={Printer} disabled={!bill.id || !hasPosSlipTools} onClick={() => printPosSlipHelper(bill)} className="h-8 text-[11px]">
              Print POS Slip
            </Button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-md border border-[#FF6A00]/20 bg-[#FF6A00]/5 px-4 py-3 text-[11px] font-bold text-[#C85200]">
          {statusMessage}
        </div>
      )}

      {!canManageBills && (
        <div className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Billing workspace is locked</h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium max-w-2xl">
            Activate `Inquiry Invoice Tools` for full invoice generation and `POS Slip Printing` for thermal-style billing slips from the Paid Features tab.
          </p>
        </div>
      )}

      {canManageBills && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4 items-start">
          {/* Left panel: Wizard checkout steps */}
          <div className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-sm space-y-4">
            
            {/* Step indicator progress bar */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activeStep >= 1 ? "bg-[#FF6A00] text-white" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"}`}>
                  1
                </div>
                <span className={`text-xs font-bold ${activeStep === 1 ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-550"}`}>Products & Pricing</span>
              </div>
              <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1 mx-3" />
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activeStep >= 2 ? "bg-[#FF6A00] text-white" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"}`}>
                  2
                </div>
                <span className={`text-xs font-bold ${activeStep === 2 ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-550"}`}>Customer & Notes</span>
              </div>
              <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1 mx-3" />
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activeStep >= 3 ? "bg-[#FF6A00] text-white" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"}`}>
                  3
                </div>
                <span className={`text-xs font-bold ${activeStep === 3 ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-550"}`}>Choose & Generate</span>
              </div>
            </div>

            {/* STEP 1: Products and Pricing builder */}
            {activeStep === 1 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Catalog Billing Builder</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Search catalog items or add manual billing lines.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-[200px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-450 dark:text-zinc-500" size={12} />
                      <input
                        type="text"
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/20 focus:border-[#FF6A00] transition-all h-8"
                      />
                    </div>
                    <Button variant="outline" size="sm" icon={Plus} onClick={addManualItem} className="h-8 text-[11px]">
                      Manual
                    </Button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
                  <div className="max-h-[190px] overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Item Name & Category</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider w-36">Stock Status</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right w-28">Price</th>
                          <th className="px-3 py-2 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filteredCatalogItems.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-[11px] text-zinc-505 dark:text-zinc-400 font-medium bg-white dark:bg-zinc-950">
                              No catalog items match your search.
                            </td>
                          </tr>
                        ) : (
                          filteredCatalogItems.map((item: any, index: number) => {
                            const isOutOfStock = item.stock !== undefined && item.stock !== null && item.stock <= 0;
                            return (
                              <tr 
                                key={`${item.category}-${item.name}-${index}`}
                                className={`group bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors ${isOutOfStock ? "opacity-60" : ""}`}
                              >
                                <td className="px-3 py-2 min-w-0">
                                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{item.name}</div>
                                  <div className="text-[10px] text-zinc-505 dark:text-zinc-400 font-medium truncate">{item.category}</div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {renderStockBadge(item)}
                                </td>
                                <td className="px-3 py-2 text-right font-black text-[#FF6A00] whitespace-nowrap">
                                  Rs {item.price.toFixed(0)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    disabled={isOutOfStock}
                                    onClick={() => addCatalogItem(item)}
                                    className="p-1 rounded bg-[#FF6A00]/10 hover:bg-[#FF6A00] text-[#FF6A00] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group-hover:scale-105 cursor-pointer"
                                    title="Add to bill"
                                  >
                                    <Plus size={13} strokeWidth={2.5} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-bold text-zinc-505">Item</th>
                        <th className="px-3 py-2 text-center text-[11px] font-bold text-zinc-505 w-24">Qty</th>
                        <th className="px-3 py-2 text-right text-[11px] font-bold text-zinc-505 w-28">Rate</th>
                        <th className="px-3 py-2 text-right text-[11px] font-bold text-zinc-505 w-28">Amount</th>
                        <th className="px-3 py-2 text-center text-[11px] font-bold text-zinc-505 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {bill.items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-[11px] text-zinc-505 dark:text-zinc-400 font-medium">
                            Add catalog or manual items to start.
                          </td>
                        </tr>
                      ) : (
                        bill.items.map((item, index) => (
                          <tr key={index} className="bg-white dark:bg-zinc-955">
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateItem(index, "name", e.target.value)}
                                className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-[#FF6A00] focus:ring-0 text-xs font-semibold py-1 px-1 text-zinc-900 dark:text-zinc-100"
                                placeholder="Item name"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItemQuantity(index, e.target.value)}
                                className="w-16 bg-transparent border-0 border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-[#FF6A00] focus:ring-0 text-xs font-medium py-1 px-1 text-center text-zinc-900 dark:text-zinc-100"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <input
                                type="number"
                                min="0"
                                value={item.price}
                                onChange={(e) => updateItem(index, "price", Math.max(0, Number(e.target.value) || 0))}
                                className="w-20 bg-transparent border-0 border-b border-transparent hover:border-zinc-305 dark:hover:border-zinc-700 focus:border-[#FF6A00] focus:ring-0 text-xs font-medium py-1 px-1 text-right text-zinc-900 dark:text-zinc-100"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right text-xs font-black text-zinc-900 dark:text-zinc-100">
                              Rs {(Number(item.quantity || 1) * Number(item.price || 0)).toFixed(0)}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="text-red-500 hover:text-red-750 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input label="Discount (Rs)" type="number" value={bill.discount} onChange={(e) => updateBillField("discount", Number(e.target.value) || 0)} />
                  <Input label="Tax Percent (GST %)" type="number" value={bill.taxPercent} onChange={(e) => updateBillField("taxPercent", Number(e.target.value) || 0)} helpText="Applies to taxable amount" />
                </div>

                <div className="flex justify-end pt-2">
                  <Button variant="primary" icon={ChevronRight} disabled={bill.items.length === 0} onClick={() => setActiveStep(2)}>
                    Next: Customer & Notes
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Customer Management & settlement details */}
            {activeStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[1.3fr_0.7fr] gap-4 items-start">
                  
                  {/* Customer details input fields */}
                  <div className="space-y-3 flex-1 w-full">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Settlement & Customer Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="Customer Name" value={bill.customerName} onChange={(e) => updateBillField("customerName", e.target.value)} placeholder="Walk-in customer" icon={User} />
                      <Input label="Phone Number" value={bill.customerPhone} onChange={(e) => updateBillField("customerPhone", e.target.value)} placeholder="Mobile number" icon={Phone} />
                      <Input label="Email" value={bill.customerEmail} onChange={(e) => updateBillField("customerEmail", e.target.value)} placeholder="Optional email" />
                      <Input label="Customer GSTIN" value={bill.customerGst} onChange={(e) => updateBillField("customerGst", e.target.value)} placeholder="Optional GSTIN" />
                    </div>
                    <Textarea label="Billing Address" value={bill.billingAddress} onChange={(e) => updateBillField("billingAddress", e.target.value)} rows={2} placeholder="Street, area, city" />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-[#0A0A0F]/30 dark:text-zinc-500 uppercase tracking-[0.1em] px-1">Payment Method</label>
                        <select
                          value={bill.paymentMethod}
                          onChange={(e) => updateBillField("paymentMethod", e.target.value)}
                          className="w-full h-10 px-3.5 rounded-md border border-black/[0.08] dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[13.5px] font-medium text-[#0A0A0F] dark:text-zinc-100 shadow-sm outline-none focus:border-[#FF6A00]/40 focus:ring-2 focus:ring-[#FF6A00]/5 cursor-pointer"
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method} value={method}>{method}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Textarea label="Notes" value={bill.notes} onChange={(e) => updateBillField("notes", e.target.value)} rows={2} placeholder="Note printed on footer" />
                  </div>

                  {/* Customer directory selection */}
                  <div className="border border-zinc-200/80 dark:border-zinc-800 rounded-md p-3 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-3 w-full">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Customer Directory</h4>
                      <span className="text-[9px] bg-zinc-200 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 px-1.5 py-0.5 rounded font-semibold">{filteredCustomers.length} profiles</span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-450 dark:text-zinc-500" size={12} />
                      <input
                        type="text"
                        placeholder="Search directory..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/20 focus:border-[#FF6A00] transition-all h-8"
                      />
                    </div>
                    <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                      {filteredCustomers.length === 0 ? (
                        <div className="text-[10px] text-zinc-450 dark:text-zinc-500 text-center py-6 font-medium">No customer profiles.</div>
                      ) : (
                        filteredCustomers.map((profile: any) => (
                          <button
                            key={profile.phone || `${profile.name}_${profile.email}`}
                            type="button"
                            onClick={() => handleSelectCustomer(profile)}
                            className="w-full text-left p-2 rounded border border-zinc-200/60 dark:border-zinc-800/80 hover:border-[#FF6A00]/40 hover:bg-[#FF6A00]/5 bg-white dark:bg-zinc-950 transition-all flex flex-col gap-0.5 cursor-pointer"
                          >
                            <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{profile.name}</div>
                            <div className="flex items-center justify-between text-[10px] text-zinc-505 dark:text-zinc-400">
                              <span>{profile.phone || "No phone"}</span>
                              <span className="font-semibold text-zinc-400 dark:text-zinc-505">{profile.billCount} bills</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" icon={ChevronLeft} onClick={() => setActiveStep(1)}>
                    Back
                  </Button>
                  <Button variant="primary" icon={ChevronRight} onClick={() => setActiveStep(3)}>
                    Next: Choose & Generate
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Choose layout and finalise transaction */}
            {activeStep === 3 && (
              <div className="space-y-4">
                <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800 rounded-md p-4 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Select Document Output Type</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    <button
                      type="button"
                      disabled={!hasInvoiceTools}
                      onClick={() => setDocType("invoice")}
                      className={`text-left p-4 rounded-md border transition-all flex items-start gap-3 relative cursor-pointer ${!hasInvoiceTools ? "opacity-50 cursor-not-allowed" : ""} ${docType === "invoice" ? "border-[#FF6A00] bg-[#FF6A00]/5 ring-2 ring-[#FF6A00]/5" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700"}`}
                    >
                      <FileText className={`shrink-0 ${docType === "invoice" ? "text-[#FF6A00]" : "text-zinc-400"}`} size={20} />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">Tax Invoice (A4 Format)</span>
                        <span className="text-[10px] text-zinc-505 dark:text-zinc-400 block font-medium mt-0.5">Professional structured layout with customer GST, detailed items, taxes, and notes.</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={!hasPosSlipTools}
                      onClick={() => setDocType("pos")}
                      className={`text-left p-4 rounded-md border transition-all flex items-start gap-3 relative cursor-pointer ${!hasPosSlipTools ? "opacity-50 cursor-not-allowed" : ""} ${docType === "pos" ? "border-[#FF6A00] bg-[#FF6A00]/5 ring-2 ring-[#FF6A00]/5" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700"}`}
                    >
                      <Receipt className={`shrink-0 ${docType === "pos" ? "text-[#FF6A00]" : "text-zinc-400"}`} size={20} />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">Thermal POS Slip (80mm)</span>
                        <span className="text-[10px] text-zinc-505 dark:text-zinc-400 block font-medium mt-0.5">Compact layout designed for receipt printers. Perfect for quick checkout counters.</span>
                      </div>
                    </button>

                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800 rounded-md p-4 space-y-2 text-xs">
                  <h4 className="font-bold text-zinc-800 dark:text-zinc-200 mb-1">Final Checklist Before Checkout</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-medium text-zinc-650 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-emerald-500 shrink-0" size={13} />
                      <span>{bill.items.length} items ready to sell</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-emerald-500 shrink-0" size={13} />
                      <span>Customer: {bill.customerName || "Walk-in Customer"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-emerald-500 shrink-0" size={13} />
                      <span>Settlement: {bill.paymentMethod}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-emerald-500 shrink-0" size={13} />
                      <span>Grand Total: Rs {grandTotal.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" icon={ChevronLeft} onClick={() => setActiveStep(2)}>
                    Back
                  </Button>
                  <Button variant="primary" loading={submittingBill} onClick={handleGenerateAndPrint} icon={Printer}>
                    Generate Bill & Print
                  </Button>
                </div>
              </div>
            )}

          </div>

          {/* Right panel: Sticky Billing Summary */}
          <div className="space-y-4 xl:sticky xl:top-24 w-full">
            <div className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Calculator size={16} className="text-[#FF6A00]" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Billing Summary</h3>
              </div>

              <div className="space-y-2 text-[12px] font-medium text-zinc-650 dark:text-zinc-300">
                <div className="flex items-center justify-between"><span>Subtotal</span><span>Rs {subtotal.toFixed(0)}</span></div>
                <div className="flex items-center justify-between"><span>Discount</span><span>Rs {discountAmount.toFixed(0)}</span></div>
                <div className="flex items-center justify-between"><span>Tax</span><span>Rs {taxAmount.toFixed(0)}</span></div>
                <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-lg font-black text-[#FF6A00]">
                  <span>Total</span>
                  <span>Rs {grandTotal.toFixed(0)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 mt-4">
                <Button
                  variant="outline"
                  icon={Save}
                  disabled={!canManageBills || bill.items.length === 0}
                  loading={savingBill}
                  onClick={handleSaveBill}
                  className="w-full text-xs h-9"
                >
                  {bill.id ? "Update Saved Draft" : "Save as Draft"}
                </Button>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag size={15} className="text-[#FF6A00]" />
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Checkout Guide</h3>
              </div>
              <div className="space-y-2 text-[11px] text-zinc-505 dark:text-zinc-400 font-medium">
                <p>1. Add items to your invoice and adjust discounts or GST percentages.</p>
                <p>2. Link the checkout with a customer profile from directory to track their transaction records.</p>
                <p>3. Choose output template and finalize transaction. Stock level will be atomic deducted.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Bills Manager modal */}
      <Dialog
        isOpen={manageDialogOpen}
        onClose={() => setManageDialogOpen(false)}
        title="Manage Bills & Drafts"
        subtitle="Open saved drafts, continue billing, or delete transactions"
        maxWidth="max-w-4xl"
      >
        <div className="pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-450 dark:text-zinc-500" size={12} />
              <input
                type="text"
                placeholder="Search by number or customer..."
                value={billSearchQuery}
                onChange={(e) => setBillSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/20 focus:border-[#FF6A00] transition-all h-8"
              />
            </div>
            <Button variant="outline" size="sm" icon={Receipt} onClick={loadBills} className="h-8 text-[11px]">
              Refresh List
            </Button>
          </div>

          <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-bold text-zinc-505">Bill No</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold text-zinc-505">Customer</th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold text-zinc-505">Updated</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold text-zinc-505">Total</th>
                  <th className="px-3 py-2 text-center text-[11px] font-bold text-zinc-505">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {loadingBills ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[11px] font-medium text-zinc-550 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin text-[#FF6A00]" /> Loading bills...</span>
                    </td>
                  </tr>
                ) : filteredSavedBills.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[11px] font-medium text-zinc-550 dark:text-zinc-400">
                      No saved bills found.
                    </td>
                  </tr>
                ) : (
                  filteredSavedBills.map((savedBill) => (
                    <tr key={savedBill.id} className="bg-white dark:bg-zinc-950">
                      <td className="px-3 py-3">
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{savedBill.billNumber}</div>
                        <div className="text-[10px] text-zinc-505 dark:text-zinc-400 capitalize">{savedBill.status || "draft"}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs font-semibold text-zinc-850 dark:text-zinc-200">{savedBill.customerName || "Walk-in Customer"}</div>
                        <div className="text-[10px] text-zinc-505 dark:text-zinc-400">{savedBill.customerPhone || "-"}</div>
                      </td>
                      <td className="px-3 py-3 text-[11px] text-zinc-505 dark:text-zinc-400 font-medium">
                        {savedBill.updatedAt ? new Date(savedBill.updatedAt).toLocaleString("en-IN") : "-"}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-black text-[#FF6A00]">
                        Rs {Number(savedBill.totalAmount || 0).toFixed(0)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Pencil}
                            onClick={() => handleEditSavedBill(savedBill)}
                            className="h-8 text-[11px]"
                          >
                            Open
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Trash2}
                            loading={deletingBillId === savedBill.id}
                            onClick={() => setPendingDeleteBill(savedBill)}
                            className="h-8 text-[11px] text-red-600 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-300"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Dialog>

      {/* Delete Bill Confirmation Dialog */}
      <Dialog
        isOpen={!!pendingDeleteBill}
        onClose={() => setPendingDeleteBill(null)}
        title="Delete Bill Draft"
        subtitle="Are you sure you want to delete this bill?"
        maxWidth="max-w-[400px]"
      >
        <div className="pt-2 space-y-4">
          <div className="rounded-md border border-red-200 bg-red-55 dark:bg-red-950/20 dark:border-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-300 font-medium">
            This will permanently delete bill draft "{pendingDeleteBill?.billNumber}" for customer "{pendingDeleteBill?.customerName || "Walk-in Customer"}". This action cannot be undone.
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="flex-1 h-9"
              onClick={() => setPendingDeleteBill(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1 h-9 bg-red-500 hover:bg-red-600 border-red-500 text-white font-bold"
              onClick={handleDeleteSavedBill}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default BillingPosTab;
