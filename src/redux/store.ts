import { configureStore } from "@reduxjs/toolkit";
import dashboardReducer from "./slices/dashboardSlice";
import modalReducer from "./slices/modalSlice";
import masterDataReducer from "./slices/masterDataSlice";

export const store = configureStore({
  reducer: {
    dashboard: dashboardReducer,
    modal: modalReducer,
    masterData: masterDataReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "dashboard/fetchShop/fulfilled",
          "dashboard/updateShop/fulfilled",
          "dashboard/fetchReviews/fulfilled",
          "modal/showModal",
          "masterData/fetchDirectory/fulfilled",
        ],
        ignoredPaths: [
          "dashboard.shop",
          "dashboard.reviews",
          "modal.onConfirm",
          "modal.onCancel",
          "masterData.categories",
          "masterData.clusters",
          "masterData.countries",
          "masterData.states",
          "masterData.cities",
          "masterData.areas",
        ],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
