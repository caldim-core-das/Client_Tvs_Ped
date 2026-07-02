const MHRequest = require('../models/MHRequest');
const AssetManagement = require('../models/AssetManagement');
const MHDevelopmentTracker = require('../models/MHDevelopmentTracker');
const Employee = require('../models/EmployeeModel');
const nodemailer = require('nodemailer');
const { sendRequesterStatusEmail } = require('./emailController');
const { estimateLeadTime } = require('../services/leadTimeService');


// ─────────────────────────────────────────────────────────────────────────────
// Helper: build & send auto-notification email to approver on request creation
// ─────────────────────────────────────────────────────────────────────────────
async function sendAutoApproverEmail(savedRequest) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return;

    try {
        // 1. Find approver for the department
        const dept = savedRequest.departmentName;
        const approver = await Employee.findOne({
            role: 'L1 Approver',
            status: 'Active',
            ...(dept ? { departmentName: dept } : {})
        }) || await Employee.findOne({ role: 'L1 Approver', status: 'Active' });

        if (!approver || !approver.mailId) {
            console.warn('[AutoEmail] No approver found for dept:', dept);
            return;
        }

        // 2. Fetch all active PED engineers
        const engineers = await Employee.find({ role: 'PED Engineer', status: 'Active' })
            .select('_id employeeId employeeName mailId departmentName');

        // 3. Build assignment links
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
        const portalUrl  = process.env.FRONTEND_URL || 'http://localhost:5173';

        const engineerRows = engineers.length > 0
            ? engineers.map(e => `
                <tr>
                  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">
                    <strong>${e.employeeName}</strong><br>
                    <span style="color:#64748b;font-size:12px;">${e.employeeId} · ${e.departmentName || ''}</span>
                  </td>
                  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">
                    <a href="${backendUrl}/api/asset-request/${savedRequest._id}/assign-link/${e._id}"
                       style="background:#B31818;color:#fff;padding:7px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
                      Assign
                    </a>
                  </td>
                </tr>`).join('')
            : `<tr><td colspan="2" style="padding:12px;color:#94a3b8;">No PED Engineers registered yet.</td></tr>`;

        const html = `
<div style="font-family:Arial,sans-serif;max-width:660px;margin:0 auto;background:#f8fafc;">
  <div style="background:#B31818;color:#fff;padding:24px 28px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:20px;">New MH Request — Action Required</h2>
    <p style="margin:6px 0 0;opacity:.8;font-size:13px;">TVS-PED Portal · Auto Notification</p>
  </div>
  <div style="padding:24px 28px;background:#fff;border:1px solid #e2e8f0;border-top:none;">
    <p style="margin:0 0 16px;">Dear <strong>${approver.employeeName}</strong>,</p>
    <p style="margin:0 0 20px;color:#475569;">A new Material Handling (MH) request has been submitted and requires your approval. Please review the details below and assign a PED Engineer.</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
      <tr style="background:#f1f5f9;"><td colspan="2" style="padding:8px 12px;font-weight:700;color:#B31818;letter-spacing:.5px;font-size:12px;text-transform:uppercase;">Request Details</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;width:42%;background:#f8fafc;">Request ID</td><td style="padding:8px 12px;">${savedRequest.mhRequestId}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Submitted By</td><td style="padding:8px 12px;">${savedRequest.userName}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Department</td><td style="padding:8px 12px;">${savedRequest.departmentName}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Handling Part</td><td style="padding:8px 12px;">${savedRequest.handlingPartName}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Equipment Type</td><td style="padding:8px 12px;">${savedRequest.materialHandlingEquipment || '—'}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Location</td><td style="padding:8px 12px;">${savedRequest.materialHandlingLocation} (${savedRequest.plantLocation})</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Flow</td><td style="padding:8px 12px;">${savedRequest.from} → ${savedRequest.to}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Volume/Day</td><td style="padding:8px 12px;">${savedRequest.volumePerDay}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Request Type</td><td style="padding:8px 12px;">${savedRequest.requestType}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Problem Statement</td><td style="padding:8px 12px;">${savedRequest.problemStatement}</td></tr>
    </table>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-weight:700;color:#1e40af;font-size:14px;">👷 Assign a PED Engineer</p>
      <p style="margin:0 0 12px;color:#475569;font-size:13px;">Click <strong>Assign</strong> next to an engineer to assign them to this request. The engineer will be automatically notified.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="background:#dbeafe;">
          <th style="padding:8px 12px;text-align:left;color:#1e40af;font-size:12px;">Engineer</th>
          <th style="padding:8px 12px;text-align:center;color:#1e40af;font-size:12px;">Action</th>
        </tr>
        ${engineerRows}
      </table>
    </div>

    <p style="margin:0 0 8px;font-size:13px;color:#475569;">
      You can also view and manage this request in the portal:
      <a href="${portalUrl}/mh-requests" style="color:#B31818;font-weight:600;">Open TVS-PED Portal</a>
    </p>
    <p style="margin:24px 0 0;color:#64748b;font-size:13px;">Regards,<br><strong>TVS-PED Portal</strong></p>
  </div>
  <div style="padding:12px 28px;text-align:center;font-size:11px;color:#94a3b8;">This is an automated notification. Do not reply to this email.</div>
</div>`;

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            tls: { rejectUnauthorized: false }
        });

        const subject = `[Action Required] MH Request ${savedRequest.mhRequestId} — ${savedRequest.handlingPartName}`;

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: approver.mailId,
            subject,
            html
        });

        // Save approver reference + email log + workflowStatus on the request
        await MHRequest.findByIdAndUpdate(savedRequest._id, {
            $set: {
                approver: approver._id,
                approverEmail: approver.mailId,
                workflowStatus: 'Notified'
            },
            $push: {
                emailLog: {
                    sentAt: new Date(),
                    to: approver.mailId,
                    cc: '',
                    subject,
                    body: html,
                    status: 'Delivered'
                }
            }
        });

        console.log(`[AutoEmail] Approval email sent to ${approver.mailId} for ${savedRequest.mhRequestId}`);
    } catch (err) {
        console.error('[AutoEmail] Failed to send approver email:', err.message);
        // Non-fatal — request was saved, email failure should not block the response
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

        // ── Enterprise Workflow v2: set state machine fields ─────────────────────────
        // Non-blocking update — failure here does not affect the saved request
        (async () => {
            try {
                const historyEntry = {
                    stage:     'REQUEST',
                    state:     'SUBMITTED',
                    action:    'SUBMITTED',
                    actor:     req.user._id,
                    actorName: userName,
                    actorRole: req.user.role,
                    comment:   'Request submitted',
                    timestamp: new Date(),
                    metadata:  {}
                };

                await MHRequest.findByIdAndUpdate(savedRequest._id, {
                    workflowState:   'SUBMITTED',
                    workflowVersion: 2,
                    currentStage:    1,
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
            } catch (wfErr) {
                console.error('[WorkflowV2] Non-fatal init error:', wfErr.message);
            }
        })();

        // Auto-send approval email to approver (fire-and-forget, non-blocking)
        sendAutoApproverEmail(savedRequest).catch(e => console.error('[AutoEmail]', e.message));

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
        const request = await MHRequest.findById(req.params.id)
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

        const request = await MHRequest.findByIdAndUpdate(
            req.params.id,
            {
                $set: { assignedEngineer: engineer._id, assignedAt: new Date(), workflowStatus: 'Assigned' },
                $push: { history: { action: 'Updated', date: new Date(), details: `Engineer ${engineer.employeeName} (${engineer.employeeId}) assigned` } }
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

    const errorPage = (msg) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Error</title>
<style>body{font-family:Arial,sans-serif;background:#fff5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.1);padding:40px 48px;max-width:440px;text-align:center;}
.icon{font-size:48px;margin-bottom:16px;}h2{color:#dc2626;margin:0 0 8px;}p{color:#475569;margin:0 0 24px;}
a{background:#B31818;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;}</style>
</head><body><div class="card"><div class="icon">⚠️</div><h2>Something went wrong</h2>
<p>${msg}</p><a href="${portalUrl}/mh-requests">Go to Portal</a></div></body></html>`;

    try {
        const { id, engineerId } = req.params;

        const engineer = await Employee.findById(engineerId);
        if (!engineer) return res.status(404).send(errorPage('Engineer not found. The link may be invalid.'));

        const request = await MHRequest.findByIdAndUpdate(
            id,
            {
                $set: { assignedEngineer: engineer._id, assignedAt: new Date(), workflowStatus: 'Assigned' },
                $push: { history: { action: 'Updated', date: new Date(), details: `Engineer ${engineer.employeeName} (${engineer.employeeId}) assigned via email link` } }
            },
            { new: true }
        );

        if (!request) return res.status(404).send(errorPage('Request not found. It may have been deleted.'));

        // Notify engineer (non-blocking)
        if (process.env.SMTP_HOST && process.env.SMTP_USER && engineer.mailId) {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT) || 587,
                secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
                tls: { rejectUnauthorized: false }
            });
            const subject = `MH Request Assigned to You — ${request.mhRequestId}`;
            const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#B31818;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;"><h2 style="margin:0;font-size:18px;">MH Request Assigned to You</h2></div>
              <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
                <p>Dear <strong>${engineer.employeeName}</strong>,</p>
                <p>You have been assigned to MH request <strong>${request.mhRequestId}</strong>.</p>
                <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
                  <tr><td style="padding:8px;font-weight:600;background:#f8fafc;width:40%;">Handling Part</td><td style="padding:8px;">${request.handlingPartName}</td></tr>
                  <tr><td style="padding:8px;font-weight:600;background:#f8fafc;">Department</td><td style="padding:8px;">${request.departmentName}</td></tr>
                  <tr><td style="padding:8px;font-weight:600;background:#f8fafc;">Plant</td><td style="padding:8px;">${request.plantLocation}</td></tr>
                  <tr><td style="padding:8px;font-weight:600;background:#f8fafc;">Problem</td><td style="padding:8px;">${request.problemStatement}</td></tr>
                </table>
                <a href="${portalUrl}/mh-requests" style="background:#B31818;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;">View in Portal</a>
                <p style="margin-top:24px;color:#64748b;font-size:13px;">Regards,<br>TVS-PED Portal</p>
              </div></div>`;

            transporter.sendMail({ from: process.env.SMTP_USER, to: engineer.mailId, subject, html })
                .then(() => MHRequest.findByIdAndUpdate(id, { $push: { emailLog: { sentAt: new Date(), to: engineer.mailId, cc: '', subject, body: html, status: 'Delivered' } } }).catch(() => {}))
                .catch(e => console.error('[AssignLink] Engineer email failed:', e.message));
        }

        res.send(successPage(`${engineer.employeeName} (${engineer.employeeId})`, request.mhRequestId));
    } catch (err) {
        console.error('[assignEngineerFromLink] Error:', err.message);
        res.status(500).send(errorPage('An unexpected error occurred. Please contact support.'));
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
    addEmailLog,
    assignEngineerFromLink
};
