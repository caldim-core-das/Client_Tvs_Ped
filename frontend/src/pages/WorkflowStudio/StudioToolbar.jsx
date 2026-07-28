import React from 'react';
import { History, Download, Upload, Play, Save, UploadCloud, Loader2 } from 'lucide-react';

export default function StudioToolbar({
    versionLabel, saving, publishing,
    onSaveDraft, onPublish, onOpenHistory, onOpenTestRun, onExport, onImportFile
}) {
    const fileInputRef = React.useRef(null);

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
            <div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.4 }}>MH REQUEST WORKFLOW</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Workflow Studio</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 999 }}>
                        {versionLabel}
                    </span>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onOpenHistory} style={btnStyle}><History size={14} /> History</button>
                <button onClick={onExport} style={btnStyle}><Download size={14} /> Export</button>
                <button onClick={() => fileInputRef.current?.click()} style={btnStyle}><Upload size={14} /> Import</button>
                <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ''; }} />
                <button onClick={onOpenTestRun} style={btnStyle}><Play size={14} /> Test Run</button>
                <button onClick={onSaveDraft} disabled={saving} style={btnStyle}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Draft
                </button>
                <button onClick={onPublish} disabled={publishing} style={{ ...btnStyle, background: '#0F4C81', color: '#fff', border: '1px solid #0F4C81' }}>
                    {publishing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Publish
                </button>
            </div>
        </div>
    );
}

const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 12, fontWeight: 700,
    border: '1px solid #e2e8f0', background: '#fff', color: '#334155', borderRadius: 8, cursor: 'pointer'
};
