/**
 * workflowNotificationCron.js
 * Cron job to retry failed workflow notifications.
 * Runs every 15 minutes.
 */

const cron = require('node-cron');
const { retryFailedNotifications } = require('../services/workflowNotificationService');

function initializeWorkflowNotificationCron() {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', () => {
        retryFailedNotifications().catch(err => console.error('[NotificationCron] Error:', err.message));
    });
    console.log('[Scheduler] Workflow Notification Retry Cron initialized. (Runs every 15m)');
}

module.exports = { initializeWorkflowNotificationCron };
