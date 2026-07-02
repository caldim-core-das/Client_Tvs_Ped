import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Clock, AlertTriangle, User, Hash, Search, Filter, Maximize2, Minimize2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const PHASE_STAGES = [
    { id: 'Initiated', title: 'Initiated', colour: '#64748B', dbStage: 'Not Started' },
    { id: 'Design', title: 'Design', colour: '#3B82F6', dbStage: 'Design' },
    { id: 'PR/PO', title: 'PR/PO', colour: '#F59E0B', dbStage: 'PR/PO' },
    { id: 'Sample Prod.', title: 'Sample Prod.', colour: '#8B5CF6', dbStage: 'Sample Production' },
    { id: 'Prod. Ready', title: 'Prod. Ready', colour: '#10B981', dbStage: 'Production Ready' },
    { id: 'Released', title: 'Released', colour: '#CC1F1F', dbStage: 'Completed' },
];

const KanbanPipeline = ({ pipelineItems = [], kpiSettings = {}, onPhaseClick }) => {
    const [columns, setColumns] = useState({});
    
    // Filters State
    const [searchQuery, setSearchQuery] = useState('');
    const [vendorFilter, setVendorFilter] = useState('All');
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [bottlenecksOnly, setBottlenecksOnly] = useState(false);
    const [isCompact, setIsCompact] = useState(false);

    // Helper: calculate days since update
    const getDaysSinceUpdate = (updatedAt) => {
        const diffTime = Math.abs(new Date() - new Date(updatedAt));
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };

    // Extract unique vendors and departments for dropdowns
    const uniqueVendors = useMemo(() => {
        const vendors = pipelineItems.map(item => item.vendorName).filter(Boolean);
        return ['All', ...new Set(vendors)];
    }, [pipelineItems]);

    const uniqueDepartments = useMemo(() => {
        const depts = pipelineItems.map(item => item.departmentName).filter(Boolean);
        return ['All', ...new Set(depts)];
    }, [pipelineItems]);

    // Apply Filters & limit to 50 per column
    useEffect(() => {
        const initialCols = {};
        
        PHASE_STAGES.forEach(phase => {
            // Get target days for this phase to check bottlenecks
            let targetDays = 10;
            if (phase.id === 'Design' && kpiSettings?.phaseTargets?.design) targetDays = kpiSettings.phaseTargets.design;
            if (phase.id === 'PR/PO' && kpiSettings?.phaseTargets?.prPo) targetDays = kpiSettings.phaseTargets.prPo;

            const filteredPhaseItems = pipelineItems.filter(item => {
                if (item.currentStage !== phase.id) return false;
                
                // Search filter
                const searchLower = searchQuery.toLowerCase();
                const matchesSearch = !searchQuery || 
                    (item.productModel?.toLowerCase().includes(searchLower)) || 
                    (item.assetRequestId?.toLowerCase().includes(searchLower));
                
                // Dropdown filters
                const matchesVendor = vendorFilter === 'All' || item.vendorName === vendorFilter;
                const matchesDept = departmentFilter === 'All' || item.departmentName === departmentFilter;
                
                // Bottleneck filter
                const daysInStage = getDaysSinceUpdate(item.updatedAt);
                const isSlow = daysInStage > targetDays;
                const matchesBottleneck = !bottlenecksOnly || isSlow;

                return matchesSearch && matchesVendor && matchesDept && matchesBottleneck;
            });

            initialCols[phase.id] = filteredPhaseItems;
        });

        setColumns(initialCols);
    }, [pipelineItems, searchQuery, vendorFilter, departmentFilter, bottlenecksOnly, kpiSettings]);

    const handleDragEnd = async (result) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        // Optimistic UI update
        const sourceCol = [...(columns[source.droppableId] || [])];
        const destCol = [...(columns[destination.droppableId] || [])];
        const [movedItem] = sourceCol.splice(source.index, 1);
        movedItem.currentStage = destination.droppableId;
        destCol.splice(destination.index, 0, movedItem);

        setColumns({
            ...columns,
            [source.droppableId]: sourceCol,
            [destination.droppableId]: destCol,
        });

        // Update Backend
        const targetPhase = PHASE_STAGES.find(p => p.id === destination.droppableId);
        if (!targetPhase) return;

        try {
            const token = sessionStorage.getItem('token');
            await axios.put(`http://localhost:5000/api/mh-development-tracker/${movedItem._id}`, 
                { currentStage: targetPhase.dbStage },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Stage updated successfully');
        } catch (error) {
            console.error('Failed to update stage:', error);
            toast.error('Failed to update stage. Reverting...');
            // Revert on failure
            const origSource = [...(columns[source.droppableId] || [])];
            const origDest = [...(columns[destination.droppableId] || [])];
            origDest.splice(destination.index, 1);
            movedItem.currentStage = source.droppableId;
            origSource.splice(source.index, 0, movedItem);
            setColumns({
                ...columns,
                [source.droppableId]: origSource,
                [destination.droppableId]: origDest,
            });
        }
    };

    return (
        <div className="w-full flex flex-col gap-4">
            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search Model or ID..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-[200px] transition-all"
                        />
                    </div>
                    
                    {/* Vendor Filter */}
                    <select 
                        value={vendorFilter} 
                        onChange={(e) => setVendorFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-600 cursor-pointer"
                    >
                        <option value="All">All Vendors</option>
                        {uniqueVendors.filter(v => v !== 'All').map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>

                    {/* Department Filter */}
                    <select 
                        value={departmentFilter} 
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-600 cursor-pointer"
                    >
                        <option value="All">All Departments</option>
                        {uniqueDepartments.filter(d => d !== 'All').map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-3">
                    {/* Bottlenecks Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                        <input 
                            type="checkbox" 
                            checked={bottlenecksOnly} 
                            onChange={(e) => setBottlenecksOnly(e.target.checked)}
                            className="rounded text-red-500 focus:ring-red-500 border-slate-300 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                            <AlertTriangle size={14} className={bottlenecksOnly ? "text-red-500" : "text-slate-400"} /> 
                            Bottlenecks Only
                        </span>
                    </label>

                    {/* Compact Mode Toggle */}
                    <button 
                        onClick={() => setIsCompact(!isCompact)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors text-sm font-bold ${
                            isCompact ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        {isCompact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                        {isCompact ? 'Expand View' : 'Compact View'}
                    </button>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="w-full overflow-x-auto pb-4">
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="flex gap-4 min-w-max items-start">
                        {PHASE_STAGES.map((phase) => {
                            const items = columns[phase.id] || [];
                            // Apply a hard limit of 50 cards rendered per column to prevent DOM lag
                            const limit = 50;
                            const renderedItems = items.slice(0, limit);
                            const hiddenCount = Math.max(0, items.length - limit);

                            const isBottleneck = phase.id === 'Design' && items.length > 0; // Keeping legacy mock logic or use real logic
                            
                            // Target time logic from KPI Settings
                            let targetDays = 10;
                            if (phase.id === 'Design' && kpiSettings?.phaseTargets?.design) targetDays = kpiSettings.phaseTargets.design;
                            if (phase.id === 'PR/PO' && kpiSettings?.phaseTargets?.prPo) targetDays = kpiSettings.phaseTargets.prPo;

                            return (
                                <div key={phase.id} className="w-[300px] shrink-0 flex flex-col bg-slate-50/50 rounded-2xl border border-slate-200">
                                    {/* Column Header */}
                                    <div 
                                        className="p-4 border-b border-slate-200 cursor-pointer hover:bg-slate-50 rounded-t-2xl transition-colors"
                                        onClick={() => onPhaseClick && onPhaseClick(phase.id, phase.colour)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: phase.colour }} />
                                                <span className="font-outfit font-extrabold text-sm text-slate-800 uppercase tracking-wide">
                                                    {phase.title}
                                                </span>
                                            </div>
                                            <span className="bg-white border border-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                                                {items.length}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-3">
                                            <span className="flex items-center gap-1"><Clock size={10} /> Target: {targetDays}d</span>
                                            {isBottleneck && (
                                                <span className="flex items-center gap-1 text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-bold animate-pulse">
                                                    <AlertTriangle size={10} /> Bottleneck
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Droppable Area */}
                                    <Droppable droppableId={phase.id}>
                                        {(provided, snapshot) => (
                                            <div 
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className={`p-3 min-h-[150px] flex flex-col gap-3 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-100/80' : ''}`}
                                            >
                                                {renderedItems.map((item, i) => {
                                                    const daysInStage = getDaysSinceUpdate(item.updatedAt);
                                                    const progressPct = Math.min(100, Math.round((daysInStage / targetDays) * 100));
                                                    const isSlow = daysInStage > targetDays;

                                                    return (
                                                        <Draggable key={item._id} draggableId={item._id} index={i}>
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    {...provided.dragHandleProps}
                                                                    className={`bg-white border border-slate-200 rounded-xl shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow
                                                                        ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400/50 scale-[1.02]' : ''}
                                                                        ${isSlow ? 'border-red-200' : ''}
                                                                        ${isCompact ? 'p-2' : 'p-3'}
                                                                    `}
                                                                    style={{ ...provided.draggableProps.style }}
                                                                >
                                                                    {/* Normal View */}
                                                                    {!isCompact && (
                                                                        <>
                                                                            <div className="flex items-start justify-between mb-2">
                                                                                <div className="text-xs font-extrabold text-slate-800 truncate pr-2">
                                                                                    {item.productModel || item.assetRequestId}
                                                                                </div>
                                                                                <div className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                                                                                    <Hash size={10} /> {item.assetRequestId.slice(-4)}
                                                                                </div>
                                                                            </div>
                                                                            
                                                                            <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-3 truncate">
                                                                                <User size={10} /> {item.vendorName || item.departmentName}
                                                                            </div>

                                                                            {/* Progress Bar */}
                                                                            <div>
                                                                                <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                                                                    <span>Time in Stage</span>
                                                                                    <span className={isSlow ? 'text-red-500' : ''}>{daysInStage}d / {targetDays}d</span>
                                                                                </div>
                                                                                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden relative">
                                                                                    <div 
                                                                                        className={`h-full rounded-full transition-all duration-500 ${isSlow ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                                                        style={{ width: `${progressPct}%` }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    )}

                                                                    {/* Compact View */}
                                                                    {isCompact && (
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                                <div className={`w-2 h-2 rounded-full shrink-0 ${isSlow ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                                                <div className="text-[10px] font-extrabold text-slate-800 truncate">
                                                                                    {item.productModel || item.assetRequestId}
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                                                                                <Hash size={10} /> {item.assetRequestId.slice(-4)}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    );
                                                })}
                                                {provided.placeholder}
                                                
                                                {/* Hidden Items Indicator */}
                                                {hiddenCount > 0 && (
                                                    <div className="text-[10px] font-bold text-slate-400 text-center py-2 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                                                        + {hiddenCount} more hidden (Use filters)
                                                    </div>
                                                )}

                                                {items.length === 0 && (
                                                    <div className="h-full flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-2 border-dashed border-slate-200 rounded-xl py-6 bg-white/50">
                                                        No Items match filters
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            );
                        })}
                    </div>
                </DragDropContext>
            </div>
        </div>
    );
};

export default KanbanPipeline;
