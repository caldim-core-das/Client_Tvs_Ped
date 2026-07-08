import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Layout, List, FolderOpen, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Spin, message } from 'antd';
import dayjs from 'dayjs';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Reusable status badge component
const StatusBadge = ({ state }) => {
    const STATE_CONFIG = {
        'SUBMITTED':          { label: 'Submitted (L1)', color: 'bg-blue-100 text-blue-700 border-blue-200' },
        'L1_APPROVED':        { label: 'L1 Approved', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
        'L1_REJECTED':        { label: 'L1 Rejected', color: 'bg-red-100 text-red-700 border-red-200' },
        'DESIGN_IN_PROGRESS': { label: 'Design In Progress', color: 'bg-purple-100 text-purple-700 border-purple-200' },
        'DESIGN_SUBMITTED':   { label: 'Design Submitted', color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
        'DESIGN_APPROVED':    { label: 'Design Approved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        'DESIGN_REJECTED':    { label: 'Design Rejected', color: 'bg-red-100 text-red-700 border-red-200' },
        'FINAL_APPROVED':     { label: 'Final Approved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        'FINAL_REJECTED':     { label: 'Final Rejected', color: 'bg-red-100 text-red-700 border-red-200' },
        'IN_PRODUCTION':      { label: 'In Production', color: 'bg-amber-100 text-amber-700 border-amber-200' },
        'IMPLEMENTATION':     { label: 'Implementation', color: 'bg-orange-100 text-orange-700 border-orange-200' },
        'COMPLETED':          { label: 'Completed', color: 'bg-green-100 text-green-700 border-green-200' },
        'REVERTED':           { label: 'Reverted', color: 'bg-gray-100 text-gray-700 border-gray-200' },
        'CANCELLED':          { label: 'Cancelled', color: 'bg-gray-100 text-gray-700 border-gray-200' },
    };
    
    const config = STATE_CONFIG[state] || { label: state, color: 'bg-gray-100 text-gray-700 border-gray-200' };
    
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
            {config.label}
        </span>
    );
};

const MyRequestsPage = () => {
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchMyRequests = async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/workflow/queue/my-requests`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRequests(res.data.data || []);
        } catch (err) {
            console.error('Error fetching my requests:', err);
            message.error('Failed to load your requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyRequests();
    }, []);

    const handleRowClick = (requestId) => {
        navigate(`/workflow/${requestId}`);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FolderOpen className="text-tvs-primary" />
                        My Requests Tracker
                    </h1>
                    <p className="text-gray-500 mt-1">Track the real-time progress of all MH requests you've submitted.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Spin size="large" />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <List size={48} className="mb-4 text-gray-300" />
                        <p className="text-lg font-medium text-gray-500">No requests found</p>
                        <p className="text-sm">You haven't submitted any MH requests yet.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                                    <th className="px-6 py-4 font-semibold">Request ID</th>
                                    <th className="px-6 py-4 font-semibold">Equipment / Part</th>
                                    <th className="px-6 py-4 font-semibold">Department</th>
                                    <th className="px-6 py-4 font-semibold">Submitted On</th>
                                    <th className="px-6 py-4 font-semibold">Current State</th>
                                    <th className="px-6 py-4 font-semibold text-right">Lead Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {requests.map(req => (
                                    <tr 
                                        key={req._id} 
                                        onClick={() => handleRowClick(req._id)}
                                        className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-semibold text-tvs-primary group-hover:underline">
                                                {req.mhRequestId}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-800">{req.materialHandlingEquipment || 'N/A'}</div>
                                            <div className="text-xs text-gray-500">{req.handlingPartName}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 text-sm">
                                            {req.departmentName}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                <Calendar size={14} className="text-gray-400" />
                                                {dayjs(req.createdAt).format('DD MMM YYYY')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge state={req.workflowState} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {req.leadTime && req.leadTime.estimatedDays ? (
                                                <div className="inline-flex flex-col items-end">
                                                    <span className={`text-sm font-bold ${req.leadTime.status === 'OVERDUE' ? 'text-red-600' : 'text-gray-700'}`}>
                                                        {req.leadTime.consumedDays} / {req.leadTime.estimatedDays} Days
                                                    </span>
                                                    {req.leadTime.status === 'OVERDUE' && (
                                                        <span className="text-[10px] text-red-500 flex items-center gap-1 mt-0.5 font-medium">
                                                            <AlertCircle size={10} /> Overdue by {req.leadTime.overdueByDays}d
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-sm">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyRequestsPage;
