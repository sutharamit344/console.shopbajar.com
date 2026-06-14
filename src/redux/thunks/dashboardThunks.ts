import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  getShopById,
  updateShop,
  getShopRatings,
  deleteShopRating,
  getMasterFeatures,
  createPaymentRecord,
  getShopPayments,
} from "@/lib/db";

export const fetchMerchantShop = createAsyncThunk<any, { shopId: string; userId?: string }, { rejectValue: string }>(
  "dashboard/fetchShop",
  async ({ shopId, userId }, { rejectWithValue }) => {
    try {
      const data = await getShopById(shopId);
      if (!data) {
        return rejectWithValue("Shop not found");
      }
      if (userId && data.ownerId !== userId) {
        return rejectWithValue("Unauthorized access to shop");
      }
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch shop");
    }
  }
);

export const updateMerchantShop = createAsyncThunk<any, { shopId: string; updateData: any }, { rejectValue: string }>(
  "dashboard/updateShop",
  async ({ shopId, updateData }, { rejectWithValue }) => {
    try {
      const result = await updateShop(shopId, updateData);
      if (!result.success) {
        return rejectWithValue("Failed to update shop");
      }
      return updateData; // Return the delta to merge into state
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update shop");
    }
  }
);

export const fetchMerchantReviews = createAsyncThunk<any[], string, { rejectValue: string }>(
  "dashboard/fetchReviews",
  async (shopId, { rejectWithValue }) => {
    try {
      const data = await getShopRatings(shopId);
      return data || [];
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch reviews");
    }
  }
);

export const deleteMerchantReview = createAsyncThunk<{ reviewId: string; updatedShop: any }, { shopId: string; reviewId: string }, { rejectValue: string }>(
  "dashboard/deleteReview",
  async ({ shopId, reviewId }, { rejectWithValue }) => {
    try {
      const res = await deleteShopRating(shopId, reviewId);
      if (!res.success) {
        return rejectWithValue("Failed to delete review");
      }
      // Fetch the updated shop to get the recalculated average rating
      const updatedShop = await getShopById(shopId);
      return { reviewId, updatedShop };
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to delete review");
    }
  }
);

export const fetchMasterFeatures = createAsyncThunk<any[], void, { rejectValue: string }>(
  "dashboard/fetchMasterFeatures",
  async (_, { rejectWithValue }) => {
    try {
      const data = await getMasterFeatures(false); // get active features
      return data || [];
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch master features");
    }
  }
);

export const purchaseMerchantFeature = createAsyncThunk<
  any,
  {
    shopId: string;
    featureKey: string;
    featureTitle?: string;
    billingCycle: string;
    price: number;
    trialDays?: number;
    currentPaidFeatures?: any;
    paymentMethod?: string;
    transactionId?: string;
    amountPaid?: number;
    gstAmount?: number;
  },
  { rejectValue: string }
>(
  "dashboard/purchaseFeature",
  async (
    {
      shopId,
      featureKey,
      featureTitle,
      billingCycle,
      price,
      trialDays,
      currentPaidFeatures = {},
      paymentMethod,
      transactionId,
      amountPaid,
      gstAmount,
    },
    { rejectWithValue }
  ) => {
    try {
      const now = new Date();
      const expiresAt = new Date();

      if (trialDays && trialDays > 0) {
        expiresAt.setDate(now.getDate() + trialDays);
      } else if (billingCycle === "monthly") {
        expiresAt.setMonth(now.getMonth() + 1);
      } else if (billingCycle === "annual") {
        expiresAt.setFullYear(now.getFullYear() + 1);
      } else {
        expiresAt.setFullYear(now.getFullYear() + 10); // one-time / lifetime
      }

      const featureRecord = {
        enabled: true,
        status: trialDays && trialDays > 0 ? "trial" : "active",
        billingCycle: billingCycle || "monthly",
        price: price || 0,
        activatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      const nextPaidFeatures = {
        ...currentPaidFeatures,
        [featureKey]: featureRecord,
      };

      // 1. Update the shop record in Firestore
      const result = await updateShop(shopId, { paidFeatures: nextPaidFeatures });
      if (!result.success) {
        return rejectWithValue("Failed to activate feature");
      }

      // 2. Log payment transaction if it's not a free trial and has a price
      if (price > 0 && !(trialDays && trialDays > 0)) {
        await createPaymentRecord({
          shopId,
          featureKey,
          featureTitle: featureTitle || featureKey,
          billingCycle,
          subtotal: price,
          gstAmount: gstAmount || Math.round(price * 0.18),
          amountPaid: amountPaid || Math.round(price * 1.18),
          paymentMethod: paymentMethod || "Sandbox",
          transactionId: transactionId || `TXN-SB-${Math.floor(100000 + Math.random() * 900000)}`,
          status: "completed",
        });
      }

      return { featureKey, featureRecord, nextPaidFeatures };
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to activate feature");
    }
  }
);

export const fetchShopPayments = createAsyncThunk<any[], string, { rejectValue: string }>(
  "dashboard/fetchShopPayments",
  async (shopId, { rejectWithValue }) => {
    try {
      const data = await getShopPayments(shopId);
      return data || [];
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch shop payments");
    }
  }
);


export const toggleMerchantFeature = createAsyncThunk<any, { shopId: string; featureKey: string; enabled: boolean; currentPaidFeatures?: any }, { rejectValue: string }>(
  "dashboard/toggleFeature",
  async ({ shopId, featureKey, enabled, currentPaidFeatures = {} }, { rejectWithValue }) => {
    try {
      if (!currentPaidFeatures[featureKey]) {
        return rejectWithValue("Feature not purchased yet");
      }

      const featureRecord = {
        ...currentPaidFeatures[featureKey],
        enabled: !!enabled,
      };

      const nextPaidFeatures = {
        ...currentPaidFeatures,
        [featureKey]: featureRecord,
      };

      const result = await updateShop(shopId, { paidFeatures: nextPaidFeatures });
      if (!result.success) {
        return rejectWithValue("Failed to toggle feature");
      }

      return { featureKey, featureRecord, nextPaidFeatures };
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to toggle feature");
    }
  }
);
