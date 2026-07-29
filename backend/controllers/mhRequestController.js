const MHRequest = require('../models/MHRequest');
const AssetManagement = require('../models/AssetManagement');
const MHDevelopmentTracker = require('../models/MHDevelopmentTracker');
const Employee = require('../models/EmployeeModel');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const { sendRequesterStatusEmail } = require('./emailController');
const { estimateLeadTime } = require('../services/leadTimeService');
const { sendWorkflowNotification } = require('../services/workflowNotificationService');
const { computeLeadTimeStatus } = require('../utils/leadTimeStatus');
const { initializeWorkflowPosition, submitAction, WorkflowEngineError } = require('../services/workflowEngine');
const { sameLocation } = require('../utils/locationMatch');

// Narrows a list of active employees to those at the request's plantLocation
// (multiple employees can hold the same role across different locations).
// Falls back to the full list if none share the request's location, so
// notifications/assignment never silently stop for locations that haven't
// been cleaned up in Employee Master yet.
function filterByRequestLocation(employees, request) {
    const matches = employees.filter(e => sameLocation(e.plantLocation, request.plantLocation));
    return matches.length > 0 ? matches : employees;
}


// ─────────────────────────────────────────────────────────────────────────────
// Enterprise Workflow v2: notify the L1 Approver on request submission.
// The email includes a one-click "Assign" link per PED Engineer (assignEngineerFromLink
// below) as a fast path. The L1 Approver can otherwise log in to the portal and use the
// same PED Engineer assignment via workflowController.l1Approve. Either path moves the
// request to L1_APPROVED; the assigned PED Engineer then logs in to assign a Designer +
// Checker together (see workflowController.assignDesignTeam).
// ─────────────────────────────────────────────────────────────────────────────
async function notifyL1OnSubmission(savedRequest, estimate, requester) {
    try {
        // 1. Fetch L1 Approvers from Employee Master, scoped to this request's plant location
        //    (multiple L1 Approvers can exist across locations — pick the ones matching
        //    savedRequest.plantLocation; fall back to all active approvers if none match).
        let approvers = await Employee.find({
            role: /^\s*l1 approver\s*$/i,
            status: /^\s*active\s*$/i
        }).lean();

        if (!approvers || approvers.length === 0) {
            const fallbackApprover = await Employee.findOne({ status: /^\s*active\s*$/i }).lean();
            if (fallbackApprover) approvers = [fallbackApprover];
        } else {
            approvers = filterByRequestLocation(approvers, savedRequest);
        }

        if (!approvers || approvers.length === 0) {
            console.warn('[WorkflowV2] No L1 Approver found for notification.');
            return;
        }

        // 2. Fetch active PED Engineers ONLY from Employee Master (excluding Designers & Requesters),
        //    scoped to this request's plant location the same way as L1 Approvers above.
        let pedEngineers = await Employee.find({
            status: /^\s*active\s*$/i,
            role: /^\s*ped engineer\s*$/i
        }).sort({ employeeName: 1 }).lean();

        if (!pedEngineers || pedEngineers.length === 0) {
            pedEngineers = await Employee.find({
                status: /^\s*active\s*$/i,
                role: { $regex: /ped.*engineer/i }
            }).sort({ employeeName: 1 }).lean();
        }
        pedEngineers = filterByRequestLocation(pedEngineers, savedRequest);

        // 3. Persist primary approver reference in request
        const primaryApprover = approvers[0];
        await MHRequest.findByIdAndUpdate(savedRequest._id, {
            $set: {
                approver: primaryApprover._id,
                approverEmail: primaryApprover.mailId,
                workflowStatus: 'Notified'
            }
        });

        const leadTimeStatus = estimate ? computeLeadTimeStatus({
            createdAt: savedRequest.createdAt,
            leadTimeEstimateDays: estimate.estimatedDays
        }) : null;

        for (const approver of approvers) {
            if (!approver.mailId) continue;

            await sendWorkflowNotification({
                request: savedRequest,
                event: 'REQUEST_SUBMITTED',
                recipient: { email: approver.mailId, name: approver.employeeName, role: 'L1 Approver' },
                actor: { userId: requester?.id || requester?._id, userName: savedRequest.userName, role: 'Requester' },
                pedEngineers,
                leadTime: estimate ? {
                    estimatedDays: estimate.estimatedDays,
                    confidence:    estimate.confidence,
                    source:        estimate.source,
                    factors:       estimate.factors,
                    recommendation: estimate.recommendation,
                    ...leadTimeStatus
                } : null
            });

            console.log(`[WorkflowV2] REQUEST_SUBMITTED notification sent to L1 Approver ${approver.mailId} for ${savedRequest.mhRequestId}`);
        }
    } catch (err) {
        console.error('[WorkflowV2] Failed to notify L1 Approver:', err.message);
    }
}

async function ensureMHDevelopmentTrackerForRequest(request, assetId) {
    if (!request || !request.mhRequestId) return;

    const basePayload = {
        departmentName: request.departmentName,
        userName: request.userName,
        assetRequestId: request.mhRequestId,
        requestType: request.requestType,
        productModel: request.productModel,
        plantLocation: request.plantLocation,
        implementationTarget: null,
        status: 'Not Started',
        currentStage: 'Not Started',
        remarks: ''
    };

    const update = {
        $setOnInsert: basePayload,
        $set: {
            materialHandlingEquipment: request.materialHandlingEquipment || ''
        }
    };

    if (assetId) {
        update.$set.assetId = assetId;
    } else {
        update.$setOnInsert.assetId = '';
    }

    await MHDevelopmentTracker.findOneAndUpdate(
        { assetRequestId: request.mhRequestId },
        update,
        { new: true, upsert: true }
    );
}

// @desc    Create a new MH request
// @route   POST /api/asset-request
// @access  Private
const createMHRequest = async (req, res) => {
    try {
        const data = req.body;

        // Sanitize incoming body for "null" strings from FormData
        const sanitizedData = {};
        Object.keys(data).forEach(key => {
            const value = data[key];
            if (value === 'null' || value === 'undefined' || value === '') {
                sanitizedData[key] = null;
            } else {
                sanitizedData[key] = value;
            }
        });

        const {
            departmentName,
            location,
            userName,
            requestType,
            productModel,
            materialHandlingEquipment,
            problemStatement,
            handlingPartName,
            materialHandlingLocation,
            plantLocation,
            from,
            to,
            volumePerDay
        } = sanitizedData;

        // Validation for required fields
        const requiredFields = [
            'departmentName', 'location', 'userName', 'requestType',
            'productModel', 'problemStatement', 'handlingPartName',
            'materialHandlingLocation', 'plantLocation', 'from', 'to', 'volumePerDay'
        ];

        const missingFields = requiredFields.filter(field => !sanitizedData[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: 'Mandatory fields are missing',
                details: missingFields
            });
        }

        // Generate ID: TVS + FactoryLocCode(3) + DeptCode(3) + Running Serial(4)
        const companyPrefix = "TVS";

        const plantCodes = {
            'Hosur Plant 1 (TN)': 'HSR',
            'Hosur Plant 2 (TN)': 'HSR',
            'Hosur Plant 3 (TN)': 'HSR',
            'Mysore (KA)': 'MYS',
            'Nalagarh (HP)': 'NAL'
        };

        const locPart = plantCodes[plantLocation] || (plantLocation || location || "LOC").replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
        const deptPart = (departmentName || "DEP").replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();

        const idPrefix = `${companyPrefix}/${locPart}/${deptPart}`;

        // Find the last request with the same prefix to determine the next serial number
        // We must escape slashes? No, MongoDB $regex handles literal slashes fine.
        const lastRequest = await MHRequest.findOne({
            mhRequestId: { $regex: `^${idPrefix}` }
        }).sort({ mhRequestId: -1 });

        let nextSerial = 1;
        if (lastRequest && lastRequest.mhRequestId) {
            const lastId = lastRequest.mhRequestId;
            const lastSerialStr = lastId.slice(-3); // Change to 3 digits
            const lastSerial = parseInt(lastSerialStr, 10);
            if (!isNaN(lastSerial)) {
                nextSerial = lastSerial + 1;
            }
        }

        const mhRequestId = `${idPrefix}${nextSerial.toString().padStart(3, '0')}`;

        const newRequest = new MHRequest({
            mhRequestId,
            departmentName,
            location,
            userName,
            requestType,
            productModel,
            materialHandlingEquipment,
            problemStatement,
            handlingPartName,
            materialHandlingLocation,
            plantLocation,
            from,
            to,
            volumePerDay: Number(volumePerDay),
            mailId: sanitizedData.mailId || req.user.email,
            drawingFile: req.file ? req.file.path.replace(/\\/g, '/') : null,
            user: req.user.id,
            history: [{
                action: 'Created',
                date: new Date(),
                details: `MH Request created by ${userName}`
            }]
        });

        const savedRequest = await newRequest.save();

        // ── Enterprise Workflow v2: init state machine, estimate lead time, notify L1 ──
        // Sequential (estimate must exist before we can notify with lead-time context).
        // Non-blocking — failure here does not affect the saved request response.
        (async () => {
            try {
                // Use the logged-in user's real employee name (not the form's userName field)
                const submitterName = req.user.employeeId?.employeeName || req.user.email || userName;
                const historyEntry = {
                    stage:     'REQUEST',
                    state:     'SUBMITTED',
                    action:    'SUBMITTED',
                    actor:     req.user._id,
                    actorName: submitterName,
                    actorRole: req.user.role,
                    comment:   `MH Request submitted for ${userName} — Department: ${departmentName}, Plant: ${plantLocation}`,
                    timestamp: new Date(),
                    metadata:  { requestedFor: userName, department: departmentName, plant: plantLocation }
                };

                // Place the request onto the active WorkflowDefinition graph (position
                // only — notifyL1OnSubmission below already covers the initial
                // notification/approver-field side effects the TRIGGER's chain would
                // otherwise handle generically).
                const graphPosition = {};
                await initializeWorkflowPosition(graphPosition);

                await MHRequest.findByIdAndUpdate(savedRequest._id, {
                    workflowState:   'SUBMITTED',
                    workflowVersion: 2,
                    currentStage:    1,
                    currentNodeId:   graphPosition.currentNodeId,
                    workflowDefinitionVersion: graphPosition.workflowDefinitionVersion,
                    $push: { stageHistory: historyEntry }
                });

                // Auto-generate lead time estimate
                const estimate = await estimateLeadTime(savedRequest);
                await MHRequest.findByIdAndUpdate(savedRequest._id, {
                    leadTimeEstimate:    estimate.estimatedDays,
                    leadTimeConfidence:  estimate.confidence,
                    leadTimeSource:      estimate.source,
                    leadTimeFactors:     estimate.factors,
                    leadTimeGeneratedAt: estimate.generatedAt
                });

                console.log(`[WorkflowV2] Request ${savedRequest.mhRequestId} initialized — Lead Time: ${estimate.estimatedDays} days (${estimate.confidence}% confidence)`);

                // Notify the L1 Approver — single email, replaces the legacy "assign a PED Engineer" flow
                await notifyL1OnSubmission(savedRequest, estimate, req.user);
            } catch (wfErr) {
                console.error('[WorkflowV2] Non-fatal init error:', wfErr.message);
            }
        })();

        res.status(201).json(savedRequest);

    } catch (err) {
        console.error('Create MH Request Error:', err);

        if (err.name === 'ValidationError') {
            const errors = err.errors || {};
            const messages = Object.values(errors)
                .map(e => e.message || (e.reason && e.reason.message) || '')
                .filter(Boolean);
            const message = messages[0] || 'Validation error while creating MH Request';
            return res.status(400).json({ message });
        }

        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid data provided for MH Request creation' });
        }

        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
};

// @desc    Get all active MH requests
// @route   GET /api/asset-request
// @access  Public
const getAllMHRequests = async (req, res) => {
    try {
        const requests = await MHRequest.find({ 
            $or: [
                { activeStatus: true }, 
                { activeStatus: { $exists: false } }
            ] 
        })
            .populate('assignedVendor')
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get single MH request by ID
// @route   GET /api/asset-request/:id
// @access  Public
const getMHRequestById = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
        const query = isObjectId ? { _id: req.params.id } : { mhRequestId: req.params.id };

        const request = await MHRequest.findOne(query)
            .populate('assignedVendor')
            .populate('assignedEngineer', 'employeeId employeeName mailId departmentName')
            .populate('approver', 'employeeId employeeName mailId departmentName');
        if (!request) return res.status(404).json({ message: 'Request not found' });
        res.json(request);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Generate Asset ID for an accepted MH request if missing
// @route   POST /api/asset-request/:id/generate-asset
// @access  Private
const generateAssetForRequest = async (req, res) => {
    try {
        let request = await MHRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.status !== 'Accepted') {
            return res.status(400).json({
                message: 'Request must be Accepted before generating Asset ID.'
            });
        }

        if (request.allocationAssetId) {
            await ensureMHDevelopmentTrackerForRequest(request, request.allocationAssetId);
            return res.json(request);
        }

        const asset = await AssetManagement.create({
            vendorCode: 'AUTO',
            vendorName: 'Auto Generated',
            departmentName: request.departmentName,
            plantLocation: request.plantLocation,
            assetLocation: request.materialHandlingLocation || request.location,
            assetName: request.handlingPartName || request.productModel,
            createdBy: request.user

        });

        request.allocationAssetId = asset.assetId;
        request.progressStatus = 'Implementation';
        request.production = true;
        request.implementation = true;

        request.history.push({
            action: 'Updated',
            date: new Date(),
            details: `Final approval completed. Asset ${asset.assetId} created in Asset Master.`
        });

        await ensureMHDevelopmentTrackerForRequest(request, asset.assetId);

        request = await request.save();

        res.json(request);
    } catch (err) {
        console.error('Generate Asset For Request Error:', err);
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
};

// @desc    Update MH request
// @route   PUT /api/asset-request/:id
// @access  Public
const updateMHRequest = async (req, res) => {
    try {
        const {
            requestType,
            productModel,
            problemStatement,
            handlingPartName,
            materialHandlingEquipment,
            materialHandlingLocation,
            plantLocation,
            from,
            to,
            volumePerDay,
            assignedVendor,
            status,
            designReceiptFromVendor,
            designApproval,
            production,
            implementation,
            remark
        } = req.body;

        const existingRequest = await MHRequest.findById(req.params.id);
        if (!existingRequest) return res.status(404).json({ message: 'Request not found' });

        // ===== STATUS IMMUTABILITY VALIDATION =====
        // Once status is Accepted or Rejected, it cannot be changed
        if (status && existingRequest.status !== status) {
            // Check if current status is already finalized (Accepted or Rejected)
            if (existingRequest.status === 'Accepted') {
                return res.status(400).json({
                    message: 'Cannot modify status. Request has already been Accepted and is now immutable.',
                    currentStatus: existingRequest.status
                });
            }

            if (existingRequest.status === 'Rejected') {
                return res.status(400).json({
                    message: 'Cannot modify status. Request has already been Rejected and is now immutable.',
                    currentStatus: existingRequest.status
                });
            }

            // Only allow transition from Active to Accepted or Rejected
            if (existingRequest.status === 'Active') {
                if (status !== 'Accepted' && status !== 'Rejected') {
                    return res.status(400).json({
                        message: 'Invalid status transition. Status can only be changed from Active to Accepted or Rejected.',
                        currentStatus: existingRequest.status,
                        attemptedStatus: status
                    });
                }
            }
        }
        // ===== END STATUS VALIDATION =====

        // FormData sends everything as strings
        const isImplementation = String(implementation) === 'true';
        const isProduction = String(production) === 'true';
        const isDesignApproval = String(designApproval) === 'true';
        const isDesignReceipt = String(designReceiptFromVendor) === 'true';

        let progressStatus = existingRequest.progressStatus;
        if (isImplementation) progressStatus = 'Implementation';
        else if (isProduction) progressStatus = 'Production';
        else if (isDesignApproval) progressStatus = 'Design Approved';
        else if (isDesignReceipt) progressStatus = 'Design';
        else progressStatus = 'Initial';

        // Build Update Data with safe fallbacks so required fields are never unset
        const updateData = {
            requestType: requestType ?? existingRequest.requestType,
            productModel: productModel ?? existingRequest.productModel,
            problemStatement: problemStatement ?? existingRequest.problemStatement,
            handlingPartName: handlingPartName ?? existingRequest.handlingPartName,
            materialHandlingEquipment: materialHandlingEquipment ?? existingRequest.materialHandlingEquipment,
            materialHandlingLocation: materialHandlingLocation ?? existingRequest.materialHandlingLocation,
            plantLocation: plantLocation ?? existingRequest.plantLocation,
            from: from ?? existingRequest.from,
            to: to ?? existingRequest.to,
            volumePerDay: volumePerDay ? Number(volumePerDay) : existingRequest.volumePerDay,
            status: status || existingRequest.status,
            remark: remark ?? existingRequest.remark,
            drawingFile: req.file ? req.file.path.replace(/\\/g, '/') : existingRequest.drawingFile,
            designReceiptFromVendor: isDesignReceipt,
            designApproval: isDesignApproval,
            production: isProduction,
            implementation: isImplementation,
            progressStatus,
            allocationAssetId: existingRequest.allocationAssetId
        };

        // Vendor cleanup
        if (assignedVendor === 'null' || assignedVendor === '' || !assignedVendor) {
            updateData.assignedVendor = null;
        } else {
            updateData.assignedVendor = typeof assignedVendor === 'object' ? assignedVendor._id : assignedVendor;
        }

        let updatedRequest = await MHRequest.findByIdAndUpdate(
            req.params.id,
            {
                $set: updateData,
                $push: {
                    history: {
                        action: 'Updated',
                        date: new Date(),
                        details: status && existingRequest.status !== status
                            ? `Status changed from ${existingRequest.status} to ${status}`
                            : 'MH Request details updated'
                    }
                }
            },
            { new: true, runValidators: true }
        ).populate('assignedVendor');

        if (!updatedRequest) {
            return res.status(404).json({ message: 'Request not found after update' });
        }

        if (updatedRequest.status === 'Accepted') {
            await ensureMHDevelopmentTrackerForRequest(updatedRequest, updatedRequest.allocationAssetId);
        }

        if (updatedRequest.status === 'Accepted' && !updatedRequest.allocationAssetId) {
            const asset = await AssetManagement.create({
                vendorCode: 'AUTO',
                vendorName: 'Auto Generated',
                departmentName: updatedRequest.departmentName,
                plantLocation: updatedRequest.plantLocation,
                assetLocation: updatedRequest.materialHandlingLocation || updatedRequest.location,
                assetName: updatedRequest.handlingPartName || updatedRequest.productModel,
                createdBy: updatedRequest.user
            });

            updatedRequest.allocationAssetId = asset.assetId;
            updatedRequest.progressStatus = 'Implementation';
            updatedRequest.production = true;
            updatedRequest.implementation = true;

            updatedRequest.history.push({
                action: 'Updated',
                date: new Date(),
                details: `Final approval completed. Asset ${asset.assetId} created in Asset Master.`
            });

            await ensureMHDevelopmentTrackerForRequest(updatedRequest, asset.assetId);

            await updatedRequest.save();
        }

        res.json(updatedRequest);

        // ── Trigger 1: Notify requester when request is Accepted or Rejected ──
        if (status && (status === 'Accepted' || status === 'Rejected') && existingRequest.status !== status) {
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
                        remark: updatedRequest.remark
                    }); // fire and forget — non-fatal
                }
            } catch (emailErr) {
                console.error('[AutoEmail] Could not resolve requester email for status notification:', emailErr.message);
            }
        }
    } catch (err) {
        console.error('Update MH Request Error:', err);

        if (err.name === 'ValidationError') {
            const errors = err.errors || {};
            const messages = Object.values(errors)
                .map(e => e.message || (e.reason && e.reason.message) || '')
                .filter(Boolean);
            const message = messages[0] || 'Validation error while updating MH Request';
            return res.status(400).json({ message });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid data provided for MH Request update' });
        }

        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
};

// @desc    Delete MH request
// @route   DELETE /api/asset-request/:id
// @access  Public
const deleteMHRequest = async (req, res) => {
    try {
        const request = await MHRequest.findByIdAndDelete(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        
        // Cascade delete related records
        if (request.mhRequestId) {
            // Delete related Asset Management records
            const AssetManagement = require('../models/AssetManagement');
            if (request.allocationAssetId) {
                await AssetManagement.findOneAndDelete({ assetId: request.allocationAssetId });
            }
            
            // Delete related MH Development Tracker records
            const MHDevelopmentTracker = require('../models/MHDevelopmentTracker');
            await MHDevelopmentTracker.deleteMany({ assetRequestId: request.mhRequestId });
            
            // Delete related Project Plans
            const ProjectPlan = require('../models/ProjectPlan');
            await ProjectPlan.deleteMany({ assetRequestId: request.mhRequestId });
        }
        
        res.json({ message: 'MH Request and all related data deleted successfully', request });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Generate Asset ID for an accepted MH request if missing
// @route   POST /api/asset-request/:id/generate-asset
// @access  Private

// @desc    Assign PED Engineer to MH request (via app UI)
// @route   PATCH /api/asset-request/:id/assign-engineer
// @access  Private
const assignEngineer = async (req, res) => {
    try {
        const { engineerId } = req.body;
        if (!engineerId) return res.status(400).json({ message: 'engineerId is required' });

        const engineer = await Employee.findById(engineerId);
        if (!engineer) return res.status(404).json({ message: 'Engineer not found' });

        const assignerName = req.user?.employeeId?.employeeName || req.user?.email || 'L1 Approver';
        const request = await MHRequest.findByIdAndUpdate(
            req.params.id,
            {
                $set: { assignedEngineer: engineer._id, assignedAt: new Date(), workflowStatus: 'Assigned' },
                $push: {
                    history: { action: 'Updated', date: new Date(), details: `Engineer ${engineer.employeeName} (${engineer.employeeId}) assigned` },
                    stageHistory: {
                        stage:     'L1_APPROVAL',
                        state:     'L1_APPROVED',
                        action:    'PED_ENGINEER_ASSIGNED',
                        actor:     req.user?._id || null,
                        actorName: assignerName,
                        actorRole: req.user?.role || 'L1 Approver',
                        comment:   `PED Engineer ${engineer.employeeName} (${engineer.employeeId}) was assigned to this request.`,
                        timestamp: new Date(),
                        metadata:  { assignedEngineer: engineer._id, engineerName: engineer.employeeName, engineerEmpId: engineer.employeeId }
                    }
                }
            },
            { new: true }
        )
            .populate('assignedEngineer', 'employeeId employeeName mailId departmentName')
            .populate('approver', 'employeeId employeeName mailId departmentName')
            .populate('assignedVendor');

        if (!request) return res.status(404).json({ message: 'Request not found' });

        // Notify engineer by email
        if (process.env.SMTP_HOST && process.env.SMTP_USER && engineer.mailId) {
            try {
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT) || 587,
                    secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
                    tls: { rejectUnauthorized: false }
                });
                const subject = `MH Request Assigned — ${request.mhRequestId}`;
                const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                    <div style="background:#CC1F1F;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center;"><h2 style="margin:0;">New MH Request Assigned to You</h2></div>
                    <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
                        <p>Dear <strong>${engineer.employeeName}</strong>,</p>
                        <p>A new Man-Hour request has been assigned to you.</p>
                        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                            <tr><td style="padding:8px;font-weight:bold;background:#f8fafc;width:40%;">Request ID</td><td style="padding:8px;">${request.mhRequestId}</td></tr>
                            <tr><td style="padding:8px;font-weight:bold;background:#f8fafc;">Department</td><td style="padding:8px;">${request.departmentName}</td></tr>
                            <tr><td style="padding:8px;font-weight:bold;background:#f8fafc;">Handling Part</td><td style="padding:8px;">${request.handlingPartName}</td></tr>
                            <tr><td style="padding:8px;font-weight:bold;background:#f8fafc;">Problem</td><td style="padding:8px;">${request.problemStatement}</td></tr>
                            <tr><td style="padding:8px;font-weight:bold;background:#f8fafc;">Plant</td><td style="padding:8px;">${request.plantLocation}</td></tr>
                        </table>
                        <p style="color:#64748b;font-size:13px;">Regards,<br>TVS-PED Portal</p>
                    </div></div>`;
                await transporter.sendMail({ from: process.env.SMTP_USER, to: engineer.mailId, subject, html });
                request.emailLog.push({ sentAt: new Date(), to: engineer.mailId, cc: '', subject, body: html, status: 'Delivered' });
                await request.save();
            } catch (emailErr) {
                console.error('[assignEngineer] Engineer notification email failed:', emailErr.message);
            }
        }

        res.json(request);
    } catch (err) {
        console.error('Assign Engineer Error:', err);
        if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid ID format' });
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
};

// @desc    Append email log entry to MH request
// @route   POST /api/asset-request/:id/email-log
// @access  Private
const addEmailLog = async (req, res) => {
    try {
        const { to, cc, subject, body, status } = req.body;
        if (!to || !subject) return res.status(400).json({ message: 'to and subject are required' });

        const request = await MHRequest.findByIdAndUpdate(
            req.params.id,
            {
                $push: { emailLog: { sentAt: new Date(), to, cc: cc || '', subject, body: body || '', status: status || 'Delivered' } },
                $set: { workflowStatus: 'Notified' }
            },
            { new: true }
        )
            .populate('assignedEngineer', 'employeeId employeeName mailId departmentName')
            .populate('approver', 'employeeId employeeName mailId departmentName');

        if (!request) return res.status(404).json({ message: 'Request not found' });
        res.json(request);
    } catch (err) {
        console.error('Add Email Log Error:', err);
        if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid MH Request ID' });
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
};

// @desc    Assign PED Engineer via email link (PUBLIC — no auth required)
// @route   GET /api/asset-request/:id/assign-link/:engineerId
// @access  Public (called from approver's email client)
const assignEngineerFromLink = async (req, res) => {
    const portalUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const successPage = (engName, reqId) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Engineer Assigned</title>
<style>body{font-family:Arial,sans-serif;background:#f0f4ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.1);padding:40px 48px;max-width:440px;text-align:center;}
.icon{font-size:48px;margin-bottom:16px;}h2{color:#B31818;margin:0 0 8px;}p{color:#475569;margin:0 0 24px;}
a{background:#B31818;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;}</style>
</head><body><div class="card"><div class="icon">✅</div><h2>Engineer Assigned!</h2>
<p><strong>${engName}</strong> has been assigned to request <strong>${reqId}</strong>. They have been notified via email.</p>
<a href="${portalUrl}/mh-requests">View in Portal</a></div></body></html>`;

    const confirmPage = (engName, reqId, id, engId) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Confirm Assignment</title>
<style>body{font-family:Arial,sans-serif;background:#f0f4ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.1);padding:40px 48px;max-width:440px;text-align:center;}
.icon{font-size:48px;margin-bottom:16px;}h2{color:#B31818;margin:0 0 8px;}p{color:#475569;margin:0 0 24px;}
button{background:#B31818;border:none;cursor:pointer;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;}
button:hover{background:#991414;}</style>
</head><body><div class="card"><div class="icon">❓</div><h2>Confirm Assignment</h2>
<p>Are you sure you want to assign <strong>${engName}</strong> to request <strong>${reqId}</strong>?</p>
<form method="POST" action="/api/asset-request/${id}/assign-link/${engId}">
  <button type="submit">Confirm Assignment</button>
</form>
</div></body></html>`;

    const errorPage = (msg) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Error</title>
<style>body{font-family:Arial,sans-serif;background:#fff5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.1);padding:40px 48px;max-width:440px;text-align:center;}
.icon{font-size:48px;margin-bottom:16px;}h2{color:#dc2626;margin:0 0 8px;}p{color:#475569;margin:0 0 24px;}
a{background:#B31818;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;}</style>
</head><body><div class="card"><div class="icon">⚠️</div><h2>Something went wrong</h2>
<p>${msg}</p><a href="${portalUrl}/mh-requests">Go to Portal</a></div></body></html>`;

    try {
        const { id, engineerId } = req.params;

        const engQuery = mongoose.Types.ObjectId.isValid(engineerId) ? { _id: engineerId } : { employeeId: engineerId };
        const engineer = await Employee.findOne(engQuery);
        if (!engineer) return res.status(404).send(errorPage('Engineer not found. The link may be invalid.'));

        const reqQuery = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { mhRequestId: id };
        const existing = await MHRequest.findOne(reqQuery).lean();
        if (!existing) return res.status(404).send(errorPage('Request not found. It may have been deleted.'));

        if (req.method === 'GET') {
            return res.send(confirmPage(`${engineer.employeeName} (${engineer.employeeId})`, existing.mhRequestId, id, engineerId));
        }

        // Route through the same graph engine the portal's "Approve & Assign PED
        // Engineer" button uses, so the request's position in the workflow
        // advances correctly regardless of which path (email link or portal
        // login) the L1 Approver takes. This also fires the PED_ENGINEER_ASSIGNED
        // notification via the graph's own Communication node — no separate
        // ad-hoc email needed here.
        const linkActor = { _id: null, employeeId: null, email: 'email-link', role: 'L1 Approver' };
        await submitAction(existing._id, {
            decision: 'Approved',
            actor: linkActor,
            payload: { assignEngineerId: engineer._id.toString(), comment: 'Assigned via approval email link.' },
            files: []
        });

        const request = await MHRequest.findById(existing._id).lean();

        res.send(successPage(`${engineer.employeeName} (${engineer.employeeId})`, request.mhRequestId));
    } catch (err) {
        console.error('[assignEngineerFromLink] Error:', err.message);
        if (err instanceof WorkflowEngineError) {
            return res.status(err.status).send(errorPage(err.message));
        }
        res.status(500).send(errorPage('An unexpected error occurred. Please contact support.'));
    }
};

// @desc    Assign Designer to MH request (via PED Engineer)
// @route   PATCH /api/asset-request/:id/assign-designer
// @access  Private
const assignDesigner = async (req, res) => {
    try {
        const { designerId } = req.body;
        if (!designerId) return res.status(400).json({ message: 'designerId is required' });

        const designer = await Employee.findById(designerId);
        if (!designer) return res.status(404).json({ message: 'Designer not found' });

        const request = await MHRequest.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    assignedDesigner: designer._id,
                    workflowState: 'DESIGN_IN_PROGRESS',
                    currentStage: 3,
                    status: 'Accepted'
                },
                $push: {
                    history: { action: 'Updated', date: new Date(), details: `Designer ${designer.employeeName} (${designer.employeeId}) assigned by PED Engineer` },
                    stageHistory: {
                        stage: 'DESIGN',
                        state: 'DESIGN_IN_PROGRESS',
                        action: 'DESIGNER_ASSIGNED',
                        actor: req.user?._id || null,
                        actorName: req.user?.employeeId?.employeeName || req.user?.email || 'PED Engineer',
                        actorRole: req.user?.role || 'PED Engineer',
                        comment: `Designer ${designer.employeeName} (${designer.employeeId}) was chosen for this design task. Design work is now in progress.`,
                        timestamp: new Date(),
                        metadata: { assignedDesigner: designer._id, designerName: designer.employeeName, designerEmpId: designer.employeeId }
                    }
                }
            },
            { new: true }
        ).populate('assignedEngineer assignedDesigner approver');

        if (!request) return res.status(404).json({ message: 'Request not found' });

        // Send Email Notification to Designer
        if (process.env.SMTP_HOST && process.env.SMTP_USER && designer.mailId) {
            try {
                const port = parseInt(process.env.SMTP_PORT, 10) || 465;
                const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: port,
                    secure: isSecure,
                    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
                    tls: { rejectUnauthorized: false }
                });
                const portalUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                const subject = `Design Assignment — ${request.mhRequestId}`;
                const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <div style="background:#B31818;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;"><h2 style="margin:0;font-size:18px;">Design Assignment Notification</h2></div>
                  <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
                    <p>Dear <strong>${designer.employeeName}</strong>,</p>
                    <p>For the MH request <strong>${request.mhRequestId}</strong>, the PED Engineer has chosen you to design the product. Please log in to the portal to begin your design work.</p>
                    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
                      <tr><td style="padding:8px;font-weight:600;background:#f8fafc;width:40%;">Request ID</td><td style="padding:8px;">${request.mhRequestId}</td></tr>
                      <tr><td style="padding:8px;font-weight:600;background:#f8fafc;">Handling Part</td><td style="padding:8px;">${request.handlingPartName}</td></tr>
                      <tr><td style="padding:8px;font-weight:600;background:#f8fafc;">Department</td><td style="padding:8px;">${request.departmentName}</td></tr>
                      <tr><td style="padding:8px;font-weight:600;background:#f8fafc;">Plant Location</td><td style="padding:8px;">${request.plantLocation}</td></tr>
                      <tr><td style="padding:8px;font-weight:600;background:#f8fafc;">Problem Statement</td><td style="padding:8px;">${request.problemStatement}</td></tr>
                    </table>
                    <a href="${portalUrl}/design-queue" style="background:#B31818;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;">Open Design Queue</a>
                    <p style="margin-top:24px;color:#64748b;font-size:13px;">Regards,<br>TVS-PED Portal</p>
                  </div></div>`;

                transporter.sendMail({ from: process.env.SMTP_USER, to: designer.mailId, subject, html })
                    .then(() => {
                        if (request.emailLog) {
                            MHRequest.findByIdAndUpdate(request._id, {
                                $push: { emailLog: { sentAt: new Date(), to: designer.mailId, cc: '', subject, body: html, status: 'Delivered' } }
                            }).catch(() => {});
                        }
                    })
                    .catch(e => console.error('[assignDesigner] Designer email failed:', e.message));
            } catch (emailErr) {
                console.error('[assignDesigner] Email send failed:', emailErr.message);
            }
        }

        res.json(request);
    } catch (err) {
        console.error('Assign Designer Error:', err);
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
};

module.exports = {
    createMHRequest,
    getAllMHRequests,
    getMHRequestById,
    updateMHRequest,
    deleteMHRequest,
    generateAssetForRequest,
    assignEngineer,
    assignDesigner,
    addEmailLog,
    assignEngineerFromLink
};
