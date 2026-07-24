import axios from 'axios';

const getApiBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (import.meta.env.VITE_API_BASE_URL) {
        const base = import.meta.env.VITE_API_BASE_URL;
        return base.endsWith('/api') ? base : `${base}/api`;
    }
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return '/Tvs/api';
    }
    return '/api';
};

const serverUrl = getApiBaseUrl();

const api = axios.create({
    baseURL: serverUrl,
    headers: {
        'Content-Type': 'application/json',
    },
});

// For file uploads, we often need a different instance or override headers
export const uploadApi = axios.create({
    baseURL: serverUrl,
    headers: {
        'Content-Type': 'multipart/form-data',
    },
});

// Request interceptor for uploadApi
uploadApi.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Request interceptor to add the auth token header to every request
api.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;
