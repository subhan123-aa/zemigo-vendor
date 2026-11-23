import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { VendorLayout } from '@/components/layout/VendorLayout';
import { VendorAuthProvider } from '@/context/VendorAuthContext';
import { VendorDashboardPage } from '@/pages/VendorDashboardPage';
import { VendorLoginPage } from '@/pages/VendorLoginPage';
import { VendorOrdersPage } from '@/pages/VendorOrdersPage';
import { VendorPayoutsPage } from '@/pages/VendorPayoutsPage';
import { VendorProductsPage } from '@/pages/VendorProductsPage';
import { VendorSettingsPage } from '@/pages/VendorSettingsPage';

export const App: React.FC = () => {
  return (
    <VendorAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<VendorLoginPage />} />
          <Route element={<VendorLayout />}>
            <Route index element={<VendorDashboardPage />} />
            <Route path="products" element={<VendorProductsPage />} />
            <Route path="orders" element={<VendorOrdersPage />} />
            <Route path="payouts" element={<VendorPayoutsPage />} />
            <Route path="settings" element={<VendorSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </VendorAuthProvider>
  );
};

export default App;
