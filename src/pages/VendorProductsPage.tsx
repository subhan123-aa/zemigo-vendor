import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductsCubeIcon } from '@/components/icons/VendorIcons';
import { useVendorAuth } from '@/context/VendorAuthContext';
import {
  createVendorProduct,
  deleteVendorProduct,
  subscribeMarketplaceCategories,
  subscribeVendorProducts,
  toggleVendorProductStock,
  updateVendorProduct,
} from '@/services/vendorFirestore';
import { uploadVendorAsset } from '@/services/vendorStorage';
import type { VendorCategoryOption, VendorProductRecord } from '@/types/vendor';
import { formatINR } from '@/utils/formatters';

export const VendorProductsPage: React.FC = () => {
  const {
    vendorId,
    storeDisplayName,
    isConfigured,
    isApprovedVendor,
    approvalStatus,
  } = useVendorAuth();
  const [products, setProducts] = useState<VendorProductRecord[]>([]);
  const [categories, setCategories] = useState<VendorCategoryOption[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(isConfigured && vendorId));
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryName, setCategoryName] = useState('Fashion');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('25');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured || !vendorId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    return subscribeVendorProducts(
      vendorId,
      (items) => {
        setProducts(items);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
  }, [vendorId, isConfigured]);

  useEffect(() => {
    if (!isConfigured) {
      setCategories([]);
      return;
    }

    return subscribeMarketplaceCategories(
      (cats) => {
        setCategories(cats);
      },
      () => {
        // Keep current category selection if categories snapshot fails temporarily
      }
    );
  }, [isConfigured]);

  const categoryOptions = useMemo(() => {
    const names = categories.map((c) => c.name);
    if (categoryName && !names.includes(categoryName)) {
      names.push(categoryName);
    }
    if (names.length === 0) {
      return ['Fashion', 'Electronics', 'Home & Living', 'Beauty', 'Accessories'];
    }
    return names;
  }, [categories, categoryName]);

  const defaultCategoryName = categoryOptions[0] || 'Fashion';

  const resetForm = () => {
    setName('');
    setBrand('');
    setCategoryName(defaultCategoryName);
    setPrice('');
    setOriginalPrice('');
    setStockQuantity('25');
    setImageFile(null);
    setEditingProductId(null);
    setShowAddForm(false);
  };

  const handleStartEdit = (product: VendorProductRecord) => {
    if (!isApprovedVendor) {
      setError(
        'Your vendor store must be approved by Admin before editing products.'
      );
      return;
    }
    setEditingProductId(product.id);
    setName(product.name);
    setBrand(product.brand);
    setCategoryName(product.categoryName || defaultCategoryName);
    setPrice(String(product.price));
    setOriginalPrice(String(product.originalPrice));
    setStockQuantity(String(product.stockQuantity));
    setImageFile(null);
    setShowAddForm(true);
    setError(null);
    setSuccessNotice(null);
  };

  const handleCreateProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (!vendorId) {
      setError('Authentication error: Please sign in to your vendor account.');
      return;
    }

    if (!isApprovedVendor) {
      setError(
        'Your vendor store must be approved by Admin before adding or editing products.'
      );
      return;
    }

    const trimmedName = name.trim();
    const numericPrice = Number(price);
    const numericOriginalPrice = Number(originalPrice || price);
    const numericStock = Number(stockQuantity);

    if (!trimmedName) {
      setError('Validation error: Product Name is required.');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError('Validation error: Selling Price must be greater than ₹0.');
      return;
    }
    if (
      originalPrice.trim() !== '' &&
      (!Number.isFinite(numericOriginalPrice) || numericOriginalPrice < numericPrice)
    ) {
      setError(
        'Validation error: Original Price (MRP) must be greater than or equal to Selling Price.'
      );
      return;
    }
    if (!Number.isInteger(numericStock) || numericStock < 0) {
      setError('Validation error: Stock Quantity must be a whole number (0 or greater).');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessNotice(null);

    try {
      let uploadedUrl: string | undefined;
      if (imageFile) {
        try {
          uploadedUrl = await uploadVendorAsset(
            vendorId,
            'products',
            imageFile
          );
        } catch (storageErr) {
          throw new Error(
            storageErr instanceof Error
              ? storageErr.message
              : 'Firebase Storage error: Failed to upload product image.'
          );
        }
      }

      if (editingProductId) {
        await updateVendorProduct(
          vendorId,
          storeDisplayName,
          editingProductId,
          {
            name: trimmedName,
            brand: brand.trim(),
            categoryName,
            price: numericPrice,
            originalPrice:
              Number.isFinite(numericOriginalPrice) &&
              numericOriginalPrice >= numericPrice
                ? numericOriginalPrice
                : numericPrice,
            stockQuantity: numericStock,
            ...(uploadedUrl !== undefined ? { imageUrl: uploadedUrl } : {}),
          }
        );
        setSuccessNotice(
          `Updated "${trimmedName}" and re-submitted for Admin approval.`
        );
      } else {
        await createVendorProduct(vendorId, storeDisplayName, {
          name: trimmedName,
          brand: brand.trim(),
          categoryName,
          price: numericPrice,
          originalPrice:
            Number.isFinite(numericOriginalPrice) &&
            numericOriginalPrice >= numericPrice
              ? numericOriginalPrice
              : numericPrice,
          stockQuantity: numericStock,
          imageUrl: uploadedUrl,
        });
        setSuccessNotice(
          `Added "${trimmedName}" (Pending Admin Approval).`
        );
      }

      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save product.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStock = async (product: VendorProductRecord) => {
    if (!vendorId || busyProductId) return;
    if (!isApprovedVendor) {
      setError(
        'Your vendor store must be approved by Admin before modifying product availability.'
      );
      return;
    }
    setBusyProductId(product.id);
    setError(null);
    setSuccessNotice(null);
    try {
      await toggleVendorProductStock(vendorId, product);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Firestore error: Unable to update product stock status.'
      );
    } finally {
      setBusyProductId(null);
    }
  };

  const handleDeleteProduct = async (product: VendorProductRecord) => {
    if (!vendorId || busyProductId) return;
    if (!isApprovedVendor) {
      setError(
        'Your vendor store must be approved by Admin before deleting products.'
      );
      return;
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `Delete "${product.name}" permanently from your store catalog?`
      )
    ) {
      return;
    }
    setBusyProductId(product.id);
    setError(null);
    setSuccessNotice(null);
    try {
      await deleteVendorProduct(vendorId, product);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Firestore error: Unable to delete product.'
      );
    } finally {
      setBusyProductId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-[#111827]">
            Products
          </h1>
          <p className="mt-1 text-[14.5px] text-[#4B5563]">
            Manage products published by {storeDisplayName} on ZemiGo. New and
            edited products require Admin approval before appearing in the
            Customer App.
          </p>
        </div>

        {vendorId ? (
          <button
            type="button"
            disabled={!isApprovedVendor}
            onClick={() => {
              if (showAddForm) {
                resetForm();
              } else {
                setShowAddForm(true);
              }
            }}
            className="inline-flex items-center justify-center rounded-xl bg-[#16A34A] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[#15803D] disabled:opacity-50"
          >
            {showAddForm
              ? 'Cancel'
              : isApprovedVendor
                ? '+ Add Product'
                : `Store ${approvalStatus}`}
          </button>
        ) : (
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-xl bg-[#16A34A] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:bg-[#15803D]"
          >
            Sign In to Add Products
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] text-[#B91C1C]">
          {error}
        </div>
      )}

      {successNotice && (
        <div className="rounded-xl border border-[#BBF7D0] bg-[#EAF7EF] px-4 py-3 text-[13.5px] font-semibold text-[#15803D]">
          {successNotice}
        </div>
      )}

      {showAddForm && vendorId && (
        <form
          onSubmit={handleCreateProduct}
          className="rounded-[20px] border border-[#ECEEF2] bg-white p-6 shadow-card"
        >
          <h2 className="text-[17px] font-bold text-[#111827]">
            {editingProductId
              ? 'Edit Store Product (Re-submits for Admin Approval)'
              : 'Add New Store Product (Submits for Admin Approval)'}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-[13px] font-semibold text-[#374151]">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cotton Slim Fit Shirt"
                className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#374151]">
                Brand
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder={storeDisplayName}
                className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#374151]">
                Category *
              </label>
              <select
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#374151]">
                Selling Price (₹) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="999"
                className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#374151]">
                MRP / Original Price (₹)
              </label>
              <input
                type="number"
                min="1"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="1499"
                className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#374151]">
                Stock Quantity *
              </label>
              <input
                type="number"
                min="0"
                required
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-[13px] font-semibold text-[#374151]">
                Product Image (Firebase Storage)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="mt-1.5 block w-full text-[13.5px] text-[#4B5563] file:mr-4 file:rounded-lg file:border-0 file:bg-[#E8F8EE] file:px-3.5 file:py-2 file:text-[13px] file:font-semibold file:text-[#16A34A]"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-[13.5px] font-semibold text-[#374151] hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#16A34A] px-5 py-2 text-[13.5px] font-semibold text-white hover:bg-[#15803D] disabled:opacity-60"
            >
              {submitting
                ? 'Saving Product...'
                : editingProductId
                  ? 'Update Product'
                  : 'Submit Product'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-[20px] border border-[#ECEEF2] bg-white p-5 shadow-card sm:p-7">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F3F4F6]/90 text-[13.5px] font-medium text-[#374151]">
                <th className="rounded-l-xl py-3 pl-5 pr-4 font-medium">
                  Product
                </th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Approval</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="rounded-r-xl py-3 pl-4 pr-5 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F6]">
              {loading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <tr key={idx}>
                    <td colSpan={7} className="py-5 px-5">
                      <div className="h-5 w-full animate-pulse rounded bg-[#F1F3F6]" />
                    </td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F8EE] text-[#16A34A]">
                      <ProductsCubeIcon className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-[15px] font-semibold text-[#1F2937]">
                      {vendorId
                        ? 'No products in your store yet'
                        : 'Sign in to manage your store products'}
                    </p>
                    <p className="mt-1 text-[13.5px] text-[#6B7280]">
                      Products added here sync with the ZemiGo customer
                      marketplace once approved by Admin.
                    </p>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-[#FAFAFB]">
                    <td className="py-4 pl-5 pr-4">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-11 w-11 rounded-xl border border-[#ECEEF2] object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F8EE] text-[#16A34A]">
                            <ProductsCubeIcon className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <p className="text-[14.5px] font-semibold text-[#111827]">
                            {product.name}
                          </p>
                          {product.brand && (
                            <p className="text-[12.5px] text-[#6B7280]">
                              {product.brand}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-[14px] text-[#374151]">
                      {product.categoryName}
                    </td>

                    <td className="px-4 py-4">
                      <span className="text-[14.5px] font-bold text-[#111827]">
                        {formatINR(product.price)}
                      </span>
                      {product.originalPrice > product.price && (
                        <span className="ml-2 text-[12.5px] text-[#9CA3AF] line-through">
                          {formatINR(product.originalPrice)}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-[14px] font-medium text-[#1F2937]">
                      {product.stockQuantity}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={[
                          'inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize',
                          product.approvalStatus === 'approved'
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : product.approvalStatus === 'rejected'
                              ? 'bg-[#FEE2E2] text-[#DC2626]'
                              : 'bg-[#FEF3C7] text-[#D97706]',
                        ].join(' ')}
                      >
                        {product.approvalStatus}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={[
                          'inline-flex rounded-full px-3 py-1 text-[12.5px] font-semibold',
                          product.inStock
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : 'bg-[#FEE2E2] text-[#DC2626]',
                        ].join(' ')}
                      >
                        {product.inStock ? 'Active' : 'Out of Stock'}
                      </span>
                    </td>

                    <td className="py-4 pl-4 pr-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!isApprovedVendor || busyProductId === product.id}
                          onClick={() => handleStartEdit(product)}
                          className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-[12.5px] font-semibold text-[#15803D] hover:bg-[#EAF7EF] disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={!isApprovedVendor || busyProductId === product.id}
                          onClick={() => void handleToggleStock(product)}
                          className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-[12.5px] font-semibold text-[#1F2937] hover:bg-[#F3F4F6] disabled:opacity-50"
                        >
                          {product.inStock ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          disabled={!isApprovedVendor || busyProductId === product.id}
                          onClick={() => void handleDeleteProduct(product)}
                          className="rounded-lg border border-[#FECACA] px-3 py-1.5 text-[12.5px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
