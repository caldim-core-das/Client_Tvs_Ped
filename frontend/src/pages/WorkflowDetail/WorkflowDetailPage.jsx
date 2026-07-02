/**
 * WorkflowDetailPage.jsx
 * Enterprise-grade request detail page:
 * - Executive Workflow Header
 * - Premium Workflow Timeline stepper
 * - Executive KPI Row
 * - 70/30 Main Area & Governance Panel split
 * - Information Card, Activity Timeline, Lead Time Insight, Assignments, SLA Monitoring, Actions
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { ChevronLeft, FileText, CheckCircle2, Clock, Activity, LayoutDashboard, Calendar, Users, AlertCircle, FileBarChart, Clock4, Gauge, UserCircle, Briefcase, CalendarDays, ShieldCheck } from 'lucide-react';

import WorkflowTimeline   from './WorkflowTimeline';
import LeadTimeInsightCard from './LeadTimeInsightCard';
import StageHistory        from './StageHistory';
import WorkflowActions     from './WorkflowActions';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
    const t = sessionStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
};

const STATE_BADGE = {
    SUBMITTED:           { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Submitted' },
    L1_APPROVED:         { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'L1 Approved' },
    L1_REJECTED:         { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'L1 Rejected' },
    DESIGN_IN_PROGRESS:  { color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', label: 'Design In Progress' },
    DESIGN_SUBMITTED:    { color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', label: 'Design Submitted' },
    DESIGN_APPROVED:     { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Design Approved' },
    DESIGN_REJECTED:     { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Design Rejected' },
    FINAL_APPROVED:      { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Final Approved' },
    FINAL_REJECTED:      { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Final Rejected' },
    IN_PRODUCTION:       { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'In Production' },
    IMPLEMENTATION:      { color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', label: 'Implementation' },
    COMPLETED:           { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Completed' },
};

function InfoField({ label, value }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
            <span className="text-[15px] font-medium text-slate-800">{value || '—'}</span>
        </div>
    );
}

export default function WorkflowDetailPage() {
    const { id } = useParams();
    const navigate  = useNavigate();
    const user      = useSelector(s => s.auth?.user);

    const [request,   setRequest]   = useState(null);
    const [workflow,  setWorkflow]  = useState(null);
    const [employees, setEmployees] = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [reqRes, wfRes] = await Promise.all([
                axios.get(`${BASE_URL}/asset-request/${id}`,        { headers: getAuthHeader() }),
                axios.get(`${BASE_URL}/workflow/${id}/state`,        { headers: getAuthHeader() })
            ]);
            setRequest(reqRes.data);
            setWorkflow(wfRes.data);

            const empRes = await axios.get(`${BASE_URL}/employees`, { headers: getAuthHeader() });
            setEmployees(empRes.data?.data || []);
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to load request details');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px] text-slate-400">
            <div className="text-center animate-pulse">
                <LayoutDashboard size={40} className="mx-auto mb-4 text-[#0F4C81] opacity-50" />
                <div className="text-sm font-medium">Loading Enterprise Workspace...</div>
            </div>
        </div>
    );

    if (error) return (
        <div className="max-w-2xl mx-auto mt-12 p-6 bg-red-50 rounded-[18px] border border-red-200 text-center">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={32} />
            <h3 className="text-lg font-bold text-red-800 mb-2">Workspace Error</h3>
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">
                Return to Dashboard
            </button>
        </div>
    );

    if (!request) return null;

    const badge = STATE_BADGE[workflow?.workflowState] || { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', label: workflow?.workflowState || 'Legacy' };
    const leadTime = workflow ? {
        estimatedDays: workflow.leadTime?.estimatedDays,
        confidence:    workflow.leadTime?.confidence,
        source:        workflow.leadTime?.source,
        factors:       workflow.leadTime?.factors || [],
        recommendation: null,
        generatedAt:   workflow.leadTime?.generatedAt
    } : null;

    const requestDate = new Date(request.createdAt || Date.now());
    const leadTimeDays = workflow.leadTime?.estimatedDays || 0;
    const estimatedCompletion = new Date(requestDate.getTime() + (leadTimeDays * 24 * 60 * 60 * 1000));
    
    // Calculate SLA
    const daysSinceStart = Math.floor((new Date() - requestDate) / (1000 * 60 * 60 * 24));
    const isSlaBreached = leadTimeDays > 0 && daysSinceStart > leadTimeDays;

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-inter text-slate-800 pb-16">
            
            {/* Section 1: Executive Workflow Header */}
            <div className="bg-white border-b border-gray-200 py-6 px-4 shadow-sm relative z-10 sticky top-0">
                <div className="w-full px-4 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="mt-1 p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{request.mhRequestId}</h1>
                                <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${badge.bg} ${badge.color} ${badge.border}`}>
                                    {badge.label}
                                </span>
                            </div>
                            <h2 className="text-[15px] font-semibold text-slate-600">Material Handling Request Workflow</h2>
                            <div className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-2">
                                <Briefcase size={14} /> {request.departmentName}
                                <span className="text-slate-300">•</span>
                                <LayoutDashboard size={14} /> {request.plantLocation}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 bg-slate-50 border border-slate-100 rounded-xl p-3 pr-6 shadow-inner">
                        <div className="flex items-center gap-3 border-r border-slate-200 pr-6">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <ShieldCheck size={20} strokeWidth={2.5} />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Workflow Health</div>
                                <div className="text-sm font-bold text-emerald-700">On Track</div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Calendar size={12}/> Target Date</span>
                            <span className="text-sm font-bold text-slate-700">{estimatedCompletion.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="w-full px-4 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                
                    {/* Section 2: Premium Workflow Timeline */}
                    <div className="lg:col-span-12 mt-8 bg-white rounded-[18px] shadow-[0_8px_32px_rgba(15,23,42,0.04)] border border-slate-100 p-6 lg:p-8 mb-6 hover:-translate-y-[2px] transition-transform duration-300">
                        <WorkflowTimeline
                            workflowState={workflow?.workflowState}
                            currentStage={workflow?.currentStage}
                            stageFlags={workflow?.stageFlags}
                            history={workflow?.stageHistory}
                        />
                    </div>

                    {/* Section 3: Executive KPI Row */}
                    <div className="lg:col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
                        {[
                            { label: 'Lead Time', value: leadTimeDays ? `${leadTimeDays} Days` : 'TBD', icon: Clock4, color: 'text-blue-500', bg: 'bg-blue-50' },
                            { label: 'Confidence', value: leadTime?.confidence ? `${leadTime.confidence}%` : '—', icon: Gauge, color: 'text-purple-500', bg: 'bg-purple-50' },
                            { label: 'Workflow Progress', value: `${Math.round((workflow?.currentStage / 6) * 100)}%`, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                            { label: 'Status', value: isSlaBreached ? 'Breached' : 'On Track', icon: ShieldCheck, color: isSlaBreached ? 'text-red-500' : 'text-emerald-500', bg: isSlaBreached ? 'bg-red-50' : 'bg-emerald-50' }
                        ].map((kpi, i) => (
                            <div key={i} className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.04)] border border-slate-100 p-5 hover:-translate-y-[2px] transition-transform duration-300">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</div>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.bg} ${kpi.color}`}>
                                        <kpi.icon size={16} strokeWidth={2.5} />
                                    </div>
                                </div>
                                <div className="text-2xl font-black text-slate-800">{kpi.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Section 4: Information Layout (70/30 Split) */}
                    <div className="lg:col-span-12 grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
                        
                        {/* Main Area (70%) */}
                        <div className="xl:col-span-8 space-y-6 lg:space-y-8">
                        
                        {/* Request Overview Card */}
                        <section className="bg-white rounded-[18px] shadow-[0_8px_32px_rgba(15,23,42,0.04)] border border-slate-100 overflow-hidden hover:-translate-y-[2px] transition-transform duration-300">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                                <FileText className="text-[#0F4C81]" size={18} />
                                <h2 className="text-[15px] font-bold text-slate-800 uppercase tracking-wider">Request Information</h2>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-6 mb-8">
                                    <InfoField label="Submitted By" value={request.userName} />
                                    <InfoField label="Request Type" value={request.requestType} />
                                    <InfoField label="Department" value={request.departmentName} />
                                    <InfoField label="Plant Location" value={request.plantLocation} />
                                    <InfoField label="Product Model" value={request.productModel} />
                                    <InfoField label="Handling Part" value={request.handlingPartName} />
                                </div>

                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 mb-8">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Briefcase size={14}/> Operational Details</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <InfoField label="Equipment" value={request.materialHandlingEquipment} />
                                        <InfoField label="Flow" value={`${request.from} → ${request.to}`} />
                                        <InfoField label="Volume / Day" value={request.volumePerDay} />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><AlertCircle size={14}/> Business Requirement</h3>
                                    <div className="bg-[#F8FAFC] border-l-4 border-[#0F4C81] p-4 rounded-r-lg text-[15px] text-slate-700 leading-relaxed font-medium">
                                        {request.problemStatement || 'No problem statement provided.'}
                                    </div>
                                </div>

                                {request.remark && (
                                    <div className="mt-6 pt-6 border-t border-slate-100">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Additional Remarks</h3>
                                        <p className="text-sm text-slate-600">{request.remark}</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Design Documents */}
                        {workflow?.designDocuments?.length > 0 && (
                            <section className="bg-white rounded-[18px] shadow-[0_8px_32px_rgba(15,23,42,0.04)] border border-slate-100 overflow-hidden hover:-translate-y-[2px] transition-transform duration-300">
                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <FileBarChart className="text-[#0F4C81]" size={18} />
                                        <h2 className="text-[15px] font-bold text-slate-800 uppercase tracking-wider">Design Assets</h2>
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{workflow.designDocuments.length}</span>
                                </div>
                                <div className="p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {workflow.designDocuments.map((doc, i) => (
                                            <a key={i}
                                                href={`${BASE_URL.replace('/api', '')}${doc.fileUrl}`}
                                                target="_blank" rel="noreferrer"
                                                className="group flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 hover:border-[#0F4C81]/30 hover:bg-[#0F4C81]/5 rounded-xl transition-all text-left">
                                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold text-slate-800 truncate group-hover:text-[#0F4C81] transition-colors">{doc.fileName}</div>
                                                    <div className="text-xs font-medium text-slate-500 mt-1">v{doc.version} · {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Activity Timeline */}
                        <section className="bg-white rounded-[18px] shadow-[0_8px_32px_rgba(15,23,42,0.04)] border border-slate-100 overflow-hidden hover:-translate-y-[2px] transition-transform duration-300">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                                <Clock className="text-[#0F4C81]" size={18} />
                                <h2 className="text-[15px] font-bold text-slate-800 uppercase tracking-wider">Activity Feed</h2>
                            </div>
                            <div className="p-6">
                                <StageHistory stageHistory={workflow?.stageHistory || []} />
                            </div>
                        </section>
                    </div>

                    {/* Governance Side Panel (30%) */}
                    <div className="xl:col-span-4 space-y-6">
                        
                        {/* Actions Center */}
                        <WorkflowActions
                            requestId={id}
                            workflowState={workflow?.workflowState}
                            employees={employees}
                            onActionComplete={load}
                        />

                        {/* AI Lead Time Intelligence */}
                        <LeadTimeInsightCard leadTime={leadTime} />

                        {/* SLA Monitoring */}
                        <section className="bg-white rounded-[18px] shadow-[0_8px_32px_rgba(15,23,42,0.04)] border border-slate-100 overflow-hidden hover:-translate-y-[2px] transition-transform duration-300">
                            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                                <Activity className="text-[#0F4C81]" size={16} />
                                <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wider">SLA Monitoring</h2>
                            </div>
                            <div className="p-5">
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Workflow Age</div>
                                        <div className="text-2xl font-black text-slate-800">{daysSinceStart} <span className="text-sm font-medium text-slate-500">Days</span></div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target SLA</div>
                                        <div className="text-lg font-bold text-slate-700">{leadTimeDays || '--'} Days</div>
                                    </div>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${isSlaBreached ? 'bg-red-500' : 'bg-[#16A34A]'} rounded-full`} style={{ width: `${Math.min((daysSinceStart / Math.max(leadTimeDays, 1)) * 100, 100)}%` }}></div>
                                </div>
                                <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
                                    {isSlaBreached ? (
                                        <span className="text-red-600 flex items-center gap-1"><AlertCircle size={12}/> SLA Breached by {daysSinceStart - leadTimeDays} days</span>
                                    ) : (
                                        <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12}/> Within SLA ({leadTimeDays - daysSinceStart} days remaining)</span>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Assignments Governance */}
                        {workflow?.assignments && (
                            <section className="bg-white rounded-[18px] shadow-[0_8px_32px_rgba(15,23,42,0.04)] border border-slate-100 overflow-hidden hover:-translate-y-[2px] transition-transform duration-300">
                                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                                    <Users className="text-[#0F4C81]" size={16} />
                                    <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wider">Assignment Governance</h2>
                                </div>
                                <div className="p-5 space-y-4">
                                    {['designer', 'checker', 'finalApprover'].map(role => {
                                        if (!workflow.assignments[role]) return null;
                                        const emp = workflow.assignments[role];
                                        return (
                                            <div key={role} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="w-8 h-8 rounded-full bg-[#0F4C81]/10 flex items-center justify-center text-[#0F4C81] shrink-0 mt-0.5">
                                                    <UserCircle size={18} />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{role.replace(/([A-Z])/g, ' $1').trim()}</div>
                                                    <div className="text-sm font-bold text-slate-800">{emp.employeeName}</div>
                                                    <div className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">{emp.mailId}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {!workflow.assignments.designer && !workflow.assignments.checker && !workflow.assignments.finalApprover && (
                                        <div className="text-center py-6">
                                            <Users className="mx-auto text-slate-300 mb-2" size={24} />
                                            <div className="text-sm font-medium text-slate-500">Assignments pending workflow progression.</div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </div>
        </div>
    );
}

