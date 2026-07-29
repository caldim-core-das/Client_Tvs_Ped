/**
 * workflowEngine.js
 * Generic graph-driven execution engine for MHRequest workflows.
 *
 * Replaces the old per-transition controller functions
 * (backend/controllers/workflowController.js) with a single entry point,
 * submitAction(), that walks a WorkflowDefinition graph (see
 * backend/models/WorkflowDefinition.js). Editing that graph in the
 * Workflow Studio changes what happens here with zero code changes:
 * every node/edge is read from the database, nothing is hardcoded.
 *
 * ── Node config contracts ────────────────────────────────────────────────────
 * HUMAN_TASK.config: {
 *   allowedRoles: string[],
 *   decisions: string[],                    // must match outgoing edge labels
 *   commentRequiredFor: string[],           // decisions requiring a comment
 *   minCommentLength: number,
 *   requiredPayloadFields: [{ key, label, mustDifferFrom? }],
 *   requiresAction: 'SECURE_FILE_UPLOAD' | null,   // route-level multer gate
 *   preActionKey: string | null,             // run before decision is judged
 *   requirePassingFor: string[]              // decisions needing preAction {passed:true, complete:true}
 * }
 * ROUTING.config: {
 *   targetField: string,                     // MHRequest field to write
 *   assignBy: 'PAYLOAD' | 'ROLE_LOOKUP',
 *   payloadKey: string,                      // when assignBy === 'PAYLOAD'
 *   roleToAssign: string                     // when assignBy === 'ROLE_LOOKUP'
 * }
 * ACTION.config / SLA.config: { actionKey: string, params: object }
 * COMMUNICATION.config: {
 *   templateKey: string,                     // one of the 14 known email events
 *   recipientSource: 'ASSIGNED_FIELD' | 'ROLE_LOOKUP' | 'REQUESTER' | 'STATIC_FIELD',
 *   recipientField: string,                  // ASSIGNED_FIELD / STATIC_FIELD
 *   fallbackRole: string,                    // ASSIGNED_FIELD fallback
 *   roleToAssign: string,                    // ROLE_LOOKUP
 *   staticName: string, staticRole: string    // STATIC_FIELD
 * }
 * LOGIC.config: { field: string, op: 'eq'|'neq'|'gt'|'gte'|'lt'|'lte', value }
 *   — evaluated against the live request; picks the outgoing edge labeled
 *     'true' or 'false'.
 * END.config: { terminalLabel: string }
 *
 * edge.metadata (only meaningful on the human-decision edge — i.e. the edge
 * leaving a HUMAN_TASK — applied once when that edge is taken):
 *   workflowStateLabel: string   — written to request.workflowState (display)
 *   legacyFields: object         — merged onto the request as-is
 *   stageFlag: string            — request.stageFlags[stageFlag] = now
 *   commentField: string         — request[commentField] = payload.comment
 */

const mongoose = require('mongoose');
const MHRequest = require('../models/MHRequest');
const Employee = require('../models/EmployeeModel');
const WorkflowDefinition = require('../models/WorkflowDefinition');
const { sendWorkflowNotification } = require('./workflowNotificationService');
const { estimateLeadTime } = require('./leadTimeService');
const { scoreSopAnswers } = require('./sopScoringService');
const { sendRequesterStatusEmail } = require('../controllers/emailController');
const { sameLocation } = require('../utils/locationMatch');

// Picks the active employee for a role, preferring one whose plantLocation
// matches the request's plantLocation (multiple employees can share a role
// across different locations). Falls back to any active match for that role
// if none share the request's location, so assignment never silently stalls.
async function findEmployeeForRole(role, request) {
    const candidates = await Employee.find({
        role: new RegExp(`^\\s*${role}\\s*$`, 'i'),
        status: /^\s*active\s*$/i
    }).lean();
    if (candidates.length === 0) return null;
    const locationMatch = candidates.find(e => sameLocation(e.plantLocation, request.plantLocation));
    return locationMatch || candidates[0];
}

const MAX_CHAIN_HOPS = 25;

class WorkflowEngineError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function buildRequestQuery(id) {
    return mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { mhRequestId: id };
}

function buildActor(user) {
    return {
        userId: user._id,
        userName: user.employeeId?.employeeName || user.email || '',
        role: user.role
    };
}

function isAdmin(role) {
    const r = (role || '').trim().toLowerCase();
    return r === 'admin' || r === 'system admin' || r.includes('admin');
}

async function getActiveDefinition(processKey = 'MH_REQUEST', version = null) {
    const query = { processKey, isDraft: false };
    if (version) query.version = version;
    else query.isActive = true;
    const definition = await WorkflowDefinition.findOne(query).sort({ version: -1 }).lean();
    if (!definition) throw new WorkflowEngineError(500, `No published WorkflowDefinition found for process '${processKey}'`);
    return definition;
}

function findNode(definition, nodeId) {
    return definition.nodes.find(n => n.id === nodeId) || null;
}

function findEdge(definition, sourceId, label) {
    return definition.edges.find(e => e.source === sourceId && e.label === label) || null;
}

// ─── Recipient resolution for COMMUNICATION nodes ─────────────────────────────
async function resolveRecipient(config, request) {
    switch (config.recipientSource) {
        case 'REQUESTER':
            return request.mailId ? { email: request.mailId, name: request.userName || 'Requester', role: 'Requester' } : null;

        case 'STATIC_FIELD': {
            const email = request[config.recipientField];
            return email ? { email, name: config.staticName || config.recipientField, role: config.staticRole || '' } : null;
        }

        case 'ROLE_LOOKUP': {
            const emp = await findEmployeeForRole(config.roleToAssign, request);
            return emp?.mailId ? { email: emp.mailId, name: emp.employeeName, role: config.roleToAssign } : null;
        }

        case 'ASSIGNED_FIELD': {
            const empId = request[config.recipientField];
            let emp = empId ? await Employee.findById(empId).lean() : null;
            if (!emp?.mailId && config.fallbackRole) {
                emp = await findEmployeeForRole(config.fallbackRole, request);
            }
            return emp?.mailId ? { email: emp.mailId, name: emp.employeeName, role: config.fallbackRole || config.recipientField } : null;
        }

        default:
            return null;
    }
}

// ─── ACTION handler registry — reuses existing services, nothing reimplemented ─
const ACTION_HANDLERS = {
    async SOP_SCORING(node, request, ctx) {
        const result = scoreSopAnswers(ctx.payload.sopAnswers, node.config.params?.threshold, node.config.params?.total);
        request.checkerSopResult = result;
        ctx.actionResult = result;
        return result;
    },
    async LEAD_TIME_ESTIMATE(node, request, ctx) {
        const est = await estimateLeadTime(request);
        request.leadTimeEstimate = est.estimatedDays;
        request.leadTimeConfidence = est.confidence;
        request.leadTimeSource = est.source;
        request.leadTimeFactors = est.factors;
        request.leadTimeGeneratedAt = est.generatedAt;
        ctx.actionResult = est;
        return est;
    },
    async SECURE_FILE_UPLOAD(node, request, ctx) {
        const newDocs = (ctx.files || []).map(f => ({
            fileName: f.originalname,
            fileUrl: `/uploads/DesignDocuments/${f.filename}`,
            uploadedBy: ctx.actor.employeeId?._id || ctx.actor.employeeId || null,
            uploadedAt: new Date(),
            version: 1
        }));
        request.designDocuments.push(...newDocs);
        ctx.actionResult = { documentsAdded: newDocs.length };
        return ctx.actionResult;
    },
    async REQUESTER_STATUS_EMAIL(node, request, ctx) {
        try {
            const requesterEmployee = await Employee.findOne({ mailId: request.mailId })
                || await Employee.findOne({ employeeName: request.userName });
            const requesterEmail = requesterEmployee?.mailId || request.mailId;
            if (requesterEmail) {
                await sendRequesterStatusEmail(requesterEmail, {
                    mhRequestId: request.mhRequestId,
                    userName: request.userName,
                    status: request.status,
                    handlingPartName: request.handlingPartName,
                    departmentName: request.departmentName,
                    plantLocation: request.plantLocation,
                    remark: ctx.payload.comment || ''
                });
            }
        } catch (err) {
            console.error('[workflowEngine] REQUESTER_STATUS_EMAIL failed:', err.message);
        }
    }
};

function evaluateCondition(config, request) {
    const actual = config.field.split('.').reduce((o, k) => (o == null ? o : o[k]), request);
    switch (config.op) {
        case 'eq': return actual === config.value;
        case 'neq': return actual !== config.value;
        case 'gt': return actual > config.value;
        case 'gte': return actual >= config.value;
        case 'lt': return actual < config.value;
        case 'lte': return actual <= config.value;
        default: return false;
    }
}

// ─── Apply the metadata carried on the human-decision edge ────────────────────
function applyEdgeMetadata(request, edge, payload) {
    const meta = edge.metadata || {};
    if (meta.workflowStateLabel) request.workflowState = meta.workflowStateLabel;
    if (meta.legacyFields) Object.assign(request, meta.legacyFields);
    if (meta.stageFlag) {
        if (!request.stageFlags) request.stageFlags = {};
        request.stageFlags[meta.stageFlag] = new Date();
    }
    if (meta.commentField) request[meta.commentField] = payload.comment || '';
}

function buildHistoryEntry({ node, decision, actor, comment, metadata = {} }) {
    return {
        stage: node.subtype || node.type,
        state: node.label,
        action: decision || node.type,
        actor: actor.userId,
        actorName: actor.userName,
        actorRole: actor.role,
        comment: comment || '',
        timestamp: new Date(),
        metadata
    };
}

/**
 * Single entry point for every workflow transition.
 * @param {string} requestId
 * @param {{decision:string, actor:object, payload:object, files:Array}} action
 */
async function submitAction(requestId, { decision, actor: reqUser, payload = {}, files = [] }) {
    const request = await MHRequest.findOne(buildRequestQuery(requestId));
    if (!request) throw new WorkflowEngineError(404, 'Request not found');

    const definition = await getActiveDefinition('MH_REQUEST', request.workflowDefinitionVersion);
    const currentNode = findNode(definition, request.currentNodeId);
    if (!currentNode) throw new WorkflowEngineError(409, 'This request has no valid position in the current workflow graph.');
    if (currentNode.type !== 'HUMAN_TASK') {
        throw new WorkflowEngineError(409, 'This request is not currently awaiting a human action.');
    }

    const cfg = currentNode.config || {};
    const actor = buildActor(reqUser);

    if (!isAdmin(actor.role) && !(cfg.allowedRoles || []).some(r => r.toLowerCase() === (actor.role || '').toLowerCase())) {
        throw new WorkflowEngineError(403, `Role '${actor.role}' is not permitted to act on '${currentNode.label}'. Required: ${(cfg.allowedRoles || []).join(' or ')}`);
    }
    if (!(cfg.decisions || []).includes(decision)) {
        throw new WorkflowEngineError(400, `'${decision}' is not a valid decision for '${currentNode.label}'. Valid: ${(cfg.decisions || []).join(', ')}`);
    }
    if ((cfg.commentRequiredFor || []).includes(decision)) {
        const minLen = cfg.minCommentLength || 1;
        if (!payload.comment || payload.comment.trim().length < minLen) {
            throw new WorkflowEngineError(400, `A comment of at least ${minLen} characters is required for '${decision}'.`);
        }
    }
    for (const field of cfg.requiredPayloadFields || []) {
        if (field.onlyForDecision && field.onlyForDecision !== decision) continue;
        if (!payload[field.key]) {
            throw new WorkflowEngineError(400, `'${field.label || field.key}' is required for '${decision}'.`);
        }
        if (field.mustDifferFrom && payload[field.key] === payload[field.mustDifferFrom]) {
            throw new WorkflowEngineError(400, `'${field.label || field.key}' must be different from '${field.mustDifferFrom}'.`);
        }
    }

    const ctx = { actor: reqUser, payload, files, actionResult: null };

    // Pre-decision action (e.g. Checker SOP scoring) — always runs so the
    // result is persisted regardless of which decision is ultimately taken.
    if (cfg.preActionKey) {
        const handler = ACTION_HANDLERS[cfg.preActionKey];
        if (handler) await handler(currentNode, request, ctx);
        if ((cfg.requirePassingFor || []).includes(decision)) {
            const r = ctx.actionResult;
            if (!r || (!r.complete && !r.passed)) {
                throw new WorkflowEngineError(400, `You must either meet the threshold or answer all checklist items before '${decision}'.`);
            }
            if (!r.passed) {
                throw new WorkflowEngineError(400, `Checklist score (${r.score}) is below the required threshold of ${r.threshold}. Please resolve failing items before '${decision}'.`);
            }
        }
    }

    if (cfg.requiresAction) {
        const handler = ACTION_HANDLERS[cfg.requiresAction];
        if (handler) await handler(currentNode, request, ctx);
    }

    const edge = findEdge(definition, currentNode.id, decision);
    if (!edge) {
        throw new WorkflowEngineError(400, `The workflow graph has no connection for '${decision}' from '${currentNode.label}'. Check the Workflow Studio configuration.`);
    }

    applyEdgeMetadata(request, edge, payload);
    request.stageHistory.push(buildHistoryEntry({
        node: currentNode, decision, actor, comment: payload.comment,
        metadata: { ...ctx.actionResult ? { actionResult: ctx.actionResult } : {}, ...payload }
    }));
    request.currentNodeId = edge.target;
    request.workflowDefinitionVersion = definition.version;
    await request.save();

    // ── Auto-run the chain of non-human nodes until the next gate ───────────
    let hops = 0;
    let cursorId = edge.target;
    while (hops++ < MAX_CHAIN_HOPS) {
        const node = findNode(definition, cursorId);
        if (!node) throw new WorkflowEngineError(500, `Workflow graph references missing node '${cursorId}'.`);
        if (node.type === 'HUMAN_TASK' || node.type === 'END') break;

        if (node.type === 'ROUTING') {
            const { targetField, assignBy, payloadKey, roleToAssign } = node.config;
            let value = null;
            if (assignBy === 'PAYLOAD') {
                value = payload[payloadKey];
                if (value) {
                    const emp = await Employee.findById(value);
                    if (!emp) throw new WorkflowEngineError(404, `Employee not found for '${payloadKey}'.`);
                }
            } else if (assignBy === 'ROLE_LOOKUP') {
                const emp = await findEmployeeForRole(roleToAssign, request);
                value = emp?._id || null;
            }
            if (targetField && value) request[targetField] = value;
            await request.save();
        } else if (node.type === 'ACTION' || node.type === 'SLA') {
            const handler = ACTION_HANDLERS[node.config.actionKey];
            if (handler) await handler(node, request, ctx);
            await request.save();
        } else if (node.type === 'COMMUNICATION') {
            const recipient = await resolveRecipient(node.config, request);
            if (recipient?.email) {
                const leadTime = request.leadTimeEstimate != null ? {
                    estimatedDays: request.leadTimeEstimate, confidence: request.leadTimeConfidence,
                    source: request.leadTimeSource, factors: request.leadTimeFactors, generatedAt: request.leadTimeGeneratedAt
                } : null;
                // Fire-and-forget, same as the old controller — SMTP round-trips
                // shouldn't hold the HTTP response open while the chain advances.
                sendWorkflowNotification({ request, event: node.config.templateKey, recipient, actor, leadTime }).catch(console.error);
            }
        } else if (node.type === 'LOGIC') {
            const result = evaluateCondition(node.config, request);
            const nextEdge = findEdge(definition, node.id, String(result));
            if (!nextEdge) throw new WorkflowEngineError(500, `LOGIC node '${node.id}' has no edge labeled '${result}'.`);
            cursorId = nextEdge.target;
            continue;
        }

        const outEdge = definition.edges.find(e => e.source === node.id);
        if (!outEdge) throw new WorkflowEngineError(500, `Node '${node.id}' has no outgoing connection.`);
        cursorId = outEdge.target;
    }

    request.currentNodeId = cursorId;
    await request.save();

    return {
        success: true,
        workflowState: request.workflowState,
        currentStage: request.currentStage,
        currentNodeId: request.currentNodeId,
        leadTime: request.leadTimeEstimate != null ? {
            estimatedDays: request.leadTimeEstimate, confidence: request.leadTimeConfidence,
            source: request.leadTimeSource, factors: request.leadTimeFactors, generatedAt: request.leadTimeGeneratedAt
        } : null
    };
}

/**
 * Called once, right after a new MHRequest is created, to place it onto the
 * active WorkflowDefinition graph. This only resolves *position* — it walks
 * from the TRIGGER node to the first HUMAN_TASK without executing any
 * ROUTING/ACTION/COMMUNICATION side effects along the way, because the
 * request-creation flow (see mhRequestController.js) already has its own
 * richer initial-notification logic (multi-recipient L1 approver email with
 * inline PED-engineer assignment links, setting `approver`/`approverEmail`)
 * that predates the graph engine and isn't worth flattening into a single
 * generic COMMUNICATION node. If a future Studio edit inserts real ACTION/
 * ROUTING nodes between TRIGGER and the first HUMAN_TASK, they are simply
 * skipped here (position-only) — only pure notification nodes are expected
 * in that stretch of the default graph.
 */
async function initializeWorkflowPosition(request, processKey = 'MH_REQUEST') {
    const definition = await getActiveDefinition(processKey);
    const trigger = definition.nodes.find(n => n.type === 'TRIGGER');
    if (!trigger) throw new WorkflowEngineError(500, `WorkflowDefinition '${processKey}' has no TRIGGER node.`);

    let cursorId = trigger.id;
    let hops = 0;
    while (hops++ < MAX_CHAIN_HOPS) {
        const node = findNode(definition, cursorId);
        if (!node || node.type === 'HUMAN_TASK' || node.type === 'END') break;
        const edge = definition.edges.find(e => e.source === cursorId);
        if (!edge) break;
        cursorId = edge.target;
    }

    request.currentNodeId = cursorId;
    request.workflowDefinitionVersion = definition.version;
    return request;
}

module.exports = {
    submitAction,
    initializeWorkflowPosition,
    getActiveDefinition,
    findNode,
    findEdge,
    WorkflowEngineError,
    buildRequestQuery,
    buildActor,
    isAdmin
};
