/**
 * mhRequestWorkflowController.js
 * Thin HTTP layer over the graph-driven workflow engine (backend/services/workflowEngine.js).
 * Replaces the old workflowController.js, which hardcoded one function per
 * transition — every transition now flows through submitWorkflowAction, which
 * defers all role/state/decision logic to the published WorkflowDefinition graph.
 */

const asyncHandler = require('express-async-handler');
const MHRequest = require('../models/MHRequest');
const Employee = require('../models/EmployeeModel');
const { computeLeadTimeStatus } = require('../utils/leadTimeStatus');
const { estimateLeadTime } = require('../services/leadTimeService');
const { secureUploadMultiple } = require('../middleware/secureUploadMiddleware');
const {
    submitAction, getActiveDefinition, findNode, WorkflowEngineError, buildRequestQuery
} = require('../services/workflowEngine');

function buildLeadTimePayload(request) {
    const status = computeLeadTimeStatus({
        createdAt: request.createdAt,
        leadTimeEstimateDays: request.leadTimeEstimate
    });
    if (!status) return null;
    return {
        estimatedDays: request.leadTimeEstimate,
        confidence: request.leadTimeConfidence,
        source: request.leadTimeSource,
        factors: request.leadTimeFactors,
        generatedAt: request.leadTimeGeneratedAt,
        ...status
    };
}

// ─── GET /api/workflow/:requestId/state ──────────────────────────────────────
const getWorkflowState = asyncHandler(async (req, res) => {
    const request = await MHRequest.findOne(buildRequestQuery(req.params.requestId))
        .populate('assignedDesigner assignedChecker assignedFinalApprover assignedEngineer', 'employeeName mailId employeeId')
        .populate('user', 'email role')
        .lean();

    if (!request) return res.status(404).json({ message: 'Request not found' });

    let currentNode = null;
    if (request.currentNodeId) {
        try {
            const definition = await getActiveDefinition('MH_REQUEST', request.workflowDefinitionVersion);
            const node = findNode(definition, request.currentNodeId);
            if (node) currentNode = { id: node.id, type: node.type, subtype: node.subtype, label: node.label, config: node.config };
        } catch (err) {
            console.error('[getWorkflowState] Could not resolve current node:', err.message);
        }
    }

    res.json({
        mhRequestId: request.mhRequestId,
        workflowState: request.workflowState || 'SUBMITTED',
        workflowVersion: request.workflowVersion || 2,
        currentStage: request.currentStage || 1,
        currentNodeId: request.currentNodeId,
        currentNode,
        assignments: {
            pedEngineer: request.assignedEngineer,
            designer: request.assignedDesigner,
            checker: request.assignedChecker,
            finalApprover: request.assignedFinalApprover
        },
        leadTime: buildLeadTimePayload(request),
        stageFlags: request.stageFlags || {},
        stageHistory: request.stageHistory || [],
        designDocuments: request.designDocuments || []
    });
});

// ─── GET /api/workflow/queue/:queueType ───────────────────────────────────────
const QUEUE_NODE_MAP = {
    l1: ['human-l1'],
    design: ['human-ped-assign', 'human-design-submit'],
    checker: ['human-checker'],
    final: ['human-final'],
    production: ['human-production', 'human-implementation', 'human-completed']
};

const getWorkflowQueue = asyncHandler(async (req, res) => {
    const { queueType } = req.params;
    const userId = req.user._id;

    let query = {};

    if (queueType === 'my-requests') {
        query.user = userId;
    } else if (queueType === 'l1') {
        query = {
            $or: [
                { currentNodeId: { $in: QUEUE_NODE_MAP.l1 } },
                // Legacy/pre-migration records that haven't been backfilled yet
                { currentNodeId: { $exists: false } },
                { currentNodeId: null, workflowState: { $in: ['SUBMITTED', 'Notified', 'Assigned', 'Pending', 'REVERTED', 'L1_REJECTED'] } },
                { currentNodeId: null, workflowStatus: { $in: ['Pending', 'Notified', 'Assigned', 'Active', 'Rejected', 'Reverted'] } }
            ]
        };
    } else if (queueType === 'design') {
        const empId = req.user.employeeId?._id || req.user.employeeId;
        if (req.user.role === 'PED Engineer') {
            query.currentNodeId = { $in: QUEUE_NODE_MAP.design };
            if (empId) query.assignedEngineer = empId;
        } else if (req.user.role === 'Designer') {
            query.currentNodeId = 'human-design-submit';
            if (empId) query.assignedDesigner = empId;
        } else {
            query.currentNodeId = { $in: QUEUE_NODE_MAP.design };
        }
    } else if (queueType === 'checker') {
        query.currentNodeId = 'human-checker';
        if (req.user.role === 'Checker') {
            const empId = req.user.employeeId?._id || req.user.employeeId;
            if (empId) query.assignedChecker = empId;
        }
    } else if (queueType === 'final') {
        query.currentNodeId = 'human-final';
    } else if (queueType === 'production') {
        query.currentNodeId = { $in: QUEUE_NODE_MAP.production };
    } else {
        return res.status(400).json({ message: 'Invalid queue type' });
    }

    const requests = await MHRequest.find(query)
        .sort({ createdAt: -1 })
        .populate('user', 'email')
        .populate('assignedDesigner assignedChecker', 'employeeName')
        .select('-stageHistory -emailLog')
        .lean();

    const data = requests.map(r => ({ ...r, leadTime: buildLeadTimePayload(r) }));

    res.json({ count: data.length, data });
});

// ─── POST /api/workflow/:requestId/workflow-action ───────────────────────────
// Single generic endpoint replacing l1-approve / l1-reject / assign-design-team /
// submit-design / designer-reject / check-design / final-approve / advance-production.
// The graph decides what's valid, who can do it, and what happens next.
const submitWorkflowAction = [
    // Conditionally run the secure-upload pipeline BEFORE the body is otherwise
    // consumed, but only when the request's current node actually requires it —
    // multer must run pre-body-parse at the route level, so this can't be
    // decided generically inside the engine after the fact.
    async (req, res, next) => {
        try {
            const lean = await MHRequest.findOne(buildRequestQuery(req.params.requestId)).select('currentNodeId workflowDefinitionVersion').lean();
            if (!lean?.currentNodeId) return next();
            const definition = await getActiveDefinition('MH_REQUEST', lean.workflowDefinitionVersion);
            const node = findNode(definition, lean.currentNodeId);
            if (node?.config?.requiresAction === 'SECURE_FILE_UPLOAD') {
                return secureUploadMultiple('designDocuments', 10)(req, res, next);
            }
            next();
        } catch (err) {
            next();
        }
    },
    asyncHandler(async (req, res) => {
        const { decision, comment = '' } = req.body;

        let payload = req.body.payload;
        if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch { payload = {}; }
        }
        if (!payload || typeof payload !== 'object') payload = {};

        // Multipart requests can't nest a payload object — accept flat fields too.
        const reserved = new Set(['decision', 'comment', 'payload']);
        for (const [key, value] of Object.entries(req.body)) {
            if (!reserved.has(key) && payload[key] === undefined) payload[key] = value;
        }
        if (typeof payload.sopAnswers === 'string') {
            try { payload.sopAnswers = JSON.parse(payload.sopAnswers); } catch { /* leave as-is */ }
        }
        payload.comment = comment;

        try {
            const result = await submitAction(req.params.requestId, {
                decision, actor: req.user, payload, files: req.files || []
            });
            res.json(result);
        } catch (err) {
            if (err instanceof WorkflowEngineError) {
                return res.status(err.status).json({ message: err.message });
            }
            throw err;
        }
    })
];

// ─── GET /api/workflow/lead-time/estimate/:requestId ─────────────────────────
const getLeadTimeEstimate = asyncHandler(async (req, res) => {
    const request = await MHRequest.findOne(buildRequestQuery(req.params.requestId)).lean();
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.leadTimeEstimate !== null && request.leadTimeGeneratedAt) {
        const ageHours = (Date.now() - new Date(request.leadTimeGeneratedAt).getTime()) / 3600000;
        if (ageHours < 24) {
            return res.json({
                cached: true,
                estimatedDays: request.leadTimeEstimate,
                confidence: request.leadTimeConfidence,
                source: request.leadTimeSource,
                factors: request.leadTimeFactors,
                generatedAt: request.leadTimeGeneratedAt
            });
        }
    }

    const estimate = await estimateLeadTime(request);

    await MHRequest.findByIdAndUpdate(request._id, {
        leadTimeEstimate: estimate.estimatedDays,
        leadTimeConfidence: estimate.confidence,
        leadTimeSource: estimate.source,
        leadTimeFactors: estimate.factors,
        leadTimeGeneratedAt: estimate.generatedAt
    });

    res.json({ cached: false, ...estimate });
});

// ─── GET /api/workflow/notifications ─────────────────────────────────────────
const getNotificationLogs = asyncHandler(async (req, res) => {
    const WorkflowNotificationLog = require('../models/WorkflowNotificationLog');
    const logs = await WorkflowNotificationLog.find({})
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
    res.json({ count: logs.length, data: logs });
});

module.exports = {
    getWorkflowState,
    getWorkflowQueue,
    submitWorkflowAction,
    getLeadTimeEstimate,
    getNotificationLogs
};
