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
const { secureUploadMultiple }                = require('../middleware/secureUploadMiddleware');
const mongoose                                = require('mongoose');

function buildRequestQuery(id) {
    return mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { mhRequestId: id };
}

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

// ─── secureUploadMultiple is used for design documents instead of raw multer ────

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
    const request = await MHRequest.findOne(buildRequestQuery(req.params.requestId))
        .populate('assignedDesigner assignedChecker assignedFinalApprover', 'employeeName mailId employeeId')
        .populate('user', 'email role')
        .lean();

    if (!request) return res.status(404).json({ message: 'Request not found' });

    res.json({
        mhRequestId:    request.mhRequestId,
        workflowState:  request.workflowState || 'SUBMITTED',
        workflowVersion: request.workflowVersion || 2,
        currentStage:   request.currentStage || 1,
        assignments: {
            designer:      request.assignedDesigner,
            checker:       request.assignedChecker,
            finalApprover: request.assignedFinalApprover
        },
        leadTime: buildLeadTimePayload(request),
        stageFlags:   request.stageFlags || {},
        stageHistory: request.stageHistory || [],
        designDocuments: request.designDocuments || []
    });
});

// ─── GET /api/workflow/queue/:queueType ───────────────────────────────────────
// Returns requests for a specific queue (design, checker, finalApproval)
const getWorkflowQueue = asyncHandler(async (req, res) => {
    const { queueType } = req.params;
    const userId = req.user._id;

    let query = {};

    switch (queueType) {
        case 'l1':
            query = {
                $or: [
                    { workflowState: { $in: ['SUBMITTED', 'Notified', 'Assigned', 'Pending', 'REVERTED', 'L1_REJECTED'] } },
                    { workflowStatus: { $in: ['Pending', 'Notified', 'Assigned', 'Active', 'Rejected', 'Reverted'] } },
                    { workflowState: { $exists: false } }
                ]
            };
            break;
        case 'design':
            // L1_APPROVED  → awaiting PED Engineer to assign Designer + Checker
            // DESIGN_IN_PROGRESS / DESIGN_REJECTED → assigned Designer is actively working
            query.workflowState = { $in: ['L1_APPROVED', 'DESIGN_IN_PROGRESS', 'DESIGN_REJECTED'] };
            if (req.user.role === 'PED Engineer') {
                const emp = await Employee.findOne({ userId: userId });
                if (emp) query.assignedEngineer = emp._id;
            } else if (req.user.role === 'Designer') {
                const emp = await Employee.findOne({ userId: userId });
                // Designers only care about requests already handed to them for design work
                query.workflowState = { $in: ['DESIGN_IN_PROGRESS', 'DESIGN_REJECTED'] };
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
        case 'my-requests':
            query.user = userId; // Requests created by the logged in user
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
// L1 Approver approves the request and assigns a PED Engineer. The PED Engineer
// then logs in and assigns the Designer + Checker (see assignDesignTeam below).
const l1Approve = asyncHandler(async (req, res) => {
    const { comment = '', assignEngineerId } = req.body;

    if (!assignEngineerId) {
        return res.status(400).json({ message: 'A PED Engineer must be assigned on L1 Approval' });
    }

    const request = await MHRequest.findOne(buildRequestQuery(req.params.requestId));
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (!isValidTransition(request.workflowState, 'L1_APPROVED')) {
        return res.status(400).json({
            message: `Cannot approve from state '${request.workflowState}'`
        });
    }

    const engineer = await Employee.findById(assignEngineerId);
    if (!engineer) return res.status(404).json({ message: 'PED Engineer employee not found' });

    const l1Comment = comment
        ? `${comment} | Assigned PED Engineer: ${engineer.employeeName}`
        : `Approved and assigned PED Engineer: ${engineer.employeeName}`;

    const historyEntry = buildHistoryEntry({
        stage:   'L1_APPROVAL',
        state:   'L1_APPROVED',
        action:  'PED_ENGINEER_ASSIGNED',
        user:    req.user,
        comment: l1Comment,
        metadata: { assignedEngineer: assignEngineerId }
    });

    await MHRequest.findByIdAndUpdate(request._id, {
        workflowState:     'L1_APPROVED',
        workflowVersion:    2,
        currentStage:       2,
        status:             'Accepted',     // keep legacy field in sync
        assignedEngineer:   assignEngineerId,
        assignedAt:         new Date(),
        workflowStatus:     'Assigned',     // keep legacy field in sync
        l1ApprovalComment:  comment,
        'stageFlags.l1ApprovedAt': new Date(),
        $push: { stageHistory: historyEntry }
    });

    const updatedRequest = await MHRequest.findById(request._id).lean();
    const leadTime = buildLeadTimePayload(updatedRequest);

    // Notifications
    const actor = buildActor(req.user);
    const sendIfEmail = (email, name, role, event) => {
        if (email) sendWorkflowNotification({ request: updatedRequest, event, recipient: { email, name, role }, actor, leadTime }).catch(console.error);
    };

    sendIfEmail(engineer.mailId, engineer.employeeName, 'PED Engineer', 'PED_ENGINEER_ASSIGNED');
    sendIfEmail(request.mailId, request.userName, 'Requester', 'L1_APPROVED');

    res.json({
        success:       true,
        workflowState: 'L1_APPROVED',
        currentStage:  2,
        leadTime,
        message:       `Request approved. PED Engineer ${engineer.employeeName} assigned.`
    });
});

// ─── POST /api/workflow/:requestId/assign-design-team ─────────────────────────
// PED Engineer assigns the Designer + Checker together, moving the request into
// active design work. Mirrors what l1Approve used to do, now moved one stage down.
const assignDesignTeam = asyncHandler(async (req, res) => {
    const { comment = '', assignDesignerId, assignCheckerId } = req.body;

    if (!assignDesignerId || !assignCheckerId) {
        return res.status(400).json({ message: 'Designer and Checker must both be assigned' });
    }

    const request = await MHRequest.findOne(buildRequestQuery(req.params.requestId));
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (!isValidTransition(request.workflowState, 'DESIGN_IN_PROGRESS')) {
        return res.status(400).json({
            message: `Cannot assign Designer/Checker from state '${request.workflowState}'`
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
    const finalApproverEmployee = await Employee.findOne({ role: /^\s*final approver\s*$/i, status: /^\s*active\s*$/i });

    const teamComment = comment
        ? `${comment} | Assigned Designer: ${designer.employeeName}, Checker: ${checker.employeeName}`
        : `Designer: ${designer.employeeName}, Checker: ${checker.employeeName} assigned by PED Engineer`;

    const historyEntry = buildHistoryEntry({
        stage:  'DESIGN',
        state:  'DESIGN_IN_PROGRESS',
        action: 'DESIGNER_ASSIGNED',
        user:   req.user,
        comment: teamComment,
        metadata: { assignedDesigner: assignDesignerId, assignedChecker: assignCheckerId }
    });

    await MHRequest.findByIdAndUpdate(request._id, {
        workflowState:         'DESIGN_IN_PROGRESS',
        currentStage:          3,
        progressStatus:        'Design',   // keep legacy field in sync
        assignedDesigner:      assignDesignerId,
        assignedChecker:       assignCheckerId,
        assignedFinalApprover: finalApproverEmployee?._id || null,
        'stageFlags.designAssignedAt': new Date(),
        $push: { stageHistory: historyEntry }
    });

    const updatedRequest = await MHRequest.findById(request._id).lean();
    const leadTime = buildLeadTimePayload(updatedRequest);

    const actor = buildActor(req.user);
    const sendIfEmail = (email, name, role, event) => {
        if (email) sendWorkflowNotification({ request: updatedRequest, event, recipient: { email, name, role }, actor, leadTime }).catch(console.error);
    };

    sendIfEmail(designer.mailId, designer.employeeName, 'Designer', 'DESIGNER_ASSIGNED');
    sendIfEmail(checker.mailId, checker.employeeName, 'Checker', 'CHECKER_ASSIGNED');

    res.json({
        success:       true,
        workflowState: 'DESIGN_IN_PROGRESS',
        currentStage:  3,
        leadTime,
        message:       `Designer ${designer.employeeName} and Checker ${checker.employeeName} assigned.`
    });
});

// ─── POST /api/workflow/:requestId/l1-reject ──────────────────────────────────
const l1Reject = asyncHandler(async (req, res) => {
    const { comment = '' } = req.body;

    if (!comment || comment.trim().length < 10) {
        return res.status(400).json({ message: 'Rejection comment must be at least 10 characters' });
    }

    const request = await MHRequest.findOne(buildRequestQuery(req.params.requestId));
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

    const request = await MHRequest.findOne(buildRequestQuery(req.params.requestId));
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
        remark:            `Reverted by Designer: ${comment}`,
        revertComment:     comment,
        $push: { stageHistory: historyEntry }
    });

    const updatedRequest = await MHRequest.findById(request._id)
        .populate('assignedEngineer approver', 'mailId employeeName').lean();
    const leadTime = buildLeadTimePayload(updatedRequest);
    const actor    = buildActor(req.user);

    // Collect recipient list: 1) L1 Approver, 2) PED Engineer, 3) Requester / Admin
    const recipients = [];

    // 1. L1 Approver
    let l1App = updatedRequest.approver;
    if (!l1App || !l1App.mailId) {
        l1App = await Employee.findOne({ role: /^\s*l1 approver\s*$/i, status: /^\s*active\s*$/i }).lean();
    }
    if (l1App?.mailId) recipients.push({ email: l1App.mailId, name: l1App.employeeName, role: 'L1 Approver' });

    // 2. PED Engineer
    let pedEng = updatedRequest.assignedEngineer;
    if (!pedEng || !pedEng.mailId) {
        pedEng = await Employee.findOne({ role: /^\s*ped engineer\s*$/i, status: /^\s*active\s*$/i }).lean();
    }
    if (pedEng?.mailId && pedEng.mailId !== l1App?.mailId) {
        recipients.push({ email: pedEng.mailId, name: pedEng.employeeName, role: 'PED Engineer' });
    }

    // 3. Requester / System Admin
    const reqEmail = updatedRequest.mailId;
    if (reqEmail && !recipients.some(r => r.email === reqEmail)) {
        recipients.push({ email: reqEmail, name: updatedRequest.userName || 'Requester', role: 'Requester' });
    }

    // Send email notification to all allocated members
    for (const rec of recipients) {
        sendWorkflowNotification({
            request: { ...updatedRequest, revertComment: comment },
            event: 'REVERTED',
            recipient: rec,
            actor,
            leadTime
        }).catch(console.error);
    }

    res.json({ success: true, workflowState: 'REVERTED', leadTime, message: 'Request reverted back to requester.' });
});

// ─── POST /api/workflow/:requestId/submit-design ──────────────────────────────
const submitDesign = [
    secureUploadMultiple('designDocuments', 10),
    asyncHandler(async (req, res) => {
        const { comment = '' } = req.body;

        const request = await MHRequest.findOne(buildRequestQuery(req.params.requestId));
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
        let checker = updatedRequest.assignedChecker;
        if (!checker || !checker.mailId) {
            checker = await Employee.findOne({ role: /^\s*checker\s*$/i, status: /^\s*active\s*$/i }).lean();
        }
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
    const { action, comment = '', sopAnswers = [] } = req.body;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
    }
    if (action === 'reject' && comment.trim().length < 10) {
        return res.status(400).json({ message: 'Rejection comment required (min 10 characters)' });
    }

    // ── SOP Scoring ──────────────────────────────────────────────────────────
    const SOP_THRESHOLD = 7;  // configurable default — 7 out of 10 rules must pass
    const SOP_TOTAL     = 10;

    let sopScore    = null;
    let sopPassed   = null;
    let sopResult   = null;

    if (Array.isArray(sopAnswers) && sopAnswers.length > 0) {
        // Validate answers array
        const validAnswers = sopAnswers.filter(a =>
            typeof a.ruleIndex === 'number' &&
            a.ruleIndex >= 0 && a.ruleIndex < SOP_TOTAL &&
            ['yes', 'no'].includes(a.answer)
        );

        sopScore  = validAnswers.filter(a => a.answer === 'yes').length;
        sopPassed = sopScore >= SOP_THRESHOLD;
        sopResult = {
            answers:   validAnswers,
            score:     sopScore,
            threshold: SOP_THRESHOLD,
            passed:    sopPassed
        };

        // Enforce SOP pass on approval
        if (action === 'approve' && !sopPassed) {
            return res.status(400).json({
                message: `SOP checklist score (${sopScore}/${SOP_TOTAL}) is below the required threshold of ${SOP_THRESHOLD}. Please resolve failing rules before approving.`
            });
        }

        // All 10 rules must be answered before approving
        if (action === 'approve' && validAnswers.length < SOP_TOTAL) {
            return res.status(400).json({
                message: `All ${SOP_TOTAL} SOP rules must be answered before approving. Currently ${validAnswers.length} answered.`
            });
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const request = await MHRequest.findOne(buildRequestQuery(req.params.requestId));
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
        comment,
        metadata: sopResult
            ? { sopScore, sopPassed, sopThreshold: SOP_THRESHOLD }
            : {}
    });

    const updateData = {
        workflowState:  targetState,
        currentStage:   4,
        checkerComment: comment,
        $push: { stageHistory: historyEntry }
    };

    // Store SOP result if provided
    if (sopResult) {
        updateData.checkerSopResult = sopResult;
    }

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
            comment: `Returned for revision. Checker feedback: ${comment}${sopScore !== null ? ` | SOP Score: ${sopScore}/${SOP_TOTAL}` : ''}`
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
        let fa = updatedRequest.assignedFinalApprover;
        let faEmail = fa?.mailId || fa?.email;
        let faName = fa?.employeeName || fa?.name;

        if (!faEmail) {
            const faEmp = await Employee.findOne({ role: { $regex: /final.*approver/i }, status: /^\s*active\s*$/i }).lean();
            if (faEmp?.mailId) {
                faEmail = faEmp.mailId;
                faName = faEmp.employeeName;
            } else {
                const faUser = await User.findOne({ role: { $regex: /final.*approver/i }, status: /^\s*active\s*$/i }).lean();
                if (faUser?.email) {
                    faEmail = faUser.email;
                    faName = faUser.name;
                }
            }
        }

        if (!faEmail) {
            faEmail = 'thejaashree.thangavel@caldimengg.in';
            faName  = 'Final Approver';
        }

        if (faEmail) {
            sendWorkflowNotification({
                request:   { ...updatedRequest, checkerSopResult: sopResult },
                event:     'DESIGN_APPROVED',
                recipient: { email: faEmail, name: faName || 'Final Approver', role: 'Final Approver' },
                actor,
                leadTime
            }).catch(console.error);
        }
    } else {
        // Notify designer + PED engineer + L1 approver of rejection
        const recipients = [];

        let designer = updatedRequest.assignedDesigner;
        if (!designer || !designer.mailId) {
            designer = await Employee.findOne({ role: /^\s*designer\s*$/i, status: /^\s*active\s*$/i }).lean();
        }
        if (designer?.mailId) {
            recipients.push({ email: designer.mailId, name: designer.employeeName, role: 'Designer' });
        }

        // PED Engineer
        const pedEng = await Employee.findOne({ role: /^\s*ped engineer\s*$/i, status: /^\s*active\s*$/i }).lean();
        if (pedEng?.mailId && !recipients.some(r => r.email === pedEng.mailId)) {
            recipients.push({ email: pedEng.mailId, name: pedEng.employeeName, role: 'PED Engineer' });
        }

        // L1 Approver
        const l1 = await Employee.findOne({ role: /^\s*l1 approver\s*$/i, status: /^\s*active\s*$/i }).lean();
        if (l1?.mailId && !recipients.some(r => r.email === l1.mailId)) {
            recipients.push({ email: l1.mailId, name: l1.employeeName, role: 'L1 Approver' });
        }

        for (const rec of recipients) {
            sendWorkflowNotification({
                request:   { ...updatedRequest, checkerSopResult: sopResult },
                event:     'DESIGN_REJECTED',
                recipient: rec,
                actor,
                leadTime
            }).catch(console.error);
        }
    }

    res.json({
        success:       true,
        workflowState: action === 'approve' ? 'DESIGN_APPROVED' : 'DESIGN_IN_PROGRESS',
        action,
        sopScore,
        sopPassed,
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

    const request = await MHRequest.findOne(buildRequestQuery(req.params.requestId));
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

    const request = await MHRequest.findOne(buildRequestQuery(req.params.requestId));
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
    const request = await MHRequest.findOne(buildRequestQuery(req.params.requestId)).lean();
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
    l1Approve,
    l1Reject,
    assignDesignTeam,
    submitDesign,
    checkDesign,
    finalApprove,
    advanceProduction,
    getLeadTimeEstimate,
    designerReject,
    getNotificationLogs
};
