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
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: isSecure,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false }
    });
}

// ─── Email template builder ───────────────────────────────────────────────────
function buildEmailTemplate(event, data) {
    const { request, actor, recipient, leadTime, pedEngineers = [] } = data;
    const portalUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

    const header = (title, subtitle = '') => `
<div style="font-family:Arial,sans-serif;max-width:660px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
  <div style="background:#CC1F1F;color:#fff;padding:24px 28px;">
    <h2 style="margin:0;font-size:22px;font-weight:700;">${title}</h2>
    <p style="margin:6px 0 0;opacity:.9;font-size:13px;">${subtitle || 'TVS-PED Portal · Auto Notification'}</p>
  </div>
  <div style="padding:24px 28px;background:#fff;">`;

    const requestDetailsTable = `
    <div style="margin-bottom:24px;border:1px solid #f1f5f9;border-radius:10px;overflow:hidden;">
      <div style="background:#fef2f2;padding:10px 14px;border-bottom:1px solid #fecaca;">
        <span style="font-weight:800;color:#B31818;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">REQUEST DETAILS</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #f8fafc;">
          <td style="padding:10px 14px;font-weight:700;width:38%;background:#f8fafc;color:#334155;">Request ID</td>
          <td style="padding:10px 14px;color:#0f172a;font-weight:600;">${request.mhRequestId || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f8fafc;">
          <td style="padding:10px 14px;font-weight:700;background:#f8fafc;color:#334155;">Submitted By</td>
          <td style="padding:10px 14px;color:#0f172a;">${request.userName || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f8fafc;">
          <td style="padding:10px 14px;font-weight:700;background:#f8fafc;color:#334155;">Department</td>
          <td style="padding:10px 14px;color:#0f172a;">${request.departmentName || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f8fafc;">
          <td style="padding:10px 14px;font-weight:700;background:#f8fafc;color:#334155;">Handling Part</td>
          <td style="padding:10px 14px;color:#0f172a;">${request.handlingPartName || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f8fafc;">
          <td style="padding:10px 14px;font-weight:700;background:#f8fafc;color:#334155;">Equipment Type</td>
          <td style="padding:10px 14px;color:#0f172a;">${request.materialHandlingEquipment || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f8fafc;">
          <td style="padding:10px 14px;font-weight:700;background:#f8fafc;color:#334155;">Location</td>
          <td style="padding:10px 14px;color:#0f172a;">${request.materialHandlingLocation || request.location || request.plantLocation || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f8fafc;">
          <td style="padding:10px 14px;font-weight:700;background:#f8fafc;color:#334155;">Flow</td>
          <td style="padding:10px 14px;color:#0f172a;font-weight:600;">${request.from || ''} &rarr; ${request.to || ''}</td>
        </tr>
        <tr style="border-bottom:1px solid #f8fafc;">
          <td style="padding:10px 14px;font-weight:700;background:#f8fafc;color:#334155;">Volume/Day</td>
          <td style="padding:10px 14px;color:#0f172a;">${request.volumePerDay ?? '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f8fafc;">
          <td style="padding:10px 14px;font-weight:700;background:#f8fafc;color:#334155;">Request Type</td>
          <td style="padding:10px 14px;color:#0f172a;">${request.requestType || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:700;background:#f8fafc;color:#334155;">Problem Statement</td>
          <td style="padding:10px 14px;color:#0f172a;">${request.problemStatement || '—'}</td>
        </tr>
      </table>
    </div>`;

    const requestTable = requestDetailsTable;

    const engineersList = Array.isArray(pedEngineers) ? pedEngineers : [];

    const pedEngineersBox = `
    <div style="background:#eff6ff;border:1px solid #dbeafe;border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:18px;">👱</span>
        <h3 style="margin:0;font-size:15px;font-weight:700;color:#1e3a8a;">Assign a PED Engineer</h3>
      </div>
      <p style="margin:0 0 14px;font-size:13px;color:#475569;line-height:1.4;">
        Click <strong>Assign</strong> next to an engineer to assign them to this request. The engineer will be automatically notified.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #dbeafe;">
        <thead>
          <tr style="background:#dbeafe;color:#1e3a8a;">
            <th style="padding:10px 14px;text-align:left;font-weight:700;">Engineer</th>
            <th style="padding:10px 14px;text-align:right;font-weight:700;width:100px;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${engineersList.length > 0 ? engineersList.map(eng => {
            const reqId = request._id || request.mhRequestId;
            const engId = eng._id || eng.employeeId;
            const assignUrl = `${backendUrl}/api/asset-request/${reqId}/assign-link/${engId}`;
            return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:12px 14px;">
                <div style="font-weight:700;color:#0f172a;font-size:14px;">${eng.employeeName}</div>
                <div style="font-size:12px;color:#64748b;margin-top:2px;">${eng.employeeId || ''} · ${eng.departmentName || ''}</div>
              </td>
              <td style="padding:12px 14px;text-align:right;vertical-align:middle;">
                <a href="${assignUrl}" style="display:inline-block;background:#CC1F1F;color:#ffffff;padding:8px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">Assign</a>
              </td>
            </tr>`;
          }).join('') : `
            <tr>
              <td colspan="2" style="padding:14px;text-align:center;color:#64748b;">No active PED Engineers found in Employee Master.</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>`;

    const footer = `
    <p style="margin:24px 0 0;color:#475569;font-size:13px;">
      You can also view and manage this request in the portal: <a href="${portalUrl}/workflow-queue/l1" style="color:#CC1F1F;font-weight:700;text-decoration:underline;">Open TVS-PED Portal</a>
    </p>
    <p style="margin:20px 0 0;color:#64748b;font-size:13px;">Regards,<br><strong>TVS-PED Portal</strong></p>
  </div>
  <div style="padding:14px 28px;text-align:center;font-size:11px;color:#94a3b8;background:#f8fafc;border-top:1px solid #e2e8f0;">This is an automated notification. Do not reply to this email.</div>
</div>`;

    const portalBtn = `<a href="${portalUrl}" style="display:inline-block;background:#CC1F1F;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:12px;">Open Portal</a>`;

    // ─── SOP Score block — rendered when checkerSopResult is present ─────────
    const sopScoreBlock = (() => {
        const sop = request.checkerSopResult;
        if (!sop || sop.score === null || sop.score === undefined) return '';
        const passed  = sop.passed;
        const bg      = passed ? '#f0fdf4' : '#fef2f2';
        const border  = passed ? '#bbf7d0' : '#fecaca';
        const textCol = passed ? '#166534' : '#991b1b';
        const label   = passed ? '✅ SOP Passed' : '❌ SOP Failed';
        const rows    = Array.isArray(sop.answers)
            ? sop.answers.map(a => `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:6px 12px;font-size:12px;color:#374151;">Rule ${a.ruleIndex + 1}</td>
                <td style="padding:6px 12px;font-size:12px;font-weight:700;color:${a.answer === 'yes' ? '#166534' : '#991b1b'}">${a.answer === 'yes' ? '✓ Yes' : '✗ No'}</td>
              </tr>`).join('')
            : '';
        return `
    <div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-weight:700;color:${textCol};font-size:13px;text-transform:uppercase;letter-spacing:.5px;">
        🔍 Checker SOP Review — ${label}
      </p>
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">
        Score: <strong>${sop.score} / ${sop.threshold || 10}</strong> &nbsp;·&nbsp; Threshold: <strong>${sop.threshold || 7}</strong>
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:6px;overflow:hidden;border:1px solid ${border};">
        <thead>
          <tr style="background:${border};">
            <th style="padding:8px 12px;text-align:left;font-weight:700;color:${textCol};">SOP Rule</th>
            <th style="padding:8px 12px;text-align:left;font-weight:700;color:${textCol};width:80px;">Answer</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
    })();

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
            subject: `New MH Request — Action Required (${request.mhRequestId})`,
            html: `${header('New MH Request — Action Required')}
              <p style="font-size:14px;color:#0f172a;margin-top:0;">Dear <strong>${recipient.name}</strong> ,</p>
              <p style="color:#475569;font-size:14px;line-height:1.5;margin-bottom:20px;">
                A new Material Handling (MH) request has been submitted and requires your approval. Please review the details below and assign a PED Engineer.
              </p>
              ${requestDetailsTable}
              ${pedEngineersBox}
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
        REVERTED: {
            subject: `MH Request Reverted by Designer — ${request.mhRequestId}`,
            html: `${header('MH Request Reverted by Designer')}
              <p style="font-size:14px;color:#0f172a;margin-top:0;">Dear <strong>${recipient.name}</strong>,</p>
              <p style="color:#475569;font-size:14px;line-height:1.5;margin-bottom:20px;">
                The MH Request <strong>${request.mhRequestId}</strong> has been reverted/rejected by the Designer.
              </p>
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 6px;font-weight:700;color:#991b1b;">Reason for Reversion:</p>
                <p style="margin:0;color:#374151;font-weight:600;">${request.revertComment || 'Requirement is not fulfilling or requires correction.'}</p>
              </div>
              ${requestDetailsTable}
              ${leadTimeStatusBlock}
              ${portalBtn}
              ${footer}`
        },
        DESIGNER_ASSIGNED: {
            subject: `Design Assignment — ${request.mhRequestId}`,
            html: `${header('Design Assignment Notification')}
              <p style="font-size:14px;color:#0f172a;margin-top:0;">Dear <strong>${recipient.name}</strong>,</p>
              <p style="color:#475569;font-size:14px;line-height:1.5;margin-bottom:20px;">
                For the MH request <strong>${request.mhRequestId}</strong>, the PED Engineer has chosen you to design the product. Please log in to the portal to begin your design work.
              </p>
              ${requestDetailsTable}
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
            subject: `Design Submitted — Checker Review Required — ${request.mhRequestId}`,
            html: `${header('Design Submitted — Review Required')}
              <p style="font-size:14px;color:#0f172a;margin-top:0;">Dear <strong>${recipient.name}</strong>,</p>
              <p style="color:#475569;font-size:14px;line-height:1.5;margin-bottom:20px;">
                For the MH request <strong>${request.mhRequestId}</strong>, the design has been submitted and needs to be reviewed. Please log in to the portal to view the design and complete your check.
              </p>
              ${requestDetailsTable}
              ${leadTimeStatusBlock}
              <div style="text-align:center;margin:30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/checker-queue" style="background:#B31818;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Open Checker Queue & Review Design</a>
              </div>
              ${footer}`
        },
        DESIGN_APPROVED: {
            subject: `Design Approved — Final Approval Required — ${request.mhRequestId}`,
            html: `${header('Design Approved — Final Approval Required')}
              <p style="font-size:14px;color:#0f172a;margin-top:0;">Dear <strong>${recipient.name}</strong>,</p>
              <p style="color:#475569;font-size:14px;line-height:1.5;margin-bottom:20px;">
                For the MH request <strong>${request.mhRequestId}</strong>, the Checker has approved the design and it has come to you for final approval. Please log in to the portal and perform your approval.
              </p>
              ${requestDetailsTable}
              ${sopScoreBlock}
              ${leadTimeStatusBlock}
              <div style="text-align:center;margin:30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/final-approval-queue" style="background:#B31818;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Open Final Approval Queue</a>
              </div>
              ${footer}`
        },
        DESIGN_REJECTED: {
            subject: `Design Rejected by Checker — Revision Required — ${request.mhRequestId}`,
            html: `${header('Design Rejected — Revision Required')}
              <p style="font-size:14px;color:#0f172a;margin-top:0;">Dear <strong>${recipient.name}</strong>,</p>
              <p style="color:#475569;font-size:14px;line-height:1.5;margin-bottom:20px;">
                For the MH request <strong>${request.mhRequestId}</strong>, the Checker has rejected the submitted design. Please review the feedback below and resubmit the updated design.
              </p>
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 6px;font-weight:700;color:#991b1b;">Reason for Rejection:</p>
                <p style="margin:0;color:#374151;font-weight:600;">${request.checkerComment || 'Please review the design requirements and resubmit.'}</p>
              </div>
              ${sopScoreBlock}
              ${requestDetailsTable}
              ${leadTimeStatusBlock}
              <div style="text-align:center;margin:30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/design-queue" style="background:#B31818;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Open Design Queue & Resubmit Design</a>
              </div>
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
async function sendWorkflowNotification({ request, event, recipient, actor, leadTime = null, pedEngineers = [] }) {
    const transporter = createTransporter();
    const { subject, html } = buildEmailTemplate(event, { request, actor, recipient, leadTime, pedEngineers });

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

module.exports = { sendWorkflowNotification, retryFailedNotifications, buildEmailTemplate };
