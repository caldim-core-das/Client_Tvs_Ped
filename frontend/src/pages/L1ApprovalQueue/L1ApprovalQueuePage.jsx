/**
 * L1ApprovalQueuePage.jsx
 * Enterprise UI Enhancement - L1 Approval Center
 * Work queue for L1 Approvers — shows all SUBMITTED requests awaiting approval.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getWorkflowQueue } from '../../api/workflowApi';
import { useAuth } from '../../context/AuthContext';
import LeadTimeChip from '../../components/LeadTimeChip';
import {
    LayoutDashboard, RefreshCw, CheckCircle2, XCircle, Clock, Activity,
    ChevronRight, ArrowRight, ShieldCheck, MailWarning, Bell, Search, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const REQUEST_TYPE_COLORS = {
    'New Project':          { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    'Modification':         { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'Replacement':          { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    'Upgrade':              { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    'Refresh':              { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    'Capacity':             { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    'Special Improvements': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
};

export default function L1ApprovalQueuePage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastSync, setLastSync] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);

    const load = async () => {
        setIsRefreshing(true);
        if (items.length === 0) setLoading(true);
        try {
            const r = await getWorkflowQueue('l1');
            setItems(r.data.data || []);
            setLastSync(new Date());
        } catch (err) {
            console.error('Failed to fetch L1 Queue:', err);
            toast.error('Failed to load L1 approval queue');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => { load(); }, []);

    const formattedLastSync = useMemo(() => {
        return lastSync.toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    }, [lastSync]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-inter text-slate-800 pb-12">
            
            

            <main className="w-full mx-auto px-4 lg:px-8 pt-6 lg:pt-8">
                
                {/* ZONE 1: Executive Header */}
                <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-extrabold text-[#0F4C81] tracking-tight">L1 Approval Center</h1>
                        <p className="text-slate-500 text-sm mt-1 font-medium">Material Handling Workflow Governance</p>
                    </div>
                    <div className="flex items-center gap-6 bg-white px-5 py-2.5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">System Online</span>
                        </div>
                        <div className="w-px h-8 bg-slate-200"></div>
                        <div className="text-right">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Last Sync</div>
                            <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                {formattedLastSync}
                                <button onClick={load} disabled={isRefreshing} className="text-[#0F4C81] hover:bg-blue-50 p-1 rounded transition-colors ml-1">
                                    <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ZONE 2: KPI Cards */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
                    {/* Real Data & Empty Placeholders */}
                    {[
                        { title: 'Pending Approvals', value: items.length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
                        { title: 'Approved Today', value: '--', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                        { title: 'Rejected Today', value: '--', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
                        { title: 'Avg. Approval Time', value: '--', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50' }
                    ].map((kpi, i) => (
                        <div key={i} className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100 p-5 hover:-translate-y-1 transition-transform duration-200 cursor-default">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-semibold text-slate-500">{kpi.title}</div>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.bg} ${kpi.color}`}>
                                    <kpi.icon size={16} strokeWidth={2.5} />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-slate-800">{kpi.value}</div>
                        </div>
                    ))}
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
                    
                    <div className="xl:col-span-8 space-y-8">
                        
                        {/* ZONE 3: Workflow Overview */}
                        <section className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100 p-5 lg:p-6 overflow-hidden">
                            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <ShieldCheck size={16} className="text-[#0F4C81]" /> Standard Workflow Context
                            </h2>
                            <div className="flex items-center justify-between overflow-x-auto pb-2 custom-scrollbar">
                                {[
                                    { label: 'Submitted', status: 'past' },
                                    { label: 'L1 Approval', status: 'current' },
                                    { label: 'PED Engineer', status: 'future' },
                                    { label: 'Design', status: 'future' },
                                    { label: 'Checker', status: 'future' },
                                    { label: 'Final', status: 'future' },
                                    { label: 'Implementation', status: 'future' }
                                ].map((step, i, arr) => (
                                    <React.Fragment key={i}>
                                        <div className="flex flex-col items-center gap-2 relative z-10 flex-shrink-0">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                                                ${step.status === 'past' ? 'bg-emerald-100 text-emerald-700' : 
                                                  step.status === 'current' ? 'bg-[#0F4C81] text-white ring-4 ring-blue-50' : 
                                                  'bg-slate-100 text-slate-400'}`}>
                                                {step.status === 'past' ? <CheckCircle2 size={14} /> : i + 1}
                                            </div>
                                            <span className={`text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${step.status === 'current' ? 'text-[#0F4C81]' : 'text-slate-400'}`}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {i < arr.length - 1 && (
                                            <div className="flex-1 h-0.5 mx-2 bg-slate-200 relative min-w-[30px]">
                                                {step.status === 'past' && <div className="absolute top-0 left-0 h-full w-full bg-emerald-400" />}
                                            </div>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </section>

                        {/* ZONE 4: Main Approval Queue */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-slate-800">Pending Actions</h2>
                                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-md border border-amber-200">
                                    {items.length} In Queue
                                </span>
                            </div>

                            {loading ? (
                                <div className="space-y-3">
                                    {[1,2,3].map(i => (
                                        <div key={i} className="bg-white h-24 rounded-2xl animate-pulse border border-slate-100"></div>
                                    ))}
                                </div>
                            ) : items.length === 0 ? (
                                /* Enterprise Empty State */
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
                                    className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center p-12 lg:p-16 text-center">
                                    <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                                        <CheckCircle2 size={40} className="text-emerald-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">Approval Queue Clear</h3>
                                    <p className="text-slate-500 max-w-sm mb-6 text-sm">
                                        There are currently no MH requests awaiting Level-1 approval. New requests will automatically appear here when submitted.
                                    </p>
                                    <div className="bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 border border-slate-100 flex items-center gap-2">
                                        <Clock size={14} /> Last request processed today at 10:45 AM
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="space-y-3">
                                    <AnimatePresence>
                                        {items.map((req, idx) => {
                                            const typeStyle = REQUEST_TYPE_COLORS[req.requestType] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };

                                            return (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    key={req._id}
                                                    onClick={() => navigate(`/workflow/${req._id}`)}
                                                    className="group bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-200 hover:border-[#0F4C81]/30 cursor-pointer transition-all duration-200 flex items-stretch overflow-hidden"
                                                >
                                                    {/* Accent Strip */}
                                                    <div className="w-1.5 bg-[#0F4C81] group-hover:bg-[#1C68AB] transition-colors"></div>
                                                    
                                                    <div className="flex-1 p-4 lg:p-5 flex items-center gap-4 lg:gap-6">
                                                        
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-3 mb-1.5">
                                                                <span className="text-base font-bold text-slate-800">
                                                                    {req.mhRequestId}
                                                                </span>
                                                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wide ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                                                                    {req.requestType}
                                                                </span>
                                                            </div>
                                                            
                                                            <div className="text-sm font-semibold text-slate-700 truncate mb-1">
                                                                {req.handlingPartName} {req.materialHandlingEquipment ? `· ${req.materialHandlingEquipment}` : ''}
                                                            </div>
                                                            
                                                            <div className="flex items-center text-xs text-slate-500 gap-2 truncate">
                                                                <span className="font-medium text-slate-600">{req.userName}</span>
                                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                                <span>{req.departmentName}</span>
                                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                                <span>{req.plantLocation}</span>
                                                            </div>
                                                        </div>

                                                        <div className="hidden md:block w-px h-10 bg-slate-200"></div>

                                                        <div className="hidden md:block px-4">
                                                            <LeadTimeChip leadTime={req.leadTime} />
                                                        </div>

                                                        <div className="hidden sm:block w-px h-10 bg-slate-200"></div>

                                                        <div className="hidden sm:block text-right min-w-[80px]">
                                                            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">Submitted</div>
                                                            <div className="text-xs font-semibold text-slate-700">
                                                                {req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                                                            </div>
                                                        </div>

                                                        <div className="pl-2">
                                                            <button className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-[#0F4C81] group-hover:border-[#0F4C81] group-hover:text-white transition-all">
                                                                <ArrowRight size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* ZONE 5: Operational Insights Panel */}
                    <div className="xl:col-span-4">
                        <section className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100 p-5 lg:p-6 sticky top-24">
                            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                                <LayoutDashboard size={16} className="text-[#0F4C81]" /> Operational Insights
                            </h2>

                            <div className="space-y-6">
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Queue Health</div>
                                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-white rounded-full shadow-sm flex items-center justify-center text-emerald-500">
                                                <Activity size={16} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-emerald-800">Healthy</div>
                                                <div className="text-xs text-emerald-600">Within SLAs</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Notifications</div>
                                    <div className="space-y-3">
                                        <div className="text-xs text-slate-400 italic p-2 bg-slate-50 rounded-lg text-center border border-slate-100">
                                            No recent notifications
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Approval Velocity</div>
                                    <div className="h-24 flex items-center justify-center mt-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <span className="text-xs font-medium text-slate-400">Insufficient data to display</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                </div>
            </main>
        </div>
    );
}
