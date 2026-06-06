import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "@/components/UI/Button";
import { ArrowRight, Store, LayoutDashboard, Shield, Zap } from "lucide-react";

export default function Login() {
  const { user, loginWithGoogle, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  React.useEffect(() => {
    document.title = "Sign In — ShopBajar Console";
  }, []);

  React.useEffect(() => {
    if (user) {
      const shopId = searchParams.get("shopId");
      const fromPath = searchParams.get("from") || "/tables";
      navigate(`${fromPath}?shopId=${shopId || ""}`, { replace: true });
    }
  }, [user, navigate, searchParams]);

  const features = [
    { icon: LayoutDashboard, label: "Analytics & Overview" },
    { icon: Store, label: "Catalog & Menu Manager" },
    { icon: Shield, label: "Tables & QR Ordering" },
    { icon: Zap, label: "Kitchen & Waiter Console" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#FF6A00] rounded-xl shadow-lg mb-4">
            <img src="/brand-logo-v1.png" alt="ShopBajar" className="w-9 h-9 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">
            Shop<span className="text-[#FF6A00]">Bajar</span> Console
          </h1>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Merchant management platform
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-zinc-800 rounded-xl shadow-sm p-6">
          <p className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 text-center mb-5">
            Sign in to access your merchant console
          </p>

          <Button
            onClick={loginWithGoogle}
            variant="dark"
            size="lg"
            icon={ArrowRight}
            loading={loading}
            className="w-full h-10 text-sm"
          >
            Continue with Google
          </Button>

          {/* Feature hints */}
          <div className="mt-5 pt-5 border-t border-black/[0.05] dark:border-zinc-800 grid grid-cols-2 gap-2">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
                <f.icon size={11} className="text-[#FF6A00] shrink-0" />
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[10px] font-medium text-zinc-400 dark:text-zinc-600 mt-4">
          For authorized merchants only · ShopBajar © 2025
        </p>
      </div>
    </div>
  );
}
