import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CreateMHRequestList from './pages/CreateMHRequest/CreateMHRequestList';
import MHRequestForm from './components/Forms/MHRequestForm';
import RequestTracker from './pages/RequestTracker';
import MHDevelopmentTracker from './pages/MHDevelopmentTracker/MHDevelopmentTracker';
import ProjectPlanModel from './pages/ProjectPlanModel';
import LandingPage from './pages/landing/LandingPage';














import EmployeeMaster from './pages/EmployeeMaster/EmployeeMaster';
import EmployeeForm from './pages/EmployeeMaster/EmployeeForm';
import EmployeeView from './pages/EmployeeMaster/EmployeeView';
import VendorMaster from './pages/VendorMaster/VendorMaster';
import VendorScoring from './pages/VendorMaster/VendorScoring';
import VendorLoadingChart from './pages/VendorMaster/VendorLoadingChart';
import VendorForm from './pages/VendorMaster/VendorForm';
import VendorView from './pages/VendorMaster/VendorView';

import AssetSummary from './pages/AssetSummary';
import AssetManagementUpdate from './pages/AssetManagementUpdate';
import Settings from './pages/Settings';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// ── Enterprise Workflow v2 Pages ────────────────────────────────────────────────
import WorkflowDetailPage    from './pages/WorkflowDetail/WorkflowDetailPage';
import WorkflowStudioPage    from './pages/WorkflowStudio/WorkflowStudioPage';
import DesignQueuePage        from './pages/DesignQueue/DesignQueuePage';
import CheckerQueuePage       from './pages/CheckerQueue/CheckerQueuePage';
import FinalApprovalQueuePage from './pages/FinalApprovalQueue/FinalApprovalQueuePage';
import L1ApprovalQueuePage    from './pages/L1ApprovalQueue/L1ApprovalQueuePage';
import DesignLibraryPage      from './pages/DesignLibrary/DesignLibraryPage';
import MyRequestsPage         from './pages/MyRequests/MyRequestsPage';

// ── Estimation UI Feature ───────────────────────────────────────────────────────
import EstimationLayout from './components/EstimationLayout';
import EstimationDashboard from './pages/Estimation/EstimationDashboard';

function App() {
  const antdTheme = {
    token: {
      colorPrimary:        '#CC1F1F',
      colorPrimaryHover:   '#B31818',
      colorPrimaryActive:  '#991515',
      colorPrimaryBg:      '#FFF0F0',
      colorPrimaryBgHover: '#F5D0D0',
      colorPrimaryBorder:  '#F5D0D0',
      colorPrimaryText:    '#CC1F1F',
      colorLink:           '#CC1F1F',
      colorLinkHover:      '#B31818',
      borderRadius:        8,
    },
  };

  return (
    <ConfigProvider theme={antdTheme}>
    <BrowserRouter basename={import.meta.env.DEV ? '/' : '/Tvs'}>
      <AuthProvider>
        <Routes>
          {/* ── Public landing page (no auth required) ── */}
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* Estimation Module */}
          <Route path="/estimation" element={
            <ProtectedRoute>
              <EstimationLayout />
            </ProtectedRoute>
          }>
            <Route index element={<EstimationDashboard />} />
          </Route>

          <Route path="/" element={<Layout />}>
            <Route index element={
              <ProtectedRoute permission="dashboard">
                <Dashboard />
              </ProtectedRoute>
            } />

            {/* MH Request Module */}
            <Route path="mh-requests">
              <Route index element={
                <ProtectedRoute permission="assetRequest">
                  <CreateMHRequestList />
                </ProtectedRoute>
              } />
              <Route path="add" element={
                <ProtectedRoute permission="assetRequest">
                  <MHRequestForm />
                </ProtectedRoute>
              } />
              <Route path="edit/:id" element={
                <ProtectedRoute permission="assetRequest">
                  <MHRequestForm />
                </ProtectedRoute>
              } />
            </Route>

            {/* Request Tracker */}
            <Route path="request-tracker" element={
              <ProtectedRoute permission="requestTracker">
                <RequestTracker />
              </ProtectedRoute>
            } />

            {/* My Requests Tracker (Employee View) */}
            <Route path="my-requests" element={
              <ProtectedRoute>
                <MyRequestsPage />
              </ProtectedRoute>
            } />

            {/* MH Development Tracker */}
            <Route path="mh-development-tracker" element={
              <ProtectedRoute permission="mhDevelopmentTracker">
                <MHDevelopmentTracker />
              </ProtectedRoute>
            } />

            {/* Project Plan Model - sub module under MH Dev Tracker */}
            <Route path="project-plan-model" element={
              <ProtectedRoute permission="mhDevelopmentTracker">
                <ProjectPlanModel />
              </ProtectedRoute>
            } />

            <Route path="asset-management-update" element={
              <ProtectedRoute permission="assetSummary">
                <AssetManagementUpdate />
              </ProtectedRoute>
            } />

            <Route path="asset-summary" element={
              <ProtectedRoute permission="assetSummary">
                <AssetSummary />
              </ProtectedRoute>
            } />

            <Route path="design-library" element={
              <ProtectedRoute permission="assetSummary">
                <DesignLibraryPage />
              </ProtectedRoute>
            } />


            {/* Placeholder routes for other links in Sidebar */}
            <Route path="orders" element={
              <ProtectedRoute>
                <div className="p-8"><h1>Orders Page</h1></div>
              </ProtectedRoute>
            } />

            {/* Employee Master Module */}
            <Route path="employee-master">
              <Route index element={
                <ProtectedRoute permission="employeeMaster">
                  <EmployeeMaster />
                </ProtectedRoute>
              } />
              <Route path="add" element={
                <ProtectedRoute permission="employeeMaster">
                  <EmployeeForm mode="add" />
                </ProtectedRoute>
              } />
              <Route path="edit/:id" element={
                <ProtectedRoute permission="employeeMaster">
                  <EmployeeForm mode="edit" />
                </ProtectedRoute>
              } />
              <Route path="view/:id" element={
                <ProtectedRoute permission="employeeMaster">
                  <EmployeeView />
                </ProtectedRoute>
              } />
            </Route>

            <Route path="vendor-master">
              <Route index element={
                <ProtectedRoute permission="vendorMaster">
                  <VendorMaster />
                </ProtectedRoute>
              } />
              <Route path="add" element={
                <ProtectedRoute permission="vendorMaster">
                  <VendorForm mode="add" />
                </ProtectedRoute>
              } />
              <Route path="edit/:id" element={
                <ProtectedRoute permission="vendorMaster">
                  <VendorForm mode="edit" />
                </ProtectedRoute>
              } />
              <Route path="view/:id" element={
                <ProtectedRoute permission="vendorMaster">
                  <VendorView />
                </ProtectedRoute>
              } />
              <Route path="scoring" element={
                <ProtectedRoute permission="vendorMaster">
                  <VendorScoring />
                </ProtectedRoute>
              } />
              <Route path="loading" element={
                <ProtectedRoute permission="vendorMaster">
                  <VendorLoadingChart />
                </ProtectedRoute>
              } />
            </Route>

            <Route path="settings" element={
              <ProtectedRoute permission="settings">
                <Settings />
              </ProtectedRoute>
            } />

            <Route path="workflow-studio" element={
              <ProtectedRoute permission="workflowStudio">
                <WorkflowStudioPage />
              </ProtectedRoute>
            } />

            {/* ── Enterprise Workflow v2 Routes ────────────────────────────────── */}
            <Route path="workflow/:id" element={
              <ProtectedRoute>
                <WorkflowDetailPage />
              </ProtectedRoute>
            } />

            {/* L1 Approval Queue — Approver + PED Engineer + Admin */}
            <Route path="workflow-queue/l1" element={
              <ProtectedRoute roles={['L1 Approver', 'PED Engineer', 'Admin']}>
                <L1ApprovalQueuePage />
              </ProtectedRoute>
            } />

            {/* Design Queue — Designer + PED Engineer + Admin */}
            <Route path="design-queue" element={
              <ProtectedRoute roles={['Designer', 'PED Engineer', 'Admin']}>
                <DesignQueuePage />
              </ProtectedRoute>
            } />

            {/* Checker Queue — Checker + Admin */}
            <Route path="checker-queue" element={
              <ProtectedRoute roles={['Checker', 'Admin']}>
                <CheckerQueuePage />
              </ProtectedRoute>
            } />

            {/* Final Approval Queue — Final Approver + Admin */}
            <Route path="final-approval-queue" element={
              <ProtectedRoute roles={['Final Approver', 'Admin']}>
                <FinalApprovalQueuePage />
              </ProtectedRoute>
            } />


          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
