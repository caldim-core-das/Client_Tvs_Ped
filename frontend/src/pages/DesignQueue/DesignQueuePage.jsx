import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getWorkflowQueue } from '../../api/workflowApi';
import { useAuth } from '../../context/AuthContext';
import LeadTimeChip from '../../components/LeadTimeChip';

const STATE_COLORS = {
    L1_APPROVED:         { bg: '#eff6ff', color: '#2563eb', label: 'Awaiting Design Team Assignment' },
    DESIGN_IN_PROGRESS:  { bg: '#f5f3ff', color: '#7c3aed', label: 'In Progress' },
    DESIGN_REJECTED:     { bg: '#fef2f2', color: '#dc2626', label: 'Revision Required' },
    DESIGN_SUBMITTED:    { bg: '#ecfeff', color: '#0891b2', label: 'Design Submitted (Under Review)' },
    DESIGN_APPROVED:     { bg: '#f0fdf4', color: '#16a34a', label: 'Approved by Checker' },
    FINAL_APPROVED:      { bg: '#f0fdf4', color: '#16a34a', label: 'Final Approved' },
    IN_PRODUCTION:       { bg: '#fffbeb', color: '#d97706', label: 'In Production' },
    IMPLEMENTATION:      { bg: '#f5f3ff', color: '#7c3aed', label: 'Implementation' },
    COMPLETED:           { bg: '#f0fdf4', color: '#16a34a', label: 'Completed' },
};

export default function DesignQueuePage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const role = user?.role;

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'

    const loadQueue = async (tab) => {
        setLoading(true);
        try {
            const r = await getWorkflowQueue('design', { history: tab === 'history' });
            setItems(r.data.data || []);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load design queue');
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
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>🎨 Design Queue</h1>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                    {role === 'PED Engineer'
                        ? 'Requests awaiting a Designer & Checker assignment, or already in progress. Open a request to assign the design team.'
                        : 'Requests assigned or pending design work'}
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
                        {activeTab === 'history' ? '📜' : '🎉'}
                    </div>
                    {activeTab === 'history' 
                        ? 'No completed or submitted design tasks yet.' 
                        : 'No pending design tasks. All caught up!'}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {items.map(req => {
                        const sc = STATE_COLORS[req.workflowState] || { bg: '#f8fafc', color: '#64748b', label: req.workflowState };
                        const assignedDesignerName = req.assignedDesigner?.employeeName || req.assignedDesignerName;

                        return (
                            <div key={req._id}
                                onClick={() => navigate(`/workflow/${req._id}`)}
                                style={{
                                    background: '#fff', border: '1px solid #e2e8f0',
                                    borderRadius: 12, padding: '20px 24px',
                                    cursor: 'pointer', transition: 'all 0.2s shadow',
                                    display: 'flex', flexDirection: 'column', gap: 14
                                }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 800, color: '#0F4C81', fontSize: 16 }}>
                                            {req.mhRequestId}
                                        </div>
                                        <div style={{ fontSize: 13, color: '#475569', marginTop: 4, fontWeight: 600 }}>
                                            {req.handlingPartName} {req.materialHandlingEquipment ? `· ${req.materialHandlingEquipment}` : ''}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                            Submitted by {req.userName} · {req.departmentName} · {req.plantLocation}
                                        </div>
                                    </div>

                                    <LeadTimeChip leadTime={req.leadTime} />

                                    <div style={{
                                        background: sc.bg, color: sc.color,
                                        padding: '5px 14px', borderRadius: 20,
                                        fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap'
                                    }}>
                                        {sc.label}
                                    </div>

                                    <span style={{ color: '#94a3b8', fontSize: 20 }}>›</span>
                                </div>

                                {/* ── Rejection Notice Banner for Designers ── */}
                                {req.workflowState === 'DESIGN_REJECTED' && (
                                    <div style={{
                                        background: '#fef2f2', border: '1px solid #fecaca',
                                        borderRadius: 8, padding: '10px 14px', fontSize: 13,
                                        color: '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
                                    }}>
                                        <span>⚠️</span>
                                        <span>Design Rejected by Checker: <strong>{req.checkerComment || 'Revision required before re-submitting.'}</strong></span>
                                    </div>
                                )}

                                {/* ── Assignment status row ── */}
                                {req.workflowState !== 'L1_APPROVED' && (
                                    <div style={{
                                        borderTop: '1px solid #f1f5f9', paddingTop: 12,
                                        fontSize: 12, color: '#334155', fontWeight: 600,
                                        background: '#f8fafc', padding: '10px 14px', borderRadius: 8
                                    }}>
                                        Assigned Designer: <strong style={{ color: assignedDesignerName ? '#0f172a' : '#7c3aed' }}>
                                            {assignedDesignerName || 'Not Assigned Yet'}
                                        </strong>
                                    </div>
                                )}
                                {req.workflowState === 'L1_APPROVED' && (
                                    <div style={{
                                        borderTop: '1px solid #f1f5f9', paddingTop: 12,
                                        fontSize: 12, color: '#2563eb', fontWeight: 700,
                                        background: '#eff6ff', padding: '10px 14px', borderRadius: 8
                                    }}>
                                        Open this request to assign a Designer and Checker.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
