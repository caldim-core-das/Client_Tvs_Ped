import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Upload, message } from 'antd';
import { UploadCloud, FileText } from 'lucide-react';
import { createAssetRequest, updateAssetRequest, fetchAssetRequestById, resetStatus, clearCurrentItem } from '../../redux/slices/assetRequestSlice';
import { fetchEmployees } from '../../redux/slices/employeeSlice';
import { useAuth } from '../../context/AuthContext';

const CreateAssetRequestForm = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams();
    const isEditMode = !!id;

    // Construct server base URL (remove /api from the end if exists)
    const serverUrl = import.meta.env.VITE_API_BASE_URL
        ? import.meta.env.VITE_API_BASE_URL.replace(/\/api$/, '')
        : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '/Tvs' : 'http://localhost:5000');

    // Get Redux state
    const { currentItem, loading, success, error } = useSelector((state) => state.assetRequests);
    const { user } = useAuth();

    useEffect(() => {
        if (user && !user.employeeId) {
            const timer = setTimeout(() => {
                message.error('Please add the employee information first.');
                navigate('/employee-master/add');
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [user, navigate]);

    const [formData, setFormData] = useState({
        departmentName: '',
        location: '',
        userName: '',
        assetRequestId: '',
        requestType: 'New',
        category: 'New Project',
        problemStatement: '',
        handlingPartName: '',
        assetNeededLocation: '',
        assetName: '',
        poPrice: '',
        assetLocation: '',
        file: null,
        drawingFile: null
    });

    useEffect(() => {        // Reset status on mount
        dispatch(resetStatus());

        if (!isEditMode) {
            dispatch(clearCurrentItem());
            if (user) {
                setFormData(prev => ({
                    ...prev,
                    userName: user.name || user.employeeName || (user.employeeId && user.employeeId.employeeName) || '',
                    departmentName: user.department || user.departmentName || (user.employeeId && user.employeeId.departmentName) || '',
                    location: user.location || user.plantLocation || (user.employeeId && user.employeeId.plantLocation) || ''
                }));
            }
        } else {
            // Fetch existing data via Redux
            dispatch(fetchAssetRequestById(id));
        }
    }, [dispatch, id, isEditMode, user]);

    // Update form when currentItem matches ID (for edit mode)
    useEffect(() => {
        if (isEditMode && currentItem && currentItem._id === id) {
            setFormData({
                departmentName: currentItem.departmentName,
                location: currentItem.location,
                userName: currentItem.userName,
                assetRequestId: currentItem.assetRequestId,
                requestType: currentItem.requestType,
                category: currentItem.category,
                problemStatement: currentItem.problemStatement,
                handlingPartName: currentItem.handlingPartName,
                assetNeededLocation: currentItem.assetNeededLocation,
                assetName: currentItem.assetName || '',
                poPrice: currentItem.poPrice || '',
                assetLocation: currentItem.assetLocation || '',
                file: null,
                drawingFile: currentItem.drawingFile || null
            });
        }
    }, [currentItem, isEditMode, id]);

    // Handle Success Redirect
    useEffect(() => {
        if (success) {
            message.success(isEditMode ? 'Request updated successfully!' : 'Request created successfully!');
            dispatch(resetStatus());
            navigate('/CreateAssetRequest');
        }
    }, [success, dispatch, navigate, isEditMode]);

    // Handle Error Display
    useEffect(() => {
        if (error) {
            message.error(error);
            dispatch(resetStatus());
        }
    }, [error, dispatch]);

    // Validation State
    const [errors, setErrors] = useState({});

    const sanitizeInput = (value) => {
        if (typeof value !== 'string') return value;
        return value.replace(/<[^>]*>?/gm, "").replace(/['";]/g, "");
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const sanitizedValue = sanitizeInput(value);

        if (name === 'problemStatement' && sanitizedValue.length > 500) {
            return;
        }

        setFormData(prev => ({ ...prev, [name]: sanitizedValue }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        // Relaxing requirements for assetName, poPrice, and assetLocation as they might not be known at creation
        const requiredFields = [
            'departmentName', 'location', 'userName', 'requestType',
            'category', 'problemStatement', 'handlingPartName',
            'assetNeededLocation'
        ];

        requiredFields.forEach(field => {
            if (!formData[field] || formData[field].toString().trim() === '') {
                newErrors[field] = 'This field is required';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleFileChange = (e) => {
        setFormData(prev => ({ ...prev, file: e.target.files[0] }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (loading) return;

        if (!validateForm()) {
            message.error('Please fill in all required fields.');
            return;
        }

        const formPayload = new FormData();
        Object.keys(formData).forEach(key => {
            if (key === 'drawingFile' && formData.file) return;

            if (key !== 'file') {
                // Only send non-empty values or keep null as null
                const value = formData[key];
                if (value === '' || value === null) {
                    formPayload.append(key, 'null');
                } else {
                    formPayload.append(key, value);
                }
            }
        });

        if (formData.file) {
            formPayload.append('drawingFile', formData.file);
        }

        if (isEditMode) {
            dispatch(updateAssetRequest({ id, formData: formPayload }));
        } else {
            dispatch(createAssetRequest(formPayload));
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-tvs-border p-8 fade-in">
            <h2 className="text-2xl font-bold text-tvs-dark-gray mb-8 border-b border-tvs-border pb-4">
                {isEditMode ? 'Edit Asset Request' : 'Create New Asset Request'}
            </h2>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Read Only Auto Fetched Fields */}
                    {isEditMode && (
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-gray-600">Asset Request ID</label>
                            <input
                                type="text"
                                name="assetRequestId"
                                value={formData.assetRequestId}
                                disabled
                                className="w-full p-3 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                            />
                        </div>
                    )}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">User Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="userName"
                            value={formData.userName}
                            onChange={handleChange}
                            placeholder="Enter Name"
                            disabled
                            className={`w-full p-3 border rounded-lg text-sm text-gray-700 bg-gray-50 focus:ring-1 transition-colors outline-none cursor-not-allowed ${errors.userName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-tvs-primary focus:ring-tvs-primary'}`}
                        />
                        {errors.userName && <span className="text-xs text-red-500">{errors.userName}</span>}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">Department Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="departmentName"
                            value={formData.departmentName}
                            onChange={handleChange}
                            placeholder="Enter Department"
                            disabled
                            className={`w-full p-3 border rounded-lg text-sm text-gray-700 bg-gray-50 focus:ring-1 transition-colors outline-none cursor-not-allowed ${errors.departmentName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-tvs-primary focus:ring-tvs-primary'}`}
                        />
                        {errors.departmentName && <span className="text-xs text-red-500">{errors.departmentName}</span>}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">Location <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            placeholder="Enter Location"
                            className={`w-full p-3 border rounded-lg text-sm text-gray-700 focus:ring-1 transition-colors outline-none ${errors.location ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-tvs-primary focus:ring-tvs-primary'}`}
                        />
                        {errors.location && <span className="text-xs text-red-500">{errors.location}</span>}
                    </div>

                    {/* Editable Fields */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">Request Type <span className="text-red-500">*</span></label>
                        <select
                            name="requestType"
                            value={formData.requestType}
                            onChange={handleChange}
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:border-tvs-primary focus:ring-1 focus:ring-tvs-primary transition-colors outline-none"
                        >
                            <option value="New">New</option>
                            <option value="Modify">Modify</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">Category <span className="text-red-500">*</span></label>
                        <select
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:border-tvs-primary focus:ring-1 focus:ring-tvs-primary transition-colors outline-none"
                        >
                            <option value="New Project">New Project</option>
                            <option value="Current Product Support">Current Product Support</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">Handling Part Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="handlingPartName"
                            value={formData.handlingPartName}
                            onChange={handleChange}
                            placeholder="e.g. Engine Block"
                            className={`w-full p-3 border rounded-lg text-sm text-gray-700 focus:ring-1 transition-colors outline-none ${errors.handlingPartName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-tvs-primary focus:ring-tvs-primary'}`}
                        />
                        {errors.handlingPartName && <span className="text-xs text-red-500">{errors.handlingPartName}</span>}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">Asset Needed Location (Line/Area) <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="assetNeededLocation"
                            value={formData.assetNeededLocation}
                            onChange={handleChange}
                            placeholder="e.g. Assembly Line 2"
                            className={`w-full p-3 border rounded-lg text-sm text-gray-700 focus:ring-1 transition-colors outline-none ${errors.assetNeededLocation ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-tvs-primary focus:ring-tvs-primary'}`}
                        />
                        {errors.assetNeededLocation && <span className="text-xs text-red-500">{errors.assetNeededLocation}</span>}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">Asset Name</label>
                        <input
                            type="text"
                            name="assetName"
                            value={formData.assetName}
                            onChange={handleChange}
                            placeholder="e.g. Laser Cutter 3000"
                            className={`w-full p-3 border rounded-lg text-sm text-gray-700 border-gray-200 focus:ring-1 focus:border-tvs-primary focus:ring-tvs-primary transition-colors outline-none`}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">PO Price</label>
                        <input
                            type="number"
                            name="poPrice"
                            value={formData.poPrice}
                            onChange={handleChange}
                            placeholder="e.g. 50000"
                            className={`w-full p-3 border rounded-lg text-sm text-gray-700 border-gray-200 focus:ring-1 focus:border-tvs-primary focus:ring-tvs-primary transition-colors outline-none`}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-600">Asset Location (Final)</label>
                        <input
                            type="text"
                            name="assetLocation"
                            value={formData.assetLocation}
                            onChange={handleChange}
                            placeholder="e.g. Shop Floor Zone A"
                            className={`w-full p-3 border rounded-lg text-sm text-gray-700 border-gray-200 focus:ring-1 focus:border-tvs-primary focus:ring-tvs-primary transition-colors outline-none`}
                        />
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-4">
                        <div className="flex justify-between">
                            <label className="text-sm font-semibold text-gray-600">Problem Statement <span className="text-red-500">*</span></label>
                            <span className="text-xs text-gray-400">{formData.problemStatement.length}/500</span>
                        </div>
                        <textarea
                            name="problemStatement"
                            value={formData.problemStatement}
                            onChange={handleChange}
                            maxLength={500}
                            placeholder="Describe the need for this asset..."
                            className={`w-full p-3 border rounded-lg text-sm text-gray-700 focus:ring-1 transition-colors outline-none min-h-[100px] resize-y ${errors.problemStatement ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-tvs-primary focus:ring-tvs-primary'}`}
                        />
                        {errors.problemStatement && <span className="text-xs text-red-500">{errors.problemStatement}</span>}
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-4">
                        <label className="text-sm font-semibold text-gray-600">Upload Part Drawing (Optional)</label>
                        <div className="h-full">
                            <Upload.Dragger
                                name="file"
                                multiple={false}
                                maxCount={1}
                                beforeUpload={(file) => {
                                    const isImage = file.type.startsWith('image/');
                                    if (!isImage) {
                                        message.error('Only image files are allowed!');
                                        return false;
                                    }
                                    setFormData(prev => ({ ...prev, file: file }));
                                    return false; // Prevent auto upload
                                }}
                                onRemove={() => {
                                    setFormData(prev => ({ ...prev, file: null, drawingFile: prev.file ? prev.drawingFile : null }));
                                }}
                                fileList={formData.file ? [formData.file] : []}
                                showUploadList={false} // Hide default list to custom render
                                className="w-full bg-gray-50 hover:border-tvs-primary transition-colors rounded-lg overflow-hidden" // Add rounded and overflow to match
                                style={{ borderRadius: '0.5rem' }}
                            >
                                <div className="p-8 flex flex-col items-center justify-center text-center relative group">
                                    {(formData.drawingFile && !formData.file) || formData.file ? (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (formData.file) {
                                                    setFormData(prev => ({ ...prev, file: null }));
                                                } else {
                                                    setFormData(prev => ({ ...prev, drawingFile: null }));
                                                }
                                            }}
                                            className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-500 hover:text-white transition-all z-20 shadow-sm"
                                            title="Remove file"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    ) : null}
                                    {formData.file ? (
                                        <>
                                            <div className="mb-4 p-3 bg-green-50 rounded-full text-green-600">
                                                <FileText size={32} />
                                            </div>
                                            <p className="text-base font-medium text-gray-700">{formData.file.name}</p>
                                            <p className="text-sm text-gray-500 mt-1">{(formData.file.size / 1024).toFixed(1)} KB</p>
                                            <p className="text-xs text-tvs-primary mt-2 hover:underline">Click to change file</p>
                                        </>
                                    ) : formData.drawingFile ? (
                                        <>
                                            <div className="mb-4 p-3 bg-blue-50 rounded-full text-tvs-primary">
                                                <FileText size={32} />
                                            </div>
                                            <p className="text-base font-medium text-gray-700">
                                                {formData.drawingFile.split('/').pop()}
                                            </p>
                                            <p className="text-sm text-gray-500 mt-1">Previously uploaded file</p>
                                            <div className="flex gap-4 mt-2">
                                                <a
                                                    href={`${serverUrl}/${formData.drawingFile}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-tvs-primary hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    View current file
                                                </a>
                                                <span className="text-xs text-gray-300">|</span>
                                                <p className="text-xs text-tvs-primary hover:underline">Click to change file</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="mb-4 p-3 bg-blue-50 rounded-full text-tvs-primary">
                                                <UploadCloud size={32} />
                                            </div>
                                            <p className="text-base font-medium text-gray-700">Click or drag file to this area to upload</p>
                                            <p className="text-sm text-gray-500 mt-1">Support for a single file upload.</p>
                                        </>
                                    )}
                                </div>
                            </Upload.Dragger>
                        </div>
                    </div>
                </div >

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-tvs-border">
                    <button
                        type="button"
                        onClick={() => navigate('/CreateAssetRequest')}
                        className="px-6 py-2.5 bg-white border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 hover:text-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-6 py-2.5 bg-tvs-primary !text-white border border-transparent rounded-lg font-medium shadow-sm hover:bg-opacity-90 transform active:scale-95 transition-all"
                    >
                        {isEditMode ? 'Update Request' : 'Submit Request'}
                    </button>
                </div>
            </form >
        </div >
    );
};

export default CreateAssetRequestForm;
