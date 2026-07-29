import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, Edit, Trash2, Mail, Filter as FilterIcon, Download, Eye, Building, MapPin, Upload, FileText } from 'lucide-react';
import ColumnCustomizer from '../../components/ColumnCustomizer';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchVendors, deleteVendor } from '../../redux/slices/vendorSlice';
import { Modal } from 'antd';
import { getApiBaseUrl } from '../../api/axiosConfig';
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import FrozenRowsDataGrid from '../../components/FrozenRowsDataGrid';
import * as XLSX from 'xlsx';
import { createActionColumn } from '../../config/agGridConfig';

const { confirm } = Modal;

const VendorMaster = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const fileInputRef = useRef();

    const { items: vendors, total, totalPages, loading, error } = useSelector((state) => state.vendors);

    const [editingVendor, setEditingVendor] = useState(null);
    const [viewingVendor, setViewingVendor] = useState(null);
    const [isViewModalVisible, setIsViewModalVisible] = useState(false);
    const [isImportModalVisible, setIsImportModalVisible] = useState(false);
    const [importData, setImportData] = useState([]);
    const [columnFilters, setColumnFilters] = useState({});
    const [activeFilterKey, setActiveFilterKey] = useState(null);
    const [filterSearchText, setFilterSearchText] = useState({});
    const [gridWidth, setGridWidth] = useState(0);
    const [frozenKeys, setFrozenKeys] = useState(new Set());
    const [frozenRowCount, setFrozenRowCount] = useState(0);
    const [hiddenKeys, setHiddenKeys] = useState(new Set());
    const [rowHeight, setRowHeight] = useState(48);
    const [headerRowHeight, setHeaderRowHeight] = useState(52);
    const [importErrors, setImportErrors] = useState([]);
    const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);
    const gridContainerRef = useRef(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(50);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        dispatch(fetchVendors({ page: currentPage, limit: pageSize, search: debouncedSearch }));
    }, [dispatch, currentPage, pageSize, debouncedSearch]);

    useEffect(() => {
        if (error) {
            toast.error(typeof error === 'string' ? error : 'An error occurred');
        }
    }, [error]);

    const handleEdit = (vendor) => {
        navigate(`/vendor-master/edit/${vendor._id}`);
    };

    const handleView = (vendor) => {
        setViewingVendor(vendor);
        setIsViewModalVisible(true);
    };

    const handleDelete = (id) => {
        confirm({
            title: 'Delete Vendor',
            content: 'Are you sure you want to delete this vendor?',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk: async () => {
                const result = await dispatch(deleteVendor(id));
                if (deleteVendor.fulfilled.match(result)) {
                    toast.success('Vendor deleted successfully');
                }
            }
        });
    };

    const handleAddVendor = () => {
        navigate('/vendor-master/add');
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
                    vendorCode: row['Vendor Code'] || row['vendorCode'] || row['Code'] || '',
                    vendorName: row['Vendor Name'] || row['vendorName'] || row['Name'] || '',
                    GSTIN: row['GSTIN'] || row['gstin'] || row['Gstin'] || '',
                    vendorLocation: row['Vendor Location'] || row['vendorLocation'] || row['Location'] || row['location'] || '',
                    vendorMailId: row['Vendor Mail ID'] || row['vendorMailId'] || row['Email'] || row['email'] || row['Email Address'] || '',
                    remarks: row['Remarks'] || row['remarks'] || ''
                }));

                // Validate required fields
                const invalidRows = transformedData.filter(
                    (row, idx) => !row.vendorCode || !row.vendorName
                );

                if (invalidRows.length > 0) {
                    toast.error(`${invalidRows.length} rows have missing required fields (Vendor Code or Name)`);
                    return;
                }

                setImportData(transformedData);
                setIsImportModalVisible(true);
                toast.success(`${transformedData.length} vendors ready to import`);
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
            const API_BASE_URL = getApiBaseUrl();
            const token = sessionStorage.getItem('token');

            let successCount = 0;
            let errorCount = 0;
            let errorDetails = [];

            for (const [index, vendor] of importData.entries()) {
                try {
                    const response = await fetch(`${API_BASE_URL}/vendors`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(vendor)
                    });

                    if (response.ok) {
                        successCount++;
                    } else {
                        const errorData = await response.json();
                        errorCount++;
                        errorDetails.push(`Row ${index + 1} (${vendor.vendorCode}): ${errorData.message}`);
                    }
                } catch (err) {
                    errorCount++;
                    errorDetails.push(`Row ${index + 1}: Network error`);
                }
            }

            setIsImportModalVisible(false);
            setImportData([]);
            dispatch(fetchVendors());

            if (successCount > 0) {
                toast.success(`Successfully imported ${successCount} vendor(s)`);
            }
            if (errorCount > 0) {
                setImportErrors(errorDetails);
                setIsErrorModalVisible(true);
            }
        } catch (error) {
            console.error('Import error:', error);
            toast.error('Error importing vendors');
        }
    };

    const handleDownloadTemplate = () => {
        const template = [
            {
                'Vendor Code': 'VEN001',
                'Vendor Name': 'ABC Suppliers Ltd',
                'GSTIN': '29ABCDE1234F1Z5',
                'Vendor Location': 'Bangalore',
                'Vendor Mail ID': 'contact@abcsuppliers.com',
                'Remarks': 'Preferred vendor'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Vendor Template');
        XLSX.writeFile(wb, 'vendor_import_template.xlsx');
        toast.success('Template downloaded successfully');
    };

    const paginatedRows = React.useMemo(() => {
        return (vendors || []).map((row, i) => ({ ...row, _serialNo: (currentPage - 1) * pageSize + i + 1 }));
    }, [vendors, currentPage, pageSize]);

    const PlainHeaderCell = ({ column }) => (
        <div className="h-full w-full flex items-center px-4 text-white">
            <span className="font-bold text-[11px] leading-tight tracking-wide uppercase">{column.name}</span>
        </div>
    );

    const FilterHeaderCell = ({ column }) => {
        const key = column.key;
        const valuesSet = new Set();
        filteredVendors.forEach(row => {
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
                    <FilterIcon size={12} className="!text-white" />
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



    const gridRows = vendors || [];

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
            key: 'vendorCode',
            name: 'VENDOR CODE',
            width: 160,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <span className="font-semibold text-gray-900">{row.vendorCode}</span>
            )
        },
        {
            key: 'vendorName',
            name: 'VENDOR NAME',
            width: 220,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <span className="font-semibold text-gray-900">{row.vendorName}</span>
            )
        },
        {
            key: 'GSTIN',
            name: 'GSTIN',
            width: 200,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <span className="font-mono font-semibold">
                    {row.GSTIN ? row.GSTIN.toUpperCase() : ''}
                </span>
            )
        },
        {
            key: 'vendorLocation',
            name: 'LOCATION',
            width: 180,
            renderHeaderCell: PlainHeaderCell
        },
        {
            key: 'vendorMailId',
            name: 'EMAIL',
            width: 240,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <a
                    href={`mailto:${row.vendorMailId}`}
                    className="text-tvs-primary hover:underline font-medium"
                >
                    {row.vendorMailId}
                </a>
            )
        },
        {
            key: 'remarks',
            name: 'REMARKS',
            width: 260,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <span className="text-gray-500 italic">
                    {row.remarks || 'No remarks'}
                </span>
            )
        },
        {
            key: 'actions',
            name: 'ACTIONS',
            width: 200,
            sortable: false,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => handleView(row)}
                        className="p-2 text-gray-400 hover:text-tvs-primary hover:bg-blue-50 rounded-lg transition-all"
                        title="View Details"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={() => handleEdit(row)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                        title="Edit Vendor"
                    >
                        <Edit size={16} />
                    </button>
                    <button
                        onClick={() => handleDelete(row._id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Vendor"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    const autoFitColumns = React.useMemo(() => {
        const withFreeze = dataGridColumns
            .filter(col => !hiddenKeys.has(col.key))
            .map(col => ({
                ...col,
                frozen: col.key === 'serial' || frozenKeys.has(col.key),
            }));

        if (!gridWidth) return withFreeze;

        const totalDefinedWidth = withFreeze.reduce((sum, column) => {
            return sum + (column.width || 0);
        }, 0);

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
    }, [dataGridColumns, gridWidth, frozenKeys, hiddenKeys]);

    return (
        <div className="flex-1 flex flex-col w-full bg-transparent fade-in">
            <div className="flex-1 bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden flex flex-col">

                {/* ── Premium Toolbar ── */}
                <div className="px-5 pt-4 pb-3 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">

                        {/* Left: count badge + Customize */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '7px 14px', borderRadius: 12,
                                background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                                border: '1px solid #bfdbfe',
                            }}>
                                <Building size={13} style={{ color: '#2563eb', flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
                                    {total || 0}
                                    <span style={{ fontWeight: 500, color: '#3b82f6', marginLeft: 4 }}>vendors</span>
                                </span>
                            </div>
                            <input
                                type="text"
                                placeholder="Search vendors..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-48"
                            />
                            <ColumnCustomizer
                                columns={dataGridColumns}
                                hiddenKeys={hiddenKeys}
                                onChange={setHiddenKeys}
                                gridClass="vendor-master-grid"
                                onDensity={({ rowH, headerH }) => {
                                    setRowHeight(rowH);
                                    setHeaderRowHeight(headerH);
                                }}
                            />
                        </div>

                        {/* Right: action buttons */}
                        <div className="flex flex-wrap items-center gap-2 justify-end">
                            <button onClick={handleDownloadTemplate}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all active:scale-95 hover:scale-[1.02]"
                                style={{ background: 'linear-gradient(135deg, #CC1F1F, #B31818)', boxShadow: '0 2px 10px rgba(204,31,31,0.25)' }}>
                                <Download size={14} /> Template
                            </button>
                            <button onClick={handleAddVendor}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all active:scale-95 hover:scale-[1.02]"
                                style={{ background: 'linear-gradient(135deg, #CC1F1F, #E8413E)', boxShadow: '0 2px 10px rgba(204,31,31,0.3)' }}>
                                <Plus size={14} /> Add Vendor
                            </button>
                            <button onClick={handleImportClick}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all active:scale-95 hover:scale-[1.02]"
                                style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 2px 10px rgba(5,150,105,0.3)' }}>
                                <Upload size={14} /> Import Excel
                            </button>
                            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                                onChange={handleFileUpload} style={{ display: 'none' }} />
                        </div>
                    </div>

                </div>
                {/* ── Grid Container ── */}
                <div className="flex-1 flex flex-col w-full min-h-0">
                    <div
                        ref={gridContainerRef}
                        className="flex-1 flex flex-col w-full min-h-0 bg-white border-t border-gray-200 overflow-hidden"
                        style={{ border: '1px solid #e4e9f2', boxShadow: '0 2px 16px rgba(15,32,64,0.06)', boxSizing: 'border-box' }}
                    >
                        <FrozenRowsDataGrid
                            columns={autoFitColumns}
                            rows={paginatedRows}
                            rowKeyGetter={(row) => row._id || row.vendorCode}
                            className="rdg-light vendor-master-grid"
                            style={{ flex: 1, width: "100%", height: "100%", minHeight: 0 }}
                            rowHeight={rowHeight}
                            headerRowHeight={headerRowHeight}
                            frozenRowCount={frozenRowCount}
                            defaultColumnOptions={{ resizable: true, minWidth: 120 }}
                            loading={loading}
                        />
                    
                        {/* Pagination Controls */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 shrink-0">
                            <div className="text-[11px] font-semibold text-gray-500">
                                Showing {total === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} entries
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
                                        Page {currentPage} / {totalPages || 1}
                                    </span>
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage >= totalPages || total === 0}
                                        className="px-3 py-1 border border-gray-300 rounded text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
</div>
                </div>

                {/* ── Premium Footer ── */}
                <div className="px-5 py-3.5 border-t border-gray-100"
                    style={{ background: 'linear-gradient(90deg, #f8faff 0%, #fff 100%)' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[12px]">
                            <span className="text-gray-400 font-medium">Showing</span>
                            <span className="px-2 py-0.5 rounded-lg font-black text-[#CC1F1F] bg-[#CC1F1F]/10 tabular-nums">{total || 0}</span>
                            <span className="text-gray-400 font-medium">of</span>
                            <span className="px-2 py-0.5 rounded-lg font-black text-gray-700 bg-gray-100 tabular-nums">{total || 0}</span>
                            <span className="text-gray-400 font-medium">vendors</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-bold"
                            style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
                            <Building size={13} className="shrink-0" />
                            {total || 0} total vendors
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
                            📊 Ready to import <span className="text-blue-900 font-bold">{importData.length}</span> vendor(s)
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
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Vendor Code</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Vendor Name</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">GSTIN</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Location</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                {importData.map((vendor, index) => (
                                    <tr key={index} className="hover:bg-gray-50 border-b">
                                        <td className="px-3 py-2 text-gray-700">{index + 1}</td>
                                        <td className="px-3 py-2 text-gray-900 font-semibold">{vendor.vendorCode}</td>
                                        <td className="px-3 py-2 text-gray-900">{vendor.vendorName}</td>
                                        <td className="px-3 py-2 text-gray-700 font-mono">{vendor.GSTIN}</td>
                                        <td className="px-3 py-2 text-gray-700">{vendor.vendorLocation}</td>
                                        <td className="px-3 py-2 text-gray-700">{vendor.vendorMailId}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>

            {/* Import Errors Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 pb-2 border-b border-red-100">
                        <span className="text-xl font-bold text-red-600">Import Failed</span>
                    </div>
                }
                open={isErrorModalVisible}
                onCancel={() => setIsErrorModalVisible(false)}
                footer={[
                    <button
                        key="close"
                        onClick={() => setIsErrorModalVisible(false)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors font-semibold"
                    >
                        Close
                    </button>
                ]}
                width="95%"
                style={{ maxWidth: '600px' }}
                centered
            >
                <div className="py-4">
                    <p className="text-gray-600 mb-4 font-medium">The following vendors could not be imported due to data validation errors. Please fix these issues in your Excel file and try again:</p>
                    <div className="max-h-64 overflow-y-auto bg-red-50 border border-red-100 rounded-lg p-2">
                        <ul className="list-disc pl-5 space-y-1">
                            {importErrors.map((err, i) => (
                                <li key={i} className="text-sm text-red-800 font-medium">{err}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Modal>

            {/* View Vendor Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                        <Building size={20} className="text-tvs-primary" />
                        <span className="text-xl font-bold text-tvs-dark-gray">Vendor Details</span>
                    </div>
                }
                open={isViewModalVisible}
                onCancel={() => {
                    setIsViewModalVisible(false);
                    setViewingVendor(null);
                }}
                footer={null}
                width="95%"
                style={{ maxWidth: '800px' }}
                centered
            >
                {viewingVendor && (
                    <div className="py-6">
                        <div className="bg-white rounded-lg border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-100 flex items-center gap-2">
                                <FileText size={18} className="text-gray-400" />
                                Vendor Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-6">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vendor Code</p>
                                    <p className="text-base font-bold text-gray-900">{viewingVendor.vendorCode}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vendor Name</p>
                                    <p className="text-base font-bold text-gray-900">{viewingVendor.vendorName}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">GSTIN</p>
                                    <p className="text-base font-bold text-gray-900 font-mono">{viewingVendor.GSTIN || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Location</p>
                                    <p className="text-base font-bold text-gray-900">{viewingVendor.vendorLocation || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Address</p>
                                    <p className="text-base font-bold text-gray-900 truncate" title={viewingVendor.vendorMailId}>{viewingVendor.vendorMailId || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Remarks</p>
                                    <p className="text-base font-bold text-gray-900">{viewingVendor.remarks || 'No remarks'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div >
    );
};

export default VendorMaster;
