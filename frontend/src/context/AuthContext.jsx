import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(sessionStorage.getItem('token') || null);
    const [sessionId, setSessionId] = useState(sessionStorage.getItem('sessionId') || null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    // Configure axios defaults and interceptors
    useEffect(() => {
        axios.defaults.withCredentials = true; // Required for cookies

        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            sessionStorage.setItem('token', token);
        } else {
            delete axios.defaults.headers.common['Authorization'];
            sessionStorage.removeItem('token');
        }

        const interceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                // Check for 401 TOKEN_EXPIRED
                if (error.response?.status === 401 && error.response?.data?.message === 'TOKEN_EXPIRED' && !originalRequest._retry) {
                    originalRequest._retry = true;
                    try {
                        const res = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {}, { withCredentials: true });
                        const newToken = res.data.token;
                        setToken(newToken);
                        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                        return axios(originalRequest);
                    } catch (refreshError) {
                        logout();
                        return Promise.reject(refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, [token]);

    // Check if user is logged in on mount
    useEffect(() => {
        const loadUser = async () => {
            if (token) {
                try {
                    const res = await axios.get(`${API_BASE_URL}/api/auth/me`);
                    setUser(res.data);
                    setIsAuthenticated(true);
                } catch (error) {
                    console.error('Error loading user', error);
                    logout();
                }
            }
            setLoading(false);
        };

        loadUser();
    }, []);

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

            return {
                success: false,
                message: message
            };
        }
    };

    const logout = async () => {
        try {
            if (sessionId) {
                // don't retry on logout failure
                await axios.post(`${API_BASE_URL}/api/auth/logout`, { sessionId }, { _retry: true });
            } else {
                await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, { _retry: true });
            }
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

    /**
     * The current user's role string (e.g. 'Admin', 'Requester', 'L1 Approver', 'PED Engineer').
     */
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
