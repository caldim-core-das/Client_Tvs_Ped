import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Upload, FileText, X, Download, Filter, Eye } from 'lucide-react';
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import FreezeToolbar from '../components/FreezeToolbar';
import FrozenRowsDataGrid from '../components/FrozenRowsDataGrid';
import ColumnCustomizer from '../components/ColumnCustomizer';

import { getApiBaseUrl } from '../api/axiosConfig';

const API_BASE_URL = getApiBaseUrl();

const AssetManagementUpdate = () => {
    const { user } = useAuth();
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentAsset, setCurrentAsset] = useState(null);
    const [currentViewAsset, setCurrentViewAsset] = useState(null);
    const [vendors, setVendors] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [columnFilters, setColumnFilters] = useState({});
    const [activeFilterKey, setActiveFilterKey] = useState(null);
    const [filterSearchText, setFilterSearchText] = useState({});
    const [gridWidth, setGridWidth] = useState(0);
    const [acceptedRequests, setAcceptedRequests] = useState([]);
    const [trackers, setTrackers] = useState([]);
    const [selectedRequestId, setSelectedRequestId] = useState('');
    const [generating, setGenerating] = useState(false);
    const [generatedAssetId, setGeneratedAssetId] = useState('');
    const [frozenKeys, setFrozenKeys] = useState(new Set());
    const [frozenRowCount, setFrozenRowCount] = useState(0);
    const [hiddenKeys, setHiddenKeys] = useState(new Set());
    const [rowHeight, setRowHeight] = useState(44);
    const [headerRowHeight, setHeaderRowHeight] = useState(52);

    const gridContainerRef = useRef(null);

    // Form state
    const [formData, setFormData] = useState({
        vendorCode: '',
        vendorName: '',
        departmentName: '',
        plantLocation: '',
        assetLocation: '',
        assetName: ''
    });
    const [signOffDocument, setSignOffDocument] = useState(null);
    const [drawing, setDrawing] = useState(null);

    useEffect(() => {
        fetchAssets();
        fetchVendors();
        fetchDepartments();
        fetchAcceptedRequests();
        fetchTrackers();

        if (user && user.departmentName) {
            setFormData(prev => ({ ...prev, departmentName: user.departmentName }));
        }
    }, []);

    const fetchAssets = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/asset-management`);
            setAssets(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching assets:', error);
            setLoading(false);
        }
    };

    const fetchAcceptedRequests = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/asset-request`);
            const data = Array.isArray(response.data) ? response.data : [];
            const accepted = data.filter(req => req.status === 'Accepted');
            setAcceptedRequests(accepted);
        } catch (error) {
            console.error('Error fetching asset requests:', error);
        }
    };

    const fetchTrackers = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/mh-development-tracker`);
            const data = response.data?.data || response.data || [];
            setTrackers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching trackers:', error);
        }
    };

    const fetchVendors = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/asset-management/vendors/list`);
            // Deduplicate: VendorScoring has multiple records per vendor (one per scoring month).
            // Keep only the first occurrence of each vendorCode for the dropdown.
            const seen = new Set();
            const unique = (Array.isArray(response.data) ? response.data : []).filter(v => {
                if (seen.has(v.vendorCode)) return false;
                seen.add(v.vendorCode);
                return true;
            });
            setVendors(unique);
        } catch (error) {
            console.error('Error fetching vendors:', error);
        }
    };

    const fetchDepartments = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/asset-management/departments/list`);
            setDepartments(response.data);
        } catch (error) {
            console.error('Error fetching departments:', error);
        }
    };

    const handleVendorChange = (vendorCode) => {
        const selectedVendor = vendors.find(v => v.vendorCode === vendorCode);
        if (selectedVendor) {
            setFormData(prev => ({
                ...prev,
                vendorCode: selectedVendor.vendorCode,
                vendorName: selectedVendor.vendorName,
                plantLocation: selectedVendor.location
            }));
        }
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e, fileType) => {
        const file = e.target.files[0];
        if (fileType === 'signOffDocument') {
            setSignOffDocument(file);
        } else if (fileType === 'drawing') {
            setDrawing(file);
        }
    };

    const handleAcceptedRequestChange = (value) => {
        setSelectedRequestId(value);
        const selected = acceptedRequests.find(r => r._id === value);
        if (selected) {
            // Look up the MHDevelopmentTracker for this request to get the allocated vendor
            const tracker = trackers.find(t => t.assetRequestId === selected.mhRequestId);

            // Prefer tracker vendor (explicitly allocated in MH Dev Tracker)
            // Fall back to assignedVendor on the MH Request itself
            const assignedV = selected.assignedVendor;
            const resolvedVendorCode = tracker?.vendorCode || assignedV?.vendorCode || '';
            const resolvedVendorName = tracker?.vendorName || assignedV?.vendorName || '';
            const resolvedVendorLocation = tracker?.vendorLocation || assignedV?.location || '';

            setFormData(prev => ({
                ...prev,
                vendorCode: resolvedVendorCode || prev.vendorCode,
                vendorName: resolvedVendorName || prev.vendorName,
                departmentName: selected.departmentName || prev.departmentName,
                plantLocation: selected.plantLocation || resolvedVendorLocation || prev.plantLocation,
                assetLocation: selected.materialHandlingLocation || selected.location || prev.assetLocation,
                assetName: selected.handlingPartName || selected.productModel || prev.assetName
            }));
        } else {
            // Reset all auto-filled fields when request is cleared
            setFormData(prev => ({
                ...prev,
                vendorCode: '',
                vendorName: '',
                departmentName: user?.departmentName || '',
                plantLocation: '',
                assetLocation: '',
                assetName: ''
            }));
        }
    };

    const openAddModal = () => {
        setEditMode(false);
        setCurrentAsset(null);
        setFormData({
            vendorCode: '',
            vendorName: '',
            departmentName: user?.departmentName || '',
            plantLocation: '',
            assetLocation: '',
            assetName: ''
        });
        setSignOffDocument(null);
        setDrawing(null);
        setSelectedRequestId('');
        setGeneratedAssetId('');
        setShowModal(true);
    };

    const openEditModal = (asset) => {
        setEditMode(true);
        setCurrentAsset(asset);
        setFormData({
            vendorCode: asset.vendorCode,
            vendorName: asset.vendorName,
            departmentName: asset.departmentName,
            plantLocation: asset.plantLocation,
            assetLocation: asset.assetLocation,
            assetName: asset.assetName
        });
        setSignOffDocument(null);
        setDrawing(null);
        setShowModal(true);
    };

    const openViewModal = (asset) => {
        setCurrentViewAsset(asset);
        setShowViewModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const formDataToSend = new FormData();
        Object.keys(formData).forEach(key => {
            formDataToSend.append(key, formData[key]);
        });

        if (signOffDocument) {
            formDataToSend.append('signOffDocument', signOffDocument);
        }
        if (drawing) {
            formDataToSend.append('drawing', drawing);
        }

        try {
            let response;
            if (editMode) {
                response = await axios.put(`${API_BASE_URL}/api/asset-management/${currentAsset._id}`, formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                response = await axios.post(`${API_BASE_URL}/api/asset-management`, formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            fetchAssets();
            setShowModal(false);
            
            const returnedAssetId = response?.data?.assetId || '';
            if (returnedAssetId) {
                toast.success(`Asset ID ${returnedAssetId} ${editMode ? 'updated' : 'created'} successfully`);
            } else {
                toast.success(editMode ? 'Asset updated successfully' : 'Asset created successfully');
            }
        } catch (error) {
            console.error('Error saving asset:', error);
            toast.error(error.response?.data?.message || 'Error saving asset');
        }
    };

    const handleGenerateFromRequest = async () => {
        if (!selectedRequestId) {
            toast.error('Please select an accepted request');
            return;
        }

        try {
            setGenerating(true);
            const response = await axios.post(`${API_BASE_URL}/api/asset-request/${selectedRequestId}/generate-asset`);
            const updatedRequest = response.data;
            const allocationId = updatedRequest && updatedRequest.allocationAssetId;
            if (allocationId) {
                setGeneratedAssetId(allocationId);
            } else {
                setGeneratedAssetId('');
            }
            await fetchAssets();
            await fetchAcceptedRequests();
            if (allocationId) {
                toast.success(`Asset ID ${allocationId} generated successfully`);
            } else {
                toast.success('Asset ID generated successfully');
            }
        } catch (error) {
            console.error('Error generating asset from request:', error);
            toast.error(error.response?.data?.message || 'Error generating asset from request');
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = async (asset) => {
        if (!window.confirm(`Are you sure you want to delete ${asset.assetName}?`)) return;

        try {
            await axios.delete(`${API_BASE_URL}/api/asset-management/${asset._id}`);
            fetchAssets();
            toast.success('Asset deleted successfully');
        } catch (error) {
            console.error('Error deleting asset:', error);
            toast.error('Error deleting asset');
        }
    };

    const handleDeleteFile = async (asset, fileType) => {
        if (!window.confirm(`Delete this ${fileType === 'signOffDocument' ? 'sign-off document' : 'drawing'}?`)) return;

        try {
            await axios.delete(`${API_BASE_URL}/api/asset-management/${asset._id}/file/${fileType}`);
            fetchAssets();
            toast.success('File deleted successfully');
        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error('Error deleting file');
        }
    };

    const downloadFile = (filePath, filename) => {
        window.open(`${API_BASE_URL}/${filePath}`, '_blank');
    };



    // File Renderer Component
    const FileRenderer = ({ data, fileType }) => {
        const file = data[fileType];
        const displayName = fileType === 'signOffDocument' ? 'Sign-off' : 'Drawing';

        if (!file || !file.filename) {
            return <span className="text-gray-400 text-xs">No file</span>;
        }

        return (
            <div className="flex items-center gap-2">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(file.path, file.filename);
                    }}
                    className="p-1 rounded hover:bg-blue-100 transition-colors"
                    title={`Download ${displayName}`}
                >
                    <Download size={14} className="text-blue-600" />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(data, fileType);
                    }}
                    className="p-1 rounded hover:bg-red-100 transition-colors"
                    title={`Delete ${displayName}`}
                >
                    <Trash2 size={14} className="text-red-600" />
                </button>
                <span className="text-xs text-gray-600 truncate max-w-[100px]" title={file.filename}>
                    {file.filename}
                </span>
            </div>
        );
    };

    const baseRows = assets || [];

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

    const gridRows = applyColumnFilters(baseRows).map((row, i) => ({ ...row, _serialNo: i + 1 }));
    const [currentPage, setCurrentPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(50);
    const paginatedRows = React.useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return gridRows.slice(start, start + pageSize);
    }, [gridRows, currentPage, pageSize]);

    const PlainHeaderCell = ({ column }) => (
        <div className="h-full w-full flex items-center px-4 text-white">
            <span className="font-bold text-[11px] leading-tight tracking-wide uppercase">{column.name}</span>
        </div>
    );

    const FilterHeaderCell = ({ column }) => {
        const key = column.key;
        const valuesSet = new Set();
        baseRows.forEach(row => {
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
            key: 'assetId',
            name: 'ASSET ID',
            width: 120,
            renderHeaderCell: FilterHeaderCell,
            renderCell: ({ row }) => (
                <span className="font-semibold text-gray-900">{row.assetId}</span>
            )
        },
        {
            key: 'vendorName',
            name: 'VENDOR NAME',
            width: 180,
            renderHeaderCell: FilterHeaderCell
        },
        {
            key: 'departmentName',
            name: 'DEPARTMENT',
            width: 150,
            renderHeaderCell: FilterHeaderCell
        },
        {
            key: 'plantLocation',
            name: 'PLANT LOCATION',
            width: 150,
            renderHeaderCell: FilterHeaderCell
        },
        {
            key: 'assetLocation',
            name: 'ASSET LOCATION',
            width: 150,
            renderHeaderCell: FilterHeaderCell
        },
        {
            key: 'assetName',
            name: 'ASSET NAME',
            width: 180,
            renderHeaderCell: FilterHeaderCell
        },
        {
            key: 'signOffDocument',
            name: 'SIGN-OFF DOC',
            width: 180,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <FileRenderer data={row} fileType="signOffDocument" />
            )
        },
        {
            key: 'drawing',
            name: 'DRAWING',
            width: 180,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <FileRenderer data={row} fileType="drawing" />
            )
        },
        {
            key: 'actions',
            name: 'ACTIONS',
            width: 120,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => openViewModal(row)}
                        className="p-1.5 rounded-lg hover:bg-green-100 transition-colors text-green-600"
                        title="View"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={() => openEditModal(row)}
                        className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors text-blue-600"
                        title="Edit"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => handleDelete(row)}
                        className="p-1.5 rounded-lg hover:bg-red-100 transition-colors text-red-600"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    const freezeColumnList = dataGridColumns
        .filter(col => col.key !== 'serial' && col.key !== 'actions')
        .map(col => ({ key: col.key, name: col.name }));

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

        return withFreeze.map((column) => {
            if (!column.width) return column;
            const scaledWidth = Math.max(Math.floor(column.width * scale), column.width, 120);

            return {
                ...column,
                width: scaledWidth
            };
        });
    }, [dataGridColumns, gridWidth, frozenKeys, hiddenKeys]);

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

    return (
        <div className="flex-1 flex flex-col w-full bg-transparent fade-in">
            <div className="flex-1 bg-white rounded-xl shadow border border-gray-200 overflow-hidden flex flex-col">
                <div className="px-6 py-4 flex flex-col gap-4">
                    <div className="flex justify-between items-center bg-gradient-to-r from-white to-gray-50 px-6 py-4 rounded-xl border border-gray-200/80 shadow-sm gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-sm font-bold text-gray-700">
                                    Total Assets: <span className="text-emerald-700">{assets.length}</span>
                                </span>
                            </div>
                        </div>
                        <div>
                            <button
                                onClick={openAddModal}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-tvs-primary to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg font-semibold text-sm transform hover:scale-105 active:scale-95"
                            >
                                <Plus size={18} />
                                Add Asset
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <ColumnCustomizer
                            columns={dataGridColumns}
                            hiddenKeys={hiddenKeys}
                            onChange={setHiddenKeys}
                            gridClass="asset-management-grid"
                            onDensity={({ rowH, headerH }) => {
                                setRowHeight(rowH);
                                setHeaderRowHeight(headerH);
                            }}
                        />
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

                <div className="flex-1 flex flex-col w-full min-h-0">
                    <div ref={gridContainerRef} className="flex-1 flex flex-col w-full min-h-0 bg-white border-t border-gray-200 overflow-hidden">
                        <FrozenRowsDataGrid
                            columns={autoFitColumns}
                            rows={paginatedRows}
                            rowKeyGetter={(row) => row._id || row.assetId}
                            className="rdg-light asset-management-grid"
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

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center z-modal">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editMode ? 'Edit Asset' : 'Add New Asset'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {!editMode && (
                                <div className="flex flex-col gap-2 mb-2">
                                    <div className="flex items-end gap-3">
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                                                Select Accepted Request
                                            </label>
                                            <select
                                                value={selectedRequestId}
                                                onChange={(e) => handleAcceptedRequestChange(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-tvs-primary bg-white"
                                            >
                                                <option value="">Select Accepted Request</option>
                                                {acceptedRequests.map(request => (
                                                    <option key={request._id} value={request._id}>
                                                        {request.mhRequestId} - {request.departmentName} - {request.productModel}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleGenerateFromRequest}
                                            disabled={!selectedRequestId || generating}
                                            className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-sm whitespace-nowrap transition-colors ${!selectedRequestId || generating
                                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                }`}
                                        >
                                            {generating ? 'Generating...' : 'Generate Asset ID'}
                                        </button>
                                        {generatedAssetId && (
                                            <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-lg whitespace-nowrap">
                                                <span className="text-emerald-500 font-bold text-sm">✓</span>
                                                <span className="text-xs font-bold text-emerald-700">{generatedAssetId}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                {/* Vendor */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        Vendor <span className="text-red-500">*</span>
                                        {selectedRequestId && formData.vendorCode && (
                                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                ✓ Auto-filled from MH Development Tracker
                                            </span>
                                        )}
                                    </label>

                                    {selectedRequestId && formData.vendorCode ? (
                                        /* Read-only vendor display card — shown when a request is selected */
                                        <div className="flex items-center gap-4 px-4 py-3 bg-emerald-50 border border-emerald-300 rounded-lg">
                                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center">
                                                <span className="text-emerald-700 font-black text-sm">V</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-emerald-800 truncate">{formData.vendorName}</p>
                                                <p className="text-xs text-emerald-600 font-semibold">{formData.vendorCode}</p>
                                            </div>
                                            {/* Hidden inputs ensure vendorCode & vendorName are submitted */}
                                            <input type="hidden" name="vendorCode" value={formData.vendorCode} />
                                            <input type="hidden" name="vendorName" value={formData.vendorName} />
                                        </div>
                                    ) : (
                                        /* Normal dropdown — shown when no request is selected */
                                        <select
                                            value={formData.vendorCode}
                                            onChange={(e) => handleVendorChange(e.target.value)}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        >
                                            <option value="">Select Vendor</option>
                                            {vendors.map(vendor => (
                                                <option key={vendor.vendorCode} value={vendor.vendorCode}>
                                                    {vendor.vendorName} ({vendor.vendorCode})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Department */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        Department <span className="text-red-500">*</span>
                                        {selectedRequestId && formData.departmentName && (
                                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                ✓ Auto-filled from MH Request
                                            </span>
                                        )}
                                    </label>
                                    <select
                                        name="departmentName"
                                        value={formData.departmentName}
                                        onChange={handleInputChange}
                                        className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${selectedRequestId && formData.departmentName
                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                                            : 'bg-gray-50 border-gray-300'
                                            }`}
                                        required
                                        disabled={!!(user?.departmentName && !selectedRequestId)}
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Plant Location (Auto-filled from Vendor) */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Plant Location <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="plantLocation"
                                        value={formData.plantLocation}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50"
                                        readOnly
                                        required
                                    />
                                </div>

                                {/* Asset Location */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Asset Location <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="assetLocation"
                                        value={formData.assetLocation}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter asset location"
                                        required
                                    />
                                </div>

                                {/* Asset Name */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Asset Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="assetName"
                                        value={formData.assetName}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter asset name"
                                        required
                                    />
                                </div>

                                {/* Sign-off Document */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Sign-off Document
                                        <span className="text-xs text-gray-500 ml-2">(PDF, Word)</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx"
                                        onChange={(e) => handleFileChange(e, 'signOffDocument')}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {editMode && currentAsset?.signOffDocument && (
                                        <div className="mt-2 text-xs text-gray-600">
                                            Current: {currentAsset.signOffDocument.filename}
                                        </div>
                                    )}
                                </div>

                                {/* Drawing */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Drawing
                                        <span className="text-xs text-gray-500 ml-2">(PNG, JPG, PDF, Word)</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx"
                                        onChange={(e) => handleFileChange(e, 'drawing')}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {editMode && currentAsset?.drawing && (
                                        <div className="mt-2 text-xs text-gray-600">
                                            Current: {currentAsset.drawing.filename}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-tvs-primary text-white rounded-lg hover:bg-opacity-90 transition-colors font-semibold shadow-sm"
                                >
                                    {editMode ? 'Update' : 'Create'} Asset
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {showViewModal && currentViewAsset && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto transform transition-all">
                        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-gray-200 flex justify-between items-center z-10">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Asset Details</h2>
                                <p className="text-xs text-gray-500 mt-1">ID: {currentViewAsset.assetId}</p>
                            </div>
                            <button
                                onClick={() => setShowViewModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                            >
                                <X size={20} className="text-gray-500 group-hover:text-gray-800" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Name</label>
                                    <div className="font-medium text-gray-900">{currentViewAsset.vendorName || '-'}</div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</label>
                                    <div className="font-medium text-gray-900">{currentViewAsset.departmentName || '-'}</div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plant Location</label>
                                    <div className="font-medium text-gray-900">{currentViewAsset.plantLocation || '-'}</div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset Location</label>
                                    <div className="font-medium text-gray-900">{currentViewAsset.assetLocation || '-'}</div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset Name</label>
                                    <div className="font-medium text-gray-900">{currentViewAsset.assetName || '-'}</div>
                                </div>
                            </div>
                            <div className="mt-8 pt-6 border-t border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-800 mb-4">Attachments</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sign-Off Document</div>
                                        <div className="mt-1">
                                            {currentViewAsset.signOffDocument?.filename ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-gray-800 truncate" title={currentViewAsset.signOffDocument.filename}>
                                                        {currentViewAsset.signOffDocument.filename}
                                                    </span>
                                                    <button
                                                        onClick={() => downloadFile(currentViewAsset.signOffDocument.path, currentViewAsset.signOffDocument.filename)}
                                                        className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                                                        title="Download"
                                                    >
                                                        <Download size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">No file attached</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Drawing</div>
                                        <div className="mt-1">
                                            {currentViewAsset.drawing?.filename ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-gray-800 truncate" title={currentViewAsset.drawing.filename}>
                                                        {currentViewAsset.drawing.filename}
                                                    </span>
                                                    <button
                                                        onClick={() => downloadFile(currentViewAsset.drawing.path, currentViewAsset.drawing.filename)}
                                                        className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                                                        title="Download"
                                                    >
                                                        <Download size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">No file attached</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .asset-management-grid.rdg-light {
                    width: 100%;
                    height: 100%;
                    border: none;
                }
                .asset-management-grid .rdg-row .rdg-cell {
                    border-inline: none;
                    padding-block: 12px;
                    padding-inline: 16px;
                    font-size: 13px;
                }
                .asset-management-grid .rdg-row:not(.rdg-row-selected) .rdg-cell {
                    border-bottom: 1px solid #f1f5f9;
                }
                .asset-management-grid .rdg-row:hover .rdg-cell {
                    background-color: #f8fafc;
                }
                .asset-management-grid .rdg-header-row .rdg-cell {
                    padding-block: 14px;
                    padding-inline: 16px;
                    font-weight: 700;
                    border-inline: none;
                    border-bottom: 2px solid #e2e8f0;
                    position: relative;
                    font-size: 12px;
                    background-color: #CC1F1F;
                    color: #ffffff;
                }
            `}</style>
        </div>
    );
};

export default AssetManagementUpdate;
