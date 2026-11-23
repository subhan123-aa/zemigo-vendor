import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useVendorAuth } from '@/context/VendorAuthContext';

export const VendorLoginPage: React.FC = () => {
  const {
    user,
    isConfigured,
    signInVendor,
    registerVendor,
  } = useVendorAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [storeName, setStoreName] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('Fashion & Clothing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === 'signin') {
        await signInVendor(email, password);
      } else {
        await registerVendor({
          storeName,
          categoryLabel,
          email,
          password,
          phone,
          city,
        });
      }
      navigate('/');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Vendor authentication failed.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFB] px-4 py-10">
      <div className="w-full max-w-[440px] rounded-[22px] border border-[#ECEEF2] bg-white p-7 shadow-card sm:p-9">
        <div className="flex items-center gap-3">
          <img
            src="/zemigo-icon.png"
            alt="ZemiGo"
            className="h-11 w-11 object-contain"
          />
          <div>
            <div className="text-[22px] font-extrabold tracking-tight text-[#111827]">
              Zemi<span className="text-[#16A34A]">Go</span>
            </div>
            <div className="text-[13px] font-medium text-[#4B5563]">
              Vendor Panel
            </div>
          </div>
        </div>

        <h1 className="mt-6 text-[22px] font-bold text-[#111827]">
          {mode === 'signin'
            ? 'Sign in to your Store'
            : 'Register your ZemiGo Store'}
        </h1>
        <p className="mt-1 text-[13.5px] text-[#6B7280]">
          {mode === 'signin'
            ? 'Access your store dashboard, orders, products, and payouts.'
            : 'Create an isolated vendor account connected to the ZemiGo marketplace.'}
        </p>

        {!isConfigured && (
          <div className="mt-4 rounded-xl border border-[#FEF3C7] bg-[#FFFBEB] px-3.5 py-2.5 text-[12.5px] text-[#92400E]">
            Add your shared ZemiGo Firebase keys in <code>.env</code> before
            signing in.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-[13px] text-[#B91C1C]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-[13px] font-semibold text-[#374151]">
                  Store Name *
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="StyleHub"
                  className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#374151]">
                  Store Category
                </label>
                <input
                  type="text"
                  value={categoryLabel}
                  onChange={(e) => setCategoryLabel(e.target.value)}
                  placeholder="Fashion & Clothing"
                  className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[13px] font-semibold text-[#374151]">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
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
              </div>
            </>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#374151]">
              Vendor Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vendor@zemigo.com"
              className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#374151]">
              Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#16A34A] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#16A34A] py-2.5 text-[14.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#15803D] disabled:opacity-60"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'signin'
                ? 'Sign In'
                : 'Create Vendor Store'}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-center border-t border-[#F1F3F6] pt-4 text-[13px]">
          <button
            type="button"
            onClick={() => {
              setMode((prev) => (prev === 'signin' ? 'register' : 'signin'));
              setError(null);
            }}
            className="font-semibold text-[#16A34A] hover:text-[#15803D]"
          >
            {mode === 'signin'
              ? 'New seller? Register store'
              : 'Already registered? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};
