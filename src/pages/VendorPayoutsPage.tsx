import React, { useEffect, useMemo, useState } from 'react';
import { PayoutsWalletIcon } from '@/components/icons/VendorIcons';
import { useVendorAuth } from '@/context/VendorAuthContext';
import {
  subscribeMarketplaceDefaultCommission,
  subscribeVendorOrders,
  subscribeVendorPayouts,
} from '@/services/vendorFirestore';
import type { VendorOrderRecord, VendorPayoutRecord } from '@/types/vendor';
import { formatINR, formatOrderDateTime } from '@/utils/formatters';

export const VendorPayoutsPage: React.FC = () => {
  const { vendorId, vendorProfile, storeDisplayName, isConfigured } =
    useVendorAuth();
  const [payouts, setPayouts] = useState<VendorPayoutRecord[]>([]);
  const [orders, setOrders] = useState<VendorOrderRecord[]>([]);
  const [marketplaceCommissionRate, setMarketplaceCommissionRate] =
    useState<number>(10);
  const [loading, setLoading] = useState<boolean>(Boolean(isConfigured && vendorId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    return subscribeMarketplaceDefaultCommission(
      (rate) => setMarketplaceCommissionRate(rate),
      () => undefined
    );
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured || !vendorId) {
      setPayouts([]);
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    let payoutsReady = false;
    let ordersReady = false;

    const markReady = () => {
      if (payoutsReady && ordersReady) {
        setLoading(false);
      }
    };

    const unsubPayouts = subscribeVendorPayouts(
      vendorId,
      (items) => {
        setPayouts(items);
        payoutsReady = true;
        markReady();
      },
      (err) => {
        setError(err.message);
        payoutsReady = true;
        markReady();
      }
    );

    const unsubOrders = subscribeVendorOrders(
      vendorId,
      (items) => {
        setOrders(items);
        ordersReady = true;
        markReady();
      },
      () => {
        ordersReady = true;
        markReady();
      }
    );

    return () => {
      unsubPayouts();
      unsubOrders();
    };
  }, [vendorId, isConfigured]);

  const effectiveCommissionRate =
    vendorProfile?.commissionRate ?? marketplaceCommissionRate;

  const { settledTotal, pendingTotal } = useMemo(() => {
    const settled = payouts.reduce(
      (sum, p) => (p.status === 'paid' ? sum + p.netPayout : sum),
      0
    );
    const deliveredNetEarnings = orders.reduce((sum, order) => {
      if (order.status !== 'delivered') return sum;
      const commission = Math.round(
        (order.vendorAmount * effectiveCommissionRate) / 100
      );
      return sum + Math.max(0, order.vendorAmount - commission);
    }, 0);
    return {
      settledTotal: Math.round(settled * 100) / 100,
      pendingTotal: Math.max(0, Math.round((deliveredNetEarnings - settled) * 100) / 100),
    };
  }, [payouts, orders, effectiveCommissionRate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#111827]">
          Payouts
        </h1>
        <p className="mt-1 text-[14.5px] text-[#4B5563]">
          Settlement history and bank transfers for {storeDisplayName}.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-[18px] border border-[#ECEEF2] bg-white p-6 shadow-card">
          <p className="text-[13.5px] font-semibold text-[#4B5563]">
            Settled Payouts
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-28 animate-pulse rounded bg-[#F1F3F6]" />
          ) : (
            <p className="mt-2 text-[26px] font-extrabold text-[#111827]">
              {formatINR(settledTotal)}
            </p>
          )}
        </div>

        <div className="rounded-[18px] border border-[#ECEEF2] bg-white p-6 shadow-card">
          <p className="text-[13.5px] font-semibold text-[#4B5563]">
            Pending Settlement
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-28 animate-pulse rounded bg-[#F1F3F6]" />
          ) : (
            <p className="mt-2 text-[26px] font-extrabold text-[#111827]">
              {formatINR(pendingTotal)}
            </p>
          )}
          <p className="mt-1 text-[12px] text-[#6B7280]">
            Delivered net earnings ({effectiveCommissionRate}% commission) minus settled payouts
          </p>
        </div>

        <div className="rounded-[18px] border border-[#ECEEF2] bg-white p-6 shadow-card">
          <p className="text-[13.5px] font-semibold text-[#4B5563]">
            Settlement Account
          </p>
          <p className="mt-2 truncate text-[16px] font-bold text-[#111827]">
            {vendorProfile?.upiId
              ? vendorProfile.upiId
              : vendorProfile?.bankAccountLast4
                ? `Bank •••• ${vendorProfile.bankAccountLast4}`
                : 'Configure in Settings'}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] text-[#B91C1C]">
          {error}
        </div>
      )}

      <div className="rounded-[20px] border border-[#ECEEF2] bg-white p-5 shadow-card sm:p-7">
        <h2 className="mb-5 text-[18px] font-bold text-[#111827]">
          Payout Transactions
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F3F4F6]/90 text-[13.5px] font-medium text-[#374151]">
                <th className="rounded-l-xl py-3 pl-5 pr-4 font-medium">
                  Reference
                </th>
                <th className="px-4 py-3 font-medium">Gross Order Value</th>
                <th className="px-4 py-3 font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Net Payout</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="rounded-r-xl py-3 pl-4 pr-5 font-medium">
                  Date &amp; Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F6]">
              {loading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <tr key={idx}>
                    <td colSpan={6} className="py-5 px-5">
                      <div className="h-5 w-full animate-pulse rounded bg-[#F1F3F6]" />
                    </td>
                  </tr>
                ))
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F8EE] text-[#16A34A]">
                      <PayoutsWalletIcon className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-[15px] font-semibold text-[#1F2937]">
                      {vendorId
                        ? 'No payouts recorded yet'
                        : 'Sign in to view your store payouts'}
                    </p>
                    <p className="mt-1 text-[13.5px] text-[#6B7280]">
                      Completed ZemiGo settlements to your store appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                payouts.map((payout) => {
                  const statusStyle =
                    payout.status === 'paid'
                      ? 'bg-[#DCFCE7] text-[#15803D]'
                      : payout.status === 'processing'
                        ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                        : 'bg-[#FEF3C7] text-[#D97706]';

                  const statusLabel =
                    payout.status === 'paid'
                      ? 'Paid'
                      : payout.status === 'processing'
                        ? 'Processing'
                        : 'Pending';

                  return (
                    <tr key={payout.id} className="hover:bg-[#FAFAFB]">
                      <td className="whitespace-nowrap py-4 pl-5 pr-4 text-[14px] font-bold text-[#111827]">
                        {payout.referenceId || `#PY${payout.id.slice(0, 6).toUpperCase()}`}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-[14px] text-[#374151]">
                        {formatINR(payout.grossAmount)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-[14px] text-[#6B7280]">
                        {formatINR(payout.commissionAmount)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-[14.5px] font-bold text-[#111827]">
                        {formatINR(payout.netPayout)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3.5 py-1 text-[12.5px] font-semibold ${statusStyle}`}
                        >
                          {statusLabel}
                        </span>
                      </td>

                      <td className="whitespace-nowrap py-4 pl-4 pr-5 text-[14px] text-[#374151]">
                        {formatOrderDateTime(payout.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
