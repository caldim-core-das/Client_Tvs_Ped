/* ══════════════════════════════════════════════════
   COLOR THEMES & CONFIG FOR SIDEBAR AND SETTINGS
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
