/**
 * workflowApi.js
 * Axios wrappers for all enterprise workflow v2 endpoints using configured axios instance.
 */

import api, { uploadApi } from './axiosConfig';

// ─── Workflow State & Queues ──────────────────────────────────────────────────

export const getWorkflowState = (requestId) =>
    api.get(`/workflow/${requestId}/state`);

export const getWorkflowQueue = (queueType) =>
    api.get(`/workflow/queue/${queueType}`);

export const getLeadTimeEstimate = (requestId) =>
    api.get(`/workflow/lead-time/estimate/${requestId}`);

// ─── L1 Approval ─────────────────────────────────────────────────────────────

export const l1Approve = async (requestId, payload) => {
    const res = await api.post(`/workflow/${requestId}/l1-approve`, payload);
    return res.data;
};

export const l1Reject = async (requestId, payload) => {
    const res = await api.post(`/workflow/${requestId}/l1-reject`, payload);
    return res.data;
};

// ─── Design Stage ─────────────────────────────────────────────────────────────

export const submitDesign = async (requestId, formData) => {
    const res = await uploadApi.post(`/workflow/${requestId}/submit-design`, formData);
    return res.data;
};

export const designerReject = async (requestId, payload) => {
    const res = await api.post(`/workflow/${requestId}/designer-reject`, payload);
    return res.data;
};

// ─── Checker Stage ────────────────────────────────────────────────────────────

export const checkDesign = async (requestId, payload) => {
    const res = await api.post(`/workflow/${requestId}/check-design`, payload);
    return res.data;
};

// ─── Final Approval ───────────────────────────────────────────────────────────

export const finalApprove = async (requestId, payload) => {
    const res = await api.post(`/workflow/${requestId}/final-approve`, payload);
    return res.data;
};

// ─── Production Advancement ───────────────────────────────────────────────────

export const advanceProduction = async (requestId, payload) => {
    const res = await api.patch(`/workflow/${requestId}/advance-production`, payload);
    return res.data;
};

// ─── Design Library ───────────────────────────────────────────────────────────

export const searchDesignLibrary = (params) =>
    api.get(`/design-library/search`, { params });
