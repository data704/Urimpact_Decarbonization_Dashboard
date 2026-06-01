import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataStoreProvider } from './context/DataStoreContext';
import PostLoginGate from './components/PostLoginGate';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import ForcedPasswordChange from './pages/ForcedPasswordChange/ForcedPasswordChange.jsx';
import CompanyOnboarding from './pages/CompanyOnboarding/CompanyOnboarding.jsx';
import PendingOrganization from './pages/PendingOrganization/PendingOrganization.jsx';
import ScopeOnboarding from './pages/ScopeOnboarding/ScopeOnboarding.jsx';
import Scope2Onboarding from './pages/Scope2Onboarding/Scope2Onboarding.jsx';
import Dashboard from './pages/Dashboard';
import { GHGModule, GHGLanding, GHGCategoryDetail } from './pages/GHG';
import Reports from './pages/Reports';
import Decarbonization from './pages/Decarbonization';
import ESGModule from './pages/ESG/ESGModule';
import SupplyChain from './pages/SupplyChain/SupplyChain';
import BSM from './pages/BSM/BSM';
import ROIModule from './pages/ROI';
import LearnWithUs from './pages/LearnWithUs/LearnWithUs';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import Notifications from './pages/Notifications';
import AdminRoute from './components/AdminRoute';
import Profile from './pages/Profile';

function App() {
    return (
        <AuthProvider>
            <DataStoreProvider>
                <Router>
                    <PostLoginGate>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/forced-password-change" element={<ForcedPasswordChange />} />
                            <Route path="/company-onboarding" element={<CompanyOnboarding />} />
                            <Route path="/pending-setup" element={<PendingOrganization />} />
                            <Route path="/scope-onboarding" element={<ScopeOnboarding />} />
                            <Route path="/scope-2-onboarding" element={<Scope2Onboarding />} />

                            <Route element={<Layout />}>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/data-input" element={<GHGModule />}>
                                    <Route index element={<GHGLanding />} />
                                    <Route path="legacy" element={<Navigate to="/data-input" replace />} />
                                    <Route path="scope/:scopeNum/category/:slug" element={<GHGCategoryDetail />} />
                                </Route>
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/esg" element={<ESGModule />} />
                                <Route path="/decarbonization" element={<Decarbonization />} />
                                <Route path="/roi" element={<ROIModule />} />
                                <Route path="/supply-chain" element={<SupplyChain />} />
                                <Route path="/bsm" element={<BSM />} />
                                <Route path="/learn" element={<LearnWithUs />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/notifications" element={<Notifications />} />
                                <Route
                                    path="/user-management"
                                    element={
                                        <AdminRoute>
                                            <UserManagement />
                                        </AdminRoute>
                                    }
                                />
                                <Route path="/profile" element={<Profile />} />
                            </Route>
                        </Routes>
                    </PostLoginGate>
                </Router>
            </DataStoreProvider>
        </AuthProvider>
    );
}

export default App;
