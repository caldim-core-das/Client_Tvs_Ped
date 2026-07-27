import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, FileText, Users, Save, Check, Search, Shield, Palette, Type, Layout as LayoutIcon, Sliders } from 'lucide-react';
import { message, Select, Tag, Spin, Tooltip } from 'antd';
import { COLOR_THEMES, FONT_OPTIONS, LAYOUT_OPTIONS } from '../components/Sidebar';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import KPISettingsSection from './KPISettingsSection';
import NotificationLogSection from './NotificationLogSection';

import api, { getApiBaseUrl } from '../api/axiosConfig';

const API_BASE_URL = getApiBaseUrl();

const ROLE_OPTIONS = [
    { value: 'Requester',    label: 'Requester',    color: 'blue' },
    { value: 'L1 Approver',     label: 'L1 Approver',     color: 'green' },
    { value: 'PED Engineer', label: 'PED Engineer', color: 'purple' },
];

const Settings = () => {
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [roles, setRoles] = useState([]);
    const [exportLoading, setExportLoading] = useState(false);

    // Settings State
    const [frequency, setFrequency] = useState('Weekly');
    const [reportType, setReportType] = useState('Progress Report of MH Requests');
    const [selectedEmployees, setSelectedEmployees] = useState([]);

    // User Management State
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [roleUpdating, setRoleUpdating] = useState({});

    // UI Customization State
    const [activeTheme,  setActiveTheme]  = useState(() => { try { return JSON.parse(localStorage.getItem('sb_theme')) ?? 'white'; } catch { return 'white'; } });
    const [activeFont,   setActiveFont]   = useState(() => { try { return JSON.parse(localStorage.getItem('sb_font')) ?? 'inter'; } catch { return 'inter'; } });
    const [activeLayout, setActiveLayout] = useState(() => { try { return JSON.parse(localStorage.getItem('sb_layout')) ?? 'normal'; } catch { return 'normal'; } });

    const applyTheme  = k => { setActiveTheme(k);  localStorage.setItem('sb_theme', JSON.stringify(k)); window.dispatchEvent(new Event('sidebar_theme_update')); };
    const applyFont   = k => { setActiveFont(k);   localStorage.setItem('sb_font', JSON.stringify(k)); window.dispatchEvent(new Event('sidebar_theme_update')); };
    const applyLayout = k => { setActiveLayout(k); localStorage.setItem('sb_layout', JSON.stringify(k)); window.dispatchEvent(new Event('sidebar_theme_update')); };

    useEffect(() => {
        fetchEmployees();
        fetchExistingSettings();
        fetchUsers();
    }, []);

    const fetchExistingSettings = async () => {
        try {
            const response = await api.get('/api/report-settings');
            if (response.data.success && response.data.data) {
                const { frequency: freq, reportType: type, recipients } = response.data.data;
                if (freq) setFrequency(freq);
                if (type) setReportType(type);
                if (recipients && recipients.length > 0) setSelectedEmployees(recipients);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await api.get('/api/employees');
            if (response.data.success) {
                setEmployees(response.data.data);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching employees:', error);
            message.error('Failed to load employees');
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const usersRes = await api.get('/api/users');
            setUsers(usersRes.data.data || []);
            
            try {
                const rolesRes = await api.get('/api/roles');
                setRoles(rolesRes.data || []);
            } catch (err) {
                console.error('Failed to load roles', err);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setUsersLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        setRoleUpdating(prev => ({ ...prev, [userId]: true }));
        try {
            const response = await api.patch(`/api/users/${userId}/role`, { role: newRole });
            if (response.data.success) {
                setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
                message.success(`Role updated to "${newRole}" successfully`);
            }
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to update role');
        } finally {
            setRoleUpdating(prev => ({ ...prev, [userId]: false }));
        }
    };

    const handleEmployeeToggle = (email) => {
        setSelectedEmployees(prev => {
            if (prev.includes(email)) {
                return prev.filter(e => e !== email);
            } else {
                return [...prev, email];
            }
        });
    };

    const generatePDF = (data, summary, type) => {
        try {
            console.log('Generating PDF with data:', { dataLength: data?.length, summary });
            const doc = new jsPDF();

            // Header
            doc.setFontSize(20);
            doc.text(type || 'Asset Management Report', 14, 22);

            doc.setFontSize(11);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

            // Summary
            doc.text('Summary:', 14, 40);
            doc.text(`Total Requests: ${summary?.totalRequests || 0}`, 14, 46);

            // Detailed Table
            const tableColumn = ["MH ID", "User", "Dept", "Status", "Progress", "Date"];
            const tableRows = [];

            if (data && Array.isArray(data)) {
                data.forEach(req => {
                    const requestData = [
                        req.mhRequestId || 'N/A',
                        req.userName || 'N/A',
                        req.departmentName || 'N/A',
                        req.status || 'N/A',
                        req.progressStatus || 'N/A',
                        req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'N/A'
                    ];
                    tableRows.push(requestData);
                });
            }

            console.log('Table rows prepared:', tableRows.length);

            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 55,
            });

            // Open in new tab
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');
            console.log('PDF generated and opened successfully');
        } catch (error) {
            console.error('Error inside generatePDF:', error);
            throw new Error('PDF Generation failed: ' + error.message);
        }
    };

    const handleSave = async () => {
        if (selectedEmployees.length === 0) {
            message.warning('Please select at least one recipient');
            return;
        }

        try {
            setLoading(true);
            const response = await api.post('/report-settings', {
                frequency,
                reportType,
                recipients: selectedEmployees
            });

            if (response.data.success) {
                message.success('Settings saved successfully! Reports will be sent automatically.');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            message.error(error.response?.data?.message || 'Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async () => {
        try {
            setLoading(true);
            console.log('Requesting preview for:', reportType);

            const response = await api.post('/report-settings/preview', {
                reportType
            });

            console.log('Preview API Response:', response.data);

            if (response.data.success) {
                const responseData = response.data.data;
                const data = responseData.data || [];
                const summary = responseData.summary || { totalRequests: 0 };

                console.log('Processing preview data:', { dataLength: data.length, summary });

                generatePDF(data, summary, reportType);
                message.success('Report preview generated successfully');
            }
        } catch (error) {
            console.error('Error generating preview:', error);
            message.error(`Failed to generate preview: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSendNow = async () => {
        if (selectedEmployees.length === 0) {
            message.warning('Please select at least one recipient');
            return;
        }

        try {
            setLoading(true);
            const response = await api.post('/report-settings/send-now', {
                reportType,
                recipients: selectedEmployees
            });

            if (response.data.success) {
                message.success('Report sent successfully!');
            }
        } catch (error) {
            console.error('Error sending report:', error);
            message.error(error.response?.data?.message || 'Failed to send report');
        } finally {
            setLoading(false);
        }
    };

    const handleExportDeletedDesigns = async () => {
        try {
            setExportLoading(true);
            const response = await api.get('/design-library?activeStatus=false&limit=10000');
            
            const deletedData = response.data.data;
            if (!deletedData || deletedData.length === 0) {
                message.info('No soft-deleted data found.');
                return;
            }

            const formattedData = deletedData.map(item => ({
                'Library ID': item.libraryId,
                'Name': item.name,
                'Category': item.category,
                'Equipment Type': item.equipmentType,
                'Version': item.version,
                'Number of Variants': item.variants?.length || 0,
                'Deleted (Inactive)': 'Yes',
                'Last Updated': new Date(item.updatedAt || new Date()).toLocaleString()
            }));

            const worksheet = XLSX.utils.json_to_sheet(formattedData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Deleted Designs");
            XLSX.writeFile(workbook, `Deleted_Designs_Audit_${new Date().toISOString().split('T')[0]}.xlsx`);
            
            message.success('Excel export downloaded successfully!');
        } catch (error) {
            console.error('Error exporting deleted data:', error);
            message.error('Failed to export data');
        } finally {
            setExportLoading(false);
        }
    };

    if (loading && employees.length === 0) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tvs-primary"></div>
            </div>
        );
    }

    const filteredEmployees = employees.filter(emp =>
        (emp.employeeName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (emp.mailId?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const frequencies = ['Daily', 'Weekly', 'Fortnightly', 'Monthly'];

    const reportTypes = [
        'Progress Report of MH Requests',
        'Progress Report of Approved Requests',
        'Progress Report of Implemented',
        'Progress Report of Rejected'
    ];

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Report Settings</h1>
                    <p className="text-gray-600">Configure automated report generation and delivery</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={handlePreview}
                        style={{ color: '#fff' }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
                    >
                        <FileText size={18} color="#fff" />
                        <span>Preview Report</span>
                    </button>
                    <button
                        onClick={handleSendNow}
                        style={{ color: '#fff' }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                    >
                        <Users size={18} color="#fff" />
                        <span>Send Now</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Frequency Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center space-x-3 mb-4 text-tvs-primary">
                        <Calendar className="w-6 h-6" />
                        <h2 className="text-lg font-semibold">Frequency</h2>
                    </div>
                    <div className="space-y-3">
                        {frequencies.map((freq) => (
                            <button
                                key={freq}
                                onClick={() => setFrequency(freq)}
                                className={`w-full p-4 text-left rounded-lg border transition-all ${frequency === freq
                                    ? 'border-tvs-primary bg-blue-50 text-tvs-primary ring-1 ring-blue-200'
                                    : 'border-gray-200 hover:border-blue-300'
                                    }`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium">{freq}</span>
                                    {frequency === freq && <Check size={18} />}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Report Type Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center space-x-3 mb-4 text-tvs-primary">
                        <FileText className="w-6 h-6" />
                        <h2 className="text-lg font-semibold">Report Type</h2>
                    </div>
                    <div className="space-y-3">
                        {reportTypes.map((type) => (
                            <button
                                key={type}
                                onClick={() => setReportType(type)}
                                className={`w-full p-4 text-left rounded-lg border transition-all ${reportType === type
                                    ? 'border-tvs-primary bg-blue-50 text-tvs-primary ring-1 ring-blue-200'
                                    : 'border-gray-200 hover:border-blue-300'
                                    }`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-sm">{type}</span>
                                    {reportType === type && <Check size={18} />}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recipients Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-[500px]">
                    <div className="flex items-center space-x-3 mb-4 text-tvs-primary">
                        <Users className="w-6 h-6" />
                        <h2 className="text-lg font-semibold">Recipients</h2>
                    </div>

                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search employees..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tvs-primary"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {filteredEmployees.map((emp) => (
                            <div
                                key={emp._id}
                                onClick={() => handleEmployeeToggle(emp.mailId)}
                                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedEmployees.includes(emp.mailId)
                                    ? 'border-tvs-primary bg-blue-50'
                                    : 'border-gray-100 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${selectedEmployees.includes(emp.mailId)
                                        ? 'bg-blue-200 text-tvs-primary'
                                        : 'bg-gray-200 text-gray-600'
                                        }`}>
                                        {(emp.employeeName || '?').charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{emp.employeeName || 'Unknown Name'}</p>
                                        <p className="text-xs text-gray-500 truncate">{emp.mailId || 'No Email'}</p>
                                    </div>
                                    {selectedEmployees.includes(emp.mailId) && (
                                        <Check size={16} className="text-tvs-primary" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="text-sm text-gray-500 mb-2">
                            Selected: <span className="font-bold text-tvs-primary">{selectedEmployees.length}</span> recipients
                        </div>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="mt-8 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    style={{ color: '#fff' }}
                    className="flex items-center bg-tvs-primary px-8 py-3 rounded-lg font-medium shadow-sm hover:bg-opacity-90 transform active:scale-95 transition-all cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed space-x-2"
                >
                    <Save size={20} color="#fff" />
                    <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                </button>
            </div>

            {/* ─── User Management Section ─────────────────────────────────────── */}
            <div className="mt-10">
                <div className="mb-4 flex items-center gap-3">
                    <Shield className="w-6 h-6 text-tvs-primary" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
                        <p className="text-gray-600 text-sm">Assign access levels to portal users</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Search */}
                    <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name, email or department..."
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tvs-primary"
                                value={userSearchTerm}
                                onChange={e => setUserSearchTerm(e.target.value)}
                            />
                        </div>
                        <span className="text-xs text-gray-400 font-medium">
                            {users.filter(u => u.role !== 'Admin').length} non-admin user(s)
                        </span>
                    </div>

                    {/* Table */}
                    {usersLoading ? (
                        <div className="flex justify-center items-center h-32">
                            <Spin size="large" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Current Role</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-52">Access Level</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {users
                                        .filter(u => {
                                            if (u.role === 'Admin') return false; // Admin managed separately
                                            const term = userSearchTerm.toLowerCase();
                                            if (!term) return true;
                                            const emp = u.employeeId;
                                            return (
                                                (emp?.employeeName || '').toLowerCase().includes(term) ||
                                                (u.email || '').toLowerCase().includes(term) ||
                                                (emp?.departmentName || '').toLowerCase().includes(term)
                                            );
                                        })
                                        .map(user => {
                                            const emp = user.employeeId;
                                            const roleColor = 'blue';
                                            return (
                                                <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-tvs-primary/10 flex items-center justify-center text-tvs-primary font-bold text-sm">
                                                                {(emp?.employeeName || user.email || '?').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-gray-800">{emp?.employeeName || '—'}</p>
                                                                <p className="text-xs text-gray-400">{emp?.employeeId || user.userId}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-600">{user.email}</td>
                                                    <td className="px-6 py-3 text-gray-600">{emp?.departmentName || '—'}</td>
                                                    <td className="px-6 py-3">
                                                        <Tag color={roleColor}>{user.role}</Tag>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <Tooltip title="Change access level">
                                                            <Select
                                                                value={user.role}
                                                                loading={roleUpdating[user._id]}
                                                                size="small"
                                                                style={{ width: '100%' }}
                                                                onChange={val => handleRoleChange(user._id, val)}
                                                                options={roles.map(r => ({ value: r.name, label: r.name }))}
                                                            />
                                                        </Tooltip>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                            {users.filter(u => u.role !== 'Admin').length === 0 && !usersLoading && (
                                <div className="text-center py-10 text-gray-400">No users found</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── UI Customization Section ─────────────────────────────────────── */}
            <div className="mt-10">
                <div className="mb-4 flex items-center gap-3">
                    <Sliders className="w-6 h-6 text-tvs-primary" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Interface Customization</h1>
                        <p className="text-gray-600 text-sm">Personalize your portal's theme, fonts, and layout density.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Color Theme */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Palette size={18} className="text-tvs-primary" />
                            <h2 className="text-base font-bold text-gray-800">Color Theme</h2>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            {COLOR_THEMES.map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => applyTheme(t.key)}
                                    title={t.label}
                                    className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all border-2 ${activeTheme === t.key ? 'border-tvs-primary bg-blue-50' : 'border-transparent hover:bg-gray-50'}`}
                                >
                                    <div className="w-full h-8 rounded-md relative overflow-hidden shadow-sm border border-gray-200" style={{ background: t.preview }}>
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: t.accent }} />
                                    </div>
                                    <span className={`text-[10px] font-bold ${activeTheme === t.key ? 'text-tvs-primary' : 'text-gray-500'}`}>
                                        {t.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Font */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Type size={18} className="text-tvs-primary" />
                            <h2 className="text-base font-bold text-gray-800">Typography</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {FONT_OPTIONS.map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => applyFont(f.key)}
                                    style={{ fontFamily: f.style }}
                                    className={`p-3 rounded-lg text-left font-semibold text-sm transition-all border-2 ${activeFont === f.key ? 'border-tvs-primary text-tvs-primary bg-blue-50' : 'border-gray-100 text-gray-600 hover:border-gray-300'}`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Density */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <LayoutIcon size={18} className="text-tvs-primary" />
                            <h2 className="text-base font-bold text-gray-800">Layout Density</h2>
                        </div>
                        <div className="flex flex-col gap-3">
                            {LAYOUT_OPTIONS.map(l => (
                                <button
                                    key={l.key}
                                    onClick={() => applyLayout(l.key)}
                                    className={`flex items-center justify-between p-3 rounded-lg transition-all border-2 ${activeLayout === l.key ? 'border-tvs-primary text-tvs-primary bg-blue-50' : 'border-gray-100 text-gray-600 hover:border-gray-300'}`}
                                >
                                    <span className="font-semibold text-sm">{l.label}</span>
                                    {activeLayout === l.key && <Check size={16} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Audit & Compliance Section ─────────────────────────────────────── */}
            <div className="mt-10">
                <div className="mb-4 flex items-center gap-3">
                    <Shield className="w-6 h-6 text-red-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Audit & Compliance</h1>
                        <p className="text-gray-600 text-sm">Manage deleted records and compliance data</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
                            Soft-Deleted Design Library Logs
                        </h2>
                        <p className="text-sm text-gray-500 max-w-2xl">
                            Download a complete Excel report of all inactive/deleted designs for fraud prevention and auditing purposes. This ensures no designs are permanently lost without a trace.
                        </p>
                    </div>
                    <button
                        onClick={handleExportDeletedDesigns}
                        disabled={exportLoading}
                        className="px-6 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg font-medium transition-all flex items-center gap-2 shrink-0 shadow-sm"
                    >
                        {exportLoading ? <Spin size="small" /> : <FileText size={18} />}
                        Export Excel Report
                    </button>
                </div>
            </div>

            {/* ─── KPI Settings Section ─────────────────────────────────────── */}
            <KPISettingsSection />

            {/* ─── Notification Log Section (Admin Only) ────────────────────── */}
            <NotificationLogSection />
        </div>
    );
};

export default Settings;
