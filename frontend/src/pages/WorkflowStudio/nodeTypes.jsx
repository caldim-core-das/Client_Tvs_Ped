/**
 * nodeTypes.jsx
 * Custom @xyflow/react node renderers — one small colored card per node
 * category, matching the node-library color coding.
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import {
    Zap, GitBranch, Users2, UserCheck, Wrench, Mail, Clock, Flag
} from 'lucide-react';

export const CATEGORY_STYLE = {
    TRIGGER:       { bg: '#EEF2FF', border: '#6366F1', text: '#4338CA', icon: Zap,      label: 'TRIGGER' },
    LOGIC:         { bg: '#FFF7ED', border: '#F97316', text: '#C2410C', icon: GitBranch, label: 'LOGIC' },
    ROUTING:       { bg: '#FDF4FF', border: '#D946EF', text: '#A21CAF', icon: Users2,    label: 'ROUTING' },
    HUMAN_TASK:    { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8', icon: UserCheck, label: 'HUMAN TASK' },
    ACTION:        { bg: '#F8FAFC', border: '#64748B', text: '#334155', icon: Wrench,    label: 'ACTION' },
    COMMUNICATION: { bg: '#ECFDF5', border: '#10B981', text: '#047857', icon: Mail,      label: 'COMMUNICATION' },
    SLA:           { bg: '#FEF2F2', border: '#EF4444', text: '#B91C1C', icon: Clock,     label: 'SLA' },
    END:           { bg: '#F1F5F9', border: '#0F172A', text: '#0F172A', icon: Flag,      label: 'END' },
};

function StudioNode({ data, selected }) {
    const style = CATEGORY_STYLE[data.nodeType] || CATEGORY_STYLE.ACTION;
    const Icon = style.icon;
    return (
        <div
            style={{
                background: '#fff', border: `2px solid ${selected ? style.text : style.border}`,
                borderRadius: 10, minWidth: 220, boxShadow: selected ? '0 0 0 3px rgba(59,130,246,0.15)' : '0 1px 3px rgba(0,0,0,0.08)'
            }}
        >
            {data.nodeType !== 'TRIGGER' && <Handle type="target" position={Position.Top} style={{ background: style.border, width: 8, height: 8 }} />}
            <div style={{ background: style.bg, color: style.text, padding: '4px 10px', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                <Icon size={12} strokeWidth={2.5} /> {style.label}
            </div>
            <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{data.label}</div>
                {data.subtitle && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{data.subtitle}</div>}
            </div>
            {data.nodeType !== 'END' && <Handle type="source" position={Position.Bottom} style={{ background: style.border, width: 8, height: 8 }} />}
        </div>
    );
}

export const nodeTypes = {
    TRIGGER: StudioNode,
    LOGIC: StudioNode,
    ROUTING: StudioNode,
    HUMAN_TASK: StudioNode,
    ACTION: StudioNode,
    COMMUNICATION: StudioNode,
    SLA: StudioNode,
    END: StudioNode,
};

export function nodeSubtitle(node) {
    const c = node.config || {};
    switch (node.type) {
        case 'HUMAN_TASK': return (c.decisions || []).join(' / ') || 'no decisions configured';
        case 'ROUTING': return `${c.targetField || '—'} (${c.assignBy || '—'})`;
        case 'COMMUNICATION': return c.templateKey || 'no template';
        case 'ACTION':
        case 'SLA': return c.actionKey || 'no action';
        case 'LOGIC': return c.field ? `${c.field} ${c.op} ${c.value}` : 'no condition';
        case 'END': return c.terminalLabel || '';
        default: return '';
    }
}
