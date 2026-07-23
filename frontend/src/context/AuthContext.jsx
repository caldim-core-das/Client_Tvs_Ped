import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import api, { uploadApi } from '../api/axiosConfig';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Dedicated axios instance WITHOUT the response interceptor — used ONLY for the
// initial session-restore call so it never gets caught in the refresh retry loop.
const authCheckAxios = axios.create({ withCredentials: true });

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    // Lazy initialisers run exactly once on mount — safe to do side effects here.
    const [token, setToken] = useState(() => {
        const raw = sessionStorage.getItem('token');
        // Treat the literal strings "null" / "undefined" as absent (left by a bug)
        if (!raw || raw === 'null' || raw === 'undefined') {
            if (raw) sessionStorage.removeItem('token');
            return null;
        }
        return raw;
    });
    const [sessionId, setSessionId] = useState(() => sessionStorage.getItem('sessionId') || null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    // Keep axios defaults and the refresh interceptor in sync with the token
    useEffect(() => {
        axios.defaults.withCredentials = true;

        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            sessionStorage.setItem('token', token);
        } else {
            delete axios.defaults.headers.common['Authorization'];
            sessionStorage.removeItem('token');
        }

        const setupInterceptor = (axiosInstance) => {
            return axiosInstance.interceptors.response.use(
                (response) => response,
                async (error) => {
                    const originalRequest = error.config;
                    // Only retry once, and only for TOKEN_EXPIRED — never for other errors
                    if (
                        error.response?.status === 401 &&
                        error.response?.data?.message === 'TOKEN_EXPIRED' &&
                        !originalRequest._retry
                    ) {
                        originalRequest._retry = true;
                        try {
                            const res = await axios.post(
                                `${API_BASE_URL}/api/auth/refresh`,
                                {},
                                { withCredentials: true, _retry: true }
                            );
                            const newToken = res.data.token;
                            setToken(newToken);
                            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                            return axiosInstance(originalRequest);
                        } catch (refreshError) {
                            logout();
                            return Promise.reject(refreshError);
                        }
                    }
                    return Promise.reject(error);
                }
            );
        };

        const globalInterceptor = setupInterceptor(axios);
        const apiInterceptor = setupInterceptor(api);
        const uploadApiInterceptor = setupInterceptor(uploadApi);

        return () => {
            axios.interceptors.response.eject(globalInterceptor);
            api.interceptors.response.eject(apiInterceptor);
            uploadApi.interceptors.response.eject(uploadApiInterceptor);
        };
    }, [token]);

    // Restore session on mount — uses the interceptor-free instance so it
    // never gets stuck waiting for a token-refresh that might hang.
    useEffect(() => {
        const loadUser = async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                // Pass the token manually; authCheckAxios has no shared defaults
                const res = await authCheckAxios.get(`${API_BASE_URL}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setUser(res.data);
                setIsAuthenticated(true);
            } catch (err) {
                // Token is invalid / expired — clear credentials silently
                console.warn(
                    'Session restore failed:',
                    err?.response?.data?.message || err.message
                );
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('sessionId');
                setToken(null);
                setUser(null);
                setIsAuthenticated(false);
            } finally {
                // Always unblock the UI, no matter what
                setLoading(false);
            }
        };

        loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Background silent refresh before the token expires
    useEffect(() => {
        let refreshInterval;

        if (isAuthenticated) {
            // Token expires in 15 mins (900000ms), refresh it every 14 mins (840000ms)
            const REFRESH_TIME = 14 * 60 * 1000;

            refreshInterval = setInterval(async () => {
                try {
                    const res = await axios.post(
                        `${API_BASE_URL}/api/auth/refresh`,
                        {},
                        { withCredentials: true }
                    );
                    const newToken = res.data.token;
                    setToken(newToken);
                    console.log('Token refreshed silently in the background');
                } catch (error) {
                    console.error('Background token refresh failed', error);
                    // It will naturally fail and log out on the next request via interceptors
                }
            }, REFRESH_TIME);
        }

        return () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        };
    }, [isAuthenticated]);

    const login = async (email, password) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });

            setToken(res.data.token);
            setUser(res.data);
            if (res.data.sessionId) {
                setSessionId(res.data.sessionId);
                sessionStorage.setItem('sessionId', res.data.sessionId);
            }
            setIsAuthenticated(true);

            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            let message = 'Login failed';

            if (error.response?.data?.message) {
                message = error.response.data.message;
            } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
                message = 'Cannot connect to server. Is the backend running?';
            } else {
                message = error.message || 'Login failed';
            }

            return { success: false, message };
        }
    };

    const logout = async () => {
        try {
            const body = sessionId ? { sessionId } : {};
            await axios.post(`${API_BASE_URL}/api/auth/logout`, body, { _retry: true });
        } catch (error) {
            console.error('Logout error', error);
        } finally {
            setUser(null);
            setToken(null);
            setSessionId(null);
            setIsAuthenticated(false);
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('sessionId');
            delete axios.defaults.headers.common['Authorization'];
        }
    };

    /**
     * Check if the current user has a specific permission key.
     * Admin role has all permissions by default.
     */
    const hasPermission = (permissionKey) => {
        if (!user) return false;
        if (user.role === 'Admin') return true;
        return user.permissions && user.permissions[permissionKey] === true;
    };

    /**
     * Check if the current user has a specific role.
     * @param {string|string[]} roles - Role or array of roles to check
     */
    const hasRole = (roles) => {
        if (!user) return false;
        if (Array.isArray(roles)) return roles.includes(user.role);
        return user.role === roles;
    };

    /** The current user's role string (e.g. 'Admin', 'Requester', 'L1 Approver', 'PED Engineer'). */
    const role = user?.role || null;

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isAuthenticated,
            loading,
            login,
            logout,
            hasPermission,
            hasRole,
            role
        }}>
            {children}
        </AuthContext.Provider>
    );
};
