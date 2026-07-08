const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireWorkflowRole } = require('../middleware/workflowAuthMiddleware');

const {
    getWorkflowState,
    getWorkflowQueue,
    l1Approve,
    l1Reject,
    submitDesign,
    checkDesign,
    finalApprove,
    advanceProduction,
    getLeadTimeEstimate,
    designerReject,
    getNotificationLogs
} = require('../controllers/workflowController');

// All routes require JWT auth
router.use(protect);

// ─── State & Queue Queries ────────────────────────────────────────────────────

// GET /api/workflow/:requestId/state  — full workflow state for a request
router.get('/:requestId/state', getWorkflowState);

// GET /api/workflow/queue/:queueType  — l1, design, checker, final, production, my-requests
router.get('/queue/:queueType', getWorkflowQueue);

// GET /api/workflow/notifications — Admin only notification log
router.get('/notifications', requireWorkflowRole('Admin'), getNotificationLogs);

// GET /api/workflow/lead-time/estimate/:requestId
router.get('/lead-time/estimate/:requestId', getLeadTimeEstimate);

// ─── L1 Approval Stage ───────────────────────────────────────────────────────

// POST /api/workflow/:requestId/l1-approve
router.post(
    '/:requestId/l1-approve',
    requireWorkflowRole('L1 Approver', 'Admin'),
    l1Approve
);

// POST /api/workflow/:requestId/l1-reject
router.post(
    '/:requestId/l1-reject',
    requireWorkflowRole('L1 Approver', 'Admin'),
    l1Reject
);

// ─── Design Stage ─────────────────────────────────────────────────────────────

// POST /api/workflow/:requestId/submit-design  (multipart/form-data)
router.post(
    '/:requestId/submit-design',
    requireWorkflowRole('Designer', 'PED Engineer', 'Admin'),
    submitDesign
);

// POST /api/workflow/:requestId/designer-reject
router.post(
    '/:requestId/designer-reject',
    requireWorkflowRole('Designer', 'PED Engineer', 'Admin'),
    designerReject
);

// ─── Checker Stage ────────────────────────────────────────────────────────────

// POST /api/workflow/:requestId/check-design
router.post(
    '/:requestId/check-design',
    requireWorkflowRole('Checker', 'Admin'),
    checkDesign
);

// ─── Final Approval Stage ─────────────────────────────────────────────────────

// POST /api/workflow/:requestId/final-approve
router.post(
    '/:requestId/final-approve',
    requireWorkflowRole('Final Approver', 'Admin'),
    finalApprove
);

// ─── Production / Implementation Stage ───────────────────────────────────────

// PATCH /api/workflow/:requestId/advance-production
router.patch(
    '/:requestId/advance-production',
    requireWorkflowRole('PED Engineer', 'Admin'),
    advanceProduction
);

module.exports = router;
