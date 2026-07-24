import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Badge, message, Typography, Button, Space, Popconfirm, Modal, Form, Input, Switch, InputNumber } from 'antd';
import { Layers, Eye, Edit2, Trash2, Plus, MinusCircle } from 'lucide-react';
import axios from 'axios';
import api from '../../api/axiosConfig';

const { Title, Text } = Typography;

const DesignLibraryPage = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal states
    const [viewModalVisible, setViewModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [currentDesign, setCurrentDesign] = useState(null);
    const [submitLoading, setSubmitLoading] = useState(false);

    const [form] = Form.useForm();

    useEffect(() => {
        fetchDesigns();
    }, []);

    const fetchDesigns = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/design-library`);
            setData(res.data.data);
        } catch (err) {
            console.error('Error fetching design library', err);
            message.error('Failed to load Design Library');
        } finally {
            setLoading(false);
        }
    };

    const handleView = (record) => {
        setCurrentDesign(record);
        setViewModalVisible(true);
    };

    const handleEdit = (record) => {
        setCurrentDesign(record);
        form.setFieldsValue({
            name: record.name,
            category: record.category,
            equipmentType: record.equipmentType,
            activeStatus: record.activeStatus,
            variants: record.variants || []
        });
        setEditModalVisible(true);
    };

    const handleDelete = async (id) => {
        try {
            const token = sessionStorage.getItem('token');
            const baseURL = import.meta.env.VITE_API_BASE_URL || '';
            await axios.delete(`${baseURL}/api/design-library/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            message.success('Design marked as inactive (Soft Deleted)');
            fetchDesigns();
        } catch (err) {
            console.error('Error deleting design', err);
            message.error('Failed to delete design');
        }
    };

    const handleUpdate = async (values) => {
        try {
            setSubmitLoading(true);
            const token = sessionStorage.getItem('token');
            const baseURL = import.meta.env.VITE_API_BASE_URL || '';
            
            await axios.put(`${baseURL}/api/design-library/${currentDesign._id}`, values, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            message.success('Design updated successfully');
            setEditModalVisible(false);
            fetchDesigns();
        } catch (err) {
            console.error('Error updating design', err);
            message.error('Failed to update design');
        } finally {
            setSubmitLoading(false);
        }
    };

    const columns = [
        {
            title: 'Library ID',
            dataIndex: 'libraryId',
            key: 'libraryId',
            render: (text) => <strong>{text}</strong>
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
            render: (cat) => <Tag color="blue">{cat}</Tag>
        },
        {
            title: 'Equipment Type',
            dataIndex: 'equipmentType',
            key: 'equipmentType',
        },
        {
            title: 'Variants',
            dataIndex: 'variants',
            key: 'variants',
            render: (variants) => (
                <Badge count={variants?.length || 0} style={{ backgroundColor: '#52c41a' }} />
            )
        },
        {
            title: 'Status',
            dataIndex: 'activeStatus',
            key: 'activeStatus',
            render: (status) => (
                <Badge status={status ? 'success' : 'error'} text={status ? 'Active' : 'Inactive'} />
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right',
            render: (_, record) => (
                <Space size="middle">
                    <Button 
                        type="text" 
                        icon={<Eye size={16} className="text-blue-500" />} 
                        onClick={() => handleView(record)}
                        title="View Details"
                    />
                    <Button 
                        type="text" 
                        icon={<Edit2 size={16} className="text-amber-500" />} 
                        onClick={() => handleEdit(record)}
                        title="Edit Design"
                    />
                    <Popconfirm
                        title="Delete Design"
                        description="Are you sure you want to delete this design?"
                        onConfirm={() => handleDelete(record._id)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button 
                            type="text" 
                            danger 
                            icon={<Trash2 size={16} />} 
                            title="Delete Design"
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const expandedRowRender = (record) => {
        const variantColumns = [
            { title: 'Variant ID', dataIndex: 'variantId', key: 'variantId' },
            { title: 'Name', dataIndex: 'name', key: 'name' },
            { title: 'Standard Lead Time (Days)', dataIndex: 'standardLeadTimeDays', key: 'leadTime' },
            { title: 'Complexity Score', dataIndex: 'complexityScore', key: 'complexity' },
            { title: 'Drawing Ref', dataIndex: 'drawingRef', key: 'drawing' }
        ];

        return (
            <Table
                columns={variantColumns}
                dataSource={record.variants || []}
                rowKey={(variant) => variant.variantId || variant.name}
                pagination={false}
                size="small"
                bordered
            />
        );
    };

    return (
        <div className="p-6 w-full h-full overflow-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                    <Layers size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 m-0">Design Library</h1>
                    <p className="text-slate-500 m-0">View and manage standardized equipment designs and variants.</p>
                </div>
            </div>

            <Card className="shadow-sm border-slate-200" styles={{ body: { padding: 0 } }}>
                <Table
                    columns={columns}
                    dataSource={data}
                    rowKey="_id"
                    loading={loading}
                    expandable={{ expandedRowRender }}
                    pagination={{ pageSize: 20 }}
                />
            </Card>

            {/* VIEW MODAL */}
            <Modal
                title={<div className="flex items-center gap-2"><Eye size={18} /> View Design Details</div>}
                open={viewModalVisible}
                onCancel={() => setViewModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setViewModalVisible(false)}>
                        Close
                    </Button>
                ]}
                width={700}
            >
                {currentDesign && (
                    <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                            <div>
                                <Text type="secondary" className="block text-xs uppercase tracking-wider mb-1">Library ID</Text>
                                <strong className="text-sm">{currentDesign.libraryId}</strong>
                            </div>
                            <div>
                                <Text type="secondary" className="block text-xs uppercase tracking-wider mb-1">Name</Text>
                                <span className="text-sm">{currentDesign.name}</span>
                            </div>
                            <div>
                                <Text type="secondary" className="block text-xs uppercase tracking-wider mb-1">Category</Text>
                                <Tag color="blue">{currentDesign.category}</Tag>
                            </div>
                            <div>
                                <Text type="secondary" className="block text-xs uppercase tracking-wider mb-1">Equipment Type</Text>
                                <span className="text-sm">{currentDesign.equipmentType}</span>
                            </div>
                            <div>
                                <Text type="secondary" className="block text-xs uppercase tracking-wider mb-1">Status</Text>
                                <Badge status={currentDesign.activeStatus ? 'success' : 'error'} text={currentDesign.activeStatus ? 'Active' : 'Inactive'} />
                            </div>
                        </div>

                        <div>
                            <Text strong className="mb-2 block">Variants</Text>
                            {expandedRowRender(currentDesign)}
                        </div>
                    </div>
                )}
            </Modal>

            {/* EDIT MODAL */}
            <Modal
                title={<div className="flex items-center gap-2"><Edit2 size={18} /> Edit Design</div>}
                open={editModalVisible}
                onCancel={() => setEditModalVisible(false)}
                onOk={() => form.submit()}
                confirmLoading={submitLoading}
                width={800}
                destroyOnClose
            >
                {currentDesign && (
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleUpdate}
                        className="pt-4"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                            
                            <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>

                            <Form.Item name="equipmentType" label="Equipment Type" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>

                            <Form.Item name="activeStatus" label="Active Status" valuePropName="checked">
                                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                            </Form.Item>
                        </div>

                        <div className="mt-4 border-t border-slate-200 pt-4">
                            <div className="flex items-center justify-between mb-4">
                                <Text strong>Variants</Text>
                            </div>
                            <Form.List name="variants">
                                {(fields, { add, remove }) => (
                                    <>
                                        {fields.map(({ key, name, ...restField }) => (
                                            <div key={key} className="flex gap-2 items-start mb-2 bg-slate-50 p-3 rounded-lg border border-slate-100 relative group">
                                                <div className="grid grid-cols-5 gap-2 flex-1">
                                                    <Form.Item {...restField} name={[name, 'variantId']} label="Variant ID" className="mb-0" rules={[{ required: true }]}>
                                                        <Input placeholder="ID" />
                                                    </Form.Item>
                                                    <Form.Item {...restField} name={[name, 'name']} label="Name" className="mb-0" rules={[{ required: true }]}>
                                                        <Input placeholder="Name" />
                                                    </Form.Item>
                                                    <Form.Item {...restField} name={[name, 'standardLeadTimeDays']} label="Lead Time" className="mb-0">
                                                        <InputNumber className="w-full" min={1} />
                                                    </Form.Item>
                                                    <Form.Item {...restField} name={[name, 'complexityScore']} label="Complexity" className="mb-0">
                                                        <InputNumber className="w-full" min={1} max={10} />
                                                    </Form.Item>
                                                    <Form.Item {...restField} name={[name, 'drawingRef']} label="Drawing Ref" className="mb-0">
                                                        <Input placeholder="Ref" />
                                                    </Form.Item>
                                                </div>
                                                <Button 
                                                    type="text" 
                                                    danger 
                                                    icon={<MinusCircle size={18} />} 
                                                    onClick={() => remove(name)}
                                                    className="mt-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                />
                                            </div>
                                        ))}
                                        <Form.Item>
                                            <Button type="dashed" onClick={() => add()} block icon={<Plus size={16} />}>
                                                Add Variant
                                            </Button>
                                        </Form.Item>
                                    </>
                                )}
                            </Form.List>
                        </div>
                    </Form>
                )}
            </Modal>
        </div>
    );
};

export default DesignLibraryPage;
