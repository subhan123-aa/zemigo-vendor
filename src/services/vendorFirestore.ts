import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { firestoreDb, ZEMIGO_COLLECTIONS } from '@/lib/firebase';
import type {
  OrderOverallStatus,
  VendorApprovalStatus,
  VendorCategoryOption,
  VendorOrderDeliveryInfo,
  VendorOrderItemDetail,
  VendorOrderRecord,
  VendorPayoutRecord,
  VendorProductRecord,
  VendorStoreProfile,
} from '@/types/vendor';

function parseVendorApprovalStatus(
  raw: unknown,
  fallbackApproved = false
): VendorApprovalStatus {
  const s = String(raw ?? '').toLowerCase().trim();
  if (s === 'approved') return 'approved';
  if (s === 'rejected') return 'rejected';
  if (s === 'pending') return 'pending';
  return fallbackApproved ? 'approved' : 'pending';
}

function parseDateValue(raw: unknown): Date {
  if (!raw) return new Date(0);
  if (raw instanceof Timestamp) return raw.toDate();
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') return new Date(raw);
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'seconds' in raw &&
    typeof (raw as { seconds: unknown }).seconds === 'number'
  ) {
    return new Date((raw as { seconds: number }).seconds * 1000);
  }
  return new Date(0);
}

const VENDOR_ORDER_STAGE_STEPS: readonly {
  milestone: string;
  status: Exclude<OrderOverallStatus, 'cancelled'>;
  title: string;
  description: string;
}[] = [
  {
    milestone: 'order_placed',
    status: 'placed',
    title: 'Order Placed',
    description: 'Order received',
  },
  {
    milestone: 'order_confirmed',
    status: 'confirmed',
    title: 'Confirmed',
    description: 'Seller confirmed your order',
  },
  {
    milestone: 'packed',
    status: 'processing',
    title: 'Processing',
    description: 'Packing your order',
  },
  {
    milestone: 'shipped',
    status: 'shipped',
    title: 'Shipped',
    description: 'Your order is on the way',
  },
  {
    milestone: 'out_for_delivery',
    status: 'out_for_delivery',
    title: 'Out for Delivery',
    description: 'Delivery partner is nearby',
  },
  {
    milestone: 'delivered',
    status: 'delivered',
    title: 'Delivered',
    description: 'Order successfully delivered',
  },
] as const;

function parseRawStatusToken(raw: unknown): OrderOverallStatus | null {
  const val = String(raw || '').toLowerCase().trim();
  if (val === 'placed' || val === 'order_placed') return 'placed';
  if (val === 'confirmed' || val === 'order_confirmed') return 'confirmed';
  if (val === 'processing' || val === 'packed' || val === 'order_processing') {
    return 'processing';
  }
  if (val === 'shipped') return 'shipped';
  if (val === 'out_for_delivery' || val === 'in_transit') {
    return 'out_for_delivery';
  }
  if (val === 'delivered' || val === 'completed') return 'delivered';
  if (val === 'cancelled' || val === 'canceled' || val === 'refunded') {
    return 'cancelled';
  }
  return null;
}

function mapStatusToCanonicalMilestone(
  status: OrderOverallStatus,
  fallbackMilestone = 'order_placed'
): string {
  const found = VENDOR_ORDER_STAGE_STEPS.find((s) => s.status === status);
  return found ? found.milestone : fallbackMilestone;
}

function isDispatchedStage(status: OrderOverallStatus): boolean {
  return (
    status === 'shipped' ||
    status === 'out_for_delivery' ||
    status === 'delivered'
  );
}

function reconcileVendorOrderStage(
  rawStatus: unknown,
  rawMilestone: unknown,
  historyRaw: Record<string, unknown>[] = []
): { status: OrderOverallStatus; milestone: string } {
  const parsedStatus = parseRawStatusToken(rawStatus);
  const milestoneStr = String(rawMilestone ?? '').toLowerCase().trim();

  if (parsedStatus === 'cancelled') {
    return {
      status: 'cancelled',
      milestone: milestoneStr || 'order_placed',
    };
  }

  if (parsedStatus === 'processing') {
    if (milestoneStr === 'packed' || milestoneStr === 'processing') {
      return { status: 'processing', milestone: 'packed' };
    }
    if (milestoneStr === 'order_confirmed' || milestoneStr === 'confirmed') {
      const hasProcessingHistory = historyRaw.some((h) => {
        const m = String(h.milestone ?? '').toLowerCase();
        const t = String(h.title ?? '').toLowerCase();
        return m === 'packed' || t.includes('processing') || t.includes('packed');
      });
      return hasProcessingHistory
        ? { status: 'processing', milestone: 'packed' }
        : { status: 'confirmed', milestone: 'order_confirmed' };
    }
    if (milestoneStr === 'order_placed' || !milestoneStr) {
      const hasProcessingHistory = historyRaw.some((h) => {
        const m = String(h.milestone ?? '').toLowerCase();
        const t = String(h.title ?? '').toLowerCase();
        return m === 'packed' || t.includes('processing') || t.includes('packed');
      });
      if (hasProcessingHistory) {
        return { status: 'processing', milestone: 'packed' };
      }
      const hasConfirmHistory = historyRaw.some((h) => {
        const m = String(h.milestone ?? '').toLowerCase();
        const t = String(h.title ?? '').toLowerCase();
        return m === 'order_confirmed' || t.includes('confirm');
      });
      if (hasConfirmHistory) {
        return { status: 'confirmed', milestone: 'order_confirmed' };
      }
      return { status: 'placed', milestone: 'order_placed' };
    }
  }

  if (parsedStatus) {
    return {
      status: parsedStatus,
      milestone: mapStatusToCanonicalMilestone(parsedStatus),
    };
  }

  const byMilestone = VENDOR_ORDER_STAGE_STEPS.find(
    (s) => s.milestone === milestoneStr
  );
  if (byMilestone) {
    return { status: byMilestone.status, milestone: byMilestone.milestone };
  }

  return { status: 'placed', milestone: 'order_placed' };
}

function mapVendorProfileDoc(
  id: string,
  data: DocumentData | undefined,
  fallbackEmail: string,
  fallbackStoreName: string
): VendorStoreProfile {
  const verified =
    data?.verified !== undefined ? Boolean(data.verified) : false;
  const approvalStatus = parseVendorApprovalStatus(
    data?.approvalStatus,
    verified
  );
  const active =
    data?.active !== undefined
      ? Boolean(data.active)
      : approvalStatus === 'approved';
  return {
    id,
    ownerUid: String(data?.ownerUid || id),
    storeName: String(
      data?.storeName || data?.name || fallbackStoreName || 'Vendor Store'
    ),
    email: String(data?.email || fallbackEmail || ''),
    phone: String(data?.phone || ''),
    categoryLabel: String(
      data?.categoryLabel || data?.category || 'Multi-Category Store'
    ),
    city: String(data?.city || ''),
    address: String(data?.address || ''),
    gstNumber: String(data?.gstNumber || ''),
    bankAccountLast4: String(data?.bankAccountLast4 || ''),
    upiId: String(data?.upiId || ''),
    logoUrl: data?.logoUrl ? String(data.logoUrl) : undefined,
    approvalStatus,
    rejectionReason:
      typeof data?.rejectionReason === 'string'
        ? data.rejectionReason
        : undefined,
    commissionRate:
      data?.commissionRate !== undefined
        ? Number(data.commissionRate)
        : undefined,
    verified,
    active,
    createdAt: parseDateValue(data?.createdAt || data?.created_at),
  };
}

function resolveVendorOrderItemImageUrl(
  rawItem: Record<string, unknown>
): string | undefined {
  const candidates = [
    rawItem.image_url,
    rawItem.imageUrl,
    rawItem.thumbnail,
    rawItem.image,
    rawItem.productImage,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return undefined;
}

export function sanitizeCustomerPhone(
  raw: unknown,
  isDefaultTemplateAddress = false
): string {
  const val = String(raw ?? '').trim();
  if (
    !val ||
    val.toLowerCase() === 'not provided' ||
    val.toLowerCase() === 'phone number not available'
  ) {
    return '';
  }
  if (isDefaultTemplateAddress && val === '9876543210') {
    return '';
  }
  return val;
}

export function extractCustomerPhoneFromProfile(
  userData: Record<string, unknown>
): string {
  return sanitizeCustomerPhone(
    userData.mobileNumber ??
      userData.mobile_number ??
      userData.phone ??
      userData.phoneNumber ??
      userData.customerPhone ??
      userData.customer_phone
  );
}

function mapVendorOrderItem(
  rawItem: Record<string, unknown>,
  idx: number
): VendorOrderItemDetail {
  const quantity = Math.max(
    1,
    Number(rawItem.quantity ?? rawItem.qty ?? 1) || 1
  );
  const unitSellingPrice =
    Number(
      rawItem.unit_selling_price ??
        rawItem.unitSellingPrice ??
        rawItem.selling_price ??
        rawItem.sellingPrice ??
        rawItem.price ??
        0
    ) || 0;
  const unitMrp =
    Number(
      rawItem.unit_mrp ??
        rawItem.unitMrp ??
        rawItem.mrp ??
        rawItem.originalPrice ??
        rawItem.original_price ??
        unitSellingPrice
    ) || unitSellingPrice;
  const lineTotal =
    Number(
      rawItem.line_total ??
        rawItem.lineTotal ??
        rawItem.subtotal ??
        unitSellingPrice * quantity
    ) || unitSellingPrice * quantity;

  const selectedColorRaw = rawItem.selected_color ?? rawItem.selectedColor;
  const selectedSizeRaw = rawItem.selected_size ?? rawItem.selectedSize;

  return {
    id: String(rawItem.id ?? `v_item_${idx + 1}`),
    productId: String(rawItem.product_id ?? rawItem.productId ?? ''),
    productName: String(
      rawItem.product_name ??
        rawItem.productName ??
        rawItem.name ??
        rawItem.title ??
        'Ordered Product'
    ),
    brand: String(rawItem.brand ?? rawItem.brandName ?? ''),
    categoryName: String(
      rawItem.category_name ??
        rawItem.categoryName ??
        rawItem.category ??
        'General'
    ),
    imageUrl: resolveVendorOrderItemImageUrl(rawItem),
    quantity,
    unitSellingPrice,
    unitMrp: Math.max(unitMrp, unitSellingPrice),
    lineTotal,
    selectedColor:
      typeof selectedColorRaw === 'string' && selectedColorRaw.trim()
        ? selectedColorRaw.trim()
        : undefined,
    selectedSize:
      typeof selectedSizeRaw === 'string' && selectedSizeRaw.trim()
        ? selectedSizeRaw.trim()
        : undefined,
  };
}

/**
 * Extracts ONLY the authenticated vendor's share from a ZemiGo order document.
 * In multi-vendor orders, `vendor_suborders` and `order_items` hold per-vendor splits;
 * another vendor's items or revenue are NEVER included.
 */
function mapScopedVendorOrderDoc(
  id: string,
  data: DocumentData,
  vendorId: string
): VendorOrderRecord | null {
  const vendorIds = Array.isArray(data.vendorIds)
    ? data.vendorIds.map((v: unknown) => String(v))
    : [];

  const suborders = Array.isArray(data.vendor_suborders)
    ? (data.vendor_suborders as Record<string, unknown>[])
    : [];

  const matchingSuborder = suborders.find((sub) => {
    const subVendor = sub.vendor as Record<string, unknown> | undefined;
    const subVendorId = String(
      sub.vendor_id ||
        sub.vendorId ||
        sub.vendorUid ||
        subVendor?.vendor_id ||
        subVendor?.vendorId ||
        subVendor?.vendorUid ||
        subVendor?.id ||
        ''
    );
    return subVendorId === vendorId;
  });

  const allOrderItems = Array.isArray(data.order_items)
    ? (data.order_items as Record<string, unknown>[])
    : Array.isArray(data.items)
      ? (data.items as Record<string, unknown>[])
      : [];

  const isSingleVendorOrderOwnedByVendor =
    suborders.length === 0 &&
    vendorIds.length <= 1 &&
    (vendorIds[0] === vendorId ||
      String(data.vendorId || data.vendor_id || data.vendorUid || '') ===
        vendorId);

  const vendorItemsRaw = allOrderItems.filter((item) => {
    const itemVendorId = String(
      item.vendor_id || item.vendorId || item.vendorUid || ''
    ).trim();
    if (itemVendorId) {
      return itemVendorId === vendorId;
    }
    return isSingleVendorOrderOwnedByVendor;
  });

  const belongsViaTopLevel =
    vendorIds.includes(vendorId) ||
    String(data.vendorId || data.vendor_id || data.vendorUid || '') ===
      vendorId;

  if (!matchingSuborder && vendorItemsRaw.length === 0 && !belongsViaTopLevel) {
    return null;
  }

  // Strictly extract ONLY this vendor's items
  const rawScopedItems: Record<string, unknown>[] = matchingSuborder &&
    Array.isArray(matchingSuborder.items) &&
    (matchingSuborder.items as Record<string, unknown>[]).length > 0
    ? (matchingSuborder.items as Record<string, unknown>[]).filter((item) => {
        const itemVendorId = String(
          item.vendor_id || item.vendorId || item.vendorUid || ''
        ).trim();
        return !itemVendorId || itemVendorId === vendorId;
      })
    : vendorItemsRaw;

  const scopedItems: VendorOrderItemDetail[] = rawScopedItems.map((item, idx) =>
    mapVendorOrderItem(item, idx)
  );

  const computedVendorSellingTotal = scopedItems.reduce(
    (sum, item) => sum + item.lineTotal,
    0
  );
  const computedVendorMrpTotal = scopedItems.reduce(
    (sum, item) => sum + item.unitMrp * item.quantity,
    0
  );
  const computedItemCount = scopedItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const historyRaw = Array.isArray(data.order_status_history)
    ? (data.order_status_history as Record<string, unknown>[])
    : [];

  // Compute strictly this vendor's selling subtotal, MRP, discount, item count, status, and item summary
  let vendorAmount = 0;
  let vendorSubtotalMrp = 0;
  let vendorDiscount = 0;
  let status: OrderOverallStatus = reconcileVendorOrderStage(
    data.overall_status ?? data.status,
    data.current_milestone,
    historyRaw
  ).status;
  let itemCount = 0;
  let itemSummary = '';

  if (matchingSuborder) {
    const matchedSubId = String(matchingSuborder.id ?? '');
    vendorAmount =
      Number(
        matchingSuborder.selling_subtotal ??
          matchingSuborder.sellingSubtotal ??
          matchingSuborder.subtotal ??
          matchingSuborder.amount ??
          computedVendorSellingTotal
      ) || computedVendorSellingTotal;
    vendorSubtotalMrp =
      Number(
        matchingSuborder.subtotal_mrp ??
          matchingSuborder.subtotalMrp ??
          computedVendorMrpTotal
      ) || Math.max(computedVendorMrpTotal, vendorAmount);
    vendorDiscount =
      Number(
        matchingSuborder.vendor_discount ??
          matchingSuborder.vendorDiscount ??
          Math.max(0, vendorSubtotalMrp - vendorAmount)
      ) || 0;
    status = reconcileVendorOrderStage(
      matchingSuborder.status ?? data.overall_status ?? data.status,
      matchingSuborder.current_milestone ?? data.current_milestone,
      historyRaw.filter(
        (h) => h.suborder_id === matchedSubId || h.suborder_id === null
      )
    ).status;
    itemCount = computedItemCount || Math.max(1, scopedItems.length);
    const firstItemTitle = scopedItems[0]?.productName ?? '';
    itemSummary =
      scopedItems.length > 1 && firstItemTitle
        ? `${firstItemTitle} +${scopedItems.length - 1} more`
        : firstItemTitle || `${Math.max(1, itemCount)} item(s)`;
  } else if (scopedItems.length > 0) {
    vendorAmount = computedVendorSellingTotal;
    vendorSubtotalMrp = Math.max(computedVendorMrpTotal, vendorAmount);
    vendorDiscount = Math.max(0, vendorSubtotalMrp - vendorAmount);
    itemCount = computedItemCount;
    const firstItemTitle = scopedItems[0]?.productName ?? '';
    itemSummary =
      scopedItems.length > 1 && firstItemTitle
        ? `${firstItemTitle} +${scopedItems.length - 1} more`
        : firstItemTitle || `${Math.max(1, itemCount)} item(s)`;
  } else if (isSingleVendorOrderOwnedByVendor) {
    // Single-vendor order belonging exclusively to this vendor
    vendorAmount = Number(
      data.vendorAmount ??
        data.selling_subtotal ??
        data.payable_total ??
        data.total_amount ??
        data.totalAmount ??
        data.amount ??
        0
    );
    vendorSubtotalMrp =
      Number(data.subtotal_mrp ?? data.subtotalMrp ?? vendorAmount) ||
      vendorAmount;
    vendorDiscount = Math.max(0, vendorSubtotalMrp - vendorAmount);
    itemCount = Math.max(
      1,
      Number(data.itemCount ?? data.total_quantity ?? data.total_items ?? 1)
    );
    itemSummary = String(data.itemSummary || `${itemCount} item(s)`);
  }

  const rawAddress = (data.delivery_address ??
    data.deliveryAddress ??
    data.shipping_address) as Record<string, unknown> | undefined;

  const isDefaultTemplateAddress =
    rawAddress?.id === 'addr-home-1' || rawAddress?.id === 'addr-work-2';

  const customerUid = String(
    data.customerUid || data.user_id || data.userId || ''
  ).trim();

  const customerName = String(
    data.customerName ||
      data.customer_name ||
      rawAddress?.fullName ||
      rawAddress?.full_name ||
      rawAddress?.recipient_name ||
      'Customer'
  ).trim() || 'Customer';

  const topLevelPhone = sanitizeCustomerPhone(
    data.customerPhone ??
      data.customer_phone ??
      data.phone ??
      data.mobileNumber ??
      data.mobile_number
  );
  const addressPhone = sanitizeCustomerPhone(
    rawAddress?.mobileNumber ??
      rawAddress?.mobile_number ??
      rawAddress?.phoneNumber ??
      rawAddress?.phone_number ??
      rawAddress?.phone,
    isDefaultTemplateAddress
  );
  const customerPhone = topLevelPhone || addressPhone;

  const houseAndStreet = [rawAddress?.houseNumber, rawAddress?.streetArea]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');

  const resolvedAddressLine1 = String(
    rawAddress?.addressLine1 ??
      rawAddress?.address_line_1 ??
      rawAddress?.street ??
      rawAddress?.address ??
      houseAndStreet ??
      ''
  ).trim();

  const resolvedAddressLine2 = String(
    rawAddress?.addressLine2 ??
      rawAddress?.address_line_2 ??
      rawAddress?.landmark ??
      ''
  ).trim();

  const deliveryAddress: VendorOrderDeliveryInfo = {
    label: String(rawAddress?.label ?? 'Delivery Address'),
    recipientName: String(
      rawAddress?.fullName ??
        rawAddress?.full_name ??
        rawAddress?.recipient_name ??
        customerName
    ),
    phoneNumber: customerPhone,
    addressLine1: resolvedAddressLine1,
    addressLine2: resolvedAddressLine2 || undefined,
    city: String(rawAddress?.city ?? ''),
    state: String(rawAddress?.state ?? ''),
    pincode: String(
      rawAddress?.pincode ?? rawAddress?.postalCode ?? rawAddress?.zip ?? ''
    ),
  };

  const paymentObj =
    typeof data.payment === 'object' && data.payment !== null
      ? (data.payment as Record<string, unknown>)
      : {};

  const shipmentObj =
    matchingSuborder &&
    typeof matchingSuborder.shipment === 'object' &&
    matchingSuborder.shipment !== null
      ? (matchingSuborder.shipment as Record<string, unknown>)
      : {};

  const orderNumber = String(
    data.orderNumber || data.order_number || data.orderId || id
  );

  const suborderNumberRaw =
    matchingSuborder?.suborder_number ?? matchingSuborder?.suborderNumber;

  const dispatched = isDispatchedStage(status);

  return {
    id,
    orderNumber,
    suborderNumber:
      typeof suborderNumberRaw === 'string' && suborderNumberRaw.trim()
        ? suborderNumberRaw.trim()
        : undefined,
    customerUid: customerUid || undefined,
    customerName,
    customerPhone: customerPhone || undefined,
    vendorAmount: Number.isFinite(vendorAmount) ? vendorAmount : 0,
    vendorSubtotalMrp: Number.isFinite(vendorSubtotalMrp)
      ? vendorSubtotalMrp
      : 0,
    vendorDiscount: Number.isFinite(vendorDiscount) ? vendorDiscount : 0,
    status,
    itemCount: Math.max(1, itemCount || 1),
    itemSummary: itemSummary || 'Order item',
    paymentMethod: String(
      paymentObj.payment_method_label ??
        paymentObj.payment_method ??
        data.paymentMethod ??
        'UPI'
    ),
    paymentStatus: String(
      paymentObj.payment_status ??
        paymentObj.status ??
        data.paymentStatus ??
        'paid'
    ),
    carrierName:
      dispatched &&
      typeof shipmentObj.carrier_name === 'string' &&
      shipmentObj.carrier_name.trim()
        ? shipmentObj.carrier_name
        : undefined,
    trackingNumber:
      dispatched &&
      typeof shipmentObj.tracking_number === 'string' &&
      shipmentObj.tracking_number.trim()
        ? shipmentObj.tracking_number
        : undefined,
    deliveryAddress,
    items: scopedItems,
    createdAt: parseDateValue(
      data.createdAt || data.created_at || data.placed_at
    ),
  };
}

function mapVendorProductDoc(
  id: string,
  data: DocumentData
): VendorProductRecord {
  const stockQuantity = Number(data.stockQuantity ?? data.stock ?? 0);
  const approvalStatus = parseVendorApprovalStatus(data.approvalStatus, false);
  return {
    id,
    vendorId: String(data.vendorId || data.vendor_id || ''),
    vendorName: String(data.vendorName || data.vendor_name || ''),
    name: String(data.name || data.title || 'Untitled Product'),
    brand: String(data.brand || ''),
    categoryName: String(
      data.categoryName || data.category || 'Uncategorized'
    ),
    price: Number(data.price ?? data.selling_price ?? 0),
    originalPrice: Number(
      data.originalPrice ?? data.mrp ?? data.price ?? 0
    ),
    stockQuantity: Number.isFinite(stockQuantity) ? stockQuantity : 0,
    inStock:
      data.inStock !== undefined ? Boolean(data.inStock) : stockQuantity > 0,
    approvalStatus,
    rejectionReason:
      typeof data.rejectionReason === 'string'
        ? data.rejectionReason
        : undefined,
    imageUrl: data.imageUrl || data.image ? String(data.imageUrl || data.image) : undefined,
    createdAt: parseDateValue(data.createdAt || data.created_at),
  };
}

function mapVendorPayoutDoc(
  id: string,
  data: DocumentData
): VendorPayoutRecord {
  const rawStatus = String(data.status || 'pending').toLowerCase();
  const status: VendorPayoutRecord['status'] =
    rawStatus === 'paid' || rawStatus === 'settled'
      ? 'paid'
      : rawStatus === 'processing'
        ? 'processing'
        : 'pending';

  return {
    id,
    vendorId: String(data.vendorId || ''),
    grossAmount: Number(data.grossAmount ?? data.amount ?? 0),
    commissionAmount: Number(data.commissionAmount ?? 0),
    netPayout: Number(data.netPayout ?? data.amount ?? 0),
    status,
    referenceId: data.referenceId ? String(data.referenceId) : undefined,
    createdAt: parseDateValue(data.createdAt || data.paidAt || data.created_at),
  };
}

/**
 * Subscribes to `vendors/{vendorId}` strictly for the signed-in vendor.
 */
export function subscribeVendorProfile(
  vendorId: string,
  fallbackEmail: string,
  fallbackStoreName: string,
  onData: (profile: VendorStoreProfile) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = firestoreDb;
  if (!db || !vendorId.trim()) {
    return () => {};
  }

  const vendorRef = doc(db, ZEMIGO_COLLECTIONS.vendors, vendorId);
  let backfilled = false;

  return onSnapshot(
    vendorRef,
    (snap) => {
      if (!snap.exists() && !backfilled) {
        backfilled = true;
        const resolvedStoreName =
          fallbackStoreName.trim() ||
          (fallbackEmail ? fallbackEmail.split('@')[0] : 'Vendor Store');
        void setDoc(vendorRef, {
          ownerUid: vendorId,
          storeName: resolvedStoreName,
          name: resolvedStoreName,
          categoryLabel: 'Multi-Category Store',
          category: 'Multi-Category Store',
          email: fallbackEmail.trim().toLowerCase(),
          phone: '',
          city: '',
          address: '',
          gstNumber: '',
          bankAccountLast4: '',
          upiId: '',
          commissionRate: 10,
          approvalStatus: 'pending',
          verified: false,
          active: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {
          // If offline or blocked, fallback profile is still provided below
        });
      }

      onData(
        mapVendorProfileDoc(
          vendorId,
          snap.exists() ? snap.data() : undefined,
          fallbackEmail,
          fallbackStoreName
        )
      );
    },
    (err) => onError?.(err)
  );
}

/**
 * Creates or updates `vendors/{vendorId}` for the signed-in vendor.
 */
export async function saveVendorProfile(
  vendorId: string,
  updates: Partial<
    Omit<
      VendorStoreProfile,
      | 'id'
      | 'ownerUid'
      | 'verified'
      | 'active'
      | 'approvalStatus'
      | 'rejectionReason'
      | 'commissionRate'
      | 'createdAt'
    >
  >
): Promise<void> {
  if (!firestoreDb) {
    throw new Error('Firebase Firestore is not configured.');
  }
  if (!vendorId.trim()) {
    throw new Error('Vendor authentication is required.');
  }

  const vendorRef = doc(firestoreDb, ZEMIGO_COLLECTIONS.vendors, vendorId);
  const existing = await getDoc(vendorRef);

  if (existing.exists()) {
    await updateDoc(vendorRef, {
      ...updates,
      name: updates.storeName,
      category: updates.categoryLabel,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await setDoc(vendorRef, {
    ...updates,
    name: updates.storeName,
    category: updates.categoryLabel,
    ownerUid: vendorId,
    approvalStatus: 'pending',
    verified: false,
    active: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Real-time subscription to orders belonging strictly to `vendorId`
 * (`vendorIds array-contains vendorId`, `vendorId == vendorId`, or `vendorUid == vendorId`).
 * Never queries global orders without a vendor filter.
 * Handles an empty `orders` collection as a normal empty state (`[]`).
 */
const vendorCustomerProfileCache = new Map<
  string,
  { phone: string; fullName: string }
>();

export function subscribeVendorOrders(
  vendorId: string,
  onData: (orders: VendorOrderRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = firestoreDb;
  const cleanVendorId = vendorId.trim();
  if (!db || !cleanVendorId) {
    onData([]);
    return () => {};
  }

  const ordersCol = collection(db, ZEMIGO_COLLECTIONS.orders);
  const byVendorIdsMap = new Map<string, VendorOrderRecord>();
  const byVendorIdFieldMap = new Map<string, VendorOrderRecord>();
  const byVendorUidFieldMap = new Map<string, VendorOrderRecord>();

  const applyCachedProfileToOrder = (
    ord: VendorOrderRecord
  ): VendorOrderRecord => {
    if (ord.customerPhone || !ord.customerUid) return ord;
    const cached = vendorCustomerProfileCache.get(ord.customerUid);
    if (!cached?.phone) return ord;
    const resolvedName =
      cached.fullName &&
      (ord.customerName === 'Aarav Sharma' || ord.customerName === 'Customer')
        ? cached.fullName
        : ord.customerName;
    return {
      ...ord,
      customerPhone: cached.phone,
      customerName: resolvedName,
      deliveryAddress: {
        ...ord.deliveryAddress,
        phoneNumber: cached.phone,
        recipientName: resolvedName,
      },
    };
  };

  const emitMerged = () => {
    const merged = new Map<string, VendorOrderRecord>();
    for (const [id, record] of byVendorUidFieldMap.entries()) {
      merged.set(id, applyCachedProfileToOrder(record));
    }
    for (const [id, record] of byVendorIdFieldMap.entries()) {
      merged.set(id, applyCachedProfileToOrder(record));
    }
    for (const [id, record] of byVendorIdsMap.entries()) {
      merged.set(id, applyCachedProfileToOrder(record));
    }
    const items = Array.from(merged.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    onData(items);

    const missingUids = Array.from(
      new Set(
        items
          .filter(
            (o) =>
              !o.customerPhone &&
              Boolean(o.customerUid) &&
              !vendorCustomerProfileCache.has(o.customerUid!)
          )
          .map((o) => o.customerUid!)
      )
    );

    if (missingUids.length > 0) {
      void Promise.all(
        missingUids.map(async (uid) => {
          try {
            const userSnap = await getDoc(
              doc(db, ZEMIGO_COLLECTIONS.users, uid)
            );
            if (userSnap.exists()) {
              const rawUser = userSnap.data() as Record<string, unknown>;
              const phone = extractCustomerPhoneFromProfile(rawUser);
              const fullName = String(
                rawUser.fullName ??
                  rawUser.full_name ??
                  rawUser.name ??
                  rawUser.displayName ??
                  ''
              ).trim();
              vendorCustomerProfileCache.set(uid, { phone, fullName });
            } else {
              vendorCustomerProfileCache.set(uid, { phone: '', fullName: '' });
            }
          } catch {
            // If Firestore rules restrict vendor direct access to users/{uid}, cache empty to avoid repeat queries
            vendorCustomerProfileCache.set(uid, { phone: '', fullName: '' });
          }
        })
      ).then(() => {
        const hasResolvedPhone = missingUids.some(
          (uid) => Boolean(vendorCustomerProfileCache.get(uid)?.phone)
        );
        if (hasResolvedPhone) {
          const updatedItems = items.map(applyCachedProfileToOrder);
          onData(updatedItems);
        }
      });
    }
  };

  const qArray = query(
    ordersCol,
    where('vendorIds', 'array-contains', cleanVendorId)
  );
  const qVendorId = query(ordersCol, where('vendorId', '==', cleanVendorId));
  const qVendorUid = query(ordersCol, where('vendorUid', '==', cleanVendorId));

  const unsubArray = onSnapshot(
    qArray,
    (snapshot) => {
      byVendorIdsMap.clear();
      for (const d of snapshot.docs) {
        const mapped = mapScopedVendorOrderDoc(d.id, d.data(), cleanVendorId);
        if (mapped) {
          byVendorIdsMap.set(d.id, mapped);
        }
      }
      emitMerged();
    },
    (err) => onError?.(err)
  );

  const unsubVendorId = onSnapshot(
    qVendorId,
    (snapshot) => {
      byVendorIdFieldMap.clear();
      for (const d of snapshot.docs) {
        const mapped = mapScopedVendorOrderDoc(d.id, d.data(), cleanVendorId);
        if (mapped) {
          byVendorIdFieldMap.set(d.id, mapped);
        }
      }
      emitMerged();
    },
    (err) => onError?.(err)
  );

  const unsubVendorUid = onSnapshot(
    qVendorUid,
    (snapshot) => {
      byVendorUidFieldMap.clear();
      for (const d of snapshot.docs) {
        const mapped = mapScopedVendorOrderDoc(d.id, d.data(), cleanVendorId);
        if (mapped) {
          byVendorUidFieldMap.set(d.id, mapped);
        }
      }
      emitMerged();
    },
    (err) => onError?.(err)
  );

  return () => {
    unsubArray();
    unsubVendorId();
    unsubVendorUid();
  };
}

/**
 * Updates ONLY this vendor's suborder fulfilment status (and syncs overall status when appropriate).
 */
export async function updateVendorOrderStatus(
  vendorId: string,
  orderId: string,
  nextStatus: OrderOverallStatus
): Promise<void> {
  if (!firestoreDb) {
    throw new Error('Firebase Firestore is not configured.');
  }
  if (!vendorId.trim()) {
    throw new Error('Vendor authentication is required.');
  }

  const orderRef = doc(firestoreDb, ZEMIGO_COLLECTIONS.orders, orderId);
  const snap = await getDoc(orderRef);
  if (!snap.exists()) {
    throw new Error('Order not found.');
  }

  const data = snap.data();
  const vendorIds: string[] = Array.isArray(data.vendorIds)
    ? data.vendorIds.map((v: unknown) => String(v))
    : [];
  const matchesTopLevelVendor =
    vendorIds.includes(vendorId) ||
    String(data.vendorId || data.vendor_id || data.vendorUid || '') ===
      vendorId;

  if (!matchesTopLevelVendor) {
    throw new Error('Access denied: this order does not belong to your store.');
  }

  const existingSuborders = Array.isArray(data.vendor_suborders)
    ? (data.vendor_suborders as Record<string, unknown>[])
    : [];
  const existingShipments = Array.isArray(data.shipments)
    ? (data.shipments as Record<string, unknown>[])
    : [];
  const existingHistory = Array.isArray(data.order_status_history)
    ? (data.order_status_history as Record<string, unknown>[])
    : [];
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const estDeliveryIso = new Date(
    nowMs + 4 * 24 * 60 * 60 * 1000
  ).toISOString();

  const targetStepIdx = VENDOR_ORDER_STAGE_STEPS.findIndex(
    (s) => s.status === nextStatus
  );
  const nextMilestone =
    nextStatus === 'cancelled'
      ? 'cancelled'
      : mapStatusToCanonicalMilestone(nextStatus);
  const shippedStageReached = isDispatchedStage(nextStatus);

  const buildUpdatedVendorShipment = (
    existingShip: Record<string, unknown> | undefined
  ): Record<string, unknown> => {
    const base = existingShip ?? {};
    if (nextStatus === 'cancelled') {
      return {
        ...base,
        status: 'cancelled',
      };
    }
    if (!shippedStageReached) {
      return {
        ...base,
        status: nextStatus,
        current_milestone: nextMilestone,
        carrier_name: null,
        tracking_number: null,
        estimated_delivery_at: null,
        shipped_at: null,
        delivered_at: null,
      };
    }
    const existingCarrier =
      typeof base.carrier_name === 'string' && base.carrier_name.trim()
        ? base.carrier_name.trim()
        : 'ZemiGo Express';
    const existingTracking =
      typeof base.tracking_number === 'string' && base.tracking_number.trim()
        ? base.tracking_number.trim()
        : `ZMGX${Math.floor(10000000 + Math.random() * 90000000)}`;
    const existingEta =
      typeof base.estimated_delivery_at === 'string' &&
      base.estimated_delivery_at.trim()
        ? base.estimated_delivery_at
        : estDeliveryIso;
    return {
      ...base,
      status: nextStatus,
      current_milestone: nextMilestone,
      carrier_name: existingCarrier,
      tracking_number: existingTracking,
      estimated_delivery_at: existingEta,
      shipped_at:
        typeof base.shipped_at === 'string' && base.shipped_at
          ? base.shipped_at
          : nowIso,
      delivered_at:
        nextStatus === 'delivered'
          ? typeof base.delivered_at === 'string' && base.delivered_at
            ? base.delivered_at
            : nowIso
          : null,
    };
  };

  if (existingSuborders.length > 0) {
    let matchedSuborderId: string | null = null;
    let matchedVendorName = 'Store';
    let previousSubStepIdx = 0;
    let previousSubStatus: OrderOverallStatus = 'placed';

    const updatedSuborders = existingSuborders.map((sub) => {
      const subVendor = sub.vendor as Record<string, unknown> | undefined;
      const subVendorId = String(
        sub.vendor_id ||
          sub.vendorId ||
          subVendor?.vendor_id ||
          subVendor?.id ||
          ''
      );
      if (subVendorId !== vendorId) return sub;
      matchedSuborderId = String(sub.id ?? '');
      matchedVendorName = String(
        subVendor?.store_name ?? sub.vendor_name ?? 'Store'
      );

      const subReconciled = reconcileVendorOrderStage(
        sub.status ?? data.overall_status ?? data.status,
        sub.current_milestone ?? data.current_milestone,
        existingHistory.filter(
          (h) => h.suborder_id === matchedSuborderId || h.suborder_id === null
        )
      );
      previousSubStatus = subReconciled.status;
      previousSubStepIdx = Math.max(
        0,
        VENDOR_ORDER_STAGE_STEPS.findIndex(
          (s) => s.milestone === subReconciled.milestone
        )
      );

      if (previousSubStatus === 'delivered' || previousSubStatus === 'cancelled') {
        throw new Error(
          `Order suborder is already ${previousSubStatus} and cannot be modified.`
        );
      }
      if (nextStatus !== 'cancelled' && targetStepIdx < previousSubStepIdx) {
        throw new Error(
          `Invalid status transition: cannot move order backwards from "${previousSubStatus}" to "${nextStatus}".`
        );
      }
      if (nextStatus === previousSubStatus) {
        throw new Error(`Order is already marked as "${nextStatus}".`);
      }

      const subShipment =
        typeof sub.shipment === 'object' && sub.shipment !== null
          ? buildUpdatedVendorShipment(sub.shipment as Record<string, unknown>)
          : sub.shipment;
      return {
        ...sub,
        status: nextStatus,
        current_milestone:
          nextStatus === 'cancelled'
            ? subReconciled.milestone
            : nextMilestone,
        shipment: subShipment,
      };
    });

    if (matchedSuborderId === null) {
      throw new Error('Access denied: no store suborder matched your vendor account.');
    }

    const allStages = updatedSuborders.map((sub) =>
      reconcileVendorOrderStage(sub.status, sub.current_milestone, existingHistory)
    );
    const activeStages = allStages.filter((s) => s.status !== 'cancelled');
    let derivedOverall: OrderOverallStatus;
    let derivedMilestone: string;

    if (activeStages.length === 0) {
      derivedOverall = 'cancelled';
      derivedMilestone = nextMilestone;
    } else if (activeStages.every((s) => s.status === 'delivered')) {
      derivedOverall = 'delivered';
      derivedMilestone = 'delivered';
    } else {
      const anyTransit = activeStages.some((s) => isDispatchedStage(s.status));
      if (anyTransit) {
        const maxTransitIdx = Math.max(
          ...activeStages.map((s) =>
            Math.min(
              4,
              VENDOR_ORDER_STAGE_STEPS.findIndex(
                (st) => st.milestone === s.milestone
              )
            )
          )
        );
        const step = VENDOR_ORDER_STAGE_STEPS[Math.max(3, maxTransitIdx)];
        derivedOverall = step.status;
        derivedMilestone = step.milestone;
      } else {
        const minPreIdx = Math.min(
          ...activeStages.map((s) =>
            Math.max(
              0,
              VENDOR_ORDER_STAGE_STEPS.findIndex(
                (st) => st.milestone === s.milestone
              )
            )
          )
        );
        const step = VENDOR_ORDER_STAGE_STEPS[minPreIdx];
        derivedOverall = step.status;
        derivedMilestone = step.milestone;
      }
    }

    const updatedShipments =
      updatedSuborders.length > 0
        ? updatedSuborders
            .map((s) => s.shipment)
            .filter((s): s is Record<string, unknown> => Boolean(s))
        : existingShipments.map((s) => buildUpdatedVendorShipment(s));

    const addedHistory: Record<string, unknown>[] = [];
    if (nextStatus === 'cancelled') {
      addedHistory.push({
        id: `hist_vendor_${nowMs}`,
        order_id: orderId,
        suborder_id: matchedSuborderId || null,
        milestone: 'cancelled',
        status: 'cancelled',
        title: `Shipment Cancelled (${matchedVendorName})`,
        description: `${matchedVendorName} cancelled the shipment.`,
        created_at: nowIso,
      });
    } else if (targetStepIdx > previousSubStepIdx) {
      for (let i = previousSubStepIdx + 1; i <= targetStepIdx; i++) {
        const stepDef = VENDOR_ORDER_STAGE_STEPS[i];
        const stepIso = new Date(
          nowMs + (i - previousSubStepIdx) * 1000
        ).toISOString();
        addedHistory.push({
          id: `hist_vendor_${nowMs}_${i}`,
          order_id: orderId,
          suborder_id: matchedSuborderId || null,
          milestone: stepDef.milestone,
          status: stepDef.status,
          title: `${stepDef.title} (${matchedVendorName})`,
          description: `${matchedVendorName}: ${stepDef.description}`,
          created_at: stepIso,
        });
      }
    } else if (targetStepIdx >= 0) {
      const stepDef = VENDOR_ORDER_STAGE_STEPS[targetStepIdx];
      addedHistory.push({
        id: `hist_vendor_${nowMs}`,
        order_id: orderId,
        suborder_id: matchedSuborderId || null,
        milestone: stepDef.milestone,
        status: stepDef.status,
        title: `${stepDef.title} (${matchedVendorName})`,
        description: `${matchedVendorName} set status to ${stepDef.title}.`,
        created_at: nowIso,
      });
    }

    await updateDoc(orderRef, {
      vendor_suborders: updatedSuborders,
      ...(updatedShipments.length > 0 ? { shipments: updatedShipments } : {}),
      status: derivedOverall,
      overall_status: derivedOverall,
      current_milestone: derivedMilestone,
      order_status_history: [...existingHistory, ...addedHistory],
      updated_at: nowIso,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const legacyReconciled = reconcileVendorOrderStage(
    data.overall_status ?? data.status,
    data.current_milestone,
    existingHistory
  );
  const legacyPrevIdx = Math.max(
    0,
    VENDOR_ORDER_STAGE_STEPS.findIndex(
      (s) => s.milestone === legacyReconciled.milestone
    )
  );
  if (
    legacyReconciled.status === 'delivered' ||
    legacyReconciled.status === 'cancelled'
  ) {
    throw new Error(
      `Order is already ${legacyReconciled.status} and cannot be modified.`
    );
  }
  if (nextStatus !== 'cancelled' && targetStepIdx < legacyPrevIdx) {
    throw new Error(
      `Invalid status transition: cannot move order backwards from "${legacyReconciled.status}" to "${nextStatus}".`
    );
  }
  if (nextStatus === legacyReconciled.status) {
    throw new Error(`Order is already marked as "${nextStatus}".`);
  }

  await updateDoc(orderRef, {
    status: nextStatus,
    overall_status: nextStatus,
    current_milestone: nextMilestone,
    updated_at: nowIso,
    updatedAt: serverTimestamp(),
  });
}

const FIRESTORE_WRITE_TIMEOUT_MS = 12000;

async function withFirestoreTimeout<T>(
  operation: Promise<T>,
  actionLabel: string,
  timeoutMs = FIRESTORE_WRITE_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Firestore ${actionLabel} timed out after ${Math.round(timeoutMs / 1000)}s. Check your network connection and Firestore rules.`
          )
        );
      }, timeoutMs);
    });
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

function formatFirestoreWriteError(err: unknown, actionLabel: string): Error {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const rawMessage =
    err instanceof Error ? err.message : String(err || 'Unknown Firestore error');

  if (code === 'permission-denied') {
    return new Error(
      `Firestore permission denied while ${actionLabel}: Verify your vendor account is approved/active and you are editing only your own store products.`
    );
  }
  if (code === 'unauthenticated') {
    return new Error(
      `Firestore authentication error while ${actionLabel}: Please sign in again.`
    );
  }
  if (code === 'invalid-argument') {
    return new Error(
      `Firestore invalid product data while ${actionLabel}: ${rawMessage}`
    );
  }
  if (rawMessage.startsWith('Firestore ')) {
    return new Error(rawMessage);
  }
  return new Error(
    `Firestore error while ${actionLabel}${code ? ` (${code})` : ''}: ${rawMessage}`
  );
}

/**
 * Real-time subscription to products owned strictly by `vendorId`.
 */
export function subscribeVendorProducts(
  vendorId: string,
  onData: (products: VendorProductRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = firestoreDb;
  if (!db || !vendorId.trim()) {
    onData([]);
    return () => {};
  }

  const q = query(
    collection(db, ZEMIGO_COLLECTIONS.products),
    where('vendorId', '==', vendorId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => mapVendorProductDoc(d.id, d.data()))
        .filter((item) => item.vendorId === vendorId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onData(items);
    },
    (err) => onError?.(err)
  );
}

export async function createVendorProduct(
  vendorId: string,
  vendorName: string,
  input: {
    name: string;
    brand: string;
    categoryName: string;
    price: number;
    originalPrice: number;
    stockQuantity: number;
    imageUrl?: string;
  }
): Promise<string> {
  if (!firestoreDb) {
    throw new Error('Firestore error: Firebase Firestore is not configured.');
  }
  const cleanVendorId = vendorId.trim();
  if (!cleanVendorId) {
    throw new Error('Firestore error: Vendor authentication is required.');
  }

  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error('Product name is required.');
  }

  const sellingPrice = Number(input.price);
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
    throw new Error('Selling price must be a valid number greater than 0.');
  }

  const rawMrp = Number(input.originalPrice || input.price);
  const mrpPrice =
    Number.isFinite(rawMrp) && rawMrp >= sellingPrice ? rawMrp : sellingPrice;
  const cleanStock = Math.max(
    0,
    Math.round(Number.isFinite(input.stockQuantity) ? input.stockQuantity : 0)
  );
  const discountPercentage =
    mrpPrice > sellingPrice
      ? Math.round(((mrpPrice - sellingPrice) / mrpPrice) * 100)
      : 0;
  const cleanVendorName = vendorName.trim() || 'Vendor Store';
  const cleanBrand = input.brand.trim() || cleanVendorName;
  const cleanCategory = input.categoryName.trim() || 'Fashion';

  try {
    const refDoc = await withFirestoreTimeout(
      addDoc(collection(firestoreDb, ZEMIGO_COLLECTIONS.products), {
        vendorId: cleanVendorId,
        vendor_id: cleanVendorId,
        vendorUid: cleanVendorId,
        vendorName: cleanVendorName,
        vendor_name: cleanVendorName,
        name: cleanName,
        brand: cleanBrand,
        categoryName: cleanCategory,
        category: cleanCategory,
        price: sellingPrice,
        selling_price: sellingPrice,
        originalPrice: mrpPrice,
        mrp: mrpPrice,
        discountPercentage,
        stockQuantity: cleanStock,
        inStock: cleanStock > 0,
        approvalStatus: 'pending',
        imageUrl: input.imageUrl || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      'creating product'
    );
    return refDoc.id;
  } catch (err) {
    throw formatFirestoreWriteError(err, 'creating product');
  }
}

export async function updateVendorProduct(
  vendorId: string,
  vendorName: string,
  productId: string,
  input: {
    name: string;
    brand: string;
    categoryName: string;
    price: number;
    originalPrice: number;
    stockQuantity: number;
    imageUrl?: string;
  }
): Promise<void> {
  if (!firestoreDb) {
    throw new Error('Firestore error: Firebase Firestore is not configured.');
  }
  const cleanVendorId = vendorId.trim();
  if (!cleanVendorId) {
    throw new Error('Firestore error: Vendor authentication is required.');
  }

  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error('Product name is required.');
  }

  const sellingPrice = Number(input.price);
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
    throw new Error('Selling price must be a valid number greater than 0.');
  }

  const rawMrp = Number(input.originalPrice || input.price);
  const mrpPrice =
    Number.isFinite(rawMrp) && rawMrp >= sellingPrice ? rawMrp : sellingPrice;
  const cleanStock = Math.max(
    0,
    Math.round(Number.isFinite(input.stockQuantity) ? input.stockQuantity : 0)
  );
  const discountPercentage =
    mrpPrice > sellingPrice
      ? Math.round(((mrpPrice - sellingPrice) / mrpPrice) * 100)
      : 0;
  const cleanVendorName = vendorName.trim() || 'Vendor Store';
  const cleanBrand = input.brand.trim() || cleanVendorName;
  const cleanCategory = input.categoryName.trim() || 'Fashion';

  try {
    await withFirestoreTimeout(
      updateDoc(doc(firestoreDb, ZEMIGO_COLLECTIONS.products, productId), {
        vendorId: cleanVendorId,
        vendor_id: cleanVendorId,
        vendorUid: cleanVendorId,
        vendorName: cleanVendorName,
        vendor_name: cleanVendorName,
        name: cleanName,
        brand: cleanBrand,
        categoryName: cleanCategory,
        category: cleanCategory,
        price: sellingPrice,
        selling_price: sellingPrice,
        originalPrice: mrpPrice,
        mrp: mrpPrice,
        discountPercentage,
        stockQuantity: cleanStock,
        inStock: cleanStock > 0,
        approvalStatus: 'pending',
        ...(input.imageUrl !== undefined
          ? { imageUrl: input.imageUrl || null }
          : {}),
        updatedAt: serverTimestamp(),
      }),
      'updating product'
    );
  } catch (err) {
    throw formatFirestoreWriteError(err, 'updating product');
  }
}

export async function toggleVendorProductStock(
  vendorId: string,
  product: VendorProductRecord
): Promise<void> {
  if (!firestoreDb) {
    throw new Error('Firestore error: Firebase Firestore is not configured.');
  }
  const cleanVendorId = vendorId.trim();
  if (!cleanVendorId || product.vendorId !== cleanVendorId) {
    throw new Error('Access denied: you can only modify your own products.');
  }

  try {
    await withFirestoreTimeout(
      updateDoc(doc(firestoreDb, ZEMIGO_COLLECTIONS.products, product.id), {
        vendorId: cleanVendorId,
        inStock: !product.inStock,
        approvalStatus: 'pending',
        updatedAt: serverTimestamp(),
      }),
      'updating product stock status'
    );
  } catch (err) {
    throw formatFirestoreWriteError(err, 'updating product stock status');
  }
}

export async function deleteVendorProduct(
  vendorId: string,
  product: VendorProductRecord
): Promise<void> {
  if (!firestoreDb) {
    throw new Error('Firestore error: Firebase Firestore is not configured.');
  }
  const cleanVendorId = vendorId.trim();
  if (!cleanVendorId || product.vendorId !== cleanVendorId) {
    throw new Error('Access denied: you can only delete your own products.');
  }

  try {
    await withFirestoreTimeout(
      deleteDoc(doc(firestoreDb, ZEMIGO_COLLECTIONS.products, product.id)),
      'deleting product'
    );
  } catch (err) {
    throw formatFirestoreWriteError(err, 'deleting product');
  }
}

/**
 * Real-time subscription to payouts belonging strictly to `vendorId`.
 */
export function subscribeVendorPayouts(
  vendorId: string,
  onData: (payouts: VendorPayoutRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = firestoreDb;
  if (!db || !vendorId.trim()) {
    onData([]);
    return () => {};
  }

  const q = query(
    collection(db, ZEMIGO_COLLECTIONS.payouts),
    where('vendorId', '==', vendorId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => mapVendorPayoutDoc(d.id, d.data()))
        .filter((item) => item.vendorId === vendorId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onData(items);
    },
    (err) => onError?.(err)
  );
}

/**
 * Real-time subscription to marketplace categories created by Admin so
 * Vendor Product forms never drift out of sync with Customer App categories.
 */
export function subscribeMarketplaceCategories(
  onData: (categories: VendorCategoryOption[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = firestoreDb;
  if (!db) {
    onData([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, ZEMIGO_COLLECTIONS.categories),
    (snapshot) => {
      const items: VendorCategoryOption[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          const active =
            data.active !== undefined
              ? Boolean(data.active)
              : String(data.status || 'active').toLowerCase() !== 'inactive';
          return {
            id: d.id,
            name: String(data.name || data.title || d.id).trim(),
            active,
            sortOrder: Number(data.sortOrder ?? data.displayOrder ?? 999),
          };
        })
        .filter((cat) => cat.name && cat.active)
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
        );
      onData(items);
    },
    (err) => onError?.(err)
  );
}

/**
 * Real-time subscription to `settings/marketplace.defaultCommissionPercent`.
 */
export function subscribeMarketplaceDefaultCommission(
  onData: (percent: number) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = firestoreDb;
  if (!db) {
    onData(10);
    return () => {};
  }

  return onSnapshot(
    doc(db, ZEMIGO_COLLECTIONS.settings, 'marketplace'),
    (snap) => {
      if (!snap.exists()) {
        onData(10);
        return;
      }
      const data = snap.data();
      const raw = Number(data?.defaultCommissionPercent);
      onData(Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : 10);
    },
    (err) => onError?.(err)
  );
}
