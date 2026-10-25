import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// ── Pages ──────────────────────────────────────────────────────────────────────
import LandingPage          from './pages/LandingPage';
import LoginPage            from './pages/LoginPage';
import RegisterPage         from './pages/RegisterPage';
import ForceChangePassword  from './pages/ForceChangePassword';
import HomePage             from './pages/HomePage';
import FarmControl          from './pages/FarmControl';
import SensorInfo           from './pages/SensorInfo';
import Reports              from './pages/Reports';
import History              from './pages/History';
import Settings             from './pages/Settings';
import Profile              from './pages/Profile';
import Help                 from './pages/Help';
import About                from './pages/About';
import Tasks                from './pages/Tasks';
import Notifications        from './pages/Notifications';
import UserManagement       from './pages/UserManagement';
import IrrigationSchedule   from './pages/IrrigationSchedule';
import Schedule             from './pages/Schedule';
import Attendance           from './pages/Attendance';
import Budget               from './pages/Budget';
import Payroll              from './pages/Payroll';
import Expenses             from './pages/Expenses';
import Income               from './pages/Income';
import Employees            from './pages/Employees';
import ProblemReports       from './pages/ProblemReports';
import MyAttendancePage     from './pages/MyAttendancePage';
import MyPayrollPage        from './pages/MyPayrollPage';
import IrrigationWork       from './pages/IrrigationWork';
import FinancialDashboard   from './pages/FinancialDashboard';
import CropInfo             from './pages/CropInfo';
import Inspection           from './pages/Inspection';
import PaymentSuccess       from './pages/PaymentSuccess';
import PaymentCancel        from './pages/PaymentCancel';

// ── Route guards ───────────────────────────────────────────────────────────────

/** Redirect unauthenticated users to landing page. */
function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" replace />;
}

/**
 * Block users with a temporary password from accessing the app until
 * they complete the force-change-password flow.
 */
function MustChangePasswordGuard({ children }) {
  const { user } = useAuth();
  if (user?.mustChangePassword) {
    return <Navigate to="/force-change-password" replace />;
  }
  return children;
}

/**
 * Role-based page guard — checks the ROLE_PERMISSIONS map via can().
 * Redirects to /home if the role doesn't have access to this page.
 */
function GuardedPage({ pageKey, children }) {
  const { can } = useAuth();
  return can(pageKey) ? children : <Navigate to="/home" replace />;
}

/**
 * PL — Private + MustChangePassword guard + Layout.
 * Use for pages accessible by any authenticated, active role.
 */
function PL({ children }) {
  return (
    <PrivateRoute>
      <MustChangePasswordGuard>
        <Layout>{children}</Layout>
      </MustChangePasswordGuard>
    </PrivateRoute>
  );
}

/**
 * PGl — Private + MustChangePassword guard + role permission guard + Layout.
 * Use for pages restricted to specific roles.
 */
function PGl({ pageKey, children }) {
  return (
    <PrivateRoute>
      <MustChangePasswordGuard>
        <GuardedPage pageKey={pageKey}>
          <Layout>{children}</Layout>
        </GuardedPage>
      </MustChangePasswordGuard>
    </PrivateRoute>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* ── Public ────────────────────────────────────────────────────────── */}
      <Route path="/"         element={<LandingPage />} />
      <Route path="/login"    element={user ? <Navigate to="/home" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/home" replace /> : <RegisterPage />} />

      {/* ── Force password change (temporary password flow) ───────────────── */}
      <Route
        path="/force-change-password"
        element={
          !user
            ? <Navigate to="/login" replace />
            : user.mustChangePassword
              ? <ForceChangePassword />
              : <Navigate to="/home" replace />
        }
      />

      {/* ── Core — all authenticated roles ────────────────────────────────── */}
      <Route path="/home"          element={<PL><HomePage /></PL>} />
      <Route path="/profile"       element={<PL><Profile /></PL>} />
      <Route path="/help"          element={<PL><Help /></PL>} />
      <Route path="/about"         element={<PL><About /></PL>} />
      <Route path="/notifications" element={<PGl pageKey="notifications"><Notifications /></PGl>} />

      {/* ── Tasks — owner, admin, office_manager, labor ───────────────────── */}
      <Route path="/tasks"      element={<PGl pageKey="tasks"><Tasks /></PGl>} />

      {/* ── Attendance — owner, office_manager, labor (read-only for labor) ── */}
      <Route path="/attendance"     element={<PGl pageKey="attendance"><Attendance /></PGl>} />

      {/* ── Laborer-specific pages ─────────────────────────────────────────── */}
      <Route path="/my-attendance"  element={<PGl pageKey="attendance"><MyAttendancePage /></PGl>} />
      <Route path="/my-payroll"     element={<PGl pageKey="payroll"><MyPayrollPage /></PGl>} />
      <Route path="/irrigation-work"element={<PGl pageKey="irrigationSchedule"><IrrigationWork /></PGl>} />

      {/* ── History / Irrigation Activities — owner, office_manager ──────── */}
      <Route path="/history"    element={<PGl pageKey="history"><History /></PGl>} />

      {/* ── Settings — owner, admin, office_manager ───────────────────────── */}
      <Route path="/settings"   element={<PGl pageKey="settings"><Settings /></PGl>} />

      {/* ── Farm — owner, admin + office_manager + laborer (read-only) ────── */}
      <Route path="/farm-control"        element={<PGl pageKey="farmControl"><FarmControl /></PGl>} />
      <Route path="/sensors"             element={<PGl pageKey="sensors"><SensorInfo /></PGl>} />
      <Route path="/crop-info"           element={<PGl pageKey="farmControl"><CropInfo /></PGl>} />
      <Route path="/inspection"          element={<PGl pageKey="employees"><Inspection /></PGl>} />
      <Route path="/irrigation-schedule" element={<PGl pageKey="irrigationSchedule"><IrrigationSchedule /></PGl>} />
      <Route path="/problem-reports"     element={<PGl pageKey="problemReports"><ProblemReports /></PGl>} />

      {/* ── User management — owner, admin ────────────────────────────────── */}
      <Route path="/users"     element={<PGl pageKey="users"><UserManagement /></PGl>} />

      {/* ── Employees — owner, office_manager ─────────────────────────────── */}
      <Route path="/employees" element={<PGl pageKey="employees"><Employees /></PGl>} />

      {/* ── Reports — owner, admin, office_manager ────────────────────────── */}
      <Route path="/reports"   element={<PGl pageKey="reports"><Reports /></PGl>} />

      {/* ── Financial — owner only ────────────────────────────────────────── */}
      <Route path="/financial-dashboard" element={<PGl pageKey="financialDashboard"><FinancialDashboard /></PGl>} />
      <Route path="/budget"   element={<PGl pageKey="budget"><Budget /></PGl>} />
      <Route path="/income"   element={<PGl pageKey="income"><Income /></PGl>} />
      <Route path="/payroll"  element={<PGl pageKey="payroll"><Payroll /></PGl>} />

      {/* ── Expenses — owner + office_manager ─────────────────────────────── */}
      <Route path="/expenses" element={<PGl pageKey="expenses"><Expenses /></PGl>} />

      {/* ── Schedule (still accessible via direct URL if permitted) ──────── */}
      <Route path="/schedule" element={<PGl pageKey="schedule"><Schedule /></PGl>} />

      {/* ── Chapa payment callback pages (public — no auth required) ── */}
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/cancel"  element={<PaymentCancel />} />

      {/* ── Catch-all ─────────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to={user ? '/home' : '/'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
