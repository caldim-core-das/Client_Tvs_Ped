import React, { useState, useEffect } from 'react';
import {
    Drawer, Tabs, Tag, Steps, Spin, Button, Collapse, Divider, Tooltip, Select, message
} from 'antd';
import {
    FileText, Mail, GitBranch, Clock, User, MapPin,
    Wrench, ChevronDown, AlertCircle, CheckCircle2, XCircle
} from 'lucide-react';
import api from '../../api/axiosConfig';

const { TabPane } = Tabs;
const { Step } = Steps;
const { Panel } = Collapse;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
};

/** Colour map for acceptance status */
const STATUS_COLOR = {
    Active: 'blue',
    Accepted: 'green',
    Rejected: 'red'
};

/** Colour map for workflowStatus */
const WORKFLOW_COLOR = {
    Pending:     'gold',
    Notified:    'blue',
    Assigned:    'green',
    Rejected:    'red',
    'In Progress': 'purple',
    Completed:   'cyan'
};

const WORKFLOW_STEPS = [
    { key: 'Pending',     label: 'Request Submitted' },
    { key: 'Notified',    label: 'Email Sent to Approver' },
    { key: 'Assigned',    label: 'Engineer Assigned' },
    { key: 'In Progress', label: 'Work In Progress' },
    { key: 'Completed',   label: 'Completed' },
];

const WORKFLOW_ORDER = WORKFLOW_STEPS.map(s => s.key);

// ── Field row helper ──────────────────────────────────────────────────────────
const Field = ({ label, value, span = false }) => (
    <div className={`${span ? 'col-span-2' : ''} mb-3`}>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-800 break-words">{value || '—'}</p>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  MHRequestSubPanel
// ─────────────────────────────────────────────────────────────────────────────
const MHRequestSubPanel = ({ requestId, visible, onClose }) => {
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('1');
    const [designers, setDesigners] = useState([]);
    const [selectedDesignerId, setSelectedDesignerId] = useState(null);
    const [assigningDesigner, setAssigningDesigner] = useState(false);

    useEffect(() => {
        if (!visible || !requestId) return;
        setLoading(true);
        api.get(`/asset-request/${requestId}`)
            .then(res => setRequest(res.data))
            .catch(() => setRequest(null))
            .finally(() => setLoading(false));

        // Fetch active Designers from Employee Master
        api.get('/employees?limit=100')
            .then(res => {
                const list = (res.data?.data || []).filter(e => /^designer$/i.test(e.role || ''));
                setDesigners(list);
            })
            .catch(() => setDesigners([]));
    }, [visible, requestId]);

    const handleAssignDesigner = async () => {
        if (!selectedDesignerId || !requestId) return;
        setAssigningDesigner(true);
        try {
            await api.patch(`/asset-request/${requestId}/assign-designer`, { designerId: selectedDesignerId });
            const res = await api.get(`/asset-request/${requestId}`);
            setRequest(res.data);
            message.success('Designer assigned successfully! Email notification sent.');
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to assign designer.');
        } finally {
            setAssigningDesigner(false);
        }
    };

    // ── Compute stepper current index ──────────────────────────────────────
    const workflowStatus = request?.workflowStatus || 'Pending';
    const currentStepIdx = Math.max(WORKFLOW_ORDER.indexOf(workflowStatus), 0);

    return (
        <Drawer
            title={
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-tvs-primary/10 flex items-center justify-center">
                        <FileText size={18} className="text-tvs-primary" />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 text-sm m-0">
                            {request?.mhRequestId || 'Loading…'}
                        </p>
                        <p className="text-xs text-gray-400 m-0">{request?.handlingPartName}</p>
                    </div>
                    {request && (
                        <div className="ml-3 flex gap-2">
                            <Tag color={STATUS_COLOR[request.status] || 'default'} className="font-bold rounded-lg">
                                {request.status}
                            </Tag>
                            <Tag color={WORKFLOW_COLOR[request.workflowStatus] || 'default'} className="font-bold rounded-lg">
                                {request.workflowStatus || 'Pending'}
                            </Tag>
                        </div>
                    )}
                </div>
            }
            placement="right"
            width={Math.min(window.innerWidth * 0.55, 680)}
            open={visible}
            onClose={onClose}
            destroyOnClose
            styles={{ body: { padding: '0', overflow: 'hidden' } }}
        >
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Spin size="large" />
                </div>
            ) : !request ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <AlertCircle size={32} className="mb-2" />
                    <p>Could not load request details</p>
                </div>
            ) : (
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    tabBarStyle={{ padding: '0 24px', marginBottom: 0 }}
                    className="h-full"
                    size="small"
                >
                    {/* ═══════════════════════════════════════
                        TAB 1 — Asset / Request Details
                    ═══════════════════════════════════════ */}
                    <TabPane
                        tab={<span className="flex items-center gap-1.5"><FileText size={13} /> Asset Details</span>}
                        key="1"
                    >
                        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 160px)' }}>
                            {/* ── Metadata row ── */}
                            <div className="grid grid-cols-2 gap-x-6">
                                <Field label="Request ID" value={request.mhRequestId} />
                                <Field label="Request Type" value={request.requestType} />
                                <Field label="Submitted By" value={request.userName} />
                                <Field label="Department" value={request.departmentName} />
                                <Field label="Plant Location" value={request.plantLocation} />
                                <Field label="Base Location" value={request.location} />
                                <Field label="Created At" value={fmt(request.createdAt)} />
                                <Field label="Updated At" value={fmt(request.updatedAt)} />
                            </div>

                            <Divider className="my-3" orientation="left" orientationMargin={0}>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Equipment &amp; Flow</span>
                            </Divider>

                            <div className="grid grid-cols-2 gap-x-6">
                                <Field label="Product Model" value={request.productModel} />
                                <Field label="Handling Part Name" value={request.handlingPartName} />
                                <Field label="Material Handling Equipment" value={request.materialHandlingEquipment} />
                                <Field label="Handling Location" value={request.materialHandlingLocation} />
                                <Field label="Flow (From → To)" value={`${request.from || '—'} → ${request.to || '—'}`} />
                                <Field label="Volume / Day" value={request.volumePerDay} />
                                <Field label="Problem Statement" value={request.problemStatement} span />
                            </div>

                            <Divider className="my-3" orientation="left" orientationMargin={0}>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Assignment</span>
                            </Divider>

                            <div className="grid grid-cols-2 gap-x-6">
                                <div className="mb-3">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Assigned Engineer</p>
                                    {request.assignedEngineer ? (
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">
                                                {request.assignedEngineer.employeeName}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {request.assignedEngineer.employeeId} · {request.assignedEngineer.mailId}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-amber-500 font-semibold">Not yet assigned</p>
                                    )}
                                </div>
                                <Field label="Assigned At" value={fmt(request.assignedAt)} />

                                <div className="mb-3">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Assigned Designer</p>
                                    {request.assignedDesigner ? (
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">
                                                {request.assignedDesigner.employeeName}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {request.assignedDesigner.employeeId} · {request.assignedDesigner.mailId}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-purple-600 font-semibold">Pending Designer Assignment</p>
                                    )}
                                </div>

                                <div className="mb-3">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Approver</p>
                                    {request.approver ? (
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">
                                                {request.approver.employeeName}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {request.approver.mailId}
                                            </p>
                                        </div>
                                    ) : request.approverEmail ? (
                                        <p className="text-sm font-semibold text-gray-800">{request.approverEmail}</p>
                                    ) : (
                                        <p className="text-sm text-gray-400">—</p>
                                    )}
                                </div>

                                {/* ── PED Engineer Action: Select and Assign a Designer ── */}
                                <div className="col-span-2 mt-2 p-4 bg-purple-50/70 border border-purple-100 rounded-xl">
                                    <p className="text-xs font-bold text-purple-900 mb-1 flex items-center gap-1.5">
                                        🎨 Assign a Designer for Product Design
                                    </p>
                                    <p className="text-xs text-gray-500 mb-3">
                                        Select a Designer from Employee Master to assign them to this MH Request. The designer will receive an email notification automatically.
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <Select
                                            placeholder="Select a Designer..."
                                            style={{ flex: 1 }}
                                            value={selectedDesignerId}
                                            onChange={setSelectedDesignerId}
                                            size="middle"
                                        >
                                            {designers.map(d => (
                                                <Select.Option key={d._id} value={d._id}>
                                                    {d.employeeName} ({d.employeeId} · {d.departmentName || 'Designer'})
                                                </Select.Option>
                                            ))}
                                        </Select>
                                        <Button
                                            type="primary"
                                            danger
                                            loading={assigningDesigner}
                                            disabled={!selectedDesignerId}
                                            onClick={handleAssignDesigner}
                                            size="middle"
                                            className="font-bold"
                                        >
                                            Assign Designer
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabPane>

                    {/* ═══════════════════════════════════════
                        TAB 2 — Mail Sent Details
                    ═══════════════════════════════════════ */}
                    <TabPane
                        tab={
                            <span className="flex items-center gap-1.5">
                                <Mail size={13} /> Mail Log
                                {request.emailLog?.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-tvs-primary text-white text-[10px] rounded-full font-bold">
                                        {request.emailLog.length}
                                    </span>
                                )}
                            </span>
                        }
                        key="2"
                    >
                        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 160px)' }}>
                            {!request.emailLog || request.emailLog.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <Mail size={32} className="mb-2 text-gray-300" />
                                    <p className="font-semibold">No emails sent yet</p>
                                    <p className="text-xs mt-1">Submit the request and send an approver notification to see the log here.</p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs text-gray-500 mb-4 font-semibold">
                                        {request.emailLog.length} email(s) sent for this request
                                    </p>
                                    <div className="space-y-3">
                                        {[...request.emailLog].reverse().map((entry, idx) => (
                                            <div
                                                key={entry._id || idx}
                                                className="border border-gray-100 rounded-xl overflow-hidden hover:border-blue-100 transition-colors"
                                            >
                                                <div className="flex items-start justify-between px-4 py-3 bg-gray-50">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Tag
                                                                color={entry.status === 'Delivered' ? 'green' : 'red'}
                                                                className="text-[10px] font-bold rounded-lg m-0"
                                                            >
                                                                {entry.status === 'Delivered'
                                                                    ? <><CheckCircle2 size={10} className="inline mr-1" />Delivered</>
                                                                    : <><XCircle size={10} className="inline mr-1" />Failed</>
                                                                }
                                                            </Tag>
                                                            <span className="text-xs text-gray-400">{fmt(entry.sentAt)}</span>
                                                        </div>
                                                        <p className="text-sm font-semibold text-gray-800 truncate mb-0.5">
                                                            {entry.subject}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            To: <span className="font-medium text-gray-700">{entry.to}</span>
                                                            {entry.cc && <> · CC: <span className="font-medium text-gray-700">{entry.cc}</span></>}
                                                        </p>
                                                    </div>
                                                </div>
                                                {entry.body && (
                                                    <Collapse ghost>
                                                        <Panel
                                                            header={<span className="text-xs text-tvs-primary font-semibold">Preview Body</span>}
                                                            key="1"
                                                        >
                                                            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed bg-white p-3 rounded-lg border border-gray-100 max-h-60 overflow-auto">
                                                                {entry.body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')}
                                                            </pre>
                                                        </Panel>
                                                    </Collapse>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </TabPane>

                    {/* ═══════════════════════════════════════
                        TAB 3 — Assignment Status / Stepper
                    ═══════════════════════════════════════ */}
                    <TabPane
                        tab={<span className="flex items-center gap-1.5"><GitBranch size={13} /> Assignment Status</span>}
                        key="3"
                    >
                        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 160px)' }}>
                            {/* ── Current workflow status badge ── */}
                            <div className="mb-6 flex items-center gap-3">
                                <Tag
                                    color={WORKFLOW_COLOR[workflowStatus] || 'default'}
                                    className="px-4 py-1 text-sm font-bold rounded-full"
                                    style={{ fontSize: 14 }}
                                >
                                    {workflowStatus}
                                </Tag>
                                <span className="text-xs text-gray-500">Current workflow status</span>
                            </div>

                            {/* ── Visual stepper ── */}
                            <Steps
                                direction="vertical"
                                current={currentStepIdx}
                                size="small"
                                className="mb-6"
                            >
                                {WORKFLOW_STEPS.map((step, i) => {
                                    let status = 'wait';
                                    if (i < currentStepIdx) status = 'finish';
                                    else if (i === currentStepIdx) status = 'process';

                                    // Special: if workflowStatus === 'Rejected', mark current as 'error'
                                    if (workflowStatus === 'Rejected' && i === currentStepIdx) status = 'error';

                                    // Attach timestamps for known milestones
                                    let description = null;
                                    if (step.key === 'Pending' && request.createdAt) {
                                        description = <span className="text-xs text-gray-400">{fmt(request.createdAt)}</span>;
                                    }
                                    if (step.key === 'Notified' && request.emailLog?.length > 0) {
                                        const first = request.emailLog[0];
                                        description = <span className="text-xs text-gray-400">{fmt(first.sentAt)} → {first.to}</span>;
                                    }
                                    if (step.key === 'Assigned' && request.assignedAt) {
                                        const eng = request.assignedEngineer;
                                        description = (
                                            <span className="text-xs text-gray-400">
                                                {fmt(request.assignedAt)}
                                                {eng && ` · ${eng.employeeName} (${eng.employeeId})`}
                                            </span>
                                        );
                                    }

                                    return (
                                        <Step
                                            key={step.key}
                                            status={status}
                                            title={<span className="font-semibold text-gray-800 text-sm">{step.label}</span>}
                                            description={description || (i > currentStepIdx
                                                ? <span className="text-xs text-gray-300">Pending</span>
                                                : null)}
                                        />
                                    );
                                })}
                            </Steps>

                            {/* ── Status legend ── */}
                            <Divider className="my-4" />
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">Status Reference</p>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(WORKFLOW_COLOR).map(([k, color]) => (
                                    <Tag key={k} color={color} className="rounded-lg font-semibold">{k}</Tag>
                                ))}
                            </div>

                            {/* ── Remark / Notes ── */}
                            {request.remark && (
                                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-1">Remark</p>
                                    <p className="text-sm text-gray-700">{request.remark}</p>
                                </div>
                            )}
                        </div>
                    </TabPane>
                </Tabs>
            )}
        </Drawer>
    );
};

export default MHRequestSubPanel;
