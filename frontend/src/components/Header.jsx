import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, ChevronDown, Clock, Activity, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

import { getApiBaseUrl } from '../api/axiosConfig';

const API_BASE_URL = getApiBaseUrl();

/* ── Route → Display name map ── */
const routeNameMap = {
    'employee-master':       'Employee Master',
    'mh-requests':           'MH Requests',
    'request-tracker':       'All Requests Overview',
    'mh-development-tracker':'MH Development Tracker',
    'vendor-master':         'Vendor Master',
    'settings':              'Settings',
    'scoring':               'Vendor Scoring',
    'loading':               'Loading Chart',
    'asset-management-update': 'Asset Management',
    'asset-summary':         'Asset Summary',
    'project-plan-model':    'Project Plan',
    'add':                   'Create New',
    'edit':                  'Edit',
    'view':                  'View Details',
};

const Header = ({ isSidebarOpen, setIsSidebarOpen }) => {
    const location = useLocation();
    const [isPopoverOpen, setIsPopoverOpen]     = useState(false);
    const [isActivityOpen, setIsActivityOpen]   = useState(false);
    const [userActivity, setUserActivity]       = useState(null);
    const { user, logout }   = useAuth();
    const navigate           = useNavigate();
    const popoverRef         = useRef(null);

    /* ── Fetch activity ── */
    useEffect(() => {
        if (user) fetchActivity();
    }, [user]);

    const fetchActivity = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/user-activity/stats`);
            setUserActivity(res.data);
        } catch { /* silent */ }
    };

    /* ── Click-outside to close popover ── */
    useEffect(() => {
        const onClickOutside = e => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) setIsPopoverOpen(false);
        };
        const onEsc = e => { if (e.key === 'Escape') setIsPopoverOpen(false); };
        if (isPopoverOpen) {
            document.addEventListener('mousedown', onClickOutside);
            document.addEventListener('keydown', onEsc);
        }
        return () => {
            document.removeEventListener('mousedown', onClickOutside);
            document.removeEventListener('keydown', onEsc);
        };
    }, [isPopoverOpen]);

    /* ── Breadcrumbs ── */
    const generateBreadcrumbs = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        const crumbs = [];

        if (location.pathname !== '/') crumbs.push({ name: 'Dashboard', path: '/' });

        let current = '';
        parts.forEach(seg => {
            current += `/${seg}`;
            // Skip MongoDB ObjectID segments
            if (/^[0-9a-fA-F]{24}$/.test(seg)) return;
            const name = routeNameMap[seg] ?? (seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '));
            if (name) crumbs.push({ name, path: current });
        });
        return crumbs;
    };

    const breadcrumbs     = generateBreadcrumbs();
    const currentTitle    = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].name : 'Dashboard';
    const displayName     = user?.name || 'User';
    const displayEmail    = user?.email || '';
    const displayInitials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

    const handleLogout = async () => {
        setIsPopoverOpen(false);
        await logout();
        navigate('/login', { replace: true });
    };

    const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const formatDuration = (secs) => {
        if (!secs) return '0s';
        const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600);
        const m = Math.floor((secs % 3600) / 60), s = secs % 60;
        if (d > 0) return `${d}d ${h}h`;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m ${s}s`;
    };

    /* ── sidebar offset ── */
    const leftOffset = isSidebarOpen ? 272 : 72;

    return (
        <>
            <header
                className="fixed top-0 right-0 left-0 z-header flex items-center justify-between px-5 lg:px-8 transition-all duration-300"
                style={{
                    height: 68,
                    left: `${leftOffset}px`,
                    background: 'rgba(245,247,250,0.88)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderBottom: '1px solid rgba(224,228,239,0.7)',
                    boxShadow: '0 2px 20px rgba(13,27,62,0.05)',
                }}
            >
                {/* ── LEFT: hamburger + breadcrumbs ── */}
                <div className="flex items-center gap-4">
                    {/* Mobile hamburger */}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 rounded-xl transition-colors lg:hidden"
                        style={{ color: '#CC1F1F' }}
                    >
                        <Menu size={20} />
                    </button>

                    <div className="flex flex-col justify-center gap-0.5">
                        {/* Breadcrumbs */}
                        <nav className="hidden md:flex items-center gap-1">
                            {breadcrumbs.map((crumb, idx) => (
                                <React.Fragment key={crumb.path}>
                                    {idx > 0 && <ChevronRight size={10} style={{ color: '#B0BBC9' }} />}
                                    <Link
                                        to={crumb.path}
                                        className="text-[10px] font-bold uppercase tracking-widest transition-colors"
                                        style={{
                                            color: idx === breadcrumbs.length - 1 ? '#3D4B6B' : '#B0BBC9',
                                            pointerEvents: idx === breadcrumbs.length - 1 ? 'none' : 'auto',
                                        }}
                                        onMouseEnter={e => { if (idx < breadcrumbs.length - 1) e.target.style.color = '#00C9A7'; }}
                                        onMouseLeave={e => { if (idx < breadcrumbs.length - 1) e.target.style.color = '#B0BBC9'; }}
                                    >
                                        {crumb.name}
                                    </Link>
                                </React.Fragment>
                            ))}
                        </nav>

                        <h2 className="text-[18px] font-black leading-none m-0"
                            style={{ fontFamily: 'Outfit, sans-serif', color: '#0D1B3E' }}>
                            {currentTitle}
                        </h2>
                    </div>
                </div>

                {/* ── RIGHT: actions + profile ── */}
                <div className="flex items-center gap-3">
                    {/* Last login pill */}
                    {userActivity && (
                        <motion.button
                            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                            onClick={() => setIsActivityOpen(true)}
                            className="hidden xl:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                            style={{
                                background: 'rgba(0,201,167,0.08)',
                                border: '1px solid rgba(0,201,167,0.18)',
                                color: '#00A98A',
                            }}
                        >
                            <Clock size={13} />
                            <span>Last: {userActivity.previousLoginAt ? formatDate(userActivity.previousLoginAt) : 'First Visit'}</span>
                        </motion.button>
                    )}

                    {/* Separator */}
                    <div className="h-7 w-px hidden md:block" style={{ background: '#E0E4EF' }} />

                    {/* Profile dropdown */}
                    <div className="relative" ref={popoverRef}>
                        <motion.button
                            whileHover={{ y: -1 }}
                            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-2xl transition-all"
                            style={{
                                background: isPopoverOpen ? '#ffffff' : 'transparent',
                                border: isPopoverOpen ? '1px solid #E0E4EF' : '1px solid transparent',
                                boxShadow: isPopoverOpen ? '0 4px 20px rgba(13,27,62,0.08)' : 'none',
                            }}
                        >
                            {/* Name + dept */}
                            <div className="hidden md:flex flex-col items-end">
                                <span className="text-[13px] font-bold leading-tight" style={{ color: '#0D1B3E' }}>
                                    {displayName}
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-wider leading-tight" style={{ color: '#B0BBC9' }}>
                                    {user?.department || 'Employee'}
                                </span>
                            </div>

                            {/* Avatar */}
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                                style={{
                                    background: 'linear-gradient(140deg, #CC1F1F, #B31818)',
                                    boxShadow: '0 4px 12px rgba(204,31,31,0.30)',
                                }}
                            >
                                {displayInitials}
                            </div>

                            <ChevronDown
                                size={13}
                                style={{
                                    color: '#B0BBC9',
                                    transform: isPopoverOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.25s',
                                }}
                            />
                        </motion.button>

                        {/* Dropdown */}
                        <AnimatePresence>
                            {isPopoverOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                    transition={{ duration: 0.18, ease: 'easeOut' }}
                                    className="absolute top-full right-0 mt-2 overflow-hidden"
                                    style={{
                                        width: 256,
                                        background: '#ffffff',
                                        border: '1px solid #E0E4EF',
                                        borderRadius: 18,
                                        boxShadow: '0 16px 48px rgba(13,27,62,0.14)',
                                        zIndex: 2000,
                                    }}
                                >
                                    {/* Profile header */}
                                    <div className="flex flex-col items-center p-6 text-center"
                                        style={{ background: 'linear-gradient(135deg, #F5F7FA, #ffffff)', borderBottom: '1px solid #F0F3F9' }}>
                                        <div
                                            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg mb-3"
                                            style={{
                                                background: 'linear-gradient(140deg, #CC1F1F, #B31818)',
                                                boxShadow: '0 6px 20px rgba(204,31,31,0.28)',
                                            }}
                                        >
                                            {displayInitials}
                                        </div>
                                        <p className="font-black text-[15px] m-0" style={{ fontFamily: 'Outfit,sans-serif', color: '#0D1B3E' }}>
                                            {displayName}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">{displayEmail}</p>

                                        <div className="flex gap-2 mt-3">
                                            <span className="badge" style={{ background: 'rgba(204,31,31,0.08)', color: '#CC1F1F' }}>
                                                {user?.role || 'User'}
                                            </span>
                                            <span className="badge" style={{ background: 'rgba(16,185,129,0.10)', color: '#059669' }}>
                                                Active
                                            </span>
                                        </div>
                                    </div>

                                    {/* Logout */}
                                    <div className="p-3">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-bold text-sm transition-all group"
                                            style={{ background: '#FFF1F1', color: '#DC2626', border: '1px solid #FEE2E2' }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = '#DC2626';
                                                e.currentTarget.style.color = '#ffffff';
                                                e.currentTarget.style.border = '1px solid #DC2626';
                                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(220,38,38,0.25)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = '#FFF1F1';
                                                e.currentTarget.style.color = '#DC2626';
                                                e.currentTarget.style.border = '1px solid #FEE2E2';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }}
                                        >
                                            <LogOut size={16} className="transition-transform group-hover:translate-x-0.5" />
                                            Sign Out
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            {/* ── Activity Modal ── */}
            <Modal
                title={
                    <div className="flex items-center gap-3 py-1">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: 'rgba(0,201,167,0.12)' }}>
                            <Activity size={18} style={{ color: '#00C9A7' }} />
                        </div>
                        <div>
                            <p className="m-0 text-base font-black" style={{ fontFamily: 'Outfit,sans-serif', color: '#0D1B3E' }}>
                                Activity Log
                            </p>
                            <p className="m-0 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#B0BBC9' }}>
                                Session History
                            </p>
                        </div>
                    </div>
                }
                open={isActivityOpen}
                onCancel={() => setIsActivityOpen(false)}
                footer={null}
                width="95%"
                style={{ maxWidth: 600 }}
                centered
            >
                {userActivity ? (
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'Last Visit', value: userActivity.previousLoginAt ? formatDate(userActivity.previousLoginAt) : 'First Entry' },
                                { label: 'Total Sessions', value: userActivity.totalVisits, big: true },
                            ].map(({ label, value, big }) => (
                                <div key={label} className="p-5 rounded-2xl border text-center"
                                    style={{ background: '#F5F7FA', borderColor: '#E0E4EF' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: '#B0BBC9' }}>{label}</p>
                                    <p className={`font-black ${big ? 'text-4xl' : 'text-base'}`}
                                        style={{ fontFamily: 'Outfit,sans-serif', color: big ? '#00C9A7' : '#0D1B3E' }}>
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#B0BBC9' }}>
                                    Recent Sessions
                                </p>
                                <span className="badge" style={{ background: 'rgba(0,201,167,0.1)', color: '#00A98A' }}>Live Data</span>
                            </div>
                            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: '#E0E4EF' }}>
                                <table className="w-full text-sm">
                                    <thead style={{ background: '#F5F7FA', borderBottom: '1px solid #E0E4EF' }}>
                                        <tr>
                                            <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: '#B0BBC9' }}>Timestamp</th>
                                            <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider" style={{ color: '#B0BBC9' }}>Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {userActivity.recentSessions?.map((s, i) => (
                                            <tr key={s._id}
                                                style={{ borderTop: i > 0 ? '1px solid #F0F3F9' : 'none', background: '#ffffff' }}>
                                                <td className="px-5 py-3.5 font-semibold" style={{ color: '#1e2d4e' }}>
                                                    {formatDate(s.loginAt)}
                                                </td>
                                                <td className="px-5 py-3.5 text-right">
                                                    {s.logoutAt
                                                        ? <span className="text-xs font-semibold" style={{ color: '#7B8AAB' }}>{formatDuration(s.sessionDuration)}</span>
                                                        : <span className="badge animate-pulse" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>Online</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-16 flex flex-col items-center gap-4" style={{ color: '#B0BBC9' }}>
                        <div className="w-10 h-10 border-4 rounded-full animate-spin"
                            style={{ borderColor: 'rgba(0,201,167,0.15)', borderTopColor: '#00C9A7' }} />
                        <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Loading session data…</p>
                    </div>
                )}
            </Modal>
        </>
    );
};

export default Header;
