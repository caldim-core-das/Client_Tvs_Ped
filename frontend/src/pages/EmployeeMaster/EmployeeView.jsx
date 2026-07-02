import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Building, MapPin, Shield, User, Calendar, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEmployeeById } from '../../redux/slices/employeeSlice';

const EmployeeView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { currentItem: employee, loading, error } = useSelector((state) => state.employees);

    useEffect(() => {
        if (id) {
            dispatch(fetchEmployeeById(id));
        }
    }, [dispatch, id]);

    useEffect(() => {
        if (error) {
            toast.error('Failed to load employee details');
        }
    }, [error]);

    const fetchEmployeeData = () => {
        dispatch(fetchEmployeeById(id));
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'inactive': return 'bg-yellow-100 text-yellow-800';
            case 'suspended': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getAccessLevelColor = (level) => {
        switch (level?.toLowerCase()) {
            case 'super admin': return 'bg-purple-100 text-purple-800';
            case 'admin': return 'bg-blue-100 text-blue-800';
            case 'manager': return 'bg-indigo-100 text-indigo-800';
            case 'l1 approver': return 'bg-teal-100 text-teal-800';
            case 'requester': return 'bg-green-100 text-green-800';
            case 'viewer': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading employee details...</p>
            </div>
        );
    }

    if (!employee) {
        return (
            <div className="p-8 text-center">
                <p className="text-gray-600">Employee not found</p>
                <button
                    onClick={() => navigate('/employee-master')}
                    className="mt-4 text-blue-600 hover:underline"
                >
                    Back to Employee List
                </button>
            </div>
        );
    }

    const details = [
        { label: 'Employee ID', value: employee.employeeId, icon: User },
        { label: 'Full Name', value: employee.employeeName, icon: User },
        { label: 'Email', value: employee.mailId, icon: Mail },
        { label: 'Department', value: employee.departmentName, icon: Building },
        { label: 'Plant Location', value: employee.plantLocation, icon: MapPin },
        { label: 'Workflow Role', value: employee.role || 'Requester', icon: Shield, badge: true },
        { label: 'Status', value: employee.status, icon: Shield, badge: true },
        { label: 'Created', value: formatDate(employee.createdAt), icon: Calendar },
        { label: 'Last Updated', value: formatDate(employee.updatedAt), icon: Calendar },
    ];

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/employee-master')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} className="text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">
                                Employee Details: {employee.employeeId}
                            </h1>
                            <p className="text-sm text-gray-600">View complete employee information</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate(`/employee-master/edit/${employee._id}`)}
                        className="flex items-center bg-tvs-primary !text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-opacity-90 transform active:scale-95 transition-all"
                    >
                        <Edit size={18} className="mr-2" /> Edit Employee
                    </button>
                </div>
            </div>

            {/* Profile Section */}
            <div className="p-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                        Basic Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {details.map((item, index) => (
                            <div key={index} className="space-y-1">
                                <div className="flex items-center text-sm text-gray-500">
                                    <item.icon size={16} className="mr-2" />
                                    {item.label}
                                </div>
                                {item.badge ? (
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${item.label === 'Workflow Role' ? getAccessLevelColor(item.value) : getStatusColor(item.value)}`}>
                                        {item.value}
                                    </span>
                                ) : (
                                    <p className="text-lg font-medium text-gray-900">{item.value || 'N/A'}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Employee ID: {employee.employeeId}</span>
                    <span>Last updated: {formatDate(employee.updatedAt)}</span>
                </div>
            </div>
        </div>
    );
};

export default EmployeeView;