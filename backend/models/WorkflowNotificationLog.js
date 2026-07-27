const mongoose = require('mongoose');

// ─── WorkflowNotificationLog ──────────────────────────────────────────────────
// Immutable audit log for every workflow email notification attempt.
// Supports retry tracking and compliance reporting.

const workflowNotificationLogSchema = new mongoose.Schema({
    requestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MHRequest',
        required: true
    },
    mhRequestId: {
        type: String,
        required: true
    },
    event: {
        type: String,
        required: true,
        enum: [
            'REQUEST_SUBMITTED',
            'L1_APPROVED',
            'L1_REJECTED',
            'PED_ENGINEER_ASSIGNED',
            'DESIGNER_ASSIGNED',
            'CHECKER_ASSIGNED',
            'DESIGN_SUBMITTED',
            'DESIGN_APPROVED',
            'DESIGN_REJECTED',
            'FINAL_APPROVED',
            'FINAL_REJECTED',
            'IN_PRODUCTION',
            'COMPLETED',
            'ESCALATION_REMINDER'
        ]
    },
    recipient:     { type: String, required: true },
    recipientRole: { type: String, default: '' },
    subject:       { type: String, default: '' },
    status: {
        type: String,
        enum: ['SENT', 'FAILED', 'PENDING', 'PERMANENTLY_FAILED'],
        default: 'PENDING'
    },
    attempts:       { type: Number, default: 0 },
    maxAttempts:    { type: Number, default: 3 },
    sentAt:         { type: Date, default: null },
    nextRetryAt:    { type: Date, default: null },
    failureReason:  { type: String, default: '' },
    triggeredBy: {
        userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String, default: '' },
        role:     { type: String, default: '' }
    }
}, {
    timestamps: true
});

workflowNotificationLogSchema.index({ requestId: 1 });
workflowNotificationLogSchema.index({ event: 1 });
workflowNotificationLogSchema.index({ status: 1 });
workflowNotificationLogSchema.index({ nextRetryAt: 1, status: 1 });  // for retry cron

module.exports = mongoose.model('WorkflowNotificationLog', workflowNotificationLogSchema);
