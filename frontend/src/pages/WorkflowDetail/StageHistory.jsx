/**
 * StageHistory.jsx
 * Immutable audit trail timeline for all workflow state transitions.
 * Enterprise Vertical Timeline with Lucide icons and rich activity descriptions.
 */

import React from 'react';
import { 
    ClipboardSignature, CheckCircle2, XCircle, Search, 
    Palette, PenTool, ShieldCheck, ShieldAlert, 
    Settings, Rocket, PartyPopper, RefreshCw, AlertCircle, UserCircle,
    MessageSquare, RotateCcw, Wrench
} from 'lucide-react';



const ACTION_MAP = {
    SUBMITTED:              { icon: ClipboardSignature, color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    label: 'Request Submitted' },
    APPROVED:               { icon: CheckCircle2,       color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'L1 Approved' },
    REJECTED:               { icon: XCircle,            color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     label: 'L1 Rejected' },
    CHECKER_APPROVED:       { icon: Search,             color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Design Verified & Approved' },
    CHECKER_REJECTED:       { icon: XCircle,            color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     label: 'Design Rejected by Checker' },
    DESIGNER_ASSIGNED:      { icon: Palette,            color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200',  label: 'Designer Assigned' },
    PED_ENGINEER_ASSIGNED:  { icon: Wrench,             color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  label: 'PED Engineer Assigned' },
    DESIGN_SUBMITTED:       { icon: PenTool,            color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-200',    label: 'Design Documents Submitted' },
    FINAL_APPROVED:         { icon: ShieldCheck,        color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Final Approval Granted' },
    FINAL_REJECTED:         { icon: ShieldAlert,        color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     label: 'Final Approval Rejected' },
    IN_PRODUCTION:          { icon: Settings,           color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: 'Moved to Production' },
    IMPLEMENTATION:         { icon: Rocket,             color: 'text-[#0F4C81]',   bg: 'bg-[#0F4C81]/10', border: 'border-[#0F4C81]/20', label: 'Implementation Started' },
    COMPLETED:              { icon: PartyPopper,        color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Workflow Completed' },
    MIGRATED_FROM_LEGACY:   { icon: RefreshCw,          color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200',   label: 'Migrated from Legacy' },
    REVISION_REQUIRED:      { icon: AlertCircle,        color: 'text-orange-500',  bg: 'bg-orange-50',  border: 'border-orange-200',  label: 'Revision Required' },
    REVERTED:               { icon: RotateCcw,          color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-200',     label: 'Request Reverted by Designer' },
    STAGE_IN_PRODUCTION:    { icon: Settings,           color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: 'Production Stage Started' },
    STAGE_IMPLEMENTATION:   { icon: Rocket,             color: 'text-[#0F4C81]',   bg: 'bg-[#0F4C81]/10', border: 'border-[#0F4C81]/20', label: 'Implementation Stage' },
    STAGE_COMPLETED:        { icon: PartyPopper,        color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Stage Completed' },
};

/**
 * Returns a rich human-readable summary for each activity entry.
 */
function getActivitySummary(entry) {
    const actor = entry.actorName || 'System';
    const role  = entry.actorRole  || '';

    switch (entry.action) {
        case 'SUBMITTED': {
            // Show the real submitter name; comment now contains department/plant info
            const requestedFor = entry.metadata?.requestedFor;
            if (requestedFor && requestedFor !== actor) {
                return `MH Request was submitted by ${actor} (${role || 'Requester'}) on behalf of ${requestedFor}. Awaiting L1 approval.`;
            }
            return `MH Request was submitted by ${actor} (${role || 'Requester'}) and is now awaiting L1 approval.`;
        }

        case 'APPROVED':
            return `Request was approved by ${actor} (${role || 'L1 Approver'}). Design work can now begin.`;

        case 'REJECTED':
            return `Request was rejected by ${actor} (${role || 'L1 Approver'}). The requester has been notified.`;

        case 'PED_ENGINEER_ASSIGNED': {
            const source = entry.metadata?.source === 'email_link' ? ' via approval email link' : '';
            const engName = entry.metadata?.engineerName || actor;
            return `PED Engineer ${engName} was assigned to this request${source} by ${actor} (${role || 'L1 Approver'}).`;
        }

        case 'DESIGNER_ASSIGNED': {
            if (entry.comment && entry.comment.includes('Designer:')) {
                return `${actor} assigned team members for this request — ${entry.comment}.`;
            }
            return `${actor} assigned a Designer for this request. Design work is now in progress.`;
        }

        case 'DESIGN_SUBMITTED':
            return `${actor} (Designer) submitted design documents for checker review. ${
                entry.metadata?.filesSubmitted ? `${entry.metadata.filesSubmitted} file(s) uploaded.` : ''
            }`;

        case 'CHECKER_APPROVED':
            return `Design was verified and approved by ${actor} (${role || 'Checker'}). Request moved to Final Approval.`;

        case 'CHECKER_REJECTED':
            return `Design was rejected by ${actor} (${role || 'Checker'}). Returned to Designer for revision.`;

        case 'REVISION_REQUIRED':
            return `${actor} requested design revision. Designer must address the feedback and re-submit.`;

        case 'FINAL_APPROVED':
            return `Final approval was granted by ${actor} (${role || 'Final Approver'}). Production can now begin.`;

        case 'FINAL_REJECTED':
            return `Final approval was rejected by ${actor} (${role || 'Final Approver'}). Returned for review.`;

        case 'REVERTED':
            return `${actor} (Designer) reverted this request back to the requester for corrections.`;

        case 'IN_PRODUCTION':
        case 'STAGE_IN_PRODUCTION':
            return `${actor} advanced the request to Production stage.`;

        case 'IMPLEMENTATION':
        case 'STAGE_IMPLEMENTATION':
            return `${actor} marked the request as entered Implementation phase.`;

        case 'COMPLETED':
        case 'STAGE_COMPLETED':
            return `${actor} marked this workflow as Completed. All stages have been successfully executed.`;

        case 'MIGRATED_FROM_LEGACY':
            return 'This request was migrated to the Enterprise Workflow system from the legacy system.';

        default:
            return entry.comment || `${entry.action?.replace(/_/g, ' ')} — performed by ${actor}.`;
    }
}

export default function StageHistory({ stageHistory = [] }) {
    if (!stageHistory.length) {
        return (
            <div className="py-12 text-center text-slate-400">
                <RefreshCw size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No workflow activity recorded yet.</p>
            </div>
        );
    }

    const sorted = [...stageHistory].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    return (
        <div className="relative pl-6 py-2">
            {/* Vertical line */}
            <div className="absolute left-[38px] top-6 bottom-6 w-0.5 bg-slate-100 rounded-full z-0" />

            <div className="space-y-6">
                {sorted.map((entry, idx) => {
                    const style = ACTION_MAP[entry.action] || ACTION_MAP.MIGRATED_FROM_LEGACY;
                    const Icon  = style.icon;
                    const isLatest = idx === 0;
                    const summary = getActivitySummary(entry);

                    return (
                        <div key={idx} className="relative z-10 flex gap-5 group">
                            
                            {/* Timeline Node */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 transition-transform group-hover:scale-110 ${style.bg} ${style.border} ${style.color} ${isLatest ? 'ring-4 ring-offset-1 ring-current/20' : ''}`}>
                                <Icon size={18} strokeWidth={2.5} />
                            </div>

                            {/* Content Box */}
                            <div className={`flex-1 bg-white border rounded-2xl p-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)] group-hover:border-slate-200 group-hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all ${isLatest ? 'border-slate-200 shadow-[0_4px_16px_rgba(15,23,42,0.06)]' : 'border-slate-100'}`}>
                                
                                {/* Header row: action label + "Latest" badge + timestamp */}
                                <div className="flex justify-between items-start mb-2 gap-4 flex-wrap">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-slate-800">
                                            {style.label}
                                        </span>
                                        {isLatest && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                                Latest
                                            </span>
                                        )}
                                        {entry.stage && (
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${style.bg} ${style.border} ${style.color}`}>
                                                {entry.stage?.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                                        {new Date(entry.timestamp).toLocaleString('en-GB', { 
                                            day: 'numeric', month: 'short', year: 'numeric', 
                                            hour: '2-digit', minute: '2-digit' 
                                        })}
                                    </span>
                                </div>

                                {/* Actor row */}
                                {entry.actorName && (
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
                                        <UserCircle size={14} className="text-slate-400" />
                                        <span>{entry.actorName}</span>
                                        {entry.actorRole && <span className="text-slate-400 font-medium ml-1">({entry.actorRole})</span>}
                                    </div>
                                )}

                                {/* Human-readable activity summary */}
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed mb-2">
                                    {summary}
                                </p>

                                {/* Designer/Checker comment (italic quote style) */}
                                {entry.comment && (
                                    <div className="mt-3 relative">
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${style.bg.replace('bg-', 'bg-').replace('50', '400')}`} />
                                        <div className="bg-slate-50 text-[13px] text-slate-600 font-medium italic p-3 pl-4 rounded-r-md rounded-l-sm flex items-start gap-2">
                                            <MessageSquare size={13} className="text-slate-400 shrink-0 mt-0.5" />
                                            <span>"{entry.comment}"</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
