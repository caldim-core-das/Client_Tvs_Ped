const cron = require('node-cron');
const ReportSettings = require('../models/ReportSettings');
const { generateReport, formatReportAsHTML, generateExcelAttachment } = require('../services/reportGenerator');
const { sendReportEmail } = require('../services/emailService');




/**
 * Report Scheduler
 * Runs scheduled jobs to generate and send reports
 */

/**
 * Check if report should run based on settings
 * @param {Object} settings - Report settings
 * @returns {boolean} Whether report should run
 */
const shouldRunReport = (settings) => {
    if (!settings || !settings.isActive) {
        return false;
    }

    const now = new Date();
    const nextRun = new Date(settings.nextRunAt);

    // Check if it's time to run
    return now >= nextRun;
};

/**
 * Execute report generation and sending
 * @param {Object} settings - Report settings
 */
const executeReport = async (settings) => {
    try {
        console.log(`Executing scheduled report: ${settings.reportType}`);

        // Generate report
        const reportData = await generateReport(settings.reportType);

        // Format as HTML
        const htmlContent = formatReportAsHTML(reportData);

        // Generate Excel attachment
        const excelBuffer = await generateExcelAttachment(reportData);
        reportData.attachments = [
            {
                filename: `${settings.reportType.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
                content: excelBuffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        ];

        // Send email to recipients
        const emailResult = await sendReportEmail(
            settings.recipients,
            reportData,
            htmlContent
        );

        // Update last run and calculate next run
        settings.lastRunAt = new Date();
        settings.nextRunAt = settings.calculateNextRun();
        await settings.save();

        console.log(`Report sent successfully to ${emailResult.recipients} recipients`);

        return {
            success: true,
            reportType: settings.reportType,
            recipients: emailResult.recipients,
            timestamp: new Date()
        };
    } catch (error) {
        console.error('Error executing scheduled report:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date()
        };
    }
};

/**
 * Initialize report scheduler
 * Runs every hour to check if reports need to be sent
 */
const initializeScheduler = () => {
    console.log('Initializing report scheduler...');

    // Run every hour at the top of the hour
    // cron.schedule('0 * * * *', async () => {
    //     console.log('Checking for scheduled reports...');
    // 
    //     try {
    //         // Get active report settings
    //         const settings = await ReportSettings.findOne({ isActive: true });
    // 
    //         if (!settings) {
    //             console.log('No active report settings found');
    //             return;
    //         }
    // 
    //         // Check if report should run
    //         if (shouldRunReport(settings)) {
    //             console.log(`Running scheduled report: ${settings.reportType}`);
    //             await executeReport(settings);
    //         } else {
    //             console.log(`Next report scheduled for: ${settings.nextRunAt}`);
    //         }
    //     } catch (error) {
    //         console.error('Error in report scheduler:', error);
    //     }
    // });
    
    console.log('[Scheduler] Report scheduler cron is temporarily disabled by user request.');
};

module.exports = {
    initializeScheduler,
    executeReport,
    shouldRunReport
};
