import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { VendorKpiCard } from '@/components/dashboard/VendorKpiCard';
import { VendorRecentOrdersTable } from '@/components/dashboard/VendorRecentOrdersTable';
import {
  CalendarOutlineIcon,
  ChevronDownSmallIcon,
  OrdersCartIcon,
  PayoutsWalletIcon,
  ProductsCubeIcon,
  SalesBagIcon,
} from '@/components/icons/VendorIcons';
import { useVendorAuth } from '@/context/VendorAuthContext';
import { useVendorDashboard } from '@/hooks/useVendorDashboard';
import type { VendorDateFilterKey } from '@/types/vendor';
import {
  DATE_FILTER_OPTIONS,
  formatIndianNumber,
  formatINR,
} from '@/utils/formatters';

export const VendorDashboardPage: React.FC = () => {
  const {
    vendorId,
    storeDisplayName,
    loading: authLoading,
    isConfigured,
  } = useVendorAuth();

  const [dateFilter, setDateFilter] = useState<VendorDateFilterKey>('7d');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const { stats, loading: dataLoading, error } = useVendorDashboard(
    vendorId,
    dateFilter
  );

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const selectedFilter =
    DATE_FILTER_OPTIONS.find((opt) => opt.value === dateFilter) ??
    DATE_FILTER_OPTIONS[1];

  const isLoading = authLoading || dataLoading;

  return (
    <div>
      {/* Dashboard Greeting & Date Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-[#111827] sm:text-[30px]">
            Welcome back, {storeDisplayName}
          </h1>
          <p className="mt-1 text-[15px] text-[#374151]">
            Here&apos;s your store performance on ZemiGo.
          </p>
        </div>

        {/* Date Filter Dropdown (defaults to Last 7 Days) */}
        <div className="relative self-start sm:self-auto" ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((prev) => !prev)}
            aria-expanded={filterOpen}
            aria-haspopup="listbox"
            className="inline-flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-[14px] font-medium text-[#111827] shadow-sm transition-colors hover:bg-[#F9FAFB]"
          >
            <CalendarOutlineIcon className="h-[18px] w-[18px] text-[#374151]" />
            <span>{selectedFilter.label}</span>
            <ChevronDownSmallIcon className="ml-1 h-4 w-4 text-[#4B5563]" />
          </button>

          {filterOpen && (
            <div
              role="listbox"
              className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-[#ECEEF2] bg-white p-1.5 shadow-lg"
            >
              {DATE_FILTER_OPTIONS.map((opt) => {
                const active = opt.value === dateFilter;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setDateFilter(opt.value);
                      setFilterOpen(false);
                    }}
                    className={[
                      'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13.5px] transition-colors',
                      active
                        ? 'bg-[#E8F8EE] font-semibold text-[#16A34A]'
                        : 'font-medium text-[#1F2937] hover:bg-[#F5F7F9]',
                    ].join(' ')}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Unconfigured or Unauthenticated Store Notice */}
      {!isConfigured ? (
        <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-[#BBF7D0] bg-[#EAF7EF] px-5 py-3.5 text-[13.5px] text-[#14532D] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Connect your shared ZemiGo Firebase project in{' '}
            <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[12.5px]">
              .env
            </code>{' '}
            to stream live vendor sales, products, orders, and payouts.
          </span>
        </div>
      ) : !authLoading && !vendorId ? (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#ECEEF2] bg-white px-5 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[14.5px] font-semibold text-[#111827]">
              Sign in to your ZemiGo Vendor account
            </p>
            <p className="text-[13px] text-[#6B7280]">
              Store metrics and orders are strictly isolated per authenticated
              vendor account.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#16A34A] px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#15803D]"
          >
            Vendor Sign In
          </Link>
        </div>
      ) : null}

      {/* 4 KPI Cards */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <VendorKpiCard
          title="Total Sales"
          value={formatINR(stats.totalSales)}
          growthPercent={stats.salesGrowthPercent}
          Icon={SalesBagIcon}
          loading={isLoading}
        />

        <VendorKpiCard
          title="Total Orders"
          value={formatIndianNumber(stats.totalOrders)}
          growthPercent={stats.ordersGrowthPercent}
          Icon={OrdersCartIcon}
          loading={isLoading}
        />

        <VendorKpiCard
          title="Total Products"
          value={formatIndianNumber(stats.totalProducts)}
          growthPercent={stats.productsGrowthPercent}
          Icon={ProductsCubeIcon}
          loading={isLoading}
        />

        <VendorKpiCard
          title="Total Payouts"
          value={formatINR(stats.totalPayouts)}
          growthPercent={stats.payoutsGrowthPercent}
          Icon={PayoutsWalletIcon}
          loading={isLoading}
        />
      </div>

      {/* Main Section — Recent Orders Only (No Charts or Extra Widgets) */}
      <div className="mt-7">
        <VendorRecentOrdersTable
          orders={stats.recentOrders}
          loading={isLoading}
          error={error}
          isSignedIn={Boolean(vendorId)}
          dateLabel={selectedFilter.label}
        />
      </div>
    </div>
  );
};
