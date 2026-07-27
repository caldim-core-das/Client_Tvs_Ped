import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Terminal, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Spin, message } from 'antd';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

import api from '../api/axiosConfig';

const NotificationLogSection = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    // Only Admins / System Admins can view this section
    if (user?.role !== 'Admin' && user?.role !== 'System Admin') {
        return null;
    }

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const response = await api.get('/workflow/notifications');
            setLogs(response.data.data || []);
        } catch (error) {
            console.error('Error fetching notification logs:', error);
            message.error('Failed to load notification logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const getStatusConfig = (status) => {
        switch (status) {
            case 'SENT': return { icon: <CheckCircle size={14} />, color: 'bg-green-100 text-green-700 border-green-200' };
            case 'PENDING': return { icon: <Clock size={14} />, color: 'bg-blue-100 text-blue-700 border-blue-200' };
            case 'FAILED': return { icon: <AlertCircle size={14} />, color: 'bg-orange-100 text-orange-700 border-orange-200' };
            case 'PERMANENTLY_FAILED': return { icon: <AlertCircle size={14} />, color: 'bg-red-100 text-red-700 border-red-200' };
            default: return { icon: <Clock size={14} />, color: 'bg-gray-100 text-gray-700 border-gray-200' };
        }
    };

    return (
        <div className="mt-10 mb-10">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Terminal className="w-6 h-6 text-slate-700" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">System Diagnostics & Logs</h1>
                        <p className="text-gray-600 text-sm">View real-time email notification audit logs (Admin Only)</p>
                    </div>
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading && logs.length === 0 ? (
                    <div className="flex justify-center items-center h-48">
                        <Spin size="large" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">No notification logs found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-gray-100">
                                    <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-500">Timestamp</th>
                                    <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-500">Request ID</th>
                                    <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-500">Event</th>
                                    <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-500">Recipient</th>
                                    <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-500">Status</th>
                                    <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-slate-500 text-center">Attempts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {logs.map((log) => {
                                    const statusConfig = getStatusConfig(log.status);
                                    return (
                                        <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-3 whitespace-nowrap text-slate-600">
                                                {dayjs(log.createdAt).format('DD MMM YYYY, HH:mm')}
                                            </td>
                                            <td className="px-6 py-3 font-medium text-tvs-primary">
                                                {log.mhRequestId}
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap">
                                                <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded text-slate-700">
                                                    {log.event}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="font-medium text-slate-800">{log.recipientRole}</div>
                                                <div className="text-xs text-slate-500">{log.recipient}</div>
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${statusConfig.color}`}>
                                                    {statusConfig.icon}
                                                    {log.status}
                                                </div>
                                                {log.failureReason && (
                                                    <div className="text-[10px] text-red-500 mt-1 max-w-[200px] truncate" title={log.failureReason}>
                                                        {log.failureReason}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-center font-medium text-slate-700">
                                                {log.attempts} / {log.maxAttempts || 3}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationLogSection;
