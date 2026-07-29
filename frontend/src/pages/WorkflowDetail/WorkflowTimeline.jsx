/**
 * WorkflowTimeline.jsx
 * Premium Enterprise Workflow Stepper.
 * Tailwind CSS based with pulsing animations, badges, and history integration.
 */

import React from 'react';
import { Check, X, ClipboardSignature, Search, ShieldCheck, Settings, Rocket, UserCircle } from 'lucide-react';

const STAGES = [
    { id: 1, key: 'SUBMITTED',          label: 'Submitted',       icon: ClipboardSignature },
    { id: 2, key: 'L1_APPROVAL',        label: 'L1 Approval',     icon: Check },
    { id: 3, key: 'PED_ASSIGNMENT',     label: 'PED Assignment',  icon: UserCircle },
    { id: 4, key: 'DESIGN',             label: 'Design',          icon: Settings },
    { id: 5, key: 'CHECKER_REVIEW',     label: 'Checker Review',  icon: Search },
    { id: 6, key: 'FINAL_APPROVAL',     label: 'Final Approval',  icon: ShieldCheck },
    { id: 7, key: 'PRODUCTION',         label: 'Production',      icon: Settings },
    { id: 8, key: 'IMPLEMENTATION',     label: 'Implementation',  icon: Rocket },
];

const STATE_TO_STAGE = {
    SUBMITTED:           1, // Wait for L1 (Stage 1 is completed implicitly, waiting for Stage 2) Wait, if it's 1, then stageStatus makes Stage 1 'active'. 
    L1_APPROVED:         3, L1_REJECTED: 2, // L1 Approved means waiting for PED, so Stage 3 active.
    DESIGN_IN_PROGRESS:  4, DESIGN_REJECTED: 4, REVERTED: 4, // PED assigned means waiting for Design, Stage 4 active.
    DESIGN_SUBMITTED:    5, // Design submitted means waiting for Checker, Stage 5 active.
    DESIGN_APPROVED:     6, // Checker approved means waiting for Final, Stage 6 active.
    FINAL_APPROVED:      7, FINAL_REJECTED: 6, // Final approved means waiting for Production, Stage 7 active.
    IN_PRODUCTION:       8, // Production started means waiting for Implementation, Stage 8 active.
    IMPLEMENTATION:      8, // Same
    COMPLETED:           9, // All done
};

const REJECTED_STATES = ['L1_REJECTED', 'DESIGN_REJECTED', 'FINAL_REJECTED', 'REVERTED'];

function stageStatus(stageId, currentStage, workflowState) {
    if (REJECTED_STATES.includes(workflowState) && stageId === currentStage) return 'rejected';
    if (stageId < currentStage) return 'completed';
    if (stageId === currentStage) return 'active';
    return 'pending';
}

const statusClasses = {
    completed: {
        circle: 'bg-emerald-500 border-emerald-500 text-white',
        icon: 'text-white',
        text: 'text-emerald-700',
        line: 'bg-emerald-500'
    },
    active: {
        circle: 'bg-[#0F4C81] border-[#0F4C81] text-white shadow-[0_0_0_4px_rgba(15,76,129,0.15)] animate-pulse',
        icon: 'text-white',
        text: 'text-[#0F4C81]',
        line: 'bg-slate-200'
    },
    rejected: {
        circle: 'bg-red-50 border-red-500 text-red-600',
        icon: 'text-red-600',
        text: 'text-red-700',
        line: 'bg-slate-200'
    },
    pending: {
        circle: 'bg-white border-slate-200 text-slate-400',
        icon: 'text-slate-400',
        text: 'text-slate-500',
        line: 'bg-slate-200'
    },
};

export default function WorkflowTimeline({ workflowState, currentStage, stageFlags, history = [] }) {
    const resolvedStage = STATE_TO_STAGE[workflowState] || currentStage || 1;

    // Helper to find the latest history entry for a specific stage
    const getStageHistory = (stageId) => {
        // Find the last history item matching this stage's state changes
        let stateMatches = [];
        if (stageId === 1) stateMatches = ['SUBMITTED'];
        if (stageId === 2) stateMatches = ['L1_APPROVED', 'L1_REJECTED'];
        if (stageId === 3) stateMatches = ['DESIGN_IN_PROGRESS'];
        if (stageId === 4) stateMatches = ['DESIGN_SUBMITTED', 'DESIGN_REJECTED', 'REVERTED'];
        if (stageId === 5) stateMatches = ['DESIGN_APPROVED'];
        if (stageId === 6) stateMatches = ['FINAL_APPROVED', 'FINAL_REJECTED'];
        if (stageId === 7) stateMatches = ['IN_PRODUCTION'];
        if (stageId === 8) stateMatches = ['IMPLEMENTATION', 'COMPLETED'];

        return history.slice().reverse().find(h => stateMatches.includes(h.workflowState));
    };

    const getFlagDate = (stageId) => {
        if (!stageFlags) return null;
        const map = {
            1: null,
            2: stageFlags.l1ApprovedAt,
            3: stageFlags.designAssignedAt, // Actually, maybe ped assigned at? we can leave it
            4: null, // design submitted at isn't in flags
            5: stageFlags.designApprovedAt,
            6: stageFlags.finalApprovedAt,
            7: stageFlags.productionStartAt,
            8: stageFlags.implementedAt,
        };
        const date = map[stageId];
        return date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
    };

    return (
        <div className="w-full py-4 overflow-x-auto pb-6">
            <div className="flex items-start min-w-[800px]">
                {STAGES.map((stage, idx) => {
                    const status = stageStatus(stage.id, resolvedStage, workflowState);
                    const classes = statusClasses[status];
                    const isLast = idx === STAGES.length - 1;
                    
                    const hist = getStageHistory(stage.id);
                    const flagDate = hist ? new Date(hist.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : getFlagDate(stage.id);
                    const ownerName = hist?.actor?.name;

                    const Icon = stage.icon;

                    return (
                        <React.Fragment key={stage.id}>
                            {/* Stage Node */}
                            <div className="flex flex-col items-center relative w-32 group cursor-default">
                                
                                {/* Label Top */}
                                <div className={`text-xs font-bold mb-3 text-center h-8 flex items-end justify-center ${classes.text}`}>
                                    {stage.label}
                                </div>

                                {/* Circle */}
                                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 relative z-10 ${classes.circle}`}>
                                    {status === 'completed' ? (
                                        <Check size={20} strokeWidth={3} className={classes.icon} />
                                    ) : status === 'rejected' ? (
                                        <X size={20} strokeWidth={3} className={classes.icon} />
                                    ) : (
                                        <Icon size={20} strokeWidth={2.5} className={classes.icon} />
                                    )}
                                </div>

                                {/* Details Bottom */}
                                <div className="mt-3 text-center flex flex-col items-center min-h-[60px]">
                                    {status === 'active' && (
                                        <div className="bg-[#0F4C81] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-1">
                                            Current Stage
                                        </div>
                                    )}
                                    {status === 'rejected' && (
                                        <div className="bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-1">
                                            Rejected
                                        </div>
                                    )}
                                    {status === 'completed' && (
                                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">
                                            Completed
                                        </div>
                                    )}
                                    {status === 'pending' && (
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            Pending
                                        </div>
                                    )}

                                    {(flagDate || ownerName) && status !== 'pending' && (
                                        <div className="flex flex-col items-center mt-1 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 w-full">
                                            {ownerName && (
                                                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 truncate max-w-full">
                                                    <UserCircle size={10} />
                                                    <span className="truncate">{ownerName}</span>
                                                </div>
                                            )}
                                            {flagDate && (
                                                <div className="text-[10px] text-slate-500 font-medium">
                                                    {flagDate}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Connector Line */}
                            {!isLast && (
                                <div className="flex-1 flex items-center h-12 mt-11 relative z-0 px-2">
                                    <div className={`w-full h-1 rounded-full transition-colors duration-500 ${classes.line}`}></div>
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
