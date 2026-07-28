/**
 * WorkflowActions.jsx
 * Governance action panel for whatever HUMAN_TASK node the request is
 * currently sitting at. Everything here — which decisions are offered, who's
 * allowed to act, whether a comment/extra fields are required, whether this
 * is a file-upload step or a SOP-scored checker step — comes from
 * `currentNode.config` (the live Workflow Studio graph), not from hardcoded
 * role/state checks. Rewiring the graph changes what renders here with no
 * code change.
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { submitWorkflowAction } from '../../api/workflowApi';
import { CheckCircle2, XCircle, Send, PlayCircle, Loader2, Info, AlertTriangle } from 'lucide-react';

const leadTimeSuffix = (lt) => {
    if (!lt || lt.consumedDays === undefined || lt.consumedDays === null) return '';
    return ` — ${lt.consumedDays} of ${lt.estimatedDays} days consumed, ${Math.max(lt.remainingDays, 0)} remaining.`;
};

const DECISION_STYLE = {
    Approved: { base: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20', icon: CheckCircle2 },
    Approve:  { base: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20', icon: CheckCircle2 },
    Rejected: { base: 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20', icon: XCircle },
    Reject:   { base: 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20', icon: XCircle },
    'Reject Task': { base: 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20', icon: XCircle },
    Submit:   { base: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20', icon: Send },
    Assigned: { base: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20', icon: Send },
};
const DEFAULT_STYLE = { base: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20', icon: PlayCircle };

function ActionButton({ decision, onClick }) {
    const style = DECISION_STYLE[decision] || DEFAULT_STYLE;
    const Icon = style.icon;
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${style.base}`}
        >
            <Icon size={16} strokeWidth={2.5} />
            {decision}
        </button>
    );
}

function filterEmployeesByLabel(employees, label) {
    const re = new RegExp(`^\\s*${label}\\s*$`, 'i');
    const matches = employees.filter(e => re.test(e.role || ''));
    return matches.length > 0 ? matches : employees;
}

function CommentModal({ title, commentRequired, minCommentLength = 1, fields = [], fieldValues, setFieldValues, onConfirm, onClose }) {
    const [comment, setComment] = useState('');
    const [error, setError] = useState('');

    const handle = () => {
        if (commentRequired && comment.trim().length < minCommentLength) {
            setError(`Comment must be at least ${minCommentLength} characters`);
            return;
        }
        for (const f of fields) {
            if (!fieldValues[f.key]) {
                setError(`'${f.label}' is required`);
                return;
            }
            if (f.mustDifferFrom && fieldValues[f.key] === fieldValues[f.mustDifferFrom]) {
                setError(`'${f.label}' must be different from the other selection`);
                return;
            }
        }
        onConfirm(comment);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                </div>

                <div className="p-6">
                    {fields.length > 0 && (
                        <div className="flex flex-col gap-4 mb-6">
                            {fields.map(f => (
                                <div key={f.key}>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        {f.label} <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={fieldValues[f.key] || ''}
                                        onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50"
                                    >
                                        <option value="">Select {f.label}</option>
                                        {f.options}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Comment {commentRequired && <span className="text-red-500">*</span>}
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
function CheckerSOPPanel({ requestId, onActionComplete }) {
    const [answers, setAnswers] = useState({});   // { ruleIndex: 'yes'|'no' }
    const [showConfirm, setShowConfirm] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const [rejectError, setRejectError] = useState('');
    const [loading, setLoading] = useState(false);
    const [actionError, setActionError] = useState('');

    const answered = Object.keys(answers).length;
    const score = Object.values(answers).filter(v => v === 'yes').length;
    const allDone = answered === SOP_RULES.length;
    const canApprove = score >= SOP_THRESHOLD;
    const pct = Math.round((score / SOP_RULES.length) * 100);

    const buildSopAnswers = () =>
        Object.entries(answers).map(([idx, answer]) => ({ ruleIndex: Number(idx), answer }));

    const handleApprove = async () => {
        setLoading(true);
        setActionError('');
        try {
            const result = await submitWorkflowAction(requestId, {
                decision: 'Approve', comment: '', payload: { sopAnswers: buildSopAnswers() }
            });
            toast.success(
                `Checker Approved. SOP Score: ${result.actionResult?.score ?? score}/${SOP_RULES.length}.` +
                (result.leadTime?.remainingDays !== undefined ? ` ${result.leadTime.remainingDays} day(s) remaining.` : '')
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
            await submitWorkflowAction(requestId, {
                decision: 'Reject', comment: rejectComment, payload: { sopAnswers: buildSopAnswers() }
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
            if (next[idx] === val) delete next[idx];
            else next[idx] = val;
            return next;
        });

    return (
        <div className="flex flex-col gap-5">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-700">SOP Score</span>
                    <span className={`text-sm font-extrabold ${canApprove ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {score} / {SOP_RULES.length}
                        {canApprove ? (
                            <span className="ml-2 text-xs font-semibold text-emerald-600">✓ Meets threshold</span>
                        ) : (
                            <span className="ml-2 text-xs font-semibold text-slate-400">✗ Needs {SOP_THRESHOLD - score} more</span>
                        )}
                    </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${canApprove ? 'bg-emerald-500' : score > 0 ? 'bg-amber-400' : 'bg-slate-300'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>{answered} / {SOP_RULES.length} rules answered</span>
                    <span>Threshold: {SOP_THRESHOLD} / {SOP_RULES.length}</span>
                </div>
            </div>

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
                            const rowBg = ans === 'yes' ? 'bg-emerald-50/60' : ans === 'no' ? 'bg-red-50/60' : '';
                            return (
                                <tr key={idx} className={`border-b border-slate-100 transition-colors ${rowBg}`}>
                                    <td className="px-4 py-3 text-xs font-bold text-slate-400">{idx + 1}</td>
                                    <td className="px-4 py-3 text-slate-700 font-medium leading-snug">{rule}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button type="button" onClick={() => toggleAnswer(idx, 'yes')}
                                            title={ans === 'yes' ? 'Click to unclick / deselect' : 'Select Yes'}
                                            className={`w-7 h-7 rounded-full border-2 inline-flex items-center justify-center font-bold text-xs transition-all focus:outline-none ${ans === 'yes' ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm hover:bg-emerald-600' : 'border-slate-300 text-slate-400 hover:border-emerald-400 hover:text-emerald-500'}`}>
                                            ✓
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button type="button" onClick={() => toggleAnswer(idx, 'no')}
                                            title={ans === 'no' ? 'Click to unclick / deselect' : 'Select No'}
                                            className={`w-7 h-7 rounded-full border-2 inline-flex items-center justify-center font-bold text-xs transition-all focus:outline-none ${ans === 'no' ? 'bg-red-500 border-red-500 text-white shadow-sm hover:bg-red-600' : 'border-slate-300 text-slate-400 hover:border-red-400 hover:text-red-500'}`}>
                                            ✗
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
                    <AlertTriangle size={16} /> {actionError}
                </div>
            )}

            <div className="flex gap-3">
                <button
                    onClick={() => setShowConfirm(true)}
                    disabled={!canApprove || loading}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all duration-200 ${canApprove && !loading ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:-translate-y-0.5' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                    <CheckCircle2 size={16} strokeWidth={2.5} />
                    {!canApprove ? `Need ${SOP_THRESHOLD - score} more Yes` : 'Approve Design'}
                </button>
                <button
                    onClick={() => { setRejectComment(''); setRejectError(''); setShowReject(true); }}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5"
                >
                    <XCircle size={16} strokeWidth={2.5} /> Reject Design
                </button>
            </div>

            {showConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50">
                            <h3 className="text-lg font-bold text-emerald-800">✅ Confirm SOP Approval</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 mb-4">You are about to approve this design. Please confirm your SOP review results:</p>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 text-center">
                                <div className="text-3xl font-black text-emerald-700">{score} / {SOP_RULES.length}</div>
                                <div className="text-sm text-emerald-600 font-semibold mt-1">SOP Score — Threshold Met ✓</div>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setShowConfirm(false)} className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm">Cancel</button>
                                <button onClick={handleApprove} disabled={loading} className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2">
                                    {loading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : 'Confirm Approval'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                <label className="block text-sm font-bold text-slate-700 mb-2">Rejection Reason <span className="text-red-500">*</span></label>
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
                                <button onClick={() => setShowReject(false)} className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm">Cancel</button>
                                <button onClick={handleReject} disabled={loading} className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center gap-2">
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

export default function WorkflowActions({ requestId, currentNode, employees = [], onActionComplete }) {
    const { user } = useAuth();
    const role = user?.role || user?.permissions?.role;

    const [modal, setModal] = useState(null); // decision string, or null
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldValues, setFieldValues] = useState({});
    const [designFiles, setDesignFiles] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    const cfg = currentNode?.config || {};
    const isAllowed = role === 'Admin' || (cfg.allowedRoles || []).some(r => r.toLowerCase() === (role || '').toLowerCase());

    if (!currentNode || currentNode.type !== 'HUMAN_TASK' || !role || !isAllowed) return null;

    const decisions = cfg.decisions || [];
    const requiresUpload = cfg.requiresAction === 'SECURE_FILE_UPLOAD';
    const usesSopPanel = cfg.preActionKey === 'SOP_SCORING';

    const requiredFieldsFor = (decision) =>
        (cfg.requiredPayloadFields || []).filter(f => !f.onlyForDecision || f.onlyForDecision === decision);

    const runAction = async (decision, comment, files = []) => {
        setLoading(true);
        setError('');
        try {
            const extraPayload = {};
            for (const f of requiredFieldsFor(decision)) extraPayload[f.key] = fieldValues[f.key];
            const result = await submitWorkflowAction(requestId, { decision, comment, payload: extraPayload, files });
            toast.success(`${currentNode.label} — '${decision}' recorded.${leadTimeSuffix(result.leadTime)}`);
            setModal(null);
            setFieldValues({});
            onActionComplete?.();
        } catch (e) {
            const message = e?.response?.data?.message || e.message;
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    if (usesSopPanel) {
        return (
            <div className="bg-white rounded-[18px] shadow-[0_8px_32px_rgba(15,23,42,0.04)] border border-slate-100 overflow-hidden mt-6">
                <div className="px-5 py-4 border-b border-slate-100 bg-[#0F4C81]/5 flex items-center gap-3">
                    <Info size={18} className="text-[#0F4C81]" />
                    <h2 className="text-[13px] font-bold text-[#0F4C81] uppercase tracking-wider">{currentNode.label}</h2>
                </div>
                <div className="p-6">
                    <CheckerSOPPanel requestId={requestId} onActionComplete={onActionComplete} />
                </div>
            </div>
        );
    }

    const modalDecision = modal;
    const modalFields = modalDecision ? requiredFieldsFor(modalDecision).map(f => ({
        ...f,
        options: filterEmployeesByLabel(employees, f.label).map(e => (
            <option key={e._id} value={e._id}>{e.employeeName} ({e.employeeId} · {e.departmentName || e.role})</option>
        ))
    })) : [];

    return (
        <div className="bg-white rounded-[18px] shadow-[0_8px_32px_rgba(15,23,42,0.04)] border border-slate-100 overflow-hidden mt-6">
            <div className="px-5 py-4 border-b border-slate-100 bg-[#0F4C81]/5 flex items-center gap-3">
                <Info size={18} className="text-[#0F4C81]" />
                <h2 className="text-[13px] font-bold text-[#0F4C81] uppercase tracking-wider">{currentNode.label}</h2>
            </div>

            <div className="p-6">
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
                    <div className="flex flex-col gap-4">
                        {requiresUpload && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <label className="block text-sm font-bold text-slate-700 mb-3">Upload Design Documents</label>
                                <div className="relative w-full">
                                    <input
                                        type="file"
                                        multiple
                                        onChange={e => {
                                            const files = Array.from(e.target.files);
                                            if (files.length > 0) {
                                                setDesignFiles([]);
                                                setIsScanning(true);
                                                setTimeout(() => { setIsScanning(false); setDesignFiles(files); }, 1500);
                                            } else {
                                                setDesignFiles([]);
                                            }
                                        }}
                                        className="block w-full text-sm text-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                        accept=".pdf,.dwg,.dxf,.stp,.step,.igs,.iges,.png,.jpg,.jpeg"
                                    />
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
                                    <div className="text-xs font-semibold text-emerald-600 mt-3 flex items-center gap-1.5">
                                        <CheckCircle2 size={14} /> Scan complete. Files ready for submission.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 flex-wrap">
                            {decisions.map(decision => (
                                <ActionButton key={decision} decision={decision} onClick={() => setModal(decision)} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {modal && (
                <CommentModal
                    title={`${currentNode.label} — ${modal}`}
                    commentRequired={(cfg.commentRequiredFor || []).includes(modal)}
                    minCommentLength={cfg.minCommentLength || 1}
                    fields={modalFields}
                    fieldValues={fieldValues}
                    setFieldValues={setFieldValues}
                    onClose={() => { setModal(null); setFieldValues({}); }}
                    onConfirm={(comment) => runAction(modal, comment, requiresUpload ? designFiles : [])}
                />
            )}
        </div>
    );
}
