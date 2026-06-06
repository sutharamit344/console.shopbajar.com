import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { fetchMasterDirectory } from "../thunks/masterDataThunks";

interface MasterDataState {
  categories: any[];
  clusters: any[];
  countries: any[];
  states: any[];
  cities: any[];
  areas: any[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

const initialState: MasterDataState = {
  categories: [],
  clusters: [],
  countries: [],
  states: [],
  cities: [],
  areas: [],
  loading: false,
  error: null,
  lastFetched: null,
};

export const masterDataSlice = createSlice({
  name: "masterData",
  initialState,
  reducers: {
    setMasterDataCache: (
      state,
      action: PayloadAction<{
        categories?: any[];
        clusters?: any[];
        countries?: any[];
        states?: any[];
        cities?: any[];
        areas?: any[];
      }>
    ) => {
      const { categories, clusters, countries, states, cities, areas } = action.payload;
      if (categories) state.categories = categories;
      if (clusters) state.clusters = clusters;
      if (countries) state.countries = countries;
      if (states) state.states = states;
      if (cities) state.cities = cities;
      if (areas) state.areas = areas;
      state.lastFetched = Date.now();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMasterDirectory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMasterDirectory.fulfilled, (state, action) => {
        state.loading = false;
        if (!action.payload.cached) {
          state.categories = action.payload.categories || [];
          state.clusters = action.payload.clusters || [];
          state.countries = action.payload.countries || [];
          state.states = action.payload.states || [];
          state.cities = action.payload.cities || [];
          state.areas = action.payload.areas || [];
          state.lastFetched = Date.now();
        }
      })
      .addCase(fetchMasterDirectory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load master directory";
      });
  },
});

export const { setMasterDataCache } = masterDataSlice.actions;
export default masterDataSlice.reducer;
