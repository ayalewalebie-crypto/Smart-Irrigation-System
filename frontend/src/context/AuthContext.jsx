import { createContext, useContext, useState, useCallback } from 'react';
import { authApi } from '../services/api';

/**
 * Role hierarchy (highest → lowest):
 *   owner > admin > office_manager > labor
 *
 * Page permission keys map to routes.
 */
export const ROLE_PERMISSIONS = {
  /**
   * Farm Owner — Dashboard, Farm Management, Irrigation Control,
   * Sensors & Devices, Employees & Laborers, Tasks,
   * Finance & Expenses (Budget/Expenses/Income/Payroll), Reports, Notifications
   * + Settings, Profile, Help, About
   */
  owner: [
    'home',
    'farmControl', 'irrigationSchedule', 'sensors',
    'employees',
    'tasks',
    'budget', 'expenses', 'income', 'payroll', 'financialDashboard',
    'reports',
    'notifications',
    'settings', 'profile', 'help', 'about',
  ],

  /**
   * Admin — Dashboard, User Management,
   * Farm Management, Device Management (sensors), Irrigation Control,
   * Tasks, System Reports, Notifications
   * Admin is an Employee — can view own payroll record.
   * + Settings, Profile, Help, About
   */
  admin: [
    'home',
    'users',
    'farmControl', 'sensors', 'irrigationSchedule',
    'tasks',
    'payroll',
    'reports',
    'notifications',
    'settings', 'profile', 'help', 'about',
  ],

  /**
   * Office Manager — Dashboard, Farm (read-only), Employees & Laborers,
   * Tasks, Attendance (laborer-only), Expenses, Irrigation Activities,
   * Payroll (prepare/submit for all employees), Reports, Notifications
   * + Settings, Profile, Help, About
   */
  office_manager: [
    'home',
    'farmControl',
    'employees',
    'tasks',
    'attendance',
    'expenses',
    'payroll',
    'history',
    'reports',
    'notifications',
    'settings', 'profile', 'help', 'about',
  ],

  /**
   * Laborer — Dashboard, My Tasks, Assigned Farm (read-only),
   * Irrigation (view schedule), Report Problems,
   * Attendance (read-only — own records only, recorded by Office Manager),
   * Payroll (read-only — own payslips only),
   * Notifications, Profile, Help, About
   *
   * Laborer CANNOT: manage attendance, approve payroll, access admin/HR functions.
   */
  labor: [
    'home',
    'tasks',
    'attendance',
    'farmControl',
    'irrigationSchedule',
    'problemReports',
    'payroll',
    'notifications',
    'profile', 'help', 'about',
  ],
};

// Role display metadata
export const ROLE_LABEL = {
  owner:          'Farm Owner',
  admin:          'Admin',
  office_manager: 'Office Manager',
  labor:          'Laborer',
};

export const ROLE_COLOR = {
  owner:          '#7c3aed',
  admin:          '#ef4444',
  office_manager: '#0891b2',
  labor:          '#3b82f6',
};

export const ROLE_RANK = { owner: 4, admin: 3, office_manager: 2, labor: 1 };

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sis_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [authLoading, setAuthLoading] = useState(false);

  function persistUser(u) {
    setUser(u);
    localStorage.setItem('sis_user', JSON.stringify(u));
  }

  // ── login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setAuthLoading(true);
    try {
      const data = await authApi.login(email, password);
      localStorage.setItem('sis_token', data.token);
      persistUser(data.user);
      return {
        success:            true,
        user:               data.user,
        mustChangePassword: data.mustChangePassword || data.user?.mustChangePassword || false,
      };
    } catch (err) {
      // Surface suspended/deactivated/pending/rejected status codes from backend
      const msg = err.message || '';
      if (msg.includes('ACCOUNT_SUSPENDED') || msg.toLowerCase().includes('suspended')) {
        return { success: false, code: 'ACCOUNT_SUSPENDED', message: err.message };
      }
      if (msg.includes('ACCOUNT_DEACTIVATED') || msg.toLowerCase().includes('deactivated')) {
        return { success: false, code: 'ACCOUNT_DEACTIVATED', message: err.message };
      }
      if (msg.includes('ACCOUNT_PENDING') || msg.toLowerCase().includes('pending')) {
        return { success: false, code: 'ACCOUNT_PENDING', message: err.message };
      }
      if (msg.includes('ACCOUNT_REJECTED') || msg.toLowerCase().includes('not been approved')) {
        return { success: false, code: 'ACCOUNT_REJECTED', message: err.message };
      }
      return { success: false, message: err.message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // ── register ───────────────────────────────────────────────────────────────
  // Supports all 4 roles. Owner gets active immediately; all others are pending.
  const register = useCallback(async (formData) => {
    setAuthLoading(true);
    try {
      const data = await authApi.register(formData);
      const isPending = formData.role !== 'owner';
      return { success: true, message: data.message, pending: isPending };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('sis_token');
    localStorage.removeItem('sis_user');
  }, []);

  // ── updateProfile ──────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (data) => {
    try {
      const updated = await authApi.updateProfile(data);
      const newUser = { ...user, ...updated };
      persistUser(newUser);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, [user]);

  // ── changePassword ─────────────────────────────────────────────────────────
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  // ── forceChangePassword ────────────────────────────────────────────────────
  const forceChangePassword = useCallback(async (temporaryPassword, newPassword) => {
    try {
      const data = await authApi.forceChangePassword({ temporaryPassword, newPassword });
      if (data.token) {
        localStorage.setItem('sis_token', data.token);
        persistUser({ ...user, ...data.user, mustChangePassword: false });
      }
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, [user]);

  // ── can — check page permission for current user role ─────────────────────
  const can = useCallback((pageKey) => {
    const perms = ROLE_PERMISSIONS[user?.role] || [];
    return perms.includes(pageKey);
  }, [user]);

  // ── hasMinRole — true if user's rank >= required role rank ─────────────────
  const hasMinRole = useCallback((minRole) => {
    return (ROLE_RANK[user?.role] || 0) >= (ROLE_RANK[minRole] || 0);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      authLoading,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      forceChangePassword,
      can,
      hasMinRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
