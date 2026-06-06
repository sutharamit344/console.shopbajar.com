import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  getCategories,
  getClusters,
  getCountries,
  getStates,
  getCities,
  getAreas,
} from "@/lib/db";
import { RootState } from "../store";

export const fetchMasterDirectory = createAsyncThunk<
  // Return type of the payload creator
  {
    categories?: any[];
    clusters?: any[];
    countries?: any[];
    states?: any[];
    cities?: any[];
    areas?: any[];
    cached: boolean;
  },
  // First argument to the payload creator (void in this case)
  void,
  // Types for ThunkAPI
  {
    state: RootState;
    rejectValue: string;
  }
>(
  "masterData/fetchDirectory",
  async (_, { getState, rejectWithValue }) => {
    const { masterData } = getState();
    // Avoid redundant network fetches if data is already cached
    if (
      masterData?.categories?.length > 0 &&
      masterData?.clusters?.length > 0 &&
      masterData?.countries?.length > 0
    ) {
      return { cached: true };
    }

    try {
      const [categories, clusters, countries, states, cities, areas] =
        await Promise.all([
          getCategories(),
          getClusters(),
          getCountries(),
          getStates(),
          getCities(),
          getAreas(),
        ]);

      return {
        categories,
        clusters,
        countries,
        states,
        cities,
        areas,
        cached: false,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch master directory");
    }
  }
);
