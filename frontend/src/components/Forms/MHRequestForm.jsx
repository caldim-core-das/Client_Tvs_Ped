import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Upload, message, Form, Input, Select, Button, Row, Col } from 'antd';
import { UploadCloud, ChevronLeft, Save, Mail } from 'lucide-react';
import {
    createAssetRequest, updateAssetRequest, fetchAssetRequestById,
    resetStatus, clearCurrentItem
} from '../../redux/slices/assetRequestSlice';
import { useAuth } from '../../context/AuthContext';

const { Option } = Select;

const MHRequestForm = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams();
    const isEditMode = !!id;
    const [form] = Form.useForm();

    const serverUrl = import.meta.env.VITE_API_BASE_URL
        ? import.meta.env.VITE_API_BASE_URL.replace(/\/api$/, '')
        : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '/Tvs' : 'http://localhost:5000');

    const { currentItem, loading, success, error } = useSelector((state) => state.assetRequests);
    const { user } = useAuth();

    const [fileList, setFileList] = useState([]);

    useEffect(() => {
        dispatch(resetStatus());
        if (isEditMode) {
            dispatch(fetchAssetRequestById(id));
        } else {
            dispatch(clearCurrentItem());
            if (user) {
                form.setFieldsValue({
                    userName: user.name || '',
                    departmentName: user.department || '',
                    location: user.location || ''
                });
            }
        }
    }, [dispatch, id, isEditMode, user, form]);

    useEffect(() => {
        if (isEditMode && currentItem && currentItem._id === id) {
            form.setFieldsValue({ ...currentItem, volumePerDay: currentItem.volumePerDay });
            if (currentItem.drawingFile) {
                setFileList([{
                    uid: '-1',
                    name: currentItem.drawingFile.split('/').pop(),
                    status: 'done',
                    url: `${serverUrl}/${currentItem.drawingFile}`,
                }]);
            }
        }
    }, [currentItem, isEditMode, id, form, serverUrl]);

    useEffect(() => {
        if (success && isEditMode) {
            message.success('MH Request updated successfully!');
            dispatch(resetStatus());
            navigate('/mh-requests');
        }
        if (success && !isEditMode) {
            message.success(
                <span>
                    MH Request submitted! <span className="font-bold text-blue-600">Approval email sent automatically to your department approver.</span>
                </span>,
                5
            );
            dispatch(resetStatus());
            navigate('/mh-requests');
        }
    }, [success, dispatch, navigate, isEditMode]);

    useEffect(() => {
        if (error) { message.error(error); dispatch(resetStatus()); }
    }, [error, dispatch]);

    const onFinish = (values) => {
        const formData = new FormData();
        Object.keys(values).forEach(key => {
            if (values[key] !== undefined && values[key] !== null) {
                if (Array.isArray(values[key])) {
                    formData.append(key, values[key].join(', '));
                } else {
                    formData.append(key, values[key]);
                }
            }
        });
        if (fileList.length > 0 && fileList[0].originFileObj) {
            formData.append('drawingFile', fileList[0].originFileObj);
        } else if (isEditMode && currentItem?.drawingFile && fileList.length > 0) {
            formData.append('drawingFile', currentItem.drawingFile);
        }
        if (isEditMode) {
            dispatch(updateAssetRequest({ id, formData }));
        } else {
            dispatch(createAssetRequest(formData));
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-tvs-border overflow-hidden fade-in">
            <div className="flex justify-between items-center p-6 border-b border-tvs-border bg-gray-50">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/mh-requests')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ChevronLeft size={20} className="text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-tvs-dark-gray m-0">
                            {isEditMode ? 'Edit MH Request' : 'Create MH Request'}
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">
                            {isEditMode
                                ? `Updating Request ID: ${currentItem?.mhRequestId}`
                                : 'Fill in the details — approval email is sent automatically on submit'}
                        </p>
                    </div>
                </div>
                {!isEditMode && (
                    <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-semibold border border-blue-100">
                        <Mail size={13} />
                        Auto-notifies approver on submit
                    </div>
                )}
            </div>

            <div className="p-6">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    className="space-y-10"
                    initialValues={{
                        requestType: 'New Project',
                        plantLocation: 'Hosur Plant 1 (TN)',
                        productModel: 'Scooter'
                    }}
                >
                    {/* Section 1: Requester Info */}
                    <div className="mb-10">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[2px] mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-tvs-primary"></div>
                            Requester Information
                        </h3>
                        <Row gutter={24}>
                            <Col span={8}>
                                <Form.Item label="Department Name" name="departmentName">
                                    <Input disabled className="bg-gray-50 rounded-xl h-11 border-gray-200 text-gray-500" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item label="Base Location" name="location">
                                    <Input disabled className="bg-gray-50 rounded-xl h-11 border-gray-200 text-gray-500" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item label="User Name" name="userName">
                                    <Input disabled className="bg-gray-50 rounded-xl h-11 border-gray-200 text-gray-500" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Section 2: Request Details */}
                    <div className="mb-10">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[2px] mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                            Request Details
                        </h3>
                        <Row gutter={24}>
                            <Col span={12}>
                                <Form.Item label="Request Type" name="requestType" rules={[{ required: true }]}>
                                    <Select className="rounded-xl h-11 w-full" size="large">
                                        <Option value="New Project">New Project</Option>
                                        <Option value="Modification">Modification</Option>
                                        <Option value="Replacement">Replacement</Option>
                                        <Option value="Upgrade">Upgrade</Option>
                                        <Option value="Refresh">Refresh</Option>
                                        <Option value="Capacity">Capacity</Option>
                                        <Option value="Special Improvements">Special Improvements</Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item label="Plant Location" name="plantLocation" rules={[{ required: true }]}>
                                    <Select className="rounded-xl h-11 w-full" size="large">
                                        <Option value="Hosur Plant 1 (TN)">Hosur Plant 1 (TN)</Option>
                                        <Option value="Hosur Plant 2 (TN)">Hosur Plant 2 (TN)</Option>
                                        <Option value="Hosur Plant 3 (TN)">Hosur Plant 3 (TN)</Option>
                                        <Option value="Mysore (KA)">Mysore (KA)</Option>
                                        <Option value="Nalagarh (HP)">Nalagarh (HP)</Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={24}>
                            <Col span={8}>
                                <Form.Item label="Product Model" name="productModel" rules={[{ required: true }]}>
                                    <Select mode="tags" className="rounded-xl h-11 w-full" placeholder="e.g. Scooter, Motorcycle..." size="large">
                                        <Option value="Scooter">Scooter</Option>
                                        <Option value="Motorcycle">Motorcycle</Option>
                                        <Option value="Super Premium">Super Premium</Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item label="Material Handling Equipment" name="materialHandlingEquipment">
                                    <Input placeholder="e.g. Conveyor, Forklift" className="rounded-xl h-11 border-gray-200" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item label="Handling Part Name" name="handlingPartName" rules={[{ required: true }]}>
                                    <Input placeholder="e.g. Engine Block" className="rounded-xl h-11 border-gray-200" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item label="Problem Statement" name="problemStatement" rules={[{ required: true }]}>
                            <Input.TextArea rows={4} className="rounded-2xl border-gray-200 p-4"
                                placeholder="Briefly explain the current requirement or issue..." />
                        </Form.Item>
                    </div>

                    {/* Section 3: Material Flow */}
                    <div className="mb-10">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[2px] mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                            Material Flow &amp; Volume
                        </h3>
                        <Row gutter={24}>
                            <Col span={12}>
                                <Form.Item label="Material Handling Location" name="materialHandlingLocation" rules={[{ required: true }]}>
                                    <Input placeholder="e.g. Shop Floor Zone A" className="rounded-xl h-11 border-gray-200" />
                                </Form.Item>
                            </Col>
                            <Col span={4}>
                                <Form.Item label="From" name="from" rules={[{ required: true }]}>
                                    <Input placeholder="A1" className="rounded-xl h-11 border-gray-200" />
                                </Form.Item>
                            </Col>
                            <Col span={4}>
                                <Form.Item label="To" name="to" rules={[{ required: true }]}>
                                    <Input placeholder="B2" className="rounded-xl h-11 border-gray-200" />
                                </Form.Item>
                            </Col>
                            <Col span={4}>
                                <Form.Item label="Volume/Day" name="volumePerDay" rules={[{ required: true }]}>
                                    <Input type="number" placeholder="0" className="rounded-xl h-11 border-gray-200" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Section 4: Attachments */}
                    <div className="mb-10">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[2px] mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                            Attachments
                        </h3>
                        <Form.Item label="Part Drawing / Image">
                            <Upload.Dragger
                                maxCount={1}
                                listType="picture"
                                fileList={fileList}
                                onRemove={() => setFileList([])}
                                beforeUpload={(file) => {
                                    if (!file.type.startsWith('image/')) {
                                        message.error('Only image files are allowed!');
                                        return false;
                                    }
                                    setFileList([file]);
                                    return false;
                                }}
                                className="bg-gray-50 border-gray-200 rounded-2xl hover:bg-white transition-colors"
                            >
                                <div className="p-8">
                                    <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-tvs-primary mb-4">
                                        <UploadCloud size={24} />
                                    </div>
                                    <p className="text-sm font-bold text-gray-700">Click or drag image to upload</p>
                                    <p className="text-xs text-gray-400 mt-1">Single image file supported (JPG, PNG)</p>
                                </div>
                            </Upload.Dragger>
                        </Form.Item>
                    </div>

                    <div className="flex justify-end gap-4 mt-12 pt-8 border-t border-gray-100">
                        <Button size="large" onClick={() => navigate('/mh-requests')}
                            className="rounded-xl px-8 h-12 font-bold text-gray-500 hover:bg-gray-50 border-gray-200">
                            Cancel
                        </Button>
                        <Button type="primary" htmlType="submit" size="large" loading={loading}
                            className="rounded-xl px-10 h-12 font-bold bg-tvs-primary hover:bg-tvs-primary/90 border-none shadow-lg shadow-tvs-primary/20 flex items-center gap-2">
                            <Save size={20} />
                            {isEditMode ? 'Update Request' : 'Submit & Notify Approver'}
                        </Button>
                    </div>
                </Form>

                <style>{`
                    .ant-form-item-label label {
                        font-size: 13px !important;
                        font-weight: 700 !important;
                        color: #475569 !important;
                        padding-bottom: 8px !important;
                    }
                    .ant-select-selector { border-radius: 12px !important; }
                `}</style>
            </div>
        </div>
    );
};

export default MHRequestForm;
