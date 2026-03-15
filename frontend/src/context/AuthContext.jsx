import { createContext, useContext, useState, useEffect } from 'react';
import { loginWithBackend, registerWithBackend, setAuthToken } from '../api/client.js';

const AuthContext = createContext();

const AUTH_KEY = 'urimpact_user';

function toFrontendUser(backendUser) {
    return {
        id: backendUser.id,
        email: backendUser.email,
        firstName: backendUser.firstName,
        lastName: backendUser.lastName,
        role: backendUser.role,
        organizationId: backendUser.organizationId || null,
        company: backendUser.company ?? '',
        avatar: null
    };
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem(AUTH_KEY);
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (_) {
                localStorage.removeItem(AUTH_KEY);
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const { user: backendUser, accessToken } = await loginWithBackend(email, password);
        const userData = toFrontendUser(backendUser);
        setUser(userData);
        localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
        setAuthToken(accessToken);
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
        // Auto-login after signup to get token
        const { user: backendUser, accessToken } = await loginWithBackend(userData.email, userData.password);
        const frontendUser = toFrontendUser(backendUser);
        setUser(frontendUser);
        localStorage.setItem(AUTH_KEY, JSON.stringify(frontendUser));
        setAuthToken(accessToken);
        return frontendUser;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem(AUTH_KEY);
        setAuthToken(null);
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
        login,
        signup,
        logout,
        updateProfile,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
