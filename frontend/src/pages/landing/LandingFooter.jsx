import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Mail, Shield, ArrowRight, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const FooterLink = ({ to, children }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleClick = (e) => {
    e.preventDefault();
    const protectedRoutes = ['/', '/mh-requests', '/vendor-master', '/employee-master', '/asset-summary', '/settings'];
    if (protectedRoutes.includes(to) && !isAuthenticated) {
      navigate('/login', { state: { from: { pathname: to } } });
    } else {
      navigate(to);
    }
  };

  return (
    <a
      href={to} onClick={handleClick}
      style={{
        display: 'block', fontSize: 13.5, color: '#64748B',
        fontWeight: 500, marginBottom: 10, textDecoration: 'none', cursor: 'pointer',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => (e.target.style.color = '#B31818')}
      onMouseLeave={e => (e.target.style.color = '#64748B')}
    >
      {children}
    </a>
  );
};

export default function LandingFooter() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const year = new Date().getFullYear();

  return (
    <footer id="footer" style={{
      background: '#ffffff',
      borderTop: '1px solid #E8ECF4',
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '56px 24px 28px' }}>

        {/* Top grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gap: 40, marginBottom: 48,
        }} className="footer-grid">

          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'linear-gradient(135deg, #B31818, #CC1F1F)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <LayoutDashboard size={18} color="#fff" />
              </div>
              <span style={{
                fontSize: 16, fontWeight: 800, color: '#0D1B3E',
                fontFamily: "'Outfit', sans-serif",
              }}>
                Asset Management
              </span>
            </div>
            <p style={{
              fontSize: 13.5, color: '#94A3B8',
              lineHeight: 1.7, marginBottom: 20, maxWidth: 240,
            }}>
              Enterprise-grade manufacturing operations platform for modern industrial facilities.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              {['Hosur', 'Chennai', 'Mysuru', 'Pune'].map((loc, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600, color: '#94A3B8',
                  padding: '3px 10px', borderRadius: 99,
                  border: '1px solid #E8ECF4',
                }}>
                  <MapPin size={9} /> {loc}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Mail size={13} color="#CBD5E0" />
              <span style={{ fontSize: 12.5, color: '#94A3B8' }}>support@asset-management.internal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={13} color="#CBD5E0" />
              <span style={{ fontSize: 12.5, color: '#94A3B8' }}>Internal Use Only</span>
            </div>
          </div>

          {/* Platform */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#0D1B3E', marginBottom: 16,
            }}>Platform</div>
            <FooterLink to="/">Dashboard</FooterLink>
            <FooterLink to="/mh-requests">MH Requests</FooterLink>
            <FooterLink to="/request-tracker">Request Tracker</FooterLink>
            <FooterLink to="/mh-development-tracker">Dev Tracker</FooterLink>
          </div>

          {/* Management */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#0D1B3E', marginBottom: 16,
            }}>Management</div>
            <FooterLink to="/vendor-master">Vendor Master</FooterLink>
            <FooterLink to="/employee-master">Employee Master</FooterLink>
            <FooterLink to="/asset-summary">Asset Summary</FooterLink>
            <FooterLink to="/asset-management-update">Asset Updates</FooterLink>
          </div>

          {/* System */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#0D1B3E', marginBottom: 16,
            }}>System</div>
            <FooterLink to="/settings">Settings</FooterLink>
            <FooterLink to="/login">Sign In</FooterLink>

            <button
              id="footer-cta"
              onClick={() => navigate(isAuthenticated ? '/' : '/login')}
              style={{
                marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 9, border: 'none',
                background: '#B31818', color: '#fff',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.18s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#CC1F1F')}
              onMouseLeave={e => (e.currentTarget.style.background = '#B31818')}
            >
              {isAuthenticated ? 'Dashboard' : 'Sign In'} <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#E8ECF4', marginBottom: 20 }} />

        {/* Bottom */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
        }}>
          <span style={{ fontSize: 12, color: '#CBD5E0', fontWeight: 500 }}>
            © {year} Manufacturing Intelligence Portal. All rights reserved.
          </span>
          <div style={{ display: 'flex', gap: 18 }}>
            {['Privacy Policy', 'Terms of Use', 'Accessibility'].map((l, i) => (
              <span key={i} style={{ fontSize: 12, color: '#CBD5E0', fontWeight: 500, cursor: 'default' }}>
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}
