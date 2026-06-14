import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";

const selectDashboardState = (state: RootState) => state.dashboard;

export const selectMerchantShop = createSelector(
  [selectDashboardState],
  (dashboard) => dashboard.shop
);

export const selectOpeningHours = createSelector(
  [selectDashboardState],
  (dashboard) => dashboard.openingHours
);

export const selectHolidays = createSelector(
  [selectDashboardState],
  (dashboard) => dashboard.holidays
);

export const selectMerchantReviews = createSelector(
  [selectDashboardState],
  (dashboard) => dashboard.reviews
);

export const selectDashboardLoading = createSelector(
  [selectDashboardState],
  (dashboard) => dashboard.loading
);

export const selectDashboardIsSaving = createSelector(
  [selectDashboardState],
  (dashboard) => dashboard.isSaving
);

export const selectDashboardLoadingReviews = createSelector(
  [selectDashboardState],
  (dashboard) => dashboard.loadingReviews
);

export const selectDashboardError = createSelector(
  [selectDashboardState],
  (dashboard) => dashboard.error
);

export const selectShopPayments = createSelector(
  [selectDashboardState],
  (dashboard) => dashboard.payments || []
);

export const selectLoadingPayments = createSelector(
  [selectDashboardState],
  (dashboard) => dashboard.loadingPayments
);

