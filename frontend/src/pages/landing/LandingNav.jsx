import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Menu, X, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV_LINKS = [
  { label: 'Workflow',      href: '#process' },
  { label: 'Capabilities', href: '#architecture' },
  { label: 'Interface',    href: '#demo' },
  { label: 'Insights',     href: '#stats-bar' },
];

export default function LandingNav() {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (href) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
          background: '#ffffff',
          borderBottom: '1px solid #E8ECF4',
          boxShadow: scrolled ? '0 2px 20px rgba(13,27,62,0.07)' : 'none',
          transition: 'box-shadow 0.3s',
          height: 60,
          display: 'flex', alignItems: 'center',
        }}
      >
        <div style={{
          maxWidth: 1180, margin: '0 auto', width: '100%',
          padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>

          {/* Brand */}
          <button
            id="nav-brand"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'linear-gradient(135deg, #B31818, #CC1F1F)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LayoutDashboard size={18} color="#ffffff" />
            </div>
            <span style={{
              fontSize: 16, fontWeight: 800, color: '#0D1B3E',
              fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.01em',
            }}>
              Asset Management
            </span>
          </button>

          {/* Desktop links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} className="lnav-desktop">
            {NAV_LINKS.map(({ label, href }) => (
              <button
                key={label}
                onClick={() => scrollTo(href)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 16px', borderRadius: 8,
                  fontSize: 14, fontWeight: 500, color: '#4A5568',
                  transition: 'color 0.15s, background 0.15s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#B31818';
                  e.currentTarget.style.background = '#F0F4FF';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#4A5568';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Right CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Sign In → local login */}
            <button
              id="nav-signin"
              onClick={() => navigate(isAuthenticated ? '/' : '/login')}
              className="lnav-desktop"
              style={{
                padding: '8px 16px', fontSize: 14, fontWeight: 500,
                color: '#4A5568', fontFamily: 'inherit', background: 'none',
                border: 'none', cursor: 'pointer',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#B31818')}
              onMouseLeave={e => (e.currentTarget.style.color = '#4A5568')}
            >
              Sign In
            </button>

            <motion.button
              id="nav-dashboard"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(isAuthenticated ? '/' : '/login')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 20px', borderRadius: 9, border: 'none',
                background: '#B31818', color: '#fff',
                fontSize: 13.5, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                letterSpacing: '0.01em',
              }}
            >
              Go to Dashboard <ArrowRight size={15} />
            </motion.button>

            {/* Mobile hamburger */}
            <button
              id="nav-menu"
              className="lnav-mobile"
              onClick={() => setMenuOpen(o => !o)}
              style={{
                background: '#F5F7FA', border: '1px solid #E8ECF4',
                borderRadius: 8, width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#4A5568',
              }}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            style={{
              position: 'fixed', top: 60, left: 0, right: 0, zIndex: 998,
              background: '#ffffff', borderBottom: '1px solid #E8ECF4',
              padding: '12px 24px 20px', overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(13,27,62,0.08)',
            }}
          >
            {NAV_LINKS.map(({ label, href }) => (
              <button
                key={label}
                onClick={() => scrollTo(href)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '13px 0', background: 'none', border: 'none',
                  fontSize: 15, fontWeight: 600, color: '#2D3748',
                  cursor: 'pointer', fontFamily: 'inherit',
                  borderBottom: '1px solid #F0F4FF',
                }}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => { setMenuOpen(false); navigate(isAuthenticated ? '/' : '/login'); }}
              style={{
                marginTop: 14, display: 'block', width: '100%', padding: '14px',
                borderRadius: 10, background: '#B31818',
                color: '#fff', fontSize: 15, fontWeight: 700,
                textAlign: 'center', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Sign In
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .lnav-desktop { display: flex !important; }
        .lnav-mobile  { display: none  !important; }
        @media (max-width: 768px) {
          .lnav-desktop { display: none  !important; }
          .lnav-mobile  { display: flex  !important; }
        }
      `}</style>
    </>
  );
}
