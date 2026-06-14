import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  Table2,
  Trash2,
  User,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  MoreVertical,
  ChevronDown,
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

  // Actions Dropdown Menu State
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(event.target as Node)
      ) {
        setActionsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Wizard and output states
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
  const [showMoreCustomerFields, setShowMoreCustomerFields] = useState(false);

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
        <div className={`grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4 select-none ${isFullscreen ? "lg:h-[calc(100vh-2.5rem)]" : "lg:h-[calc(100vh-10rem)]"} lg:overflow-hidden`}>
          {/* Left Column: Catalog only */}
          <div className="flex flex-col lg:h-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-md p-4 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 shrink-0">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Catalog Items</h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Click items to add them to the bill</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative min-w-[180px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-450 dark:text-zinc-505" size={12} />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-955 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/20 focus:border-[#FF6A00] transition-all h-8"
                  />
                </div>
                <Button variant="outline" size="sm" icon={Plus} onClick={addManualItem} className="h-8 text-[11px]">
                  Manual
                </Button>
              </div>
            </div>

            {/* Scrollable Catalog items table */}
            <div className="flex-1 min-h-[300px] lg:overflow-y-auto border border-zinc-150 dark:border-zinc-850 rounded-md bg-zinc-50/20 dark:bg-zinc-950/20 scrollbar-thin">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-805 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-[10px] font-bold text-zinc-505 uppercase tracking-wider">Item Name & Category</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-zinc-505 uppercase tracking-wider w-28">Stock Status</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-zinc-505 uppercase tracking-wider text-right w-24">Price</th>
                    <th className="px-3 py-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredCatalogItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[11px] text-zinc-505 dark:text-zinc-400 font-medium bg-white dark:bg-zinc-955">
                        No catalog items match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredCatalogItems.map((item: any, index: number) => {
                      const isOutOfStock = item.stock !== undefined && item.stock !== null && item.stock <= 0;
                      return (
                        <tr
                          key={`${item.category}-${item.name}-${index}`}
                          className={`group bg-white dark:bg-zinc-955 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors ${isOutOfStock ? "opacity-60" : ""}`}
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
                              className="p-1.5 rounded bg-[#FF6A00]/10 hover:bg-[#FF6A00] text-[#FF6A00] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group-hover:scale-105 cursor-pointer"
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

          {/* Right Column: Cart, Customer & Checkout */}
          <div className="flex flex-col lg:h-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-md p-4 shadow-sm lg:overflow-y-auto justify-between animate-in fade-in duration-200 scrollbar-thin">
            {/* Added Items (Cart) */}
            <div className="flex flex-col shrink-0">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag size={14} className="text-[#FF6A00]" />
                  <span>Active Cart ({bill.items.length} items)</span>
                </h3>
                <div className="relative" ref={actionsMenuRef}>
                  <button
                    type="button"
                    onClick={() => setActionsMenuOpen((prev) => !prev)}
                    className="h-7 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[10px] font-bold text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-805 hover:text-zinc-900 dark:hover:text-white transition-all flex items-center gap-1 shadow-3xs cursor-pointer select-none"
                    aria-expanded={actionsMenuOpen}
                    aria-haspopup="true"
                  >
                    <span>Actions</span>
                    <ChevronDown size={11} className={`text-zinc-450 dark:text-zinc-500 transition-transform duration-250 ${actionsMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {actionsMenuOpen && (
                    <div className="absolute right-0 mt-1.5 w-48 rounded-lg border border-zinc-200/80 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 shadow-md py-1 z-50 animate-in fade-in-50 slide-in-from-top-1 duration-150 origin-top-right">
                      {/* Section: Manage */}
                      <div className="p-1 border-b border-zinc-100 dark:border-zinc-800/85">
                        <button
                          type="button"
                          onClick={() => {
                            resetBill();
                            setActionsMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs font-semibold text-zinc-700 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                        >
                          <Plus size={13} className="text-zinc-400 dark:text-zinc-500" />
                          <span>New Bill</span>
                        </button>
                        
                        {canManageBills && (
                          <button
                            type="button"
                            onClick={() => {
                              setManageDialogOpen(true);
                              clearStatusMessage();
                              setActionsMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs font-semibold text-zinc-700 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                          >
                            <Receipt size={13} className="text-zinc-400 dark:text-zinc-505" />
                            <span>Manage Bills</span>
                          </button>
                        )}

                        {!isPortal && (
                          <button
                            type="button"
                            onClick={() => {
                              const staffUrl = `${window.location.origin}/portal/billing?shopId=${shop.id}`;
                              navigator.clipboard.writeText(staffUrl);
                              alert("Copied Staff Billing & POS Portal Link to clipboard!\nShare this with your staff. PIN: " + (shop.staffPin || "1234"));
                              setActionsMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs font-semibold text-zinc-700 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                          >
                            <User size={13} className="text-zinc-400 dark:text-zinc-505" />
                            <span>Share Staff URL</span>
                          </button>
                        )}
                      </div>

                      {/* Section: Print */}
                      <div className="p-1 border-b border-zinc-100 dark:border-zinc-800/85">
                        <button
                          type="button"
                          disabled={!bill.id || !hasInvoiceTools}
                          onClick={() => {
                            printInvoiceHelper(bill);
                            setActionsMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs font-semibold text-zinc-700 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <FileText size={13} className="text-zinc-400 dark:text-zinc-505" />
                          <span>Print Invoice</span>
                        </button>

                        <button
                          type="button"
                          disabled={!bill.id || !hasPosSlipTools}
                          onClick={() => {
                            printPosSlipHelper(bill);
                            setActionsMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs font-semibold text-zinc-700 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Printer size={13} className="text-zinc-400 dark:text-zinc-505" />
                          <span>Print POS Slip</span>
                        </button>
                      </div>

                      {/* Section: Clear */}
                      <div className="p-1">
                        <button
                          type="button"
                          onClick={() => {
                            resetBill();
                            setActionsMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs font-semibold text-red-655 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} className="text-red-500 dark:text-red-400" />
                          <span>Clear Cart</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Scrollable Cart items list */}
              <div className="border border-zinc-150 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 scrollbar-thin mb-3">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-[10px] font-bold text-zinc-505 uppercase tracking-wider">Item</th>
                      <th className="px-3 py-1.5 text-center text-[10px] font-bold text-zinc-505 uppercase tracking-wider w-20">Qty</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-bold text-zinc-505 uppercase tracking-wider w-24">Rate</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-bold text-zinc-505 uppercase tracking-wider w-24">Amount</th>
                      <th className="px-3 py-1.5 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {bill.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[11px] text-zinc-505 dark:text-zinc-500 font-medium bg-white dark:bg-zinc-955">
                          Cart is empty. Select items on the left to begin.
                        </td>
                      </tr>
                    ) : (
                      bill.items.map((item, index) => (
                        <tr key={index} className="bg-white dark:bg-zinc-955">
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateItem(index, "name", e.target.value)}
                              className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-[#FF6A00] focus:ring-0 text-xs font-semibold py-0.5 px-0.5 text-zinc-900 dark:text-zinc-100"
                              placeholder="Item name"
                            />
                          </td>
                          <td className="px-2 py-1 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItemQuantity(index, e.target.value)}
                              className="w-12 bg-transparent border-0 border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-[#FF6A00] focus:ring-0 text-xs font-medium py-0.5 px-0.5 text-center text-zinc-900 dark:text-zinc-100"
                            />
                          </td>
                          <td className="px-2 py-1 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.price}
                              onChange={(e) => updateItem(index, "price", Math.max(0, Number(e.target.value) || 0))}
                              className="w-16 bg-transparent border-0 border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-[#FF6A00] focus:ring-0 text-xs font-medium py-0.5 px-0.5 text-right text-zinc-900 dark:text-zinc-100"
                            />
                          </td>
                          <td className="px-2 py-1 text-right text-xs font-black text-zinc-900 dark:text-zinc-100">
                            Rs {(Number(item.quantity || 1) * Number(item.price || 0)).toFixed(0)}
                          </td>
                          <td className="px-1 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-500 hover:text-red-750 p-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Checkout & Customer Details */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-3 shrink-0">
              {/* Customer Info */}
              <div className="space-y-2 relative">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-505 uppercase tracking-wider px-0.5">Customer Name</label>
                    <input
                      type="text"
                      value={bill.customerName}
                      onChange={(e) => {
                        updateBillField("customerName", e.target.value);
                        setCustomerSearchQuery(e.target.value);
                      }}
                      placeholder="Walk-in customer"
                      className="w-full h-8 px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs font-semibold focus:outline-none focus:border-[#FF6A00]/40 focus:ring-2 focus:ring-[#FF6A00]/5 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-505 uppercase tracking-wider px-0.5">Phone Number</label>
                    <input
                      type="text"
                      value={bill.customerPhone}
                      onChange={(e) => {
                        updateBillField("customerPhone", e.target.value);
                        setCustomerSearchQuery(e.target.value);
                      }}
                      placeholder="Mobile number"
                      className="w-full h-8 px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs font-semibold focus:outline-none focus:border-[#FF6A00]/40 focus:ring-2 focus:ring-[#FF6A00]/5 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* Autocomplete Dropdown */}
                {customerSearchQuery.trim() && filteredCustomers.length > 0 && (
                  <div className="absolute bottom-9 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg max-h-32 overflow-y-auto p-1 divide-y divide-zinc-100 dark:divide-zinc-800 animate-in fade-in duration-150">
                    {filteredCustomers.map((profile: any) => (
                      <button
                        key={profile.phone || `${profile.name}_${profile.email}`}
                        type="button"
                        onClick={() => {
                          handleSelectCustomer(profile);
                          setCustomerSearchQuery("");
                        }}
                        className="w-full text-left p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded text-[11px] transition-all flex justify-between items-center cursor-pointer"
                      >
                        <div>
                          <span className="font-bold text-zinc-805 dark:text-zinc-200">{profile.name}</span>
                          {profile.phone && <span className="text-zinc-400 dark:text-zinc-505 ml-2 font-medium">({profile.phone})</span>}
                        </div>
                        <span className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-505">{profile.billCount} bills</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Toggle for Advanced Customer Fields */}
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setShowMoreCustomerFields(!showMoreCustomerFields)}
                  className="text-[10px] text-[#FF6A00] hover:text-[#C85200] font-bold transition-colors cursor-pointer"
                >
                  {showMoreCustomerFields ? "- Hide More Customer Info" : "+ Add GST/Email/Address"}
                </button>
              </div>

              {showMoreCustomerFields && (
                <div className="grid grid-cols-2 gap-2 p-2 rounded bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/55 animate-in slide-in-from-top-1 duration-200">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-505 uppercase tracking-wider">Email</label>
                    <input
                      type="email"
                      value={bill.customerEmail || ""}
                      onChange={(e) => updateBillField("customerEmail", e.target.value)}
                      placeholder="Email address"
                      className="w-full h-8 px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:outline-none focus:border-[#FF6A00]/40 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-505 uppercase tracking-wider">GSTIN</label>
                    <input
                      type="text"
                      value={bill.customerGst || ""}
                      onChange={(e) => updateBillField("customerGst", e.target.value)}
                      placeholder="GST number"
                      className="w-full h-8 px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:outline-none focus:border-[#FF6A00]/40 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 col-span-2">
                    <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-505 uppercase tracking-wider">Billing Address</label>
                    <input
                      type="text"
                      value={bill.billingAddress || ""}
                      onChange={(e) => updateBillField("billingAddress", e.target.value)}
                      placeholder="Address details"
                      className="w-full h-8 px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:outline-none focus:border-[#FF6A00]/40 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              )}

              {/* Settlement details: discount, tax, payment method, notes */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-505 uppercase tracking-wider px-0.5">Discount (Rs)</label>
                  <input
                    type="number"
                    min="0"
                    value={bill.discount}
                    onChange={(e) => updateBillField("discount", Math.max(0, Number(e.target.value) || 0))}
                    className="w-full h-8 px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs font-semibold focus:outline-none focus:border-[#FF6A00]/40 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-505 uppercase tracking-wider px-0.5">Tax (GST %)</label>
                  <input
                    type="number"
                    min="0"
                    value={bill.taxPercent}
                    onChange={(e) => updateBillField("taxPercent", Math.max(0, Number(e.target.value) || 0))}
                    className="w-full h-8 px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs font-semibold focus:outline-none focus:border-[#FF6A00]/40 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-505 uppercase tracking-wider px-0.5">Payment Method</label>
                  <select
                    value={bill.paymentMethod}
                    onChange={(e) => updateBillField("paymentMethod", e.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs font-semibold focus:outline-none focus:border-[#FF6A00]/40 text-zinc-900 dark:text-zinc-100 cursor-pointer"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes field */}
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-505 uppercase tracking-wider px-0.5">Footer Notes</label>
                <input
                  type="text"
                  value={bill.notes || ""}
                  onChange={(e) => updateBillField("notes", e.target.value)}
                  placeholder="Thank you for shopping!"
                  className="w-full h-8 px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs focus:outline-none focus:border-[#FF6A00]/40 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {/* Document Output Toggle */}
              <div className="bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-150 dark:border-zinc-850 rounded-md p-2 space-y-1.5">
                <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-505 uppercase tracking-wider px-0.5 block">Document Format</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!hasInvoiceTools}
                    onClick={() => setDocType("invoice")}
                    className={`h-8 px-3 rounded-md border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${!hasInvoiceTools ? "opacity-40 cursor-not-allowed" : ""} ${docType === "invoice" ? "border-[#FF6A00] bg-[#FF6A00]/5 text-[#FF6A00] font-black" : "border-zinc-205 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:border-zinc-350 dark:hover:border-zinc-700"}`}
                  >
                    <FileText size={12} />
                    <span>A4 Tax Invoice</span>
                  </button>
                  <button
                    type="button"
                    disabled={!hasPosSlipTools}
                    onClick={() => setDocType("pos")}
                    className={`h-8 px-3 rounded-md border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${!hasPosSlipTools ? "opacity-40 cursor-not-allowed" : ""} ${docType === "pos" ? "border-[#FF6A00] bg-[#FF6A00]/5 text-[#FF6A00] font-black" : "border-zinc-205 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:border-zinc-350 dark:hover:border-zinc-700"}`}
                  >
                    <Receipt size={12} />
                    <span>80mm POS Slip</span>
                  </button>
                </div>
              </div>

              {/* Billing Summary & Actions */}
              <div className="bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 space-y-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calculator size={13} className="text-[#FF6A00]" />
                  <span className="text-[10px] font-bold text-zinc-805 dark:text-zinc-250 uppercase tracking-wider">Order Summary</span>
                </div>

                <div className="space-y-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span>Subtotal ({bill.items.length} items)</span>
                    <span className="text-zinc-700 dark:text-zinc-300 font-bold">Rs {subtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Discount</span>
                    <span className="text-red-500 font-bold">- Rs {discountAmount.toFixed(0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tax (GST)</span>
                    <span className="text-zinc-700 dark:text-zinc-300 font-bold">Rs {taxAmount.toFixed(0)}</span>
                  </div>
                  <div className="pt-2 mt-1 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-base font-black text-[#FF6A00]">
                    <span>Grand Total</span>
                    <span>Rs {grandTotal.toFixed(0)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-[1.1fr_0.9fr] gap-2 pt-2">
                  <Button
                    variant="primary"
                    loading={submittingBill}
                    onClick={handleGenerateAndPrint}
                    icon={Printer}
                    disabled={bill.items.length === 0}
                    className="w-full text-xs h-9 bg-[#FF6A00] hover:bg-[#C85200] border-[#FF6A00] text-white font-bold"
                  >
                    Checkout & Print
                  </Button>
                  <Button
                    variant="outline"
                    icon={Save}
                    disabled={!canManageBills || bill.items.length === 0}
                    loading={savingBill}
                    onClick={handleSaveBill}
                    className="w-full text-xs h-9"
                  >
                    {bill.id ? "Update Draft" : "Save Draft"}
                  </Button>
                </div>
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
                  <th className="px-3 py-2 text-left text-[11px] font-bold text-zinc-505">Source</th>
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
                      <td className="px-3 py-3">
                        {savedBill.source === "qr_table_checkout" ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400">
                              <Table2 size={9} />Table Order
                            </span>
                            {savedBill.tableName && (
                              <div className="text-[10px] text-zinc-500 mt-0.5 font-medium">{savedBill.tableName}</div>
                            )}
                            {savedBill.collectedBy && (
                              <div className="text-[9px] text-zinc-400">{savedBill.collectedBy}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                            Manual
                          </span>
                        )}
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
