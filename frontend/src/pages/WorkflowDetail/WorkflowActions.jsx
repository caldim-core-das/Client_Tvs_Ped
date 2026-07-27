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

const getApiBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (import.meta.env.VITE_API_BASE_URL) {
        const base = import.meta.env.VITE_API_BASE_URL;
        return base.endsWith('/api') ? base : `${base}/api`;
    }
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return '/Tvs/api';
    }
    return 'http://localhost:5000/api';
};

const BASE_URL = getApiBaseUrl();
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

// ─── Checker SOP Rules (10 fixed rules from TVS SOP spec) ────────────────────
const SOP_RULES = [
    'Is the design file uploaded successfully?',
    'Does the drawing have a valid Drawing Number?',
    'Is the Revision Number mentioned?',
    'Is the drawing clear and readable?',
    'Are all required dimensions provided?',
    'Does the design match the MH Request requirements?',
    'Is the equipment/layout positioned correctly?',
    'Are safety clearances maintained?',
    'Does the design follow the company/TVS standards?',
    'Are all mandatory documents attached?',
];
const SOP_THRESHOLD = 7;

// ─── CheckerSOPPanel ──────────────────────────────────────────────────────────
function CheckerSOPPanel({ requestId, onActionComplete, setModal }) {
    const [answers, setAnswers]         = useState({});   // { ruleIndex: 'yes'|'no' }
    const [showConfirm, setShowConfirm] = useState(false);
    const [showReject, setShowReject]   = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const [rejectError, setRejectError]     = useState('');
    const [loading, setLoading]         = useState(false);
    const [actionError, setActionError] = useState('');

    const answered   = Object.keys(answers).length;
    const score      = Object.values(answers).filter(v => v === 'yes').length;
    const allDone    = answered === SOP_RULES.length;
    const canApprove = allDone && score >= SOP_THRESHOLD;
    const pct        = Math.round((score / SOP_RULES.length) * 100);

    const buildSopAnswers = () =>
        Object.entries(answers).map(([idx, answer]) => ({ ruleIndex: Number(idx), answer }));

    const handleApprove = async () => {
        setLoading(true);
        setActionError('');
        try {
            const result = await checkDesign(requestId, {
                action: 'approve',
                comment: '',
                sopAnswers: buildSopAnswers()
            });
            toast.success(
                `Checker Approved. SOP Score: ${result.sopScore}/${SOP_RULES.length}.` +
                (result.leadTime?.remainingDays !== undefined
                    ? ` ${result.leadTime.remainingDays} day(s) remaining.`
                    : '')
            );
            setShowConfirm(false);
            onActionComplete?.();
        } catch (e) {
            const msg = e?.response?.data?.message || e.message;
            setActionError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectComment.trim() || rejectComment.trim().length < 10) {
            setRejectError('Rejection comment must be at least 10 characters.');
            return;
        }
        setLoading(true);
        setActionError('');
        try {
            await checkDesign(requestId, {
                action: 'reject',
                comment: rejectComment,
                sopAnswers: buildSopAnswers()
            });
            toast.success('Design Returned for Rework. Designer, PED Engineer and L1 Approver notified.');
            setShowReject(false);
            onActionComplete?.();
        } catch (e) {
            const msg = e?.response?.data?.message || e.message;
            setActionError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const toggleAnswer = (idx, val) =>
        setAnswers(prev => {
            const next = { ...prev };
            if (next[idx] === val) {
                delete next[idx]; // Unclick / deselect option
            } else {
                next[idx] = val;
            }
            return next;
        });

    return (
        <div className="flex flex-col gap-5">
            {/* Live Score Bar */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-700">SOP Score</span>
                    <span className={`text-sm font-extrabold ${
                        !allDone ? 'text-slate-400'
                        : canApprove ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                        {score} / {SOP_RULES.length}
                        {allDone && (
                            <span className="ml-2 text-xs font-semibold">
                                {canApprove ? '✓ Meets threshold' : `✗ Needs ${SOP_THRESHOLD - score} more`}
                            </span>
                        )}
                    </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                            canApprove ? 'bg-emerald-500' : score > 0 ? 'bg-amber-400' : 'bg-slate-300'
                        }`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>{answered} / {SOP_RULES.length} rules answered</span>
                    <span>Threshold: {SOP_THRESHOLD} / {SOP_RULES.length}</span>
                </div>
            </div>

            {/* SOP Checklist Table */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-700 px-4 py-2.5 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Checker SOP Checklist</span>
                    <span className="ml-auto text-xs text-slate-300">
                        Yes = 1 pt &nbsp;|&nbsp; No = 0 pts &nbsp;|&nbsp; <span className="text-slate-400 font-normal">Click active option to unclick</span>
                    </span>
                </div>
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide w-8">#</th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Rule</th>
                            <th className="px-4 py-2.5 text-center text-xs font-bold text-emerald-600 uppercase tracking-wide w-16">Yes</th>
                            <th className="px-4 py-2.5 text-center text-xs font-bold text-red-500 uppercase tracking-wide w-16">No</th>
                        </tr>
                    </thead>
                    <tbody>
                        {SOP_RULES.map((rule, idx) => {
                            const ans = answers[idx];
                            const rowBg = ans === 'yes'
                                ? 'bg-emerald-50/60'
                                : ans === 'no'
                                ? 'bg-red-50/60'
                                : '';
                            return (
                                <tr key={idx} className={`border-b border-slate-100 transition-colors ${rowBg}`}>
                                    <td className="px-4 py-3 text-xs font-bold text-slate-400">{idx + 1}</td>
                                    <td className="px-4 py-3 text-slate-700 font-medium leading-snug">{rule}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            type="button"
                                            onClick={() => toggleAnswer(idx, 'yes')}
                                            title={ans === 'yes' ? 'Click to unclick / deselect' : 'Select Yes'}
                                            className={`w-7 h-7 rounded-full border-2 inline-flex items-center justify-center font-bold text-xs transition-all focus:outline-none ${
                                                ans === 'yes'
                                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm hover:bg-emerald-600'
                                                    : 'border-slate-300 text-slate-400 hover:border-emerald-400 hover:text-emerald-500'
                                            }`}
                                        >
                                            ✓
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            type="button"
                                            onClick={() => toggleAnswer(idx, 'no')}
                                            title={ans === 'no' ? 'Click to unclick / deselect' : 'Select No'}
                                            className={`w-7 h-7 rounded-full border-2 inline-flex items-center justify-center font-bold text-xs transition-all focus:outline-none ${
                                                ans === 'no'
                                                    ? 'bg-red-500 border-red-500 text-white shadow-sm hover:bg-red-600'
                                                    : 'border-slate-300 text-slate-400 hover:border-red-400 hover:text-red-500'
                                            }`}
                                        >
                                            ✗
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Error display */}
            {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
                    <AlertTriangle size={16} /> {actionError}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={() => setShowConfirm(true)}
                    disabled={!canApprove || loading}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all duration-200 ${
                        canApprove && !loading
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:-translate-y-0.5'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    <CheckCircle2 size={16} strokeWidth={2.5} />
                    {!allDone
                        ? `Answer all ${SOP_RULES.length - answered} remaining`
                        : !canApprove
                        ? `Need ${SOP_THRESHOLD - score} more Yes`
                        : 'Approve Design'}
                </button>
                <button
                    onClick={() => { setRejectComment(''); setRejectError(''); setShowReject(true); }}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5"
                >
                    <XCircle size={16} strokeWidth={2.5} /> Reject Design
                </button>
            </div>

            {/* Approve Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50">
                            <h3 className="text-lg font-bold text-emerald-800">✅ Confirm SOP Approval</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 mb-4">
                                You are about to approve this design. Please confirm your SOP review results:
                            </p>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 text-center">
                                <div className="text-3xl font-black text-emerald-700">{score} / {SOP_RULES.length}</div>
                                <div className="text-sm text-emerald-600 font-semibold mt-1">SOP Score — Threshold Met ✓</div>
                            </div>
                            <div className="text-xs text-slate-500 mb-5">
                                {score} rule{score !== 1 ? 's' : ''} passed &nbsp;·&nbsp;
                                {SOP_RULES.length - score} rule{SOP_RULES.length - score !== 1 ? 's' : ''} flagged &nbsp;·&nbsp;
                                Threshold: {SOP_THRESHOLD}
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm"
                                >Cancel</button>
                                <button
                                    onClick={handleApprove}
                                    disabled={loading}
                                    className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2"
                                >
                                    {loading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : 'Confirm Approval'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showReject && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-red-50">
                            <h3 className="text-lg font-bold text-red-800">Reject Design &amp; Request Revision</h3>
                        </div>
                        <div className="p-6">
                            {answered > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs text-slate-500">
                                    SOP Score at rejection: <strong>{score} / {SOP_RULES.length}</strong> &nbsp;({answered} rules answered)
                                </div>
                            )}
                            <div className="mb-5">
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Rejection Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={rejectComment}
                                    onChange={e => { setRejectComment(e.target.value); setRejectError(''); }}
                                    rows={4}
                                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-y"
                                    placeholder="Describe the issues found in the design (min 10 characters)..."
                                />
                                {rejectError && <div className="text-red-500 text-xs font-semibold mt-2">{rejectError}</div>}
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowReject(false)}
                                    className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm"
                                >Cancel</button>
                                <button
                                    onClick={handleReject}
                                    disabled={loading}
                                    className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center gap-2"
                                >
                                    {loading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : 'Confirm Rejection'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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
    const [isScanning, setIsScanning] = useState(false);

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
                    <div className="relative w-full">
                        <input
                            type="file"
                            multiple
                            onChange={e => {
                                const files = Array.from(e.target.files);
                                if (files.length > 0) {
                                    setDesignFiles([]);
                                    setIsScanning(true);
                                    setTimeout(() => {
                                        setIsScanning(false);
                                        setDesignFiles(files);
                                    }, 1500);
                                } else {
                                    setDesignFiles([]);
                                }
                            }}
                            className="block w-full text-sm text-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                            accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
                        />
                        
                        {/* Overlay to show custom text next to the "Choose Files" button */}
                        <div className="absolute top-[8px] left-[130px] pointer-events-none text-sm">
                            {isScanning ? (
                                <span className="text-orange-500 font-semibold flex items-center gap-1.5">
                                    <Loader2 size={16} className="animate-spin" /> Scanning for viruses...
                                </span>
                            ) : (
                                designFiles.length > 0 
                                    ? <span className="text-slate-700 truncate block max-w-[250px] sm:max-w-[400px]">{designFiles.map(f => f.name).join(', ')}</span>
                                    : <span className="text-slate-400">No file chosen</span>
                            )}
                        </div>
                    </div>
                    {designFiles.length > 0 && !isScanning && (
                        <div className="text-xs font-semibold text-emerald-600 mt-3 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-300">
                            <CheckCircle2 size={14} /> Scan complete. Files ready for submission.
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

    // Checker: DESIGN_SUBMITTED — SOP Checklist
    if ((role === 'Checker' || role === 'Admin') && workflowState === 'DESIGN_SUBMITTED') {
        actionSummary = "Review the submitted design documents against the SOP checklist below. All 10 rules must be answered. Score ≥ 7 / 10 is required to approve.";
        panels.push(
            <CheckerSOPPanel
                key="checker-sop"
                requestId={requestId}
                onActionComplete={onActionComplete}
                setModal={setModal}
            />
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
                <CommentModal title="Verify &amp; Approve Design" required={false} onClose={() => setModal(null)}
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
