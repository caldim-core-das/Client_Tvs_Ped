const mongoose = require('mongoose');

// ─── WorkflowDefinition ───────────────────────────────────────────────────────
// The graph (nodes + edges) that drives a workflow process end-to-end.
// Editing this graph in the Workflow Studio changes runtime behavior for that
// process with zero code changes — see backend/services/workflowEngine.js.
//
// Versioning model:
//   - Exactly one { processKey, isDraft: true } doc is what the Studio edits.
//   - Publishing clones the validated draft into a new immutable
//     { isDraft: false, isActive: true, version: N+1 } doc, and flips the
//     previously-active doc's isActive to false. Published docs are never
//     deleted — the full list IS the version history shown in the Studio's
//     "History" panel.

const nodeSchema = new mongoose.Schema({
    id: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['TRIGGER', 'LOGIC', 'ROUTING', 'HUMAN_TASK', 'ACTION', 'COMMUNICATION', 'SLA', 'END']
    },
    subtype: { type: String, default: '' },
    label: { type: String, required: true },
    position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
    },
    // Node-type-specific configuration. Shape varies by `type` — see
    // workflowEngine.js's handler registry for exactly what each type reads.
    config: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const edgeSchema = new mongoose.Schema({
    id: { type: String, required: true },
    source: { type: String, required: true }, // node.id
    target: { type: String, required: true }, // node.id
    // For edges leaving a HUMAN_TASK node, label must match one of that
    // node's config.decisions[] exactly (e.g. 'Approved' / 'Rejected').
    // For edges leaving non-human nodes there is exactly one outgoing edge
    // and label is '' (unconditional), except LOGIC nodes which use `condition`.
    label: { type: String, default: '' },
    condition: { type: mongoose.Schema.Types.Mixed, default: null },
    // Applied to the MHRequest once, only when this edge is the human-decision
    // edge (the one leaving a HUMAN_TASK) — see applyEdgeMetadata() in
    // workflowEngine.js. workflowStateLabel keeps existing dashboards/badges
    // that read request.workflowState working; legacyFields/stageFlag/
    // commentField replicate the old controller's "keep legacy field in sync"
    // side effects generically, driven by graph data instead of per-function code.
    metadata: {
        workflowStateLabel: { type: String, default: '' },
        legacyFields: { type: mongoose.Schema.Types.Mixed, default: {} },
        stageFlag: { type: String, default: '' },
        commentField: { type: String, default: '' }
    }
}, { _id: false });

const workflowDefinitionSchema = new mongoose.Schema({
    name: { type: String, required: true, default: 'MH Request Approval Workflow' },
    processKey: { type: String, required: true, default: 'MH_REQUEST' },
    version: { type: Number, required: true },
    isDraft: { type: Boolean, default: true },
    isActive: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    nodes: { type: [nodeSchema], default: [] },
    edges: { type: [edgeSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

workflowDefinitionSchema.index({ processKey: 1, isActive: 1 });
workflowDefinitionSchema.index({ processKey: 1, version: -1 });
// At most one live draft per process — prevents the ambiguous-findOne bug
// where two isDraft:true docs exist and getDraft()/saveDraft() pick one at random.
workflowDefinitionSchema.index({ processKey: 1 }, { unique: true, partialFilterExpression: { isDraft: true } });

module.exports = mongoose.model('WorkflowDefinition', workflowDefinitionSchema);
