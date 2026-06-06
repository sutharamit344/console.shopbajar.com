import React, { useEffect } from "react";
import { Star, Trash2, Loader2, ThumbsUp } from "lucide-react";
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

interface CustomerReviewsProps {
  shopId: string;
  avgRating: string | number;
  onShowAlert: (config: { title: string; message: string; type: "success" | "error" | "info" }) => void;
  onShowConfirm: (config: { title: string; message: string; confirmText: string; type: "error" | "info"; onConfirm: () => void }) => void;
}

const CustomerReviews: React.FC<CustomerReviewsProps> = ({
  shopId,
  avgRating,
  onShowAlert,
  onShowConfirm,
}) => {
  const dispatch = useDispatch<AppDispatch>();

  const reviews = useSelector(selectMerchantReviews) || [];
  const loadingReviews = useSelector(selectDashboardLoadingReviews);

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

  return (
    <div className="bg-white rounded-md border border-zinc-200/80 shadow-sm p-5 dark:bg-zinc-900 dark:border-zinc-800 space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Customer Reviews
          </h3>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Manage what customers are saying about your business
          </p>
        </div>
        <div className="px-3 py-1 bg-[#FF6A00]/10 border border-[#FF6A00]/25 rounded-md text-xs font-bold text-[#FF6A00] shadow-sm flex items-center gap-1">
          <Star size={12} fill="currentColor" /> {avgRating || "5.0"}
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
                  className="h-8 w-8 bg-white border border-red-100 text-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 flex items-center justify-center shrink-0 dark:bg-zinc-800 dark:border-red-500/20 dark:hover:bg-red-550/20 shadow-sm active:scale-95 cursor-pointer"
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
    </div>
  );
};

export default CustomerReviews;
