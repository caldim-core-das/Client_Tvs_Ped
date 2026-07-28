/**
 * workflowApi.js
 * Axios wrappers for the MH Request workflow endpoints.
 */

import api, { uploadApi } from './axiosConfig';

// ─── Workflow State & Queues ──────────────────────────────────────────────────

export const getWorkflowState = (requestId) =>
    api.get(`/workflow/${requestId}/state`);

export const getWorkflowQueue = (queueType) =>
    api.get(`/workflow/queue/${queueType}`);

export const getLeadTimeEstimate = (requestId) =>
    api.get(`/workflow/lead-time/estimate/${requestId}`);

// ─── The single generic transition endpoint ──────────────────────────────────
// Every workflow stage — whatever HUMAN_TASK node the request currently sits
// at — is advanced through this one call. What decisions are valid, who can
// make them, and what happens next is entirely defined by the published
// WorkflowDefinition graph (see the Workflow Studio), not by this function.
export const submitWorkflowAction = async (requestId, { decision, comment = '', payload = {}, files = [] }) => {
    if (files?.length) {
        const fd = new FormData();
        fd.append('decision', decision);
        fd.append('comment', comment);
        Object.entries(payload || {}).forEach(([key, value]) => {
            fd.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        });
        files.forEach(f => fd.append('designDocuments', f));
        const res = await uploadApi.post(`/workflow/${requestId}/workflow-action`, fd);
        return res.data;
    }
    const res = await api.post(`/workflow/${requestId}/workflow-action`, { decision, comment, payload });
    return res.data;
};

// ─── Design Library ───────────────────────────────────────────────────────────

export const searchDesignLibrary = (params) =>
    api.get(`/design-library/search`, { params });
