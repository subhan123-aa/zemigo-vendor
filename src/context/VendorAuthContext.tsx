import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  firebaseAuth,
  firestoreDb,
  isFirebaseConfigured,
  ZEMIGO_COLLECTIONS,
} from '@/lib/firebase';
import { subscribeVendorProfile } from '@/services/vendorFirestore';
import type {
  VendorApprovalStatus,
  VendorStoreProfile,
} from '@/types/vendor';

export interface RegisterVendorInput {
  storeName: string;
  categoryLabel: string;
  email: string;
  password: string;
  phone?: string;
  city?: string;
}

interface VendorAuthContextValue {
  user: User | null;
  vendorId: string | null;
  vendorProfile: VendorStoreProfile | null;
  approvalStatus: VendorApprovalStatus;
  isApprovedVendor: boolean;
  storeDisplayName: string;
  loading: boolean;
  isConfigured: boolean;
  signInVendor: (email: string, password: string) => Promise<void>;
  registerVendor: (input: RegisterVendorInput) => Promise<void>;
  signOutVendor: () => Promise<void>;
}

const VendorAuthContext = createContext<VendorAuthContextValue | undefined>(
  undefined
);

export const VendorAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [vendorProfile, setVendorProfile] = useState<VendorStoreProfile | null>(
    null
  );
  const [authLoading, setAuthLoading] = useState<boolean>(isFirebaseConfigured);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const isRegisteringRef = useRef<boolean>(false);

  useEffect(() => {
    if (!firebaseAuth) {
      setAuthLoading(false);
      return;
    }

    const auth = firebaseAuth;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setVendorProfile(null);
        setAuthLoading(false);
        setProfileLoading(false);
        return;
      }

      // If registerVendor is actively running, let it finish writing users/{uid} and vendors/{uid} first
      if (isRegisteringRef.current) {
        return;
      }

      if (firestoreDb) {
        try {
          const userRef = doc(firestoreDb, ZEMIGO_COLLECTIONS.users, nextUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const role = String(userSnap.data()?.role ?? '').toLowerCase();
            if (role && role !== 'vendor') {
              await firebaseSignOut(auth);
              setUser(null);
              setVendorProfile(null);
              setAuthLoading(false);
              setProfileLoading(false);
              return;
            }
          } else {
            // Backfill missing users/{vendorUid} document if vendor registered while Firestore was unreachable
            const fallbackStore =
              nextUser.displayName?.trim() ||
              (nextUser.email ? nextUser.email.split('@')[0] : 'Vendor Store');
            await setDoc(userRef, {
              name: fallbackStore,
              fullName: fallbackStore,
              email: (nextUser.email || '').toLowerCase(),
              phone: '',
              mobileNumber: '',
              role: 'vendor',
              approvalStatus: 'pending',
              verified: false,
              status: 'pending',
              createdAt: serverTimestamp(),
            });
          }
        } catch {
          await firebaseSignOut(auth).catch(() => undefined);
          setUser(null);
          setVendorProfile(null);
          setAuthLoading(false);
          setProfileLoading(false);
          return;
        }
      }

      setUser(nextUser);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setVendorProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const fallbackName =
      user.displayName ||
      (user.email ? user.email.split('@')[0] : 'Vendor Store');

    const unsubProfile = subscribeVendorProfile(
      user.uid,
      user.email || '',
      fallbackName,
      (profile) => {
        setVendorProfile(profile);
        setProfileLoading(false);
      },
      () => {
        setProfileLoading(false);
      }
    );

    return unsubProfile;
  }, [user]);

  const signInVendor = async (email: string, password: string) => {
    if (!firebaseAuth) {
      throw new Error(
        'Firebase is not configured yet. Add your VITE_FIREBASE_* keys in .env.'
      );
    }
    const credential = await signInWithEmailAndPassword(
      firebaseAuth,
      email.trim(),
      password
    );
    if (firestoreDb) {
      try {
        const userSnap = await getDoc(
          doc(firestoreDb, ZEMIGO_COLLECTIONS.users, credential.user.uid)
        );
        if (userSnap.exists()) {
          const role = String(userSnap.data()?.role ?? '').toLowerCase();
          if (role && role !== 'vendor') {
            await firebaseSignOut(firebaseAuth);
            throw new Error(
              `Access denied: This account has role "${role}" and cannot sign into the Vendor Panel.`
            );
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Access denied:')) {
          throw err;
        }
        await firebaseSignOut(firebaseAuth).catch(() => undefined);
        throw new Error(
          'Unable to verify your vendor account permissions. Please check your connection and try again.'
        );
      }
    }
  };

  const registerVendor = async (input: RegisterVendorInput) => {
    if (!firebaseAuth || !firestoreDb) {
      throw new Error(
        'Firebase is not configured yet. Add your VITE_FIREBASE_* keys in .env.'
      );
    }

    const cleanStoreName = input.storeName.trim();
    const cleanEmail = input.email.trim().toLowerCase();
    isRegisteringRef.current = true;

    try {
      const credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        cleanEmail,
        input.password
      );

      await updateProfile(credential.user, {
        displayName: cleanStoreName,
      });

      const uid = credential.user.uid;

      await Promise.all([
        setDoc(doc(firestoreDb, ZEMIGO_COLLECTIONS.users, uid), {
          name: cleanStoreName,
          fullName: cleanStoreName,
          email: cleanEmail,
          phone: (input.phone || '').trim(),
          mobileNumber: (input.phone || '').trim(),
          role: 'vendor',
          approvalStatus: 'pending',
          verified: false,
          status: 'pending',
          createdAt: serverTimestamp(),
        }),
        setDoc(doc(firestoreDb, ZEMIGO_COLLECTIONS.vendors, uid), {
          ownerUid: uid,
          storeName: cleanStoreName,
          name: cleanStoreName,
          categoryLabel: input.categoryLabel.trim() || 'Multi-Category Store',
          category: input.categoryLabel.trim() || 'Multi-Category Store',
          email: cleanEmail,
          phone: (input.phone || '').trim(),
          city: (input.city || '').trim(),
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
        }),
      ]);

      setUser(credential.user);
      setAuthLoading(false);
    } finally {
      isRegisteringRef.current = false;
    }
  };

  const signOutVendor = async () => {
    if (!firebaseAuth) return;
    await firebaseSignOut(firebaseAuth);
  };

  const storeDisplayName = useMemo(() => {
    if (vendorProfile?.storeName?.trim()) return vendorProfile.storeName.trim();
    if (user?.displayName?.trim()) return user.displayName.trim();
    if (user?.email) return user.email.split('@')[0];
    return 'Vendor Store';
  }, [vendorProfile, user]);

  const approvalStatus: VendorApprovalStatus =
    vendorProfile?.approvalStatus ?? 'pending';
  const isApprovedVendor = Boolean(
    vendorProfile &&
      vendorProfile.approvalStatus === 'approved' &&
      vendorProfile.active
  );

  const value = useMemo<VendorAuthContextValue>(
    () => ({
      user,
      vendorId: user?.uid ?? null,
      vendorProfile,
      approvalStatus,
      isApprovedVendor,
      storeDisplayName,
      loading: authLoading || profileLoading,
      isConfigured: isFirebaseConfigured,
      signInVendor,
      registerVendor,
      signOutVendor,
    }),
    [
      user,
      vendorProfile,
      approvalStatus,
      isApprovedVendor,
      storeDisplayName,
      authLoading,
      profileLoading,
    ]
  );

  return (
    <VendorAuthContext.Provider value={value}>
      {children}
    </VendorAuthContext.Provider>
  );
};

export function useVendorAuth(): VendorAuthContextValue {
  const ctx = useContext(VendorAuthContext);
  if (!ctx) {
    throw new Error('useVendorAuth must be used within a VendorAuthProvider');
  }
  return ctx;
}
