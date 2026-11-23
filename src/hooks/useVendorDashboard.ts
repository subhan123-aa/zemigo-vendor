import { useEffect, useMemo, useState } from 'react';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  subscribeVendorOrders,
  subscribeVendorPayouts,
  subscribeVendorProducts,
} from '@/services/vendorFirestore';
import type {
  VendorDashboardStats,
  VendorDateFilterKey,
  VendorOrderRecord,
  VendorPayoutRecord,
  VendorProductRecord,
} from '@/types/vendor';
import { DATE_FILTER_OPTIONS } from '@/utils/formatters';

function computeGrowthPercent(
  currentValue: number,
  previousValue: number
): number | null {
  if (previousValue <= 0) return null;
  const raw = ((currentValue - previousValue) / previousValue) * 100;
  return Math.round(raw * 10) / 10;
}

export interface UseVendorDashboardResult {
  stats: VendorDashboardStats;
  orders: VendorOrderRecord[];
  products: VendorProductRecord[];
  payouts: VendorPayoutRecord[];
  loading: boolean;
  error: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function useVendorDashboard(
  vendorId: string | null,
  dateFilter: VendorDateFilterKey
): UseVendorDashboardResult {
  const [orders, setOrders] = useState<VendorOrderRecord[]>([]);
  const [products, setProducts] = useState<VendorProductRecord[]>([]);
  const [payouts, setPayouts] = useState<VendorPayoutRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(
    Boolean(isFirebaseConfigured && vendorId)
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !vendorId) {
      setOrders([]);
      setProducts([]);
      setPayouts([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    let ordersReady = false;
    let productsReady = false;
    let payoutsReady = false;

    const checkReady = () => {
      if (ordersReady && productsReady && payoutsReady) {
        setLoading(false);
      }
    };

    const handleError = (err: Error) => {
      setError(err.message || 'Unable to load store metrics from Firestore.');
      setLoading(false);
    };

    const unsubOrders = subscribeVendorOrders(
      vendorId,
      (nextOrders) => {
        setOrders(nextOrders);
        ordersReady = true;
        checkReady();
      },
      handleError
    );

    const unsubProducts = subscribeVendorProducts(
      vendorId,
      (nextProducts) => {
        setProducts(nextProducts);
        productsReady = true;
        checkReady();
      },
      handleError
    );

    const unsubPayouts = subscribeVendorPayouts(
      vendorId,
      (nextPayouts) => {
        setPayouts(nextPayouts);
        payoutsReady = true;
        checkReady();
      },
      handleError
    );

    return () => {
      unsubOrders();
      unsubProducts();
      unsubPayouts();
    };
  }, [vendorId]);

  const stats = useMemo<VendorDashboardStats>(() => {
    const filterMeta =
      DATE_FILTER_OPTIONS.find((opt) => opt.value === dateFilter) ??
      DATE_FILTER_OPTIONS[1];

    const nowMs = Date.now();
    const windowMs = filterMeta.days !== null ? filterMeta.days * DAY_MS : null;
    const currentStartMs = windowMs !== null ? nowMs - windowMs : 0;
    const previousStartMs = windowMs !== null ? currentStartMs - windowMs : 0;

    const currentOrders =
      windowMs === null
        ? orders
        : orders.filter((o) => o.createdAt.getTime() >= currentStartMs);

    const previousOrders =
      windowMs === null
        ? []
        : orders.filter((o) => {
            const ts = o.createdAt.getTime();
            return ts >= previousStartMs && ts < currentStartMs;
          });

    const totalSales = currentOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.vendorAmount, 0);

    const previousSales = previousOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.vendorAmount, 0);

    const totalOrders = currentOrders.length;
    const previousOrderCount = previousOrders.length;

    const totalProducts = products.length;

    const paidPayouts = payouts.filter((p) => p.status === 'paid');
    const currentPaidPayouts =
      windowMs === null
        ? paidPayouts
        : paidPayouts.filter((p) => p.createdAt.getTime() >= currentStartMs);

    const previousPaidPayouts =
      windowMs === null
        ? []
        : paidPayouts.filter((p) => {
            const ts = p.createdAt.getTime();
            return ts >= previousStartMs && ts < currentStartMs;
          });

    const totalPayouts = currentPaidPayouts.reduce(
      (sum, p) => sum + p.netPayout,
      0
    );
    const previousPayoutTotal = previousPaidPayouts.reduce(
      (sum, p) => sum + p.netPayout,
      0
    );

    return {
      totalSales,
      salesGrowthPercent:
        windowMs === null
          ? null
          : computeGrowthPercent(totalSales, previousSales),
      totalOrders,
      ordersGrowthPercent:
        windowMs === null
          ? null
          : computeGrowthPercent(totalOrders, previousOrderCount),
      totalProducts,
      productsGrowthPercent: null,
      totalPayouts,
      payoutsGrowthPercent:
        windowMs === null
          ? null
          : computeGrowthPercent(totalPayouts, previousPayoutTotal),
      recentOrders: currentOrders.slice(0, 6),
    };
  }, [orders, products, payouts, dateFilter]);

  return {
    stats,
    orders,
    products,
    payouts,
    loading,
    error,
  };
}
