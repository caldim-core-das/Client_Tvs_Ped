/**
 * workflowEscalationCron.js
 * Hourly reminder sweep for enterprise workflow (v2) requests that are behind
 * their estimated lead time. Sends one reminder email (ESCALATION_REMINDER) to
 * whoever currently owns the stage, at most once per 12h cooldown window.
 */

const cron = require('node-cron');
const MHRequest = require('../models/MHRequest');
const Employee = require('../models/EmployeeModel');
const { computeLeadTimeStatus } = require('../utils/leadTimeStatus');
const { sendWorkflowNotification } = require('../services/workflowNotificationService');

const NON_TERMINAL_STATES_WITH_OWNER = [
    'SUBMITTED', 'L1_APPROVED', 'DESIGN_IN_PROGRESS', 'DESIGN_SUBMITTED',
    'DESIGN_APPROVED', 'DESIGN_REJECTED', 'FINAL_REJECTED'
];
const REMINDER_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours

// ─── Resolve who currently owns the request's stage (mirrors workflowController's
// per-stage assignment fields) — returns null when there's no single owner. ────
async function resolveStageOwner(request) {
    switch (request.workflowState) {
        case 'SUBMITTED':
            return request.approverEmail
                ? { email: request.approverEmail, name: 'L1 Approver', role: 'L1 Approver' }
                : null;

        case 'L1_APPROVED':
        case 'DESIGN_IN_PROGRESS':
        case 'DESIGN_REJECTED': {
            if (!request.assignedDesigner) return null;
            const designer = await Employee.findById(request.assignedDesigner).select('mailId employeeName');
            return designer?.mailId ? { email: designer.mailId, name: designer.employeeName, role: 'Designer' } : null;
        }

        case 'DESIGN_SUBMITTED': {
            if (!request.assignedChecker) return null;
            const checker = await Employee.findById(request.assignedChecker).select('mailId employeeName');
            return checker?.mailId ? { email: checker.mailId, name: checker.employeeName, role: 'Checker' } : null;
        }

        case 'DESIGN_APPROVED': {
            if (!request.assignedFinalApprover) return null;
            const fa = await Employee.findById(request.assignedFinalApprover).select('mailId employeeName');
            return fa?.mailId ? { email: fa.mailId, name: fa.employeeName, role: 'Final Approver' } : null;
        }

        case 'FINAL_REJECTED':
            return request.approverEmail
                ? { email: request.approverEmail, name: 'L1 Approver', role: 'L1 Approver' }
                : null;

        default:
            return null; // production stages have no single owner — out of scope for this reminder
    }
}

async function runEscalationCheck() {
    const requests = await MHRequest.find({
        workflowVersion: 2,
        workflowState: { $in: NON_TERMINAL_STATES_WITH_OWNER },
        leadTimeEstimate: { $ne: null }
    }).lean();

    let sent = 0;
    for (const request of requests) {
        const status = computeLeadTimeStatus({
            createdAt: request.createdAt,
            leadTimeEstimateDays: request.leadTimeEstimate
        });
        if (!status || status.status === 'ON_TRACK') continue;

        const lastReminderAt = request.stageFlags?.lastReminderAt;
        if (lastReminderAt && (Date.now() - new Date(lastReminderAt).getTime()) < REMINDER_COOLDOWN_MS) continue;

        const owner = await resolveStageOwner(request);
        if (!owner) continue;

        const leadTime = {
            estimatedDays: request.leadTimeEstimate,
            confidence:    request.leadTimeConfidence,
            source:        request.leadTimeSource,
            factors:       request.leadTimeFactors,
            generatedAt:   request.leadTimeGeneratedAt,
            ...status
        };

        try {
            await sendWorkflowNotification({
                request,
                event:     'ESCALATION_REMINDER',
                recipient: owner,
                actor:     { userId: null, userName: 'System', role: 'Scheduler' },
                leadTime
            });
            await MHRequest.findByIdAndUpdate(request._id, { 'stageFlags.lastReminderAt': new Date() });
            sent++;
        } catch (err) {
            console.error(`[EscalationCron] Failed to send reminder for ${request.mhRequestId}:`, err.message);
        }
    }

    if (sent > 0) console.log(`[EscalationCron] Sent ${sent} escalation reminder(s).`);
    return sent;
}

function initializeWorkflowEscalationCron() {
    // Hourly, on the hour
    cron.schedule('0 * * * *', () => {
        runEscalationCheck().catch(err => console.error('[EscalationCron] Error:', err.message));
    });
    console.log('[Scheduler] Workflow Escalation Cron initialized. (Runs Hourly)');
}

module.exports = { initializeWorkflowEscalationCron, runEscalationCheck };
