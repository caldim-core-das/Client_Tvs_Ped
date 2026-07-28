/**
 * workflowDefinitionController.js
 * CRUD + publish/history/import/export/test-run for the Workflow Studio editor.
 * Reads/writes backend/models/WorkflowDefinition.js — the graph that
 * backend/services/workflowEngine.js executes at runtime.
 */

const asyncHandler = require('express-async-handler');
const WorkflowDefinition = require('../models/WorkflowDefinition');
const WorkflowNodePreset = require('../models/WorkflowNodePreset');

const KNOWN_TEMPLATE_KEYS = [
    'REQUEST_SUBMITTED', 'L1_APPROVED', 'PED_ENGINEER_ASSIGNED', 'L1_REJECTED', 'REVERTED',
    'DESIGNER_ASSIGNED', 'CHECKER_ASSIGNED', 'DESIGN_SUBMITTED', 'DESIGN_APPROVED',
    'DESIGN_REJECTED', 'FINAL_APPROVED', 'FINAL_REJECTED', 'IN_PRODUCTION', 'COMPLETED',
    'ESCALATION_REMINDER'
];

function validateGraph(nodes, edges) {
    const problems = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    const triggers = nodes.filter(n => n.type === 'TRIGGER');
    if (triggers.length !== 1) problems.push(`Graph must have exactly one TRIGGER node (found ${triggers.length}).`);

    for (const edge of edges) {
        if (!nodeIds.has(edge.source)) problems.push(`Edge '${edge.id}' has an unknown source node '${edge.source}'.`);
        if (!nodeIds.has(edge.target)) problems.push(`Edge '${edge.id}' has an unknown target node '${edge.target}'.`);
    }

    for (const node of nodes) {
        const outgoing = edges.filter(e => e.source === node.id);
        if (node.type === 'HUMAN_TASK') {
            const decisions = node.config?.decisions || [];
            if (decisions.length === 0) problems.push(`HUMAN_TASK '${node.label}' (${node.id}) has no decisions configured.`);
            for (const decision of decisions) {
                if (!outgoing.some(e => e.label === decision)) {
                    problems.push(`HUMAN_TASK '${node.label}' (${node.id}) has decision '${decision}' with no matching outgoing connection.`);
                }
            }
        } else if (node.type === 'ROUTING') {
            if (!node.config?.targetField) problems.push(`ROUTING '${node.label}' (${node.id}) has no targetField configured.`);
            if (outgoing.length !== 1) problems.push(`ROUTING '${node.label}' (${node.id}) must have exactly one outgoing connection.`);
        } else if (node.type === 'COMMUNICATION') {
            if (!KNOWN_TEMPLATE_KEYS.includes(node.config?.templateKey)) {
                problems.push(`COMMUNICATION '${node.label}' (${node.id}) has an unrecognized templateKey '${node.config?.templateKey}'.`);
            }
            if (outgoing.length !== 1) problems.push(`COMMUNICATION '${node.label}' (${node.id}) must have exactly one outgoing connection.`);
        } else if (node.type === 'END') {
            if (outgoing.length !== 0) problems.push(`END '${node.label}' (${node.id}) must not have any outgoing connections.`);
        } else if (['ACTION', 'SLA'].includes(node.type)) {
            if (outgoing.length !== 1) problems.push(`${node.type} '${node.label}' (${node.id}) must have exactly one outgoing connection.`);
        }
    }

    // Reachability from the trigger
    if (triggers.length === 1) {
        const seen = new Set([triggers[0].id]);
        const queue = [triggers[0].id];
        while (queue.length) {
            const id = queue.shift();
            for (const e of edges.filter(e => e.source === id)) {
                if (!seen.has(e.target)) { seen.add(e.target); queue.push(e.target); }
            }
        }
        for (const node of nodes) {
            if (!seen.has(node.id)) problems.push(`Node '${node.label}' (${node.id}) is not reachable from the trigger.`);
        }
    }

    return problems;
}

// GET /api/workflow-definitions/draft
const getDraft = asyncHandler(async (req, res) => {
    const processKey = req.query.processKey || 'MH_REQUEST';
    const draft = await WorkflowDefinition.findOne({ processKey, isDraft: true }).lean();
    if (!draft) return res.status(404).json({ message: `No draft found for process '${processKey}'` });
    res.json(draft);
});

// PUT /api/workflow-definitions/draft
const saveDraft = asyncHandler(async (req, res) => {
    const { processKey = 'MH_REQUEST', name, nodes = [], edges = [] } = req.body;
    const draft = await WorkflowDefinition.findOneAndUpdate(
        { processKey, isDraft: true },
        { $set: { name, nodes, edges, updatedBy: req.user._id } },
        { new: true, upsert: true }
    );
    res.json(draft);
});

// POST /api/workflow-definitions/publish
const publish = asyncHandler(async (req, res) => {
    const processKey = req.body.processKey || 'MH_REQUEST';
    const draft = await WorkflowDefinition.findOne({ processKey, isDraft: true });
    if (!draft) return res.status(404).json({ message: `No draft found for process '${processKey}'` });

    const problems = validateGraph(draft.nodes, draft.edges);
    if (problems.length > 0) return res.status(400).json({ message: 'Graph failed validation', problems });

    const latest = await WorkflowDefinition.findOne({ processKey, isDraft: false }).sort({ version: -1 });
    const nextVersion = (latest?.version || 0) + 1;

    const published = await WorkflowDefinition.create({
        name: draft.name,
        processKey,
        version: nextVersion,
        isDraft: false,
        isActive: true,
        publishedAt: new Date(),
        publishedBy: req.user._id,
        nodes: draft.nodes,
        edges: draft.edges,
        createdBy: draft.createdBy || req.user._id,
        updatedBy: req.user._id
    });

    if (latest) await WorkflowDefinition.updateOne({ _id: latest._id }, { isActive: false });

    res.json(published);
});

// GET /api/workflow-definitions/history
const getHistory = asyncHandler(async (req, res) => {
    const processKey = req.query.processKey || 'MH_REQUEST';
    const versions = await WorkflowDefinition.find({ processKey, isDraft: false })
        .sort({ version: -1 })
        .select('name processKey version isActive publishedAt publishedBy')
        .populate('publishedBy', 'email')
        .lean();
    res.json({ count: versions.length, data: versions });
});

// GET /api/workflow-definitions/:version
const getVersion = asyncHandler(async (req, res) => {
    const processKey = req.query.processKey || 'MH_REQUEST';
    const version = await WorkflowDefinition.findOne({ processKey, isDraft: false, version: Number(req.params.version) }).lean();
    if (!version) return res.status(404).json({ message: 'Version not found' });
    res.json(version);
});

// GET /api/workflow-definitions/export
const exportDefinition = asyncHandler(async (req, res) => {
    const processKey = req.query.processKey || 'MH_REQUEST';
    const draft = await WorkflowDefinition.findOne({ processKey, isDraft: true }).lean();
    if (!draft) return res.status(404).json({ message: `No draft found for process '${processKey}'` });
    res.json({ name: draft.name, processKey: draft.processKey, nodes: draft.nodes, edges: draft.edges });
});

// POST /api/workflow-definitions/import
const importDefinition = asyncHandler(async (req, res) => {
    const { processKey = 'MH_REQUEST', name, nodes = [], edges = [] } = req.body;
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
        return res.status(400).json({ message: 'Imported file must contain nodes[] and edges[] arrays.' });
    }
    const draft = await WorkflowDefinition.findOneAndUpdate(
        { processKey, isDraft: true },
        { $set: { name: name || 'Imported Workflow', nodes, edges, updatedBy: req.user._id } },
        { new: true, upsert: true }
    );
    res.json(draft);
});

// POST /api/workflow-definitions/test-run
// Dry-run graph walk given a hypothetical decision sequence. Reads only the
// draft graph and never touches any MHRequest document.
const testRun = asyncHandler(async (req, res) => {
    const processKey = req.body.processKey || 'MH_REQUEST';
    const { startNodeId, decisions = [] } = req.body;
    const draft = await WorkflowDefinition.findOne({ processKey, isDraft: true }).lean();
    if (!draft) return res.status(404).json({ message: `No draft found for process '${processKey}'` });

    const trigger = draft.nodes.find(n => n.type === 'TRIGGER');
    let cursorId = startNodeId || trigger?.id;
    if (!cursorId) return res.status(400).json({ message: 'No starting node — graph has no TRIGGER node.' });

    const path = [cursorId];
    let decisionIndex = 0;
    let hops = 0;

    while (hops++ < 50) {
        const node = draft.nodes.find(n => n.id === cursorId);
        if (!node) return res.json({ path, stoppedReason: `Node '${cursorId}' does not exist in the graph.` });
        if (node.type === 'END') break;

        let edge;
        if (node.type === 'HUMAN_TASK') {
            const decision = decisions[decisionIndex++];
            if (decision === undefined) return res.json({ path, stoppedReason: `Awaiting a decision at '${node.label}' (options: ${(node.config?.decisions || []).join(', ')})` });
            edge = draft.edges.find(e => e.source === node.id && e.label === decision);
            if (!edge) return res.json({ path, stoppedReason: `No connection for decision '${decision}' at '${node.label}'.` });
        } else if (node.type === 'LOGIC') {
            edge = draft.edges.find(e => e.source === node.id); // dry-run: just take the first branch
        } else {
            edge = draft.edges.find(e => e.source === node.id);
        }

        if (!edge) return res.json({ path, stoppedReason: `Node '${node.label}' (${node.id}) has no outgoing connection.` });
        cursorId = edge.target;
        path.push(cursorId);
    }

    res.json({ path, stoppedReason: 'Reached an END node.' });
});

// GET /api/workflow-definitions/presets
const getPresets = asyncHandler(async (req, res) => {
    const processKey = req.query.processKey || 'MH_REQUEST';
    const presets = await WorkflowNodePreset.find({ processKey }).sort({ createdAt: -1 }).lean();
    res.json({ count: presets.length, data: presets });
});

// POST /api/workflow-definitions/presets
const createPreset = asyncHandler(async (req, res) => {
    const { processKey = 'MH_REQUEST', label, nodeType, subtype = '', config = {} } = req.body;
    if (!label || !nodeType) {
        return res.status(400).json({ message: 'label and nodeType are required' });
    }
    const preset = await WorkflowNodePreset.create({
        processKey, label, nodeType, subtype, config, createdBy: req.user._id
    });
    res.status(201).json(preset);
});

// DELETE /api/workflow-definitions/presets/:presetId
const deletePreset = asyncHandler(async (req, res) => {
    const preset = await WorkflowNodePreset.findByIdAndDelete(req.params.presetId);
    if (!preset) return res.status(404).json({ message: 'Preset not found' });
    res.json({ success: true });
});

module.exports = {
    getDraft, saveDraft, publish, getHistory, getVersion, exportDefinition, importDefinition, testRun,
    getPresets, createPreset, deletePreset
};
