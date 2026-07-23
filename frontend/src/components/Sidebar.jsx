import React, { useState, useEffect, useCallback } from 'react';
import {
    Home, Settings, FileText, ClipboardList, Users, Shield,
    BarChart2, TrendingUp, Menu, ChevronLeft, ChevronDown,
    Layers, Package, PieChart, Factory, Sliders, Palette,
    Type, Layout as LayoutIcon, Check,
    // Workflow icons
    GitBranch, Pencil, CheckSquare, Award, Inbox
} from 'lucide-react';

import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Tooltip } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

/* ══════════════════════════════════════════════════
   COLOR THEMES  (8 total: 6 dark + white + black)
══════════════════════════════════════════════════ */
export const COLOR_THEMES = [
    {
        key: 'navy', label: 'Navy',
        bg: 'linear-gradient(180deg,#7A0F0F 0%,#991515 60%,#091526 100%)',
        accent: '#00C9A7', preview: '#991515', isLight: false,
    },
    {
        key: 'slate', label: 'Slate',
        bg: 'linear-gradient(180deg,#1e293b 0%,#0f172a 100%)',
        accent: '#38bdf8', preview: '#1e293b', isLight: false,
    },
    {
        key: 'forest', label: 'Forest',
        bg: 'linear-gradient(180deg,#052e16 0%,#14532d 60%,#052e16 100%)',
        accent: '#4ade80', preview: '#14532d', isLight: false,
    },
    {
        key: 'violet', label: 'Violet',
        bg: 'linear-gradient(180deg,#2e1065 0%,#1e1b4b 60%,#0d0a2e 100%)',
        accent: '#a78bfa', preview: '#2e1065', isLight: false,
    },
    {
        key: 'crimson', label: 'Crimson',
        bg: 'linear-gradient(180deg,#3b0018 0%,#560020 60%,#1e0010 100%)',
        accent: '#fb7185', preview: '#560020', isLight: false,
    },
    {
        key: 'midnight', label: 'Dark',
        bg: 'linear-gradient(180deg,#09090b 0%,#18181b 60%,#09090b 100%)',
        accent: '#fbbf24', preview: '#18181b', isLight: false,
    },
    /* ── NEW ── */
    {
        key: 'white', label: 'White',
        bg: 'linear-gradient(180deg,#ffffff 0%,#f8fafc 60%,#f1f5f9 100%)',
        accent: '#CC1F1F', preview: '#f8fafc', isLight: true,
    },
    {
        key: 'tvs-red', label: 'TVS Red',
        bg: '#CC1F1F',
        accent: '#ffffff', preview: '#CC1F1F', isLight: false,
    },
    {
        key: 'black', label: 'Black',
        bg: 'linear-gradient(180deg,#000000 0%,#0a0a0a 60%,#000000 100%)',
        accent: '#00C9A7', preview: '#000000', isLight: false,
    },
];

export const FONT_OPTIONS = [
    { key: 'inter',  label: 'Inter',   style: "'Inter', sans-serif" },
    { key: 'outfit', label: 'Outfit',  style: "'Outfit', sans-serif" },
    { key: 'dm',     label: 'DM Sans', style: "'DM Sans', sans-serif" },
    { key: 'mono',   label: 'Mono',    style: "'JetBrains Mono', 'Fira Mono', monospace" },
];

export const LAYOUT_OPTIONS = [
    { key: 'spacious', label: 'Spacious', itemPY: 14, iconSize: 36 },
    { key: 'normal',   label: 'Normal',   itemPY: 11, iconSize: 34 },
    { key: 'compact',  label: 'Compact',  itemPY: 8,  iconSize: 30 },
];

/* ── localStorage helpers ── */
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ══════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════ */
const Sidebar = ({ isSidebarOpen, setIsSidebarOpen, windowWidth }) => {
    const { hasPermission, hasRole, user } = useAuth();
    const location = useLocation();
    const navigate  = useNavigate();

    // ── Workflow queue badge counts ────────────────────────────────────────
    const [queueCounts, setQueueCounts] = useState({ l1: 0, design: 0, checker: 0, final: 0 });

    const fetchQueueCounts = useCallback(async () => {
        if (!user) return;
        const role = user.role;
        const token = sessionStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const base = import.meta.env.VITE_API_BASE_URL || '';

        const fetchCount = async (queueType) => {
            try {
                const res = await fetch(`${base}/api/workflow/queue/${queueType}`, { headers });
                if (!res.ok) return 0;
                const data = await res.json();
                return data.count ?? 0;
            } catch { return 0; }
        };

        const updates = {};
        if (role === 'L1 Approver' || role === 'PED Engineer' || role === 'Admin') {
            updates.l1 = await fetchCount('l1');
        }
        if (role === 'Designer' || role === 'PED Engineer' || role === 'Admin') {
            updates.design = await fetchCount('design');
        }
        if (role === 'Checker' || role === 'Admin') {
            updates.checker = await fetchCount('checker');
        }
        if (role === 'Final Approver' || role === 'Admin') {
            updates.final = await fetchCount('final');
        }
        setQueueCounts(prev => ({ ...prev, ...updates }));
    }, [user]);

    useEffect(() => {
        fetchQueueCounts();
        // Refresh counts every 60 seconds
        const interval = setInterval(fetchQueueCounts, 60000);
        return () => clearInterval(interval);
    }, [fetchQueueCounts]);


    const [activeTheme,  setActiveTheme]  = useState(() => load('sb_theme',  'white'));
    const [activeFont,   setActiveFont]   = useState(() => load('sb_font',   'inter'));
    const [activeLayout, setActiveLayout] = useState(() => load('sb_layout', 'normal'));

    // Listen for theme updates from Settings page
    React.useEffect(() => {
        const handleThemeUpdate = () => {
            setActiveTheme(load('sb_theme', 'white'));
            setActiveFont(load('sb_font', 'inter'));
            setActiveLayout(load('sb_layout', 'normal'));
        };
        window.addEventListener('sidebar_theme_update', handleThemeUpdate);
        return () => window.removeEventListener('sidebar_theme_update', handleThemeUpdate);
    }, []);

    const theme  = COLOR_THEMES.find(t => t.key  === activeTheme)  ?? COLOR_THEMES[0];
    const font   = FONT_OPTIONS.find(f => f.key   === activeFont)   ?? FONT_OPTIONS[0];
    const layout = LAYOUT_OPTIONS.find(l => l.key === activeLayout) ?? LAYOUT_OPTIONS[1];

    /* ── Dynamic color tokens (dark vs light sidebar) ── */
    const lx = theme.isLight;
    const tc = {
        text:    lx ? '#020617'              : '#ffffff',
        text80:  lx ? '#0f172a'              : '#f8fafc',
        muted:   lx ? '#334155'              : '#cbd5e1',
        muted2:  lx ? '#475569'              : '#94a3b8',
        label:   lx ? '#1e293b'              : '#e2e8f0',
        border:  lx ? 'rgba(0,0,0,0.08)'     : 'rgba(255,255,255,0.07)',
        iconBg:  lx ? 'rgba(13,27,62,0.06)'  : 'rgba(255,255,255,0.05)',
        panelBg: lx ? 'rgba(0,0,0,0.04)'     : 'rgba(0,0,0,0.35)',
        panelBorder: lx ? `rgba(0,0,0,0.08)` : `${theme.accent}22`,
        custBtnBg: lx ? 'rgba(0,0,0,0.04)'   : 'rgba(255,255,255,0.05)',
        custBtnBorder: lx ? 'rgba(0,0,0,0.1)': 'rgba(255,255,255,0.08)',
        scrollTrack: lx ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)',
    };

    const applyTheme  = k => { setActiveTheme(k);  save('sb_theme',  k); window.dispatchEvent(new Event('sidebar_theme_update')); };
    const applyFont   = k => { setActiveFont(k);   save('sb_font',   k); window.dispatchEvent(new Event('sidebar_theme_update')); };
    const applyLayout = k => { setActiveLayout(k); save('sb_layout', k); window.dispatchEvent(new Event('sidebar_theme_update')); };


    // ── Build WORKFLOW section items based on current user role ─────────────────
    const workflowItems = [];
    const role = user?.role;

    if (role === 'L1 Approver' || role === 'PED Engineer' || role === 'Admin') {
        workflowItems.push({
            name: 'L1 Approval Queue',  short: 'L1 Queue', icon: Inbox,
            path: '/workflow-queue/l1',
            permission: 'l1ApprovalQueue',
            badge: queueCounts.l1,      badgeColor: '#f59e0b'
        });
    }
    if (role === 'Designer' || role === 'PED Engineer' || role === 'Admin') {
        workflowItems.push({
            name: 'Design Queue',  short: 'Design Q', icon: Pencil,
            path: '/design-queue',
            permission: 'designQueue',
            badge: queueCounts.design,  badgeColor: '#7c3aed'
        });
    }
    if (role === 'Checker' || role === 'Admin') {
        workflowItems.push({
            name: 'Checker Queue',  short: 'Check Q', icon: CheckSquare,
            path: '/checker-queue',
            permission: 'checkerQueue',
            badge: queueCounts.checker, badgeColor: '#0891b2'
        });
    }
    if (role === 'Final Approver' || role === 'Admin') {
        workflowItems.push({
            name: 'Final Approval',  short: 'Final Q', icon: Award,
            path: '/final-approval-queue',
            permission: 'finalApproval',
            badge: queueCounts.final,   badgeColor: '#16a34a'
        });
    }

    const NAV_SECTIONS = [
        { label: 'OPERATIONS', items: [
            { name: 'Dashboard',        short: 'Dashboard',  icon: Home,          path: '/',                        permission: 'dashboard' },
            { name: 'MH Request',       short: 'MH Request', icon: FileText,      path: '/mh-requests',             permission: 'mhRequest' },
            { name: 'All Requests Overview', short: 'Overview',  icon: ClipboardList, path: '/request-tracker',         permission: 'allRequestsOverview' },
            { name: 'MH Development',   short: 'MH Dev',     icon: TrendingUp,    path: '/mh-development-tracker',  permission: 'mhDevelopment' },
            { name: 'Project Plan Tracking', short: 'Plan Track', icon: LayoutIcon, path: '/project-plan-model', permission: 'projectPlanTracking' },
        ]},
        // Workflow queues — only shown if user has at least one queue
        ...(workflowItems.length > 0 ? [{ label: 'WORKFLOW', items: workflowItems }] : []),
        { label: 'ASSETS', items: [
            { name: 'Asset Management', short: 'Assets',     icon: Package,       path: '/asset-management-update', permission: 'assetManagement' },
            { name: 'Asset Summary',    short: 'Summary',    icon: ClipboardList, path: '/asset-summary',           permission: 'assetSummary' },
            { name: 'Design Library',   short: 'Library',    icon: Palette,       path: '/design-library',          permission: 'designLibrary' },
        ]},
        { label: 'MANAGEMENT', items: [
            { name: 'Employee Master',  short: 'Employees',  icon: Users,         path: '/employee-master',         permission: 'employeeMaster' },
            { name: 'Vendor Master',    short: 'Vendors',    icon: Layers,        path: '/vendor-master',           permission: 'vendorMaster' },
            { name: 'Vendor Scoring',   short: 'Scoring',    icon: PieChart,      path: '/vendor-master/scoring',   permission: 'vendorScoring' },
            { name: 'Vendor Loading',   short: 'Loading',    icon: BarChart2,     path: '/vendor-master/loading',   permission: 'vendorLoading' },
        ]},
        { label: 'SYSTEM', items: [
            { name: 'Settings',         short: 'Settings',   icon: Settings,      path: '/settings',                permission: 'settings' },
        ]},
    ];


    const panelV = {
        hidden:  { opacity: 0, y: -8, scaleY: 0.94 },
        visible: { opacity: 1, y: 0,  scaleY: 1, transition: { type: 'spring', stiffness: 340, damping: 28 } },
        exit:    { opacity: 0, y: -6, scaleY: 0.94, transition: { duration: 0.16 } },
    };

    return (
        <>
            {/* Mobile overlay */}
            <AnimatePresence>
                {windowWidth <= 1024 && isSidebarOpen && (
                    <motion.div
                        key="sidebar-backdrop"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/50 z-backdrop lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            <motion.aside
                key="sidebar"
                initial={{ x: windowWidth <= 1024 ? -280 : 0, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -280, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 32 }}
                className="h-screen fixed left-0 top-0 z-sidebar flex flex-col overflow-hidden"
                style={{
                    width: isSidebarOpen ? 220 : 64,
                    transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
                    background: theme.bg,
                    fontFamily: font.style,
                    borderRight: `1px solid ${tc.border}`,
                    boxShadow: lx
                        ? '4px 0 24px rgba(0,0,0,0.08), 1px 0 0 rgba(0,0,0,0.06)'
                        : '4px 0 32px rgba(0,0,0,0.25)',
                }}
            >
                {/* ══ Logo area ══ */}
                <div style={{ borderColor: tc.border, borderBottomWidth: 1, borderBottomStyle: 'solid' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'8px 0 0 0' }}>
                        {/* ── Logo — no white badge, natural TVS colours ── */}
                        <div
                            onClick={() => isSidebarOpen ? navigate('/') : setIsSidebarOpen(true)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 64,
                                cursor: 'pointer',
                            }}
                        >
                            <img
                                src={`${import.meta.env.BASE_URL || '/'}tvs_logo_clean.png`}
                                alt="TVS"
                                style={{
                                    width: isSidebarOpen ? 120 : 40,
                                    height: 'auto',
                                    objectFit: 'contain',
                                    display: 'block',
                                    transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
                                }}
                            />
                            <AnimatePresence>
                                {isSidebarOpen && (
                                    <motion.span
                                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                        animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
                                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                        style={{
                                            fontSize: '8.5px',
                                            fontWeight: 700,
                                            color: tc.text80,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            textAlign: 'center',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        Plant Engineering Department
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                    <div style={{ borderBottom:`1px solid ${tc.border}`, margin:'12px 0 8px 0' }} />
                </div>

                {/* ══ Navigation ══ */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 sidebar-scrollbar">
                    {NAV_SECTIONS.map(section => {
                        const visibleItems = section.items.filter(item =>
                            !item.permission || hasPermission(item.permission)
                        );
                        if (visibleItems.length === 0) return null;
                        return (
                            <div key={section.label}>
                                {/* Section header — hidden in collapsed mode */}
                                {isSidebarOpen && (
                                    section.label === 'WORKFLOW' ? (
                                        /* ── WORKFLOW section gets a special styled header ── */
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '16px 16px 6px 16px', marginTop: 4,
                                        }}>
                                            <div style={{
                                                width: 2, height: 10, borderRadius: 2,
                                                background: theme.accent, flexShrink: 0,
                                                opacity: 0.8,
                                            }} />
                                            <span style={{
                                                fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                                                fontWeight: 700, color: theme.accent, opacity: 0.9,
                                            }}>
                                                {section.label}
                                            </span>
                                            <div style={{
                                                width: 5, height: 5, borderRadius: '50%',
                                                background: theme.accent, marginLeft: 2, opacity: 0.7,
                                                animation: 'pulse 2s ease-in-out infinite',
                                            }} />
                                        </div>
                                    ) : (
                                        <div style={{
                                            fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                                            color: tc.label, padding: '16px 16px 4px 16px', marginTop: 4,
                                        }}>
                                            {section.label}
                                        </div>
                                    )
                                )}
                                <ul style={{ listStyle:'none', margin:0, padding: isSidebarOpen ? '0 8px' : '0 4px' }}>
                                    {visibleItems.map((item, idx) => {
                                        const isActive = location.pathname === item.path || (
                                            item.path !== '/' && 
                                            location.pathname.startsWith(item.path) && 
                                            !NAV_SECTIONS.some(sec => sec.items.some(other => 
                                                other !== item && 
                                                location.pathname.startsWith(other.path) && 
                                                other.path.length > item.path.length
                                            ))
                                        );
                                        const navItem = (
                                            <motion.li
                                                key={item.path}
                                                initial={{ opacity:0, x:-8 }}
                                                animate={{ opacity:1, x:0 }}
                                                transition={{ duration:0.28, delay: idx * 0.03 }}
                                                style={{ marginBottom: isSidebarOpen ? 2 : 0 }}
                                            >
                                                <NavLink to={item.path} end={item.path === '/'} className="block outline-none">
                                                    {({ isActive: navActive }) => (
                                                        isSidebarOpen ? (
                                                            /* ── EXPANDED item ── */
                                                            <motion.div
                                                                whileHover={{ x: 3 }}
                                                                whileTap={{ scale: 0.97 }}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    padding: '10px 14px',
                                                                    borderRadius: 10,
                                                                    borderLeft: navActive ? '3px solid #fff' : '3px solid transparent',
                                                                    background: navActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.18s ease',
                                                                }}
                                                                onMouseEnter={e => { if (!navActive) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                                                                onMouseLeave={e => { if (!navActive) e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                <item.icon
                                                                    size={20}
                                                                    style={{ marginRight:12, flexShrink:0, color: navActive ? tc.text : tc.muted }}
                                                                />
                                                                <span style={{
                                                                    fontSize: 13,
                                                                    fontWeight: navActive ? 700 : 600,
                                                                    color: navActive ? tc.text : tc.muted,
                                                                    fontFamily: font.style,
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    flex: 1,
                                                                }}>
                                                                    {item.name}
                                                                </span>
                                                                {/* Badge: pending count */}
                                                                {item.badge > 0 && (
                                                                    <motion.span
                                                                        initial={{ scale: 0 }}
                                                                        animate={{ scale: 1 }}
                                                                        style={{
                                                                            background: item.badgeColor || '#f59e0b',
                                                                            color: '#fff',
                                                                            fontSize: 10,
                                                                            fontWeight: 800,
                                                                            minWidth: 18,
                                                                            height: 18,
                                                                            borderRadius: 9,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            padding: '0 5px',
                                                                            flexShrink: 0,
                                                                            marginLeft: 6,
                                                                            letterSpacing: '-0.3px',
                                                                        }}
                                                                    >
                                                                        {item.badge > 99 ? '99+' : item.badge}
                                                                    </motion.span>
                                                                )}
                                                            </motion.div>

                                                        ) : (
                                                            /* ── COLLAPSED item: icon tile + label below ── */
                                                            <div style={{
                                                                display: 'flex', flexDirection: 'column',
                                                                alignItems: 'center', justifyContent: 'center',
                                                                padding: '8px 0', width: '100%',
                                                                position: 'relative',
                                                            }}>
                                                                <div style={{
                                                                    position: 'relative',
                                                                    width: 36, height: 36,
                                                                }}>
                                                                    <div style={{
                                                                        width: 36, height: 36, borderRadius: 8,
                                                                        background: navActive ? `${theme.accent}33` : tc.iconBg,
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        transition: 'background 0.18s ease',
                                                                    }}>
                                                                        <item.icon size={18} color={navActive ? theme.accent : tc.text80} />
                                                                    </div>
                                                                    {/* Dot badge for collapsed mode */}
                                                                    {item.badge > 0 && (
                                                                        <div style={{
                                                                            position: 'absolute',
                                                                            top: -3, right: -3,
                                                                            width: 14, height: 14,
                                                                            borderRadius: '50%',
                                                                            background: item.badgeColor || '#f59e0b',
                                                                            border: '2px solid transparent',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontSize: 8,
                                                                            fontWeight: 800,
                                                                            color: '#fff',
                                                                        }}>
                                                                            {item.badge > 9 ? '9+' : item.badge}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div style={{
                                                                    fontSize: 9,
                                                                    /* Theme-aware text color — visible on white sidebar too */
                                                                    color: navActive ? theme.accent : tc.muted,
                                                                    marginTop: 4, textAlign: 'center', lineHeight: 1.2,
                                                                    maxWidth: 56, whiteSpace: 'normal',
                                                                }}>
                                                                    {item.short}
                                                                </div>
                                                            </div>
                                                        )
                                                    )}
                                                </NavLink>
                                            </motion.li>
                                        );
                                        /* Wrap collapsed items with Ant Design Tooltip */
                                        return isSidebarOpen ? navItem : (
                                            <Tooltip key={item.path} title={item.name} placement="right">
                                                {navItem}
                                            </Tooltip>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </nav>

                                {/* ══ Footer ══ */}
                <div className="p-3 border-t" style={{ borderColor: tc.border }}>
                    {/* System Online indicator */}
                    <div
                        className={`rounded-xl transition-all duration-300 ${isSidebarOpen ? 'p-3' : 'p-2 flex justify-center'}`}
                        style={{ background: `${theme.accent}0f`, border: `1px solid ${theme.accent}1f` }}
                    >
                        {isSidebarOpen ? (
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: theme.accent }} />
                                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: tc.muted }}>
                                    System Online
                                </p>
                            </div>
                        ) : (
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: theme.accent }} />
                        )}
                    </div>

                    {/* Toggle open/collapse — anchored at the very bottom */}
                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="hidden lg:flex w-full items-center mt-2 rounded-xl transition-all duration-200"
                        style={{
                            justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                            padding: isSidebarOpen ? '8px 12px' : '8px',
                            gap: 8,
                            color: tc.muted,
                            background: 'transparent',
                            border: `1px solid ${tc.border}`,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = lx ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        {isSidebarOpen ? <ChevronLeft size={15} /> : <Menu size={15} />}
                        {isSidebarOpen && (
                            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: tc.muted }}>
                                Collapse
                            </span>
                        )}
                    </button>
                </div>
            </motion.aside>
        </>
    );
};

export default Sidebar;