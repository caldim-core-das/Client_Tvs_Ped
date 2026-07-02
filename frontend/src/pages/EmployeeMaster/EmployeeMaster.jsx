import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, Edit, Trash2, Eye, Shield, User, Filter, Upload, Download } from 'lucide-react';
import ColumnCustomizer from '../../components/ColumnCustomizer';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEmployees, deleteEmployee } from '../../redux/slices/employeeSlice';
import { Modal } from 'antd';
import 'react-data-grid/lib/styles.css';
import * as XLSX from 'xlsx';
import FreezeToolbar from '../../components/FreezeToolbar';
import FrozenRowsDataGrid from '../../components/FrozenRowsDataGrid';
import 'react-data-grid/lib/styles.css';

// AG Grid Modules are registered GLOBALLY in agGridConfig.js

const { confirm } = Modal;


const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '') + '/api';
const DEPT_API = API_BASE_URL + '/departments';

const EmployeeMaster = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const gridRef = useRef();
    const fileInputRef = useRef();

    // Helper Functions for Employee Display
    const getAccessLevelColor = (level) => {
        switch (level?.toLowerCase()) {
            case 'super admin': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'admin': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'manager': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'l1 approver': return 'bg-teal-100 text-teal-700 border-teal-200';
            case 'requester': return 'bg-green-100 text-green-700 border-green-200';
            case 'viewer': return 'bg-gray-100 text-gray-700 border-gray-200';
            default: return 'bg-gray-50 text-gray-600 border-gray-100';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Inactive': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'Suspended': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const countPermissionCount = (permissions) => {
        if (!permissions) return 0;
        return Object.values(permissions).filter(val => val === true).length;
    };

    // Redux State
    const { items: employees, loading, error } = useSelector((state) => state.employees);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [accessFilter, setAccessFilter] = useState('all');
    const [columnFilters, setColumnFilters] = useState({});
    const [activeFilterKey, setActiveFilterKey] = useState(null);
    const [filterSearchText, setFilterSearchText] = useState({});
    const [viewingEmployee, setViewingEmployee] = useState(null);
    const [isViewModalVisible, setIsViewModalVisible] = useState(false);
    const [isImportModalVisible, setIsImportModalVisible] = useState(false);
    const [importData, setImportData] = useState([]);

    const [departments, setDepartments] = useState([]);
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [newDeptName, setNewDeptName] = useState('');
    const [gridWidth, setGridWidth] = useState(0);
    const [frozenKeys, setFrozenKeys] = useState(new Set());
    const [frozenRowCount, setFrozenRowCount] = useState(0);
    const [hiddenKeys, setHiddenKeys] = useState(new Set());
    const [rowHeight, setRowHeight] = useState(44);
    const [headerRowHeight, setHeaderRowHeight] = useState(52);
    const gridContainerRef = useRef(null);


    useEffect(() => {
        dispatch(fetchEmployees());
    }, [dispatch]);

    useEffect(() => {
        if (error) {
            toast.error(typeof error === 'string' ? error : 'An error occurred');
        }
    }, [error]);

    useEffect(() => {
        if (!gridContainerRef.current) return;
        const updateWidth = () => {
            if (gridContainerRef.current) {
                setGridWidth(gridContainerRef.current.clientWidth);
            }
        };
        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(gridContainerRef.current);
        return () => observer.disconnect();
    }, []);

    const handleEdit = (employee) => {
        navigate(`/employee-master/edit/${employee._id}`);
    };

    const handleView = (employee) => {
        setViewingEmployee(employee);
        setIsViewModalVisible(true);
    };

    const handleDelete = (id) => {
        confirm({
            title: 'Delete Employee',
            content: 'Are you sure you want to delete this employee?',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk: async () => {
                const result = await dispatch(deleteEmployee(id));
                if (deleteEmployee.fulfilled.match(result)) {
                    toast.success('Employee deleted successfully');
                }
            }
        });
    };



    const handleAddEmployee = () => {
        navigate('/employee-master/add');
    };

    const handleRefresh = () => {
        dispatch(fetchEmployees());
        toast.success('Refreshing data...');
    };


    const handleExport = () => {
        toast.success('Export feature coming soon...');
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                // Validate and transform data
                const transformedData = jsonData.map((row, index) => ({
                    employeeId: row['Employee ID'] || row['employeeId'] || '',
                    employeeName: row['Employee Name'] || row['employeeName'] || '',
                    departmentName: row['Department'] || row['departmentName'] || '',
                    plantLocation: row['Location'] || row['plantLocation'] || '',
                    role: row['Workflow Role'] || row['role'] || row['Role'] || undefined,
                    accessLevel: row['Access Level'] || row['accessLevel'] || 'Employee',
                    mailId: row['Email'] || row['mailId'] || '',
                    status: row['Status'] || row['status'] || 'Active',
                    password: row['Password'] || row['password'] || 'default123',
                    permissions: {
                        dashboard: row['Dashboard'] === 'Yes' || row['Dashboard'] === true || false,
                        assetRequest: row['Asset Request'] === 'Yes' || row['Asset Request'] === true || false,
                        requestTracker: row['Request Tracker'] === 'Yes' || row['Request Tracker'] === true || false,
                        assetSummary: row['Asset Summary'] === 'Yes' || row['Asset Summary'] === true || false,
                        employeeMaster: row['Employee Master'] === 'Yes' || row['Employee Master'] === true || false,
                        vendorMaster: row['Vendor Master'] === 'Yes' || row['Vendor Master'] === true || false,
                        settings: row['Settings'] === 'Yes' || row['Settings'] === true || false,
                        reports: row['Reports'] === 'Yes' || row['Reports'] === true || false
                    }
                }));

                // Validate required fields
                const invalidRows = transformedData.filter(
                    (row, idx) => !row.employeeId || !row.employeeName || !row.mailId
                );

                if (invalidRows.length > 0) {
                    toast.error(`${invalidRows.length} rows have missing required fields (Employee ID, Name, or Email)`);
                    return;
                }

                setImportData(transformedData);
                setIsImportModalVisible(true);
                toast.success(`${transformedData.length} employees ready to import`);
            } catch (error) {
                console.error('Error parsing file:', error);
                toast.error('Error parsing file. Please check the format.');
            }
        };

        reader.readAsArrayBuffer(file);
        event.target.value = ''; // Reset file input
    };

    const handleConfirmImport = async () => {
        try {
            const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '') + '/api';
            const token = sessionStorage.getItem('token');

            let successCount = 0;
            let errorCount = 0;

            for (const employee of importData) {
                try {
                    const response = await fetch(`${API_BASE_URL}/employees`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(employee)
                    });

                    if (response.ok) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (err) {
                    errorCount++;
                }
            }

            setIsImportModalVisible(false);
            setImportData([]);
            dispatch(fetchEmployees());

            if (successCount > 0) {
                toast.success(`Successfully imported ${successCount} employee(s)`);
            }
            if (errorCount > 0) {
                toast.error(`Failed to import ${errorCount} employee(s)`);
            }
        } catch (error) {
            console.error('Import error:', error);
            toast.error('Error importing employees');
        }
    };

    const handleDownloadTemplate = () => {
        const template = [
            {
                'Employee ID': 'EMP001',
                'Employee Name': 'John Doe',
                'Department': 'Engineering',
                'Location': 'Plant A',
                'Workflow Role': 'L1 Approver',
                'Access Level': 'Employee',
                'Email': 'john.doe@example.com',
                'Status': 'Active',
                'Password': 'default123',
                'Dashboard': 'Yes',
                'Asset Request': 'Yes',
                'Request Tracker': 'Yes',
                'Asset Summary': 'No',
                'Employee Master': 'No',
                'Vendor Master': 'No',
                'Settings': 'No',
                'Reports': 'No'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Employee Template');
        XLSX.writeFile(wb, 'employee_import_template.xlsx');
        toast.success('Template downloaded successfully');
    };

    const filteredEmployees = (employees || []).filter(emp => {
        const matchesSearch =
            String(emp.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(emp.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(emp.departmentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(emp.mailId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(emp.plantLocation || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
        const matchesAccess = accessFilter === 'all' || emp.accessLevel === accessFilter;

        return matchesSearch && matchesStatus && matchesAccess;
    });

    const applyColumnFilters = (rows) => {
        if (!columnFilters || Object.keys(columnFilters).length === 0) return rows;

        return rows.filter(row =>
            Object.entries(columnFilters).every(([key, values]) => {
                if (!values || values.length === 0) return true;
                const value = row[key];
                const str = value == null ? '' : String(value);
                return values.includes(str);
            })
        );
    };

    const PlainHeaderCell = ({ column }) => (
        <div className="h-full w-full flex items-center px-4 text-white">
            <span className="font-bold text-[11px] leading-tight tracking-wide uppercase">{column.name}</span>
        </div>
    );

    const FilterHeaderCell = ({ column }) => {
        const key = column.key;
        const valuesSet = new Set();
        filteredEmployees.forEach(row => {
            const value = row[key];
            const str = value == null ? '' : String(value);
            valuesSet.add(str);
        });
        const values = Array.from(valuesSet).sort((a, b) => a.localeCompare(b));

        const searchValue = filterSearchText[key] || '';
        const rawSelected = columnFilters[key];
        const selectedValues = rawSelected === undefined ? values : rawSelected;

        const visibleValues = values.filter(v =>
            v.toLowerCase().includes(searchValue.toLowerCase())
        );

        const toggleValue = (value) => {
            const strValue = value;
            setColumnFilters(prev => {
                const base = prev[key] === undefined ? values : prev[key];
                const exists = base.includes(strValue);
                const next = exists ? base.filter(v => v !== strValue) : [...base, strValue];
                const updated = { ...prev };

                if (next.length === values.length) {
                    delete updated[key];
                } else {
                    updated[key] = next;
                }

                return updated;
            });
            setActiveFilterKey(null);
        };

        const handleSelectAll = () => {
            setColumnFilters(prev => {
                const clone = { ...prev };
                delete clone[key];
                return clone;
            });
        };

        const handleClear = () => {
            setColumnFilters(prev => {
                const clone = { ...prev };
                delete clone[key];
                return clone;
            });
            setFilterSearchText(prev => {
                const clone = { ...prev };
                delete clone[key];
                return clone;
            });
        };

        const hasFilter = rawSelected !== undefined;

        return (
            <div className="relative h-full w-full flex items-center justify-between px-3 gap-1">
                <div className="flex-1 min-w-0">
                    <span className="font-bold text-[11px] leading-tight tracking-wide uppercase truncate !text-white">{column.name}</span>
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveFilterKey(prev => (prev === key ? null : key));
                    }}
                    className={`ml-1 p-1 rounded flex-shrink-0 transition-colors ${hasFilter ? '!bg-white/30 !border !border-white/50' : 'hover:!bg-white/20 !border !border-transparent'}`}
                >
                    <Filter size={12} className="!text-white" />
                </button>
                {activeFilterKey === key && (
                    <div className="absolute z-50 top-full right-0 mt-1 w-56 !bg-white !border !border-gray-200 !rounded-xl !shadow-2xl p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-3 py-2 !bg-gray-50 !border-b !border-gray-200 flex items-center justify-between">
                            <span className="text-[10px] font-bold !text-gray-700 uppercase tracking-wider">{column.name}</span>
                            <div className="flex gap-2">
                                <button type="button" onClick={handleSelectAll} className="text-[10px] font-bold !text-blue-600 hover:!text-blue-800 transition-colors">Select All</button>
                                <button type="button" onClick={handleClear} className="text-[10px] font-bold !text-red-600 hover:!text-red-800 transition-colors">Clear</button>
                            </div>
                        </div>
                        <div className="p-2 !border-b !border-gray-200 !bg-white">
                            <input
                                type="text"
                                value={searchValue}
                                onChange={(e) => setFilterSearchText(prev => ({ ...prev, [key]: e.target.value }))}
                                placeholder="Search..."
                                className="w-full !border !border-gray-300 !rounded-md px-2 py-1.5 text-xs focus:outline-none focus:!ring-2 focus:!ring-blue-500/50 focus:!border-blue-500 transition-all !text-gray-900 !bg-white placeholder:!text-gray-400"
                            />
                        </div>
                        <div className="max-h-48 overflow-y-auto p-1 !bg-white">
                            {visibleValues.map(value => {
                                const label = (value && String(value).trim()) ? String(value) : '(Blank)';
                                const checked = selectedValues.includes(value);
                                return (
                                    <label key={label} className="flex items-center gap-2 px-2 py-1.5 hover:!bg-blue-50 !rounded cursor-pointer transition-colors m-0">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleValue(value)}
                                            className="w-3.5 h-3.5 !text-blue-600 !rounded !border-gray-300 focus:!ring-blue-500"
                                        />
                                        <span className="text-xs !text-gray-800 truncate select-none leading-none pt-0.5">{label}</span>
                                    </label>
                                );
                            })}
                            {visibleValues.length === 0 && (
                                <div className="text-xs !text-gray-500 text-center py-4 !bg-white">No matching values</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };



    const gridRows = applyColumnFilters(filteredEmployees).map((row, i) => ({ ...row, _serialNo: i + 1 }));
    const [currentPage, setCurrentPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(50);
    const paginatedRows = React.useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return gridRows.slice(start, start + pageSize);
    }, [gridRows, currentPage, pageSize]);

    const dataGridColumns = [
        {
            key: 'serial',
            name: 'S.NO',
            width: 80,
            frozen: true,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <span className="font-semibold text-gray-700">{row._serialNo}</span>
            )
        },
        {
            key: 'employeeId',
            name: 'EMPLOYEE ID',
            width: 140,
            renderHeaderCell: FilterHeaderCell,
            renderCell: ({ row }) => (
                <span className="font-semibold text-gray-900">{row.employeeId}</span>
            )
        },
        {
            key: 'employeeName',
            name: 'EMPLOYEE NAME',
            width: 200,
            renderHeaderCell: FilterHeaderCell,
            renderCell: ({ row }) => (
                <span className="font-semibold text-gray-900">{row.employeeName}</span>
            )
        },
        {
            key: 'departmentName',
            name: 'DEPARTMENT',
            width: 150,
            renderHeaderCell: FilterHeaderCell
        },
        {
            key: 'plantLocation',
            name: 'LOCATION',
            width: 140,
            renderHeaderCell: FilterHeaderCell
        },
        {
            key: 'role',
            name: 'WORKFLOW ROLE',
            width: 160,
            renderHeaderCell: FilterHeaderCell,
            renderCell: ({ row }) => (
                <span className="font-bold text-gray-800 text-[11px] uppercase tracking-wide">
                    {row.role || 'Requester'}
                </span>
            )
        },

        {
            key: 'mailId',
            name: 'EMAIL',
            width: 220,
            renderHeaderCell: FilterHeaderCell,
            renderCell: ({ row }) => (
                <a href={`mailto:${row.mailId}`} className="text-tvs-primary hover:underline font-medium">
                    {row.mailId}
                </a>
            )
        },
        {
            key: 'status',
            name: 'STATUS',
            width: 130,
            renderHeaderCell: FilterHeaderCell,
            renderCell: ({ row }) => (
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border inline-block ${getStatusColor(row.status)}`}>
                    {row.status}
                </span>
            )
        },
        {
            key: 'actions',
            name: 'ACTIONS',
            width: 150,
            sortable: false,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%' }}>
                    {/* View */}
                    <button
                        onClick={() => handleView(row)}
                        title="View Details"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            padding: '4px 8px', borderRadius: '7px', cursor: 'pointer',
                            border: '1px solid #bfdbfe', background: '#EFF6FF',
                            color: '#1d4ed8', fontSize: '11px', fontWeight: 700,
                            transition: 'all 0.12s', lineHeight: 1,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#DBEAFE'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                    >
                        <Eye size={12} />
                    </button>
                    {/* Edit */}
                    <button
                        onClick={() => handleEdit(row)}
                        title="Edit Employee"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            padding: '4px 8px', borderRadius: '7px', cursor: 'pointer',
                            border: '1px solid #bbf7d0', background: '#F0FDF4',
                            color: '#15803d', fontSize: '11px', fontWeight: 700,
                            transition: 'all 0.12s', lineHeight: 1,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#DCFCE7'; e.currentTarget.style.borderColor = '#86efac'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F0FDF4'; e.currentTarget.style.borderColor = '#bbf7d0'; }}
                    >
                        <Edit size={12} />
                    </button>
                    {/* Delete */}
                    <button
                        onClick={() => handleDelete(row._id)}
                        title="Delete Employee"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            padding: '4px 8px', borderRadius: '7px', cursor: 'pointer',
                            border: '1px solid #fecaca', background: '#FEF2F2',
                            color: '#dc2626', fontSize: '11px', fontWeight: 700,
                            transition: 'all 0.12s', lineHeight: 1,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#fecaca'; }}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            )
        }
    ];

    useEffect(() => {
        if (!gridContainerRef.current) return;

        const updateWidth = () => {
            if (gridContainerRef.current) {
                setGridWidth(gridContainerRef.current.clientWidth);
            }
        };

        updateWidth();

        const observer = new ResizeObserver(updateWidth);
        observer.observe(gridContainerRef.current);

        return () => {
            observer.disconnect();
        };
    }, []);

    const freezeColumnList = dataGridColumns
        .filter(col => col.key !== 'serial')
        .map(col => ({ key: col.key, name: col.name }));

    const autoFitColumns = useMemo(() => {
        const withFreeze = dataGridColumns
            .filter(col => !hiddenKeys.has(col.key))
            .map(col => ({
                ...col,
                frozen: col.key === 'serial' || frozenKeys.has(col.key),
            }));
        if (!gridWidth) return withFreeze;
        const totalDefinedWidth = withFreeze.reduce((sum, column) => sum + (column.width || 0), 0);
        if (!totalDefinedWidth) return withFreeze;
        const scale = Math.max(gridWidth / totalDefinedWidth, 1);
        let currentTotal = 0;
        const mapped = withFreeze.map((column, index) => {
            if (!column.width) return column;
            let scaledWidth = Math.max(Math.floor(column.width * scale), column.width, 120);
            
            // If it's the last column, give it all remaining pixels to avoid white gaps
            const gridW = gridWidth || 0;
            if (index === withFreeze.length - 1 && gridW > 0) {
                const remaining = gridW - currentTotal;
                if (remaining > scaledWidth) {
                    scaledWidth = remaining - 2; // -2 for borders
                }
            }
            currentTotal += scaledWidth;
            return { ...column, width: scaledWidth };
        });
        return mapped;
    }, [dataGridColumns, gridWidth, frozenKeys]);


    const frozenRows = gridRows.slice(0, frozenRowCount);

    return (
        <div className="flex-1 flex flex-col w-full bg-transparent fade-in">
            <div className="flex-1 bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden flex flex-col">

                {/* ── Premium Toolbar ── */}
                <div className="px-5 pt-4 pb-3 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">

                        {/* Left: live count badge + Customize button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Record count */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '7px 14px', borderRadius: '12px',
                                background: 'linear-gradient(135deg,#f0fdf4,#ecfdf5)',
                                border: '1px solid #bbf7d0',
                            }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                                    {filteredEmployees?.length || 0}
                                    <span style={{ fontWeight: 500, color: '#059669', marginLeft: 4 }}>employees</span>
                                </span>
                            </div>

                            {/* ── Customize Columns / Colors / Layout ── */}
                            <ColumnCustomizer
                                columns={dataGridColumns}
                                hiddenKeys={hiddenKeys}
                                onChange={setHiddenKeys}
                                gridClass="employee-master-grid"
                                onDensity={({ rowH, headerH }) => {
                                    setRowHeight(rowH);
                                    setHeaderRowHeight(headerH);
                                }}
                            />
                        </div>

                        {/* Right: action buttons */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            {/* Download Template */}
                            <button onClick={handleDownloadTemplate}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                                    padding: '8px 16px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #1e40af, #2563eb)',
                                    boxShadow: '0 2px 8px rgba(30,64,175,0.3)',
                                    color: '#fff', fontSize: '12px', fontWeight: 700,
                                    border: 'none', cursor: 'pointer', transition: 'all 0.12s',
                                    letterSpacing: '0.01em',
                                }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(30,64,175,0.45)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(30,64,175,0.3)'}
                            >
                                <Download size={14} /> Template
                            </button>

                            {/* Add Employee */}
                            <button onClick={handleAddEmployee}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                                    padding: '8px 16px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #CC1F1F, #E8413E)',
                                    boxShadow: '0 2px 8px rgba(204,31,31,0.35)',
                                    color: '#fff', fontSize: '12px', fontWeight: 700,
                                    border: 'none', cursor: 'pointer', transition: 'all 0.12s',
                                    letterSpacing: '0.01em',
                                }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(204,31,31,0.5)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(204,31,31,0.35)'}
                            >
                                <Plus size={14} /> Add Employee
                            </button>

                            {/* Import Excel */}
                            <button onClick={handleImportClick}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                                    padding: '8px 16px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #059669, #10b981)',
                                    boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
                                    color: '#fff', fontSize: '12px', fontWeight: 700,
                                    border: 'none', cursor: 'pointer', transition: 'all 0.12s',
                                    letterSpacing: '0.01em',
                                }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(5,150,105,0.45)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(5,150,105,0.3)'}
                            >
                                <Upload size={14} /> Import Excel
                            </button>
                            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                                onChange={handleFileUpload} style={{ display: 'none' }} />
                        </div>
                    </div>

                    {/* Freeze toolbar — subtle separator */}
                    <div className="pt-1 border-t border-gray-100">
                        <FreezeToolbar
                            columns={freezeColumnList}
                            frozenKeys={frozenKeys}
                            onApply={setFrozenKeys}
                            frozenRowCount={frozenRowCount}
                            setFrozenRowCount={setFrozenRowCount}
                            maxRows={Math.min(gridRows.length, 50)}
                        />
                    </div>
                </div>

                {/* ── Grid Container ── */}
                <div className="flex-1 flex flex-col w-full min-h-0">
                    <div ref={gridContainerRef}
                        className="flex-1 flex flex-col w-full min-h-0 bg-white border-t border-gray-200 overflow-hidden"
                        style={{ border: '1px solid #e4e9f2', boxShadow: '0 2px 16px rgba(15,32,64,0.06)' }}>
                        <FrozenRowsDataGrid
                            columns={autoFitColumns}
                            rows={paginatedRows}
                            rowKeyGetter={(row) => row._id || row.employeeId}
                            className="rdg-light employee-master-grid"
                            style={{ flex: 1, width: "100%", height: "100%", minHeight: 0 }}
                            rowHeight={rowHeight}
                            headerRowHeight={headerRowHeight}
                            frozenRowCount={frozenRowCount}
                            defaultColumnOptions={{
                                resizable: true, minWidth: 120
                            }}
                            loading={loading}
                        />
                    
                        {/* Pagination Controls */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 shrink-0">
                            <div className="text-[11px] font-semibold text-gray-500">
                                Showing {gridRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, gridRows.length)} of {gridRows.length} entries
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-500 font-medium">Rows per page:</span>
                                    <select 
                                        value={pageSize} 
                                        onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                        className="text-[11px] font-medium border border-gray-300 rounded px-2 py-1 outline-none focus:border-tvs-primary bg-white cursor-pointer hover:border-gray-400 transition-colors"
                                    >
                                        <option value={15}>15</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                                <div className="h-4 w-px bg-gray-300"></div>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 border border-gray-300 rounded text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        Prev
                                    </button>
                                    <span className="text-[11px] font-bold text-gray-600 px-2 min-w-[70px] text-center">
                                        Page {currentPage} / {Math.max(1, Math.ceil(gridRows.length / pageSize))}
                                    </span>
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(gridRows.length / pageSize), p + 1))}
                                        disabled={currentPage >= Math.ceil(gridRows.length / pageSize) || gridRows.length === 0}
                                        className="px-3 py-1 border border-gray-300 rounded text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
</div>
                </div>
            </div>
            {/* ── Premium Footer ── */}
            <div className="px-5 py-3.5 border-t border-gray-100"
                style={{ background: 'linear-gradient(90deg, #f8faff 0%, #fff 100%)' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

                    {/* Count row */}
                    <div className="flex items-center gap-2 text-[12px]">
                        <span className="text-gray-400 font-medium">Showing</span>
                        <span className="px-2 py-0.5 rounded-lg font-black text-[#CC1F1F] bg-[#CC1F1F]/10 tabular-nums">
                            {filteredEmployees?.length || 0}
                        </span>
                        <span className="text-gray-400 font-medium">of</span>
                        <span className="px-2 py-0.5 rounded-lg font-black text-gray-700 bg-gray-100 tabular-nums">
                            {employees?.length || 0}
                        </span>
                        <span className="text-gray-400 font-medium">employees</span>
                    </div>

                    {/* Status legend + permission count */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {[
                            { dot: '#10b981', label: 'Active', bg: '#f0fdf4', bdr: '#bbf7d0', txt: '#065f46' },
                            { dot: '#f59e0b', label: 'Inactive', bg: '#fffbeb', bdr: '#fde68a', txt: '#92400e' },
                            { dot: '#ef4444', label: 'Suspended', bg: '#fef2f2', bdr: '#fecaca', txt: '#991b1b' },
                        ].map(s => (
                            <div key={s.label}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[11px] font-semibold"
                                style={{ background: s.bg, borderColor: s.bdr, color: s.txt }}>
                                <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.dot }} />
                                {s.label}
                            </div>
                        ))}
                        <div className="flex items-center gap-2 px-3 py-1 rounded-lg border text-[11px] font-bold"
                            style={{ background: '#f5f3ff', borderColor: '#ddd6fe', color: '#5b21b6' }}>
                            <Shield size={12} className="shrink-0" />
                            {(employees || []).reduce((acc, emp) => acc + countPermissionCount(emp.permissions), 0)}
                            <span className="font-medium">permissions</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Import Preview Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                        <Upload size={20} className="text-emerald-600" />
                        <span className="text-xl font-bold text-gray-900">Import Preview</span>
                    </div>
                }
                open={isImportModalVisible}
                onCancel={() => {
                    setIsImportModalVisible(false);
                    setImportData([]);
                }}
                onOk={handleConfirmImport}
                okText="Confirm Import"
                cancelText="Cancel"
                width="95%"
                style={{ maxWidth: '1000px' }}
                centered
                okButtonProps={{
                    className: 'bg-emerald-600 hover:bg-emerald-700'
                }}
            >
                <div className="py-4">
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800 font-semibold">
                            📊 Ready to import <span className="text-blue-900 font-bold">{importData.length}</span> employee(s)
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                            Review the data below and click "Confirm Import" to proceed.
                        </p>
                    </div>

                    <div className="max-h-96 overflow-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">#</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Employee ID</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Name</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Email</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Department</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Access Level</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {importData.map((emp, index) => (
                                    <tr key={index} className="hover:bg-gray-50 border-b">
                                        <td className="px-3 py-2 text-gray-700">{index + 1}</td>
                                        <td className="px-3 py-2 text-gray-900 font-semibold">{emp.employeeId}</td>
                                        <td className="px-3 py-2 text-gray-900">{emp.employeeName}</td>
                                        <td className="px-3 py-2 text-gray-700">{emp.mailId}</td>
                                        <td className="px-3 py-2 text-gray-700">{emp.departmentName}</td>
                                        <td className="px-3 py-2 text-gray-700">{emp.accessLevel}</td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${emp.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {emp.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>

            {/* View Employee Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                        <User size={20} className="text-tvs-primary" />
                        <span className="text-xl font-bold text-tvs-dark-gray">Employee Details</span>
                    </div>
                }
                open={isViewModalVisible}
                onCancel={() => {
                    setIsViewModalVisible(false);
                    setViewingEmployee(null);
                }}
                footer={null}
                width="95%"
                style={{ maxWidth: '800px' }}
                centered
            >
                {viewingEmployee && (
                    <div className="py-6">
                        <div className="bg-white rounded-lg border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-100 flex items-center gap-2">
                                <Shield size={18} className="text-gray-400" />
                                Basic Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-6">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee ID</p>
                                    <p className="text-base font-bold text-gray-900">{viewingEmployee.employeeId}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Full Name</p>
                                    <p className="text-base font-bold text-gray-900">{viewingEmployee.employeeName}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Address</p>
                                    <p className="text-base font-bold text-gray-900 truncate" title={viewingEmployee.mailId}>{viewingEmployee.mailId}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Department</p>
                                    <p className="text-base font-bold text-gray-900">{viewingEmployee.departmentName || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Plant Location</p>
                                    <p className="text-base font-bold text-gray-900">{viewingEmployee.plantLocation || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Access Level</p>
                                    <div>
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getAccessLevelColor(viewingEmployee.accessLevel)}`}>
                                            {viewingEmployee.accessLevel}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</p>
                                    <div>
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(viewingEmployee.status)}`}>
                                            {viewingEmployee.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Created On</p>
                                    <p className="text-base font-bold text-gray-900">{formatDate(viewingEmployee.createdAt)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Updated</p>
                                    <p className="text-base font-bold text-gray-900">{formatDate(viewingEmployee.updatedAt)}</p>
                                </div>
                            </div>

                            <h3 className="text-lg font-semibold text-gray-900 mt-10 mb-6 pb-2 border-b border-gray-100 flex items-center gap-2">
                                <Shield size={18} className="text-gray-400" />
                                Permissions Summary
                            </h3>
                            <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-tvs-primary">
                                        <Shield size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">System Access Modules</p>
                                        <p className="text-xs text-gray-500">Current active permissions for this user</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-bold text-tvs-primary">
                                        {countPermissionCount(viewingEmployee.permissions)}
                                    </span>
                                    <span className="text-sm font-medium text-gray-400 ml-1">/ 8 granted</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div >
    );
};

export default EmployeeMaster;