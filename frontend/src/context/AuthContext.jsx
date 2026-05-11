import { createContext, useContext, useState, useEffect } from 'react';
import {
    registerWithBackend,
    setAuthToken,
    setRefreshToken,
    getAuthToken,
    initiateLogin,
    verifyLoginWithBackend,
    fetchAuthProfile,
} from '../api/client.js';

const AuthContext = createContext();

const AUTH_KEY = 'urimpact_user';
const SESSION_EXPIRED_EVENT = 'urimpact:session-expired';

export function toFrontendUser(backendUser) {
    if (!backendUser) return null;
    return {
        id: backendUser.id,
        email: backendUser.email,
        firstName: backendUser.firstName,
        lastName: backendUser.lastName,
        role: backendUser.role,
        organizationId: backendUser.organizationId || null,
        company: backendUser.company ?? '',
        avatar: null,
        passwordMustChange: !!backendUser.passwordMustChange,
        totpEnabled: !!backendUser.totpEnabled,
        organizationOnboardingComplete: !!backendUser.organizationOnboardingComplete,
        scope1OnboardingComplete: !!backendUser.scope1OnboardingComplete,
        scope2OnboardingComplete: !!backendUser.scope2OnboardingComplete,
        subscriptionPlan: backendUser.subscriptionPlan || 'STANDARD',
    };
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const storedUser = localStorage.getItem(AUTH_KEY);
            if (storedUser) {
                try {
                    setUser(JSON.parse(storedUser));
                } catch (_) {
                    localStorage.removeItem(AUTH_KEY);
                }
            }

            const token = getAuthToken();
            if (token) {
                try {
                    const profile = await fetchAuthProfile();
                    if (!cancelled) {
                        const u = toFrontendUser(profile);
                        setUser(u);
                        localStorage.setItem(AUTH_KEY, JSON.stringify(u));
                    }
                } catch (_) {
                    /* invalid session — client.js may clear tokens */
                }
            }

            if (!cancelled) setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const onSessionExpired = () => {
            setUser(null);
            localStorage.removeItem(AUTH_KEY);
            setAuthToken(null);
        };

        window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    }, []);

    const refreshSession = async () => {
        const profile = await fetchAuthProfile();
        const u = toFrontendUser(profile);
        setUser(u);
        localStorage.setItem(AUTH_KEY, JSON.stringify(u));
        return u;
    };

    /** Step 1 — password check; returns OTP challenge or completes login when backend skips OTP */
    const loginStart = async (email, password, rememberMe = false) => {
        const payload = await initiateLogin(email, password, rememberMe);

        if (payload?.accessToken && payload?.user) {
            const userData = toFrontendUser(payload.user);
            setUser(userData);
            localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
            setAuthToken(payload.accessToken);
            if (payload.refreshToken) setRefreshToken(payload.refreshToken);
            return { completed: true, user: userData };
        }

        return { completed: false, payload };
    };

    /** Step 2 — OTP (+ optional TOTP), stores JWT */
    const loginVerify = async (loginChallengeId, otp, totpCode) => {
        const { user: backendUser, accessToken, refreshToken } = await verifyLoginWithBackend(
            loginChallengeId,
            otp,
            totpCode
        );
        const userData = toFrontendUser(backendUser);
        setUser(userData);
        localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
        setAuthToken(accessToken);
        if (refreshToken) setRefreshToken(refreshToken);
        return userData;
    };

    const signup = async (userData) => {
        await registerWithBackend({
            email: userData.email,
            password: userData.password,
            firstName: userData.firstName,
            lastName: userData.lastName,
            company: userData.company,
        });
        return { registered: true };
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem(AUTH_KEY);
        setAuthToken(null);
        setRefreshToken(null);
    };

    const updateProfile = (updates) => {
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        localStorage.setItem(AUTH_KEY, JSON.stringify(updatedUser));
        return updatedUser;
    };

    const value = {
        user,
        loading,
        loginStart,
        loginVerify,
        refreshSession,
        signup,
        logout,
        updateProfile,
        isAuthenticated: !!user,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
