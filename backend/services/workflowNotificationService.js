/**
 * workflowNotificationService.js
 * Event-driven email notification system for the enterprise workflow.
 * Wraps nodemailer, persists to WorkflowNotificationLog, supports retry.
 */

const nodemailer = require('nodemailer');
const WorkflowNotificationLog = require('../models/WorkflowNotificationLog');

// ─── Transporter factory ──────────────────────────────────────────────────────
function createTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
    return nodemailer.createTransport({
        host:   process.env.SMTP_HOST,
        port:   parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls:    { rejectUnauthorized: false, ciphers: 'SSLv3' },
        requireTLS: true
    });
}

// ─── Email template builder ───────────────────────────────────────────────────
function buildEmailTemplate(event, data) {
    const { request, actor, recipient, leadTime } = data;
    const portalUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const header = (title, subtitle = '') => `
<div style="font-family:Arial,sans-serif;max-width:660px;margin:0 auto;background:#f8fafc;">
  <div style="background:#B31818;color:#fff;padding:24px 28px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:20px;">${title}</h2>
    <p style="margin:6px 0 0;opacity:.8;font-size:13px;">${subtitle || 'TVS-PED Portal · Workflow Notification'}</p>
  </div>
  <div style="padding:24px 28px;background:#fff;border:1px solid #e2e8f0;border-top:none;">`;

    const requestTable = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
      <tr style="background:#f1f5f9;"><td colspan="2" style="padding:8px 12px;font-weight:700;color:#B31818;font-size:12px;text-transform:uppercase;">Request Details</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;width:42%;background:#f8fafc;">Request ID</td><td style="padding:8px 12px;">${request.mhRequestId}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Submitted By</td><td style="padding:8px 12px;">${request.userName}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Department</td><td style="padding:8px 12px;">${request.departmentName}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Equipment</td><td style="padding:8px 12px;">${request.materialHandlingEquipment || '—'}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Plant</td><td style="padding:8px 12px;">${request.plantLocation}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f8fafc;">Request Type</td><td style="padding:8px 12px;">${request.requestType}</td></tr>
    </table>`;

    const footer = `
    <p style="margin:24px 0 0;color:#64748b;font-size:13px;">Regards,<br><strong>TVS-PED Portal</strong></p>
  </div>
  <div style="padding:12px 28px;text-align:center;font-size:11px;color:#94a3b8;">This is an automated notification. Do not reply to this email.</div>
</div>`;

    const portalBtn = `<a href="${portalUrl}" style="display:inline-block;background:#B31818;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:12px;">Open Portal</a>`;

    // ─── Lead Time Status block ─── Consumed/Remaining/% — rendered whenever a
    // leadTime payload with computed status (see backend/utils/leadTimeStatus.js) is passed.
    const leadTimeStatusBlock = (() => {
        if (!leadTime || leadTime.consumedDays === undefined || leadTime.consumedDays === null) return '';
        const STATUS_STYLE = {
            ON_TRACK:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', label: 'On Track' },
            ATTENTION: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'Attention Required' },
            OVERDUE:   { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', label: `Overdue by ${leadTime.overdueByDays} Day(s)` }
        };
        const s = STATUS_STYLE[leadTime.status] || STATUS_STYLE.ON_TRACK;
        return `
    <div style="background:${s.bg};border:1px solid ${s.border};border-radius:8px;padding:14px 20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-weight:700;color:${s.text};font-size:12px;text-transform:uppercase;letter-spacing:.5px;">⏱ Lead Time Status — ${s.label}</p>
      <p style="margin:0;font-size:14px;color:#374151;">
        <strong>${leadTime.consumedDays}</strong> of <strong>${leadTime.estimatedDays}</strong> days consumed
        &nbsp;·&nbsp; <strong>${Math.max(leadTime.remainingDays, 0)}</strong> days remaining
        &nbsp;·&nbsp; ${leadTime.percent}% complete
      </p>
    </div>`;
    })();

    const templates = {
        REQUEST_SUBMITTED: {
            subject: `[TVS-PED] New MH Request — ${request.mhRequestId} — Action Required`,
            html: `${header('New MH Request — Action Required')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p style="color:#475569;">A new MH request requires your <strong>L1 Approval</strong>. Please review the details and the AI Lead Time Insight below.</p>
              ${requestTable}
              ${leadTimeStatusBlock}
              ${leadTime ? `
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-weight:700;color:#15803d;">🤖 AI Lead Time Insight</p>
                <p style="margin:0;font-size:20px;font-weight:700;color:#166534;">Estimated: ${leadTime.estimatedDays} Days</p>
                <p style="margin:4px 0 8px;color:#64748b;font-size:13px;">Confidence: ${leadTime.confidence}%</p>
                <ul style="margin:0;padding-left:18px;color:#374151;font-size:13px;">
                  ${leadTime.factors.map(f => `<li>${f}</li>`).join('')}
                </ul>
                <p style="margin:8px 0 0;font-style:italic;color:#166534;font-size:13px;">💡 ${leadTime.recommendation}</p>
              </div>` : ''}
              ${portalBtn}
              ${footer}`
        },
        L1_APPROVED: {
            subject: `[TVS-PED] Design Assignment — ${request.mhRequestId}`,
            html: `${header('Design Assignment — Action Required')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p style="color:#475569;">You have been assigned as the <strong>Designer</strong> for the following MH Request. Please begin design work promptly.</p>
              ${requestTable}
              ${leadTimeStatusBlock}
              ${portalBtn}
              ${footer}`
        },
        L1_REJECTED: {
            subject: `[TVS-PED] MH Request Rejected — ${request.mhRequestId}`,
            html: `${header('MH Request — Rejected')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p style="color:#475569;">Your MH Request <strong>${request.mhRequestId}</strong> has been rejected at L1 Approval stage.</p>
              ${requestTable}
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 6px;font-weight:700;color:#991b1b;">Rejection Reason:</p>
                <p style="margin:0;color:#374151;">${request.l1ApprovalComment || 'No specific reason provided.'}</p>
              </div>
              <p style="color:#475569;font-size:13px;">Please submit a new request with the required corrections.</p>
              ${footer}`
        },
        DESIGNER_ASSIGNED: {
            subject: `[TVS-PED] Design Assignment — ${request.mhRequestId}`,
            html: `${header('Design Work Assignment')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p>You have been assigned as Designer for request <strong>${request.mhRequestId}</strong>. Please log in and begin your design work.</p>
              ${requestTable}
              ${leadTimeStatusBlock}
              ${portalBtn}
              ${footer}`
        },
        CHECKER_ASSIGNED: {
            subject: `[TVS-PED] Assigned as Checker — ${request.mhRequestId}`,
            html: `${header('Checker Assignment — Design Pending')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p style="color:#475569;">You have been assigned as the <strong>Checker</strong> for the following MH Request. The design is currently in progress — you will be notified as soon as it is submitted for your review.</p>
              ${requestTable}
              ${leadTimeStatusBlock}
              ${portalBtn}
              ${footer}`
        },
        DESIGN_SUBMITTED: {
            subject: `[TVS-PED] Design Ready for Review — ${request.mhRequestId}`,
            html: `${header('Design Submitted — Checker Review Required')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p>The designer has submitted design documents for <strong>${request.mhRequestId}</strong>. Please review and approve or reject the design.</p>
              ${requestTable}
              ${leadTimeStatusBlock}
              ${portalBtn}
              ${footer}`
        },
        DESIGN_APPROVED: {
            subject: `[TVS-PED] Design Approved — Final Sign-off Required — ${request.mhRequestId}`,
            html: `${header('Design Approved — Final Approval Required')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p>The design for <strong>${request.mhRequestId}</strong> has passed Checker Review and is awaiting your Final Approval.</p>
              ${requestTable}
              ${leadTimeStatusBlock}
              ${portalBtn}
              ${footer}`
        },
        DESIGN_REJECTED: {
            subject: `[TVS-PED] Design Returned for Revision — ${request.mhRequestId}`,
            html: `${header('Design Rejected — Revision Required')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p>Your design for <strong>${request.mhRequestId}</strong> has been returned by the Checker for revision.</p>
              ${requestTable}
              ${leadTimeStatusBlock}
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 6px;font-weight:700;color:#991b1b;">Checker Feedback:</p>
                <p style="margin:0;color:#374151;">${request.checkerComment || 'Please review and resubmit.'}</p>
              </div>
              ${portalBtn}
              ${footer}`
        },
        FINAL_APPROVED: {
            subject: `[TVS-PED] Final Approval Granted — ${request.mhRequestId}`,
            html: `${header('Request Cleared for Production')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p>MH Request <strong>${request.mhRequestId}</strong> has received Final Approval and is cleared for Production.</p>
              ${requestTable}
              ${leadTimeStatusBlock}
              ${portalBtn}
              ${footer}`
        },
        FINAL_REJECTED: {
            subject: `[TVS-PED] Final Approval Rejected — Re-evaluation Required — ${request.mhRequestId}`,
            html: `${header('Final Approval Rejected')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p>The Final Approver has rejected <strong>${request.mhRequestId}</strong>. Re-evaluation at L1 level is required.</p>
              ${requestTable}
              ${leadTimeStatusBlock}
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 6px;font-weight:700;color:#991b1b;">Final Approver Comment:</p>
                <p style="margin:0;color:#374151;">${request.finalApprovalComment || 'No comment provided.'}</p>
              </div>
              ${portalBtn}
              ${footer}`
        },
        IN_PRODUCTION: {
            subject: `[TVS-PED] Production Started — ${request.mhRequestId}`,
            html: `${header('Production Started')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p>Production has started for your MH Request <strong>${request.mhRequestId}</strong>.</p>
              ${requestTable}
              ${leadTimeStatusBlock}
              ${footer}`
        },
        COMPLETED: {
            subject: `[TVS-PED] Request Completed — ${request.mhRequestId}`,
            html: `${header('MH Request Completed', 'Full Lifecycle Complete')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p>🎉 Your MH Request <strong>${request.mhRequestId}</strong> has been successfully completed and implemented.</p>
              ${requestTable}
              ${footer}`
        },
        ESCALATION_REMINDER: {
            subject: `[TVS-PED] Reminder — Action Pending on ${request.mhRequestId}`,
            html: `${header('Reminder — Action Pending', 'Lead Time Escalation')}
              <p>Dear <strong>${recipient.name}</strong>,</p>
              <p style="color:#475569;">MH Request <strong>${request.mhRequestId}</strong> is currently awaiting your action at the <strong>${recipient.role}</strong> stage and is consuming more lead time than planned. Please review at your earliest convenience.</p>
              ${requestTable}
              ${leadTimeStatusBlock}
              ${portalBtn}
              ${footer}`
        }
    };

    return templates[event] || { subject: `[TVS-PED] Workflow Update — ${request.mhRequestId}`, html: '' };
}

// ─── Core send function ───────────────────────────────────────────────────────
/**
 * Send a workflow notification email and log it.
 * @param {Object} options
 * @param {Object} options.request    - MHRequest document
 * @param {string} options.event     - Workflow event key
 * @param {Object} options.recipient - { email, name, role }
 * @param {Object} options.actor     - { userId, userName, role }
 * @param {Object} [options.leadTime] - Lead time data (optional)
 */
async function sendWorkflowNotification({ request, event, recipient, actor, leadTime = null }) {
    const transporter = createTransporter();
    const { subject, html } = buildEmailTemplate(event, { request, actor, recipient, leadTime });

    // Create log entry
    const logEntry = await WorkflowNotificationLog.create({
        requestId:     request._id,
        mhRequestId:   request.mhRequestId,
        event,
        recipient:     recipient.email,
        recipientRole: recipient.role || '',
        subject,
        status:        'PENDING',
        attempts:      0,
        triggeredBy: {
            userId:   actor?.userId,
            userName: actor?.userName || '',
            role:     actor?.role || ''
        }
    });

    if (!transporter) {
        console.warn(`[WorkflowNotification] SMTP not configured — skipping email for event ${event}`);
        await WorkflowNotificationLog.findByIdAndUpdate(logEntry._id, {
            status: 'FAILED',
            failureReason: 'SMTP not configured'
        });
        return { success: false, reason: 'SMTP not configured' };
    }

    try {
        await transporter.sendMail({
            from:    process.env.SMTP_USER,
            to:      recipient.email,
            subject,
            html
        });

        await WorkflowNotificationLog.findByIdAndUpdate(logEntry._id, {
            status:  'SENT',
            sentAt:  new Date(),
            attempts: 1
        });

        console.log(`[WorkflowNotification] ✓ Sent ${event} to ${recipient.email}`);
        return { success: true };

    } catch (err) {
        console.error(`[WorkflowNotification] ✗ Failed ${event} to ${recipient.email}:`, err.message);
        const nextRetry = new Date(Date.now() + 60 * 1000);  // 1 min
        await WorkflowNotificationLog.findByIdAndUpdate(logEntry._id, {
            status:        'FAILED',
            attempts:      1,
            failureReason: err.message,
            nextRetryAt:   nextRetry
        });
        return { success: false, reason: err.message };
    }
}

/**
 * Retry failed notifications (call this from a cron job every 15 minutes).
 * Max 3 attempts with exponential backoff.
 */
async function retryFailedNotifications() {
    const now = new Date();
    const pending = await WorkflowNotificationLog.find({
        status:      'FAILED',
        attempts:    { $lt: 3 },
        nextRetryAt: { $lte: now }
    }).limit(50);

    for (const log of pending) {
        const transporter = createTransporter();
        if (!transporter) break;

        try {
            const MHRequest = require('../models/MHRequest');
            const request   = await MHRequest.findById(log.requestId).lean();
            if (!request) continue;

            const { subject, html } = buildEmailTemplate(log.event, {
                request,
                actor:     log.triggeredBy,
                recipient: { email: log.recipient, name: log.recipient, role: log.recipientRole }
            });

            await transporter.sendMail({ from: process.env.SMTP_USER, to: log.recipient, subject, html });

            await WorkflowNotificationLog.findByIdAndUpdate(log._id, {
                status:   'SENT',
                sentAt:   new Date(),
                attempts: log.attempts + 1
            });
        } catch (err) {
            const nextAttempt = log.attempts + 1;
            const backoff     = Math.pow(5, nextAttempt) * 60 * 1000;  // 5min, 25min
            await WorkflowNotificationLog.findByIdAndUpdate(log._id, {
                attempts:      nextAttempt,
                failureReason: err.message,
                status:        nextAttempt >= 3 ? 'PERMANENTLY_FAILED' : 'FAILED',
                nextRetryAt:   new Date(Date.now() + backoff)
            });
        }
    }
}

module.exports = { sendWorkflowNotification, retryFailedNotifications };
