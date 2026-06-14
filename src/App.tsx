import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "@/redux/store";
import { AuthProvider } from "@/hooks/useAuth";
import Login from "@/pages/Login";
import TablesClient from "@/pages/TablesClient";
import KitchenClient from "@/pages/KitchenClient";
import WaiterClient from "@/pages/WaiterClient";
import MerchantDashboard from "@/pages/MerchantDashboard";
import CreateShop from "@/pages/CreateShop";
import ManageShop from "@/pages/ManageShop";
import BookingsClient from "@/pages/BookingsClient";
import DashboardLayout from "@/components/Shop/DashboardLayout";
import ModalContainer from "@/components/ModalContainer";
import { PortalWrapper } from "@/components/Shop/PortalWrapper";
import PortalBillingView from "@/pages/PortalBillingView";

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Unified layout wrapper with collapsible sidebar */}
            <Route element={<DashboardLayout />}>
              <Route path="/manage" element={<ManageShop />} />
              <Route path="/tables" element={<TablesClient />} />
              <Route path="/kitchen" element={<KitchenClient />} />
              <Route path="/waiter" element={<WaiterClient />} />
              <Route path="/bookings" element={<BookingsClient />} />
            </Route>

            {/* Staff portal routes - Standalone/No sidebar layout with PIN protection */}
            <Route path="/portal/tables" element={<PortalWrapper><TablesClient /></PortalWrapper>} />
            <Route path="/portal/kitchen" element={<PortalWrapper><KitchenClient /></PortalWrapper>} />
            <Route path="/portal/waiter" element={<PortalWrapper><WaiterClient /></PortalWrapper>} />
            <Route path="/portal/bookings" element={<PortalWrapper><BookingsClient /></PortalWrapper>} />
            <Route path="/portal/billing" element={<PortalWrapper><PortalBillingView /></PortalWrapper>} />

            {/* Business selector page */}
            <Route path="/" element={<MerchantDashboard />} />
            <Route path="/dashboard" element={<MerchantDashboard />} />
            <Route path="/create" element={<CreateShop />} />

            {/* Fallback route */}
            <Route
              path="*"
              element={
                <Navigate
                  to={`/dashboard${window.location.search}`}
                  replace
                />
              }
            />
          </Routes>
          {/* Global Dialog Modal Overlay */}
          <ModalContainer />
        </BrowserRouter>
      </AuthProvider>
    </Provider>
  );
}

export default App;
