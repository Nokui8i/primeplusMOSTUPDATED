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
                <button
                  onClick={() => { setForm({}); setEditingId(null); }}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-gray-200 text-black font-semibold rounded-full transition-all duration-300 hover:bg-gray-300 hover:shadow-md"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    outline: 'none',
                    fontSize: '10px',
                  }}
                >
                  <FiPlus size={12} /> CREATE PLAN
                </button>
              </DialogTrigger>
              <DialogContent 
                className="upload-container"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 248, 255, 0.95) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '24px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                  maxWidth: '500px',
                }}
              >
                <DialogTitle className="text-lg font-bold text-gray-800">{editingId ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
                <div className="space-y-2 mt-4">
                  {/* Plan Name */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-1">Plan Name</label>
                    <Input 
                      name="name" 
                      value={form.name || ''} 
                      onChange={handleInput} 
                      placeholder="e.g., Basic Plan" 
                      className="w-full"
                      style={{
                        background: 'rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '10px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                        fontSize: '11px',
                        padding: '6px 10px',
                        height: '28px',
                      }}
                    />
                  </div>

                  {/* Price */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-1">Price (USD)</label>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="radio"
                          id="plan-type-free"
                          name="planType"
                          checked={form.price === 0}
                          onChange={() => setForm(prev => ({ ...prev, price: 0 }))}
                          className="accent-blue-500 w-3 h-3"
                        />
                        <label htmlFor="plan-type-free" className="text-[10px]">Free</label>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="radio"
                          id="plan-type-paid"
                          name="planType"
                          checked={typeof form.price === 'number' && form.price > 0}
                          onChange={() => setForm(prev => ({ ...prev, price: undefined }))}
                          className="accent-blue-500 w-3 h-3"
                        />
                        <label htmlFor="plan-type-paid" className="text-[10px]">Paid</label>
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
                        className="w-20"
                        disabled={form.price === 0}
                        style={{
                          background: 'rgba(255, 255, 255, 0.9)',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          borderRadius: '10px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                          fontSize: '11px',
                          padding: '6px 10px',
                          height: '28px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-1">Duration</label>
                    <div className="flex gap-1.5">
                      <Input 
                        name="intervalCount" 
                        type="number" 
                        value={form.intervalCount || ''} 
                        onChange={handleInput} 
                        placeholder="30" 
                        min="1" 
                        className="flex-1"
                        style={{
                          background: 'rgba(255, 255, 255, 0.9)',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          borderRadius: '10px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                          fontSize: '11px',
                          padding: '6px 10px',
                          height: '28px',
                        }}
                      />
                      <select
                        name="billingInterval"
                        value={form.billingInterval || 'day'}
                        onChange={e => setForm(prev => ({ ...prev, billingInterval: e.target.value as 'day' | 'week' | 'month' | 'year' }))}
                        style={{
                          background: 'rgba(255, 255, 255, 0.9)',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          borderRadius: '10px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                          fontSize: '11px',
                          padding: '6px 10px',
                          height: '28px',
                        }}
                      >
                        <option value="day">Days</option>
                        <option value="week">Weeks</option>
                        <option value="month">Months</option>
                        <option value="year">Years</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button 
                      onClick={editingId ? handleUpdate : handleCreate} 
                      disabled={saving}
                      className="profile-btn"
                      style={{
                        border: 'none',
                        color: '#fff',
                        backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                        backgroundColor: 'transparent',
                        borderRadius: '20px',
                        backgroundSize: '100% auto',
                        fontFamily: 'inherit',
                        fontWeight: '700',
                        fontSize: '14px',
                        padding: '12px 32px',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        opacity: saving ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!saving) {
                          e.currentTarget.style.backgroundSize = '200% auto';
                          e.currentTarget.style.boxShadow = 'rgba(14, 165, 233, 0.5) 0px 0px 20px 0px';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundSize = '100% auto';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {saving ? 'Saving...' : editingId ? 'UPDATE PLAN' : 'CREATE PLAN'}
                    </button>
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
          <div className="space-y-2 max-w-full">
            {plans.map((plan, idx) => (
              <div
                key={`plan-${plan.id}-${idx}`}
                className="relative flex items-center justify-between px-5 text-white shadow-md hover:shadow-lg transition-all w-full"
                style={{ borderRadius: '20px', height: '32px', backgroundColor: '#3b82f6' }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm uppercase">{plan.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-sm whitespace-nowrap">
                    {plan.price === 0 ? 'Free' : `$${plan.price.toFixed(2)} per ${plan.billingInterval === 'year' ? 'year' : plan.billingInterval === 'month' ? 'month' : plan.billingInterval === 'week' ? 'week' : `${plan.intervalCount} days`}`}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="px-3 py-1.5 rounded-full flex items-center justify-center focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none bg-white/20 hover:bg-white/30 transition-all duration-200">
                        <FiMoreVertical className="text-white h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end" 
                      className="w-36 bg-white border-0 overflow-hidden p-0"
                      style={{
                        borderRadius: '10px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      }}
                    >
                      <DropdownMenuItem 
                        onClick={() => handleEdit(plan)}
                        className="cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
                        style={{ fontWeight: '500', fontSize: '12px' }}
                      >
                        <FiEdit className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleToggleActive(plan.id, plan.isActive)}
                        className="cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
                        style={{ fontWeight: '500', fontSize: '12px' }}
                      >
                        <div className={`mr-2 h-2 w-2 rounded-full ${plan.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        {plan.isActive ? 'Set Inactive' : 'Set Active'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(plan.id)}
                        className="cursor-pointer py-1.5 px-2.5 text-red-500 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all duration-200"
                        style={{ fontWeight: '500', fontSize: '12px' }}
                      >
                        <FiTrash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
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
              <button
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-gray-200 text-black font-semibold rounded-full transition-all duration-300 hover:bg-gray-300 hover:shadow-md"
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  outline: 'none',
                  fontSize: '10px',
                }}
              >
                <FiPlus size={12} /> CREATE PROMO CODE
              </button>
            </DialogTrigger>
            <DialogContent 
              className="upload-container"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 248, 255, 0.95) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '24px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                maxWidth: '500px',
              }}
            >
              <DialogTitle className="text-lg font-bold text-gray-800">{editingPromoId ? 'Edit Promo Code' : 'Create Promo Code'}</DialogTitle>
              <div className="space-y-2 mt-4">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Promo Code</label>
                  <Input
                    name="code"
                    value={promoForm.code}
                    onChange={handlePromoInput}
                    placeholder="e.g., WELCOME20"
                    className="w-full"
                    style={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '10px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                      fontSize: '11px',
                      padding: '6px 10px',
                      height: '28px',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Discount Percentage</label>
                  <Input
                    name="discountPercent"
                    type="number"
                    value={promoForm.discountPercent}
                    onChange={handlePromoInput}
                    placeholder="20"
                    min="1"
                    max="100"
                    className="w-full"
                    style={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '10px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                      fontSize: '11px',
                      padding: '6px 10px',
                      height: '28px',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Expiry Date</label>
                  <Input
                    name="expiresAt"
                    type="date"
                    value={promoForm.expiresAt || ''}
                    onChange={handlePromoInput}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full"
                    style={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '10px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                      fontSize: '11px',
                      padding: '6px 10px',
                      height: '28px',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1.5">Applicable Plans</label>
                  <div className="space-y-1.5">
                    {plans.map((plan) => (
                      <div key={`${plan.id}-${plan.name}`} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`plan-${plan.id}`}
                          checked={promoForm.applicablePlanIds.includes(plan.id)}
                          onChange={() => handlePromoPlanSelect(plan.id)}
                          className="rounded border-gray-300 w-3.5 h-3.5 accent-blue-500"
                        />
                        <label htmlFor={`plan-${plan.id}`} className="text-[11px] text-gray-700">
                          {plan.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button 
                    onClick={handleCreatePromo} 
                    disabled={promoSaving}
                    className="profile-btn"
                    style={{
                      border: 'none',
                      color: '#fff',
                      backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                      backgroundColor: 'transparent',
                      borderRadius: '20px',
                      backgroundSize: '100% auto',
                      fontFamily: 'inherit',
                      fontWeight: '700',
                      fontSize: '14px',
                      padding: '12px 32px',
                      cursor: promoSaving ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      opacity: promoSaving ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!promoSaving) {
                        e.currentTarget.style.backgroundSize = '200% auto';
                        e.currentTarget.style.boxShadow = 'rgba(14, 165, 233, 0.5) 0px 0px 20px 0px';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundSize = '100% auto';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {promoSaving ? 'Saving...' : editingPromoId ? 'UPDATE PROMO CODE' : 'CREATE PROMO CODE'}
                  </button>
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
          <div className="space-y-2 max-w-full">
            {promoCodes.map((promo) => (
              <div
                key={promo.id}
                className="relative flex items-center justify-between px-5 text-white shadow-md hover:shadow-lg transition-all w-full"
                style={{ 
                  borderRadius: '20px', 
                  height: '32px', 
                  backgroundColor: '#3b82f6'
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm uppercase">{promo.code}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-sm whitespace-nowrap">
                    {promo.discountPercent}% off • Expires {(() => {
                      const date = getDateFromAny(promo.expiresAt);
                      return date ? date.toLocaleDateString() : 'N/A';
                    })()}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="px-3 py-1.5 rounded-full flex items-center justify-center focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none bg-white/20 hover:bg-white/30 transition-all duration-200">
                        <FiMoreVertical className="text-white h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end" 
                      className="w-36 bg-white border-0 overflow-hidden p-0"
                      style={{
                        borderRadius: '10px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      }}
                    >
                      <DropdownMenuItem 
                        onClick={() => handleEditPromo(promo)}
                        className="cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
                        style={{ fontWeight: '500', fontSize: '12px' }}
                      >
                        <FiEdit className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleTogglePromoActive(promo.id, promo.isActive)}
                        className="cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
                        style={{ fontWeight: '500', fontSize: '12px' }}
                      >
                        <div className={`mr-2 h-2 w-2 rounded-full ${promo.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        {promo.isActive ? 'Set Inactive' : 'Set Active'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeletePromo(promo.id)}
                        className="cursor-pointer py-1.5 px-2.5 text-red-500 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all duration-200"
                        style={{ fontWeight: '500', fontSize: '12px' }}
                      >
                        <FiTrash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
} 