import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function canCompleteCompanyOnboarding(role) {
    const r = String(role || '').toUpperCase();
    return r === 'ADMINISTRATOR' || r === 'SUPER_ADMIN';
}

/**
 * Enforces forced password change, company onboarding, then Scope 1 and Scope 2 onboarding before dashboard routes.
 */
export default function PostLoginGate({ children }) {
    const { user, loading } = useAuth();
    const location = useLocation();
    const path = location.pathname;

    if (path === '/login') {
        return children;
    }

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: path }} />;
    }

    if (user.passwordMustChange && path !== '/forced-password-change') {
        return <Navigate to="/forced-password-change" replace />;
    }

    if (
        !user.organizationOnboardingComplete &&
        canCompleteCompanyOnboarding(user.role) &&
        path !== '/company-onboarding'
    ) {
        return <Navigate to="/company-onboarding" replace />;
    }

    if (
        !user.organizationOnboardingComplete &&
        !canCompleteCompanyOnboarding(user.role) &&
        path !== '/pending-setup'
    ) {
        return <Navigate to="/pending-setup" replace />;
    }

    if (
        user.organizationId &&
        user.organizationOnboardingComplete &&
        canCompleteCompanyOnboarding(user.role) &&
        !user.scope1OnboardingComplete &&
        path !== '/scope-onboarding' &&
        path !== '/login' &&
        path !== '/forced-password-change' &&
        path !== '/company-onboarding' &&
        path !== '/pending-setup'
    ) {
        return <Navigate to="/scope-onboarding" replace />;
    }

    if (
        user.organizationId &&
        user.organizationOnboardingComplete &&
        canCompleteCompanyOnboarding(user.role) &&
        user.scope1OnboardingComplete &&
        !user.scope2OnboardingComplete &&
        path !== '/scope-2-onboarding' &&
        path !== '/login' &&
        path !== '/forced-password-change' &&
        path !== '/company-onboarding' &&
        path !== '/pending-setup'
    ) {
        return <Navigate to="/scope-2-onboarding" replace />;
    }

    return children;
}
