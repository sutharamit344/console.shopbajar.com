import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchMasterFeatures, purchaseMerchantFeature, toggleMerchantFeature } from "../../redux/thunks/dashboardThunks";
import { AppDispatch, RootState } from "../../redux/store";
import Card from "../UI/Card";
import Button from "../UI/Button";
import Dialog from "../UI/Dialog";
import {
  Zap, Sparkles, ShoppingBag, TrendingUp, Bot, Star, Shield, Award,
  CheckCircle2, Clock, Check, AlertCircle, ArrowRight, ShieldCheck,
  Phone, LayoutDashboard, FileText, Printer, QrCode, Calculator
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
  ]
};

const PaidFeaturesTab: React.FC<PaidFeaturesTabProps> = ({ shop }) => {
  const dispatch = useDispatch<AppDispatch>();
  const masterFeatures = useSelector((state: RootState) => state.dashboard.masterFeatures || []);
  const loadingFeatures = useSelector((state: RootState) => state.dashboard.loadingFeatures);
  const activatingFeatureKey = useSelector((state: RootState) => state.dashboard.activatingFeatureKey);

  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [checkoutFeature, setCheckoutFeature] = useState<any>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState("monthly");
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

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
              {/* Step indicator dot */}
              <div className="absolute -left-[26px] top-0.5 w-4 h-4 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-600 dark:text-zinc-400 shadow-2xs">
                {index + 1}
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{step.title}</div>
                <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  useEffect(() => {
    dispatch(fetchMasterFeatures());
  }, [dispatch]);

  const paidFeaturesState = shop?.paidFeatures || {};

  const handleOpenCheckout = (feature: any) => {
    setCheckoutFeature(feature);
    setSelectedBillingCycle(feature.billingCycle || "monthly");
    setCheckoutSuccess(false);
  };

  const handleConfirmPurchase = async () => {
    if (!checkoutFeature) return;

    let finalPrice = checkoutFeature.price || 0;
    if (selectedBillingCycle === "annual") {
      finalPrice = Math.round(finalPrice * 10 * 0.8); // 20% discount on annual
    } else if (selectedBillingCycle === "one-time") {
      finalPrice = finalPrice * 25; // Lifetime access calculation
    }

    const result = await dispatch(purchaseMerchantFeature({
      shopId: shop.id,
      featureKey: checkoutFeature.featureKey,
      billingCycle: selectedBillingCycle,
      price: finalPrice,
      trialDays: checkoutFeature.trialDays || 0,
      currentPaidFeatures: paidFeaturesState
    })).unwrap();

    if (result) {
      setCheckoutSuccess(true);
      setTimeout(() => {
        setCheckoutFeature(null);
        setCheckoutSuccess(false);
      }, 1500);
    }
  };

  const handleToggleFeature = async (featureKey: string, currentStatus: boolean) => {
    await dispatch(toggleMerchantFeature({
      shopId: shop.id,
      featureKey,
      enabled: !currentStatus,
      currentPaidFeatures: paidFeaturesState
    }));
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
    };
    return icons[iconName] || <Sparkles size={16} className="text-zinc-500" />;
  };

  if (loadingFeatures) {
    return (
      <div className="py-16 text-center">
        <div className="w-6 h-6 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Loading Marketplace Add-ons...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Premium Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-4 sm:p-5 rounded-md text-white relative overflow-hidden border border-zinc-800 shadow-lg">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF6A00]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 max-w-xl space-y-2">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 backdrop-blur-md rounded border border-white/10 text-[9px] font-bold uppercase tracking-widest text-[#FF6A00]">
            <Sparkles size={10} /> SaaS Marketplace
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Supercharge Your Storefront</h2>
          <p className="text-[11px] sm:text-xs text-zinc-400 font-medium leading-relaxed">
            Unlock enterprise-grade capabilities instantly. From multi-item WhatsApp checkout baskets to AI copilot automations, scale your operations with zero coding.
          </p>
        </div>
      </div>

      {/* Features Grid */}
      {masterFeatures.length === 0 ? (
        <Card padding={false} className="py-12 text-center border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md">
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
            const isEnabled = merchFeature?.enabled;
            const isTrial = merchFeature?.status === "trial";

            return (
              <Card
                key={feature.id}
                padding={false}
                className={`p-4 flex flex-col justify-between relative overflow-hidden transition-all duration-305 border rounded-md ${isPurchased
                  ? isEnabled
                    ? "bg-white dark:bg-zinc-900 border-emerald-500/30 shadow-md shadow-emerald-500/5"
                    : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-75"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-305 dark:hover:border-zinc-700 shadow-xs hover:shadow-sm"
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
                        {isTrial ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <Clock size={10} /> Trial Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <CheckCircle2 size={10} /> Active
                          </span>
                        )}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!isEnabled}
                            onChange={() => handleToggleFeature(feature.featureKey, isEnabled)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4.5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
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
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{feature.title}</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed line-clamp-3">
                    {feature.description}
                  </p>
                </div>

                {/* Pricing & Actions */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-end justify-between gap-3 mt-auto">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-0.5">Investment</span>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-base font-black text-[#FF6A00]">₹{feature.price}</span>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">/{feature.billingCycle}</span>
                    </div>
                  </div>

                  <div>
                    {isPurchased ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFeature(feature)}
                        className="text-xs font-bold text-zinc-650 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-8 px-2.5 rounded-md"
                      >
                        Manage
                      </Button>
                    ) : (
                      <Button
                        variant="dark"
                        size="sm"
                        onClick={() => handleOpenCheckout(feature)}
                        className="text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-1 h-8 px-2.5 rounded-md"
                      >
                        {feature.trialDays ? `Start ${feature.trialDays}-Day Trial` : "Upgrade Now"}
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
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <CheckCircle2 size={10} /> Subscribed
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Billing Cycle</span>
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 capitalize">{selectedFeature.billingCycle}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Current Plan Price</span>
                <span className="text-xs font-bold text-[#FF6A00]">₹{selectedFeature.price}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Activation Date</span>
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {paidFeaturesState[selectedFeature.featureKey]?.activatedAt ? (
                    new Date(paidFeaturesState[selectedFeature.featureKey].activatedAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric"
                    })
                  ) : (
                    "N/A"
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Capabilities Unlocked</h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
                {selectedFeature.description}
              </p>
            </div>

            <div className="p-3.5 rounded-md bg-zinc-50/50 dark:bg-zinc-800/20 border border-zinc-200/60 dark:border-zinc-800/60">
              {renderFeatureFlow(selectedFeature.featureKey)}
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-1.5">
              <Button variant="ghost" onClick={() => setSelectedFeature(null)} className="font-bold text-xs h-8 px-3 rounded-md">Close</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Simulated Checkout Modal */}
      <Dialog
        isOpen={!!checkoutFeature}
        onClose={() => setCheckoutFeature(null)}
        title={`Activate ${checkoutFeature?.title}`}
        subtitle="Instant Provisioning & Entitlement Setup"
        maxWidth="max-w-[450px]"
      >
        {checkoutFeature && (
          <div className="space-y-4 pt-1.5">
            {checkoutSuccess ? (
              <div className="py-8 text-center space-y-2.5 animate-in fade-in zoom-in duration-300">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                  <Check size={24} />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Entitlement Activated!</h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto font-medium">
                  {checkoutFeature.title} has been successfully provisioned for your storefront.
                </p>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-2xs">
                      {renderIcon(checkoutFeature.icon)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{checkoutFeature.title}</h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 leading-snug">{checkoutFeature.description}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-md bg-zinc-50/50 dark:bg-zinc-800/20 border border-zinc-200/60 dark:border-zinc-800/60">
                  {renderFeatureFlow(checkoutFeature.featureKey)}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Select Billing Cycle</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: "monthly", label: "Monthly", calc: checkoutFeature.price, sub: "Regular" },
                      { id: "annual", label: "Annual", calc: Math.round(checkoutFeature.price * 10 * 0.8), sub: "Save 20%" },
                      { id: "one-time", label: "Lifetime", calc: checkoutFeature.price * 25, sub: "One-time" }
                    ].map((cycle) => (
                      <button
                        key={cycle.id}
                        type="button"
                        onClick={() => setSelectedBillingCycle(cycle.id)}
                        className={`p-2.5 rounded-md border text-left flex flex-col justify-between transition-all relative overflow-hidden ${selectedBillingCycle === cycle.id
                          ? "border-[#FF6A00] bg-[#FF6A00]/5 shadow-sm dark:bg-[#FF6A00]/10"
                          : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-650"
                          }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{cycle.label}</div>
                          <div className="text-[9px] font-bold text-[#FF6A00] mt-0.5">{cycle.sub}</div>
                        </div>
                        <div className="text-xs font-black text-zinc-900 dark:text-zinc-100 mt-2">₹{cycle.calc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {checkoutFeature.trialDays > 0 && (
                  <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-amber-700 dark:text-amber-400">
                    <Clock size={16} className="shrink-0" />
                    <p className="text-[11px] font-medium leading-snug">
                      Includes a <span className="font-bold">{checkoutFeature.trialDays}-day free trial</span>. You won&apos;t be charged until the trial period ends.
                    </p>
                  </div>
                )}

                <div className="p-3 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 space-y-1.5 text-[11px]">
                  <div className="flex justify-between font-medium text-zinc-650 dark:text-zinc-300">
                    <span>Subtotal</span>
                    <span>₹{selectedBillingCycle === "annual" ? Math.round(checkoutFeature.price * 10 * 0.8) : selectedBillingCycle === "one-time" ? checkoutFeature.price * 25 : checkoutFeature.price}</span>
                  </div>
                  <div className="flex justify-between font-medium text-zinc-650 dark:text-zinc-300">
                    <span>Estimated Tax (18% GST)</span>
                    <span>₹{Math.round((selectedBillingCycle === "annual" ? Math.round(checkoutFeature.price * 10 * 0.8) : selectedBillingCycle === "one-time" ? checkoutFeature.price * 25 : checkoutFeature.price) * 0.18)}</span>
                  </div>
                  <div className="pt-1.5 border-t border-zinc-200 dark:border-zinc-700 flex justify-between font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                    <span>Total Amount</span>
                    <span className="text-[#FF6A00]">₹{Math.round((selectedBillingCycle === "annual" ? Math.round(checkoutFeature.price * 10 * 0.8) : selectedBillingCycle === "one-time" ? checkoutFeature.price * 25 : checkoutFeature.price) * 1.18)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1 text-zinc-400 text-[10px] font-medium">
                    <ShieldCheck size={12} className="text-emerald-500" /> Secure Sandbox Gateway
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" onClick={() => setCheckoutFeature(null)} className="font-bold text-xs h-8 px-3 rounded-md">Cancel</Button>
                    <Button
                      variant="dark"
                      onClick={handleConfirmPurchase}
                      loading={activatingFeatureKey === checkoutFeature.featureKey}
                      className="font-bold text-xs px-4 shadow-sm h-8 rounded-md"
                    >
                      {checkoutFeature.trialDays ? "Start Free Trial" : "Confirm Activation"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default PaidFeaturesTab;
