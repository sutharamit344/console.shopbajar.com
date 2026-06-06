import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch } from "../redux/store";
import { useModal } from "../hooks/useModal";
import { useShopOwner } from "../hooks/useShopOwner";

// Redux Selectors and Thunks
import {
  selectMerchantShop,
  selectDashboardLoading,
  selectDashboardIsSaving,
  selectDashboardError,
} from "../redux/selectors/dashboardSelectors";
import { updateMerchantShop, fetchMerchantShop } from "../redux/thunks/dashboardThunks";

// Shop management panels
import Overview from "../components/Shop/Overview";
import CatalogManager from "../components/Shop/CatalogManager";
import PhotoGallery from "../components/Shop/PhotoGallery";
import BusinessHours from "../components/Shop/BusinessHours";
import CustomerReviews from "../components/Shop/CustomerReviews";
import MerchantSettingsForm from "../components/Shop/MerchantSettingsForm";
import PaidFeaturesTab from "../components/Shop/PaidFeaturesTab";
import BillingPosTab from "../components/Shop/BillingPosTab";
import InquiriesTab from "../components/Shop/InquiriesTab";
import HistoryDialog from "../components/Shop/HistoryDialog";

import { Loader2 } from "lucide-react";

const VIEW_LABELS: Record<string, string> = {
  overview: "Overview & Analytics",
  catalog: "Catalog Manager",
  gallery: "Photo Gallery",
  hours: "Business Hours",
  reviews: "Customer Reviews",
  settings: "Shop Settings",
  billing: "Billing & POS",
  inquiries: "Customer Inquiries",
  features: "Paid Features",
};

export default function ManageShop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const { showAlert, showConfirm } = useModal();

  // Active view synced with URL query param '?view=...'
  const activeView = searchParams.get("view") || "overview";
  const shopId = searchParams.get("id") || searchParams.get("shopId") || "";

  // Dialog and ephemeral states
  const [showHistory, setShowHistory] = useState(false);

  // Redux Domain States
  const shop = useSelector(selectMerchantShop);
  const loading = useSelector(selectDashboardLoading);
  const isSaving = useSelector(selectDashboardIsSaving);
  const error = useSelector(selectDashboardError);

  // Sync / Fetch Shop details on mount or ID change
  useEffect(() => {
    if (shopId) {
      dispatch(fetchMerchantShop({ shopId }));
    }
  }, [shopId, dispatch]);

  // Update page title per view
  useEffect(() => {
    const label = VIEW_LABELS[activeView];
    if (shop?.name && label) {
      document.title = `${label} — ${shop.name} · ShopBajar`;
    }
  }, [activeView, shop]);

  const handleSelectView = (view: string) => {
    setSearchParams((prev) => {
      prev.set("view", view);
      return prev;
    });
  };

  const handleUpdateShop = async (updateData: any) => {
    if (!shopId) return;
    try {
      await dispatch(updateMerchantShop({ shopId, updateData })).unwrap();
      showAlert({
        title: "Success",
        message: "Shop settings updated successfully!",
        type: "success",
      });
    } catch (err: any) {
      showAlert({
        title: "Save Failed",
        message: err || "Failed to update business details.",
        type: "error",
      });
    }
  };

  const handleSettingsSubmit = async (formData: any) => {
    await handleUpdateShop({
      ...formData,
      status: shop?.status || "pending",
    });
  };

  // Render sub-tabs according to the current selected side tab
  const renderActiveViewContent = () => {
    if (!shop) return null;

    switch (activeView) {
      case "overview":
        return (
          <Overview
            shop={shop}
            onSelectView={handleSelectView}
            onShowAlert={showAlert}
            onShowHistory={() => setShowHistory(true)}
          />
        );
      case "catalog":
        return (
          <CatalogManager
            shop={shop}
            onUpdateMenu={async (delta) => {
              await dispatch(updateMerchantShop({ shopId: shop.id, updateData: { menu: delta } })).unwrap();
            }}
            onShowAlert={showAlert}
            onShowConfirm={showConfirm}
          />
        );
      case "gallery":
        return (
          <PhotoGallery
            shopId={shop.id}
            gallery={shop.gallery || []}
            onUpdateShop={async (delta) => {
              await dispatch(updateMerchantShop({ shopId: shop.id, updateData: delta })).unwrap();
            }}
            onShowAlert={showAlert}
            onShowConfirm={showConfirm}
          />
        );
      case "hours":
        return (
          <BusinessHours
            shopId={shop.id}
            onShowAlert={showAlert}
            onShowConfirm={showConfirm}
          />
        );
      case "reviews":
        return (
          <CustomerReviews
            shopId={shop.id}
            avgRating={shop.avgRating || "5.0"}
            onShowAlert={showAlert}
            onShowConfirm={showConfirm}
          />
        );
      case "settings":
        return (
          <MerchantSettingsForm
            initialData={shop}
            onSubmit={handleSettingsSubmit}
            isLoading={isSaving}
            error={error}
          />
        );
      case "billing":
        return <BillingPosTab shop={shop} />;
      case "inquiries":
        return <InquiriesTab shop={shop} />;
      case "features":
        return <PaidFeaturesTab shop={shop} />;
      default:
        return (
          <div className="py-12 text-center text-zinc-500 font-medium">
            Tab view "{activeView}" not implemented.
          </div>
        );
    }
  };

  if (loading && !shop) {
    return (
      <div className="flex-1 min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6A00] mx-auto" />
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            Loading settings console...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 py-6 max-w-6xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="border-b border-zinc-150 dark:border-zinc-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#FF6A00]/5 dark:bg-[#FF6A00]/10 text-[#FF6A00] rounded border border-[#FF6A00]/15 mb-1 text-[9px] font-bold uppercase tracking-widest font-mono">
            Backoffice Management
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {VIEW_LABELS[activeView] || activeView}
          </h1>
          {shop?.name && (
            <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">
              {shop.name}
            </p>
          )}
        </div>
      </div>

      {/* Dynamic Sub-tab Panel */}
      <div className="w-full">
        {renderActiveViewContent()}
      </div>

      {/* Audit History Log Overlay */}
      {shop && (
        <HistoryDialog
          shop={shop}
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
