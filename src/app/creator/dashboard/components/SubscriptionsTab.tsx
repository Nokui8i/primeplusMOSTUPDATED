'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { FiPlus, FiEdit, FiTrash2, FiCheck, FiX, FiToggleLeft, FiToggleRight, FiImage, FiCamera, FiVideo, FiRotateCw, FiBox, FiHeadphones, FiMoreVertical } from 'react-icons/fi';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingInterval?: 'day' | 'week' | 'month' | 'year';
  intervalCount?: number;
  isActive: boolean;
  creatorId: string;
  createdAt?: any;
  updatedAt?: any;
  allowedCategories?: string[];
  discountSchedule?: { period: number; discountPercent: number }[];
}

interface PromoCode {
  id: string;
  code: string;
  discountPercent: number;
  expiresAt: any;
  applicablePlanIds: string[];
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

const privilegedRoles = ['creator', 'admin', 'superadmin', 'owner'];

const CONTENT_CATEGORIES = [
  { value: 'image', label: 'Image', icon: <FiImage /> },
  { value: 'image360', label: '360° Image', icon: <FiCamera /> },
  { value: 'video', label: 'Video', icon: <FiVideo /> },
  { value: 'video360', label: '360° Video', icon: <FiRotateCw /> },
  { value: 'vr', label: 'VR Experience', icon: <FiBox /> },
  { value: 'ar', label: 'AR Content', icon: <FiBox /> },
  { value: 'audio', label: 'Audio', icon: <FiHeadphones /> },
];

// Helper to get a JS Date from Firestore Timestamp, Date, or string
function getDateFromAny(val: any): Date | null {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'string' || val instanceof String) return new Date(val as string);
  if (val instanceof Date) return val;
  return null;
}

export default function SubscriptionsTab() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Plan>>({ intervalCount: 30, billingInterval: 'day', currency: 'USD' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: '',
    discountPercent: '',
    expiresAt: null,
    applicablePlanIds: [] as string[],
  });
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoCodesLoading, setPromoCodesLoading] = useState(true);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [discountSchedule, setDiscountSchedule] = useState<{ period: number; discountPercent: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile(snap.data());
        }
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  // Load plans from Firestore
  useEffect(() => {
    if (!user) return;
    const fetchPlans = async () => {
      setPlansLoading(true);
      setPlansError(null);
      try {
        const q = query(
          collection(db, 'plans'),
          where('creatorId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setPlans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan)));
      } catch (err: any) {
        console.error('Error fetching plans:', err);
        setPlansError('Failed to load plans.');
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();
  }, [user, saving]);

  // Load promos from Firestore
  useEffect(() => {
    if (!user) return;
    const fetchPromos = async () => {
      setPromoCodesLoading(true);
      try {
        const q = query(
          collection(db, 'promoCodes'),
          where('creatorId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setPromoCodes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PromoCode)));
      } catch (err) {
        console.error('Error fetching promos:', err);
      } finally {
        setPromoCodesLoading(false);
      }
    };
    fetchPromos();
  }, [user, promoSaving]);

  if (!user || profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const isPrivileged = profile && (
    ['admin', 'superadmin', 'owner'].includes(profile.role) ||
    (profile.role === 'creator' && profile.verificationStatus === 'verified')
  );

  if (!isPrivileged) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Subscription Plans</h2>
          <p className="text-red-600">You must be a verified creator or privileged role to manage subscription plans.</p>
        </Card>
      </div>
    );
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'price' || name === 'intervalCount') {
      const numValue = value === '' ? undefined : Number(value);
      setForm((prev) => ({ ...prev, [name]: numValue }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCreate = async () => {
    console.log('Form state:', form);
    if (!form.name || form.price == null || form.intervalCount == null) {
      alert('Missing required fields');
      return;
    }
    setSaving(true);
    try {
      const planData: any = {
        name: form.name,
        price: form.price,
        billingInterval: form.billingInterval || 'day',
        intervalCount: form.intervalCount,
        isActive: true,
        creatorId: user.uid,
        currency: 'USD',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (discountSchedule.length > 0) {
        planData.discountSchedule = discountSchedule;
      }
      const docRef = await addDoc(collection(db, 'plans'), planData);
      setPlans(prevPlans => [...prevPlans, { id: docRef.id, ...planData }]);
      setForm({});
      setShowForm(false);
    } catch (err) {
      console.error('Plan creation error:', err);
      try {
        console.error('Plan creation error (string):', String(err));
        console.error('Plan creation error (JSON):', JSON.stringify(err));
      } catch (jsonErr) {
        console.error('Error stringifying error:', jsonErr);
      }
      alert('Failed to create plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setForm(plan);
    setShowForm(true);
  };

  const handleUpdate = async () => {
    if (!form.name || !form.price || !form.intervalCount || !editingId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'plans', editingId), {
        name: form.name,
        price: form.price,
        currency: form.currency || 'USD',
        billingInterval: form.billingInterval || 'day',
        intervalCount: form.intervalCount,
        discountSchedule: discountSchedule.length > 0 ? discountSchedule : undefined,
        updatedAt: serverTimestamp(),
      });
      setForm({});
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      alert('Failed to update plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'plans', id));
    } catch (err) {
      alert('Failed to delete plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'plans', id), {
        isActive: !current,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      alert('Failed to update plan status.');
    } finally {
      setSaving(false);
    }
  };

  const handlePromoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPromoForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePromoPlanSelect = (planId: string) => {
    setPromoForm((prev) => {
      const current = prev.applicablePlanIds;
      if (current.includes(planId)) {
        return { ...prev, applicablePlanIds: current.filter((id) => id !== planId) };
      } else {
        return { ...prev, applicablePlanIds: [...current, planId] };
      }
    });
  };

  const handleEditPromo = (promo: PromoCode) => {
    setEditingPromoId(promo.id);
    setPromoForm({
      code: promo.code,
      discountPercent: promo.discountPercent.toString(),
      expiresAt: promo.expiresAt?.toDate().toISOString().split('T')[0] || null,
      applicablePlanIds: promo.applicablePlanIds,
    });
    setShowPromoForm(true);
  };

  const handleDeletePromo = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promo code?')) return;
    setPromoSaving(true);
    try {
      await deleteDoc(doc(db, 'promoCodes', id));
      setPromoCodes(prev => prev.filter(promo => promo.id !== id));
    } catch (err) {
      alert('Failed to delete promo code.');
    } finally {
      setPromoSaving(false);
    }
  };

  const handleTogglePromoActive = async (id: string, current: boolean) => {
    setPromoSaving(true);
    try {
      await updateDoc(doc(db, 'promoCodes', id), {
        isActive: !current,
        updatedAt: serverTimestamp(),
      });
      setPromoCodes(prev => prev.map(promo => 
        promo.id === id ? { ...promo, isActive: !current } : promo
      ));
    } catch (err) {
      alert('Failed to update promo status.');
    } finally {
      setPromoSaving(false);
    }
  };

  const handleCreatePromo = async () => {
    if (!promoForm.code || !promoForm.discountPercent || !promoForm.expiresAt || promoForm.applicablePlanIds.length === 0) return;
    setPromoSaving(true);
    try {
      const promoData = {
        code: promoForm.code,
        creatorId: user.uid,
        discountPercent: Number(promoForm.discountPercent),
        expiresAt: new Date(promoForm.expiresAt),
        applicablePlanIds: promoForm.applicablePlanIds,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (editingPromoId) {
        await updateDoc(doc(db, 'promoCodes', editingPromoId), {
          ...promoData,
          updatedAt: serverTimestamp(),
        });
        setPromoCodes(prev => prev.map(promo => 
          promo.id === editingPromoId ? { ...promo, ...promoData } : promo
        ));
      } else {
        const docRef = await addDoc(collection(db, 'promoCodes'), promoData);
        setPromoCodes(prev => [...prev, { id: docRef.id, ...promoData }]);
      }

      setPromoForm({ code: '', discountPercent: '', expiresAt: null, applicablePlanIds: [] });
      setShowPromoForm(false);
      setEditingPromoId(null);
    } catch (err) {
      alert('Failed to save promo code.');
    } finally {
      setPromoSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-2 mb-4 bg-white border border-gray-100 rounded-md shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-800">Subscription Plans</h2>
          <div className="flex gap-2">
            <Dialog open={showForm} onOpenChange={(open) => {
              setShowForm(open);
              if (!open) { setForm({}); setEditingId(null); }
            }}>
              <DialogTrigger asChild>
                <Button variant="create" size="sm" className="px-1.5 py-0.5 text-[11px] font-semibold rounded shadow-glow-pink min-w-0 h-7" onClick={() => { setForm({}); setEditingId(null); }}>
                  <FiPlus className="mr-1 text-xs" /> Create Plan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>{editingId ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
                <DialogDescription>
                  Configure your subscription plan details below.
                </DialogDescription>
                <div className="space-y-4 mt-2">
                  {/* Plan Info Card */}
                  <div className="bg-white rounded-xl shadow p-3 mb-3">
                    <div className="mb-2">
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Plan Name</label>
                      <Input name="name" value={form.name || ''} onChange={handleInput} placeholder="e.g., Basic Plan" className="w-full text-xs py-1 px-2 bg-gray-50 rounded" />
                    </div>
                    <div className="mb-2">
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Price (USD)</label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="radio"
                            id="plan-type-free"
                            name="planType"
                            checked={form.price === 0}
                            onChange={() => setForm(prev => ({ ...prev, price: 0 }))}
                            className="accent-fuchsia-500"
                          />
                          <label htmlFor="plan-type-free" className="text-xs">Free</label>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="radio"
                            id="plan-type-paid"
                            name="planType"
                            checked={typeof form.price === 'number' && form.price > 0}
                            onChange={() => setForm(prev => ({ ...prev, price: undefined }))}
                            className="accent-fuchsia-500"
                          />
                          <label htmlFor="plan-type-paid" className="text-xs">Paid</label>
                        </div>
                        <Input
                          name="price"
                          type="number"
                          value={typeof form.price === 'number' && form.price > 0 ? form.price : ''}
                          onChange={e => {
                            const value = e.target.value;
                            setForm(prev => ({ ...prev, price: value === '' ? undefined : Number(value) }));
                          }}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-24 text-xs py-1 px-2 bg-gray-50 rounded"
                          disabled={form.price === 0}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 items-end mb-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Duration</label>
                        <Input name="intervalCount" type="number" value={form.intervalCount || ''} onChange={handleInput} placeholder="30" min="1" className="w-full text-xs py-1 px-2 bg-gray-50 rounded" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Unit</label>
                        <select
                          name="billingInterval"
                          value={form.billingInterval || 'day'}
                          onChange={e => setForm(prev => ({ ...prev, billingInterval: e.target.value as 'day' | 'week' | 'month' | 'year' }))}
                          className="border rounded-full px-2 py-1 text-xs bg-gray-50"
                        >
                          <option value="day">Days</option>
                          <option value="week">Weeks</option>
                          <option value="month">Months</option>
                          <option value="year">Years</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button onClick={editingId ? handleUpdate : handleCreate} disabled={saving}>
                      {saving ? 'Saving...' : editingId ? 'Update Plan' : 'Create Plan'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {plansLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : plansError ? (
          <div className="text-red-600">{plansError}</div>
        ) : plans.length === 0 ? (
          <div className="text-gray-500">No subscription plans yet.</div>
        ) : (
          <div className="flex flex-wrap gap-4 justify-center">
            {plans.map((plan, idx) => {
              // All cards use galactic style
              const cardBg = 'relative bg-gradient-to-br from-purple-900 via-indigo-800 to-fuchsia-700 text-white shadow-glow-blue overflow-hidden';
              return (
                <div
                  key={`plan-${plan.id}-${idx}`}
                  className={`w-full max-w-[170px] rounded-xl flex flex-col items-center ${cardBg} transition-transform hover:scale-105 duration-150 min-h-[200px] p-3`}
                  style={{ minWidth: 120 }}
                >
                  {/* Starfield SVG background for all cards */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 animate-pulse" viewBox="0 0 170 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="30" cy="40" r="1.2" fill="#fff" opacity="0.7" className="animate-twinkle" />
                      <circle cx="80" cy="100" r="1.5" fill="#fff" opacity="0.5" className="animate-twinkle" />
                      <circle cx="150" cy="60" r="0.8" fill="#fff" opacity="0.6" />
                      <circle cx="140" cy="160" r="1" fill="#fff" opacity="0.4" />
                      <ellipse cx="85" cy="100" rx="50" ry="18" fill="url(#nebula)" opacity="0.10" />
                      <defs>
                        <radialGradient id="nebula" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                          <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
                          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                    </svg>
                  {/* 3-dots menu at top right */}
                  <div className="absolute top-2 right-2 z-20">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded-full hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-fuchsia-400">
                          <FiMoreVertical className="text-fuchsia-200" size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(plan)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(plan.id)}>
                          Delete
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(plan.id, plan.isActive)}>
                          {plan.isActive ? 'Set Inactive' : 'Set Active'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {/* Plan Name */}
                  <div className="flex flex-col items-center mb-1 z-10">
                    <span className={`text-xs font-sci-fi font-bold uppercase tracking-widest drop-shadow-glow mb-0.5`}>{plan.name}</span>
                    <span className={`px-1 py-0.5 rounded text-[10px] font-semibold shadow ${plan.isActive ? 'bg-green-200 text-green-900' : 'bg-gray-200 text-gray-500'}`}>{plan.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  {/* Price & Duration */}
                  <div className="relative flex flex-col items-center mb-2 z-10">
                    {/* Nebula/Aurora Glow behind price */}
                      <span className="absolute -inset-1 rounded-full blur-2xl opacity-60 bg-gradient-to-r from-fuchsia-400 via-indigo-400 to-purple-400"></span>
                    <span className={`relative text-lg font-extrabold text-fuchsia-200 drop-shadow-glow`}>
                      {plan.price === 0 ? 'Free' : `$${plan.price.toFixed(2)}`}
                    </span>
                    <span className="block text-[10px] text-fuchsia-100 mt-0.5">per {plan.intervalCount} {plan.billingInterval === 'year' ? 'years' : plan.billingInterval === 'month' ? 'months' : plan.billingInterval === 'week' ? 'weeks' : 'days'}</span>
                  </div>
                  {/* Action Button */}
                  <button className="w-full py-1 rounded font-bold text-xs shadow-glow-pink transition-colors mt-1 z-10 bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-500 text-white">Get More</button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Promo Codes Section */}
      <Card className="p-2 mb-4 bg-white border border-gray-100 rounded-md shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Promo Codes</h2>
          <Dialog open={showPromoForm} onOpenChange={(open) => {
            setShowPromoForm(open);
            if (!open) { setPromoForm({ code: '', discountPercent: '', expiresAt: null, applicablePlanIds: [] }); setEditingPromoId(null); }
          }}>
            <DialogTrigger asChild>
              <Button variant="create" size="sm" className="px-1.5 py-0.5 text-[11px] font-semibold rounded shadow-glow-pink min-w-0 h-7">
                <FiPlus className="mr-1 text-xs" /> Create Promo Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>{editingPromoId ? 'Edit Promo Code' : 'Create Promo Code'}</DialogTitle>
              <DialogDescription>
                {editingPromoId ? 'Edit your promotional code details.' : 'Create a new promotional code for your subscription plans.'}
              </DialogDescription>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
                  <Input
                    name="code"
                    value={promoForm.code}
                    onChange={handlePromoInput}
                    placeholder="e.g., WELCOME20"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Percentage</label>
                  <Input
                    name="discountPercent"
                    type="number"
                    value={promoForm.discountPercent}
                    onChange={handlePromoInput}
                    placeholder="20"
                    min="1"
                    max="100"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <Input
                    name="expiresAt"
                    type="date"
                    value={promoForm.expiresAt || ''}
                    onChange={handlePromoInput}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Applicable Plans</label>
                  <div className="space-y-2">
                    {plans.map((plan) => (
                      <div key={`${plan.id}-${plan.name}`} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`plan-${plan.id}`}
                          checked={promoForm.applicablePlanIds.includes(plan.id)}
                          onChange={() => handlePromoPlanSelect(plan.id)}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor={`plan-${plan.id}`} className="text-sm">
                          {plan.name} - ${plan.price}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={handleCreatePromo} disabled={promoSaving}>
                    {promoSaving ? 'Saving...' : editingPromoId ? 'Update Promo Code' : 'Create Promo Code'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {promoCodesLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : promoCodes.length === 0 ? (
          <div className="text-gray-500 text-center py-4">No promo codes yet.</div>
        ) : (
          <div className="space-y-4">
            {promoCodes.map((promo) => (
              <div key={promo.id} className="relative bg-gradient-to-br from-purple-900 via-indigo-800 to-fuchsia-700 p-4 rounded-xl shadow-glow-blue overflow-hidden">
                {/* Starfield SVG background */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 animate-pulse" viewBox="0 0 260 340" fill="none">
                  <circle cx="40" cy="60" r="1.2" fill="#fff" opacity="0.7" className="animate-twinkle" />
                  <circle cx="120" cy="180" r="1.5" fill="#fff" opacity="0.5" className="animate-twinkle" />
                  <circle cx="200" cy="100" r="0.8" fill="#fff" opacity="0.6" />
                  <circle cx="180" cy="250" r="1" fill="#fff" opacity="0.4" />
                  <ellipse cx="130" cy="170" rx="80" ry="32" fill="url(#nebula)" opacity="0.10" />
                  <defs>
                    <radialGradient id="nebula" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                      <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                </svg>

                <div className="flex items-center justify-between relative z-10">
                  {/* 3-dots menu at top right */}
                  <div className="absolute top-0 right-0 z-20">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded-full hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-fuchsia-400">
                          <FiMoreVertical className="text-fuchsia-200" size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditPromo(promo)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeletePromo(promo.id)}>
                          Delete
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTogglePromoActive(promo.id, promo.isActive)}>
                          {promo.isActive ? 'Set Inactive' : 'Set Active'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-sci-fi font-bold text-white text-lg tracking-wider drop-shadow-glow">{promo.code}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        promo.isActive 
                          ? 'bg-green-200 text-green-900' 
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        {promo.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-sm text-fuchsia-200 mt-1 drop-shadow-glow">
                      <span className="relative">
                        <span className="absolute -inset-1 rounded-full blur-xl opacity-40 bg-gradient-to-r from-fuchsia-400 via-indigo-400 to-purple-400"></span>
                        <span className="relative">{promo.discountPercent}% off</span>
                      </span>
                      {" • "}
                      <span className="text-fuchsia-100">
                        Expires {(() => {
                          const date = getDateFromAny(promo.expiresAt);
                          return date ? date.toLocaleDateString() : 'N/A';
                        })()}
                      </span>
                    </div>
                    <div className="text-xs text-fuchsia-100/80 mt-1">
                      Applies to: {promo.applicablePlanIds.map(id => plans.find(p => p.id === id)?.name).filter(Boolean).join(', ')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
} 