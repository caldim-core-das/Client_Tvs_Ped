/**
 * seedWorkflowDefinition.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Seeds the default MH_REQUEST WorkflowDefinition graph — the same 7-stage
 * approval process that used to be hardcoded across workflowController.js /
 * workflowAuthMiddleware.js, now expressed as nodes + edges so it can be
 * edited in the Workflow Studio.
 *
 * Idempotent — no-ops if an active MH_REQUEST definition already exists.
 *
 * Usage:
 *   node backend/scripts/seedWorkflowDefinition.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const WorkflowDefinition = require('../models/WorkflowDefinition');

const NODES = [
    { id: 'trigger-1', type: 'TRIGGER', subtype: 'MH_REQUEST_CREATED', label: 'MH Request Created', position: { x: 400, y: 0 }, config: {} },

    { id: 'comm-l1-notify', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Mail: L1 Approver', position: { x: 400, y: 100 },
        config: { templateKey: 'REQUEST_SUBMITTED', recipientSource: 'ROLE_LOOKUP', roleToAssign: 'L1 Approver' } },

    { id: 'human-l1', type: 'HUMAN_TASK', subtype: 'APPROVAL_GATE', label: 'L1 Approval', position: { x: 400, y: 200 },
        config: {
            allowedRoles: ['L1 Approver', 'Admin'],
            decisions: ['Approved', 'Rejected'],
            commentRequiredFor: ['Rejected'],
            minCommentLength: 10,
            requiredPayloadFields: [{ key: 'assignEngineerId', label: 'PED Engineer', onlyForDecision: 'Approved' }]
        } },

    { id: 'routing-ped', type: 'ROUTING', subtype: 'AUTO_ASSIGNMENT', label: 'Assign PED Engineer', position: { x: 250, y: 300 },
        config: { targetField: 'assignedEngineer', assignBy: 'PAYLOAD', payloadKey: 'assignEngineerId' } },
    { id: 'comm-ped-assigned', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Mail: PED Engineer', position: { x: 250, y: 400 },
        config: { templateKey: 'PED_ENGINEER_ASSIGNED', recipientSource: 'ASSIGNED_FIELD', recipientField: 'assignedEngineer' } },

    { id: 'human-ped-assign', type: 'HUMAN_TASK', subtype: 'APPROVAL_GATE', label: 'PED Engineer Assigns Designer & Checker', position: { x: 250, y: 500 },
        config: {
            allowedRoles: ['PED Engineer', 'Admin'],
            decisions: ['Assigned'],
            requiredPayloadFields: [
                { key: 'assignDesignerId', label: 'Designer' },
                { key: 'assignCheckerId', label: 'Checker', mustDifferFrom: 'assignDesignerId' }
            ]
        } },

    { id: 'routing-designer', type: 'ROUTING', subtype: 'AUTO_ASSIGNMENT', label: 'Assign Designer', position: { x: 150, y: 600 },
        config: { targetField: 'assignedDesigner', assignBy: 'PAYLOAD', payloadKey: 'assignDesignerId' } },
    { id: 'routing-checker', type: 'ROUTING', subtype: 'AUTO_ASSIGNMENT', label: 'Assign Checker', position: { x: 300, y: 600 },
        config: { targetField: 'assignedChecker', assignBy: 'PAYLOAD', payloadKey: 'assignCheckerId' } },
    { id: 'routing-final', type: 'ROUTING', subtype: 'AUTO_ASSIGNMENT', label: 'Assign Final Approver', position: { x: 450, y: 600 },
        config: { targetField: 'assignedFinalApprover', assignBy: 'ROLE_LOOKUP', roleToAssign: 'Final Approver' } },

    { id: 'comm-designer-assigned', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Mail: Designer', position: { x: 150, y: 700 },
        config: { templateKey: 'DESIGNER_ASSIGNED', recipientSource: 'ASSIGNED_FIELD', recipientField: 'assignedDesigner', fallbackRole: 'Designer' } },
    { id: 'comm-checker-assigned', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Mail: Checker', position: { x: 150, y: 800 },
        config: { templateKey: 'CHECKER_ASSIGNED', recipientSource: 'ASSIGNED_FIELD', recipientField: 'assignedChecker', fallbackRole: 'Checker' } },

    { id: 'human-design-submit', type: 'HUMAN_TASK', subtype: 'MANUAL_TASK', label: 'Designer: Upload Design', position: { x: 150, y: 900 },
        config: {
            allowedRoles: ['Designer', 'Admin'],
            decisions: ['Submit', 'Reject Task'],
            commentRequiredFor: ['Reject Task'],
            minCommentLength: 5,
            requiresAction: 'SECURE_FILE_UPLOAD'
        } },

    { id: 'comm-design-submitted', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Mail: Checker (design ready)', position: { x: 150, y: 1000 },
        config: { templateKey: 'DESIGN_SUBMITTED', recipientSource: 'ASSIGNED_FIELD', recipientField: 'assignedChecker', fallbackRole: 'Checker' } },

    { id: 'comm-reverted-1', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Notify: L1 Approver (reverted)', position: { x: 0, y: 1000 },
        config: { templateKey: 'REVERTED', recipientSource: 'ASSIGNED_FIELD', recipientField: 'approver', fallbackRole: 'L1 Approver' } },
    { id: 'comm-reverted-2', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Notify: PED Engineer (reverted)', position: { x: 0, y: 1100 },
        config: { templateKey: 'REVERTED', recipientSource: 'ASSIGNED_FIELD', recipientField: 'assignedEngineer', fallbackRole: 'PED Engineer' } },
    { id: 'comm-reverted-3', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Notify: Requester (reverted)', position: { x: 0, y: 1200 },
        config: { templateKey: 'REVERTED', recipientSource: 'REQUESTER' } },
    { id: 'end-reverted', type: 'END', subtype: 'REJECTED_TERMINAL', label: 'Reverted', position: { x: 0, y: 1300 },
        config: { terminalLabel: 'REVERTED' } },

    { id: 'human-checker', type: 'HUMAN_TASK', subtype: 'APPROVAL_GATE', label: 'Checker Validation', position: { x: 400, y: 1100 },
        config: {
            allowedRoles: ['Checker', 'Admin'],
            decisions: ['Approve', 'Reject'],
            commentRequiredFor: ['Reject'],
            minCommentLength: 10,
            preActionKey: 'SOP_SCORING',
            requirePassingFor: ['Approve']
        } },

    { id: 'comm-final-notify', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Mail: Final Approver', position: { x: 550, y: 1200 },
        config: { templateKey: 'DESIGN_APPROVED', recipientSource: 'ASSIGNED_FIELD', recipientField: 'assignedFinalApprover', fallbackRole: 'Final Approver' } },

    { id: 'comm-checker-rejected-1', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Notify: Designer (design rejected)', position: { x: 250, y: 1200 },
        config: { templateKey: 'DESIGN_REJECTED', recipientSource: 'ASSIGNED_FIELD', recipientField: 'assignedDesigner', fallbackRole: 'Designer' } },
    { id: 'comm-checker-rejected-2', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Notify: PED Engineer (design rejected)', position: { x: 250, y: 1300 },
        config: { templateKey: 'DESIGN_REJECTED', recipientSource: 'ROLE_LOOKUP', roleToAssign: 'PED Engineer' } },
    { id: 'comm-checker-rejected-3', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Notify: L1 Approver (design rejected)', position: { x: 250, y: 1400 },
        config: { templateKey: 'DESIGN_REJECTED', recipientSource: 'ROLE_LOOKUP', roleToAssign: 'L1 Approver' } },

    { id: 'human-final', type: 'HUMAN_TASK', subtype: 'APPROVAL_GATE', label: 'Final Approval', position: { x: 550, y: 1300 },
        config: {
            allowedRoles: ['Final Approver', 'Admin'],
            decisions: ['Approve', 'Reject'],
            commentRequiredFor: ['Reject'],
            minCommentLength: 10
        } },

    { id: 'comm-final-approved', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Mail: Requester (final approved)', position: { x: 550, y: 1400 },
        config: { templateKey: 'FINAL_APPROVED', recipientSource: 'REQUESTER' } },
    { id: 'comm-final-rejected', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Mail: L1 Approver (final rejected)', position: { x: 700, y: 1400 },
        config: { templateKey: 'FINAL_REJECTED', recipientSource: 'STATIC_FIELD', recipientField: 'approverEmail', staticName: 'L1 Approver', staticRole: 'L1 Approver' } },

    { id: 'human-production', type: 'HUMAN_TASK', subtype: 'MANUAL_TASK', label: 'Start Production', position: { x: 550, y: 1500 },
        config: { allowedRoles: ['PED Engineer', 'Admin'], decisions: ['Start Production'] } },
    { id: 'comm-in-production', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Mail: Requester (production)', position: { x: 550, y: 1600 },
        config: { templateKey: 'IN_PRODUCTION', recipientSource: 'REQUESTER' } },
    { id: 'human-implementation', type: 'HUMAN_TASK', subtype: 'MANUAL_TASK', label: 'Mark Implementation', position: { x: 550, y: 1700 },
        config: { allowedRoles: ['PED Engineer', 'Admin'], decisions: ['Mark Implementation'] } },
    { id: 'human-completed', type: 'HUMAN_TASK', subtype: 'MANUAL_TASK', label: 'Mark Completed', position: { x: 550, y: 1800 },
        config: { allowedRoles: ['PED Engineer', 'Admin'], decisions: ['Mark Completed'] } },
    { id: 'comm-completed', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Mail: Requester (completed)', position: { x: 550, y: 1900 },
        config: { templateKey: 'COMPLETED', recipientSource: 'REQUESTER' } },
    { id: 'end-completed', type: 'END', subtype: 'COMPLETED', label: 'Completed', position: { x: 550, y: 2000 },
        config: { terminalLabel: 'COMPLETED' } },

    { id: 'comm-l1-rejected', type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Mail: Requester (L1 rejected)', position: { x: 700, y: 300 },
        config: { templateKey: 'L1_REJECTED', recipientSource: 'REQUESTER' } },
    { id: 'action-requester-status-email', type: 'ACTION', subtype: 'CUSTOM', label: 'Send Requester Status Email', position: { x: 700, y: 400 },
        config: { actionKey: 'REQUESTER_STATUS_EMAIL', params: {} } },
    { id: 'end-l1-rejected', type: 'END', subtype: 'REJECTED_TERMINAL', label: 'L1 Rejected', position: { x: 700, y: 500 },
        config: { terminalLabel: 'L1_REJECTED' } }
];

const EDGES = [
    { id: 'e1', source: 'trigger-1', target: 'comm-l1-notify', label: '' },
    { id: 'e2', source: 'comm-l1-notify', target: 'human-l1', label: '' },

    { id: 'e3', source: 'human-l1', target: 'routing-ped', label: 'Approved',
        metadata: { workflowStateLabel: 'L1_APPROVED', legacyFields: { status: 'Accepted', workflowStatus: 'Assigned' }, stageFlag: 'l1ApprovedAt', commentField: 'l1ApprovalComment' } },
    { id: 'e4', source: 'human-l1', target: 'comm-l1-rejected', label: 'Rejected',
        metadata: { workflowStateLabel: 'L1_REJECTED', legacyFields: { status: 'Rejected' }, commentField: 'l1ApprovalComment' } },

    { id: 'e5', source: 'routing-ped', target: 'comm-ped-assigned', label: '' },
    { id: 'e6', source: 'comm-ped-assigned', target: 'human-ped-assign', label: '' },

    { id: 'e7', source: 'human-ped-assign', target: 'routing-designer', label: 'Assigned',
        metadata: { workflowStateLabel: 'DESIGN_IN_PROGRESS', legacyFields: { progressStatus: 'Design' }, stageFlag: 'designAssignedAt' } },
    { id: 'e8', source: 'routing-designer', target: 'routing-checker', label: '' },
    { id: 'e9', source: 'routing-checker', target: 'routing-final', label: '' },
    { id: 'e10', source: 'routing-final', target: 'comm-designer-assigned', label: '' },
    { id: 'e11', source: 'comm-designer-assigned', target: 'comm-checker-assigned', label: '' },
    { id: 'e12', source: 'comm-checker-assigned', target: 'human-design-submit', label: '' },

    { id: 'e13', source: 'human-design-submit', target: 'comm-design-submitted', label: 'Submit',
        metadata: { workflowStateLabel: 'DESIGN_SUBMITTED', stageFlag: 'designSubmittedAt' } },
    { id: 'e14', source: 'human-design-submit', target: 'comm-reverted-1', label: 'Reject Task',
        metadata: { workflowStateLabel: 'REVERTED', legacyFields: { status: 'Rejected', progressStatus: 'Reverted by Designer' }, commentField: 'revertComment' } },

    { id: 'e15', source: 'comm-design-submitted', target: 'human-checker', label: '' },

    { id: 'e16', source: 'comm-reverted-1', target: 'comm-reverted-2', label: '' },
    { id: 'e17', source: 'comm-reverted-2', target: 'comm-reverted-3', label: '' },
    { id: 'e18', source: 'comm-reverted-3', target: 'end-reverted', label: '' },

    { id: 'e19', source: 'human-checker', target: 'comm-final-notify', label: 'Approve',
        metadata: { workflowStateLabel: 'DESIGN_APPROVED', legacyFields: { progressStatus: 'Design Approved' }, stageFlag: 'designApprovedAt', commentField: 'checkerComment' } },
    { id: 'e20', source: 'human-checker', target: 'comm-checker-rejected-1', label: 'Reject',
        metadata: { workflowStateLabel: 'DESIGN_IN_PROGRESS', commentField: 'checkerComment' } },

    { id: 'e21', source: 'comm-final-notify', target: 'human-final', label: '' },

    { id: 'e22', source: 'comm-checker-rejected-1', target: 'comm-checker-rejected-2', label: '' },
    { id: 'e23', source: 'comm-checker-rejected-2', target: 'comm-checker-rejected-3', label: '' },
    { id: 'e24', source: 'comm-checker-rejected-3', target: 'human-design-submit', label: '' },

    { id: 'e25', source: 'human-final', target: 'comm-final-approved', label: 'Approve',
        metadata: { workflowStateLabel: 'FINAL_APPROVED', stageFlag: 'finalApprovedAt', commentField: 'finalApprovalComment' } },
    { id: 'e26', source: 'human-final', target: 'comm-final-rejected', label: 'Reject',
        metadata: { workflowStateLabel: 'FINAL_REJECTED', commentField: 'finalApprovalComment' } },

    { id: 'e27', source: 'comm-final-approved', target: 'human-production', label: '' },
    { id: 'e28', source: 'comm-final-rejected', target: 'human-l1', label: '' },

    { id: 'e29', source: 'human-production', target: 'comm-in-production', label: 'Start Production',
        metadata: { workflowStateLabel: 'IN_PRODUCTION', legacyFields: { production: true, progressStatus: 'Production' }, stageFlag: 'productionStartAt' } },
    { id: 'e30', source: 'comm-in-production', target: 'human-implementation', label: '' },
    { id: 'e31', source: 'human-implementation', target: 'human-completed', label: 'Mark Implementation',
        metadata: { workflowStateLabel: 'IMPLEMENTATION', legacyFields: { implementation: true, progressStatus: 'Implementation' } } },
    { id: 'e32', source: 'human-completed', target: 'comm-completed', label: 'Mark Completed',
        metadata: { workflowStateLabel: 'COMPLETED', stageFlag: 'implementedAt' } },
    { id: 'e33', source: 'comm-completed', target: 'end-completed', label: '' },

    { id: 'e34', source: 'comm-l1-rejected', target: 'action-requester-status-email', label: '' },
    { id: 'e35', source: 'action-requester-status-email', target: 'end-l1-rejected', label: '' }
];

async function seed() {
    const dbURI = process.env.ATLAS_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/tvs_ped';
    await mongoose.connect(dbURI);
    console.log('✅  Connected to MongoDB');

    const existing = await WorkflowDefinition.findOne({ processKey: 'MH_REQUEST', isActive: true });
    if (existing) {
        console.log(`⏭   MH_REQUEST workflow definition already exists (v${existing.version}) — nothing to do.`);
        await mongoose.disconnect();
        return;
    }

    // Defensive cleanup: there must be at most one isDraft:true doc per
    // process (enforced by a partial unique index on the model), but guard
    // against any pre-existing/stray draft left over from manual testing —
    // otherwise create() below would violate that index or, before the index
    // existed, silently produce a second draft that getDraft() picks at random.
    await WorkflowDefinition.deleteMany({ processKey: 'MH_REQUEST', isDraft: true });

    const base = { name: 'MH Request Approval Workflow', processKey: 'MH_REQUEST', version: 1, nodes: NODES, edges: EDGES };

    await WorkflowDefinition.create({ ...base, isDraft: false, isActive: true, publishedAt: new Date() });
    await WorkflowDefinition.create({ ...base, isDraft: true, isActive: false, publishedAt: null });

    console.log(`✅  Seeded MH_REQUEST workflow definition v1 (${NODES.length} nodes, ${EDGES.length} edges) — published + draft copy created.`);

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
