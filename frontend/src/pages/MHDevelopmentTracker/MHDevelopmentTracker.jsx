import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Modal, Form, Input, Select, DatePicker, Button, Upload } from 'antd';
import { Download, Upload as UploadIcon, Edit, Trash2, Filter, Pin } from 'lucide-react';
import ColumnCustomizer from '../../components/ColumnCustomizer';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import {
    fetchTrackers,
    updateTracker,
    deleteTracker,
    uploadDrawing,
    clearError,
    clearSuccess
} from '../../redux/slices/mhDevelopmentTrackerSlice';
import { fetchAssetRequests } from '../../redux/slices/assetRequestSlice';
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import FreezeToolbar from '../../components/FreezeToolbar';
import FrozenRowsDataGrid from '../../components/FrozenRowsDataGrid';
import VendorSelectionPopup from './VendorSelectionPopup';
import ProjectPlanModal from './ProjectPlanModal';

const { Option } = Select;
const { TextArea } = Input;

const mapMilestoneIndexToStage = (index, totalLength) => {
    if (index == null || index < 0) return 'Not Started';
    if (index >= totalLength - 1) return 'Completed';
    if (index <= 2) return 'Design';
    if (index === 3) return 'PR/PO';
    if (index === 4 || index === 5) return 'Sample Production';
    if (index === 6 || index === 7) return 'Production Ready';
    return 'Completed';
};

const deriveCurrentStageFromMilestones = (milestones) => {
    if (!Array.isArray(milestones) || milestones.length === 0) return 'Not Started';

    let lastCompletedIndex = -1;
    milestones.forEach((m, index) => {
        if (m.actualEnd) lastCompletedIndex = index;
    });

    if (lastCompletedIndex === -1) {
        const firstStartedIndex = milestones.findIndex(m => m.actualStart);
        if (firstStartedIndex === -1) return 'Not Started';
        return mapMilestoneIndexToStage(firstStartedIndex, milestones.length);
    }

    return mapMilestoneIndexToStage(lastCompletedIndex, milestones.length);
};

const deriveStatusFromMilestones = (milestones) => {
    if (!Array.isArray(milestones) || milestones.length === 0) return 'Not Started';

    const anyProgress = milestones.some(m => m.actualStart || m.actualEnd);
    if (!anyProgress) return 'Not Started';

    const today = dayjs().startOf('day');
    let maxDelay = 0;

    milestones.forEach(m => {
        const planEnd = m.planEnd ? dayjs(m.planEnd).startOf('day') : null;
        const actualEnd = m.actualEnd ? dayjs(m.actualEnd).startOf('day') : null;

        if (planEnd && actualEnd) {
            const diff = actualEnd.diff(planEnd, 'day');
            if (!Number.isNaN(diff) && diff > maxDelay) maxDelay = diff;
        } else if (planEnd && !actualEnd) {
            const diff = today.diff(planEnd, 'day');
            if (!Number.isNaN(diff) && diff > maxDelay) maxDelay = diff;
        }
    });

    if (maxDelay <= 0) return 'On Track';
    if (maxDelay <= 7) return 'Likely Delay';
    return 'Delayed';
};

/* Returns the worst (max) delay in days across all milestones */
const deriveMaxDelayDays = (milestones) => {
    if (!Array.isArray(milestones) || milestones.length === 0) return null;

    const today = dayjs().startOf('day');
    let maxDelay = 0;
    let hasAnyPlanDate = false;

    milestones.forEach(m => {
        const planEnd   = m.planEnd   ? dayjs(m.planEnd).startOf('day')   : null;
        const actualEnd = m.actualEnd ? dayjs(m.actualEnd).startOf('day') : null;

        if (planEnd) {
            hasAnyPlanDate = true;
            const diff = actualEnd
                ? actualEnd.diff(planEnd, 'day')
                : today.diff(planEnd, 'day');
            if (!Number.isNaN(diff) && diff > maxDelay) maxDelay = diff;
        }
    });

    if (!hasAnyPlanDate) return null;
    return maxDelay > 0 ? maxDelay : 0;
};

const computeDerivedTrackerFields = (tracker) => {
    const milestones = tracker?.projectPlan?.milestones;
    if (!Array.isArray(milestones) || milestones.length === 0) {
        return {
            status:       tracker.status       || 'Not Started',
            currentStage: tracker.currentStage || 'Not Started',
            maxDelayDays: null
        };
    }
    return {
        status:       deriveStatusFromMilestones(milestones),
        currentStage: deriveCurrentStageFromMilestones(milestones),
        maxDelayDays: deriveMaxDelayDays(milestones)
    };
};

const MHDevelopmentTracker = () => {
    const dispatch = useDispatch();
    const { trackers, total, totalPages, loading, error, success } = useSelector(state => state.mhDevelopmentTracker);
    const { items: mhRequests, loading: requestsLoading } = useSelector(state => state.assetRequests);
    const [form] = Form.useForm();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingTracker, setEditingTracker] = useState(null);
    const [vendorPopupVisible, setVendorPopupVisible] = useState(false);
    const [selectedTrackerId, setSelectedTrackerId] = useState(null);
    const [selectedPlantLocation, setSelectedPlantLocation] = useState(null);
    const [projectPlanVisible, setProjectPlanVisible] = useState(false);
    const [fileList, setFileList] = useState([]);
    const [columnFilters, setColumnFilters] = useState({});
    const [activeFilterKey, setActiveFilterKey] = useState(null);
    const [filterSearchText, setFilterSearchText] = useState({});
    const [gridWidth, setGridWidth] = useState(0);
    const gridContainerRef = useRef(null);

    const [frozenKeys, setFrozenKeys] = useState(new Set());
    const [frozenRowCount, setFrozenRowCount] = useState(0);
    const [hiddenKeys, setHiddenKeys] = useState(new Set());
    const [rowHeight, setRowHeight] = useState(44);
    const [headerRowHeight, setHeaderRowHeight] = useState(52);

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
        dispatch(fetchTrackers({ page: currentPage, limit: pageSize, search: debouncedSearch }));
        dispatch(fetchAssetRequests());
    }, [dispatch, currentPage, pageSize, debouncedSearch]);

    useEffect(() => {
        if (error) {
            toast.error(error);
            dispatch(clearError());
        }
        if (success) {
            toast.success('Operation completed successfully');
            dispatch(clearSuccess());
            setIsModalVisible(false);
            setVendorPopupVisible(false);
            setProjectPlanVisible(false);
            form.resetFields();
            setEditingTracker(null);
            setFileList([]);
        }
    }, [error, success, dispatch, form]);

    const handleEditClick = (data) => {
        setEditingTracker(data);
        form.setFieldsValue({
            departmentName: data.departmentName,
            userName: data.userName,
            assetRequestId: data.assetRequestId,
            requestType: data.requestType,
            productModel: data.productModel,
            plantLocation: data.plantLocation,
            implementationTarget: data.implementationTarget ? dayjs(data.implementationTarget) : null,
            status: data.status,
            currentStage: data.currentStage,
            remarks: data.remarks
        });
        if (mhRequests && mhRequests.length > 0 && data.assetRequestId) {
            const linkedRequest = mhRequests.find(req => req.mhRequestId === data.assetRequestId);
            if (linkedRequest) {
                form.setFieldsValue({ location: linkedRequest.location });
            }
        }
        setIsModalVisible(true);
    };

    const handleAssetRequestChange = (mhRequestId) => {
        if (!mhRequestId) {
            form.setFieldsValue({ assetRequestId: null });
            return;
        }
        const selectedRequest = (mhRequests || []).find(req => req.mhRequestId === mhRequestId);
        if (selectedRequest) {
            form.setFieldsValue({
                assetRequestId: selectedRequest.mhRequestId,
                departmentName: selectedRequest.departmentName,
                userName: selectedRequest.userName,
                requestType: selectedRequest.requestType,
                productModel: selectedRequest.productModel,
                plantLocation: selectedRequest.plantLocation,
                location: selectedRequest.location
            });
        } else {
            form.setFieldsValue({ assetRequestId: mhRequestId });
        }
    };

    const handleDeleteClick = (id) => {
        Modal.confirm({
            title: 'Delete Tracker Record',
            content: 'Are you sure you want to delete this tracker record?',
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: () => { dispatch(deleteTracker(id)); }
        });
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            const trackerData = {
                ...values,
                implementationTarget: values.implementationTarget ? values.implementationTarget.toISOString() : null
            };
            dispatch(updateTracker({ id: editingTracker._id, data: trackerData }));
        } catch (err) {
            console.error('Validation failed:', err);
        }
    };

    const handleVendorSelect = (trackerId, plantLocation) => {
        setSelectedTrackerId(trackerId);
        setSelectedPlantLocation(plantLocation);
        setVendorPopupVisible(true);
    };

    const handleProjectPlan = (trackerId) => {
        setSelectedTrackerId(trackerId);
        setProjectPlanVisible(true);
    };

    const handleProjectPlanSave = (planData) => {
        if (selectedTrackerId) {
            dispatch(updateTracker({ id: selectedTrackerId, data: { projectPlan: planData } }));
        }
    };

    const handleFileUpload = (trackerId, file) => {
        dispatch(uploadDrawing({ id: trackerId, file }));
        return false;
    };

    const handleDownloadDrawing = (drawingUrl, fileName) => {
        if (!drawingUrl) return;
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '/Tvs' : 'http://localhost:5000');
        let normalizedUrl = drawingUrl.replace(/\\/g, '/');
        if (normalizedUrl.startsWith('/')) normalizedUrl = normalizedUrl.slice(1);
        const fullUrl = `${API_BASE_URL.replace(/\/$/, '')}/${normalizedUrl}`;
        const link = document.createElement('a');
        link.href = fullUrl;
        link.download = fileName || normalizedUrl.split('/').pop() || 'drawing.pdf';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredTrackers = useMemo(
        () => (trackers || []).map(tracker => {
            const derived = computeDerivedTrackerFields(tracker);
            return { ...tracker, ...derived };
        }),
        [trackers]
    );

    const getStatusColor = (status) => {
        switch (status) {
            case 'On Track': return 'text-green-700 bg-green-50 border-green-200';
            case 'Likely Delay': return 'text-amber-700 bg-amber-50 border-amber-200';
            case 'Delayed': return 'text-red-700 bg-red-50 border-red-200';
            default: return 'text-gray-700 bg-gray-50 border-gray-200';
        }
    };

    const getStageColor = (stage) => {
        switch (stage) {
            case 'Design': return 'text-blue-700 bg-blue-50';
            case 'PR/PO': return 'text-purple-700 bg-purple-50';
            case 'Sample Production': return 'text-indigo-700 bg-indigo-50';
            case 'Production Ready': return 'text-emerald-700 bg-emerald-50';
            case 'Completed': return 'text-green-700 bg-green-50';
            default: return 'text-gray-700 bg-gray-50';
        }
    };

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

    const FilterHeaderCell = ({ column }) => {
        const key = column.key;
        const valuesSet = new Set();
        filteredTrackers.forEach(row => {
            const value = row[key];
            valuesSet.add(value == null ? '' : String(value));
        });
        const values = Array.from(valuesSet).sort((a, b) => a.localeCompare(b));

        const searchValue = filterSearchText[key] || '';
        const rawSelected = columnFilters[key];
        const selectedValues = rawSelected === undefined ? values : rawSelected;
        const visibleValues = values.filter(v => v.toLowerCase().includes(searchValue.toLowerCase()));

        const toggleValue = (value) => {
            setColumnFilters(prev => {
                const base = prev[key] === undefined ? values : prev[key];
                const exists = base.includes(value);
                const next = exists ? base.filter(v => v !== value) : [...base, value];
                const updated = { ...prev };
                if (next.length === values.length) delete updated[key];
                else updated[key] = next;
                return updated;
            });
            setActiveFilterKey(null);
        };

        const handleSelectAll = () => setColumnFilters(prev => { const c = { ...prev }; delete c[key]; return c; });
        const handleClear = () => {
            setColumnFilters(prev => { const c = { ...prev }; delete c[key]; return c; });
            setFilterSearchText(prev => { const c = { ...prev }; delete c[key]; return c; });
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



    // Uniform plain header for columns without filters
    const PlainHeaderCell = ({ column }) => (
        <div
            className="h-full w-full flex items-center px-3"
        >
            <span className="font-bold text-white text-[11px] leading-tight tracking-wide">
                {column.name}
            </span>
        </div>
    );

    const dataGridColumns = useMemo(() => [
        // 1. S.no
        {
            key: 'serial',
            name: 'S.NO',
            width: 60,
            frozen: true,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <span className="font-semibold text-gray-700">{row._serialNo}</span>
            )
        },
        // 2. Department Name
        {
            key: 'departmentName',
            name: 'DEPARTMENT NAME',
            width: 200,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => <span className="text-xs text-gray-700">{row.departmentName || '-'}</span>
        },
        // 3. Username
        {
            key: 'userName',
            name: 'USERNAME',
            width: 160,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => <span className="text-xs text-gray-700">{row.userName || '-'}</span>
        },
        // 4. Asset Request ID
        {
            key: 'assetRequestId',
            name: 'ASSET REQUEST ID',
            width: 190,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <span className="font-semibold text-gray-900">{row.assetRequestId || '-'}</span>
            )
        },
        // 5. Request Type
        {
            key: 'requestType',
            name: 'REQUEST TYPE',
            width: 175,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => <span className="text-xs text-gray-700">{row.requestType || '-'}</span>
        },
        // 6. Product Model
        {
            key: 'productModel',
            name: 'PRODUCT MODEL',
            width: 175,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => <span className="text-xs text-gray-700">{row.productModel || '-'}</span>
        },
        // 7. Material Handling Equipment
        {
            key: 'materialHandlingEquipment',
            name: 'MATERIAL HANDLING EQUIPMENT',
            width: 220,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <span className="text-xs text-gray-700">{row.materialHandlingEquipment || '-'}</span>
            )
        },
        // 8. Plant Location
        {
            key: 'plantLocation',
            name: 'PLANT LOCATION',
            width: 175,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => <span className="text-xs text-gray-700">{row.plantLocation || '-'}</span>
        },
        // 9. Vendor Selection
        {
            key: 'vendorSelection',
            name: 'VENDOR SELECTION',
            width: 200,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <div className="flex items-center gap-2 py-1">
                    {row.vendorCode ? (
                        <>
                            <span className="text-xs font-bold text-tvs-primary min-w-[60px]">{row.vendorCode}</span>
                            <button
                                type="button"
                                onClick={() => handleVendorSelect(row._id, row.plantLocation)}
                                className="p-1 rounded-md bg-gray-50 text-gray-400 hover:text-tvs-primary hover:bg-blue-50 transition-all border border-gray-100"
                                title="Change Vendor"
                            >
                                <Edit size={12} />
                            </button>
                        </>
                    ) : (
                        <Button
                            size="small"
                            type="primary"
                            className="bg-tvs-primary text-[10px] h-6"
                            onClick={() => handleVendorSelect(row._id, row.plantLocation)}
                            disabled={!row.plantLocation}
                            title={!row.plantLocation ? 'Please set Plant Location first' : ''}
                        >
                            Select Vendor
                        </Button>
                    )}
                </div>
            )
        },
        // 10. Project Plan
        {
            key: 'projectPlan',
            name: 'PROJECT PLAN',
            width: 160,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <Button
                    size="small"
                    icon={<Edit size={12} />}
                    className="flex items-center gap-1 text-[10px]"
                    onClick={() => handleProjectPlan(row._id)}
                >
                    Create/Edit
                </Button>
            )
        },
        // 11. Implementation Target
        {
            key: 'implementationTarget',
            name: 'IMPLEMENTATION TARGET',
            width: 210,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <span className="text-xs text-gray-700">
                    {row.implementationTarget ? dayjs(row.implementationTarget).format('DD-MMM-YYYY') : '-'}
                </span>
            )
        },
        // 11b. Delay (Days) — max delay across all project plan milestones
        {
            key: 'maxDelayDays',
            name: 'DELAY (DAYS)',
            width: 140,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => {
                const delay = row.maxDelayDays;
                if (delay === null || delay === undefined) {
                    return <span className="text-[11px] text-gray-400">-</span>;
                }
                if (delay === 0) {
                    return (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border text-green-700 bg-green-50 border-green-200">
                            On Time
                        </span>
                    );
                }
                return (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border text-red-700 bg-red-50 border-red-200">
                        +{delay}d
                    </span>
                );
            }
        },
        // 12. Status
        {
            key: 'status',
            name: 'STATUS',
            width: 145,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(row.status)}`}>
                    {row.status}
                </span>
            )
        },
        // 13. Implementation Visibility
        {
            key: 'implementationVisibility',
            name: 'IMPLEMENTATION VISIBILITY',
            width: 225,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => {
                const val = row.implementationVisibility;
                if (!val) return <span className="text-[10px] text-gray-400">-</span>;
                const colorMap = {
                    'High': 'text-green-700 bg-green-50 border-green-200',
                    'Medium': 'text-amber-700 bg-amber-50 border-amber-200',
                    'Low': 'text-red-700 bg-red-50 border-red-200',
                };
                const cls = colorMap[val] || 'text-gray-700 bg-gray-50 border-gray-200';
                return (
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${cls}`}>
                        {val}
                    </span>
                );
            }
        },
        // 14. Current Stage
        {
            key: 'currentStage',
            name: 'CURRENT STAGE',
            width: 185,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${getStageColor(row.currentStage)}`}>
                    {row.currentStage || '-'}
                </span>
            )
        },
        // 15. Remarks
        {
            key: 'remarks',
            name: 'REMARKS',
            width: 220,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <span className="text-xs text-gray-500 truncate">{row.remarks || '-'}</span>
            )
        },
        // 16. Drawing (image / PDF / Word / Excel)
        {
            key: 'drawing',
            name: 'DRAWING / FILE',
            width: 160,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <div className="flex items-center gap-2">
                    {row.drawingUrl ? (
                        <Button
                            size="small"
                            icon={<Download size={14} />}
                            className="text-tvs-primary text-[10px]"
                            onClick={() => handleDownloadDrawing(row.drawingUrl, row.drawingFileName)}
                        >
                            Download
                        </Button>
                    ) : (
                        <Upload
                            beforeUpload={(file) => handleFileUpload(row._id, file)}
                            showUploadList={false}
                            accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.doc,.docx,.xls,.xlsx"
                        >
                            <Button size="small" icon={<UploadIcon size={14} />} className="text-[10px]">
                                Upload
                            </Button>
                        </Upload>
                    )}
                </div>
            )
        },
        // 17. Actions
        {
            key: 'actions',
            name: 'ACTIONS',
            width: 120,
            sortable: false,
            renderHeaderCell: PlainHeaderCell,
            renderCell: ({ row }) => (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => handleEditClick(row)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Edit Tracker"
                    >
                        <Edit size={16} />
                    </button>
                    <button
                        onClick={() => handleDeleteClick(row._id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Tracker"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [
        filteredTrackers,
        columnFilters,
        activeFilterKey,
        filterSearchText,
        mhRequests,
        requestsLoading,
    ]);

    const gridRows = filteredTrackers || [];
    const paginatedRows = React.useMemo(() => {
        return gridRows.map((row, i) => ({ ...row, _serialNo: (currentPage - 1) * pageSize + i + 1 }));
    }, [gridRows, currentPage, pageSize]);

    const freezeColumnList = dataGridColumns
        .filter(col => col.key !== 'serial' && col.key !== 'actions' && col.key !== 'vendorSelection' && col.key !== 'projectPlan')
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
        return () => observer.disconnect();
    }, []);

    // const gridRows = applyColumnFilters(filteredTrackers); // This line was commented out as it was duplicated and the one above includes _serialNo

    return (
        <div className="flex-1 flex flex-col h-full w-full bg-transparent">
            <div className="flex-1 bg-white rounded-xl shadow border border-gray-200 overflow-hidden flex flex-col">
                {/* Toolbar: count + customize + freeze */}
                <div style={{ padding: '12px 24px 8px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {/* Record count */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 14px', borderRadius: 12,
                        background: 'linear-gradient(135deg,#fdf4ff,#fae8ff)',
                        border: '1px solid #e9d5ff',
                    }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7', display: 'inline-block' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#6b21a8' }}>
                            {total || 0}
                            <span style={{ fontWeight: 500, color: '#9333ea', marginLeft: 4 }}>trackers</span>
                        </span>
                    </div>

                    <input
                        type="text"
                        placeholder="Search trackers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-48"
                    />

                    {/* Customize Columns */}
                    <ColumnCustomizer
                        columns={dataGridColumns}
                        hiddenKeys={hiddenKeys}
                        onChange={setHiddenKeys}
                        gridClass="mh-development-grid"
                        onDensity={({ rowH, headerH }) => {
                            setRowHeight(rowH);
                            setHeaderRowHeight(headerH);
                        }}
                    />

                    {/* Freeze toolbar */}
                    <FreezeToolbar
                        columns={freezeColumnList}
                        frozenKeys={frozenKeys}
                        onApply={setFrozenKeys}
                        frozenRowCount={frozenRowCount}
                        setFrozenRowCount={setFrozenRowCount}
                        maxRows={Math.min(gridRows.length, 50)}
                    />
                </div>

                <div className="flex-1 flex flex-col w-full min-h-0">
                    <div ref={gridContainerRef} className="flex-1 flex flex-col w-full min-h-0 bg-white border-t border-gray-200 overflow-hidden">
                        <FrozenRowsDataGrid
                            columns={autoFitColumns}
                            rows={paginatedRows}
                            rowKeyGetter={(row) => row._id || row.assetRequestId}
                            className="rdg-light mh-development-grid"
                            style={{ blockSize: '100%' }}
                            rowHeight={rowHeight}
                            headerRowHeight={headerRowHeight}
                            frozenRowCount={frozenRowCount}
                            defaultColumnOptions={{ resizable: true, minWidth: 120 }}
                            loading={loading}
                        />
                    
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
            </div>

            {/* Edit Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-3 pb-4 border-b">
                        <div className="p-2 bg-tvs-primary/10 rounded-lg text-tvs-primary">
                            <Edit size={20} />
                        </div>
                        <span className="text-xl font-bold">Update Tracker</span>
                    </div>
                }
                open={isModalVisible}
                onOk={handleModalOk}
                onCancel={() => setIsModalVisible(false)}
                okText="Update"
                width="95%"
                style={{ maxWidth: '800px' }}
                centered
                className="custom-modal"
            >
                <Form form={form} layout="vertical" className="mt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Form.Item name="departmentName" label={<span className="text-xs font-bold uppercase text-gray-500">Department Name</span>} rules={[{ required: true }]}>
                            <Input size="large" placeholder="E.g. Production" />
                        </Form.Item>
                        <Form.Item name="userName" label={<span className="text-xs font-bold uppercase text-gray-500">User Name</span>} rules={[{ required: true }]}>
                            <Input size="large" placeholder="E.g. John Doe" />
                        </Form.Item>
                        <Form.Item name="assetRequestId" label={<span className="text-xs font-bold uppercase text-gray-500">Asset Request ID</span>} rules={[{ required: true }]}>
                            <Select size="large" placeholder="Select Asset Request" showSearch optionFilterProp="children" onChange={handleAssetRequestChange} loading={requestsLoading} allowClear>
                                {(mhRequests || []).map(request => (
                                    <Option key={request._id} value={request.mhRequestId}>
                                        {request.mhRequestId} - {request.departmentName} - {request.productModel}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item name="requestType" label={<span className="text-xs font-bold uppercase text-gray-500">Request Type</span>} rules={[{ required: true }]}>
                            <Select size="large" placeholder="Select type">
                                <Option value="New MH">New MH</Option>
                                <Option value="Modification">Modification</Option>
                                <Option value="Replacement">Replacement</Option>
                                <Option value="New Project">New Project</Option>
                                <Option value="Upgrade">Upgrade</Option>
                                <Option value="Refresh">Refresh</Option>
                                <Option value="Capacity">Capacity</Option>
                                <Option value="Special Improvements">Special Improvements</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="productModel" label={<span className="text-xs font-bold uppercase text-gray-500">Product Model</span>} rules={[{ required: true }]}>
                            <Input size="large" placeholder="E.g. Model X" />
                        </Form.Item>
                        <Form.Item name="plantLocation" label={<span className="text-xs font-bold uppercase text-gray-500">Plant Location</span>} rules={[{ required: true }]}>
                            <Input size="large" placeholder="E.g. Chennai" />
                        </Form.Item>
                        <Form.Item name="location" label={<span className="text-xs font-bold uppercase text-gray-500">Location</span>}>
                            <Input size="large" placeholder="Auto-filled from Request Tracker" disabled />
                        </Form.Item>
                        <Form.Item name="implementationTarget" label={<span className="text-xs font-bold uppercase text-gray-500">Implementation Target</span>}>
                            <DatePicker size="large" className="w-full" format="DD-MMM-YYYY" />
                        </Form.Item>
                        <Form.Item name="status" label={<span className="text-xs font-bold uppercase text-gray-500">Status (Auto)</span>}>
                            <Input size="large" disabled />
                        </Form.Item>
                        <Form.Item name="currentStage" label={<span className="text-xs font-bold uppercase text-gray-500">Current Stage (Auto)</span>}>
                            <Input size="large" disabled />
                        </Form.Item>
                        <Form.Item name="remarks" label={<span className="text-xs font-bold uppercase text-gray-500">Remarks</span>} className="col-span-2">
                            <TextArea rows={3} placeholder="Add any special instructions or milestones..." />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>

            {/* Vendor Selection Popup */}
            <VendorSelectionPopup
                visible={vendorPopupVisible}
                onCancel={() => { setVendorPopupVisible(false); setSelectedPlantLocation(null); }}
                trackerId={selectedTrackerId}
                plantLocation={selectedPlantLocation}
            />

            {/* Project Plan Modal */}
            <ProjectPlanModal
                visible={projectPlanVisible}
                onCancel={() => setProjectPlanVisible(false)}
                onSave={handleProjectPlanSave}
                trackerId={selectedTrackerId}
                initialData={trackers.find(t => t._id === selectedTrackerId)?.projectPlan}
                assetRequestId={trackers.find(t => t._id === selectedTrackerId)?.assetRequestId}
            />
        </div>
    );
};

export default MHDevelopmentTracker;
