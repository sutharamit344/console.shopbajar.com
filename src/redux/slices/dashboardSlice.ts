import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import {
  fetchMerchantShop,
  updateMerchantShop,
  fetchMerchantReviews,
  deleteMerchantReview,
  fetchMasterFeatures,
  purchaseMerchantFeature,
  toggleMerchantFeature,
  fetchShopPayments,
} from "../thunks/dashboardThunks";

interface HourDetail {
  open: string;
  close: string;
  isClosed: boolean;
}

interface OpeningHours {
  monday: HourDetail;
  tuesday: HourDetail;
  wednesday: HourDetail;
  thursday: HourDetail;
  friday: HourDetail;
  saturday: HourDetail;
  sunday: HourDetail;
  [key: string]: HourDetail; // Index signature for dynamic access
}

interface DashboardState {
  shop: any | null;
  openingHours: OpeningHours;
  holidays: any[];
  reviews: any[];
  masterFeatures: any[];
  loading: boolean;
  isSaving: boolean;
  loadingReviews: boolean;
  loadingFeatures: boolean;
  activatingFeatureKey: string | null;
  payments: any[];
  loadingPayments: boolean;
  error: string | null;
}

const defaultHours: OpeningHours = {
  monday: { open: "09:00", close: "21:00", isClosed: false },
  tuesday: { open: "09:00", close: "21:00", isClosed: false },
  wednesday: { open: "09:00", close: "21:00", isClosed: false },
  thursday: { open: "09:00", close: "21:00", isClosed: false },
  friday: { open: "09:00", close: "21:00", isClosed: false },
  saturday: { open: "09:00", close: "21:00", isClosed: false },
  sunday: { open: "09:00", close: "21:00", isClosed: true },
};

const initialState: DashboardState = {
  shop: null,
  openingHours: defaultHours,
  holidays: [],
  reviews: [],
  masterFeatures: [],
  loading: true,
  isSaving: false,
  loadingReviews: false,
  loadingFeatures: false,
  activatingFeatureKey: null,
  payments: [],
  loadingPayments: false,
  error: null,
};

export const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    setOpeningHoursState: (state, action: PayloadAction<OpeningHours>) => {
      state.openingHours = action.payload;
    },
    setHolidaysState: (state, action: PayloadAction<any[]>) => {
      state.holidays = action.payload;
    },
    clearDashboard: () => {
      return initialState;
    },
    updateShopLocalState: (state, action: PayloadAction<any>) => {
      if (state.shop) {
        state.shop = { ...state.shop, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Merchant Shop
      .addCase(fetchMerchantShop.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMerchantShop.fulfilled, (state, action) => {
        state.loading = false;
        state.shop = action.payload;
        if (action.payload?.openingHoursDetails) {
          state.openingHours = action.payload.openingHoursDetails;
        }
        if (action.payload?.holidays) {
          state.holidays = action.payload.holidays;
        }
      })
      .addCase(fetchMerchantShop.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to fetch shop";
      })
      // Update Merchant Shop
      .addCase(updateMerchantShop.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(updateMerchantShop.fulfilled, (state, action) => {
        state.isSaving = false;
        if (state.shop) {
          state.shop = { ...state.shop, ...action.payload };
        }
      })
      .addCase(updateMerchantShop.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload || "Failed to update shop";
      })
      // Fetch Merchant Reviews
      .addCase(fetchMerchantReviews.pending, (state) => {
        state.loadingReviews = true;
      })
      .addCase(fetchMerchantReviews.fulfilled, (state, action) => {
        state.loadingReviews = false;
        state.reviews = action.payload;
      })
      .addCase(fetchMerchantReviews.rejected, (state, action) => {
        state.loadingReviews = false;
        state.error = action.payload || "Failed to fetch reviews";
      })
      // Delete Merchant Review
      .addCase(deleteMerchantReview.fulfilled, (state, action) => {
        const { reviewId, updatedShop } = action.payload;
        state.reviews = state.reviews.filter((r) => r.id !== reviewId);
        if (state.shop && updatedShop) {
          state.shop = updatedShop;
        }
      })
      // Fetch Master Features
      .addCase(fetchMasterFeatures.pending, (state) => {
        state.loadingFeatures = true;
      })
      .addCase(fetchMasterFeatures.fulfilled, (state, action) => {
        state.loadingFeatures = false;
        state.masterFeatures = action.payload;
      })
      .addCase(fetchMasterFeatures.rejected, (state, action) => {
        state.loadingFeatures = false;
        state.error = action.payload || "Failed to fetch features";
      })
      // Purchase Merchant Feature
      .addCase(purchaseMerchantFeature.pending, (state, action) => {
        state.activatingFeatureKey = action.meta.arg.featureKey;
      })
      .addCase(purchaseMerchantFeature.fulfilled, (state, action) => {
        state.activatingFeatureKey = null;
        if (state.shop) {
          state.shop.paidFeatures = action.payload.nextPaidFeatures;
        }
      })
      .addCase(purchaseMerchantFeature.rejected, (state, action) => {
        state.activatingFeatureKey = null;
        state.error = action.payload || "Failed to purchase feature";
      })
      // Toggle Merchant Feature
      .addCase(toggleMerchantFeature.fulfilled, (state, action) => {
        if (state.shop) {
          state.shop.paidFeatures = action.payload.nextPaidFeatures;
        }
      })
      // Fetch Shop Payments
      .addCase(fetchShopPayments.pending, (state) => {
        state.loadingPayments = true;
      })
      .addCase(fetchShopPayments.fulfilled, (state, action) => {
        state.loadingPayments = false;
        state.payments = action.payload;
      })
      .addCase(fetchShopPayments.rejected, (state, action) => {
        state.loadingPayments = false;
        state.error = action.payload || "Failed to fetch payments";
      });
  },
});

export const { setOpeningHoursState, setHolidaysState, clearDashboard, updateShopLocalState } =
  dashboardSlice.actions;
export default dashboardSlice.reducer;
