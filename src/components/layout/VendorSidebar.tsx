import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  CloseSmallIcon,
  DashboardHomeIcon,
  OrdersCartIcon,
  PayoutsWalletIcon,
  ProductsCubeIcon,
  SettingsGearIcon,
  type IconProps,
} from '@/components/icons/VendorIcons';

interface VendorNavItem {
  label: string;
  to: string;
  end?: boolean;
  Icon: React.FC<IconProps>;
}

/**
 * Strictly ONLY these 5 menu items as specified for the ZemiGo Vendor Panel:
 * 1. Dashboard
 * 2. Products
 * 3. Orders
 * 4. Payouts
 * 5. Settings
 */
const VENDOR_NAV_ITEMS: VendorNavItem[] = [
  { label: 'Dashboard', to: '/', end: true, Icon: DashboardHomeIcon },
  { label: 'Products', to: '/products', Icon: ProductsCubeIcon },
  { label: 'Orders', to: '/orders', Icon: OrdersCartIcon },
  { label: 'Payouts', to: '/payouts', Icon: PayoutsWalletIcon },
  { label: 'Settings', to: '/settings', Icon: SettingsGearIcon },
];

interface VendorSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const VendorSidebar: React.FC<VendorSidebarProps> = ({
  mobileOpen,
  onCloseMobile,
}) => {
  const renderNavContent = () => (
    <div className="flex h-full flex-col bg-white">
      {/* ZemiGo Vendor Panel Brand Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-7">
        <div className="flex items-center gap-3">
          <img
            src="/zemigo-icon.png"
            alt="ZemiGo"
            className="h-11 w-11 shrink-0 object-contain"
          />
          <div className="leading-tight">
            <div className="text-[22px] font-extrabold tracking-tight text-[#111827]">
              Zemi<span className="text-[#16A34A]">Go</span>
            </div>
            <div className="text-[13px] font-medium text-[#374151]">
              Vendor Panel
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] lg:hidden"
        >
          <CloseSmallIcon className="h-5 w-5" />
        </button>
      </div>

      {/* 5-Item Navigation List */}
      <nav aria-label="Vendor Navigation" className="flex-1 space-y-1.5 px-3.5">
        {VENDOR_NAV_ITEMS.map(({ label, to, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              [
                'group flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] transition-colors',
                isActive
                  ? 'bg-[#E8F8EE] font-semibold text-[#16A34A]'
                  : 'font-medium text-[#1F2937] hover:bg-[#F5F7F9] hover:text-[#111827]',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={[
                    'h-[21px] w-[21px] shrink-0 transition-colors',
                    isActive
                      ? 'text-[#16A34A]'
                      : 'text-[#1F2937] group-hover:text-[#111827]',
                  ].join(' ')}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-[#ECEEF2] bg-white lg:block">
        {renderNavContent()}
      </aside>

      {/* Mobile & Tablet Slide-Over Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[264px] border-r border-[#ECEEF2] bg-white shadow-xl">
            {renderNavContent()}
          </aside>
        </div>
      )}
    </>
  );
};
