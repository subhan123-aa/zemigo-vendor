export type OrderOverallStatus =
  | 'placed'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type VendorApprovalStatus = 'pending' | 'approved' | 'rejected';

export type VendorDateFilterKey =
  | 'today'
  | '7d'
  | '30d'
  | '90d'
  | 'all';

export interface VendorStoreProfile {
  id: string;
  ownerUid: string;
  storeName: string;
  email: string;
  phone: string;
  categoryLabel: string;
  city: string;
  address: string;
  gstNumber: string;
  bankAccountLast4: string;
  upiId: string;
  logoUrl?: string;
  approvalStatus: VendorApprovalStatus;
  rejectionReason?: string;
  commissionRate?: number;
  verified: boolean;
  active: boolean;
  createdAt: Date;
}

export interface VendorOrderItemDetail {
  id: string;
  productId: string;
  productName: string;
  brand: string;
  categoryName: string;
  imageUrl?: string;
  quantity: number;
  unitSellingPrice: number;
  unitMrp: number;
  lineTotal: number;
  selectedColor?: string;
  selectedSize?: string;
}

export interface VendorOrderDeliveryInfo {
  label: string;
  recipientName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface VendorOrderRecord {
  id: string;
  orderNumber: string;
  suborderNumber?: string;
  customerUid?: string;
  customerName: string;
  customerPhone?: string;
  /** Strictly this vendor's suborder/items selling subtotal (never another vendor's share) */
  vendorAmount: number;
  /** Strictly this vendor's suborder/items MRP total */
  vendorSubtotalMrp: number;
  /** Strictly this vendor's suborder/items discount total */
  vendorDiscount: number;
  /** This vendor's suborder fulfilment status */
  status: OrderOverallStatus;
  itemCount: number;
  itemSummary: string;
  paymentMethod: string;
  paymentStatus: string;
  carrierName?: string;
  trackingNumber?: string;
  deliveryAddress: VendorOrderDeliveryInfo;
  /** Strictly this vendor's ordered products ONLY */
  items: VendorOrderItemDetail[];
  createdAt: Date;
}

export interface VendorProductRecord {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  brand: string;
  categoryName: string;
  price: number;
  originalPrice: number;
  stockQuantity: number;
  inStock: boolean;
  approvalStatus: VendorApprovalStatus;
  rejectionReason?: string;
  imageUrl?: string;
  createdAt: Date;
}

export interface VendorPayoutRecord {
  id: string;
  vendorId: string;
  grossAmount: number;
  commissionAmount: number;
  netPayout: number;
  status: 'pending' | 'processing' | 'paid';
  referenceId?: string;
  createdAt: Date;
}

export interface VendorCategoryOption {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
}

export interface VendorDashboardStats {
  totalSales: number;
  salesGrowthPercent: number | null;
  totalOrders: number;
  ordersGrowthPercent: number | null;
  totalProducts: number;
  productsGrowthPercent: number | null;
  totalPayouts: number;
  payoutsGrowthPercent: number | null;
  recentOrders: VendorOrderRecord[];
}
