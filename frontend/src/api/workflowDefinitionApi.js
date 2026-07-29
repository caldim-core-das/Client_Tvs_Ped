/**
 * workflowDefinitionApi.js
 * Axios wrappers for the Workflow Studio — reading/writing the
 * WorkflowDefinition graph that backend/services/workflowEngine.js executes.
 */

import api from './axiosConfig';

const PROCESS_KEY = 'MH_REQUEST';

export const getDraft = async () => {
    const res = await api.get('/workflow-definitions/draft', { params: { processKey: PROCESS_KEY } });
    return res.data;
};

export const saveDraft = async ({ name, nodes, edges }) => {
    const res = await api.put('/workflow-definitions/draft', { processKey: PROCESS_KEY, name, nodes, edges });
    return res.data;
};

export const publish = async () => {
    const res = await api.post('/workflow-definitions/publish', { processKey: PROCESS_KEY });
    return res.data;
};

export const getHistory = async () => {
    const res = await api.get('/workflow-definitions/history', { params: { processKey: PROCESS_KEY } });
    return res.data;
};

export const getVersion = async (version) => {
    const res = await api.get(`/workflow-definitions/${version}`, { params: { processKey: PROCESS_KEY } });
    return res.data;
};

export const exportDefinition = async () => {
    const res = await api.get('/workflow-definitions/export', { params: { processKey: PROCESS_KEY } });
    return res.data;
};

export const importDefinition = async ({ name, nodes, edges }) => {
    const res = await api.post('/workflow-definitions/import', { processKey: PROCESS_KEY, name, nodes, edges });
    return res.data;
};

export const testRun = async ({ startNodeId, decisions }) => {
    const res = await api.post('/workflow-definitions/test-run', { processKey: PROCESS_KEY, startNodeId, decisions });
    return res.data;
};

// ─── Custom node presets (Studio's "CUSTOM" library section) ─────────────────

export const getPresets = async () => {
    const res = await api.get('/workflow-definitions/presets', { params: { processKey: PROCESS_KEY } });
    return res.data;
};

export const createPreset = async ({ label, nodeType, subtype, config }) => {
    const res = await api.post('/workflow-definitions/presets', { processKey: PROCESS_KEY, label, nodeType, subtype, config });
    return res.data;
};

export const deletePreset = async (presetId) => {
    const res = await api.delete(`/workflow-definitions/presets/${presetId}`);
    return res.data;
};
