/**
 * migrateWorkflowV3.js
 * ──────────────────────────────────────────────────────────────────────────────
 * One-time migration: backfills currentNodeId (+ workflowDefinitionVersion) on
 * existing v2 MHRequests so the new graph-driven workflowEngine.js knows where
 * each in-flight request sits in the seeded MH_REQUEST WorkflowDefinition.
 *
 * Safe to run multiple times (idempotent — only touches requests that still
 * have currentNodeId === null).
 *
 * Usage:
 *   node backend/scripts/migrateWorkflowV3.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const MHRequest = require('../models/MHRequest');
const WorkflowDefinition = require('../models/WorkflowDefinition');

const STATE_TO_NODE = {
    SUBMITTED: 'human-l1',
    L1_APPROVED: 'human-ped-assign',
    L1_REJECTED: 'end-l1-rejected',
    DESIGN_IN_PROGRESS: 'human-design-submit',
    DESIGN_SUBMITTED: 'human-checker',
    DESIGN_APPROVED: 'human-final',
    DESIGN_REJECTED: 'human-design-submit',
    FINAL_APPROVED: 'human-production',
    FINAL_REJECTED: 'human-l1',
    IN_PRODUCTION: 'human-implementation',
    IMPLEMENTATION: 'human-completed',
    COMPLETED: 'end-completed',
    REVERTED: 'end-reverted'
    // CANCELLED has no seeded terminal node (unused by any existing controller
    // path) — left unmapped; such records are logged and skipped below.
};

async function migrate() {
    const dbURI = process.env.ATLAS_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/tvs_ped';
    await mongoose.connect(dbURI);
    console.log('✅  Connected to MongoDB');

    const definition = await WorkflowDefinition.findOne({ processKey: 'MH_REQUEST', isActive: true });
    if (!definition) {
        console.error('✗  No active MH_REQUEST WorkflowDefinition found — run seedWorkflowDefinition.js first.');
        await mongoose.disconnect();
        process.exit(1);
    }

    const candidates = await MHRequest.find({ workflowVersion: 2, currentNodeId: null });
    console.log(`📦  Found ${candidates.length} v2 requests without a currentNodeId`);

    let migrated = 0, skipped = 0, errors = 0;

    for (const req of candidates) {
        try {
            const nodeId = STATE_TO_NODE[req.workflowState];
            if (!nodeId) {
                console.warn(`  ⚠️  ${req.mhRequestId}: no node mapping for workflowState='${req.workflowState}' — skipped`);
                skipped++;
                continue;
            }

            const historyEntry = {
                stage: 'MIGRATION',
                state: req.workflowState,
                action: 'MIGRATED_TO_V3',
                actor: null,
                actorName: 'System Migration',
                actorRole: 'System',
                comment: `Backfilled currentNodeId='${nodeId}' for graph-driven workflow engine v3`,
                timestamp: new Date(),
                metadata: { migratedAt: new Date(), workflowDefinitionVersion: definition.version }
            };

            await MHRequest.findByIdAndUpdate(req._id, {
                currentNodeId: nodeId,
                workflowDefinitionVersion: definition.version,
                $push: { stageHistory: historyEntry }
            });

            console.log(`  ✓  ${req.mhRequestId} → currentNodeId='${nodeId}'`);
            migrated++;
        } catch (err) {
            console.error(`  ✗  ${req.mhRequestId}: ${err.message}`);
            errors++;
        }
    }

    console.log('\n─────────────────────────────────────────────────');
    console.log(`✅  Migration to v3 (graph engine) complete`);
    console.log(`   Migrated : ${migrated}`);
    console.log(`   Skipped  : ${skipped}`);
    console.log(`   Errors   : ${errors}`);
    console.log('─────────────────────────────────────────────────');

    await mongoose.disconnect();
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
