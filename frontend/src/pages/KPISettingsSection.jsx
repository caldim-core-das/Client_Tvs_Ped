import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Target, Save } from 'lucide-react';
import { message } from 'antd';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const KPISettingsSection = () => {
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({
        phaseTargets: {
            Initiated: 1.5,
            Design: 4.0,
            'PR/PO': 3.0,
            'Sample Prod.': 5.0,
            'Prod. Ready': 2.0,
            Released: 1.0,
        },
        activeAssetsTarget: 150,
        pendingRequestsAlertThreshold: 50,
        rejectedRequestsAlertThreshold: 10
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/kpi-settings`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            if (response.data) {
                setSettings(response.data);
            }
        } catch (error) {
            console.error('Error fetching KPI settings:', error);
            message.error('Failed to load KPI target settings');
        }
    };

    const handlePhaseChange = (phase, value) => {
        setSettings(prev => ({
            ...prev,
            phaseTargets: {
                ...prev.phaseTargets,
                [phase]: parseFloat(value) || 0
            }
        }));
    };

    const handleChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: parseFloat(value) || 0
        }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await axios.put(`${API_BASE_URL}/api/kpi-settings`, settings, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            message.success('KPI settings saved successfully');
        } catch (error) {
            console.error('Error saving KPI settings:', error);
            message.error('Failed to save KPI settings');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-10">
            <div className="mb-4 flex items-center gap-3">
                <Target className="w-6 h-6 text-tvs-primary" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">KPI Targets & Thresholds</h1>
                    <p className="text-gray-600 text-sm">Adjust target cycle times and alert thresholds for the Dashboard and automated emails.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Phase Cycle Time Targets */}
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Phase Target Days</h2>
                        <div className="space-y-4">
                            {Object.entries(settings.phaseTargets || {}).map(([phase, days]) => (
                                <div key={phase} className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">{phase} Phase</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            value={days}
                                            onChange={(e) => handlePhaseChange(phase, e.target.value)}
                                            className="w-20 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-tvs-primary outline-none"
                                        />
                                        <span className="text-sm text-gray-500">days</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* General KPI Thresholds */}
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Dashboard Alert Thresholds</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Active Assets Target</span>
                                <input
                                    type="number"
                                    value={settings.activeAssetsTarget || 0}
                                    onChange={(e) => handleChange('activeAssetsTarget', e.target.value)}
                                    className="w-24 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-tvs-primary outline-none"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Pending Requests Limit</span>
                                <input
                                    type="number"
                                    value={settings.pendingRequestsAlertThreshold || 0}
                                    onChange={(e) => handleChange('pendingRequestsAlertThreshold', e.target.value)}
                                    className="w-24 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-tvs-primary outline-none"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Rejected Requests Limit</span>
                                <input
                                    type="number"
                                    value={settings.rejectedRequestsAlertThreshold || 0}
                                    onChange={(e) => handleChange('rejectedRequestsAlertThreshold', e.target.value)}
                                    className="w-24 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-tvs-primary outline-none"
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex items-center bg-tvs-primary px-6 py-2 rounded-lg font-medium shadow-sm hover:bg-opacity-90 transform active:scale-95 transition-all text-white disabled:opacity-50 space-x-2"
                            >
                                <Save size={18} />
                                <span>{loading ? 'Saving...' : 'Save KPI Settings'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KPISettingsSection;
