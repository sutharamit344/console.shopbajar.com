import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { saveShop } from "../lib/db";
import ShopForm from "../components/Create/ShopForm";
import Card from "../components/UI/Card";
import Button from "../components/UI/Button";
import { CircleCheckBig, Rocket, ShieldCheck, Layout, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";

export default function CreateShop() {
  const navigate = useNavigate();
  const { user, loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (finalData: any) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await saveShop({
        ...finalData,
        ownerId: user.uid,
        ownerEmail: user.email,
        status: "pending",
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => navigate("/dashboard"), 3000);
      } else {
        throw new Error("Failed to save shop to database.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 selection:bg-[#FF6A00]/10 selection:text-[#FF6A00]">
        <main className="max-w-xl w-full text-center animate-in fade-in duration-700">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-md flex items-center justify-center mx-auto mb-8 border border-emerald-500/20 shadow-sm">
            <CircleCheckBig size={32} className="text-emerald-500" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">
            Onboarding Initiated
          </h1>
          <p className="text-xs text-zinc-550 dark:text-zinc-400 mb-10 max-w-sm mx-auto font-medium leading-relaxed">
            Your business profile is now in the verification queue. Our team will review your business profile within 24 hours.
          </p>
          <div className="inline-flex items-center gap-3 py-2.5 px-4 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
            <div className="w-3.5 h-3.5 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Deploying Dashboard...</span>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 selection:bg-[#FF6A00]/10 selection:text-[#FF6A00]">
        <main className="max-w-xl w-full text-center relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-16 h-16 bg-[#FF6A00]/10 rounded-md flex items-center justify-center mx-auto mb-8 border border-[#FF6A00]/20 shadow-sm">
            <Rocket size={32} className="text-[#FF6A00]" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">
            Authenticate to begin
          </h1>
          <p className="text-xs text-zinc-550 dark:text-zinc-400 mb-10 max-w-sm mx-auto font-medium leading-relaxed">
            Access the merchant deployment suite. Authenticate with your enterprise identity to provision your digital storefront.
          </p>
          <Button
            onClick={loginWithGoogle}
            variant="dark"
            size="xl"
            icon={ArrowRight}
            className="px-10 h-10 shadow-sm"
          >
            Sign In with Google
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 selection:bg-[#FF6A00]/10 selection:text-[#FF6A00] p-4 sm:p-6 lg:p-8">
      <main className="max-w-4xl mx-auto pt-6 pb-24 relative z-10 w-full">
        {/* Back navigation */}
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-6 flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-[#FF6A00] transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        <div className="text-center mb-8 animate-in fade-in duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FF6A00]/10 border border-[#FF6A00]/20 mb-3 shadow-sm">
            <ShieldCheck size={12} className="text-[#FF6A00]" />
            <span className="text-[10px] font-bold text-[#FF6A00] uppercase tracking-widest font-mono">Merchant Provisioning</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 tracking-tight leading-none">
            Deploy your business profile
          </h1>
          <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto font-medium">
            Configure your professional business presence on the distributed ShopBajar network.
          </p>
        </div>

        <Card className="p-0 border-none shadow-xl overflow-visible w-full bg-transparent dark:bg-transparent">
          <ShopForm
            onSubmit={handleCreate}
            isLoading={loading}
            error={error}
          />
        </Card>

        {/* Support Section */}
        <div className="mt-12 text-center">
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-600">
              <Layout size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest font-mono">SaaS Architecture</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-650">
              <Sparkles size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest font-mono">AI Assisted</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
