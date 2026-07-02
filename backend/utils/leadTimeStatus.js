/**
 * leadTimeStatus.js
 * Shared consumed/remaining/SLA-health calculation for the enterprise workflow.
 * Single source of truth — used by workflowController (API responses),
 * workflowNotificationService (email templates), and workflowEscalationCron.
 */

const ATTENTION_THRESHOLD_PERCENT = 80;

/**
 * @param {Object} params
 * @param {Date|string} params.createdAt - workflow start timestamp
 * @param {number|null} params.leadTimeEstimateDays - estimated total lead time in days
 * @returns {Object|null} { estimatedDays, consumedDays, remainingDays, percent, status, overdueByDays }
 */
function computeLeadTimeStatus({ createdAt, leadTimeEstimateDays }) {
    if (!createdAt || !leadTimeEstimateDays) return null;

    const msElapsed = Date.now() - new Date(createdAt).getTime();
    const consumedDays = Math.max(0, msElapsed / (1000 * 60 * 60 * 24));
    const remainingDays = leadTimeEstimateDays - consumedDays;
    const percent = Math.round((consumedDays / leadTimeEstimateDays) * 100);

    let status = 'ON_TRACK';
    if (percent > 100) status = 'OVERDUE';
    else if (percent >= ATTENTION_THRESHOLD_PERCENT) status = 'ATTENTION';

    return {
        estimatedDays: leadTimeEstimateDays,
        consumedDays: Math.round(consumedDays * 10) / 10,
        remainingDays: Math.round(remainingDays * 10) / 10,
        percent: Math.min(percent, 999),
        status,
        overdueByDays: status === 'OVERDUE' ? Math.round(Math.abs(remainingDays) * 10) / 10 : 0
    };
}

module.exports = { computeLeadTimeStatus };
