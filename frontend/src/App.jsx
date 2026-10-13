// src/App.jsx
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleBasedRedirect from './components/RoleBasedRedirect';
import RoleGuard from './components/RoleGuard';
import PageLoader from './components/PageLoader';
import Login from './pages/Login';

// Route-level code splitting: each page is downloaded only when first visited,
// so the initial bundle stays small (PDF.js, admin screens etc. load on demand).
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const UnifiedLayout = lazy(() => import('./layouts/UnifiedLayout'));
const AdminDashboard = lazy(() => import('./pages/ADMIN/AdminDashboard'));
const UsersAdmin = lazy(() => import('./pages/ADMIN/UsersAdmin'));
const VendorsAdmin = lazy(() => import('./pages/ADMIN/VendorsAdmin'));
const ProjectsAdmin = lazy(() => import('./pages/ADMIN/ProjectsAdmin'));
const RolesAdmin = lazy(() => import('./pages/ADMIN/RolesAdmin'));
const WorkflowsAdmin = lazy(() => import('./pages/ADMIN/WorkflowsAdmin'));
const WorkflowDetail = lazy(() => import('./pages/ADMIN/WorkflowDetail'));
const PurchaseOrdersAdmin = lazy(() => import('./pages/ADMIN/PurchaseOrdersAdmin'));
const UnifiedDashboard = lazy(() => import('./pages/UnifiedDashboard'));
const ClaimCreate = lazy(() => import('./pages/ClaimCreate'));
const ResubmitClaim = lazy(() => import('./pages/ResubmitClaim'));
const Inbox = lazy(() => import('./pages/Inbox'));
const MyClaims = lazy(() => import('./pages/MyClaims'));
const ClaimDetail = lazy(() => import('./pages/ClaimDetail'));
const PdfViewerPage = lazy(() => import('./pages/PdfViewerPage'));
const VendorProjectPOs = lazy(() => import('./pages/VendorProjectPOs'));
const VendorPOClaimsHistory = lazy(() => import('./pages/VendorPOClaimsHistory'));

// Old "/claims/:id/review" links now open the unified claim page
function ReviewRedirect() {
  return <Navigate to=".." relative="path" replace />;
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return <PageLoader fullScreen label="Loading APTS Portal..." />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RoleBasedRedirect />} />

      {/* ============ PDF VIEWER - Outside of any layout ============ */}
      <Route element={<ProtectedRoute />}>
        <Route path="/pdf-viewer/:claimId" element={<PdfViewerPage />} />
      </Route>

      {/* ============ ADMIN ROUTES ============ */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleGuard allowedRanks={[100, 80]} redirectTo="/" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="vendors" element={<VendorsAdmin />} />
            <Route path="projects" element={<ProjectsAdmin />} />
            <Route path="roles" element={<RolesAdmin />} />
            <Route path="workflows" element={<WorkflowsAdmin />} />
            <Route path="workflows/:id" element={<WorkflowDetail />} />
            <Route path="purchase-orders" element={<PurchaseOrdersAdmin />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
      </Route>

      {/* ============ VENDOR ROUTES ============ */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleGuard allowedRanks={[10]} redirectTo="/" />}>
          <Route path="/vendor" element={<UnifiedLayout />}>
            <Route index element={<UnifiedDashboard />} />
            <Route path="claims" element={<MyClaims />} />
            
            {/* Step 1: Projects List */}
            <Route path="claims/create" element={<ClaimCreate />} />
            
            {/* Step 2: POs under Selected Project */}
            <Route path="claims/project/:projectId" element={<VendorProjectPOs />} />
            
            {/* Step 3: Previously Submitted Claims under Selected PO */}
            <Route path="claims/project/:projectId/po/:poId" element={<VendorPOClaimsHistory />} />

            <Route path="claims/:id" element={<ClaimDetail />} />
            <Route path="claims/:id/resubmit" element={<ResubmitClaim />} />
            <Route path="*" element={<Navigate to="/vendor" replace />} />
          </Route>
        </Route>
      </Route>

      {/* ============ OFFICER ROUTES (PM, TPA, JD-Infra) ============ */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleGuard allowedRanks={[30, 40, 50]} redirectTo="/" />}>
          <Route path="/officer" element={<UnifiedLayout />}>
            <Route index element={<UnifiedDashboard />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="outbox" element={<Inbox />} />
            <Route path="claims/:id/review" element={<ReviewRedirect />} />
            <Route path="claims/:id" element={<ClaimDetail />} />
            <Route path="*" element={<Navigate to="/officer" replace />} />
          </Route>
        </Route>
      </Route>

      {/* ============ MANAGER ROUTES (APTS) ============ */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleGuard allowedRanks={[60]} redirectTo="/" />}>
          <Route path="/manager" element={<UnifiedLayout />}>
            <Route index element={<UnifiedDashboard />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="outbox" element={<Inbox />} />
            <Route path="claims/:id/review" element={<ReviewRedirect />} />
            <Route path="claims/:id" element={<ClaimDetail />} />
            <Route path="*" element={<Navigate to="/manager" replace />} />
          </Route>
        </Route>
      </Route>

      {/* ============ FALLBACK ROUTE ============ */}
      <Route path="*" element={<RoleBasedRedirect />} />
    </Routes>
    </Suspense>
  );
}