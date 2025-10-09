"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, addDoc, query, where, deleteDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { FiRefreshCw, FiUsers, FiFileText, FiUserX, FiUserCheck } from 'react-icons/fi';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface PendingApplication {
  id: string;
  userId: string;
  status: string;
  displayName?: string;
  email?: string;
  idDocumentUrl?: string;
  taxInfo?: string;
  submittedAt?: string;
}

const STATUS_TABS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

const ADMIN_TABS = [
  { label: 'Applications', value: 'applications' },
  { label: 'Users', value: 'users' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [adminTab, setAdminTab] = useState<'applications' | 'users'>('applications');
  const [allApplications, setAllApplications] = useState<PendingApplication[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [detailsApp, setDetailsApp] = useState<PendingApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableRefreshing, setTableRefreshing] = useState(false);
  const [appsDropdownOpen, setAppsDropdownOpen] = useState(false);
  const [usersDropdownOpen, setUsersDropdownOpen] = useState(false);
  const appsDropdownRef = useRef<HTMLDivElement>(null);
  const usersDropdownRef = useRef<HTMLDivElement>(null);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  // Dropdown close delay timers
  const appsDropdownTimeout = useRef<NodeJS.Timeout | null>(null);
  const usersDropdownTimeout = useRef<NodeJS.Timeout | null>(null);
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);
  const [roleUpdateMsg, setRoleUpdateMsg] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [confirmRoleChange, setConfirmRoleChange] = useState<{ userId: string; newRole: string; username: string } | null>(null);
  const [userActionModal, setUserActionModal] = useState<any | null>(null);
  const [banUpdating, setBanUpdating] = useState(false);
  const [banMsg, setBanMsg] = useState<string | null>(null);
  const [banDuration, setBanDuration] = useState<string>('');
  const [downgradeUpdating, setDowngradeUpdating] = useState(false);
  const [downgradeMsg, setDowngradeMsg] = useState<string | null>(null);
  const [downgradeDuration, setDowngradeDuration] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const functions = getFunctions(app);
  const resetUserPassword = httpsCallable(functions, 'resetUserPassword');
  const forceLogoutUser = httpsCallable(functions, 'forceLogoutUser');
  const changeUserDisplayName = httpsCallable(functions, 'changeUserDisplayName');
  const [supportMsg, setSupportMsg] = useState<string | null>(null);
  const [displayNameEdit, setDisplayNameEdit] = useState<string>('');
  const [supportLoading, setSupportLoading] = useState(false);

  const fetchApplications = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setTableRefreshing(true);
    }
    const db = getFirestore(app);
    const applicationsSnapshot = await getDocs(collection(db, 'verificationData'));
    const apps: PendingApplication[] = [];
    for (const docSnap of applicationsSnapshot.docs) {
      const data = docSnap.data();
      let displayName = '';
      let email = '';
      try {
        const userDoc = await getDoc(doc(db, 'users', data.userId));
        const userInfo = userDoc.data();
        displayName = userInfo?.displayName || '';
        email = userInfo?.email || '';
      } catch {}
      apps.push({
        id: docSnap.id,
        userId: data.userId,
        status: data.status,
        displayName,
        email,
        idDocumentUrl: data.idDocumentUrl,
        taxInfo: data.taxInfo,
        submittedAt: data.submittedAt,
      });
    }
    setAllApplications(apps);
    if (isInitial) {
      setLoading(false);
    } else {
      setTableRefreshing(false);
    }
  };

  useEffect(() => {
    const checkAdminAccessAndFetch = async () => {
      setLoading(true);
      const auth = getAuth(app);
      const user = auth.currentUser;
      if (!user) {
        router.push('/login');
        return;
      }
      const db = getFirestore(app);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      if (!userData || (userData.role !== 'admin' && userData.role !== 'owner' && userData.role !== 'superadmin')) {
        router.push('/');
        return;
      }
      await fetchApplications(true);
    };
    checkAdminAccessAndFetch();
  }, [router]);

  const filteredApplications = allApplications.filter(app => app.status === selectedStatus);

  const handleApprove = async (application: PendingApplication) => {
    setActionLoading(application.id);
    setError(null);
    setSuccess(null);
    try {
      const db = getFirestore(app);
      // Update user role and verification status
      const userRef = doc(db, 'users', application.userId);
      await updateDoc(userRef, { 
        role: 'creator', 
        verificationStatus: 'verified',
        isVerified: true  // Set isVerified flag
      });
      // Update application status
      const appRef = doc(db, 'verificationData', application.id);
      await updateDoc(appRef, { status: 'approved' });
      setSuccess('Application approved.');
      await fetchApplications(false);
      // Notify user
      try {
        await sendNotification({
          userId: application.userId,
          type: 'creator_approved',
          message: 'Creator Verification was approved by the system.',
          metadata: {
            fromSystem: true
          }
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
        setError('Application approved, but failed to send notification.');
      }
    } catch (err) {
      setError('Failed to approve application.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (application: PendingApplication) => {
    setActionLoading(application.id);
    setError(null);
    setSuccess(null);
    try {
      const db = getFirestore(app);
      // Update application status
      const appRef = doc(db, 'verificationData', application.id);
      await updateDoc(appRef, { status: 'rejected' });
      // Update user's verificationStatus and clear verificationData
      const userRef = doc(db, 'users', application.userId);
      await updateDoc(userRef, { verificationStatus: 'unverified', verificationData: null });
      // Delete verification files and data
      await fetch('https://us-central1-primeplus-11a85.cloudfunctions.net/deleteCreatorVerificationDataHttp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: application.userId }),
      });
      setSuccess('Application rejected.');
      await fetchApplications(false);
      // Notify user
      try {
        await sendNotification({
          userId: application.userId,
          type: 'creator_rejected',
          message: 'Creator Verification was rejected by the system.',
          metadata: {
            fromSystem: true
          }
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
        setError('Application rejected, but failed to send notification.');
      }
    } catch (err) {
      setError('Failed to reject application.');
    } finally {
      setActionLoading(null);
    }
  };

  // Fetch users (only when users tab is selected)
  useEffect(() => {
    if (adminTab !== 'users') return;
    const fetchUsers = async () => {
      setLoading(true);
      const db = getFirestore(app);
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users: any[] = [];
      usersSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        users.push({
          id: docSnap.id,
          username: data.username || '',
          email: data.email || '',
          role: (typeof data.role === 'string' ? data.role.trim() : 'user'),
          status: data.isActive === false ? 'banned' : 'active',
          createdAt: data.createdAt || '',
        });
      });
      setAllUsers(users);
      setLoading(false);
    };
    fetchUsers();
  }, [adminTab]);

  // User table filtering and pagination
  const filteredUsers = allUsers.filter(u =>
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };
  const getCreatedAtString = (obj: any) => {
    if (!obj.createdAt) return '';
    if (typeof obj.createdAt === 'string') return obj.createdAt;
    if (obj.createdAt.toDate) return obj.createdAt.toDate().toISOString(); // Firestore Timestamp
    if (obj.createdAt instanceof Date) return obj.createdAt.toISOString();
    return String(obj.createdAt);
  };
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortField === 'createdAt') {
      return sortOrder === 'asc'
        ? getCreatedAtString(a).localeCompare(getCreatedAtString(b))
        : getCreatedAtString(b).localeCompare(getCreatedAtString(a));
    }
    return sortOrder === 'asc'
      ? (a[sortField] || '').localeCompare(b[sortField] || '')
      : (b[sortField] || '').localeCompare(a[sortField] || '');
  });
  const paginatedUsers = sortedUsers.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        appsDropdownRef.current &&
        !appsDropdownRef.current.contains(e.target as Node)
      ) {
        setAppsDropdownOpen(false);
      }
      if (
        usersDropdownRef.current &&
        !usersDropdownRef.current.contains(e.target as Node)
      ) {
        setUsersDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch current user info and role on mount
  useEffect(() => {
    const fetchCurrentUserRole = async () => {
      const auth = getAuth(app);
      const user = auth.currentUser;
      if (!user) return;
      const db = getFirestore(app);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      setCurrentUser(user);
      setCurrentUserRole(userData?.role || null);
    };
    fetchCurrentUserRole();
  }, []);

  // Replace isOwner and isSuperadmin with direct checks
  const isOwner = currentUserRole === 'owner';
  const isSuperadmin = currentUserRole === 'superadmin';

  const handleChangeUserRole = (userId: string, newRole: string, username: string) => {
    setConfirmRoleChange({ userId, newRole, username });
  };

  const roleRank = (role: string) => {
    switch (role) {
      case 'owner': return 4;
      case 'superadmin': return 3;
      case 'admin': return 2;
      case 'creator': return 1;
      case 'user': return 0;
      default: return -1;
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!confirmRoleChange) return;
    const { userId, newRole, username } = confirmRoleChange;
    setRoleUpdating(userId);
    setRoleUpdateMsg(null);
    setConfirmRoleChange(null);
    try {
      const targetUser = allUsers.find(u => u.id === userId);
      const currentRole = currentUserRole;
      // Prevent demoting the last owner
      if (targetUser?.role === 'owner' && newRole !== 'owner') {
        const ownerCount = allUsers.filter(u => u.role === 'owner').length;
        if (ownerCount === 1) {
          setRoleUpdateMsg('Cannot demote the last owner.');
          setRoleUpdating(null);
          return;
        }
      }
      // Only owner can promote/demote owner or superadmin
      if ((targetUser?.role === 'owner' || newRole === 'owner' || targetUser?.role === 'superadmin' || newRole === 'superadmin') && !isOwner) {
        setRoleUpdateMsg('Only the owner can change owner or superadmin roles.');
        setRoleUpdating(null);
        return;
      }
      // Superadmin can manage admins/creators/users, but not owners or other superadmins
      if (isSuperadmin && !isOwner) {
        if (roleRank(targetUser?.role) >= 3 || roleRank(newRole) >= 3) {
          setRoleUpdateMsg('Superadmins cannot manage owners or other superadmins.');
          setRoleUpdating(null);
          return;
        }
      }
      // Admins cannot promote/demote admins, superadmins, or owners
      if (currentRole === 'admin') {
        if (roleRank(targetUser?.role) >= 2 || roleRank(newRole) >= 2) {
          setRoleUpdateMsg('Admins cannot manage admins, superadmins, or owners.');
          setRoleUpdating(null);
          return;
        }
      }
      const db = getFirestore(app);
      const previousRole = targetUser?.role;
      
      // If setting role to 'creator', automatically verify them
      const updateData: any = { role: newRole };
      if (newRole === 'creator') {
        updateData.isVerified = true;
        updateData.verificationStatus = 'verified';
      }
      
      await updateDoc(doc(db, 'users', userId), updateData);
      setAllUsers((prev) => prev.map(u => u.id === userId ? { ...u, role: newRole, isVerified: newRole === 'creator' ? true : u.isVerified } : u));
      setRoleUpdateMsg('Role updated successfully.' + (newRole === 'creator' ? ' User is now verified.' : ''));
      // Log to audit log
      await addDoc(collection(db, 'auditLogs'), {
        action: 'role_changed',
        userId,
        previousRole,
        newRole,
        performedBy: currentUser?.email || currentUser?.uid,
        timestamp: new Date().toISOString(),
        metadata: {
          username,
          reason: 'admin_action'
        }
      });
    } catch (err) {
      setRoleUpdateMsg('Failed to update role.');
    } finally {
      setRoleUpdating(null);
      setTimeout(() => setRoleUpdateMsg(null), 2000);
    }
  };

  const openUserActionModal = (user: any) => {
    setUserActionModal(user);
    setBanDuration('');
    setBanMsg(null);
  };
  const closeUserActionModal = () => {
    setUserActionModal(null);
    setBanDuration('');
    setBanMsg(null);
  };

  const handleModalRoleChange = (newRole: string) => {
    handleChangeUserRole(userActionModal.id, newRole, userActionModal.username);
    setUserActionModal((prev: any) => ({ ...prev, role: newRole }));
  };

  const handleBanUser = async (userId: string, duration: string) => {
    setBanUpdating(true);
    setBanMsg(null);
    try {
      const db = getFirestore(app);
      let banUntil = null;
      if (duration === '1d') banUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      else if (duration === '7d') banUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      else if (duration === '30d') banUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      else if (duration === 'perm') banUntil = null;
      else if (duration === 'custom' && banDuration) banUntil = new Date(banDuration);
      await updateDoc(doc(db, 'users', userId), {
        isActive: false,
        banUntil: banUntil ? banUntil.toISOString() : null,
      });
      setAllUsers((prev) => prev.map(u => u.id === userId ? { ...u, status: 'banned', banUntil: banUntil ? banUntil.toISOString() : null } : u));
      setBanMsg('User banned successfully.');
      setUserActionModal((prev: any) => prev ? { ...prev, status: 'banned', banUntil: banUntil ? banUntil.toISOString() : null } : prev);

      // Log to audit log
      await addDoc(collection(db, 'auditLogs'), {
        action: 'user_banned',
        userId,
        performedBy: currentUser?.email || currentUser?.uid,
        timestamp: new Date().toISOString(),
        metadata: {
          duration,
          banUntil: banUntil ? banUntil.toISOString() : null,
          reason: 'admin_action'
        }
      });
    } catch (err) {
      setBanMsg('Failed to ban user.');
    } finally {
      setBanUpdating(false);
      setTimeout(() => setBanMsg(null), 2000);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    setBanUpdating(true);
    setBanMsg(null);
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'users', userId), {
        isActive: true,
        banUntil: null,
      });
      setAllUsers((prev) => prev.map(u => u.id === userId ? { ...u, status: 'active', banUntil: null } : u));
      setBanMsg('User unbanned successfully.');
      setUserActionModal((prev: any) => prev ? { ...prev, status: 'active', banUntil: null } : prev);

      // Log to audit log
      await addDoc(collection(db, 'auditLogs'), {
        action: 'user_unbanned',
        userId,
        performedBy: currentUser?.email || currentUser?.uid,
        timestamp: new Date().toISOString(),
        metadata: {
          reason: 'admin_action'
        }
      });
    } catch (err) {
      setBanMsg('Failed to unban user.');
    } finally {
      setBanUpdating(false);
      setTimeout(() => setBanMsg(null), 2000);
    }
  };

  const handleDowngradeUser = async (user: any, duration: string) => {
    // Prevent owner from downgrading themselves
    if (user.role === 'owner' && user.id === currentUser?.uid) {
      setDowngradeMsg('Owner cannot downgrade themselves.');
      setDowngradeUpdating(false);
      setTimeout(() => setDowngradeMsg(null), 2000);
      return;
    }
    setDowngradeUpdating(true);
    setDowngradeMsg(null);
    try {
      const db = getFirestore(app);
      let downgradeUntil = null;
      if (duration === '1d') downgradeUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      else if (duration === '7d') downgradeUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      else if (duration === '30d') downgradeUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      else if (duration === 'custom' && downgradeDuration) downgradeUntil = new Date(downgradeDuration);
      await updateDoc(doc(db, 'users', user.id), {
        role: 'user',
        downgradedFrom: user.role,
        downgradeUntil: downgradeUntil ? downgradeUntil.toISOString() : null,
        verificationStatus: 'unverified',
        verificationData: null
      });
      setAllUsers((prev) => prev.map(u => u.id === user.id ? { ...u, role: 'user', downgradedFrom: user.role, downgradeUntil: downgradeUntil ? downgradeUntil.toISOString() : null } : u));
      setDowngradeMsg('User downgraded successfully.');
      setUserActionModal((prev: any) => prev ? { ...prev, role: 'user', downgradedFrom: user.role, downgradeUntil: downgradeUntil ? downgradeUntil.toISOString() : null } : prev);

      // Log to audit log
      await addDoc(collection(db, 'auditLogs'), {
        action: 'user_downgraded',
        userId: user.id,
        previousRole: user.role,
        newRole: 'user',
        performedBy: currentUser?.email || currentUser?.uid,
        timestamp: new Date().toISOString(),
        metadata: {
          duration,
          downgradeUntil: downgradeUntil ? downgradeUntil.toISOString() : null,
          reason: 'admin_action'
        }
      });
      // Always delete their verification files and application(s)
      try {
        await fetch('https://us-central1-primeplus-11a85.cloudfunctions.net/deleteCreatorVerificationDataHttp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
        const q = query(collection(db, 'verificationData'), where('userId', '==', user.id));
        const snap = await getDocs(q);
        for (const doc of snap.docs) {
          await deleteDoc(doc.ref);
        }
      } catch (err) {
        // Ignore errors, but could log if needed
      }
    } catch (err) {
      setDowngradeMsg('Failed to downgrade user.');
    } finally {
      setDowngradeUpdating(false);
      setTimeout(() => setDowngradeMsg(null), 2000);
    }
  };

  // Support actions
  const handleResetPassword = async (user: any) => {
    setSupportLoading(true);
    setSupportMsg(null);
    try {
      await resetUserPassword({ userId: user.id, email: user.email });
      setSupportMsg('Password reset email sent.');
    } catch (err: any) {
      setSupportMsg('Failed to send reset email.');
    } finally {
      setSupportLoading(false);
      setTimeout(() => setSupportMsg(null), 3000);
    }
  };
  const handleForceLogout = async (user: any) => {
    setSupportLoading(true);
    setSupportMsg(null);
    try {
      await forceLogoutUser({ userId: user.id });
      setSupportMsg('User logged out everywhere.');
    } catch (err: any) {
      setSupportMsg('Failed to force logout.');
    } finally {
      setSupportLoading(false);
      setTimeout(() => setSupportMsg(null), 3000);
    }
  };
  const handleChangeDisplayName = async (user: any) => {
    setSupportLoading(true);
    setSupportMsg(null);
    try {
      await changeUserDisplayName({ userId: user.id, newDisplayName: displayNameEdit });
      setSupportMsg('Display name updated.');
      setAllUsers((prev) => prev.map(u => u.id === user.id ? { ...u, displayName: displayNameEdit } : u));
    } catch (err: any) {
      setSupportMsg('Failed to update display name.');
    } finally {
      setSupportLoading(false);
      setTimeout(() => setSupportMsg(null), 3000);
    }
  };

  const handleResetVerification = async (user: any) => {
    setSupportLoading(true);
    setSupportMsg(null);
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'users', user.id), {
        verificationStatus: 'unverified',
        verificationData: null
      });
      // Delete verification files and application
      await fetch('https://us-central1-primeplus-11a85.cloudfunctions.net/deleteCreatorVerificationDataHttp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      setSupportMsg('Verification reset successfully.');
      setUserActionModal((prev: any) => prev ? { ...prev, verificationStatus: 'unverified', verificationData: null } : prev);
    } catch (err: any) {
      setSupportMsg('Failed to reset verification.');
    } finally {
      setSupportLoading(false);
      setTimeout(() => setSupportMsg(null), 3000);
    }
  };

  async function sendNotification({ userId, type, message, metadata }: { userId: string, type: string, message: string, metadata?: any }) {
    const response = await fetch('https://us-central1-primeplus-11a85.cloudfunctions.net/sendNotificationHttp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type, message, metadata }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to send notification');
    }
    return response.json();
  }

  if (loading) {
    return <div className="text-black">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto py-8 text-black min-h-[70vh]">
      {/* Modern Horizontal Admin Tabs with Dropdowns */}
      <nav className="flex items-center gap-3 mb-6 border-b border-gray-100 bg-white/80 backdrop-blur rounded-xl shadow-md px-2 py-1 sticky top-0 z-30 transition-all">
        <h2 className="text-base font-bold mr-4 tracking-tight">Admin</h2>
        {/* Applications Dropdown */}
        <div
          className="relative"
          ref={appsDropdownRef}
          onMouseEnter={() => {
            if (appsDropdownTimeout.current) clearTimeout(appsDropdownTimeout.current);
            setAppsDropdownOpen(true);
          }}
          onMouseLeave={() => {
            appsDropdownTimeout.current = setTimeout(() => setAppsDropdownOpen(false), 180);
          }}
        >
          <button
            type="button"
            className={`flex items-center gap-1 px-2 py-1 rounded-full font-semibold text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${adminTab === 'applications' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-indigo-50 text-gray-700'}`}
            onClick={() => {
              setAppsDropdownOpen((open) => !open);
              setUsersDropdownOpen(false);
              setAdminTab('applications');
            }}
          >
            <FiFileText className="text-sm" />
            <span className="font-medium">Applications</span>
            <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div
            className={`absolute left-0 mt-2 w-48 bg-white/95 rounded-xl shadow-xl z-20 border border-gray-100 flex flex-col transition-all duration-200 ${appsDropdownOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
            style={{ minWidth: '10rem' }}
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`flex items-center gap-2 px-3 py-1 text-sm rounded-lg text-left transition-all duration-150 ${selectedStatus === tab.value ? 'bg-indigo-100 text-indigo-700 font-bold' : 'hover:bg-indigo-50 text-gray-700'} active:scale-95`}
                onClick={() => {
                  setSelectedStatus(tab.value as 'pending' | 'approved' | 'rejected');
                  setAppsDropdownOpen(false);
                  setAdminTab('applications');
                }}
              >
                {tab.value === 'pending' && <FiFileText className="text-sm" />}
                {tab.value === 'approved' && <FiUserCheck className="text-sm" />}
                {tab.value === 'rejected' && <FiUserX className="text-sm" />}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {/* Users Dropdown */}
        <div
          className="relative"
          ref={usersDropdownRef}
          onMouseEnter={() => {
            if (usersDropdownTimeout.current) clearTimeout(usersDropdownTimeout.current);
            setUsersDropdownOpen(true);
          }}
          onMouseLeave={() => {
            usersDropdownTimeout.current = setTimeout(() => setUsersDropdownOpen(false), 180);
          }}
        >
          <button
            type="button"
            className={`flex items-center gap-1 px-2 py-1 rounded-full font-semibold text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${adminTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-indigo-50 text-gray-700'}`}
            onClick={() => {
              setUsersDropdownOpen((open) => !open);
              setAppsDropdownOpen(false);
              setAdminTab('users');
            }}
          >
            <FiUsers className="text-sm" />
            <span className="font-medium">Users</span>
            <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div
            className={`absolute left-0 mt-2 w-40 bg-white/95 rounded-xl shadow-xl z-20 border border-gray-100 flex flex-col transition-all duration-200 ${usersDropdownOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
            style={{ minWidth: '8rem' }}
          >
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1 text-sm rounded-lg text-left hover:bg-indigo-50 text-gray-700 active:scale-95"
              onClick={() => {
                setAdminTab('users');
                setUsersDropdownOpen(false);
              }}
            >
              <FiUsers className="text-sm" />
              All Users
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1 text-sm rounded-lg text-left hover:bg-indigo-50 text-gray-700 opacity-60 cursor-not-allowed"
              disabled
            >
              <FiUserX className="text-sm" />
              Banned Users (coming soon)
            </button>
          </div>
        </div>
        {/* Section heading/description */}
        <div className="ml-6 flex flex-col justify-center min-w-[180px]">
          <span className="font-semibold text-gray-800 text-sm leading-tight">Admin Dashboard</span>
          {adminTab === 'applications' && (
            <span className="text-xs text-gray-500 leading-tight">Review and manage creator applications.</span>
          )}
          {adminTab === 'users' && (
            <span className="text-xs text-gray-500 leading-tight">View and manage all users on the platform.</span>
          )}
        </div>
      </nav>
      {/* Main Content */}
      <div className="">
        {adminTab === 'applications' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div></div>
              <button
                type="button"
                onClick={() => fetchApplications(false)}
                className="p-2 rounded hover:bg-gray-200 transition-colors"
                aria-label="Refresh applications"
                disabled={tableRefreshing}
              >
                {tableRefreshing ? (
                  <svg className="animate-spin h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l5-5-5-5v4a10 10 0 00-10 10h4z"></path>
                  </svg>
                ) : (
                  <FiRefreshCw className="h-5 w-5 text-gray-700" />
                )}
              </button>
            </div>
            {error && <div className="mb-4" style={{ color: '#b91c1c' }}>{error}</div>}
            {success && <div className="mb-4" style={{ color: '#15803d' }}>{success}</div>}
            <div className="relative overflow-x-auto max-h-[60vh]">
              <table className="min-w-full bg-white border rounded-lg overflow-hidden text-sm">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr>
                    <th className="px-3 py-2 border-b">User</th>
                    <th className="px-3 py-2 border-b">Email</th>
                    <th className="px-3 py-2 border-b">ID Document</th>
                    <th className="px-3 py-2 border-b">Tax Info</th>
                    <th className="px-3 py-2 border-b">Submitted</th>
                    <th className="px-3 py-2 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8">No {selectedStatus} applications.</td>
                    </tr>
                  ) : (
                    filteredApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 border-b whitespace-nowrap">{app.displayName || app.userId}</td>
                        <td className="px-3 py-2 border-b whitespace-nowrap">{app.email}</td>
                        <td className="px-3 py-2 border-b whitespace-nowrap">
                          {app.idDocumentUrl ? (
                            <a href={app.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#2563eb' }}>View</a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2 border-b whitespace-nowrap">{app.taxInfo || '—'}</td>
                        <td className="px-3 py-2 border-b whitespace-nowrap">{app.submittedAt ? new Date(app.submittedAt).toLocaleString() : '—'}</td>
                        <td className="px-3 py-2 border-b whitespace-nowrap flex flex-col gap-2">
                          <button
                            className="bg-gray-300 text-black px-2 py-1 rounded mb-1 border border-gray-400 hover:bg-gray-200 text-xs"
                            onClick={() => setDetailsApp(app)}
                          >
                            View Details
                          </button>
                          {selectedStatus === 'pending' && (
                            <>
                              <button
                                className="bg-green-600 text-white px-3 py-1 rounded mr-2 disabled:opacity-50 text-xs"
                                onClick={() => handleApprove(app)}
                                disabled={actionLoading === app.id}
                              >
                                Approve
                              </button>
                              <button
                                className="bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50 text-xs"
                                onClick={() => handleReject(app)}
                                disabled={actionLoading === app.id}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {tableRefreshing && (
                <div className="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center z-10">
                  <svg className="animate-spin h-8 w-8 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l5-5-5-5v4a10 10 0 00-10 10h4z"></path>
                  </svg>
                </div>
              )}
            </div>
            {/* Details Modal (scaffold, to be implemented) */}
            {detailsApp && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-lg w-full text-black relative">
                  <button className="absolute top-2 right-2 text-xl" onClick={() => setDetailsApp(null)}>&times;</button>
                  <h2 className="text-xl font-bold mb-4">Application Details</h2>
                  <div className="mb-2"><strong>User:</strong> {detailsApp.displayName || detailsApp.userId}</div>
                  <div className="mb-2"><strong>Email:</strong> {detailsApp.email}</div>
                  <div className="mb-2"><strong>Status:</strong> {detailsApp.status}</div>
                  <div className="mb-2"><strong>Tax Info:</strong> {detailsApp.taxInfo || '—'}</div>
                  <div className="mb-2"><strong>Submitted:</strong> {detailsApp.submittedAt ? new Date(detailsApp.submittedAt).toLocaleString() : '—'}</div>
                  <div className="mb-2">
                    <strong>ID Document:</strong> {detailsApp.idDocumentUrl ? (
                      <a href={detailsApp.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#2563eb' }}>View Document</a>
                    ) : '—'}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {adminTab === 'users' && (
          <>
            <div className="flex items-center mb-4">
              <input
                type="text"
                placeholder="Search by username or email..."
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-64 mr-4"
              />
              <span className="text-sm text-gray-500">{filteredUsers.length} users</span>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="min-w-full bg-white border rounded-lg overflow-hidden text-sm">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr>
                    <th className="px-3 py-2 border-b cursor-pointer select-none" onClick={() => handleSort('username')}>
                      Username {sortField === 'username' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-3 py-2 border-b cursor-pointer select-none" onClick={() => handleSort('email')}>
                      Email {sortField === 'email' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-3 py-2 border-b cursor-pointer select-none" onClick={() => handleSort('role')}>
                      Role {sortField === 'role' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-3 py-2 border-b">Status</th>
                    <th className="px-3 py-2 border-b cursor-pointer select-none" onClick={() => handleSort('createdAt')}>
                      Created At {sortField === 'createdAt' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-3 py-2 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8">No users found.</td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 border-b whitespace-nowrap">{user.username}</td>
                        <td className="px-3 py-2 border-b whitespace-nowrap">{user.email}</td>
                        <td className="px-3 py-2 border-b whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <select
                              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                              value={user.role}
                              disabled={roleUpdating === user.id ||
                                // Only owner can change owner/superadmin roles
                                ((user.role === 'owner' || user.role === 'superadmin' || user.id === currentUser?.uid) && !isOwner) ||
                                // Superadmin cannot change owner/superadmin
                                (isSuperadmin && !isOwner && (roleRank(user.role) >= 3)) ||
                                // Admin cannot change admin/superadmin/owner
                                (currentUserRole === 'admin' && roleRank(user.role) >= 2)
                              }
                              onChange={e => handleChangeUserRole(user.id, e.target.value, user.username)}
                            >
                              <option value="user">User</option>
                              <option value="creator">Creator</option>
                              <option value="admin" disabled={(!isOwner && !isSuperadmin)}>Admin</option>
                              <option value="superadmin" disabled={!isOwner}>Superadmin</option>
                              <option value="owner" disabled={!isOwner}>Owner</option>
                            </select>
                            {roleUpdating === user.id && (
                              <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l5-5-5-5v4a10 10 0 00-10 10h4z"></path>
                              </svg>
                            )}
                            <button
                              className="px-2 py-1 rounded bg-indigo-100 text-indigo-700 text-xs border border-indigo-200 hover:bg-indigo-200"
                              onClick={() => openUserActionModal(user)}
                              type="button"
                            >
                              Actions
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 border-b whitespace-nowrap">{user.status}</td>
                        <td className="px-3 py-2 border-b whitespace-nowrap">{user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</td>
                        <td className="px-3 py-2 border-b whitespace-nowrap">{/* Actions to be implemented */}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 gap-2 text-sm">
                <span>
                  Showing {(userPage - 1) * USERS_PER_PAGE + 1} - {Math.min(userPage * USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1 rounded border border-gray-300 bg-white text-black disabled:opacity-50"
                    onClick={() => setUserPage(p => Math.max(1, p - 1))}
                    disabled={userPage === 1}
                  >
                    Prev
                  </button>
                  <span>Page {userPage} of {totalPages}</span>
                  <button
                    type="button"
                    className="px-3 py-1 rounded border border-gray-300 bg-white text-black disabled:opacity-50"
                    onClick={() => setUserPage(p => Math.min(totalPages, p + 1))}
                    disabled={userPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            {/* Show global role update message if present */}
            {roleUpdateMsg && <div className="mb-2 text-xs text-center text-green-700">{roleUpdateMsg}</div>}
            {/* Confirmation Dialog */}
            {confirmRoleChange && (
              <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-xs w-full text-center">
                  <h3 className="font-semibold mb-2">Confirm Role Change</h3>
                  <p className="mb-4 text-sm">Change role of <span className="font-bold">{confirmRoleChange.username}</span> to <span className="font-bold">{confirmRoleChange.newRole}</span>?</p>
                  <div className="flex justify-center gap-4">
                    <button
                      className="px-4 py-1 rounded bg-gray-200 text-gray-800 font-medium"
                      onClick={() => setConfirmRoleChange(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-4 py-1 rounded bg-indigo-600 text-white font-medium"
                      onClick={handleConfirmRoleChange}
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* User Action Modal */}
            {userActionModal && (
              <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
                  <div className="mb-4">
                    <h3 className="font-semibold text-lg mb-1">User Actions</h3>
                    <div className="text-xs text-gray-500 mb-2">{userActionModal.email}</div>
                    <div className="flex flex-col gap-1 text-sm">
                      <div><span className="font-medium">Username:</span> {userActionModal.username}</div>
                      <div><span className="font-medium">Role:</span> {userActionModal.role}</div>
                      <div><span className="font-medium">Status:</span> {userActionModal.status}</div>
                      <div><span className="font-medium">Created At:</span> {userActionModal.createdAt ? new Date(userActionModal.createdAt).toLocaleString() : '—'}</div>
                      {userActionModal.banUntil && (
                        <div><span className="font-medium">Ban Until:</span> {new Date(userActionModal.banUntil).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium mb-1">Change Role</label>
                    <select
                      className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                      value={userActionModal.role}
                      disabled={roleUpdating === userActionModal.id ||
                        ((userActionModal.role === 'owner' || userActionModal.role === 'superadmin' || userActionModal.id === currentUser?.uid) && !isOwner) ||
                        (isSuperadmin && !isOwner && (roleRank(userActionModal.role) >= 3)) ||
                        (currentUserRole === 'admin' && roleRank(userActionModal.role) >= 2)
                      }
                      onChange={e => handleModalRoleChange(e.target.value)}
                    >
                      <option value="user">User</option>
                      <option value="creator">Creator</option>
                      <option value="admin" disabled={(!isOwner && !isSuperadmin)}>Admin</option>
                      <option value="superadmin" disabled={!isOwner}>Superadmin</option>
                      <option value="owner" disabled={!isOwner}>Owner</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium mb-1">Ban/Unban User</label>
                    {userActionModal.status === 'banned' ? (
                      <button
                        className="px-3 py-1 rounded bg-green-600 text-white text-xs font-medium disabled:opacity-50"
                        onClick={() => handleUnbanUser(userActionModal.id)}
                        disabled={banUpdating}
                      >
                        {banUpdating ? 'Unbanning...' : 'Unban User'}
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button className="px-2 py-1 rounded bg-red-600 text-white text-xs font-medium" onClick={() => handleBanUser(userActionModal.id, '1d')} disabled={banUpdating}>Ban 1d</button>
                          <button className="px-2 py-1 rounded bg-red-600 text-white text-xs font-medium" onClick={() => handleBanUser(userActionModal.id, '7d')} disabled={banUpdating}>Ban 7d</button>
                          <button className="px-2 py-1 rounded bg-red-600 text-white text-xs font-medium" onClick={() => handleBanUser(userActionModal.id, '30d')} disabled={banUpdating}>Ban 30d</button>
                          <button className="px-2 py-1 rounded bg-red-700 text-white text-xs font-medium" onClick={() => handleBanUser(userActionModal.id, 'perm')} disabled={banUpdating}>Ban Perm</button>
                        </div>
                        <div className="flex gap-2 items-center">
                          <input
                            type="date"
                            className="border border-gray-300 rounded px-2 py-1 text-xs"
                            value={banDuration}
                            onChange={e => setBanDuration(e.target.value)}
                            disabled={banUpdating}
                          />
                          <button className="px-2 py-1 rounded bg-red-500 text-white text-xs font-medium" onClick={() => handleBanUser(userActionModal.id, 'custom')} disabled={banUpdating || !banDuration}>Ban Until</button>
                        </div>
                      </div>
                    )}
                    {banMsg && <div className="mt-2 text-xs text-center text-green-700">{banMsg}</div>}
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium mb-1">Timed Downgrade to User</label>
                    {(userActionModal.role !== 'user' || userActionModal.downgradedFrom) ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button className="px-2 py-1 rounded bg-yellow-600 text-white text-xs font-medium" onClick={() => handleDowngradeUser(userActionModal, '1d')} disabled={downgradeUpdating || (userActionModal.role === 'owner' && userActionModal.id === currentUser?.uid)}>1d</button>
                          <button className="px-2 py-1 rounded bg-yellow-600 text-white text-xs font-medium" onClick={() => handleDowngradeUser(userActionModal, '7d')} disabled={downgradeUpdating || (userActionModal.role === 'owner' && userActionModal.id === currentUser?.uid)}>7d</button>
                          <button className="px-2 py-1 rounded bg-yellow-600 text-white text-xs font-medium" onClick={() => handleDowngradeUser(userActionModal, '30d')} disabled={downgradeUpdating || (userActionModal.role === 'owner' && userActionModal.id === currentUser?.uid)}>30d</button>
                        </div>
                        <div className="flex gap-2 items-center">
                          <input
                            type="date"
                            className="border border-gray-300 rounded px-2 py-1 text-xs"
                            value={downgradeDuration}
                            onChange={e => setDowngradeDuration(e.target.value)}
                            disabled={downgradeUpdating || (userActionModal.role === 'owner' && userActionModal.id === currentUser?.uid)}
                          />
                          <button className="px-2 py-1 rounded bg-yellow-700 text-white text-xs font-medium" onClick={() => handleDowngradeUser(userActionModal, 'custom')} disabled={downgradeUpdating || !downgradeDuration || (userActionModal.role === 'owner' && userActionModal.id === currentUser?.uid)}>Custom</button>
                        </div>
                        {userActionModal.downgradedFrom && userActionModal.downgradeUntil && (
                          <div className="text-xs text-yellow-700 mt-1">Downgraded from <b>{userActionModal.downgradedFrom}</b> until {new Date(userActionModal.downgradeUntil).toLocaleString()}</div>
                        )}
                        {downgradeMsg && <div className="mt-2 text-xs text-center text-yellow-700">{downgradeMsg}</div>}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">User is already a regular user.</div>
                    )}
                  </div>
                  <div className="mb-4 border-t pt-4 mt-4">
                    <label className="block text-xs font-bold mb-2 text-gray-700">Support Actions</label>
                    <div className="flex flex-col gap-2">
                      <button
                        className="px-3 py-1 rounded bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition disabled:opacity-50"
                        onClick={() => handleResetPassword(userActionModal)}
                        disabled={supportLoading}
                      >
                        Reset Password
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-gray-100 text-gray-900 text-xs font-medium hover:bg-gray-200 border border-gray-300 transition disabled:opacity-50"
                        onClick={() => handleForceLogout(userActionModal)}
                        disabled={supportLoading}
                      >
                        Force Logout
                      </button>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          className="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
                          value={displayNameEdit}
                          onChange={e => setDisplayNameEdit(e.target.value)}
                          placeholder="New display name"
                          disabled={supportLoading}
                        />
                        <button
                          className="px-2 py-1 rounded bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition disabled:opacity-50"
                          onClick={() => handleChangeDisplayName(userActionModal)}
                          disabled={supportLoading || !displayNameEdit}
                        >
                          Change Name
                        </button>
                      </div>
                      {userActionModal.verificationStatus === 'verified' && (
                        <button
                          className="px-3 py-1 rounded bg-red-600 text-white text-xs font-medium disabled:opacity-50"
                          onClick={() => handleResetVerification(userActionModal)}
                          disabled={supportLoading}
                        >
                          Reset Verification
                        </button>
                      )}
                      {supportMsg && (
                        <div className="mt-2 text-xs text-center text-gray-700 bg-gray-100 rounded py-1">
                          {supportMsg}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button className="px-4 py-1 rounded bg-gray-200 text-gray-800 font-medium" onClick={closeUserActionModal}>Close</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 