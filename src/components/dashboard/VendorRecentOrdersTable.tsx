import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightSmallIcon,
  CustomerOutlineIcon,
} from '@/components/icons/VendorIcons';
import type { VendorOrderRecord } from '@/types/vendor';
import {
  formatINR,
  formatOrderDateTime,
  formatOrderIdLabel,
  getOrderStatusBadge,
} from '@/utils/formatters';

interface VendorRecentOrdersTableProps {
  orders: VendorOrderRecord[];
  loading: boolean;
  error: string | null;
  isSignedIn: boolean;
  dateLabel: string;
}

export const VendorRecentOrdersTable: React.FC<VendorRecentOrdersTableProps> = ({
  orders,
  loading,
  error,
  isSignedIn,
  dateLabel,
}) => {
  return (
    <section
      aria-labelledby="recent-orders-heading"
      className="rounded-[20px] border border-[#ECEEF2] bg-white p-5 shadow-card sm:p-7"
    >
      {/* Card Header */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2
          id="recent-orders-heading"
          className="text-[20px] font-bold tracking-tight text-[#111827]"
        >
          Recent Orders
        </h2>

        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-[#16A34A] transition-colors hover:text-[#15803D]"
        >
          <span>View All</span>
          <ArrowRightSmallIcon className="h-4 w-4" />
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] text-[#B91C1C]">
          {error}
        </div>
      )}

      {/* Responsive Spacious Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="bg-[#F3F4F6]/90 text-[13.5px] font-medium text-[#374151]">
              <th className="rounded-l-xl py-3 pl-5 pr-4 font-medium">
                Order ID
              </th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="rounded-r-xl py-3 pl-4 pr-5 font-medium">
                Date &amp; Time
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#F1F3F6]">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={index}>
                  <td className="py-4 pl-5 pr-4">
                    <div className="h-4 w-24 animate-pulse rounded bg-[#F1F3F6]" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-32 animate-pulse rounded bg-[#F1F3F6]" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-20 animate-pulse rounded bg-[#F1F3F6]" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-6 w-24 animate-pulse rounded-full bg-[#F1F3F6]" />
                  </td>
                  <td className="py-4 pl-4 pr-5">
                    <div className="h-4 w-32 animate-pulse rounded bg-[#F1F3F6]" />
                  </td>
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <p className="text-[15px] font-semibold text-[#1F2937]">
                    {isSignedIn
                      ? `No store orders found for ${dateLabel}`
                      : 'Sign in to view your store orders'}
                  </p>
                  <p className="mt-1 text-[13.5px] text-[#6B7280]">
                    {isSignedIn
                      ? 'New customer orders placed for your products on ZemiGo will appear here in real time.'
                      : 'Only orders containing products from your ZemiGo vendor account are displayed here.'}
                  </p>
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const badge = getOrderStatusBadge(order.status);
                return (
                  <tr
                    key={order.id}
                    className="transition-colors hover:bg-[#FAFAFB]"
                  >
                    <td className="whitespace-nowrap py-4 pl-5 pr-4 text-[14.5px] font-bold text-[#111827]">
                      {formatOrderIdLabel(order.orderNumber)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-2.5 text-[14.5px] font-medium text-[#1F2937]">
                        <CustomerOutlineIcon className="h-[18px] w-[18px] shrink-0 text-[#4B5563]" />
                        <span>{order.customerName}</span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-[14.5px] font-bold text-[#111827]">
                      {formatINR(order.vendorAmount)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={[
                          'inline-flex min-w-[104px] items-center justify-center rounded-full px-3.5 py-1 text-[13px] font-semibold',
                          badge.className,
                        ].join(' ')}
                      >
                        {badge.label}
                      </span>
                    </td>

                    <td className="whitespace-nowrap py-4 pl-4 pr-5 text-[14px] text-[#374151]">
                      {formatOrderDateTime(order.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
