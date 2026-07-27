import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Filter } from 'lucide-react';
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import FreezeToolbar from '../components/FreezeToolbar';
import FrozenRowsDataGrid from '../components/FrozenRowsDataGrid';
import ColumnCustomizer from '../components/ColumnCustomizer';

import { getApiBaseUrl } from '../api/axiosConfig';

const API_BASE_URL = getApiBaseUrl();

const AssetSummary = () => {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [columnFilters, setColumnFilters] = useState({});
    const [activeFilterKey, setActiveFilterKey] = useState(null);
    const [filterSearchText, setFilterSearchText] = useState({});
    const [gridWidth, setGridWidth] = useState(0);
    const [frozenKeys, setFrozenKeys] = useState(new Set());
    const [frozenRowCount, setFrozenRowCount] = useState(0);
    const [hiddenKeys, setHiddenKeys] = useState(new Set());
    const [rowHeight, setRowHeight] = useState(44);
    const [headerRowHeight, setHeaderRowHeight] = useState(52);

    const gridContainerRef = useRef(null);

    useEffect(() => {
        fetchAssets();
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
            width: 150,
            renderHeaderCell: FilterHeaderCell,
            renderCell: ({ row }) => {
                const value = row.assetId || '-';
                return (
                    <span className="font-semibold text-gray-900">{value}</span>
                );
            }
        },
        {
            key: 'assetName',
            name: 'ASSET NAME',
            width: 200,
            renderHeaderCell: FilterHeaderCell,
            renderCell: ({ row }) => (
                <span>{row.assetName || '-'}</span>
            )
        },
        {
            key: 'vendorName',
            name: 'VENDOR NAME',
            width: 200,
            renderHeaderCell: FilterHeaderCell,
            renderCell: ({ row }) => {
                return <span>{row.vendorName || '-'}</span>;
            }
        },
        {
            key: 'departmentName',
            name: 'DEPARTMENT',
            width: 180,
            renderHeaderCell: FilterHeaderCell
        },
        {
            key: 'plantLocation',
            name: 'PLANT LOCATION',
            width: 160,
            renderHeaderCell: FilterHeaderCell
        },
        {
            key: 'assetLocation',
            name: 'ASSET LOCATION',
            width: 200,
            renderHeaderCell: FilterHeaderCell,
            renderCell: ({ row }) => {
                return <span>{row.assetLocation || '-'}</span>;
            }
        }
    ];

    const freezeColumnList = dataGridColumns
        .filter(col => col.key !== 'serial')
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
            const scaledWidth = Math.max(
                Math.floor(column.width * scale),
                column.width,
                80
            );

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
                <div className="px-6 py-4">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <ColumnCustomizer
                            columns={dataGridColumns}
                            hiddenKeys={hiddenKeys}
                            onChange={setHiddenKeys}
                            gridClass="asset-summary-grid"
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
                            className="rdg-light asset-summary-grid"
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
        </div>
    );
};

export default AssetSummary;
