/**
 * FinalApprovalQueuePage.jsx
 * Work queue for the Final Approver — shows DESIGN_APPROVED requests.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getWorkflowQueue } from '../../api/workflowApi';
import LeadTimeChip from '../../components/LeadTimeChip';

export default function FinalApprovalQueuePage() {
    const navigate = useNavigate();
    const [items, setItems]     = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getWorkflowQueue('final')
            .then(r => setItems(r.data.data || []))
            .catch(e => {
                console.error(e);
                toast.error('Failed to load final approval queue');
            })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div style={{ padding: '24px 20px', fontFamily: "'Inter','Segoe UI',sans-serif", width: '100%' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>🏛️ Final Approval Queue</h1>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                    Designs awaiting your final sign-off before production
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
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🏛️</div>
                    No requests awaiting final approval.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {items.map(req => (
                        <div key={req._id}
                            onClick={() => navigate(`/workflow/${req._id}`)}
                            style={{
                                background: '#fff', border: '2px solid #f0fdf4',
                                borderRadius: 10, padding: '16px 20px',
                                cursor: 'pointer', transition: 'box-shadow 0.15s',
                                display: 'flex', alignItems: 'center', gap: 16
                            }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,163,74,0.12)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                            <div style={{
                                width: 40, height: 40, borderRadius: '50%',
                                background: '#f0fdf4', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: 20, flexShrink: 0
                            }}>🏛️</div>

                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>
                                    {req.mhRequestId}
                                </div>
                                <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
                                    {req.departmentName} · {req.plantLocation} · {req.requestType}
                                </div>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                                    Design approved by Checker · Submitted by {req.userName}
                                </div>
                            </div>

                            <LeadTimeChip leadTime={req.leadTime} />

                            <div style={{
                                background: '#f0fdf4', color: '#16a34a',
                                padding: '4px 12px', borderRadius: 20,
                                fontSize: 12, fontWeight: 700
                            }}>
                                Awaiting Final Approval
                            </div>

                            <span style={{ color: '#94a3b8', fontSize: 18 }}>›</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
