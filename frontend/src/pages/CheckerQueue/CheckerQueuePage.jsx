/**
 * CheckerQueuePage.jsx
 * Work queue for Checkers — shows all DESIGN_SUBMITTED requests.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getWorkflowQueue } from '../../api/workflowApi';
import LeadTimeChip from '../../components/LeadTimeChip';

export default function CheckerQueuePage() {
    const navigate = useNavigate();
    const [items, setItems]     = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getWorkflowQueue('checker')
            .then(r => setItems(r.data.data || []))
            .catch(e => {
                console.error(e);
                toast.error('Failed to load checker queue');
            })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div style={{ padding: '24px 20px', fontFamily: "'Inter','Segoe UI',sans-serif", width: '100%' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>🔍 Checker Queue</h1>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                    Designs awaiting your technical review and approval
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
                    <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                    No designs pending your review.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {items.map(req => (
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
                                    {req.materialHandlingEquipment || '—'} · Submitted by {req.userName}
                                </div>
                            </div>

                            <LeadTimeChip leadTime={req.leadTime} />

                            <div style={{
                                background: '#ecfeff', color: '#0891b2',
                                padding: '4px 12px', borderRadius: 20,
                                fontSize: 12, fontWeight: 700
                            }}>
                                Design Submitted
                            </div>

                            <span style={{ color: '#94a3b8', fontSize: 18 }}>›</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
