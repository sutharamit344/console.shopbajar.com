import React, { useEffect, useState, useRef } from "react";
import { Star, Trash2, Loader2, ThumbsUp, QrCode, Download, Copy, Check } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch } from "../../redux/store";
import {
  selectMerchantReviews,
  selectDashboardLoadingReviews,
} from "../../redux/selectors/dashboardSelectors";
import {
  fetchMerchantReviews,
  deleteMerchantReview,
} from "../../redux/thunks/dashboardThunks";
import Dialog from "../UI/Dialog";
import Button from "../UI/Button";
import { slugify } from "../../lib/slugify";
import { getCustomerAppUrl } from "../../lib/config";

interface CustomerReviewsProps {
  shop: any;
  shopId: string;
  avgRating: string | number;
  onShowAlert: (config: { title: string; message: string; type: "success" | "error" | "info" }) => void;
  onShowConfirm: (config: { title: string; message: string; confirmText: string; type: "error" | "info"; onConfirm: () => void }) => void;
}

const CustomerReviews: React.FC<CustomerReviewsProps> = ({
  shop,
  shopId,
  avgRating,
  onShowAlert,
  onShowConfirm,
}) => {
  const dispatch = useDispatch<AppDispatch>();

  const reviews = useSelector(selectMerchantReviews) || [];
  const loadingReviews = useSelector(selectDashboardLoadingReviews);

  const [showQRModal, setShowQRModal] = useState(false);
  const [downloadingPoster, setDownloadingPoster] = useState(false);
  const [copied, setCopied] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shopId) {
      dispatch(fetchMerchantReviews(shopId));
    }
  }, [shopId, dispatch]);

  const handleDeleteReview = (reviewId: string) => {
    onShowConfirm({
      title: "Delete Review",
      message:
        "Are you sure you want to delete this customer review? This will also update your aggregate rating.",
      confirmText: "Yes, Delete",
      type: "error",
      onConfirm: () => {
        dispatch(deleteMerchantReview({ shopId, reviewId }))
          .unwrap()
          .then(() => {
            onShowAlert({
              title: "Deleted",
              message: "Review removed successfully",
              type: "success",
            });
          })
          .catch((err: any) => {
            onShowAlert({
              title: "Error",
              message: err || "Failed to delete review",
              type: "error",
            });
          });
      },
    });
  };

  const handleDownloadPoster = async () => {
    if (!posterRef.current) return;
    setDownloadingPoster(true);
    try {
      const { toPng } = await import("html-to-image");
      await new Promise((r) => setTimeout(r, 600)); // Wait for image render
      const dataUrl = await toPng(posterRef.current, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${slugify(shop?.name || "shop")}_reviews_poster.png`;
      link.href = dataUrl;
      link.click();
      onShowAlert({
        title: "Poster Downloaded",
        message: "Your review collection poster has been downloaded successfully.",
        type: "success",
      });
    } catch (err) {
      console.error("Poster Download failed:", err);
      onShowAlert({
        title: "Download Failed",
        message: "Failed to render designed poster. Opening direct QR Code instead.",
        type: "error",
      });
      const directUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(
        getCustomerAppUrl("/shop/" + slugify(shop?.slug || shop?.name || "") + "#reviews")
      )}&color=0A0A0F&bgcolor=FFFFFF`;
      window.open(directUrl, "_blank");
    } finally {
      setDownloadingPoster(false);
    }
  };

  const handleDownloadQR = () => {
    const directUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(
      getCustomerAppUrl("/shop/" + slugify(shop?.slug || shop?.name || "") + "#reviews")
    )}&color=0A0A0F&bgcolor=FFFFFF`;
    window.open(directUrl, "_blank");
  };

  const handleCopyLink = () => {
    const url = getCustomerAppUrl(`/shop/${slugify(shop?.slug || shop?.name || "")}#reviews`);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowAlert({
      title: "Link Copied",
      message: "Direct review link copied to your clipboard.",
      type: "success",
    });
  };

  return (
    <div className="bg-white rounded-md border border-zinc-200/80 shadow-sm p-5 dark:bg-zinc-900 dark:border-zinc-800 space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Customer Reviews
          </h3>
          <p className="text-xs text-zinc-550 dark:text-zinc-400 font-medium">
            Manage what customers are saying about your business
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQRModal(true)}
            className="h-8 px-2.5 bg-zinc-50 border border-zinc-200/80 text-zinc-700 dark:bg-zinc-850 dark:border-zinc-750 dark:text-zinc-300 text-xs font-bold rounded-md flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all shadow-sm cursor-pointer"
            title="Scan or download review QR Code poster"
          >
            <QrCode size={12} className="text-[#FF6A00]" /> Review QR
          </button>
          <div className="px-3 py-1 bg-[#FF6A00]/10 border border-[#FF6A00]/25 rounded-md text-xs font-bold text-[#FF6A00] shadow-sm flex items-center gap-1">
            <Star size={12} fill="currentColor" /> {avgRating || "5.0"}
          </div>
        </div>
      </div>

      {loadingReviews ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6A00]" />
          <p className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase">
            Fetching feedback...
          </p>
        </div>
      ) : reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.map((review: any) => (
            <div
              key={review.id}
              className="p-4 rounded-md bg-zinc-50 border border-zinc-200/80 group hover:border-[#FF6A00]/30 transition-all dark:bg-zinc-850/50 dark:border-zinc-800 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-zinc-200/80 shadow-sm shrink-0 dark:bg-zinc-950 dark:border-zinc-800">
                    <span className="text-sm font-bold text-zinc-400 select-none">
                      {review.userName?.charAt(0).toUpperCase() || "C"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {review.userName}
                      </span>
                      <div className="flex items-center gap-0.5 text-[#FFB800] shrink-0">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={12}
                            fill={s <= review.rating ? "currentColor" : "none"}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-400 mb-2 font-medium">
                      Posted on{" "}
                      {new Date(review.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-zinc-700 dark:text-zinc-350 leading-relaxed italic font-medium">
                      "{review.comment}"
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteReview(review.id)}
                  className="h-8 w-8 bg-white border border-red-100 text-red-500 rounded-md opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all hover:bg-red-50 flex items-center justify-center shrink-0 dark:bg-zinc-800 dark:border-red-500/20 dark:hover:bg-red-550/20 shadow-sm active:scale-95 cursor-pointer"
                  title="Delete Review"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-md flex items-center justify-center mx-auto mb-3 border border-zinc-200/80 dark:border-zinc-700">
            <ThumbsUp size={28} className="text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1 tracking-tight">
            No Reviews Yet
          </h3>
          <p className="text-xs text-zinc-550 dark:text-zinc-400 font-medium font-sans">
            Feedback and ratings from your customers will display here.
          </p>
        </div>
      )}

      {/* Review QR Code Modal */}
      <Dialog
        isOpen={showQRModal}
        onClose={() => !downloadingPoster && setShowQRModal(false)}
        title="Review QR Code"
        subtitle="Customers can scan this code to submit ratings and feedback for your business"
        maxWidth="max-w-[380px]"
      >
        <div className="space-y-5 py-2 flex flex-col items-center text-center">
          <div className="p-4 bg-white dark:bg-white rounded-xl border border-zinc-200 shadow-md relative">
            <div className="w-44 h-44 flex items-center justify-center bg-white">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  getCustomerAppUrl("/shop/" + slugify(shop?.slug || shop?.name || "") + "#reviews")
                )}&color=0A0A0F&bgcolor=FFFFFF`}
                alt="Review QR"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#FF6A00] text-white text-[9px] font-black uppercase tracking-widest rounded shadow-md border border-[#FF6A00]/20">
              Review Us
            </div>
          </div>

          <div className="w-full space-y-3">
            <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 text-left font-mono">
              <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-505 uppercase tracking-widest block mb-1 font-sans">
                Review Link
              </span>
              <span className="text-xs font-semibold text-zinc-650 dark:text-zinc-400 truncate block leading-none">
                {getCustomerAppUrl(`/shop/${slugify(shop?.slug || shop?.name || "")}#reviews`)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                loading={downloadingPoster}
                className="w-full text-xs font-bold gap-1.5 h-10 bg-[#FF6A00] hover:bg-[#e65f00] border-none text-white cursor-pointer"
                onClick={handleDownloadPoster}
              >
                <Download size={13} />
                <span>Download Review Poster</span>
              </Button>
              
              <div className="flex gap-2">
                <Button
                  variant="dark"
                  size="sm"
                  className="flex-1 text-xs font-bold gap-1.5 h-9"
                  onClick={handleDownloadQR}
                >
                  <QrCode size={13} />
                  <span>QR Code Only</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs font-bold gap-1.5 h-9 border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-800 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  onClick={handleCopyLink}
                >
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  <span>{copied ? "Copied" : "Copy Link"}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden Designed Poster for html-to-image rendering */}
        <div className="absolute top-0 -left-[9999px] pointer-events-none">
          <div
            ref={posterRef}
            className="w-[500px] h-[700px] bg-white text-zinc-900 flex flex-col justify-between p-10 font-sans relative border-8 border-zinc-100"
            style={{
              backgroundImage: "radial-gradient(circle at 50% 50%, #ffffff 0%, #fafafa 100%)",
            }}
          >
            {/* Subtle Orange Accent Bars */}
            <div className="absolute top-0 inset-x-0 h-3 bg-[#FF6A00]" />
            
            {/* Top Shop Info */}
            <div className="flex flex-col items-center text-center mt-6 space-y-4">
              <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-zinc-50 flex items-center justify-center">
                {shop?.logo ? (
                  <img
                    src={`https://images.weserv.nl/?url=${encodeURIComponent(shop.logo)}&output=png&w=150&h=150&fit=cover`}
                    alt=""
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-full bg-[#FF6A00] flex items-center justify-center text-white text-3xl font-black">
                    {shop?.name?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 uppercase">
                  {shop?.name}
                </h1>
                <div className="flex items-center justify-center gap-1 text-[#FFB800]">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={20} fill="currentColor" className="stroke-none" />
                  ))}
                </div>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="flex flex-col items-center justify-center flex-1 my-6 space-y-5">
              <div className="p-6 bg-white rounded-2xl shadow-xl border border-zinc-200/60 relative flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                    getCustomerAppUrl("/shop/" + slugify(shop?.slug || shop?.name || "") + "#reviews")
                  )}&color=0A0A0F&bgcolor=FFFFFF`}
                  alt="Review QR"
                  className="w-48 h-48 object-contain"
                  crossOrigin="anonymous"
                />
              </div>
              <div className="text-center space-y-1.5 max-w-sm">
                <h2 className="text-lg font-black text-zinc-800 tracking-tight">
                  Share Your Feedback!
                </h2>
                <p className="text-xs text-zinc-550 font-semibold leading-relaxed">
                  Scan the QR Code with your smartphone camera to submit your rating and comments. Your reviews help us serve you better!
                </p>
              </div>
            </div>

            {/* Bottom Footer Info */}
            <div className="flex flex-col items-center text-center border-t border-zinc-150 pt-6 mt-auto">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-2">
                Powered by
              </p>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-[#FF6A00] rounded flex items-center justify-center text-white text-[10px] font-black">
                  SB
                </div>
                <span className="text-xs font-black text-zinc-800 tracking-tight">
                  ShopBajar Console
                </span>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default CustomerReviews;
