import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Switch } from 'antd';
import { Save, Eye, EyeOff, ArrowLeft, AlertCircle, Shield, Key, Lock, Settings, RefreshCw, CheckCircle2, XCircle, Home, FileText, ClipboardList, TrendingUp, Layout, Inbox, PenTool, CheckSquare, Award, Package, Palette, Users, Layers, PieChart, BarChart2, FilePlus, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../api/axiosConfig';
import { createEmployee, updateEmployee, fetchEmployeeById, fetchUserByEmployeeId, checkIdAvailability } from '../../redux/slices/employeeSlice';

const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func(...args);
        }, delay);
    };
};

const permissionList = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home size={20} />, description: 'View dashboard overview' },
    { id: 'mhRequest', label: 'MH Request', icon: <FileText size={20} />, description: 'Material Handling Request' },
    { id: 'allRequestsOverview', label: 'All Requests Overview', icon: <ClipboardList size={20} />, description: 'Overview of all requests' },
    { id: 'mhDevelopment', label: 'MH Development', icon: <TrendingUp size={20} />, description: 'Development tracking' },
    { id: 'projectPlanTracking', label: 'Project Plan Tracking', icon: <Layout size={20} />, description: 'Project Plan Tracking' },
    
    { id: 'l1ApprovalQueue', label: 'L1 Approval Queue', icon: <Inbox size={20} />, description: 'L1 Approvals' },
    { id: 'designQueue', label: 'Design Queue', icon: <PenTool size={20} />, description: 'Design Queue' },
    { id: 'checkerQueue', label: 'Checker Queue', icon: <CheckSquare size={20} />, description: 'Checker Queue' },
    { id: 'finalApproval', label: 'Final Approval', icon: <Award size={20} />, description: 'Final Approval' },
    
    { id: 'assetManagement', label: 'Asset Management', icon: <Package size={20} />, description: 'Manage Assets' },
    { id: 'assetSummary', label: 'Asset Summary', icon: <ClipboardList size={20} />, description: 'Asset Summary' },
    { id: 'designLibrary', label: 'Design Library', icon: <Palette size={20} />, description: 'Design Library' },
    
    { id: 'employeeMaster', label: 'Employee Master', icon: <Users size={20} />, description: 'Manage employees' },
    { id: 'vendorMaster', label: 'Vendor Master', icon: <Layers size={20} />, description: 'Manage vendors' },
    { id: 'vendorScoring', label: 'Vendor Scoring', icon: <PieChart size={20} />, description: 'Vendor Scoring' },
    { id: 'vendorLoading', label: 'Vendor Loading', icon: <BarChart2 size={20} />, description: 'Vendor Loading' },
    
    { id: 'settings', label: 'Settings', icon: <Settings size={20} />, description: 'System configuration' }
];

const EmployeeForm = ({ mode = 'add' }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { loading, currentItem } = useSelector((state) => state.employees);

    const [formData, setFormData] = useState({
        employeeId: '',
        employeeName: '',
        departmentName: '',
        plantLocation: '',
        role: 'Requester',
        accessLevel: 'Requester',   // kept for backend compatibility, synced from role
        mailId: '',
        password: '',
        confirmPassword: '',
        status: 'Active'
    });

    const [availableRoles, setAvailableRoles] = useState([]);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [isAddingRole, setIsAddingRole] = useState(false);

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            const { data } = await api.get('/roles');
            setAvailableRoles(data);
        } catch (error) {
            toast.error('Failed to load roles');
        }
    };

    const handleAddRole = async () => {
        if (!newRoleName.trim()) return;
        setIsAddingRole(true);
        try {
            const { data } = await api.post('/roles', { name: newRoleName.trim() });
            setAvailableRoles(prev => [...prev, data]);
            setFormData(prev => ({ ...prev, role: data.name }));
            setIsRoleModalOpen(false);
            setNewRoleName('');
            toast.success('Role added successfully');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add role');
        } finally {
            setIsAddingRole(false);
        }
    };

    // Permissions state
    const [permissions, setPermissions] = useState({
        dashboard: true,
        mhRequest: false,
        allRequestsOverview: false,
        mhDevelopment: false,
        projectPlanTracking: false,
        l1ApprovalQueue: false,
        designQueue: false,
        checkerQueue: false,
        finalApproval: false,
        assetManagement: false,
        assetSummary: false,
        designLibrary: false,
        employeeMaster: false,
        vendorMaster: false,
        vendorScoring: false,
        vendorLoading: false,
        settings: false
    });

    // Error state
    const [errors, setErrors] = useState({});

    // State for password toggle and debounce
    const [updatePassword, setUpdatePassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Password Strength & Generation Logic
    const [sendingEmail, setSendingEmail] = useState(false);

    const handleSendPasswordEmail = async () => {
        if (!formData.mailId) {
            toast.error('Please enter an email address first');
            return;
        }
        if (!formData.password || formData.password === '********') {
            toast.error('Please enter or generate a password first');
            return;
        }
        
        setSendingEmail(true);
        try {
            const body = `
                <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                    <h2 style="color: #d32f2f;">Welcome to TVS Portal</h2>
                    <p>Hi ${formData.employeeName || 'Employee'},</p>
                    <p>Your account credentials have been set up for the TVS portal.</p>
                    <p><strong>Login Details:</strong></p>
                    <ul>
                        <li><strong>Employee ID:</strong> ${formData.employeeId || 'N/A'}</li>
                        <li><strong>Email ID:</strong> ${formData.mailId}</li>
                        <li><strong>Password:</strong> ${formData.password}</li>
                    </ul>
                    <p>Please log in using these credentials. We recommend changing your password after your first login.</p>
                    <br/>
                    <p>Best regards,<br/>TVS Admin Team</p>
                </div>
            `;
            
            await api.post('/email/send', {
                to: formData.mailId,
                subject: 'Your TVS Portal Login Credentials',
                body: body
            });
            toast.success('Password sent to employee successfully!');
        } catch (error) {
            toast.error('Failed to send email');
        } finally {
            setSendingEmail(false);
        }
    };

    const calculateStrength = (pass) => {
        if (!pass) return 0;
        let strength = 0;
        if (pass.length >= 8) strength += 25;
        if (/[A-Z]/.test(pass)) strength += 25;
        if (/[0-9]/.test(pass)) strength += 25;
        if (/[^A-Za-z0-9]/.test(pass)) strength += 25;
        return strength;
    };

    const generateRandomPassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
        let pass = "";
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (!/[A-Z]/.test(pass)) pass += "A";
        if (!/[0-9]/.test(pass)) pass += "1";
        if (!/[^A-Za-z0-9]/.test(pass)) pass += "@";
        
        setFormData(prev => ({ ...prev, password: pass, confirmPassword: pass }));
        navigator.clipboard.writeText(pass);
        toast.success("Secure password generated & copied to clipboard!");
    };

    const strength = calculateStrength(formData.password);
    const rules = {
        length: formData.password?.length >= 8,
        upper: /[A-Z]/.test(formData.password || ''),
        number: /[0-9]/.test(formData.password || ''),
        special: /[^A-Za-z0-9]/.test(formData.password || '')
    };

    const renderPasswordFields = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="block text-sm font-medium text-gray-700">
                            {mode === 'edit' ? 'New Password *' : 'Password *'}
                        </label>
                        <button
                            type="button"
                            onClick={generateRandomPassword}
                            className="text-[11px] font-bold text-tvs-primary hover:text-red-700 flex items-center gap-1 bg-red-50 px-2 py-1 rounded transition-colors"
                        >
                            <RefreshCw size={12} /> Auto-Generate
                        </button>
                    </div>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className={`w-full px-4 py-2.5 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all ${errors.password ? 'border-red-300 bg-red-50/30' : 'border-gray-300 bg-gray-50/30 hover:bg-white'}`}
                            placeholder="Enter password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="text-sm text-red-600 flex items-center gap-1.5 mt-1.5 font-medium">
                            <AlertCircle size={14} /> {errors.password}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        {mode === 'edit' ? 'Confirm New Password *' : 'Confirm Password *'}
                    </label>
                    <div className="relative">
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className={`w-full px-4 py-2.5 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all ${errors.confirmPassword ? 'border-red-300 bg-red-50/30' : 'border-gray-300 bg-gray-50/30 hover:bg-white'}`}
                            placeholder="Re-enter password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                    </div>
                    {errors.confirmPassword && (
                        <p className="text-sm text-red-600 flex items-center gap-1.5 mt-1.5 font-medium">
                            <AlertCircle size={14} /> {errors.confirmPassword}
                        </p>
                    )}
                </div>
            </div>

            {/* Advanced Password Strength UI */}
            <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-bold text-gray-700">Password Strength</span>
                    <span className={`text-[11px] font-black uppercase tracking-wider ${strength < 50 ? 'text-red-500' : strength < 100 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {strength === 0 ? 'None' : strength < 50 ? 'Weak' : strength < 100 ? 'Good' : 'Strong'}
                    </span>
                </div>
                <div className="flex gap-1 mb-4">
                    {[1, 2, 3, 4].map(idx => (
                        <div key={idx} className={`h-1.5 w-full rounded-full transition-colors duration-500 ${strength >= idx * 25 ? (strength === 100 ? 'bg-emerald-500' : strength >= 50 ? 'bg-amber-400' : 'bg-red-500') : 'bg-gray-200'}`} />
                    ))}
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    <div className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${rules.length ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {rules.length ? <CheckCircle2 size={13} /> : <XCircle size={13} className="opacity-40" />} 8+ Characters
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${rules.upper ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {rules.upper ? <CheckCircle2 size={13} /> : <XCircle size={13} className="opacity-40" />} Uppercase Letter
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${rules.number ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {rules.number ? <CheckCircle2 size={13} /> : <XCircle size={13} className="opacity-40" />} Number
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${rules.special ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {rules.special ? <CheckCircle2 size={13} /> : <XCircle size={13} className="opacity-40" />} Special Character
                    </div>
                </div>
            </div>


        </div>
    );

    // Debounce check ID
    // We use a ref to keep the debounce function stable across renders
    const debouncedCheckId = React.useRef(
        debounce(async (id) => {
            if (!id) return;
            const result = await dispatch(checkIdAvailability(id));
            if (checkIdAvailability.fulfilled.match(result)) {
                if (result.payload.exists) {
                    setErrors(prev => ({ ...prev, employeeId: 'Employee ID already exists' }));
                } else {
                    setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.employeeId;
                        return newErrors;
                    });
                }
            }
        }, 500)
    ).current;

    useEffect(() => {
        if (mode === 'edit' && id) {
            dispatch(fetchEmployeeById(id));
        }
        // Removed fetchNextEmployeeId for 'add' mode as it is now manual entry
    }, [dispatch, id, mode]);

    useEffect(() => {
        if (mode === 'edit' && currentItem) {

            const loadUserData = async () => {
                try {
                    // Dispatch Redux action to fetch user details
                    await dispatch(fetchUserByEmployeeId(currentItem.employeeId));
                    // We don't need to check result or set dummy password here anymore
                    // Password fields will remain empty and hidden until toggle is switched

                    setFormData({
                        employeeId: currentItem.employeeId,
                        employeeName: currentItem.employeeName,
                        departmentName: currentItem.departmentName,
                        plantLocation: currentItem.plantLocation,
                        accessLevel: currentItem.accessLevel,
                        role: currentItem.role || 'Requester',
                        mailId: currentItem.mailId,
                        password: '', // Kept empty
                        confirmPassword: '',
                        status: currentItem.status
                    });
                } catch (err) {
                    console.error("Error loading user data:", err);
                    setFormData({
                        employeeId: currentItem.employeeId,
                        employeeName: currentItem.employeeName,
                        departmentName: currentItem.departmentName,
                        plantLocation: currentItem.plantLocation,
                        accessLevel: currentItem.accessLevel,
                        role: currentItem.role || 'Requester',
                        mailId: currentItem.mailId,
                        password: '',
                        confirmPassword: '',
                        status: currentItem.status
                    });
                }
            };

            loadUserData();

            if (currentItem.permissions) {
                setPermissions(currentItem.permissions);
            }
        }
    }, [currentItem, mode, dispatch]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }

        // Debounce check for employeeId
        if (name === 'employeeId') {
            debouncedCheckId(value);
        }
    };

    const handlePermissionToggle = (permissionId) => {
        setPermissions(prev => ({
            ...prev,
            [permissionId]: !prev[permissionId]
        }));
    };

    const handleGrantAllPermissions = () => {
        const allTrue = {};
        permissionList.forEach(p => allTrue[p.id] = true);
        setPermissions(allTrue);
    };

    const handleRevokeAllPermissions = () => {
        const allFalse = {};
        permissionList.forEach(p => allFalse[p.id] = false);
        setPermissions(allFalse);
    };

    const validateForm = () => {
        const newErrors = {};
        const isEditMode = !!id;
        if (!formData.employeeId.trim() && isEditMode) newErrors.employeeId = 'Employee ID is required';
        if (!formData.employeeName.trim()) newErrors.employeeName = 'Full Name is required';
        if (!formData.mailId.trim()) newErrors.mailId = 'Email is required';

        if (formData.mailId && !/\S+@\S+\.\S+/.test(formData.mailId)) {
            newErrors.mailId = 'Please enter a valid email';
        }

        if (mode === 'add') {
            if (!formData.password) newErrors.password = 'Password is required';
            if (!formData.confirmPassword) newErrors.confirmPassword = 'Confirm Password is required';
        } else if (mode === 'edit' && updatePassword) {
            if (!formData.password) newErrors.password = 'Password is required';
            if (!formData.confirmPassword) newErrors.confirmPassword = 'Confirm Password is required';
        }

        if (formData.password && formData.password !== '********') {
            if (formData.password.length < 8) {
                newErrors.password = 'Password must be at least 8 characters';
            }

            if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {

        e.preventDefault();

        if (!validateForm()) {
            toast.error("Please check the form for errors");
            return;
        }

        const payload = {
            employeeId: formData.employeeId,
            employeeName: formData.employeeName,
            departmentName: formData.departmentName,
            plantLocation: formData.plantLocation,
            accessLevel: formData.accessLevel,
            role: formData.role,
            mailId: formData.mailId,
            status: formData.status,
            permissions: permissions
        };

        // Only include password if provided and changed from dummy value
        if (formData.password && formData.password !== '********') {
            payload.password = formData.password;
        }

        const action = mode === 'edit'
            ? updateEmployee({ id, employeeData: payload })
            : createEmployee(payload);

        const result = await dispatch(action);

        if (createEmployee.fulfilled.match(result) || updateEmployee.fulfilled.match(result)) {
            toast.success(`Employee ${mode === 'edit' ? 'updated' : 'added'} successfully!`);
            navigate('/employee-master');
        } else {
            const serverError = result.payload;
            if (serverError && typeof serverError === 'string') {
                toast.error(serverError);

                if (serverError.includes('Employee ID already exists')) {
                    setErrors(prev => ({ ...prev, employeeId: 'Employee ID already exists' }));
                } else if (serverError.includes('Email already registered')) {
                    setErrors(prev => ({ ...prev, mailId: 'Email already registered' }));
                }
            } else {
                toast.error(`Failed to ${mode === 'edit' ? 'update' : 'add'} employee`);
            }
        }
    };

    if (loading && mode === 'edit' && !currentItem) {
        return (
            <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tvs-primary mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading employee data...</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-tvs-border overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-tvs-border bg-gray-50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/employee-master')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} className="text-gray-600" />
                    </button>
                    <h1 className="text-xl font-bold text-tvs-dark-gray m-0">
                        {mode === 'add' ? 'Add New Employee' : `Edit Employee: ${formData.employeeId}`}
                    </h1>
                </div>

            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
                {/* Basic Information Section */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                        Basic Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Employee ID - Manual Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Employee ID *
                            </label>
                            <input
                                type="text"
                                name="employeeId"
                                value={formData.employeeId}
                                onChange={handleChange}
                                className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.employeeId ? 'border-red-300' : 'border-gray-300'}`}
                                placeholder="Enter Employee ID (e.g. EMP001)"
                                required
                            />
                            {errors.employeeId && (
                                <p className="text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle size={14} /> {errors.employeeId}
                                </p>
                            )}
                        </div>

                        {/* Full Name */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Full Name *
                            </label>
                            <input
                                type="text"
                                name="employeeName"
                                value={formData.employeeName}
                                onChange={handleChange}
                                className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.employeeName ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="John Doe"
                                required
                            />
                            {errors.employeeName && (
                                <p className="text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle size={14} /> {errors.employeeName}
                                </p>
                            )}
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Email *
                            </label>
                            <input
                                type="email"
                                name="mailId"
                                value={formData.mailId}
                                onChange={handleChange}
                                className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.mailId ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="john.doe@example.com"
                                required
                            />
                            {errors.mailId && (
                                <p className="text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle size={14} /> {errors.mailId}
                                </p>
                            )}
                        </div>

                        {/* Department */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Department Name
                            </label>
                            <input
                                type="text"
                                name="departmentName"
                                value={formData.departmentName}
                                onChange={handleChange}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter Department"
                            />
                        </div>

                        {/* Location */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Plant Location
                            </label>
                            <input
                                type="text"
                                name="plantLocation"
                                value={formData.plantLocation}
                                onChange={handleChange}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter Plant Location"
                            />
                        </div>

                        {/* Role (replaces legacy Access Level) */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Role
                            </label>
                            <div className="flex gap-2">
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const legacyMap = {
                                            'Admin': 'Admin',
                                            'L1 Approver': 'Manager',
                                            'PED Engineer': 'Manager',
                                            'Requester': 'Requester'
                                        };
                                        setFormData(prev => ({
                                            ...prev,
                                            role: val,
                                            accessLevel: legacyMap[val] || 'Requester'
                                        }));
                                    }}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {availableRoles.length > 0 ? (
                                        availableRoles.map(r => (
                                            <option key={r._id || r.name} value={r.name}>{r.name}</option>
                                        ))
                                    ) : (
                                        <>
                                            <option value="Requester">Requester</option>
                                            <option value="L1 Approver">L1 Approver</option>
                                            <option value="PED Engineer">PED Engineer</option>
                                            <option value="Admin">Admin</option>
                                        </>
                                    )}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setIsRoleModalOpen(true)}
                                    className="px-3 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                                    title="Add new role"
                                >
                                    <FilePlus size={18} />
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                L1 Approver — receives MH request emails &nbsp;|&nbsp; PED Engineer — gets assigned to requests
                            </p>
                        </div>

                        {/* Password Section */}
                        {mode === 'edit' ? (
                            <div className="md:col-span-2 lg:col-span-3 mt-4 mb-2">
                                <div className={`border rounded-xl transition-all duration-300 ${updatePassword ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-gray-50/50'} overflow-hidden shadow-sm`}>
                                    <div 
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => setUpdatePassword(!updatePassword)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-lg transition-colors ${updatePassword ? 'bg-red-100 text-red-600' : 'bg-white border border-gray-200 text-gray-500 shadow-sm'}`}>
                                                <Key size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-[15px] font-bold text-gray-900">Change Password</h4>
                                                <p className="text-[12px] text-gray-500 mt-0.5">Click the toggle switch on the right to update credentials</p>
                                            </div>
                                        </div>
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <Switch
                                                checked={updatePassword}
                                                onChange={(checked) => setUpdatePassword(checked)}
                                                style={{ backgroundColor: updatePassword ? '#cc1f1f' : undefined }}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className={`transition-all duration-500 ease-in-out ${updatePassword ? 'max-h-[500px] opacity-100 border-t border-red-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                                        <div className="p-5 bg-white">
                                            {renderPasswordFields()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="md:col-span-2 lg:col-span-3 mt-4 mb-2">
                                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <div className="p-4 flex items-center gap-4 bg-gray-50/50 border-b border-gray-100">
                                        <div className="p-2.5 rounded-lg bg-white border border-gray-200 text-gray-500 shadow-sm">
                                            <Key size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-[15px] font-bold text-gray-900">Account Password</h4>
                                            <p className="text-[12px] text-gray-500 mt-0.5">Set up initial employee login credentials</p>
                                        </div>
                                    </div>
                                    <div className="p-5">
                                        {renderPasswordFields()}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Status */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Status
                            </label>
                            <div className="flex gap-4">
                                {['Active', 'Inactive', 'Suspended'].map(status => (
                                    <label key={status} className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            name="status"
                                            value={status}
                                            checked={formData.status === status}
                                            onChange={handleChange}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-2">{status}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* System Permissions Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">System Permissions</h3>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleGrantAllPermissions}
                                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                                    permissionList.every(p => permissions[p.id])
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Grant All
                            </button>
                            <button
                                type="button"
                                onClick={handleRevokeAllPermissions}
                                className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Revoke All
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {permissionList.map((permission) => (
                            <div
                                key={permission.id}
                                className={`p-3 border rounded-lg flex items-center justify-between cursor-pointer transition-all ${permissions[permission.id]
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                onClick={() => handlePermissionToggle(permission.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{permission.icon}</span>
                                    <div>
                                        <div className="font-medium text-gray-900">{permission.label}</div>
                                        <div className="text-xs text-gray-500">{permission.description}</div>
                                    </div>
                                </div>
                                <div className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${permissions[permission.id] ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'
                                    }`}>
                                    <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Permission Summary */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">
                                    Permissions Summary:
                                </span>
                            </div>
                            <span className="font-semibold text-tvs-primary">
                                {Object.values(permissions).filter(Boolean).length} of {permissionList.length} permissions granted
                            </span>
                        </div>
                    </div>
                </div>

                {/* Form Actions */}
                <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/employee-master')}
                        className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSendPasswordEmail}
                        disabled={sendingEmail || !formData.password || formData.password === '********'}
                        className="flex items-center gap-2 bg-blue-50 text-blue-600 px-5 py-2.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50 font-medium"
                    >
                        {sendingEmail ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        ) : (
                            <Send size={18} />
                        )}
                        {sendingEmail ? 'Sending...' : 'Send Password via Email'}
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center bg-tvs-primary !text-white px-5 py-2.5 rounded-lg font-medium shadow-sm hover:bg-opacity-90 transform active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                        <Save size={18} style={{ marginRight: '0.5rem' }} />
                        {loading ? 'Saving...' : (mode === 'edit' ? 'Update Employee' : 'Save Employee')}
                    </button>
                </div>
            </form>

            {/* Add Role Modal */}
            {isRoleModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">Add Custom Role</h3>
                            <button
                                onClick={() => setIsRoleModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="p-5">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Role Name
                            </label>
                            <input
                                type="text"
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                placeholder="e.g. Maintenance"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Note: Custom roles are used for categorization. System-level workflows still depend on specific roles.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setIsRoleModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddRole}
                                disabled={isAddingRole || !newRoleName.trim()}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
                            >
                                {isAddingRole ? 'Adding...' : 'Add Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeForm;