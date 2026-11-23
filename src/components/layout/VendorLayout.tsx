import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { VendorSidebar } from '@/components/layout/VendorSidebar';
import { VendorTopHeader } from '@/components/layout/VendorTopHeader';
import { useVendorAuth } from '@/context/VendorAuthContext';

export const VendorLayout: React.FC = () => {
  const {
    user,
    vendorProfile,
    approvalStatus,
    loading,
    isConfigured,
  } = useVendorAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#DCFCE7] border-t-[#16A34A]" />
          <p className="text-[13.5px] font-medium text-[#6B7280]">
            Verifying ZemiGo Vendor session...
          </p>
        </div>
      </div>
    );
  }

  if (!isConfigured || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-[#111827]">
      <VendorSidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-h-screen flex-col lg:pl-[248px]">
        <VendorTopHeader onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1 px-4 py-6 sm:px-7 sm:py-7 lg:px-9 lg:py-8">
          <div className="mx-auto max-w-[1320px]">
            {user && approvalStatus === 'pending' ? (
              <div className="mb-6 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-5 py-4 text-[13.5px] text-[#92400E]">
                <span className="font-bold">Store Pending Admin Approval:</span>{' '}
                Your vendor account is registered and awaiting verification by a
                ZemiGo Admin. Once approved, you can publish products to the
                customer marketplace.
              </div>
            ) : null}

            {user && approvalStatus === 'rejected' ? (
              <div className="mb-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-[13.5px] text-[#B91C1C]">
                <span className="font-bold">Store Approval Rejected:</span>{' '}
                {vendorProfile?.rejectionReason ||
                  'Please update your store settings and contact ZemiGo Admin support.'}
              </div>
            ) : null}

            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
