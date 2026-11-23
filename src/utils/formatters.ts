import type { OrderOverallStatus, VendorDateFilterKey } from '@/types/vendor';

export function formatIndianNumber(value: number): string {
  return Math.round(value).toLocaleString('en-IN');
}

export function formatINR(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

/**
 * Formats Date & Time as `07 Nov, 10:24 AM` matching the Vendor Dashboard Recent Orders table.
 */
export function formatOrderDateTime(date: Date): string {
  if (!date || date.getTime() <= 0) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const time = date.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${day} ${month}, ${time}`;
}

export function formatOrderIdLabel(rawId: string): string {
  const clean = rawId.trim();
  if (!clean) return '#ZM00000';
  if (clean.startsWith('#')) return clean;
  if (clean.toUpperCase().startsWith('ZM')) return `#${clean.toUpperCase()}`;
  return `#ZM${clean.slice(0, 6).toUpperCase()}`;
}

export function getOrderStatusBadge(status: OrderOverallStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'placed':
      return {
        label: 'Placed',
        className: 'bg-[#FFFBEB] text-[#D97706]',
      };
    case 'confirmed':
      return {
        label: 'Confirmed',
        className: 'bg-[#F0F9FF] text-[#0284C7]',
      };
    case 'processing':
      return {
        label: 'Processing',
        className: 'bg-[#FEF3C7] text-[#EA580C]',
      };
    case 'shipped':
      return {
        label: 'Shipped',
        className: 'bg-[#DBEAFE] text-[#1D4ED8]',
      };
    case 'out_for_delivery':
      return {
        label: 'Out for Delivery',
        className: 'bg-[#EEF2FF] text-[#4F46E5]',
      };
    case 'delivered':
      return {
        label: 'Delivered',
        className: 'bg-[#DCFCE7] text-[#15803D]',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        className: 'bg-[#FEE2E2] text-[#DC2626]',
      };
  }
}

export const DATE_FILTER_OPTIONS: {
  value: VendorDateFilterKey;
  label: string;
  days: number | null;
}[] = [
  { value: 'today', label: 'Today', days: 1 },
  { value: '7d', label: 'Last 7 Days', days: 7 },
  { value: '30d', label: 'Last 30 Days', days: 30 },
  { value: '90d', label: 'Last 90 Days', days: 90 },
  { value: 'all', label: 'All Time', days: null },
];
