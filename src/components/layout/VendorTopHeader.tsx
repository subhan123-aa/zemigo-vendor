import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDownSmallIcon,
  MenuHamburgerIcon,
} from '@/components/icons/VendorIcons';
import { useVendorAuth } from '@/context/VendorAuthContext';

interface VendorTopHeaderProps {
  onOpenMobileMenu: () => void;
}

export const VendorTopHeader: React.FC<VendorTopHeaderProps> = ({
  onOpenMobileMenu,
}) => {
  const { user, vendorProfile, storeDisplayName, signOutVendor } =
    useVendorAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const avatarInitial = (storeDisplayName.trim()[0] || 'V').toUpperCase();

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOutVendor();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#ECEEF2] bg-white px-4 sm:px-7 lg:justify-end lg:px-9">
      {/* Mobile Sidebar Trigger (hidden on desktop; no search bar or extra icons) */}
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Open navigation menu"
        className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] p-2 text-[#1F2937] hover:bg-[#F9FAFB] lg:hidden"
      >
        <MenuHamburgerIcon className="h-5 w-5" />
      </button>

      {/* Right Vendor Profile Avatar, Store Name & Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-[#F9FAFB]"
          aria-expanded={dropdownOpen}
          aria-haspopup="menu"
        >
          {vendorProfile?.logoUrl ? (
            <img
              src={vendorProfile.logoUrl}
              alt={storeDisplayName}
              className="h-9 w-9 rounded-full border border-[#E5E7EB] object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16A34A] text-[15px] font-bold text-white shadow-sm">
              {avatarInitial}
            </span>
          )}

          <span className="max-w-[170px] truncate text-[15px] font-semibold text-[#111827]">
            {storeDisplayName}
          </span>

          <ChevronDownSmallIcon className="h-4 w-4 text-[#4B5563]" />
        </button>

        {dropdownOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-60 rounded-2xl border border-[#ECEEF2] bg-white p-2 shadow-lg"
          >
            <div className="border-b border-[#F1F3F6] px-3 py-2.5">
              <div className="truncate text-[14px] font-semibold text-[#111827]">
                {storeDisplayName}
              </div>
              <div className="truncate text-[12.5px] text-[#6B7280]">
                {user?.email || 'Not signed in'}
              </div>
            </div>

            <div className="py-1">
              <Link
                to="/settings"
                onClick={() => setDropdownOpen(false)}
                className="block rounded-xl px-3 py-2 text-[13.5px] font-medium text-[#1F2937] hover:bg-[#F5F7F9]"
              >
                Store Settings
              </Link>
              <Link
                to="/payouts"
                onClick={() => setDropdownOpen(false)}
                className="block rounded-xl px-3 py-2 text-[13.5px] font-medium text-[#1F2937] hover:bg-[#F5F7F9]"
              >
                Payout History
              </Link>
            </div>

            <div className="border-t border-[#F1F3F6] pt-1">
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2]"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setDropdownOpen(false)}
                  className="block rounded-xl px-3 py-2 text-[13.5px] font-semibold text-[#16A34A] hover:bg-[#EAF7EF]"
                >
                  Sign In to Store
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
