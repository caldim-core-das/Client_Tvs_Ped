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

// Request interceptor for api
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

// Response interceptor to handle 401 Unauthorized (expired or invalid token)
const handle401Error = (error) => {
    if (error.response && error.response.status === 401) {
        if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/login')) {
            console.warn('Session expired or unauthorized token. Redirecting to login...');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            const basePath = import.meta.env.VITE_BASE_URL || '/Tvs/';
            window.location.href = basePath.endsWith('/') ? `${basePath}login` : `${basePath}/login`;
        }
    }
    return Promise.reject(error);
};

api.interceptors.response.use((response) => response, handle401Error);
uploadApi.interceptors.response.use((response) => response, handle401Error);

export default api;
