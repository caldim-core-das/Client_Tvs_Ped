/**
 * workflowApi.js
 * Axios wrappers for all enterprise workflow v2 endpoints.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
    const token = sessionStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// ─── Workflow State & Queues ──────────────────────────────────────────────────

export const getWorkflowState = (requestId) =>
    axios.get(`${BASE_URL}/workflow/${requestId}/state`, { headers: getAuthHeader() });

export const getWorkflowQueue = (queueType) =>
    axios.get(`${BASE_URL}/workflow/queue/${queueType}`, { headers: getAuthHeader() });

export const getLeadTimeEstimate = (requestId) =>
    axios.get(`${BASE_URL}/workflow/lead-time/estimate/${requestId}`, { headers: getAuthHeader() });

// ─── L1 Approval ─────────────────────────────────────────────────────────────

export const l1Approve = (requestId, payload) =>
    axios.post(`${BASE_URL}/workflow/${requestId}/l1-approve`, payload, { headers: getAuthHeader() });

export const l1Reject = (requestId, payload) =>
    axios.post(`${BASE_URL}/workflow/${requestId}/l1-reject`, payload, { headers: getAuthHeader() });

// ─── Design Stage ─────────────────────────────────────────────────────────────

export const submitDesign = async (requestId, formData) => {
    const res = await axios.post(`${BASE_URL}/workflow/${requestId}/submit-design`, formData, {
        headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
};

export const designerReject = async (requestId, payload) => {
    const res = await axios.post(`${BASE_URL}/workflow/${requestId}/designer-reject`, payload, { headers: getAuthHeader() });
    return res.data;
};

// ─── Checker Stage ────────────────────────────────────────────────────────────

export const checkDesign = (requestId, payload) =>
    axios.post(`${BASE_URL}/workflow/${requestId}/check-design`, payload, { headers: getAuthHeader() });

// ─── Final Approval ───────────────────────────────────────────────────────────

export const finalApprove = (requestId, payload) =>
    axios.post(`${BASE_URL}/workflow/${requestId}/final-approve`, payload, { headers: getAuthHeader() });

// ─── Production Advancement ───────────────────────────────────────────────────

export const advanceProduction = (requestId, payload) =>
    axios.patch(`${BASE_URL}/workflow/${requestId}/advance-production`, payload, { headers: getAuthHeader() });

// ─── Design Library ───────────────────────────────────────────────────────────

export const searchDesignLibrary = (params) =>
    axios.get(`${BASE_URL}/design-library/search`, { params, headers: getAuthHeader() });
