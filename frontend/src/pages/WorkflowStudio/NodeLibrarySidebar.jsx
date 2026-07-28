/**
 * NodeLibrarySidebar.jsx
 * Searchable, category-grouped palette of draggable node types — drag onto
 * the canvas to add a new node to the workflow graph.
 *
 * Three levels: Category (Triggers, Logic, Human Tasks, Routing, ...) →
 * generic subtype (Approval Gate, Manual Task, Auto Assignment, ...,
 * matching the standard node-builder vocabulary) → concrete, ready-to-use
 * MH Request presets nested inside each (e.g. expand "Approval Gate" to find
 * "L1 Approval Gate", "Assign PED Engineer", "Checker Validation (SOP
 * Gated)"). Every item — at any level — is independently draggable and
 * carries its own functional `type`, so where a preset is filed for
 * discoverability never changes what kind of node it creates (e.g. "Assign
 * PED Engineer" is filed under Human Tasks but still creates a Routing node,
 * matching what it actually does when the graph runs).
 *
 * A CUSTOM section (populated from the backend) lets Studio users save their
 * own configured nodes as reusable presets — see ParamPanel's "Save as
 * Library Preset" and WorkflowStudioPage's preset load/create/delete wiring.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Search, X, GripVertical } from 'lucide-react';
import { CATEGORY_STYLE } from './nodeTypes';

const LIBRARY = [
    { category: 'TRIGGERS', items: [
        { type: 'TRIGGER', subtype: 'MH_REQUEST_CREATED', label: 'Trigger Event', config: {} },
    ]},
    { category: 'LOGIC', items: [
        { type: 'LOGIC', subtype: 'IF_ELSE', label: 'If / Else Branch', config: { field: '', op: 'eq', value: '' } },
    ]},
    { category: 'HUMAN TASKS', items: [
        { type: 'HUMAN_TASK', subtype: 'APPROVAL_GATE', label: 'Approval Gate',
            config: { allowedRoles: [], decisions: ['Approved', 'Rejected'], commentRequiredFor: ['Rejected'], minCommentLength: 10, requiredPayloadFields: [] },
            children: [
                { type: 'HUMAN_TASK', subtype: 'APPROVAL_GATE', label: 'L1 Approval Gate', config: { allowedRoles: ['L1 Approver', 'Admin'], decisions: ['Approved', 'Rejected'], commentRequiredFor: ['Rejected'], minCommentLength: 10, requiredPayloadFields: [{ key: 'assignEngineerId', label: 'PED Engineer', onlyForDecision: 'Approved' }] } },
                { type: 'ROUTING', subtype: 'AUTO_ASSIGNMENT', label: 'Assign PED Engineer', config: { targetField: 'assignedEngineer', assignBy: 'PAYLOAD', payloadKey: 'assignEngineerId' } },
                { type: 'HUMAN_TASK', subtype: 'APPROVAL_GATE', label: 'PED Engineer Assignment Task', config: { allowedRoles: ['PED Engineer', 'Admin'], decisions: ['Assigned'], requiredPayloadFields: [{ key: 'assignDesignerId', label: 'Designer' }, { key: 'assignCheckerId', label: 'Checker', mustDifferFrom: 'assignDesignerId' }] } },
                { type: 'HUMAN_TASK', subtype: 'APPROVAL_GATE', label: 'Checker Validation (SOP Gated)', config: { allowedRoles: ['Checker', 'Admin'], decisions: ['Approve', 'Reject'], commentRequiredFor: ['Reject'], minCommentLength: 10, preActionKey: 'SOP_SCORING', requirePassingFor: ['Approve'] } },
                { type: 'HUMAN_TASK', subtype: 'APPROVAL_GATE', label: 'Final Approval Gate', config: { allowedRoles: ['Final Approver', 'Admin'], decisions: ['Approve', 'Reject'], commentRequiredFor: ['Reject'], minCommentLength: 10 } },
            ] },
        { type: 'HUMAN_TASK', subtype: 'MANUAL_TASK', label: 'Manual Task',
            config: { allowedRoles: [], decisions: ['Done'], commentRequiredFor: [], minCommentLength: 1, requiredPayloadFields: [] },
            children: [
                { type: 'HUMAN_TASK', subtype: 'MANUAL_TASK', label: 'Designer Upload Task', config: { allowedRoles: ['Designer', 'PED Engineer', 'Admin'], decisions: ['Submit', 'Reject Task'], commentRequiredFor: ['Reject Task'], minCommentLength: 5, requiresAction: 'SECURE_FILE_UPLOAD' } },
            ] },
    ]},
    { category: 'ROUTING', items: [
        { type: 'ROUTING', subtype: 'AUTO_ASSIGNMENT', label: 'Auto Assignment', config: { targetField: '', assignBy: 'PAYLOAD', payloadKey: '', roleToAssign: '' },
            children: [
                { type: 'ROUTING', subtype: 'AUTO_ASSIGNMENT', label: 'Assign Designer', config: { targetField: 'assignedDesigner', assignBy: 'PAYLOAD', payloadKey: 'assignDesignerId' } },
                { type: 'ROUTING', subtype: 'AUTO_ASSIGNMENT', label: 'Assign Checker', config: { targetField: 'assignedChecker', assignBy: 'PAYLOAD', payloadKey: 'assignCheckerId' } },
                { type: 'ROUTING', subtype: 'AUTO_ASSIGNMENT', label: 'Assign Final Approver (by Role)', config: { targetField: 'assignedFinalApprover', assignBy: 'ROLE_LOOKUP', roleToAssign: 'Final Approver' } },
            ] },
    ]},
    { category: 'ACTIONS', items: [
        { type: 'ACTION', subtype: 'CUSTOM', label: 'Custom Action', config: { actionKey: '', params: {} },
            children: [
                { type: 'ACTION', subtype: 'CUSTOM', label: 'SOP Scoring Check', config: { actionKey: 'SOP_SCORING', params: {} } },
                { type: 'ACTION', subtype: 'CUSTOM', label: 'Lead Time Estimate', config: { actionKey: 'LEAD_TIME_ESTIMATE', params: {} } },
                { type: 'ACTION', subtype: 'CUSTOM', label: 'Secure File Upload', config: { actionKey: 'SECURE_FILE_UPLOAD', params: {} } },
                { type: 'ACTION', subtype: 'CUSTOM', label: 'Requester Status Email', config: { actionKey: 'REQUESTER_STATUS_EMAIL', params: {} } },
            ] },
    ]},
    { category: 'COMMUNICATION', items: [
        { type: 'COMMUNICATION', subtype: 'EMAIL', label: 'Send Email', config: { templateKey: '', recipientSource: 'REQUESTER' } },
    ]},
    { category: 'SLA', items: [
        { type: 'SLA', subtype: 'SLA_MANAGEMENT', label: 'SLA Management', config: { actionKey: 'LEAD_TIME_ESTIMATE' } },
    ]},
    { category: 'END', items: [
        { type: 'END', subtype: 'COMPLETED', label: 'End Process', config: { terminalLabel: '' },
            children: [
                { type: 'END', subtype: 'COMPLETED', label: 'Completed', config: { terminalLabel: 'COMPLETED' } },
                { type: 'END', subtype: 'REJECTED_TERMINAL', label: 'L1 Rejected', config: { terminalLabel: 'L1_REJECTED' } },
                { type: 'END', subtype: 'REJECTED_TERMINAL', label: 'Reverted', config: { terminalLabel: 'REVERTED' } },
            ] },
    ]},
];

function NodeRow({ item, depth, isCustomGroup, onDragStart, onDeletePreset }) {
    const style = CATEGORY_STYLE[item.type] || CATEGORY_STYLE.ACTION;
    return (
        <div
            draggable
            onDragStart={e => { e.stopPropagation(); onDragStart(e, item.type, item); }}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '8px 10px', margin: '2px 0', marginLeft: depth * 14,
                border: `1px solid ${style.border}33`, background: style.bg, color: style.text,
                borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'grab'
            }}
            title={`Drag onto the canvas to add a ${item.label} node`}
        >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <GripVertical size={12} style={{ opacity: 0.5 }} />
                {item.label}
            </span>
            {isCustomGroup && onDeletePreset && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDeletePreset(item.id); }}
                    title="Delete this custom preset"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: style.text, opacity: 0.6, padding: 0 }}
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
}

export default function NodeLibrarySidebar({ customPresets = [], onDeletePreset }) {
    const [search, setSearch] = useState('');
    const [collapsedCategories, setCollapsedCategories] = useState({});
    const [collapsedSubtypes, setCollapsedSubtypes] = useState({});

    const onDragStart = (event, type, item) => {
        event.dataTransfer.setData('application/studio-node', JSON.stringify({ type, subtype: item.subtype, label: item.label, config: item.config }));
        event.dataTransfer.effectAllowed = 'move';
    };

    const q = search.trim().toLowerCase();
    const matches = (label) => !q || label.toLowerCase().includes(q);

    const groups = [
        ...LIBRARY,
        { category: 'CUSTOM', items: customPresets.map(p => ({
            id: p._id, subtype: p.subtype, label: p.label, config: p.config, type: p.nodeType
        })) }
    ];

    return (
        <div style={{ width: 260, borderRight: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: 0.5, marginBottom: 8 }}>NODE LIBRARY</div>
                <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: '#94a3b8' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search nodes..."
                        style={{ width: '100%', padding: '6px 8px 6px 26px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, outline: 'none' }}
                    />
                </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
                {groups.map(group => {
                    const isCustomGroup = group.category === 'CUSTOM';

                    // Build the visible item list for this category, filtered by search —
                    // a subtype matches if its own label matches OR any of its children do
                    // (in which case only the matching children are shown).
                    const visibleItems = group.items
                        .map(item => {
                            const children = item.children || [];
                            const selfMatches = matches(item.label);
                            const matchingChildren = children.filter(c => matches(c.label));
                            if (!q || selfMatches || matchingChildren.length > 0) {
                                return { ...item, children: (q && !selfMatches) ? matchingChildren : children };
                            }
                            return null;
                        })
                        .filter(Boolean);

                    if (visibleItems.length === 0) return null;
                    const isCategoryCollapsed = collapsedCategories[group.category];

                    return (
                        <div key={group.category} style={{ marginBottom: 6 }}>
                            <button
                                onClick={() => setCollapsedCategories(prev => ({ ...prev, [group.category]: !prev[group.category] }))}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: '6px 4px', cursor: 'pointer', fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: 0.5 }}
                            >
                                {isCategoryCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                {group.category}
                            </button>
                            {!isCategoryCollapsed && visibleItems.map(item => {
                                const hasChildren = item.children && item.children.length > 0;
                                const subtypeKey = `${group.category}:${item.label}`;
                                const isSubtypeCollapsed = !q && collapsedSubtypes[subtypeKey];
                                return (
                                    <div key={item.id || item.label}>
                                        <div style={{ display: 'flex', alignItems: 'stretch' }}>
                                            {hasChildren && (
                                                <button
                                                    onClick={() => setCollapsedSubtypes(prev => ({ ...prev, [subtypeKey]: !prev[subtypeKey] }))}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: '#94a3b8' }}
                                                    title={isSubtypeCollapsed ? 'Expand' : 'Collapse'}
                                                >
                                                    {isSubtypeCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                                </button>
                                            )}
                                            <div style={{ flex: 1 }}>
                                                <NodeRow item={item} depth={hasChildren ? 0 : 0} isCustomGroup={isCustomGroup} onDragStart={onDragStart} onDeletePreset={onDeletePreset} />
                                            </div>
                                        </div>
                                        {hasChildren && !isSubtypeCollapsed && item.children.map(child => (
                                            <NodeRow key={child.label} item={child} depth={1} isCustomGroup={false} onDragStart={onDragStart} />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
