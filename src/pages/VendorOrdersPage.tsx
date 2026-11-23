import React, { useEffect, useMemo, useState } from 'react';
import { CustomerOutlineIcon } from '@/components/icons/VendorIcons';
import { useVendorAuth } from '@/context/VendorAuthContext';
import {
  subscribeMarketplaceDefaultCommission,
  subscribeVendorOrders,
  updateVendorOrderStatus,
} from '@/services/vendorFirestore';
import type { OrderOverallStatus, VendorOrderRecord } from '@/types/vendor';
import {
  formatINR,
  formatOrderDateTime,
  formatOrderIdLabel,
  getOrderStatusBadge,
} from '@/utils/formatters';

type StatusTab = 'all' | OrderOverallStatus;

const FORWARD_STAGE_ORDER: Exclude<OrderOverallStatus, 'cancelled'>[] = [
  'placed',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
];

function isOptionDisabledForCurrentStatus(
  currentStatus: OrderOverallStatus,
  optionStatus: OrderOverallStatus
): boolean {
  if (currentStatus === 'delivered' || currentStatus === 'cancelled') {
    return optionStatus !== currentStatus;
  }
  if (optionStatus === 'cancelled') {
    return false;
  }
  const currentIdx = FORWARD_STAGE_ORDER.indexOf(currentStatus);
  const optionIdx = FORWARD_STAGE_ORDER.indexOf(optionStatus);
  return currentIdx >= 0 && optionIdx >= 0 && optionIdx < currentIdx;
}

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All Orders' },
  { key: 'placed', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

export const VendorOrdersPage: React.FC = () => {
  const {
    vendorId,
    storeDisplayName,
    vendorProfile,
    isConfigured,
    isApprovedVendor,
  } = useVendorAuth();
  const [orders, setOrders] = useState<VendorOrderRecord[]>([]);
  const [marketplaceCommissionRate, setMarketplaceCommissionRate] =
    useState<number>(10);
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [loading, setLoading] = useState<boolean>(Boolean(isConfigured && vendorId));
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    return subscribeMarketplaceDefaultCommission(
      (rate) => setMarketplaceCommissionRate(rate),
      () => undefined
    );
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured || !vendorId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    return subscribeVendorOrders(
      vendorId,
      (nextOrders) => {
        setOrders(nextOrders);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
  }, [vendorId, isConfigured]);

  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') return orders;
    return orders.filter((o) => o.status === activeTab);
  }, [orders, activeTab]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  const commissionRate =
    vendorProfile?.commissionRate ?? marketplaceCommissionRate;

  const handleStatusChange = async (
    orderId: string,
    currentStatus: OrderOverallStatus,
    nextStatus: OrderOverallStatus
  ) => {
    if (!vendorId) return;
    if (!isApprovedVendor) {
      setError(
        'Your store must be approved by Admin before updating order statuses.'
      );
      return;
    }
    if (nextStatus === currentStatus) return;
    if (
      nextStatus === 'cancelled' &&
      typeof window !== 'undefined' &&
      !window.confirm(
        'Cancel your store portion of this order? The customer will see this order as cancelled.'
      )
    ) {
      return;
    }
    setUpdatingOrderId(orderId);
    setError(null);
    try {
      await updateVendorOrderStatus(vendorId, orderId, nextStatus);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update order status.'
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#111827]">
          Orders
        </h1>
        <p className="mt-1 text-[14.5px] text-[#4B5563]">
          Customer orders containing items sold by {storeDisplayName}.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                'rounded-xl px-4 py-2 text-[13.5px] font-semibold transition-colors',
                active
                  ? 'bg-[#16A34A] text-white shadow-sm'
                  : 'border border-[#ECEEF2] bg-white text-[#374151] hover:bg-[#F9FAFB]',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] text-[#B91C1C]">
          {error}
        </div>
      )}

      <div className="rounded-[20px] border border-[#ECEEF2] bg-white p-5 shadow-card sm:p-7">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F3F4F6]/90 text-[13.5px] font-medium text-[#374151]">
                <th className="rounded-l-xl py-3 pl-5 pr-4 font-medium">
                  Order ID
                </th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Your Items</th>
                <th className="px-4 py-3 font-medium">Store Subtotal</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date &amp; Time</th>
                <th className="px-4 py-3 font-medium">Fulfilment</th>
                <th className="rounded-r-xl py-3 pl-4 pr-5 text-right font-medium">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F6]">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx}>
                    <td colSpan={8} className="py-5 px-5">
                      <div className="h-5 w-full animate-pulse rounded bg-[#F1F3F6]" />
                    </td>
                  </tr>
                ))
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <p className="text-[15px] font-semibold text-[#1F2937]">
                      {vendorId
                        ? 'No matching store orders found'
                        : 'Sign in to view your store orders'}
                    </p>
                    <p className="mt-1 text-[13.5px] text-[#6B7280]">
                      Orders placed by ZemiGo customers for your products appear
                      here automatically.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const badge = getOrderStatusBadge(order.status);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="hover:bg-[#FAFAFB] cursor-pointer transition-colors"
                    >
                      <td className="whitespace-nowrap py-4 pl-5 pr-4 text-[14.5px] font-bold text-[#111827]">
                        <div>{formatOrderIdLabel(order.orderNumber)}</div>
                        {order.suborderNumber ? (
                          <div className="text-[11.5px] font-normal text-[#6B7280]">
                            Suborder: {order.suborderNumber}
                          </div>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="flex items-center gap-2.5 text-[14.5px] font-medium text-[#1F2937]">
                          <CustomerOutlineIcon className="h-[18px] w-[18px] shrink-0 text-[#4B5563]" />
                          <div>
                            <div>{order.customerName}</div>
                            <div className="text-[11.5px] text-[#6B7280]">
                              {order.customerPhone ||
                                order.deliveryAddress.phoneNumber ||
                                'Phone number not available'}
                              {order.deliveryAddress.city
                                ? ` • ${order.deliveryAddress.city}`
                                : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="max-w-[230px] px-4 py-4 text-[13.5px] text-[#4B5563]">
                        <div className="font-medium text-[#111827] truncate">
                          {order.itemSummary}
                        </div>
                        <div className="text-[11.5px] text-[#6B7280]">
                          {order.itemCount} qty • {order.items.length}{' '}
                          {order.items.length === 1 ? 'product' : 'products'}
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

                      <td className="whitespace-nowrap px-4 py-4 text-[13.5px] text-[#374151]">
                        {formatOrderDateTime(order.createdAt)}
                      </td>

                      <td
                        className="whitespace-nowrap px-4 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          aria-label={`Update status for ${order.orderNumber}`}
                          disabled={
                            !isApprovedVendor ||
                            updatingOrderId === order.id ||
                            order.status === 'delivered' ||
                            order.status === 'cancelled'
                          }
                          value={order.status}
                          onChange={(e) =>
                            handleStatusChange(
                              order.id,
                              order.status,
                              e.target.value as OrderOverallStatus
                            )
                          }
                          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1F2937] focus:border-[#16A34A] focus:outline-none disabled:opacity-60"
                        >
                          <option
                            value="placed"
                            disabled={isOptionDisabledForCurrentStatus(
                              order.status,
                              'placed'
                            )}
                          >
                            Placed
                          </option>
                          <option
                            value="confirmed"
                            disabled={isOptionDisabledForCurrentStatus(
                              order.status,
                              'confirmed'
                            )}
                          >
                            Confirmed
                          </option>
                          <option
                            value="processing"
                            disabled={isOptionDisabledForCurrentStatus(
                              order.status,
                              'processing'
                            )}
                          >
                            Processing
                          </option>
                          <option
                            value="shipped"
                            disabled={isOptionDisabledForCurrentStatus(
                              order.status,
                              'shipped'
                            )}
                          >
                            Shipped
                          </option>
                          <option
                            value="out_for_delivery"
                            disabled={isOptionDisabledForCurrentStatus(
                              order.status,
                              'out_for_delivery'
                            )}
                          >
                            Out for Delivery
                          </option>
                          <option
                            value="delivered"
                            disabled={isOptionDisabledForCurrentStatus(
                              order.status,
                              'delivered'
                            )}
                          >
                            Delivered
                          </option>
                          <option
                            value="cancelled"
                            disabled={isOptionDisabledForCurrentStatus(
                              order.status,
                              'cancelled'
                            )}
                          >
                            Cancelled
                          </option>
                        </select>
                      </td>

                      <td
                        className="whitespace-nowrap py-4 pl-4 pr-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className="rounded-xl bg-[#EAF7EF] px-3.5 py-1.5 text-[12.5px] font-bold text-[#15803D] hover:bg-[#DCFCE7] transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor Order Details Modal (Strictly Scoped to Authenticated Vendor) */}
      {selectedOrder ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6 overflow-y-auto"
          onClick={() => setSelectedOrderId(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#ECEEF2] bg-[#F9FAFB] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-[18px] sm:text-[20px] font-extrabold text-[#111827]">
                    Order {formatOrderIdLabel(selectedOrder.orderNumber)}
                  </h2>
                  <span
                    className={[
                      'px-3 py-0.5 rounded-full text-[12px] font-bold',
                      getOrderStatusBadge(selectedOrder.status).className,
                    ].join(' ')}
                  >
                    {getOrderStatusBadge(selectedOrder.status).label}
                  </span>
                </div>
                <p className="text-[12px] text-[#6B7280] mt-0.5">
                  {selectedOrder.suborderNumber
                    ? `Store Suborder: ${selectedOrder.suborderNumber} • `
                    : ''}
                  Placed on {formatOrderDateTime(selectedOrder.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <select
                  aria-label={`Update status for ${selectedOrder.orderNumber}`}
                  disabled={
                    !isApprovedVendor ||
                    updatingOrderId === selectedOrder.id ||
                    selectedOrder.status === 'delivered' ||
                    selectedOrder.status === 'cancelled'
                  }
                  value={selectedOrder.status}
                  onChange={(e) =>
                    handleStatusChange(
                      selectedOrder.id,
                      selectedOrder.status,
                      e.target.value as OrderOverallStatus
                    )
                  }
                  className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#1F2937] focus:border-[#16A34A] focus:outline-none disabled:opacity-60"
                >
                  <option
                    value="placed"
                    disabled={isOptionDisabledForCurrentStatus(
                      selectedOrder.status,
                      'placed'
                    )}
                  >
                    Placed
                  </option>
                  <option
                    value="confirmed"
                    disabled={isOptionDisabledForCurrentStatus(
                      selectedOrder.status,
                      'confirmed'
                    )}
                  >
                    Confirmed
                  </option>
                  <option
                    value="processing"
                    disabled={isOptionDisabledForCurrentStatus(
                      selectedOrder.status,
                      'processing'
                    )}
                  >
                    Processing
                  </option>
                  <option
                    value="shipped"
                    disabled={isOptionDisabledForCurrentStatus(
                      selectedOrder.status,
                      'shipped'
                    )}
                  >
                    Shipped
                  </option>
                  <option
                    value="out_for_delivery"
                    disabled={isOptionDisabledForCurrentStatus(
                      selectedOrder.status,
                      'out_for_delivery'
                    )}
                  >
                    Out for Delivery
                  </option>
                  <option
                    value="delivered"
                    disabled={isOptionDisabledForCurrentStatus(
                      selectedOrder.status,
                      'delivered'
                    )}
                  >
                    Delivered
                  </option>
                  <option
                    value="cancelled"
                    disabled={isOptionDisabledForCurrentStatus(
                      selectedOrder.status,
                      'cancelled'
                    )}
                  >
                    Cancelled
                  </option>
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedOrderId(null)}
                  className="rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#374151] hover:bg-[#F3F4F6]"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5">
              {/* Top Info Grid: Customer & Delivery Address, Store Earnings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer & Delivery Info */}
                <div className="rounded-xl border border-[#ECEEF2] bg-[#F9FAFB] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                      Customer &amp; Delivery Address
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-[#E5E7EB] text-[11px] font-semibold text-[#374151]">
                      {selectedOrder.deliveryAddress.label || 'Delivery'}
                    </span>
                  </div>
                  <div className="text-[14px] font-bold text-[#111827]">
                    {selectedOrder.deliveryAddress.recipientName ||
                      selectedOrder.customerName}
                  </div>
                  <div className="text-[12.5px] text-[#4B5563] mt-1 leading-relaxed">
                    {selectedOrder.deliveryAddress.addressLine1 ? (
                      <div>{selectedOrder.deliveryAddress.addressLine1}</div>
                    ) : null}
                    {selectedOrder.deliveryAddress.addressLine2 ? (
                      <div>{selectedOrder.deliveryAddress.addressLine2}</div>
                    ) : null}
                    <div>
                      {[
                        selectedOrder.deliveryAddress.city,
                        selectedOrder.deliveryAddress.state,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                      {selectedOrder.deliveryAddress.pincode
                        ? ` - ${selectedOrder.deliveryAddress.pincode}`
                        : ''}
                    </div>
                    <div className="mt-1.5 font-semibold text-[#374151]">
                      Phone:{' '}
                      {selectedOrder.customerPhone ||
                        selectedOrder.deliveryAddress.phoneNumber ||
                        'Phone number not available'}
                    </div>
                    {selectedOrder.carrierName || selectedOrder.trackingNumber ? (
                      <div className="mt-1.5 text-[11.5px] text-[#6B7280]">
                        Shipment: {selectedOrder.carrierName || 'ZemiGo Express'}{' '}
                        {selectedOrder.trackingNumber
                          ? `• Tracking: ${selectedOrder.trackingNumber}`
                          : ''}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Store Financial Summary */}
                <div className="rounded-xl border border-[#ECEEF2] bg-[#F9FAFB] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                      {storeDisplayName} Subtotal &amp; Earnings
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#EAF7EF] text-[#15803D] text-[11px] font-bold uppercase">
                      {selectedOrder.paymentMethod} • {selectedOrder.paymentStatus}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[12.5px] pt-1">
                    <div className="flex justify-between text-[#4B5563]">
                      <span>Your Items MRP</span>
                      <span>{formatINR(selectedOrder.vendorSubtotalMrp)}</span>
                    </div>
                    {selectedOrder.vendorDiscount > 0 ? (
                      <div className="flex justify-between text-[#15803D]">
                        <span>Your Item Discount</span>
                        <span>-{formatINR(selectedOrder.vendorDiscount)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-bold text-[#111827] pt-1 border-t border-[#E5E7EB]">
                      <span>Your Selling Subtotal</span>
                      <span>{formatINR(selectedOrder.vendorAmount)}</span>
                    </div>
                    <div className="flex justify-between text-[#6B7280]">
                      <span>Platform Commission ({commissionRate}%)</span>
                      <span>
                        {selectedOrder.status === 'cancelled'
                          ? formatINR(0)
                          : `-${formatINR(
                              Math.round(
                                (selectedOrder.vendorAmount * commissionRate) /
                                  100
                              )
                            )}`}
                      </span>
                    </div>
                    <div className="flex justify-between font-extrabold text-[14px] text-[#15803D] pt-1 border-t border-[#E5E7EB]">
                      <span>
                        {selectedOrder.status === 'cancelled'
                          ? 'Net Store Earnings (Cancelled)'
                          : 'Est. Net Store Earnings'}
                      </span>
                      <span>
                        {selectedOrder.status === 'cancelled'
                          ? formatINR(0)
                          : formatINR(
                              Math.max(
                                0,
                                selectedOrder.vendorAmount -
                                  Math.round(
                                    (selectedOrder.vendorAmount *
                                      commissionRate) /
                                      100
                                  )
                              )
                            )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ordered Products Belonging Strictly to This Vendor */}
              <div className="rounded-xl border border-[#ECEEF2] overflow-hidden">
                <div className="bg-[#F9FAFB] px-4 py-3 border-b border-[#ECEEF2] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-[14.5px] font-bold text-[#111827]">
                      Your Ordered Products ({selectedOrder.items.length}{' '}
                      {selectedOrder.items.length === 1 ? 'Product' : 'Products'} •{' '}
                      {selectedOrder.itemCount} Total Qty)
                    </h3>
                    <p className="text-[12px] text-[#6B7280]">
                      Showing only items sold by {storeDisplayName} in this order.
                    </p>
                  </div>
                </div>

                {selectedOrder.items.length === 0 ? (
                  <div className="p-6 text-center text-[13px] text-[#6B7280]">
                    {selectedOrder.itemSummary} ({selectedOrder.itemCount} qty)
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-[13px]">
                      <thead>
                        <tr className="bg-white border-b border-[#F3F4F6] text-[#6B7280] text-[12px]">
                          <th className="py-2.5 px-4 text-left font-semibold">
                            Product
                          </th>
                          <th className="py-2.5 px-3 text-left font-semibold">
                            Brand &amp; Category
                          </th>
                          <th className="py-2.5 px-3 text-center font-semibold">
                            Qty
                          </th>
                          <th className="py-2.5 px-3 text-right font-semibold">
                            MRP
                          </th>
                          <th className="py-2.5 px-3 text-right font-semibold">
                            Selling Price
                          </th>
                          <th className="py-2.5 px-4 text-right font-semibold">
                            Subtotal
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F6]">
                        {selectedOrder.items.map((item) => (
                          <tr key={item.id} className="hover:bg-[#F9FAFB]">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.productName}
                                    className="w-12 h-12 rounded-lg object-cover border border-[#E5E7EB] bg-[#F9FAFB] shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg border border-[#E5E7EB] bg-[#EAF7EF] text-[#15803D] flex items-center justify-center font-bold text-[14px] shrink-0">
                                    {item.productName.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-[#111827]">
                                    {item.productName}
                                  </div>
                                  {item.selectedColor || item.selectedSize ? (
                                    <div className="text-[11.5px] text-[#6B7280]">
                                      {[
                                        item.selectedColor
                                          ? `Color: ${item.selectedColor}`
                                          : '',
                                        item.selectedSize
                                          ? `Size: ${item.selectedSize}`
                                          : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' • ')}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-[#374151]">
                                {item.brand || storeDisplayName}
                              </div>
                              <div className="text-[11.5px] text-[#6B7280]">
                                {item.categoryName || 'General'}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-[#111827]">
                              {item.quantity}
                            </td>
                            <td className="py-3 px-3 text-right text-[#6B7280]">
                              {formatINR(item.unitMrp)}
                            </td>
                            <td className="py-3 px-3 text-right font-semibold text-[#111827]">
                              {formatINR(item.unitSellingPrice)}
                            </td>
                            <td className="py-3 px-4 text-right font-extrabold text-[#111827]">
                              {formatINR(item.lineTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
