/**
 * ParamPanel.jsx
 * Right-side panel — edit the selected node's config or the selected
 * connection's decision label. This is the surface that actually makes the
 * graph customizable: changing a value here and publishing changes runtime
 * behavior with no code change.
 */

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const TEMPLATE_KEYS = [
    'REQUEST_SUBMITTED', 'L1_APPROVED', 'PED_ENGINEER_ASSIGNED', 'L1_REJECTED', 'REVERTED',
    'DESIGNER_ASSIGNED', 'CHECKER_ASSIGNED', 'DESIGN_SUBMITTED', 'DESIGN_APPROVED',
    'DESIGN_REJECTED', 'FINAL_APPROVED', 'FINAL_REJECTED', 'IN_PRODUCTION', 'COMPLETED', 'ESCALATION_REMINDER'
];
const TARGET_FIELDS = ['assignedEngineer', 'assignedDesigner', 'assignedChecker', 'assignedFinalApprover'];
const ACTION_KEYS = ['SOP_SCORING', 'LEAD_TIME_ESTIMATE', 'SECURE_FILE_UPLOAD', 'REQUESTER_STATUS_EMAIL'];
const RECIPIENT_SOURCES = ['ASSIGNED_FIELD', 'ROLE_LOOKUP', 'REQUESTER', 'STATIC_FIELD'];
const LOGIC_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];

function Field({ label, children }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</label>
            {children}
        </div>
    );
}

const inputStyle = { width: '100%', padding: '7px 9px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, outline: 'none' };

function TextInput(props) { return <input {...props} style={inputStyle} />; }
function Select({ options, ...props }) {
    return (
        <select {...props} style={inputStyle}>
            <option value="">— select —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    );
}
function ListInput({ value = [], onChange, placeholder }) {
    return (
        <input
            style={inputStyle}
            value={(value || []).join(', ')}
            onChange={e => onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder={placeholder}
        />
    );
}

export default function ParamPanel({ selectedNode, selectedEdge, roles = [], onUpdateNode, onUpdateEdge, onDeleteNode, onDeleteEdge, onClose, onSaveAsPreset }) {
    const [label, setLabel] = useState('');
    const [config, setConfig] = useState({});
    const [edgeLabel, setEdgeLabel] = useState('');
    const [presetNameDraft, setPresetNameDraft] = useState(null); // null = not editing; string = draft name

    useEffect(() => {
        if (selectedNode) {
            setLabel(selectedNode.data.label || '');
            setConfig(selectedNode.data.config || {});
        }
    }, [selectedNode?.id]);

    useEffect(() => {
        if (selectedEdge) setEdgeLabel(selectedEdge.label || '');
    }, [selectedEdge?.id]);

    if (!selectedNode && !selectedEdge) {
        return (
            <div style={{ width: 280, borderLeft: '1px solid #e2e8f0', background: '#fff', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>Select a node or connection to edit its parameters.</div>
            </div>
        );
    }

    const commit = (nextConfig, nextLabel) => {
        setConfig(nextConfig);
        onUpdateNode(selectedNode.id, nextConfig, nextLabel ?? label);
    };

    if (selectedEdge) {
        return (
            <div style={{ width: 280, borderLeft: '1px solid #e2e8f0', background: '#fff', padding: 16, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>Connection</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                </div>
                <Field label="Decision Label">
                    <TextInput value={edgeLabel} onChange={e => setEdgeLabel(e.target.value)}
                        onBlur={() => onUpdateEdge(selectedEdge.id, edgeLabel)}
                        placeholder="e.g. Approved, Rejected, Submit" />
                </Field>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>
                    Must exactly match one of the source Human Task node's decisions for this path to be reachable.
                </div>
                <button onClick={() => onDeleteEdge(selectedEdge.id)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Delete Connection
                </button>
            </div>
        );
    }

    const type = selectedNode.data.nodeType;

    return (
        <div style={{ width: 280, borderLeft: '1px solid #e2e8f0', background: '#fff', padding: 16, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{type.replace('_', ' ')}</div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <Field label="Label">
                <TextInput value={label} onChange={e => setLabel(e.target.value)} onBlur={() => commit(config, label)} />
            </Field>

            {type === 'HUMAN_TASK' && (
                <>
                    <Field label="Allowed Roles (comma separated)">
                        <ListInput value={config.allowedRoles} onChange={v => commit({ ...config, allowedRoles: v })} placeholder={roles.join(', ')} />
                    </Field>
                    <Field label="Decisions (comma separated)">
                        <ListInput value={config.decisions} onChange={v => commit({ ...config, decisions: v })} placeholder="Approved, Rejected" />
                    </Field>
                    <Field label="Comment Required For">
                        <ListInput value={config.commentRequiredFor} onChange={v => commit({ ...config, commentRequiredFor: v })} placeholder="Rejected" />
                    </Field>
                    <Field label="Minimum Comment Length">
                        <TextInput type="number" value={config.minCommentLength || 0} onChange={e => commit({ ...config, minCommentLength: Number(e.target.value) })} />
                    </Field>
                    <Field label="Requires File Upload?">
                        <Select options={['SECURE_FILE_UPLOAD']} value={config.requiresAction || ''} onChange={e => commit({ ...config, requiresAction: e.target.value || null })} />
                    </Field>
                    <Field label="Pre-decision Scoring (e.g. Checker SOP)">
                        <Select options={['SOP_SCORING']} value={config.preActionKey || ''} onChange={e => commit({ ...config, preActionKey: e.target.value || null })} />
                    </Field>
                    {config.preActionKey && (
                        <Field label="Decisions Requiring a Passing Score">
                            <ListInput value={config.requirePassingFor} onChange={v => commit({ ...config, requirePassingFor: v })} placeholder="Approve" />
                        </Field>
                    )}
                </>
            )}

            {type === 'ROUTING' && (
                <>
                    <Field label="Target Field (MHRequest field to assign)">
                        <Select options={TARGET_FIELDS} value={config.targetField || ''} onChange={e => commit({ ...config, targetField: e.target.value })} />
                    </Field>
                    <Field label="Assign By">
                        <Select options={['PAYLOAD', 'ROLE_LOOKUP']} value={config.assignBy || ''} onChange={e => commit({ ...config, assignBy: e.target.value })} />
                    </Field>
                    {config.assignBy === 'PAYLOAD' && (
                        <Field label="Payload Key (from the Human Task's required field)">
                            <TextInput value={config.payloadKey || ''} onChange={e => commit({ ...config, payloadKey: e.target.value })} />
                        </Field>
                    )}
                    {config.assignBy === 'ROLE_LOOKUP' && (
                        <Field label="Role to Assign">
                            <Select options={roles} value={config.roleToAssign || ''} onChange={e => commit({ ...config, roleToAssign: e.target.value })} />
                        </Field>
                    )}
                </>
            )}

            {type === 'COMMUNICATION' && (
                <>
                    <Field label="Email Template">
                        <Select options={TEMPLATE_KEYS} value={config.templateKey || ''} onChange={e => commit({ ...config, templateKey: e.target.value })} />
                    </Field>
                    <Field label="Recipient Source">
                        <Select options={RECIPIENT_SOURCES} value={config.recipientSource || ''} onChange={e => commit({ ...config, recipientSource: e.target.value })} />
                    </Field>
                    {config.recipientSource === 'ASSIGNED_FIELD' && (
                        <>
                            <Field label="Recipient Field">
                                <Select options={TARGET_FIELDS.concat(['approver'])} value={config.recipientField || ''} onChange={e => commit({ ...config, recipientField: e.target.value })} />
                            </Field>
                            <Field label="Fallback Role">
                                <Select options={roles} value={config.fallbackRole || ''} onChange={e => commit({ ...config, fallbackRole: e.target.value })} />
                            </Field>
                        </>
                    )}
                    {config.recipientSource === 'ROLE_LOOKUP' && (
                        <Field label="Role to Notify">
                            <Select options={roles} value={config.roleToAssign || ''} onChange={e => commit({ ...config, roleToAssign: e.target.value })} />
                        </Field>
                    )}
                    {config.recipientSource === 'STATIC_FIELD' && (
                        <Field label="Request Field (plain string, e.g. approverEmail)">
                            <TextInput value={config.recipientField || ''} onChange={e => commit({ ...config, recipientField: e.target.value })} />
                        </Field>
                    )}
                </>
            )}

            {(type === 'ACTION' || type === 'SLA') && (
                <Field label="Action">
                    <Select options={ACTION_KEYS} value={config.actionKey || ''} onChange={e => commit({ ...config, actionKey: e.target.value })} />
                </Field>
            )}

            {type === 'LOGIC' && (
                <>
                    <Field label="Field (dot path on the request)">
                        <TextInput value={config.field || ''} onChange={e => commit({ ...config, field: e.target.value })} placeholder="checkerSopResult.passed" />
                    </Field>
                    <Field label="Operator">
                        <Select options={LOGIC_OPS} value={config.op || ''} onChange={e => commit({ ...config, op: e.target.value })} />
                    </Field>
                    <Field label="Value">
                        <TextInput value={config.value ?? ''} onChange={e => commit({ ...config, value: e.target.value })} />
                    </Field>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>
                        Outgoing connections must be labeled exactly "true" or "false".
                    </div>
                </>
            )}

            {type === 'END' && (
                <Field label="Terminal Label">
                    <TextInput value={config.terminalLabel || ''} onChange={e => commit({ ...config, terminalLabel: e.target.value })} placeholder="COMPLETED" />
                </Field>
            )}

            {onSaveAsPreset && (
                presetNameDraft === null ? (
                    <button onClick={() => setPresetNameDraft(label)}
                        style={{ width: '100%', marginTop: 8, padding: '8px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Save as Library Preset
                    </button>
                ) : (
                    <div style={{ marginTop: 8, padding: 10, border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>Preset name</div>
                        <TextInput value={presetNameDraft} onChange={e => setPresetNameDraft(e.target.value)} />
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <button
                                onClick={() => { onSaveAsPreset({ label: presetNameDraft, nodeType: type, subtype: selectedNode.data.subtype, config }); setPresetNameDraft(null); }}
                                disabled={!presetNameDraft.trim()}
                                style={{ flex: 1, padding: '6px', border: 'none', background: '#1d4ed8', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >Save</button>
                            <button onClick={() => setPresetNameDraft(null)}
                                style={{ flex: 1, padding: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >Cancel</button>
                        </div>
                    </div>
                )
            )}

            <button onClick={() => onDeleteNode(selectedNode.id)}
                style={{ width: '100%', marginTop: 8, padding: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Delete Node
            </button>
        </div>
    );
}
