/**
 * DesignQueuePage.jsx
 * Work queue for Designers — shows all requests in DESIGN_IN_PROGRESS / DESIGN_REJECTED state
 * assigned to the current user.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getWorkflowQueue } from '../../api/workflowApi';
import LeadTimeChip from '../../components/LeadTimeChip';

const STATE_COLORS = {
    DESIGN_IN_PROGRESS: { bg: '#f5f3ff', color: '#7c3aed', label: 'In Progress' },
    DESIGN_REJECTED:    { bg: '#fef2f2', color: '#dc2626', label: 'Revision Required' },
};

export default function DesignQueuePage() {
    const navigate = useNavigate();
    const [items, setItems]   = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getWorkflowQueue('design')
            .then(r => setItems(r.data.data || []))
            .catch(e => {
                console.error(e);
                toast.error('Failed to load design queue');
            })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div style={{ padding: '24px 20px', fontFamily: "'Inter','Segoe UI',sans-serif", width: '100%' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>🎨 Design Queue</h1>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                    Requests assigned to you for design work
                </p>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Loading...</div>
            ) : items.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: 60,
                    background: '#f8fafc', borderRadius: 12,
                    border: '1px dashed #e2e8f0', color: '#94a3b8'
                }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                    No pending design tasks. All caught up!
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {items.map(req => {
                        const sc = STATE_COLORS[req.workflowState] || { bg: '#f8fafc', color: '#64748b', label: req.workflowState };
                        return (
                            <div key={req._id}
                                onClick={() => navigate(`/workflow/${req._id}`)}
                                style={{
                                    background: '#fff', border: '1px solid #e2e8f0',
                                    borderRadius: 10, padding: '16px 20px',
                                    cursor: 'pointer', transition: 'box-shadow 0.15s',
                                    display: 'flex', alignItems: 'center', gap: 16
                                }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>
                                        {req.mhRequestId}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
                                        {req.departmentName} · {req.plantLocation} · {req.requestType}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                                        {req.materialHandlingEquipment || '—'} · {req.handlingPartName}
                                    </div>
                                </div>

                                <LeadTimeChip leadTime={req.leadTime} />

                                <div style={{
                                    background: sc.bg, color: sc.color,
                                    padding: '4px 12px', borderRadius: 20,
                                    fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap'
                                }}>
                                    {sc.label}
                                </div>

                                <span style={{ color: '#94a3b8', fontSize: 18 }}>›</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
