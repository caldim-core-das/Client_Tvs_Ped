/**
 * fileCleanupCron.js
 * 
 * Scheduled job to enforce the file upload lifecycle management policy.
 * Scans for rejected or cancelled requests that are older than 30 days
 * and permanently deletes their associated design documents from the server's local disk
 * to prevent storage exhaustion.
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const MHRequest = require('../models/MHRequest');

const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const TERMINAL_STATES_FOR_CLEANUP = ['L1_REJECTED', 'FINAL_REJECTED', 'CANCELLED'];

async function runFileCleanup() {
    console.log('[FileCleanupCron] Starting scheduled cleanup of expired design documents...');
    
    try {
        const thresholdDate = new Date(Date.now() - RETENTION_MS);

        // Find requests that are in terminal rejected/cancelled states, updated more than 30 days ago,
        // and have design documents that haven't been purged yet.
        const expiredRequests = await MHRequest.find({
            workflowState: { $in: TERMINAL_STATES_FOR_CLEANUP },
            updatedAt: { $lte: thresholdDate },
            'designDocuments.0': { $exists: true }, // Has at least one document
            'designDocuments.purged': { $ne: true } // Not already purged
        });

        if (expiredRequests.length === 0) {
            console.log('[FileCleanupCron] No expired files found for cleanup.');
            return 0;
        }

        let deletedFilesCount = 0;

        for (const request of expiredRequests) {
            let filesPurged = false;

            // Iterate over all design documents for this request
            for (const doc of request.designDocuments) {
                if (doc.fileUrl && !doc.purged) {
                    // Extract just the filename from the URL (e.g. "/uploads/DesignDocuments/123.pdf")
                    const filePath = path.join(__dirname, '..', doc.fileUrl);

                    try {
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            deletedFilesCount++;
                        }
                        
                        // Mark as purged in the database document
                        doc.purged = true;
                        doc.fileUrl = null;
                        filesPurged = true;
                    } catch (err) {
                        console.error(`[FileCleanupCron] Failed to delete file ${filePath}:`, err.message);
                    }
                }
            }

            // Save the updated request document if we purged files
            if (filesPurged) {
                await request.save();
                console.log(`[FileCleanupCron] Purged files for request ${request.mhRequestId}`);
            }
        }

        console.log(`[FileCleanupCron] Cleanup complete. Deleted ${deletedFilesCount} file(s).`);
        return deletedFilesCount;

    } catch (error) {
        console.error('[FileCleanupCron] Fatal error during execution:', error.message);
    }
}

function initializeFileCleanupCron() {
    // Run daily at 2:00 AM
    cron.schedule('0 2 * * *', () => {
        runFileCleanup().catch(err => console.error('[FileCleanupCron] Error:', err.message));
    });
    console.log('[Scheduler] File Cleanup Cron initialized. (Runs daily at 2:00 AM)');
}

module.exports = { initializeFileCleanupCron, runFileCleanup };
