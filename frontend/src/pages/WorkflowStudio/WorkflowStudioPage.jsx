/**
 * WorkflowStudioPage.jsx
 * Visual node-graph editor for the MH Request workflow. Node library on the
 * left, canvas in the middle (drag nodes in, connect/label edges), parameter
 * panel on the right, and a toolbar for Save Draft / Publish / History /
 * Test Run / Export / Import — mirroring the reference workflow-builder UX.
 *
 * This is the thing that makes the workflow customizable: everything drawn
 * here is persisted as a WorkflowDefinition graph and interpreted at runtime
 * by backend/services/workflowEngine.js. Add a node, delete a node, rewire a
 * connection, publish — the next MH Request follows the new shape with zero
 * code changes.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
    useNodesState, useEdgesState, addEdge, useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import toast from 'react-hot-toast';
import { X, Loader2 } from 'lucide-react';

import api from '../../api/axiosConfig';
import * as wfDefApi from '../../api/workflowDefinitionApi';
import NodeLibrarySidebar from './NodeLibrarySidebar';
import ParamPanel from './ParamPanel';
import StudioToolbar from './StudioToolbar';
import { nodeTypes, nodeSubtitle } from './nodeTypes';

let idCounter = 1;
const nextId = (type) => `${type.toLowerCase()}-${Date.now()}-${idCounter++}`;

function toFlowNode(n) {
    return { id: n.id, type: n.type, position: n.position || { x: 0, y: 0 }, data: { label: n.label, nodeType: n.type, subtype: n.subtype, config: n.config || {} } };
}
function toFlowEdge(e) {
    return { id: e.id, source: e.source, target: e.target, label: e.label, data: { metadata: e.metadata || {}, condition: e.condition || null }, animated: false };
}
function toBackendNode(n) {
    return { id: n.id, type: n.data.nodeType, subtype: n.data.subtype, label: n.data.label, position: n.position, config: n.data.config || {} };
}
function toBackendEdge(e) {
    return { id: e.id, source: e.source, target: e.target, label: e.label || '', condition: e.data?.condition || null, metadata: e.data?.metadata || {} };
}

function Modal({ title, onClose, children, width = 480 }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ width, maxHeight: '80vh', overflowY: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{title}</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                </div>
                <div style={{ padding: 18 }}>{children}</div>
            </div>
        </div>
    );
}

function StudioCanvas() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState(null);
    const [roles, setRoles] = useState([]);
    const [versionLabel, setVersionLabel] = useState('DRAFT');
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyRows, setHistoryRows] = useState([]);
    const [testRunOpen, setTestRunOpen] = useState(false);
    const [testDecisions, setTestDecisions] = useState('Approved');
    const [testResult, setTestResult] = useState(null);
    const [testLoading, setTestLoading] = useState(false);
    const [customPresets, setCustomPresets] = useState([]);

    const wrapperRef = useRef(null);
    const { screenToFlowPosition } = useReactFlow();

    const loadDraft = useCallback(async () => {
        try {
            const draft = await wfDefApi.getDraft();
            setNodes((draft.nodes || []).map(toFlowNode));
            setEdges((draft.edges || []).map(toFlowEdge));
        } catch (e) {
            if (e?.response?.status === 404) {
                toast.error('No draft found — ask an admin to run the workflow seed script first.');
            } else {
                toast.error(e?.response?.data?.message || 'Failed to load workflow draft');
            }
        }
    }, [setNodes, setEdges]);

    const loadPresets = useCallback(async () => {
        try {
            const res = await wfDefApi.getPresets();
            setCustomPresets(res.data || []);
        } catch (e) {
            // Non-fatal — the CUSTOM section just stays empty if this fails.
        }
    }, []);

    useEffect(() => {
        loadDraft();
        loadPresets();
        api.get('/roles').then(res => setRoles((res.data || []).map(r => r.name))).catch(() => {});
        wfDefApi.getHistory().then(res => {
            const latest = res.data?.[0];
            if (latest) setVersionLabel(`PUBLISHED V${latest.version}`);
        }).catch(() => {});
    }, [loadDraft, loadPresets]);

    const handleSaveAsPreset = async ({ label, nodeType, subtype, config }) => {
        try {
            await wfDefApi.createPreset({ label, nodeType, subtype, config });
            toast.success(`Saved "${label}" to the CUSTOM library section.`);
            loadPresets();
        } catch (e) {
            toast.error(e?.response?.data?.message || 'Failed to save preset');
        }
    };

    const handleDeletePreset = async (presetId) => {
        try {
            await wfDefApi.deletePreset(presetId);
            loadPresets();
        } catch (e) {
            toast.error('Failed to delete preset');
        }
    };

    // Keep each node's subtitle (decisions/config summary) in sync as config changes
    useEffect(() => {
        setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, subtitle: nodeSubtitle({ type: n.data.nodeType, config: n.data.config }) } })));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onConnect = useCallback((connection) => {
        setEdges(eds => addEdge({ ...connection, id: `e-${Date.now()}-${idCounter++}`, label: '', data: { metadata: {}, condition: null } }, eds));
    }, [setEdges]);

    const onDragOver = useCallback((event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);

    const onDrop = useCallback((event) => {
        event.preventDefault();
        const raw = event.dataTransfer.getData('application/studio-node');
        if (!raw) return;
        const item = JSON.parse(raw);
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const id = nextId(item.type);
        setNodes(nds => nds.concat({
            id, type: item.type, position,
            data: { label: item.label, nodeType: item.type, subtype: item.subtype, config: item.config, subtitle: nodeSubtitle({ type: item.type, config: item.config }) }
        }));
    }, [screenToFlowPosition, setNodes]);

    const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);
    const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId) || null, [edges, selectedEdgeId]);

    const onUpdateNode = (id, config, label) => {
        setNodes(nds => nds.map(n => n.id === id
            ? { ...n, data: { ...n.data, config, label, subtitle: nodeSubtitle({ type: n.data.nodeType, config }) } }
            : n));
    };
    const onDeleteNode = (id) => {
        setNodes(nds => nds.filter(n => n.id !== id));
        setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
        setSelectedNodeId(null);
    };
    const onUpdateEdge = (id, label) => {
        setEdges(eds => eds.map(e => e.id === id ? { ...e, label } : e));
    };
    const onDeleteEdge = (id) => {
        setEdges(eds => eds.filter(e => e.id !== id));
        setSelectedEdgeId(null);
    };

    const currentGraph = () => ({
        name: 'MH Request Approval Workflow',
        nodes: nodes.map(toBackendNode),
        edges: edges.map(toBackendEdge)
    });

    const handleSaveDraft = async () => {
        setSaving(true);
        try {
            await wfDefApi.saveDraft(currentGraph());
            toast.success('Draft saved.');
        } catch (e) {
            toast.error(e?.response?.data?.message || 'Failed to save draft');
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        setSaving(true);
        try {
            await wfDefApi.saveDraft(currentGraph());
        } finally {
            setSaving(false);
        }
        setPublishing(true);
        try {
            const published = await wfDefApi.publish();
            setVersionLabel(`PUBLISHED V${published.version}`);
            toast.success(`Published v${published.version}. New requests and next transitions now use this graph.`);
        } catch (e) {
            const problems = e?.response?.data?.problems;
            if (problems?.length) {
                toast.error(`Graph failed validation:\n${problems.slice(0, 3).join('\n')}`, { duration: 8000 });
            } else {
                toast.error(e?.response?.data?.message || 'Failed to publish');
            }
        } finally {
            setPublishing(false);
        }
    };

    const handleExport = async () => {
        try {
            const data = await wfDefApi.exportDefinition();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'mh-request-workflow.json'; a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast.error('Failed to export workflow');
        }
    };

    const handleImportFile = async (file) => {
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const imported = await wfDefApi.importDefinition(parsed);
            setNodes((imported.nodes || []).map(toFlowNode));
            setEdges((imported.edges || []).map(toFlowEdge));
            toast.success('Workflow imported into draft. Review and Publish to activate.');
        } catch (e) {
            toast.error(e?.response?.data?.message || 'Failed to import — check the file is a valid workflow export');
        }
    };

    const openHistory = async () => {
        try {
            const res = await wfDefApi.getHistory();
            setHistoryRows(res.data || []);
            setHistoryOpen(true);
        } catch (e) {
            toast.error('Failed to load version history');
        }
    };

    const loadVersionIntoDraft = async (version) => {
        try {
            const v = await wfDefApi.getVersion(version);
            setNodes((v.nodes || []).map(toFlowNode));
            setEdges((v.edges || []).map(toFlowEdge));
            setHistoryOpen(false);
            toast.success(`Loaded v${version} into the draft for editing. Save or Publish to keep it.`);
        } catch (e) {
            toast.error('Failed to load version');
        }
    };

    const runTest = async () => {
        setTestLoading(true);
        setTestResult(null);
        try {
            await wfDefApi.saveDraft(currentGraph());
            const decisions = testDecisions.split(',').map(s => s.trim()).filter(Boolean);
            const result = await wfDefApi.testRun({ decisions });
            setTestResult(result);
        } catch (e) {
            toast.error(e?.response?.data?.message || 'Test run failed');
        } finally {
            setTestLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <StudioToolbar
                versionLabel={versionLabel}
                saving={saving}
                publishing={publishing}
                onSaveDraft={handleSaveDraft}
                onPublish={handlePublish}
                onOpenHistory={openHistory}
                onOpenTestRun={() => { setTestResult(null); setTestRunOpen(true); }}
                onExport={handleExport}
                onImportFile={handleImportFile}
            />
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                <NodeLibrarySidebar customPresets={customPresets} onDeletePreset={handleDeletePreset} />
                <div ref={wrapperRef} style={{ flex: 1 }} onDragOver={onDragOver} onDrop={onDrop}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }}
                        onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
                        onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
                        fitView
                    >
                        <Background gap={16} color="#e2e8f0" />
                        <Controls />
                        <MiniMap pannable zoomable />
                    </ReactFlow>
                </div>
                <ParamPanel
                    selectedNode={selectedNode}
                    selectedEdge={selectedEdge}
                    roles={roles}
                    onUpdateNode={onUpdateNode}
                    onUpdateEdge={onUpdateEdge}
                    onDeleteNode={onDeleteNode}
                    onDeleteEdge={onDeleteEdge}
                    onClose={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
                    onSaveAsPreset={handleSaveAsPreset}
                />
            </div>

            {historyOpen && (
                <Modal title="Published Version History" onClose={() => setHistoryOpen(false)} width={520}>
                    {historyRows.length === 0 ? (
                        <div style={{ color: '#94a3b8', fontSize: 13 }}>No published versions yet.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {historyRows.map(v => (
                                <div key={v.version} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                                            v{v.version} {v.isActive && <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 800 }}> · ACTIVE</span>}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                            {v.publishedAt ? new Date(v.publishedAt).toLocaleString() : '—'} {v.publishedBy?.email ? `· ${v.publishedBy.email}` : ''}
                                        </div>
                                    </div>
                                    <button onClick={() => loadVersionIntoDraft(v.version)} style={{ ...btnSmall }}>Load into Draft</button>
                                </div>
                            ))}
                        </div>
                    )}
                </Modal>
            )}

            {testRunOpen && (
                <Modal title="Test Run (dry-run — no requests are created or modified)" onClose={() => setTestRunOpen(false)} width={520}>
                    <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                            Decision sequence (comma separated, in the order you'd make them)
                        </label>
                        <input
                            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6 }}
                            value={testDecisions}
                            onChange={e => setTestDecisions(e.target.value)}
                            placeholder="Approved, Assigned, Submit, Approve, Approve, Start Production, Mark Implementation, Mark Completed"
                        />
                    </div>
                    <button onClick={runTest} disabled={testLoading} style={{ ...btnSmall, marginBottom: 14 }}>
                        {testLoading ? <Loader2 size={14} className="animate-spin" /> : 'Run'}
                    </button>
                    {testResult && (
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Path taken:</div>
                            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                                {testResult.path.map((id, i) => {
                                    const n = nodes.find(n => n.id === id);
                                    return <li key={i}>{n ? `${n.data.label} (${n.data.nodeType})` : id}</li>;
                                })}
                            </ol>
                            <div style={{ marginTop: 10, fontSize: 12, color: '#0f4c81', fontWeight: 600 }}>{testResult.stoppedReason}</div>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
}

const btnSmall = {
    padding: '6px 12px', fontSize: 12, fontWeight: 700, border: '1px solid #0F4C81',
    background: '#0F4C81', color: '#fff', borderRadius: 6, cursor: 'pointer'
};

export default function WorkflowStudioPage() {
    return (
        <div style={{ height: 'calc(100vh - 32px)', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', margin: 16, background: '#f8fafc' }}>
            <ReactFlowProvider>
                <StudioCanvas />
            </ReactFlowProvider>
        </div>
    );
}
