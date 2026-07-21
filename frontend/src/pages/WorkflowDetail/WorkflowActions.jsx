/**
 * WorkflowActions.jsx
 * Role-based action panel for the current workflow stage.
 * Enterprise Governance Action Center.
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import {
    l1Approve, l1Reject,
    submitDesign,
    checkDesign,
    finalApprove,
    advanceProduction,
    designerReject
} from '../../api/workflowApi';
import { CheckCircle2, XCircle, Send, PlayCircle, Loader2, Info, AlertTriangle } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => {
    const t = sessionStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
};

// ─── Toast messaging per action — mirrors the enterprise notification copy ────
const leadTimeSuffix = (lt) => {
    if (!lt || lt.consumedDays === undefined || lt.consumedDays === null) return '';
    return ` — ${lt.consumedDays} of ${lt.estimatedDays} days consumed, ${Math.max(lt.remainingDays, 0)} remaining.`;
};

const SUCCESS_TOASTS = {
    l1approve:      (lt) => `Designer & Checker Assigned.${leadTimeSuffix(lt)}`,
    l1reject:       () => 'MH Request Rejected. Requester notified.',
    assigndesigner: () => 'Designer assigned successfully! Notification email sent.',
    submitdesign:   (lt) => `Design Submitted. Checker notified.${leadTimeSuffix(lt)}`,
    designerreject: () => 'Request Returned to Requester.',
    checkerapprove: (lt) => `Checker Approved Design. Final Approver notified.${leadTimeSuffix(lt)}`,
    checkerreject:  () => 'Design Returned for Rework. Designer notified.',
    finalapprove:   (lt) => `Final Approval Completed. Vendor Selection Started.${leadTimeSuffix(lt)}`,
    finalreject:    () => 'Final Approval Rejected. Returned to L1 Approver.',
    advance_IN_PRODUCTION:  (lt) => `Production Started.${leadTimeSuffix(lt)}`,
    advance_IMPLEMENTATION: (lt) => `Marked as Implementation.${leadTimeSuffix(lt)}`,
    advance_COMPLETED:      () => 'Workflow Completed Successfully.',
};

const BTN = {
    approve: { base: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20', icon: CheckCircle2, label: 'Approve' },
    reject:  { base: 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20', icon: XCircle, label: 'Reject' },
    submit:  { base: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20', icon: Send, label: 'Submit Design' },
    advance: { base: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20', icon: PlayCircle, label: 'Mark as Done' },
};

function ActionButton({ config, onClick, labelOverride }) {
    const Icon = config.icon;
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${config.base}`}
        >
            <Icon size={16} strokeWidth={2.5} /> 
            {labelOverride || config.label}
        </button>
    );
}

function CommentModal({ title, required = true, onConfirm, onClose, extraFields }) {
    const [comment, setComment] = useState('');
    const [fields, setFields]   = useState({});
    const [error, setError]     = useState('');

    const handle = () => {
        if (required && comment.trim().length < 10) {
            setError('Comment must be at least 10 characters');
            return;
        }
        onConfirm({ comment, ...fields });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                </div>
                
                <div className="p-6">
                    {/* Extra fields (e.g. designer/checker selects) */}
                    {extraFields}

                    <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Comment {required && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                            value={comment}
                            onChange={e => { setComment(e.target.value); setError(''); }}
                            rows={4}
                            className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
                            placeholder="Enter your comment..."
                        />
                        {error && <div className="text-red-500 text-xs font-semibold mt-2">{error}</div>}
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors">
                            Cancel
                        </button>
                        <button onClick={handle} className="px-5 py-2.5 rounded-lg bg-[#0F4C81] hover:bg-[#0c3e6a] text-white font-bold text-sm shadow-sm transition-colors">
                            Confirm Action
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function WorkflowActions({ requestId, workflowState, employees = [], onActionComplete }) {
    const { user } = useAuth();
    const role = user?.role || user?.permissions?.role;

    const [modal, setModal]     = useState(null);  // 'l1approve' | 'l1reject' | ...
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    // Fields for L1 approve (designer + checker select)
    const [designerId, setDesignerId] = useState('');
    const [checkerId,  setCheckerId]  = useState('');

    // Design file upload
    const [designFiles, setDesignFiles] = useState([]);

    const exec = async (fn, toastKey) => {
        setLoading(true);
        setError('');
        try {
            const result = await fn();
            const buildMessage = SUCCESS_TOASTS[toastKey];
            toast.success(buildMessage ? buildMessage(result?.leadTime) : 'Action completed successfully.');
            onActionComplete?.();
        } catch (e) {
            const message = e?.response?.data?.message || e.message;
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Render per role + state ──────────────────────────────────────────────

    if (!role || !workflowState) return null;

    const panels = [];
    let actionSummary = '';

    // L1 Approver / PED Engineer: SUBMITTED, Assigned, or DESIGN_IN_PROGRESS
    if ((role === 'L1 Approver' || role === 'PED Engineer' || role === 'Admin') &&
        ['SUBMITTED', 'Notified', 'Assigned', 'L1_APPROVED', 'Pending', 'DESIGN_IN_PROGRESS', 'DESIGN_REJECTED'].includes(workflowState)) {
        actionSummary = actionSummary || "Select a Designer from Employee Master to assign them for product design. A notification email will be sent automatically.";
        panels.push(
            <div key="ped-assign" className="flex flex-col gap-3">
                <ActionButton
                    config={{ base: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20', icon: Send, label: 'Assign Designer' }}
                    onClick={() => setModal('assigndesigner')}
                />
                {role === 'L1 Approver' && workflowState === 'SUBMITTED' && (
                    <ActionButton config={BTN.reject} onClick={() => setModal('l1reject')} />
                )}
            </div>
        );
    }

    // Designer: DESIGN_IN_PROGRESS
    if ((role === 'Designer' || role === 'Admin') &&
        ['DESIGN_IN_PROGRESS', 'DESIGN_REJECTED'].includes(workflowState)) {
        actionSummary = "You are requested to submit the final design documents for this request.";
        panels.push(
            <div key="designer" className="flex flex-col gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <label className="block text-sm font-bold text-slate-700 mb-3">
                        Upload Design Documents
                    </label>
                    <input
                        type="file"
                        multiple
                        onChange={e => setDesignFiles(Array.from(e.target.files))}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                        accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
                    />
                    {designFiles.length > 0 && (
                        <div className="text-xs font-semibold text-emerald-600 mt-3 flex items-center gap-1.5">
                            <CheckCircle2 size={14} /> {designFiles.length} file(s) selected and ready
                        </div>
                    )}
                </div>
                <div className="flex gap-3">
                    <ActionButton config={BTN.submit} onClick={() => setModal('submitdesign')} />
                    <ActionButton config={BTN.reject} labelOverride="Revert Request" onClick={() => setModal('designerreject')} />
                </div>
            </div>
        );
    }

    // Checker: DESIGN_SUBMITTED
    if ((role === 'Checker' || role === 'Admin') && workflowState === 'DESIGN_SUBMITTED') {
        actionSummary = "You are requested to verify the submitted design documents.";
        panels.push(
            <div key="checker" className="flex gap-3">
                <ActionButton config={BTN.approve} onClick={() => setModal('checkerapprove')} />
                <ActionButton config={BTN.reject}  onClick={() => setModal('checkerreject')}  />
            </div>
        );
    }

    // Final Approver: DESIGN_APPROVED
    if ((role === 'Final Approver' || role === 'Admin') && workflowState === 'DESIGN_APPROVED') {
        actionSummary = "You are requested to provide final authorization for production.";
        panels.push(
            <div key="final" className="flex gap-3">
                <ActionButton config={BTN.approve} onClick={() => setModal('finalapprove')} />
                <ActionButton config={BTN.reject}  onClick={() => setModal('finalreject')}  />
            </div>
        );
    }

    // PED Engineer: production stages
    if ((role === 'PED Engineer' || role === 'Admin')) {
        const nextStage = {
            FINAL_APPROVED: 'IN_PRODUCTION',
            IN_PRODUCTION:  'IMPLEMENTATION',
            IMPLEMENTATION: 'COMPLETED',
        }[workflowState];
        if (nextStage) {
            actionSummary = `You are requested to advance the process to ${nextStage.replace('_', ' ')}.`;
            panels.push(
                <div key="prod">
                    <ActionButton
                        config={BTN.advance}
                        labelOverride={`Mark as ${nextStage.replace('_', ' ')}`}
                        onClick={() => setModal('advance_' + nextStage)}
                    />
                </div>
            );
        }
    }

    if (!panels.length) return null;

    const designerEmps = employees.filter(e => /^designer$/i.test(e.role || ''));
    const designerOptions = (designerEmps.length > 0 ? designerEmps : employees).map(e => (
        <option key={e._id} value={e._id}>{e.employeeName} ({e.employeeId} · {e.departmentName || e.role})</option>
    ));

    const empOptions = employees.map(e => (
        <option key={e._id} value={e._id}>{e.employeeName} ({e.employeeId})</option>
    ));

    return (
        <div className="bg-white rounded-[18px] shadow-[0_8px_32px_rgba(15,23,42,0.04)] border border-slate-100 overflow-hidden mt-6">
            <div className="px-5 py-4 border-b border-slate-100 bg-[#0F4C81]/5 flex items-center gap-3">
                <Info size={18} className="text-[#0F4C81]" />
                <h2 className="text-[13px] font-bold text-[#0F4C81] uppercase tracking-wider">Action Center</h2>
            </div>

            <div className="p-6">
                {actionSummary && (
                    <div className="text-sm font-medium text-slate-600 mb-5">
                        {actionSummary}
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 mb-5 text-sm font-medium flex items-center gap-2">
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
                        <Loader2 size={16} className="animate-spin" /> Processing authorization...
                    </div>
                ) : (
                    panels
                )}
            </div>

            {/* ── Modals ── */}
            {modal === 'assigndesigner' && (
                <CommentModal
                    title="Assign Designer for Product Design"
                    required={false}
                    extraFields={
                        <div className="flex flex-col gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Select Designer <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={designerId}
                                    onChange={e => setDesignerId(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all bg-slate-50 font-medium text-slate-800"
                                >
                                    <option value="">Choose a Designer from list...</option>
                                    {designerOptions}
                                </select>
                            </div>
                        </div>
                    }
                    onClose={() => setModal(null)}
                    onConfirm={({ comment }) => exec(async () => {
                        if (!designerId) throw new Error('Please select a Designer to proceed');
                        const res = await axios.patch(`${BASE_URL}/asset-request/${requestId}/assign-designer`, { designerId }, { headers: getAuthHeader() });
                        setModal(null);
                        return res.data;
                    }, 'assigndesigner')}
                />
            )}
            {modal === 'l1approve' && (
                <CommentModal
                    title="L1 Approval Authorization"
                    required={false}
                    extraFields={
                        <div className="flex flex-col gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Assign Designer <span className="text-red-500">*</span>
                                </label>
                                <select value={designerId} onChange={e => setDesignerId(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50">
                                    <option value="">Select Designer</option>
                                    {empOptions}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Assign Checker <span className="text-red-500">*</span>
                                </label>
                                <select value={checkerId} onChange={e => setCheckerId(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50">
                                    <option value="">Select Checker</option>
                                    {empOptions}
                                </select>
                            </div>
                        </div>
                    }
                    onClose={() => setModal(null)}
                    onConfirm={({ comment }) => exec(async () => {
                        if (!designerId || !checkerId) throw new Error('Designer and Checker assignments are required for L1 Approval');
                        const result = await l1Approve(requestId, { comment, assignDesignerId: designerId, assignCheckerId: checkerId });
                        setModal(null);
                        return result;
                    }, 'l1approve')}
                />
            )}

            {modal === 'l1reject' && (
                <CommentModal title="Reject Request" required={true} onClose={() => setModal(null)}
                    onConfirm={({ comment }) => exec(async () => { const r = await l1Reject(requestId, { comment }); setModal(null); return r; }, 'l1reject')} />
            )}

            {modal === 'submitdesign' && (
                <CommentModal title="Submit Design Documents" required={false} onClose={() => setModal(null)}
                    onConfirm={({ comment }) => exec(async () => {
                        const fd = new FormData();
                        fd.append('comment', comment);
                        designFiles.forEach(f => fd.append('designDocuments', f));
                        const result = await submitDesign(requestId, fd);
                        setModal(null); setDesignFiles([]);
                        return result;
                    }, 'submitdesign')} />
            )}

            {modal === 'designerreject' && (
                <CommentModal title="Revert Request" required={true} onClose={() => setModal(null)}
                    onConfirm={({ comment }) => exec(async () => { const r = await designerReject(requestId, { comment }); setModal(null); return r; }, 'designerreject')} />
            )}

            {modal === 'checkerapprove' && (
                <CommentModal title="Verify & Approve Design" required={false} onClose={() => setModal(null)}
                    onConfirm={({ comment }) => exec(async () => { const r = await checkDesign(requestId, { action: 'approve', comment }); setModal(null); return r; }, 'checkerapprove')} />
            )}

            {modal === 'checkerreject' && (
                <CommentModal title="Reject Design & Request Revision" required={true} onClose={() => setModal(null)}
                    onConfirm={({ comment }) => exec(async () => { const r = await checkDesign(requestId, { action: 'reject', comment }); setModal(null); return r; }, 'checkerreject')} />
            )}

            {modal === 'finalapprove' && (
                <CommentModal title="Final Authorization" required={false} onClose={() => setModal(null)}
                    onConfirm={({ comment }) => exec(async () => { const r = await finalApprove(requestId, { action: 'approve', comment }); setModal(null); return r; }, 'finalapprove')} />
            )}

            {modal === 'finalreject' && (
                <CommentModal title="Reject Final Authorization" required={true} onClose={() => setModal(null)}
                    onConfirm={({ comment }) => exec(async () => { const r = await finalApprove(requestId, { action: 'reject', comment }); setModal(null); return r; }, 'finalreject')} />
            )}

            {modal?.startsWith('advance_') && (
                <CommentModal title={`Advance to ${modal.replace('advance_', '').replace('_', ' ')}`} required={false} onClose={() => setModal(null)}
                    onConfirm={({ comment }) => exec(async () => {
                        const stage = modal.replace('advance_', '');
                        const result = await advanceProduction(requestId, { stage, comment });
                        setModal(null);
                        return result;
                    }, `advance_${modal.replace('advance_', '')}`)} />
            )}
        </div>
    );
}
