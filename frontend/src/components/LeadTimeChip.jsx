/**
 * LeadTimeChip.jsx
 * Compact consumed/remaining lead-time indicator, shared across the workflow queue pages.
 * Expects the `leadTime` object returned by GET /api/workflow/queue/:queueType
 * (see backend/utils/leadTimeStatus.js) — null until a request has an estimate.
 */

import React from 'react';

const STATUS_STYLE = {
    ON_TRACK:  { bg: '#f0fdf4', color: '#16a34a', label: 'On Track' },
    ATTENTION: { bg: '#fffbeb', color: '#b45309', label: 'Attention' },
    OVERDUE:   { bg: '#fef2f2', color: '#dc2626', label: 'Overdue' },
};

export default function LeadTimeChip({ leadTime }) {
    if (!leadTime || leadTime.estimatedDays == null) return null;
    const s = STATUS_STYLE[leadTime.status] || STATUS_STYLE.ON_TRACK;

    return (
        <div style={{ textAlign: 'center', minWidth: 78 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>
                {Math.max(leadTime.remainingDays, 0)}d
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>Remaining</div>
            <div style={{
                background: s.bg, color: s.color,
                padding: '1px 8px', borderRadius: 10,
                fontSize: 10, fontWeight: 700, display: 'inline-block'
            }}>
                {leadTime.status === 'OVERDUE' ? `Overdue ${leadTime.overdueByDays}d` : `${s.label} · ${leadTime.percent}%`}
            </div>
        </div>
    );
}
