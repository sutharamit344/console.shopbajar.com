import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchMasterFeatures,
  purchaseMerchantFeature,
  toggleMerchantFeature,
  fetchShopPayments,
} from "../../redux/thunks/dashboardThunks";
import { AppDispatch, RootState } from "../../redux/store";
import { useModal } from "../../hooks/useModal";
import Card from "../UI/Card";
import Button from "../UI/Button";
import Dialog from "../UI/Dialog";
import {
  Zap,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Bot,
  Star,
  Shield,
  Award,
  CheckCircle2,
  Clock,
  Check,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Phone,
  LayoutDashboard,
  FileText,
  Printer,
  QrCode,
  Calculator,
  CalendarDays,
  CreditCard,
  Building2,
  ChevronRight,
  Download,
  RefreshCw,
  Lock,
} from "lucide-react";

interface PaidFeaturesTabProps {
  shop: any;
}

const FEATURE_FLOWS: Record<string, { title: string; desc: string }[]> = {
  whatsapp_checkout: [
    { title: "Browse Catalog", desc: "Customers browse your interactive menu on the storefront." },
    { title: "Fill Cart Basket", desc: "Customers add multiple items with desired quantities into their inquiry basket." },
    { title: "WhatsApp Redirect", desc: "Customer clicks checkout and is routed to WhatsApp with an itemized inquiry message sent to your number." }
  ],
  dashboard_checkout: [
    { title: "Add to Inquiry", desc: "Customers add items to their cart and click 'Submit Inquiry to Dashboard'." },
    { title: "Details Submission", desc: "Customers submit their contact information (Name, Mobile, and Email) directly." },
    { title: "Dashboard Update", desc: "The inquiry is Atomic-logged and instantly appears inside your Merchant Console inbox." }
  ],
  billing_system: [
    { title: "Open Counter / Select Inquiry", desc: "Access the Billing & POS checkout register or select an inquiry from your inbox." },
    { title: "Configure Items & Taxes", desc: "Add menu items, apply discounts, write custom lines, and select tax rates." },
    { title: "Print POS Slip or A4 Invoice", desc: "Instantly output an 80mm thermal receipt or generate a professional PDF tax invoice." }
  ],
  qr_ordering: [
    { title: "Scan Table QR", desc: "Customers scan table-specific QR codes to open your storefront catalog." },
    { title: "Live Kitchen Routing", desc: "Placed orders bypass waiters and route directly to the Kitchen View dashboard." },
    { title: "Waiter Coordination", desc: "Kitchen flags dishes 'Ready to Serve' to alert FOH waiters on the Waiter Console." }
  ],
  table_booking: [
    { title: "Customer Books Online", desc: "Customer selects date, party size, available time slot, and fills contact details on your public shop profile." },
    { title: "Merchant Reviews", desc: "Booking appears in your Bookings console. Confirm or reject with one click. Customer is notified." },
    { title: "Seat Now → Live Session", desc: "When guest arrives, click 'Seat Now', assign a table — booking converts to an active session in your Tables view." }
  ],
  appointment_booking: [
    { title: "Define Services & Catalog", desc: "Flag catalog menu items as services and specify their durations." },
    { title: "Configure Shift Slots", desc: "Create staff profiles, assign services they perform, and set shift times/breaks." },
    { title: "Check Real-Time Scheduler", desc: "View and manage all appointments, CRM customer profiles, and policies in one central dashboard." }
  ]
};

const BANK_OPTIONS = [
  { id: "sbi", name: "State Bank of India", logo: "SBI" },
  { id: "hdfc", name: "HDFC Bank", logo: "HDFC" },
  { id: "icici", name: "ICICI Bank", logo: "ICICI" },
  { id: "axis", name: "Axis Bank", logo: "AXIS" },
  { id: "kotak", name: "Kotak Mahindra", logo: "KOTAK" },
];

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const PaidFeaturesTab: React.FC<PaidFeaturesTabProps> = ({ shop }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { showAlert } = useModal();
  const masterFeatures = useSelector((state: RootState) => state.dashboard.masterFeatures || []);
  const loadingFeatures = useSelector((state: RootState) => state.dashboard.loadingFeatures);
  const activatingFeatureKey = useSelector((state: RootState) => state.dashboard.activatingFeatureKey);

  // Payments from state
  const payments = useSelector((state: RootState) => (state.dashboard as any).payments || []);
  const loadingPayments = useSelector((state: RootState) => (state.dashboard as any).loadingPayments || false);

  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [checkoutFeature, setCheckoutFeature] = useState<any>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState("monthly");
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Multi-step Checkout States
  const [checkoutStep, setCheckoutStep] = useState<"details" | "payment" | "processing" | "success">("details");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [selectedBank, setSelectedBank] = useState("sbi");
  const [cardDetails, setCardDetails] = useState({ number: "", expiry: "", cvc: "", name: "" });
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [upiTimer, setUpiTimer] = useState(300);
  const [invoiceToPrint, setInvoiceToPrint] = useState<any>(null);
  const [showBankGateway, setShowBankGateway] = useState(false);
  const [bankAuthTimer, setBankAuthTimer] = useState(3);

  // Countdown timer for UPI QR Code
  useEffect(() => {
    let interval: any;
    if (checkoutStep === "payment" && paymentMethod === "upi" && upiTimer > 0) {
      interval = setInterval(() => {
        setUpiTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [checkoutStep, paymentMethod, upiTimer]);

  // Handle Bank Simulated redirect
  useEffect(() => {
    let timer: any;
    if (showBankGateway && bankAuthTimer > 0) {
      timer = setInterval(() => {
        setBankAuthTimer((prev) => prev - 1);
      }, 1000);
    } else if (showBankGateway && bankAuthTimer === 0) {
      setShowBankGateway(false);
      handleCompletePurchase("Net Banking", `TXN-SB-NB-${Math.floor(100000 + Math.random() * 900000)}`);
    }
    return () => clearInterval(timer);
  }, [showBankGateway, bankAuthTimer]);

  useEffect(() => {
    dispatch(fetchMasterFeatures());
    if (shop?.id) {
      dispatch(fetchShopPayments(shop.id));
    }
  }, [dispatch, shop?.id]);

  const paidFeaturesState = shop?.paidFeatures || {};

  const handleOpenCheckout = (feature: any) => {
    setCheckoutFeature(feature);
    setSelectedBillingCycle("monthly");
    setCheckoutStep("details");
    setCheckoutSuccess(false);
    setCardDetails({ number: "", expiry: "", cvc: "", name: "" });
    setCardErrors({});
    setUpiTimer(300);
  };

  const calculatePrice = (basePrice: number, cycle: string) => {
    if (cycle === "annual") {
      return Math.round(basePrice * 10 * 0.8);
    } else if (cycle === "one-time") {
      return basePrice * 25;
    }
    return basePrice;
  };

  const handleInitiatePayment = async () => {
    if (!checkoutFeature) return;

    const price = checkoutFeature.price || 0;
    const finalPrice = calculatePrice(price, selectedBillingCycle);

    // Check if real Razorpay gateway key is provided in environment variables
    const rzpKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
    const isRealRazorpay = rzpKeyId && rzpKeyId !== "rzp_test_placeholder" && rzpKeyId !== "";

    if (isRealRazorpay) {
      setCheckoutStep("processing");

      try {
        // 1. Create order on the backend
        const totalAmount = Math.round(finalPrice * 1.18);
        const amountInPaise = totalAmount * 100;

        const createOrderRes = await fetch("/api/create-order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: "INR",
            receipt: `r_${shop.id.slice(0, 6)}_${checkoutFeature.featureKey.slice(0, 6)}_${Date.now().toString().slice(-8)}`,
          }),
        });

        if (!createOrderRes.ok) {
          const errData = await createOrderRes.json();
          throw new Error(errData.error || "Failed to create order on payment server.");
        }

        const orderData = await createOrderRes.json();
        const { order_id } = orderData;

        // 2. Load script
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          setCheckoutStep("details");
          showAlert({
            title: "Gateway Error",
            message: "Failed to load Razorpay payment gateway script. Please verify internet connection.",
            type: "error",
          });
          return;
        }

        // 3. Configure options with order_id
        const options = {
          key: rzpKeyId,
          amount: amountInPaise, // Amount in paise
          currency: "INR",
          name: "ShopBajar",
          description: `Activate ${checkoutFeature.title} (${selectedBillingCycle})`,
          image: `${window.location.origin}/brand-logo-v1.png`,
          order_id: order_id, // Pass order ID generated from server
          handler: async function (response: any) {
            setCheckoutStep("processing");
            try {
              // 4. Verify payment signature on the backend
              const verifyRes = await fetch("/api/verify-payment", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });

              if (!verifyRes.ok) {
                const verifyErr = await verifyRes.json();
                throw new Error(verifyErr.error || "Payment signature verification failed.");
              }

              const verifyData = await verifyRes.json();
              if (verifyData.status === "success" && verifyData.verified) {
                await handleCompletePurchase(
                  "Razorpay Live",
                  response.razorpay_payment_id
                );
              } else {
                throw new Error("Payment signature verification failed.");
              }
            } catch (err: any) {
              console.error("Signature verification error", err);
              setCheckoutStep("details");
              showAlert({
                title: "Verification Failed",
                message: `Payment Verification Failed: ${err.message || "Invalid signature"}`,
                type: "error",
              });
            }
          },
          modal: {
            ondismiss: function () {
              setCheckoutStep("details");
            },
          },
          prefill: {
            name: shop.ownerName || "Merchant",
            email: shop.ownerEmail || shop.email || "",
            contact: shop.phone || "",
          },
          notes: {
            shopId: shop.id,
            featureKey: checkoutFeature.featureKey,
          },
          theme: {
            color: "#FF6A00",
          },
        };

        const rzp = new (window as any).Razorpay(options);

        // Handle payment failure event
        rzp.on("payment.failed", function (response: any) {
          console.error("Razorpay payment failed:", response.error);
          showAlert({
            title: "Payment Failed",
            message: `Payment Failed: ${response.error.description || "Transaction declined"}`,
            type: "error",
          });
          setCheckoutStep("details");
        });

        rzp.open();
      } catch (err: any) {
        console.error("Razorpay setup failed", err);
        setCheckoutStep("details");
        showAlert({
          title: "Setup Error",
          message: err.message || "Failed to initiate payment gateway. Please try again.",
          type: "error",
        });
      }
    } else {
      // Transition to sandbox payment method selection
      setCheckoutStep("payment");
    }
  };

  const handleCompletePurchase = async (methodUsed: string, txnId: string) => {
    if (!checkoutFeature) return;

    setCheckoutStep("processing");
    const basePrice = checkoutFeature.price || 0;
    const finalPrice = calculatePrice(basePrice, selectedBillingCycle);

    const result = await dispatch(
      purchaseMerchantFeature({
        shopId: shop.id,
        featureKey: checkoutFeature.featureKey,
        featureTitle: checkoutFeature.title,
        billingCycle: selectedBillingCycle,
        price: finalPrice,
        trialDays: 0, // Paid subscription, so no trial days
        currentPaidFeatures: paidFeaturesState,
        paymentMethod: methodUsed,
        transactionId: txnId,
        amountPaid: Math.round(finalPrice * 1.18),
        gstAmount: Math.round(finalPrice * 0.18),
      })
    ).unwrap();

    if (result) {
      setCheckoutSuccess(true);
      setCheckoutStep("success");
      dispatch(fetchShopPayments(shop.id));
      setTimeout(() => {
        setCheckoutFeature(null);
        setCheckoutSuccess(false);
        setCheckoutStep("details");
      }, 1800);
    }
  };

  const handleStartFreeTrial = async () => {
    if (!checkoutFeature) return;

    setCheckoutStep("processing");

    const result = await dispatch(
      purchaseMerchantFeature({
        shopId: shop.id,
        featureKey: checkoutFeature.featureKey,
        featureTitle: checkoutFeature.title,
        billingCycle: "trial",
        price: 0,
        trialDays: checkoutFeature.trialDays || 14,
        currentPaidFeatures: paidFeaturesState,
        paymentMethod: "Free Trial",
        transactionId: `TRIAL-${Math.floor(100000 + Math.random() * 900000)}`,
        amountPaid: 0,
        gstAmount: 0,
      })
    ).unwrap();

    if (result) {
      setCheckoutSuccess(true);
      setCheckoutStep("success");
      dispatch(fetchShopPayments(shop.id));
      setTimeout(() => {
        setCheckoutFeature(null);
        setCheckoutSuccess(false);
        setCheckoutStep("details");
      }, 1800);
    }
  };

  const handleSandboxSubmit = async () => {
    if (paymentMethod === "card") {
      const errors: Record<string, string> = {};
      const cleanNum = cardDetails.number.replace(/\s+/g, "");
      if (cleanNum.length < 16) errors.number = "Must be a valid 16-digit card";
      if (!/^\d{2}\/\d{2}$/.test(cardDetails.expiry)) errors.expiry = "Use MM/YY format";
      if (cardDetails.cvc.length < 3) errors.cvc = "Use 3-digit CVC";
      if (!cardDetails.name.trim()) errors.name = "Holder name required";

      if (Object.keys(errors).length > 0) {
        setCardErrors(errors);
        return;
      }

      await handleCompletePurchase(
        `Card (${detectCardBrand(cardDetails.number)})`,
        `TXN-SB-CC-${Math.floor(100000 + Math.random() * 900000)}`
      );
    } else if (paymentMethod === "upi") {
      await handleCompletePurchase("UPI Scan", `TXN-SB-UPI-${Math.floor(100000 + Math.random() * 900000)}`);
    } else {
      // Net Banking
      setBankAuthTimer(3);
      setShowBankGateway(true);
    }
  };

  const detectCardBrand = (num: string) => {
    const cleanNum = num.replace(/\s+/g, "");
    if (cleanNum.startsWith("4")) return "Visa";
    if (/^5[1-5]/.test(cleanNum)) return "Mastercard";
    if (/^6(0|5)/.test(cleanNum)) return "RuPay";
    return "Card";
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(" ");
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const clean = value.replace(/[^0-9]/g, "");
    if (clean.length >= 2) {
      return `${clean.slice(0, 2)}/${clean.slice(2, 4)}`;
    }
    return clean;
  };

  const handleToggleFeature = async (featureKey: string, currentStatus: boolean) => {
    await dispatch(
      toggleMerchantFeature({
        shopId: shop.id,
        featureKey,
        enabled: !currentStatus,
        currentPaidFeatures: paidFeaturesState,
      })
    );
  };

  const renderFeatureFlow = (featureKey: string) => {
    const steps = FEATURE_FLOWS[featureKey];
    if (!steps) return null;

    return (
      <div className="space-y-2.5">
        <h4 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <Sparkles size={10} className="text-[#FF6A00]" /> Operational Flow
        </h4>
        <div className="relative border-l border-zinc-200 dark:border-zinc-800 ml-1.5 pl-[18px] space-y-3.5">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="absolute -left-[26px] top-0.5 w-4 h-4 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-650 dark:text-zinc-400 shadow-2xs">
                {index + 1}
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{step.title}</div>
                <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderIcon = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      ShoppingBag: <ShoppingBag size={16} className="text-[#FF6A00]" />,
      TrendingUp: <TrendingUp size={16} className="text-blue-500" />,
      Zap: <Zap size={16} className="text-amber-500" />,
      Sparkles: <Sparkles size={16} className="text-purple-500" />,
      Bot: <Bot size={16} className="text-emerald-500" />,
      Star: <Star size={16} className="text-yellow-500" />,
      Shield: <Shield size={16} className="text-indigo-500" />,
      Award: <Award size={16} className="text-rose-500" />,
      Phone: <Phone size={16} className="text-emerald-500" />,
      LayoutDashboard: <LayoutDashboard size={16} className="text-sky-500" />,
      FileText: <FileText size={16} className="text-orange-500" />,
      Printer: <Printer size={16} className="text-violet-500" />,
      QrCode: <QrCode size={16} className="text-[#FF6A00]" />,
      Calculator: <Calculator size={16} className="text-violet-550" />,
      CalendarDays: <CalendarDays size={16} className="text-[#FF6A00]" />,
    };
    return icons[iconName] || <Sparkles size={16} className="text-zinc-500" />;
  };

  if (loadingFeatures) {
    return (
      <div className="py-16 text-center">
        <div className="w-6 h-6 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest animate-pulse">
          Loading Marketplace Add-ons...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-4 sm:p-5 rounded-md text-white relative overflow-hidden border border-zinc-200/5 dark:border-zinc-800 shadow-md">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF6A00]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 max-w-xl space-y-2">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 backdrop-blur-md rounded border border-white/10 text-[9px] font-bold uppercase tracking-widest text-[#FF6A00]">
            <Sparkles size={10} /> SaaS Marketplace
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Supercharge Your Storefront</h2>
          <p className="text-[11px] sm:text-xs text-zinc-400 font-medium leading-relaxed">
            Unlock enterprise-grade capabilities instantly. From multi-item WhatsApp checkout baskets to AI copilot
            automations, scale your operations with zero coding.
          </p>
        </div>
      </div>

      {/* Features Grid */}
      {masterFeatures.length === 0 ? (
        <Card
          padding={false}
          className="py-12 text-center border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md"
        >
          <AlertCircle size={28} className="text-zinc-400 mx-auto mb-2" />
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1">No SaaS Add-ons Available</h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto font-medium">
            Platform administrators have not configured any premium add-ons in the Features Master console yet.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {masterFeatures.map((feature) => {
            const merchFeature = paidFeaturesState[feature.featureKey];
            const isPurchased = !!merchFeature;
            const isExpired = merchFeature?.isExpired;
            const isEnabled = merchFeature?.enabled && !isExpired;
            const isTrial = merchFeature?.status === "trial";

            return (
              <Card
                key={feature.id}
                padding={false}
                className={`p-4 flex flex-col justify-between relative overflow-hidden transition-all duration-300 border rounded-md ${
                  isPurchased
                    ? isExpired
                      ? "bg-rose-500/5 dark:bg-rose-950/10 border-rose-500/20"
                      : isEnabled
                      ? "bg-white dark:bg-zinc-900 border-emerald-500/30 shadow-md shadow-emerald-500/5"
                      : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-75"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs hover:shadow-sm"
                }`}
              >
                {/* Top Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-2xs">
                    {renderIcon(feature.icon)}
                  </div>
                  <div>
                    {isPurchased ? (
                      <div className="flex items-center gap-1.5">
                        {isExpired ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            <Clock size={10} /> Expired
                          </span>
                        ) : isTrial ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <Clock size={10} /> Trial Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <CheckCircle2 size={10} /> Active
                          </span>
                        )}
                        {!isExpired && (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!isEnabled}
                              onChange={() => handleToggleFeature(feature.featureKey, isEnabled)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4.5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        Optional Add-on
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-1.5 mb-4 flex-1">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed line-clamp-3">
                    {feature.description}
                  </p>
                </div>

                {/* Pricing & Actions */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-end justify-between gap-3 mt-auto">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-0.5">
                      {isPurchased && !isExpired ? "Current Plan" : "Investment"}
                    </span>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-base font-black text-[#FF6A00]">
                        ₹{isPurchased ? merchFeature.price : feature.price}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        /{isPurchased ? merchFeature.billingCycle : feature.billingCycle}
                      </span>
                    </div>
                  </div>

                  <div>
                    {isPurchased && !isExpired ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFeature(feature)}
                        className="text-xs font-bold text-zinc-650 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-8 px-2.5 rounded-md cursor-pointer"
                      >
                        Manage
                      </Button>
                    ) : (
                      <Button
                        variant="dark"
                        size="sm"
                        onClick={() => handleOpenCheckout(feature)}
                        className="text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-1 h-8 px-2.5 rounded-md cursor-pointer"
                      >
                        {isExpired ? "Renew Plan" : feature.trialDays ? `Start ${feature.trialDays}-Day Trial` : "Upgrade Now"}
                        <ArrowRight size={12} />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Billing & Invoices History Section */}
      <Card
        padding={false}
        className="p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md"
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Billing & Subscription Invoices
            </h3>
            <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              Review history, transaction logs, and download tax invoices
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch(fetchShopPayments(shop.id))}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
            title="Reload Transactions"
          >
            <RefreshCw size={14} className={loadingPayments ? "animate-spin" : ""} />
          </Button>
        </div>

        {loadingPayments ? (
          <div className="py-8 text-center text-xs font-bold text-zinc-400 uppercase tracking-widest animate-pulse">
            Fetching Transactions...
          </div>
        ) : payments.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50/50 dark:bg-zinc-950/20 text-zinc-400 font-medium text-xs">
            No active SaaS transactions found. Once you purchase an add-on, tax receipts will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto border border-zinc-150 dark:border-zinc-800 rounded-md">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-150 dark:border-zinc-800 font-bold text-zinc-500 dark:text-zinc-400 uppercase text-[9px] tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3">Feature Name</th>
                  <th className="p-3">Cycle</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3 text-right">Amount (incl. GST)</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium text-zinc-700 dark:text-zinc-300">
                {payments.map((payment: any) => (
                  <tr
                    key={payment.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="p-3 whitespace-nowrap text-[11px]">
                      {payment.createdAt
                        ? new Date(payment.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "N/A"}
                    </td>
                    <td className="p-3 font-bold text-zinc-900 dark:text-zinc-100">
                      {payment.featureTitle || payment.featureKey}
                    </td>
                    <td className="p-3 capitalize">{payment.billingCycle}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1">
                        <Lock size={10} className="text-emerald-500 shrink-0" />
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[10px] text-zinc-400 select-all">
                      {payment.transactionId}
                    </td>
                    <td className="p-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                      ₹{payment.amountPaid}
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInvoiceToPrint(payment)}
                        className="h-7 px-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Printer size={10} />
                        Invoice
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Feature Detail Modal */}
      <Dialog
        isOpen={!!selectedFeature}
        onClose={() => setSelectedFeature(null)}
        title={selectedFeature?.title}
        subtitle="Feature Entitlement & Subscription Management"
        maxWidth="max-w-[450px]"
      >
        {selectedFeature && (
          <div className="space-y-4 pt-1.5">
            <div className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Status
                </span>
                {paidFeaturesState[selectedFeature.featureKey]?.isExpired ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20">
                    <Clock size={10} /> Expired
                  </span>
                ) : paidFeaturesState[selectedFeature.featureKey]?.status === "trial" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    <Clock size={10} /> Trial Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <CheckCircle2 size={10} /> Subscribed
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Billing Cycle
                </span>
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 capitalize">
                  {paidFeaturesState[selectedFeature.featureKey]?.billingCycle || selectedFeature.billingCycle}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Current Plan Price
                </span>
                <span className="text-xs font-bold text-[#FF6A00]">₹{paidFeaturesState[selectedFeature.featureKey]?.price ?? selectedFeature.price}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider">
                  Activation Date
                </span>
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {paidFeaturesState[selectedFeature.featureKey]?.activatedAt ? (
                    new Date(paidFeaturesState[selectedFeature.featureKey].activatedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  ) : (
                    "N/A"
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Capabilities Unlocked
              </h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
                {selectedFeature.description}
              </p>
            </div>

            <div className="p-3.5 rounded-md bg-zinc-50/50 dark:bg-zinc-800/20 border border-zinc-200/60 dark:border-zinc-800/60">
              {renderFeatureFlow(selectedFeature.featureKey)}
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-1.5">
              {(paidFeaturesState[selectedFeature.featureKey]?.status === "trial" || paidFeaturesState[selectedFeature.featureKey]?.isExpired) && (
                <Button
                  variant="dark"
                  onClick={() => {
                    const feat = selectedFeature;
                    setSelectedFeature(null);
                    handleOpenCheckout(feat);
                  }}
                  className="font-bold text-xs h-8 px-4 rounded-md cursor-pointer flex items-center gap-1.5"
                >
                  {paidFeaturesState[selectedFeature.featureKey]?.isExpired ? "Renew Plan" : "Upgrade to Paid Plan"}
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => setSelectedFeature(null)}
                className="font-bold text-xs h-8 px-3 rounded-md cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Checkout and Payment Gateway Wizard Modal */}
      <Dialog
        isOpen={!!checkoutFeature}
        onClose={() => setCheckoutFeature(null)}
        title={
          checkoutStep === "payment"
            ? "Secure Sandbox Payment Gateway"
            : checkoutStep === "processing"
            ? "Processing Transaction..."
            : `Provision ${checkoutFeature?.title}`
        }
        subtitle={
          checkoutStep === "payment"
            ? "Merchant Sandbox Checkout Portal"
            : checkoutStep === "processing"
            ? "Securing authorization tokens..."
            : "Select subscription parameters & configure billing"
        }
        maxWidth="max-w-[460px]"
      >
        {checkoutFeature && (
          <div className="space-y-4 pt-1.5 text-zinc-900 dark:text-zinc-150">
            {/* Step 1: Configuration and Review */}
            {checkoutStep === "details" && (
              <>
                <div className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-2xs">
                      {renderIcon(checkoutFeature.icon)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        {checkoutFeature.title}
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium leading-snug">
                        {checkoutFeature.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                    Choose Subscription Cycle
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: "monthly", label: "Monthly", calc: checkoutFeature.price, sub: "Regular" },
                      {
                        id: "annual",
                        label: "Annual",
                        calc: Math.round(checkoutFeature.price * 10 * 0.8),
                        sub: "Save 20%",
                      },
                      { id: "one-time", label: "Lifetime", calc: checkoutFeature.price * 25, sub: "One-time" },
                    ].map((cycle) => (
                      <button
                        key={cycle.id}
                        type="button"
                        onClick={() => setSelectedBillingCycle(cycle.id)}
                        className={`p-2.5 rounded-md border text-left flex flex-col justify-between transition-all relative overflow-hidden cursor-pointer ${
                          selectedBillingCycle === cycle.id
                            ? "border-[#FF6A00] bg-[#FF6A00]/5 shadow-sm dark:bg-[#FF6A00]/10"
                            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-650"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{cycle.label}</div>
                          <div className="text-[9px] font-bold text-[#FF6A00] mt-0.5">{cycle.sub}</div>
                        </div>
                        <div className="text-xs font-black text-zinc-900 dark:text-zinc-100 mt-2">
                          ₹{cycle.calc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {checkoutFeature.trialDays > 0 && (
                  <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-amber-700 dark:text-amber-400">
                    <Clock size={16} className="shrink-0" />
                    <p className="text-[11px] font-medium leading-snug">
                      Includes a <span className="font-bold">{checkoutFeature.trialDays}-day free trial</span>. You
                      won&apos;t be charged until the trial period ends.
                    </p>
                  </div>
                )}

                {/* Billing Breakdown */}
                <div className="p-3 rounded-md bg-zinc-100 dark:bg-zinc-855 border border-zinc-200 dark:border-zinc-700 space-y-1.5 text-[11px]">
                  <div className="flex justify-between font-medium text-zinc-600 dark:text-zinc-300">
                    <span>Base Entitlement (Subtotal)</span>
                    <span>₹{calculatePrice(checkoutFeature.price, selectedBillingCycle)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-zinc-600 dark:text-zinc-300">
                    <span>GST (18% Integrated Rate)</span>
                    <span>₹{Math.round(calculatePrice(checkoutFeature.price, selectedBillingCycle) * 0.18)}</span>
                  </div>
                  <div className="pt-1.5 border-t border-zinc-200 dark:border-zinc-700 flex justify-between font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                    <span>Total Billable Amount</span>
                    <span className="text-[#FF6A00]">
                      ₹{Math.round(calculatePrice(checkoutFeature.price, selectedBillingCycle) * 1.18)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-150 dark:border-zinc-805 flex justify-between items-center">
                  <div className="flex items-center gap-1 text-zinc-400 text-[10px] font-medium">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    {import.meta.env.VITE_RAZORPAY_KEY_ID &&
                    import.meta.env.VITE_RAZORPAY_KEY_ID !== "rzp_test_placeholder"
                      ? "Razorpay Live Gateway"
                      : "SaaS Billing System"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      onClick={() => setCheckoutFeature(null)}
                      className="font-bold text-xs h-8 px-3 rounded-md cursor-pointer"
                    >
                      Cancel
                    </Button>
                    {checkoutFeature.trialDays > 0 && (
                      <Button
                        variant="ghost"
                        onClick={handleStartFreeTrial}
                        className="font-bold text-xs h-8 px-3.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer text-amber-600 dark:text-amber-500"
                      >
                        Start Free Trial
                      </Button>
                    )}
                    <Button
                      variant="dark"
                      onClick={handleInitiatePayment}
                      className="font-bold text-xs px-4 shadow-sm h-8 rounded-md cursor-pointer flex items-center gap-1.5"
                    >
                      Proceed to Pay <ChevronRight size={12} />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Sandbox Payment Gateway Selection */}
            {checkoutStep === "payment" && (
              <div className="space-y-4">
                {/* Secure Gateway info bar */}
                <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-2 text-[10px] font-bold">
                  <Lock size={12} className="shrink-0" />
                  DEVELOPMENT MODE: No live credentials configured. Running via secure Sandbox Simulator.
                </div>

                {/* Gateway Tab selection */}
                <div className="flex border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden bg-zinc-50 dark:bg-zinc-900 p-0.5 gap-0.5">
                  {(["upi", "card", "netbanking"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`flex-1 py-1.5 px-2 rounded-sm text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMethod === method
                          ? "bg-white dark:bg-zinc-800 text-[#FF6A00] shadow-xs"
                          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      {method === "upi" ? (
                        <QrCode size={12} />
                      ) : method === "card" ? (
                        <CreditCard size={12} />
                      ) : (
                        <Building2 size={12} />
                      )}
                      {method === "upi"
                        ? "UPI QR"
                        : method === "card"
                        ? "Card Details"
                        : "Net Banking"}
                    </button>
                  ))}
                </div>

                {/* Method Panel 1: UPI QR Scanner */}
                {paymentMethod === "upi" && (
                  <div className="space-y-3 py-1 flex flex-col items-center">
                    <div className="text-center space-y-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                        Scan QR Code via UPI App
                      </span>
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        Scan with GPay, PhonePe, Paytm, or BHIM.
                      </p>
                    </div>

                    <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm flex flex-col items-center relative overflow-hidden">
                      {/* Generates a neat mockup of UPI QR Code */}
                      <svg
                        width="160"
                        height="160"
                        viewBox="0 0 100 100"
                        className="text-zinc-900 dark:text-white"
                      >
                        <rect x="0" y="0" width="100" height="100" fill="none" />
                        {/* Outer corners */}
                        <path
                          d="M 5,5 h 25 v 8 h -17 v 17 h -8 Z M 95,5 h -25 v 8 h 17 v 17 h 8 Z M 5,95 h 25 v -8 h -17 v -17 h -8 Z M 95,95 h -25 v -8 h 17 v -17 h 8 Z"
                          fill="currentColor"
                        />
                        {/* Nested boxes for scan markers */}
                        <rect x="10" y="10" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="4" />
                        <rect x="15" y="15" width="6" height="6" fill="currentColor" />
                        <rect x="74" y="10" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="4" />
                        <rect x="79" y="15" width="6" height="6" fill="currentColor" />
                        <rect x="10" y="74" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="4" />
                        <rect x="15" y="79" width="6" height="6" fill="currentColor" />
                        {/* QR Pixels representation */}
                        <path
                          d="M 35,10 h 4 v 4 h -4 Z M 43,10 h 8 v 4 h -8 Z M 55,10 h 4 v 4 h -4 Z M 63,10 h 4 v 4 h -4 Z M 35,18 h 8 v 4 h -8 Z M 47,18 h 4 v 8 h -4 Z M 59,18 h 8 v 4 h -8 Z M 35,30 h 4 v 4 h -4 Z M 47,30 h 4 v 4 h -4 Z M 55,30 h 12 v 4 h -12 Z M 10,35 h 4 v 12 h -4 Z M 18,35 h 8 v 4 h -8 Z M 30,35 h 4 v 4 h -4 Z M 38,35 h 12 v 4 h -12 Z M 55,35 h 4 v 12 h -4 Z M 67,35 h 4 v 8 h -4 Z M 75,35 h 12 v 4 h -12 Z M 87,43 h 4 v 8 h -4 Z M 10,51 h 12 v 4 h -12 Z M 26,51 h 4 v 4 h -4 Z M 34,51 h 8 v 4 h -8 Z M 46,51 h 4 v 8 h -4 Z M 54,51 h 12 v 4 h -12 Z M 70,51 h 4 v 4 h -4 Z M 78,51 h 8 v 4 h -8 Z M 18,59 h 4 v 8 h -4 Z M 26,59 h 12 v 4 h -12 Z M 42,59 h 4 v 4 h -4 Z M 50,59 h 8 v 4 h -8 Z M 62,59 h 4 v 8 h -4 Z M 74,59 h 12 v 4 h -12 Z M 10,70 h 4 v 4 h -4 Z M 30,70 h 8 v 4 h -8 Z M 42,70 h 4 v 8 h -4 Z M 50,70 h 12 v 4 h -12 Z M 66,70 h 4 v 4 h -4 Z M 30,78 h 4 v 12 h -4 Z M 38,78 h 8 v 4 h -8 Z M 50,78 h 4 v 4 h -4 Z M 58,78 h 12 v 4 h -12 Z M 70,86 h 8 v 4 h -8 Z M 82,86 h 8 v 4 h -8 Z"
                          fill="currentColor"
                        />
                        {/* Scanner Logo center box */}
                        <rect x="42" y="42" width="16" height="16" fill="white" stroke="#FF6A00" strokeWidth="2" rx="2" />
                        <path d="M 46,47 h 8 v 2 h -8 Z M 46,51 h 8 v 2 h -8 Z" fill="#FF6A00" />
                      </svg>
                      {upiTimer === 0 ? (
                        <div className="absolute inset-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
                          <AlertCircle size={24} className="text-red-500 mb-1" />
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">QR Code Expired</h4>
                          <button
                            onClick={() => setUpiTimer(300)}
                            className="mt-2 text-xs font-bold text-[#FF6A00] underline"
                          >
                            Generate New QR
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 text-[10px] font-black text-zinc-400 font-mono">
                          Expires in:{" "}
                          <span className="text-red-500 font-bold">
                            {Math.floor(upiTimer / 60)}:{(upiTimer % 60).toString().padStart(2, "0")}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="w-full bg-zinc-50 dark:bg-zinc-800 p-2.5 rounded border border-zinc-200 dark:border-zinc-700 text-center text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Total Payable:{" "}
                      <span className="text-[#FF6A00]">
                        ₹{Math.round(calculatePrice(checkoutFeature.price, selectedBillingCycle) * 1.18)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Method Panel 2: Credit / Debit Card Form */}
                {paymentMethod === "card" && (
                  <div className="space-y-3 py-1">
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                          Card Number
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="4111 2222 3333 4444"
                            maxLength={19}
                            value={cardDetails.number}
                            onChange={(e) => {
                              const formatted = formatCardNumber(e.target.value);
                              setCardDetails({ ...cardDetails, number: formatted });
                              if (cardErrors.number) {
                                const errs = { ...cardErrors };
                                delete errs.number;
                                setCardErrors(errs);
                              }
                            }}
                            className={`w-full h-8 px-3 pr-8 rounded border text-xs bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#FF6A00] transition-all font-mono font-medium ${
                              cardErrors.number
                                ? "border-red-500"
                                : "border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                            }`}
                          />
                          <div className="absolute right-2.5 top-2.5 flex items-center justify-center">
                            {detectCardBrand(cardDetails.number) === "Visa" ? (
                              <span className="text-[9px] font-black italic text-blue-600 bg-blue-100/50 px-1 rounded">
                                VISA
                              </span>
                            ) : detectCardBrand(cardDetails.number) === "Mastercard" ? (
                              <span className="text-[9px] font-black italic text-orange-600 bg-orange-100/50 px-1 rounded">
                                MC
                              </span>
                            ) : detectCardBrand(cardDetails.number) === "RuPay" ? (
                              <span className="text-[9px] font-black italic text-sky-600 bg-sky-100/50 px-1 rounded">
                                RUPAY
                              </span>
                            ) : (
                              <CreditCard size={13} className="text-zinc-400" />
                            )}
                          </div>
                        </div>
                        {cardErrors.number && (
                          <span className="text-[9px] text-red-500 font-bold block mt-0.5">
                            {cardErrors.number}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                            Expiry Date
                          </label>
                          <input
                            type="text"
                            placeholder="MM/YY"
                            maxLength={5}
                            value={cardDetails.expiry}
                            onChange={(e) => {
                              const formatted = formatExpiry(e.target.value);
                              setCardDetails({ ...cardDetails, expiry: formatted });
                              if (cardErrors.expiry) {
                                const errs = { ...cardErrors };
                                delete errs.expiry;
                                setCardErrors(errs);
                              }
                            }}
                            className={`w-full h-8 px-3 rounded border text-xs bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#FF6A00] transition-all font-mono font-medium ${
                              cardErrors.expiry
                                ? "border-red-500"
                                : "border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                            }`}
                          />
                          {cardErrors.expiry && (
                            <span className="text-[9px] text-red-500 font-bold block mt-0.5">
                              {cardErrors.expiry}
                            </span>
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                            CVC / CVV
                          </label>
                          <input
                            type="password"
                            placeholder="•••"
                            maxLength={3}
                            value={cardDetails.cvc}
                            onChange={(e) => {
                              const formatted = e.target.value.replace(/[^0-9]/g, "");
                              setCardDetails({ ...cardDetails, cvc: formatted });
                              if (cardErrors.cvc) {
                                const errs = { ...cardErrors };
                                delete errs.cvc;
                                setCardErrors(errs);
                              }
                            }}
                            className={`w-full h-8 px-3 rounded border text-xs bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#FF6A00] transition-all font-mono font-medium ${
                              cardErrors.cvc
                                ? "border-red-500"
                                : "border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                            }`}
                          />
                          {cardErrors.cvc && (
                            <span className="text-[9px] text-red-500 font-bold block mt-0.5">
                              {cardErrors.cvc}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                          Name on Card
                        </label>
                        <input
                          type="text"
                          placeholder="Cardholder Full Name"
                          value={cardDetails.name}
                          onChange={(e) => {
                            setCardDetails({ ...cardDetails, name: e.target.value });
                            if (cardErrors.name) {
                              const errs = { ...cardErrors };
                              delete errs.name;
                              setCardErrors(errs);
                            }
                          }}
                          className={`w-full h-8 px-3 rounded border text-xs bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#FF6A00] transition-all font-medium ${
                            cardErrors.name
                              ? "border-red-500"
                              : "border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                          }`}
                        />
                        {cardErrors.name && (
                          <span className="text-[9px] text-red-500 font-bold block mt-0.5">
                            {cardErrors.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Method Panel 3: Net Banking */}
                {paymentMethod === "netbanking" && (
                  <div className="space-y-3 py-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                      Select Popular Retail Bank
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {BANK_OPTIONS.map((bank) => (
                        <button
                          key={bank.id}
                          type="button"
                          onClick={() => setSelectedBank(bank.id)}
                          className={`p-2 rounded border text-left flex items-center justify-between transition-all cursor-pointer ${
                            selectedBank === bank.id
                              ? "border-[#FF6A00] bg-[#FF6A00]/5 text-[#FF6A00] dark:bg-[#FF6A00]/10"
                              : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300"
                          }`}
                        >
                          <span className="text-xs font-bold">{bank.name}</span>
                          <span className="text-[8px] font-bold uppercase opacity-50 font-mono">
                            {bank.logo}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Row */}
                <div className="pt-3 border-t border-zinc-150 dark:border-zinc-800 flex justify-between items-center mt-3">
                  <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1">
                    <Lock size={11} className="text-emerald-500" /> Secure Sandbox SSL
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep("details")}
                      className="text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-3 py-1.5 rounded cursor-pointer"
                    >
                      Back
                    </button>
                    <Button
                      variant="dark"
                      onClick={handleSandboxSubmit}
                      className="font-bold text-xs h-8 px-4 rounded shadow-sm cursor-pointer"
                    >
                      Pay ₹{Math.round(calculatePrice(checkoutFeature.price, selectedBillingCycle) * 1.18)}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Transaction Processing Spinner */}
            {checkoutStep === "processing" && (
              <div className="py-12 text-center space-y-4">
                <div className="relative w-12 h-12 mx-auto">
                  <div className="absolute inset-0 border-2 border-zinc-200 dark:border-zinc-800 rounded-full" />
                  <div className="absolute inset-0 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Contacting Payment Processor</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium max-w-xs mx-auto">
                    Verifying authorization locks and committing tokenized ledger records to Firestore...
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Success Entitlement Provisioned */}
            {checkoutStep === "success" && (
              <div className="py-10 text-center space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 shadow-xs">
                  <Check size={24} className="stroke-[3]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    SaaS Add-on Activated!
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto font-medium leading-relaxed">
                    Subscription has been Atomic-logged. Entitlements configured. You can now toggle the feature on
                    your dashboard.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Net Banking Redirection Portal Simulation Overlay */}
      <Dialog
        isOpen={showBankGateway}
        onClose={() => setShowBankGateway(false)}
        title="Bank Authorization Gateway"
        subtitle="Secure Redirect"
        maxWidth="max-w-[400px]"
      >
        <div className="py-8 text-center space-y-4 text-zinc-900 dark:text-zinc-150">
          <div className="w-10 h-10 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
            <Building2 size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold">Connecting to {selectedBank.toUpperCase()} Secure Server</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              Do not close this window or click refresh. Verifying credentials...
            </p>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden max-w-xs mx-auto">
            <div
              className="bg-[#FF6A00] h-full transition-all duration-1000"
              style={{ width: `${(3 - bankAuthTimer) * 33.3}%` }}
            />
          </div>
          <span className="text-[10px] font-mono font-bold text-zinc-400">
            Auto-Redirect in {bankAuthTimer}s
          </span>
        </div>
      </Dialog>

      {/* Tax Invoice Printing Modal */}
      <Dialog
        isOpen={!!invoiceToPrint}
        onClose={() => setInvoiceToPrint(null)}
        title="Tax Invoice Receipt"
        subtitle="Official Entitlement Receipt & Accounting Details"
        maxWidth="max-w-[650px]"
      >
        {invoiceToPrint && (
          <div className="space-y-4 pt-1.5 text-zinc-900 dark:text-zinc-150">
            {/* Inline Printable Stylesheet wrapper */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #invoice-print-area, #invoice-print-area * {
                  visibility: visible !important;
                }
                #invoice-print-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  background: white !important;
                  color: black !important;
                  border: none !important;
                  box-shadow: none !important;
                  padding: 10px !important;
                }
              }
            `}</style>

            <div
              id="invoice-print-area"
              className="border border-zinc-200 dark:border-zinc-800 p-6 rounded-md bg-white dark:bg-zinc-900 text-left text-xs space-y-6 shadow-2xs"
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div>
                  <h2 className="text-base font-black text-[#FF6A00] tracking-tight">ShopBajar Console</h2>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">SaaS Subscription Receipt</p>
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    TAX INVOICE
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Invoice #: {invoiceToPrint.transactionId.replace("TXN", "INV")}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    Date:{" "}
                    {new Date(invoiceToPrint.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Provider / Seller:
                  </span>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">ShopBajar Solutions Private Limited</p>
                  <p className="text-zinc-550 leading-normal font-medium">
                    102, Tech Hub, Hiranandani Estate,
                    <br />
                    Thane, Maharashtra - 400607
                  </p>
                  <p className="font-bold text-zinc-600 dark:text-zinc-300 mt-1">GSTIN: 27AAAAA1111A1Z1</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Client / Buyer:
                  </span>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">{shop.name}</p>
                  <p className="text-zinc-550 leading-normal font-medium">
                    Owner: {shop.ownerName || "Registered Shop Owner"}
                    <br />
                    Email: {shop.ownerEmail || shop.email || "N/A"}
                    <br />
                    Category: {shop.category || "N/A"}
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-405 uppercase tracking-wider">
                      <th className="p-2.5">Item Description</th>
                      <th className="p-2.5">SAC Code</th>
                      <th className="p-2.5">Billing Cycle</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium">
                    <tr>
                      <td className="p-2.5">
                        <span className="font-bold">
                          {invoiceToPrint.featureTitle || invoiceToPrint.featureKey} Add-on
                        </span>
                        <span className="block text-[9px] text-zinc-450 font-medium">
                          Full enterprise capabilities activation for storefront
                        </span>
                      </td>
                      <td className="p-2.5 text-zinc-500">997331</td>
                      <td className="p-2.5 capitalize">{invoiceToPrint.billingCycle}</td>
                      <td className="p-2.5 text-right font-bold">₹{invoiceToPrint.subtotal}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals & Notes */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                  <span className="font-bold text-zinc-500 block mb-1">Terms & Conditions:</span>
                  This is a computer-generated tax invoice and does not require a physical signature. Payments are
                  processed securely. Subscription active until expired or canceled.
                </div>
                <div className="space-y-1.5 text-right text-xs">
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-300 font-medium">
                    <span>Subtotal:</span>
                    <span>₹{invoiceToPrint.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-zinc-650 dark:text-zinc-300 font-medium">
                    <span>Integrated GST (18%):</span>
                    <span>₹{invoiceToPrint.gstAmount}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-800 pt-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                    <span>Total Paid (INR):</span>
                    <span className="text-[#FF6A00]">₹{invoiceToPrint.amountPaid}</span>
                  </div>
                </div>
              </div>

              {/* Payment Details Footer */}
              <div className="pt-4 border-t border-dashed border-zinc-200 dark:border-zinc-800 flex justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                <span>Method: {invoiceToPrint.paymentMethod}</span>
                <span>Txn ID: {invoiceToPrint.transactionId}</span>
                <span className="text-emerald-600 dark:text-emerald-500 font-black">Status: SUCCESS</span>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-150 dark:border-zinc-800 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setInvoiceToPrint(null)}
                className="font-bold text-xs h-8 px-3 rounded-md cursor-pointer"
              >
                Close
              </Button>
              <Button
                variant="dark"
                onClick={() => {
                  window.print();
                }}
                className="font-bold text-xs h-8 px-4 rounded-md flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={12} />
                Print / Save PDF
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default PaidFeaturesTab;
