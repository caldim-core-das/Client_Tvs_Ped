/**
 * FinalApprovalQueuePage.jsx
 * Work queue for the Final Approver — shows active and historical sign-off requests.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getWorkflowQueue } from '../../api/workflowApi';
import LeadTimeChip from '../../components/LeadTimeChip';

const STATE_COLORS = {
    DESIGN_APPROVED:     { bg: '#f0fdf4', color: '#16a34a', label: 'Awaiting Final Approval' },
    FINAL_APPROVED:      { bg: '#f0fdf4', color: '#16a34a', label: 'Final Approved' },
    IN_PRODUCTION:       { bg: '#fffbeb', color: '#d97706', label: 'In Production' },
    IMPLEMENTATION:      { bg: '#f5f3ff', color: '#7c3aed', label: 'Implementation' },
    COMPLETED:           { bg: '#f0fdf4', color: '#16a34a', label: 'Completed' },
    FINAL_REJECTED:      { bg: '#fef2f2', color: '#dc2626', label: 'Final Rejected' },
};

export default function FinalApprovalQueuePage() {
    const navigate = useNavigate();
    const [items, setItems]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'

    const loadQueue = async (tab) => {
        setLoading(true);
        try {
            const r = await getWorkflowQueue('final', { history: tab === 'history' });
            setItems(r.data.data || []);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load final approval queue');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadQueue(activeTab);
    }, [activeTab]);

    return (
        <div style={{ padding: '24px 20px', fontFamily: "'Inter','Segoe UI',sans-serif", width: '100%' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>🏛️ Final Approval Queue</h1>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                    Designs awaiting your final sign-off before production
                </p>
            </div>

            {/* ── Tabs Selector ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                <button
                    onClick={() => setActiveTab('pending')}
                    style={{
                        padding: '10px 18px',
                        border: 'none',
                        background: activeTab === 'pending' ? 'rgba(15,76,129,0.08)' : 'transparent',
                        color: activeTab === 'pending' ? '#0F4C81' : '#64748b',
                        fontWeight: 700,
                        fontSize: 14,
                        borderRadius: 10,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: activeTab === 'pending' ? 'inset 0 0 0 1px rgba(15,76,129,0.15)' : 'none'
                    }}
                >
                    📥 Active Tasks
                    {activeTab === 'pending' && <span style={{ fontSize: 11, background: '#0F4C81', color: '#fff', padding: '1px 6px', borderRadius: 20 }}>{items.length}</span>}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    style={{
                        padding: '10px 18px',
                        border: 'none',
                        background: activeTab === 'history' ? 'rgba(15,76,129,0.08)' : 'transparent',
                        color: activeTab === 'history' ? '#0F4C81' : '#64748b',
                        fontWeight: 700,
                        fontSize: 14,
                        borderRadius: 10,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: activeTab === 'history' ? 'inset 0 0 0 1px rgba(15,76,129,0.15)' : 'none'
                    }}
                >
                    📜 History
                    {activeTab === 'history' && <span style={{ fontSize: 11, background: '#0F4C81', color: '#fff', padding: '1px 6px', borderRadius: 20 }}>{items.length}</span>}
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Loading...</div>
            ) : items.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: 60,
                    background: '#f8fafc', borderRadius: 12,
                    border: '1px dashed #e2e8f0', color: '#94a3b8'
                }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>
                        {activeTab === 'history' ? '📜' : '🏛️'}
                    </div>
                    {activeTab === 'history' 
                        ? 'No approved or completed requests yet.' 
                        : 'No requests awaiting final approval.'}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {items.map(req => {
                        const sc = STATE_COLORS[req.workflowState] || { bg: '#f8fafc', color: '#64748b', label: req.workflowState };
                        return (
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
                                    background: sc.bg, color: sc.color,
                                    padding: '4px 12px', borderRadius: 20,
                                    fontSize: 12, fontWeight: 700
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
