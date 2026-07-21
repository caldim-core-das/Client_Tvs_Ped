import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getWorkflowQueue } from '../../api/workflowApi';
import { useAuth } from '../../context/AuthContext';
import LeadTimeChip from '../../components/LeadTimeChip';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => {
    const t = sessionStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
};

const STATE_COLORS = {
    DESIGN_IN_PROGRESS: { bg: '#f5f3ff', color: '#7c3aed', label: 'In Progress' },
    DESIGN_REJECTED:    { bg: '#fef2f2', color: '#dc2626', label: 'Revision Required' },
};

export default function DesignQueuePage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const role = user?.role;

    const [items, setItems] = useState([]);
    const [designers, setDesigners] = useState([]);
    const [selectedDesigners, setSelectedDesigners] = useState({});
    const [assigningId, setAssigningId] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadQueue = async () => {
        try {
            const r = await getWorkflowQueue('design');
            setItems(r.data.data || []);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load design queue');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadQueue();

        // Fetch active Designers from Employee Master
        axios.get(`${BASE_URL}/employees?limit=100`, { headers: getAuthHeader() })
            .then(res => {
                const list = (res.data?.data || []).filter(e => /^designer$/i.test(e.role || ''));
                setDesigners(list);
            })
            .catch(() => setDesigners([]));
    }, []);

    const handleAssignDesigner = async (reqId, e) => {
        e.stopPropagation();
        const designerId = selectedDesigners[reqId];
        if (!designerId) {
            toast.error('Please select a Designer first');
            return;
        }

        setAssigningId(reqId);
        try {
            await axios.patch(`${BASE_URL}/asset-request/${reqId}/assign-designer`, { designerId }, { headers: getAuthHeader() });
            toast.success('Designer assigned successfully! Notification email sent.');
            await loadQueue();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to assign designer');
        } finally {
            setAssigningId(null);
        }
    };

    return (
        <div style={{ padding: '24px 20px', fontFamily: "'Inter','Segoe UI',sans-serif", width: '100%' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>🎨 Design Queue</h1>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                    Requests assigned or pending design work
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

                                {/* ── PED Engineer / Admin Assignment Row ── */}
                                {(role === 'PED Engineer' || role === 'Admin' || role === 'L1 Approver') && (
                                    <div
                                        onClick={e => e.stopPropagation()}
                                        style={{
                                            borderTop: '1px solid #f1f5f9', paddingTop: 12,
                                            display: 'flex', alignItems: 'center', justifyContent: 'between', gap: 12,
                                            background: '#f8fafc', padding: '10px 14px', borderRadius: 8
                                        }}
                                    >
                                        <div style={{ fontSize: 12, color: '#334155', fontWeight: 600, flex: 1 }}>
                                            Assigned Designer: <strong style={{ color: assignedDesignerName ? '#0f172a' : '#7c3aed' }}>
                                                {assignedDesignerName || 'Not Assigned Yet'}
                                            </strong>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <select
                                                value={selectedDesigners[req._id] || ''}
                                                onChange={e => setSelectedDesigners({ ...selectedDesigners, [req._id]: e.target.value })}
                                                style={{
                                                    padding: '6px 12px', fontSize: 13, borderRadius: 6,
                                                    border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b',
                                                    outline: 'none', fontWeight: 500
                                                }}
                                            >
                                                <option value="">Select Designer to Assign...</option>
                                                {designers.map(d => (
                                                    <option key={d._id} value={d._id}>
                                                        {d.employeeName} ({d.employeeId} · {d.departmentName || 'Designer'})
                                                    </option>
                                                ))}
                                            </select>

                                            <button
                                                type="button"
                                                disabled={assigningId === req._id || !selectedDesigners[req._id]}
                                                onClick={e => handleAssignDesigner(req._id, e)}
                                                style={{
                                                    background: !selectedDesigners[req._id] ? '#94a3b8' : '#7c3aed',
                                                    color: '#fff', border: 'none', borderRadius: 6,
                                                    padding: '6px 16px', fontSize: 12, fontWeight: 700,
                                                    cursor: !selectedDesigners[req._id] ? 'not-allowed' : 'pointer',
                                                    transition: 'background 0.15s'
                                                }}
                                            >
                                                {assigningId === req._id ? 'Assigning...' : 'Assign Designer'}
                                            </button>
                                        </div>
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
