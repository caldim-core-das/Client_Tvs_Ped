const mongoose = require('mongoose');

const emailLogEntrySchema = new mongoose.Schema({
    sentAt: { type: Date, default: Date.now },
    to: { type: String, default: '' },
    cc: { type: String, default: '' },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    status: { type: String, enum: ['Delivered', 'Failed'], default: 'Delivered' }
}, { _id: true });

const mhRequestSchema = new mongoose.Schema({
    mhRequestId: {
        type: String,
        required: true,
        unique: true
    },
    departmentName: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    requestType: {
        type: String,
        required: true,
        enum: ['New Project', 'Modification', 'Replacement', 'Upgrade', 'Refresh', 'Capacity', 'Special Improvements']
    },
    productModel: {
        type: String,
        required: true
    },
    materialHandlingEquipment: {
        type: String,
        default: ''
    },
    problemStatement: {
        type: String,
        required: true
    },
    handlingPartName: {
        type: String,
        required: true
    },
    materialHandlingLocation: {
        type: String,
        required: true
    },
    plantLocation: {
        type: String,
        required: true,
        enum: [
            'Hosur Plant 1 (TN)',
            'Hosur Plant 2 (TN)',
            'Hosur Plant 3 (TN)',
            'Mysore (KA)',
            'Nalagarh (HP)'
        ]
    },
    from: {
        type: String,
        required: true
    },
    to: {
        type: String,
        required: true
    },
    volumePerDay: {
        type: Number,
        required: true
    },
    mailId: {
        type: String,
        required: true
    },
    drawingFile: {
        type: String,
        default: null
    },
    // ── Existing acceptance workflow status ─────────────────────────────────
    status: {
        type: String,
        default: 'Active',
        enum: ['Active', 'Accepted', 'Rejected']
    },
    progressStatus: {
        type: String,
        default: 'Initial',
        enum: ['Initial', 'Design', 'Design Approved', 'Production', 'Implementation']
    },
    // ── New email & assignment workflow status ───────────────────────────────
    workflowStatus: {
        type: String,
        enum: ['Pending', 'Notified', 'Assigned', 'Rejected', 'In Progress', 'Completed'],
        default: 'Pending'
    },
    // ── Assignment tracking ─────────────────────────────────────────────────
    assignedEngineer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    assignedAt: {
        type: Date,
        default: null
    },
    // ── Approver tracking ───────────────────────────────────────────────────
    approver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    approverEmail: {
        type: String,
        default: ''
    },
    // ── Email log ───────────────────────────────────────────────────────────
    emailLog: {
        type: [emailLogEntrySchema],
        default: []
    },
    // ── Existing fields ─────────────────────────────────────────────────────
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedVendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VendorScoring',
        default: null
    },
    designReceiptFromVendor: {
        type: Boolean,
        default: false
    },
    designApproval: {
        type: Boolean,
        default: false
    },
    production: {
        type: Boolean,
        default: false
    },
    implementation: {
        type: Boolean,
        default: false
    },
    allocationAssetId: {
        type: String,
        default: null
    },
    remark: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    activeStatus: {
        type: Boolean,
        default: true
    },
    history: [{
        action: String,
        date: { type: Date, default: Date.now },
        details: String
    }],

    // ── Enterprise Workflow Engine v2 ──────────────────────────────────────────
    // NOTE: All fields below are additive. Legacy requests are migrated via
    // scripts/migrateWorkflow.js.  workflowVersion: null means pre-v2 (legacy).

    workflowState: {
        type: String,
        enum: [
            'SUBMITTED', 'L1_APPROVED', 'L1_REJECTED',
            'DESIGN_IN_PROGRESS', 'DESIGN_SUBMITTED',
            'DESIGN_APPROVED', 'DESIGN_REJECTED',
            'FINAL_APPROVED', 'FINAL_REJECTED', 'REVERTED',
            'IN_PRODUCTION', 'IMPLEMENTATION', 'COMPLETED', 'CANCELLED'
        ],
        default: null  // null = not yet migrated to v2
    },
    workflowVersion: {
        type: Number,
        default: null  // 2 = enterprise workflow active
    },
    currentStage: {
        type: Number,
        default: null  // 1-7, maps to workflow stages
    },

    // ── Workflow Engine v3 — graph-driven position ─────────────────────────────
    // NOTE: currentNodeId is the real source of truth for "what can happen next".
    // workflowState above is kept as a derived/display-only label (written by the
    // graph engine from edge metadata) so existing dashboards/badges/queries that
    // group or filter by workflowState keep working unchanged.
    currentNodeId: {
        type: String,
        default: null  // id of the node in the active WorkflowDefinition graph
    },
    workflowDefinitionVersion: {
        type: Number,
        default: null  // pins which published graph version this request runs against
    },

    // ── Stage Assignments (set by L1 Approver) ─────────────────────────────────
    assignedDesigner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    assignedChecker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    assignedFinalApprover: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },

    // ── Lead Time Insight ──────────────────────────────────────────────────────
    leadTimeEstimate:    { type: Number, default: null },  // days
    leadTimeConfidence:  { type: Number, default: null },  // 0-100
    leadTimeSource:      { type: String, enum: ['RULE_BASED', 'HISTORICAL', 'ML', null], default: null },
    leadTimeFactors:     { type: [String], default: [] },
    leadTimeGeneratedAt: { type: Date, default: null },

    // ── Design Documents (uploaded by Designer) ────────────────────────────────
    designDocuments: [{
        fileName:   { type: String },
        fileUrl:    { type: String },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        uploadedAt: { type: Date, default: Date.now },
        version:    { type: Number, default: 1 }
    }],

    // ── Immutable Audit Log (append-only) ─────────────────────────────────────
    stageHistory: [{
        stage:     { type: String },
        state:     { type: String },
        action:    { type: String },  // SUBMITTED, APPROVED, REJECTED, ASSIGNED, etc.
        actor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        actorName: { type: String, default: '' },
        actorRole: { type: String, default: '' },
        comment:   { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        metadata:  { type: mongoose.Schema.Types.Mixed, default: {} }
    }],

    // ── Stage Timestamp Flags ──────────────────────────────────────────────────
    stageFlags: {
        l1ApprovedAt:      { type: Date, default: null },
        designAssignedAt:  { type: Date, default: null },
        designSubmittedAt: { type: Date, default: null },
        designApprovedAt:  { type: Date, default: null },
        finalApprovedAt:   { type: Date, default: null },
        productionStartAt: { type: Date, default: null },
        implementedAt:     { type: Date, default: null },
        lastReminderAt:    { type: Date, default: null }
    },

    // ── Approval Comments / Digital Remarks ───────────────────────────────────
    l1ApprovalComment:    { type: String, default: '' },
    checkerComment:       { type: String, default: '' },
    finalApprovalComment: { type: String, default: '' },
    revertComment:        { type: String, default: '' },

    // ── Checker SOP Result (additive — null for pre-SOP records) ─────────────
    checkerSopResult: {
        answers: [{
            ruleIndex: { type: Number },           // 0-9 (maps to 10 SOP rules)
            answer:    { type: String, enum: ['yes', 'no'] }
        }],
        score:     { type: Number, default: null },  // count of 'yes' answers
        threshold: { type: Number, default: 7 },     // configurable pass threshold
        passed:    { type: Boolean, default: null }   // score >= threshold
    }

}, {
    timestamps: true
});

// ── Indexes for workflow queries ──────────────────────────────────────────────
mhRequestSchema.index({ workflowState: 1 });
mhRequestSchema.index({ workflowVersion: 1 });
mhRequestSchema.index({ assignedDesigner: 1 });
mhRequestSchema.index({ assignedChecker: 1 });
mhRequestSchema.index({ assignedFinalApprover: 1 });
mhRequestSchema.index({ workflowState: 1, currentStage: 1 });
mhRequestSchema.index({ 'stageHistory.timestamp': -1 });

module.exports = mongoose.model('MHRequest', mhRequestSchema);
