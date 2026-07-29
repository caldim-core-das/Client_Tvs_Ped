const mongoose = require('mongoose');

// ─── WorkflowNodePreset ───────────────────────────────────────────────────────
// A user-saved, reusable node blueprint that shows up in the Workflow Studio's
// node library "CUSTOM" section, alongside the built-in presets. Lets Studio
// users configure a node exactly how they need it once, then reuse it without
// reconfiguring from scratch — see ParamPanel's "Save as Library Preset".

const workflowNodePresetSchema = new mongoose.Schema({
    processKey: { type: String, required: true, default: 'MH_REQUEST' },
    label: { type: String, required: true },
    nodeType: {
        type: String,
        required: true,
        enum: ['TRIGGER', 'LOGIC', 'ROUTING', 'HUMAN_TASK', 'ACTION', 'COMMUNICATION', 'SLA', 'END']
    },
    subtype: { type: String, default: '' },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

workflowNodePresetSchema.index({ processKey: 1 });

module.exports = mongoose.model('WorkflowNodePreset', workflowNodePresetSchema);
