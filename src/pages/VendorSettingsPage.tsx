import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVendorAuth } from '@/context/VendorAuthContext';
import { saveVendorProfile } from '@/services/vendorFirestore';
import { uploadVendorAsset } from '@/services/vendorStorage';

export const VendorSettingsPage: React.FC = () => {
  const { vendorId, vendorProfile, user, loading: authLoading } = useVendorAuth();

  const [storeName, setStoreName] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [bankAccountLast4, setBankAccountLast4] = useState('');
  const [upiId, setUpiId] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydratedVendorIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!vendorProfile) return;
    if (hydratedVendorIdRef.current === vendorProfile.id) return;
    hydratedVendorIdRef.current = vendorProfile.id;
    setStoreName(vendorProfile.storeName || '');
    setCategoryLabel(vendorProfile.categoryLabel || '');
    setPhone(vendorProfile.phone || '');
    setCity(vendorProfile.city || '');
    setAddress(vendorProfile.address || '');
    setGstNumber(vendorProfile.gstNumber || '');
    setBankAccountLast4(vendorProfile.bankAccountLast4 || '');
    setUpiId(vendorProfile.upiId || '');
  }, [vendorProfile]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!vendorId || authLoading || saving) return;

    const cleanStoreName = storeName.trim();
    const cleanPhone = phone.trim();
    const cleanLast4 = bankAccountLast4.trim();
    const cleanUpi = upiId.trim();

    if (!cleanStoreName) {
      setError('Validation error: Store Name is required.');
      return;
    }
    if (cleanPhone) {
      const digits = cleanPhone.replace(/\D/g, '');
      if (digits.length < 10) {
        setError('Validation error: Enter a valid 10-digit contact phone number.');
        return;
      }
    }
    if (cleanLast4 && !/^\d{4}$/.test(cleanLast4)) {
      setError(
        'Validation error: Bank Account Last 4 Digits must be exactly 4 numeric digits.'
      );
      return;
    }
    if (cleanUpi && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(cleanUpi)) {
      setError('Validation error: Enter a valid UPI ID (example: store@okaxis).');
      return;
    }

    setSaving(true);
    setSavedNotice(false);
    setError(null);

    try {
      let logoUrl = vendorProfile?.logoUrl;
      if (logoFile) {
        logoUrl = await uploadVendorAsset(vendorId, 'vendors', logoFile);
      }

      await saveVendorProfile(vendorId, {
        storeName: cleanStoreName,
        email: user?.email || vendorProfile?.email || '',
        categoryLabel: categoryLabel.trim() || 'Multi-Category Store',
        phone: cleanPhone,
        city: city.trim(),
        address: address.trim(),
        gstNumber: gstNumber.trim().toUpperCase(),
        bankAccountLast4: cleanLast4,
        upiId: cleanUpi,
        logoUrl,
      });

      hydratedVendorIdRef.current = vendorId;
      setLogoFile(null);
      setSavedNotice(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save store settings.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!vendorId) {
    return (
      <div className="rounded-[20px] border border-[#ECEEF2] bg-white p-8 text-center shadow-card">
        <h1 className="text-[22px] font-bold text-[#111827]">Store Settings</h1>
        <p className="mt-2 text-[14px] text-[#6B7280]">
          Sign in with your ZemiGo vendor account to manage your store profile
          and payout details.
        </p>
        <Link
          to="/login"
          className="mt-5 inline-flex rounded-xl bg-[#16A34A] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#15803D]"
        >
          Vendor Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#111827]">
          Settings
        </h1>
        <p className="mt-1 text-[14.5px] text-[#4B5563]">
          Update your ZemiGo store identity, business address, and settlement
          details.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] text-[#B91C1C]">
          {error}
        </div>
      )}

      {savedNotice && (
        <div className="rounded-xl border border-[#BBF7D0] bg-[#EAF7EF] px-4 py-3 text-[13.5px] font-semibold text-[#15803D]">
          Store settings saved to Firestore.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-[20px] border border-[#ECEEF2] bg-white p-6 shadow-card sm:p-8"
      >
        <h2 className="text-[18px] font-bold text-[#111827]">Store Profile</h2>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-[13px] font-semibold text-[#374151]">
              Store Name *
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. StyleHub"
              className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#374151]">
              Primary Category
            </label>
            <input
              type="text"
              value={categoryLabel}
              onChange={(e) => setCategoryLabel(e.target.value)}
              placeholder="e.g. Fashion & Clothing"
              className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#374151]">
              Support Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#374151]">
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Kolkata"
              className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[13px] font-semibold text-[#374151]">
              Pickup / Business Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Complete pickup address with pincode"
              className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#374151]">
              GSTIN (Optional)
            </label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="22AAAAA0000A1Z5"
              className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] uppercase text-[#111827] focus:border-[#16A34A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#374151]">
              Store Logo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full text-[13.5px] text-[#4B5563] file:mr-4 file:rounded-lg file:border-0 file:bg-[#E8F8EE] file:px-3.5 file:py-2 file:text-[13px] file:font-semibold file:text-[#16A34A]"
            />
          </div>
        </div>

        <hr className="my-7 border-[#F1F3F6]" />

        <h2 className="text-[18px] font-bold text-[#111827]">
          Payout Settlement Details
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-[13px] font-semibold text-[#374151]">
              Settlement UPI ID
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="store@okaxis"
              className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#374151]">
              Bank Account (Last 4 Digits)
            </label>
            <input
              type="text"
              maxLength={4}
              value={bankAccountLast4}
              onChange={(e) => setBankAccountLast4(e.target.value)}
              placeholder="4821"
              className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-7 flex justify-end">
          <button
            type="submit"
            disabled={saving || authLoading}
            className="rounded-xl bg-[#16A34A] px-6 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[#15803D] disabled:opacity-60"
          >
            {saving ? 'Saving Changes...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
