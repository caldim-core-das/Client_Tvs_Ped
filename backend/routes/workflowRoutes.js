const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/authMiddleware');

const {
    getWorkflowState,
    getWorkflowQueue,
    submitWorkflowAction,
    getLeadTimeEstimate,
    getNotificationLogs
} = require('../controllers/mhRequestWorkflowController');

// All routes require JWT auth
router.use(protect);

// ─── State & Queue Queries ────────────────────────────────────────────────────

// GET /api/workflow/:requestId/state  — full workflow state for a request
router.get('/:requestId/state', getWorkflowState);

// GET /api/workflow/queue/:queueType  — l1, design, checker, final, production, my-requests
router.get('/queue/:queueType', getWorkflowQueue);

// GET /api/workflow/notifications — Admin only notification log
router.get('/notifications', checkPermission('workflowStudio'), getNotificationLogs);

// GET /api/workflow/lead-time/estimate/:requestId
router.get('/lead-time/estimate/:requestId', getLeadTimeEstimate);

// ─── The single generic transition endpoint ──────────────────────────────────
// Every stage of the MH Request workflow — L1 approval/rejection, PED Engineer
// assignment, design submission/rejection, checker validation, final approval,
// production/implementation/completion — flows through this one route. What's
// allowed, by whom, and what happens next is entirely defined by the published
// WorkflowDefinition graph (see backend/services/workflowEngine.js) and can be
// changed in the Workflow Studio without touching this file.
router.post('/:requestId/workflow-action', submitWorkflowAction);

module.exports = router;
