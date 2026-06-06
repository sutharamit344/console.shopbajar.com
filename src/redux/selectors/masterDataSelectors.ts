import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";

const selectMasterDataState = (state: RootState) => state.masterData;

export const selectMasterCategories = createSelector(
  [selectMasterDataState],
  (masterData) => masterData.categories
);

export const selectMasterClusters = createSelector(
  [selectMasterDataState],
  (masterData) => masterData.clusters
);

export const selectMasterCountries = createSelector(
  [selectMasterDataState],
  (masterData) => masterData.countries
);

export const selectMasterStates = createSelector(
  [selectMasterDataState],
  (masterData) => masterData.states
);

export const selectMasterCities = createSelector(
  [selectMasterDataState],
  (masterData) => masterData.cities
);

export const selectMasterAreas = createSelector(
  [selectMasterDataState],
  (masterData) => masterData.areas
);

export const selectMasterDataLoading = createSelector(
  [selectMasterDataState],
  (masterData) => masterData.loading
);

export const selectMasterDataError = createSelector(
  [selectMasterDataState],
  (masterData) => masterData.error
);

export const selectMasterDataLastFetched = createSelector(
  [selectMasterDataState],
  (masterData) => masterData.lastFetched
);
