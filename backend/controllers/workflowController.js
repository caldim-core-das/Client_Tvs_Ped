/**
 * workflowController.js
 * Enterprise workflow state machine controller for TVS-PED Portal.
 *
 * Handles all 7-stage workflow transitions:
 *   SUBMITTED → L1_APPROVED/L1_REJECTED
 *   L1_APPROVED → DESIGN_IN_PROGRESS (assign designer)
 *   DESIGN_IN_PROGRESS → DESIGN_SUBMITTED
 *   DESIGN_SUBMITTED → DESIGN_APPROVED/DESIGN_REJECTED
 *   DESIGN_APPROVED → FINAL_APPROVED/FINAL_REJECTED
 *   FINAL_APPROVED → IN_PRODUCTION → IMPLEMENTATION → COMPLETED
 */

const asyncHandler = require('express-async-handler');
const MHRequest    = require('../models/MHRequest');
const Employee     = require('../models/EmployeeModel');
const multer       = require('multer');
const path         = require('path');
const fs           = require('fs');

const { isValidTransition, getStageForState } = require('../middleware/workflowAuthMiddleware');
const { sendWorkflowNotification }            = require('../services/workflowNotificationService');
const { estimateLeadTime }                    = require('../services/leadTimeService');
const { sendRequesterStatusEmail }            = require('./emailController');
const { computeLeadTimeStatus }               = require('../utils/leadTimeStatus');

// ─── Helper: build the full leadTime payload (estimate + consumed/remaining/status) ──
function buildLeadTimePayload(request) {
    const status = computeLeadTimeStatus({
        createdAt: request.createdAt,
        leadTimeEstimateDays: request.leadTimeEstimate
    });
    if (!status) return null;
    return {
        estimatedDays:  request.leadTimeEstimate,
        confidence:     request.leadTimeConfidence,
        source:         request.leadTimeSource,
        factors:        request.leadTimeFactors,
        generatedAt:    request.leadTimeGeneratedAt,
        ...status
    };
}

// ─── Multer config for design documents ──────────────────────────────────────
const designStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/DesignDocuments/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, suffix + path.extname(file.originalname));
    }
});
const designUpload = multer({ storage: designStorage });

// ─── Helper: build actor metadata from req.user ───────────────────────────────
function buildActor(user) {
    return {
        userId:   user._id,
        userName: user.employeeId?.employeeName || user.email || '',
        role:     user.role
    };
}

// ─── Helper: append to stageHistory (append-only, never update) ──────────────
function buildHistoryEntry({ stage, state, action, user, comment = '', metadata = {} }) {
    return {
        stage,
        state,
        action,
        actor:     user._id,
        actorName: user.employeeId?.employeeName || user.email || '',
        actorRole: user.role,
        comment,
        timestamp: new Date(),
        metadata
    };
}

// ─── GET /api/workflow/:requestId/state ──────────────────────────────────────
const getWorkflowState = asyncHandler(async (req, res) => {
    const request = await MHRequest.findById(req.params.requestId)
        .populate('assignedDesigner assignedChecker assignedFinalApprover', 'employeeName mailId employeeId')
        .populate('user', 'email role')
        .lean();

    if (!request) return res.status(404).json({ message: 'Request not found' });

    res.json({
        mhRequestId:    request.mhRequestId,
        workflowState:  request.workflowState,
        workflowVersion: request.workflowVersion,
        currentStage:   request.currentStage,
        assignments: {
            designer:      request.assignedDesigner,
            checker:       request.assignedChecker,
            finalApprover: request.assignedFinalApprover
        },
        leadTime: buildLeadTimePayload(request),
        stageFlags:   request.stageFlags,
        stageHistory: request.stageHistory,
        designDocuments: request.designDocuments
    });
});

// ─── GET /api/workflow/queue/:queueType ───────────────────────────────────────
// Returns requests for a specific queue (design, checker, finalApproval)
const getWorkflowQueue = asyncHandler(async (req, res) => {
    const { queueType } = req.params;
    const userId = req.user._id;

    let query = { workflowVersion: 2 };

    switch (queueType) {
        case 'l1':
            query.workflowState = 'SUBMITTED';
            break;
        case 'design':
            query.workflowState = { $in: ['DESIGN_IN_PROGRESS', 'DESIGN_REJECTED'] };
            if (req.user.role === 'Designer') {
                const emp = await Employee.findOne({ userId: userId });
                if (emp) query.assignedDesigner = emp._id;
            }
            break;
        case 'checker':
            query.workflowState = 'DESIGN_SUBMITTED';
            if (req.user.role === 'Checker') {
                const emp = await Employee.findOne({ userId: userId });
                if (emp) query.assignedChecker = emp._id;
            }
            break;
        case 'final':
            query.workflowState = 'DESIGN_APPROVED';
            break;
        case 'production':
            query.workflowState = { $in: ['FINAL_APPROVED', 'IN_PRODUCTION', 'IMPLEMENTATION'] };
            break;
        default:
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

// ─── POST /api/workflow/:requestId/l1-approve ─────────────────────────────────
const l1Approve = asyncHandler(async (req, res) => {
    const { comment = '', assignDesignerId, assignCheckerId } = req.body;

    if (!assignDesignerId || !assignCheckerId) {
        return res.status(400).json({ message: 'Designer and Checker must be assigned on L1 Approval' });
    }

    const request = await MHRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (!isValidTransition(request.workflowState, 'L1_APPROVED')) {
        return res.status(400).json({
            message: `Cannot approve from state '${request.workflowState}'`
        });
    }

    // Validate designer and checker exist and are different people
    const [designer, checker] = await Promise.all([
        Employee.findById(assignDesignerId),
        Employee.findById(assignCheckerId)
    ]);
    if (!designer) return res.status(404).json({ message: 'Designer employee not found' });
    if (!checker)  return res.status(404).json({ message: 'Checker employee not found' });
    if (designer._id.equals(checker._id)) {
        return res.status(400).json({ message: 'Designer and Checker must be different people' });
    }

    // Find the single Final Approver employee
    const finalApproverEmployee = await Employee.findOne({ role: 'Final Approver', status: 'Active' });

    // Apply state transition
    const historyEntry = buildHistoryEntry({
        stage:   'L1_APPROVAL',
        state:   'L1_APPROVED',
        action:  'APPROVED',
        user:    req.user,
        comment,
        metadata: { assignedDesigner: assignDesignerId, assignedChecker: assignCheckerId }
    });

    await MHRequest.findByIdAndUpdate(request._id, {
        workflowState:        'L1_APPROVED',
        workflowVersion:       2,
        currentStage:          2,
        status:                'Accepted',     // keep legacy field in sync
        assignedDesigner:      assignDesignerId,
        assignedChecker:       assignCheckerId,
        assignedFinalApprover: finalApproverEmployee?._id || null,
        l1ApprovalComment:     comment,
        'stageFlags.l1ApprovedAt':     new Date(),
        'stageFlags.designAssignedAt': new Date(),
        $push: { stageHistory: historyEntry }
    });

    // Transition immediately to DESIGN_IN_PROGRESS since designer is assigned
    const designEntry = buildHistoryEntry({
        stage:  'DESIGN',
        state:  'DESIGN_IN_PROGRESS',
        action: 'DESIGNER_ASSIGNED',
        user:   req.user,
        comment: `Designer: ${designer.employeeName}, Checker: ${checker.employeeName}`
    });

    await MHRequest.findByIdAndUpdate(request._id, {
        workflowState: 'DESIGN_IN_PROGRESS',
        currentStage:  3,
        progressStatus: 'Design',   // keep legacy field in sync
        $push: { stageHistory: designEntry }
    });

    const updatedRequest = await MHRequest.findById(request._id).lean();
    const leadTime = buildLeadTimePayload(updatedRequest);

    // Notifications
    const actor = buildActor(req.user);
    const sendIfEmail = (email, name, role, event) => {
        if (email) sendWorkflowNotification({ request: updatedRequest, event, recipient: { email, name, role }, actor, leadTime }).catch(console.error);
    };

    sendIfEmail(designer.mailId, designer.employeeName, 'Designer', 'L1_APPROVED');
    sendIfEmail(checker.mailId, checker.employeeName, 'Checker', 'CHECKER_ASSIGNED');
    sendIfEmail(request.mailId, request.userName, 'Requester', 'L1_APPROVED');

    res.json({
        success:      true,
        workflowState: 'DESIGN_IN_PROGRESS',
        currentStage:  3,
        leadTime,
        message:      `Request approved. Designer ${designer.employeeName} and Checker ${checker.employeeName} assigned.`
    });
});

// ─── POST /api/workflow/:requestId/l1-reject ──────────────────────────────────
const l1Reject = asyncHandler(async (req, res) => {
    const { comment = '' } = req.body;

    if (!comment || comment.trim().length < 10) {
        return res.status(400).json({ message: 'Rejection comment must be at least 10 characters' });
    }

    const request = await MHRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (!isValidTransition(request.workflowState, 'L1_REJECTED')) {
        return res.status(400).json({ message: `Cannot reject from state '${request.workflowState}'` });
    }

    const historyEntry = buildHistoryEntry({
        stage:  'L1_APPROVAL',
        state:  'L1_REJECTED',
        action: 'REJECTED',
        user:   req.user,
        comment
    });

    await MHRequest.findByIdAndUpdate(request._id, {
        workflowState:     'L1_REJECTED',
        currentStage:      2,
        status:            'Rejected',   // keep legacy field in sync
        l1ApprovalComment: comment,
        $push: { stageHistory: historyEntry }
    });

    const updatedRequest = await MHRequest.findById(request._id).lean();
    const leadTime = buildLeadTimePayload(updatedRequest);
    const actor = buildActor(req.user);

    // Workflow Notification
    sendWorkflowNotification({
        request: updatedRequest,
        event:   'L1_REJECTED',
        recipient: { email: request.mailId, name: request.userName, role: 'Requester' },
        actor,
        leadTime
    }).catch(console.error);

    // Request Tracker style email notification
    try {
        const requesterEmployee = await Employee.findOne({ mailId: updatedRequest.mailId })
            || await Employee.findOne({ employeeName: updatedRequest.userName });
        const requesterEmail = requesterEmployee?.mailId || updatedRequest.mailId;
        if (requesterEmail) {
            sendRequesterStatusEmail(requesterEmail, {
                mhRequestId: updatedRequest.mhRequestId,
                userName: updatedRequest.userName,
                status: updatedRequest.status,
                handlingPartName: updatedRequest.handlingPartName,
                departmentName: updatedRequest.departmentName,
                plantLocation: updatedRequest.plantLocation,
                remark: comment
            });
        }
    } catch (emailErr) {
        console.error('[AutoEmail] Could not resolve requester email for status notification:', emailErr.message);
    }

    res.json({ success: true, workflowState: 'L1_REJECTED', leadTime, message: 'Request rejected and requester notified.' });
});

// ─── POST /api/workflow/:requestId/designer-reject ────────────────────────────
const designerReject = asyncHandler(async (req, res) => {
    const { comment = '' } = req.body;

    if (!comment || comment.trim().length < 5) {
        return res.status(400).json({ message: 'Rejection comment must be at least 5 characters' });
    }

    const request = await MHRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (!isValidTransition(request.workflowState, 'REVERTED')) {
        return res.status(400).json({ message: `Cannot revert from state '${request.workflowState}'` });
    }

    const historyEntry = buildHistoryEntry({
        stage:  'DESIGN',
        state:  'REVERTED',
        action: 'REVERTED',
        user:   req.user,
        comment
    });

    await MHRequest.findByIdAndUpdate(request._id, {
        workflowState:     'REVERTED',
        currentStage:      0,
        status:            'Rejected',
        progressStatus:    'Reverted by Designer',
        $push: { stageHistory: historyEntry }
    });

    const updatedRequest = await MHRequest.findById(request._id).lean();
    const leadTime = buildLeadTimePayload(updatedRequest);

    try {
        const requesterEmployee = await Employee.findOne({ mailId: updatedRequest.mailId })
            || await Employee.findOne({ employeeName: updatedRequest.userName });
        const requesterEmail = requesterEmployee?.mailId || updatedRequest.mailId;
        if (requesterEmail) {
            sendRequesterStatusEmail(requesterEmail, {
                mhRequestId: updatedRequest.mhRequestId,
                userName: updatedRequest.userName,
                status: 'Reverted',
                handlingPartName: updatedRequest.handlingPartName,
                departmentName: updatedRequest.departmentName,
                plantLocation: updatedRequest.plantLocation,
                remark: `Sorry, the given request or the requirement is not fulfilling: ${comment}`
            });
        }
    } catch (emailErr) {
        console.error('[AutoEmail] Could not resolve requester email for status notification:', emailErr.message);
    }

    res.json({ success: true, workflowState: 'REVERTED', leadTime, message: 'Request reverted back to requester.' });
});

// ─── POST /api/workflow/:requestId/submit-design ──────────────────────────────
const submitDesign = [
    designUpload.array('designDocuments', 10),
    asyncHandler(async (req, res) => {
        const { comment = '' } = req.body;

        const request = await MHRequest.findById(req.params.requestId);
        if (!request) return res.status(404).json({ message: 'Request not found' });

        if (!isValidTransition(request.workflowState, 'DESIGN_SUBMITTED')) {
            return res.status(400).json({ message: `Cannot submit design from state '${request.workflowState}'` });
        }

        // Build design document entries
        const newDocs = (req.files || []).map(file => ({
            fileName:   file.originalname,
            fileUrl:    `/uploads/DesignDocuments/${file.filename}`,
            uploadedBy: req.user.employeeId?._id || null,
            uploadedAt: new Date(),
            version:    1
        }));

        const historyEntry = buildHistoryEntry({
            stage:  'DESIGN',
            state:  'DESIGN_SUBMITTED',
            action: 'DESIGN_SUBMITTED',
            user:   req.user,
            comment,
            metadata: { filesSubmitted: newDocs.length }
        });

        await MHRequest.findByIdAndUpdate(request._id, {
            workflowState: 'DESIGN_SUBMITTED',
            currentStage:  3,
            'stageFlags.designSubmittedAt': new Date(),
            $push: {
                designDocuments: { $each: newDocs },
                stageHistory:    historyEntry
            }
        });

        const updatedRequest = await MHRequest.findById(request._id)
            .populate('assignedChecker', 'mailId employeeName').lean();
        const leadTime = buildLeadTimePayload(updatedRequest);

        const actor   = buildActor(req.user);
        const checker = updatedRequest.assignedChecker;
        if (checker?.mailId) {
            sendWorkflowNotification({
                request:   updatedRequest,
                event:     'DESIGN_SUBMITTED',
                recipient: { email: checker.mailId, name: checker.employeeName, role: 'Checker' },
                actor,
                leadTime
            }).catch(console.error);
        }

        res.json({
            success:        true,
            workflowState:  'DESIGN_SUBMITTED',
            documentsAdded: newDocs.length,
            leadTime
        });
    })
];

// ─── POST /api/workflow/:requestId/check-design ───────────────────────────────
const checkDesign = asyncHandler(async (req, res) => {
    const { action, comment = '' } = req.body;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
    }
    if (action === 'reject' && comment.trim().length < 10) {
        return res.status(400).json({ message: 'Rejection comment required (min 10 characters)' });
    }

    const request = await MHRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    const targetState = action === 'approve' ? 'DESIGN_APPROVED' : 'DESIGN_REJECTED';
    if (!isValidTransition(request.workflowState, targetState)) {
        return res.status(400).json({ message: `Cannot check design from state '${request.workflowState}'` });
    }

    const historyEntry = buildHistoryEntry({
        stage:  'DESIGN_REVIEW',
        state:  targetState,
        action: action === 'approve' ? 'CHECKER_APPROVED' : 'CHECKER_REJECTED',
        user:   req.user,
        comment
    });

    const updateData = {
        workflowState:  targetState,
        currentStage:   4,
        checkerComment: comment,
        $push: { stageHistory: historyEntry }
    };

    if (action === 'approve') {
        updateData['stageFlags.designApprovedAt'] = new Date();
        updateData.progressStatus = 'Design Approved';  // keep legacy field in sync
    } else {
        // Reject → back to DESIGN_IN_PROGRESS for revision
        updateData.workflowState = 'DESIGN_REJECTED';
        updateData.currentStage  = 3;
        // Immediately set to DESIGN_IN_PROGRESS to allow designer to re-submit
        const revisionEntry = buildHistoryEntry({
            stage:  'DESIGN',
            state:  'DESIGN_IN_PROGRESS',
            action: 'REVISION_REQUIRED',
            user:   req.user,
            comment: `Returned for revision. Checker feedback: ${comment}`
        });
        updateData.$push = { stageHistory: { $each: [historyEntry, revisionEntry] } };
        updateData.workflowState = 'DESIGN_IN_PROGRESS';
    }

    await MHRequest.findByIdAndUpdate(request._id, updateData);

    const updatedRequest = await MHRequest.findById(request._id)
        .populate('assignedDesigner assignedFinalApprover', 'mailId employeeName').lean();
    const leadTime = buildLeadTimePayload(updatedRequest);

    const actor = buildActor(req.user);
    if (action === 'approve') {
        const fa = updatedRequest.assignedFinalApprover;
        if (fa?.mailId) {
            sendWorkflowNotification({
                request:   updatedRequest,
                event:     'DESIGN_APPROVED',
                recipient: { email: fa.mailId, name: fa.employeeName, role: 'Final Approver' },
                actor,
                leadTime
            }).catch(console.error);
        }
    } else {
        const designer = updatedRequest.assignedDesigner;
        if (designer?.mailId) {
            sendWorkflowNotification({
                request:   updatedRequest,
                event:     'DESIGN_REJECTED',
                recipient: { email: designer.mailId, name: designer.employeeName, role: 'Designer' },
                actor,
                leadTime
            }).catch(console.error);
        }
    }

    res.json({
        success:       true,
        workflowState: action === 'approve' ? 'DESIGN_APPROVED' : 'DESIGN_IN_PROGRESS',
        action,
        leadTime
    });
});

// ─── POST /api/workflow/:requestId/final-approve ─────────────────────────────
const finalApprove = asyncHandler(async (req, res) => {
    const { action, comment = '' } = req.body;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
    }
    if (action === 'reject' && comment.trim().length < 10) {
        return res.status(400).json({ message: 'Rejection comment required (min 10 characters)' });
    }

    const request = await MHRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    const targetState = action === 'approve' ? 'FINAL_APPROVED' : 'FINAL_REJECTED';
    if (!isValidTransition(request.workflowState, targetState)) {
        return res.status(400).json({ message: `Cannot final-approve from state '${request.workflowState}'` });
    }

    const historyEntry = buildHistoryEntry({
        stage:  'FINAL_APPROVAL',
        state:  targetState,
        action: action === 'approve' ? 'FINAL_APPROVED' : 'FINAL_REJECTED',
        user:   req.user,
        comment
    });

    const updateData = {
        workflowState:        targetState,
        currentStage:         5,
        finalApprovalComment: comment,
        $push: { stageHistory: historyEntry }
    };

    if (action === 'approve') {
        updateData['stageFlags.finalApprovedAt'] = new Date();
    }

    await MHRequest.findByIdAndUpdate(request._id, updateData);

    const updatedRequest = await MHRequest.findById(request._id).lean();
    const leadTime = buildLeadTimePayload(updatedRequest);
    const actor = buildActor(req.user);

    if (action === 'approve') {
        sendWorkflowNotification({
            request:   updatedRequest,
            event:     'FINAL_APPROVED',
            recipient: { email: request.mailId, name: request.userName, role: 'Requester' },
            actor,
            leadTime
        }).catch(console.error);
    } else {
        // Notify L1 Approver (approver assigned to department)
        sendWorkflowNotification({
            request:   updatedRequest,
            event:     'FINAL_REJECTED',
            recipient: {
                email: request.approverEmail || '',
                name:  'L1 Approver',
                role:  'L1 Approver'
            },
            actor,
            leadTime
        }).catch(console.error);
    }

    res.json({
        success:       true,
        workflowState: targetState,
        action,
        leadTime
    });
});

// ─── PATCH /api/workflow/:requestId/advance-production ────────────────────────
const advanceProduction = asyncHandler(async (req, res) => {
    const { stage, comment = '' } = req.body;

    const validStages = ['IN_PRODUCTION', 'IMPLEMENTATION', 'COMPLETED'];
    if (!validStages.includes(stage)) {
        return res.status(400).json({ message: `Invalid stage. Must be one of: ${validStages.join(', ')}` });
    }

    const request = await MHRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (!isValidTransition(request.workflowState, stage)) {
        return res.status(400).json({
            message: `Cannot advance to '${stage}' from '${request.workflowState}'`
        });
    }

    const stageNum = getStageForState(stage);

    const historyEntry = buildHistoryEntry({
        stage:  `STAGE_${stage}`,
        state:  stage,
        action: stage,
        user:   req.user,
        comment
    });

    const updateData = {
        workflowState: stage,
        currentStage:  stageNum,
        $push: { stageHistory: historyEntry }
    };

    // Sync legacy fields
    if (stage === 'IN_PRODUCTION') {
        updateData.production            = true;
        updateData.progressStatus        = 'Production';
        updateData['stageFlags.productionStartAt'] = new Date();
    } else if (stage === 'IMPLEMENTATION') {
        updateData.implementation        = true;
        updateData.progressStatus        = 'Implementation';
    } else if (stage === 'COMPLETED') {
        updateData['stageFlags.implementedAt'] = new Date();
    }

    await MHRequest.findByIdAndUpdate(request._id, updateData);

    const updatedRequest = await MHRequest.findById(request._id).lean();
    const leadTime = buildLeadTimePayload(updatedRequest);
    const actor = buildActor(req.user);
    const event = stage === 'IN_PRODUCTION' ? 'IN_PRODUCTION' : stage === 'COMPLETED' ? 'COMPLETED' : null;
    if (event) {
        sendWorkflowNotification({
            request:   updatedRequest,
            event,
            recipient: { email: request.mailId, name: request.userName, role: 'Requester' },
            actor,
            leadTime
        }).catch(console.error);
    }

    res.json({ success: true, workflowState: stage, currentStage: stageNum, leadTime });
});

// ─── GET /api/workflow/lead-time/estimate/:requestId ─────────────────────────
const getLeadTimeEstimate = asyncHandler(async (req, res) => {
    const request = await MHRequest.findById(req.params.requestId).lean();
    if (!request) return res.status(404).json({ message: 'Request not found' });

    // Return cached if already calculated
    if (request.leadTimeEstimate !== null && request.leadTimeGeneratedAt) {
        const ageHours = (Date.now() - new Date(request.leadTimeGeneratedAt).getTime()) / 3600000;
        if (ageHours < 24) {
            return res.json({
                cached:        true,
                estimatedDays: request.leadTimeEstimate,
                confidence:    request.leadTimeConfidence,
                source:        request.leadTimeSource,
                factors:       request.leadTimeFactors,
                generatedAt:   request.leadTimeGeneratedAt
            });
        }
    }

    const estimate = await estimateLeadTime(request);

    // Persist the estimate
    await MHRequest.findByIdAndUpdate(request._id, {
        leadTimeEstimate:    estimate.estimatedDays,
        leadTimeConfidence:  estimate.confidence,
        leadTimeSource:      estimate.source,
        leadTimeFactors:     estimate.factors,
        leadTimeGeneratedAt: estimate.generatedAt
    });

    res.json({ cached: false, ...estimate });
});

module.exports = {
    getWorkflowState,
    getWorkflowQueue,
    l1Approve,
    l1Reject,
    submitDesign,
    checkDesign,
    finalApprove,
    advanceProduction,
    getLeadTimeEstimate,
    designerReject
};
