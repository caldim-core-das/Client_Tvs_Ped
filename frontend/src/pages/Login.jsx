import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

// Import TVS & Trolley Assets
import imgTvsLogo from '../assets/tvslogo.jpg';
import imgWarehouse from '../assets/mfg_warehouse.png';
import imgT1 from '../assets/t1.jpg';
import imgT2 from '../assets/t2.jpg';
import imgT3 from '../assets/t3.webp';

const Login = () => {
    /* Form state */
    const [email,     setEmail]     = useState('');
    const [password,  setPassword]  = useState('');
    const [showPwd,   setShowPwd]   = useState(false);
    const [error,     setError]     = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const navigate  = useNavigate();
    const location  = useLocation();
    const from      = location.state?.from?.pathname || '/';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        const result = await login(email, password);
        if (result.success) navigate(from, { replace: true });
        else setError(result.message || 'Invalid credentials. Please try again.');
        setIsLoading(false);
    };

    return (
        <>
            {/* Google Font & animations */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@400;600;700;800;900&display=swap');
                @keyframes login-spin { to { transform: rotate(360deg); } }
            `}</style>

            <div 
                className="flex flex-col lg:flex-row w-full min-h-screen" 
                style={{ 
                    boxSizing: 'border-box',
                    margin: 0,
                    padding: 0,
                    fontFamily: "'Inter', system-ui, sans-serif"
                }}
            >
                
                {/* ── LEFT HALF: LIGHT BLUE BRANDING PANEL ── */}
                <div 
                    className="hidden lg:flex w-full lg:w-1/2 flex-col items-center relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #F8FAFC 0%, #E0E7FF 100%)', // Very light blue/white gradient
                        minHeight: '100vh',
                        padding: '40px',
                        boxSizing: 'border-box'
                    }}
                >
                    {/* Decorative subtle blue blur in background */}
                    <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '300px', height: '300px', background: '#3B82F6', opacity: 0.05, filter: 'blur(100px)', borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '400px', height: '400px', background: '#253C80', opacity: 0.05, filter: 'blur(120px)', borderRadius: '50%' }} />

                    {/* Top Header Pill - Moved to the top */}
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                        <div style={{
                            width: '100%',
                            maxWidth: '480px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '20px',
                            padding: '12px 18px',
                            boxShadow: '0 4px 20px rgba(37, 60, 128, 0.05)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
                                    <Package size={20} color="#253C80" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: '#1E293B', fontSize: '13.5px', fontWeight: '800', letterSpacing: '0.05em' }}>ASSET MANAGEMENT</span>
                                    <span style={{ color: '#64748B', fontSize: '10px', fontWeight: '600' }}>MH Asset Management & Performance</span>
                                </div>
                            </div>
                            <span style={{
                                color: '#253C80',
                                fontSize: '10px',
                                fontWeight: '700',
                                border: '1px solid rgba(37, 60, 128, 0.2)',
                                padding: '5px 12px',
                                borderRadius: '99px',
                                letterSpacing: '0.04em',
                                background: 'rgba(37, 60, 128, 0.05)'
                            }}>
                                SECURE LOGIN
                            </span>
                        </div>
                    </div>

                    {/* Centered Large Showcase Banner */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', position: 'relative', zIndex: 1 }}>
                        <div style={{
                            width: '100%',
                            maxWidth: '640px', // Enlarged width
                            position: 'relative',
                            borderRadius: '24px',
                            overflow: 'hidden',
                            border: '1px solid #FFFFFF',
                            height: '420px',  // Enlarged height
                            boxShadow: '0 20px 40px rgba(37, 60, 128, 0.15)'
                        }}>
                            <img 
                                src={imgWarehouse} 
                                alt="Asset Portfolio" 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            />
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                padding: '24px 30px',
                                background: 'linear-gradient(to top, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0.4) 65%, transparent 100%)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <span style={{ color: '#93C5FD', fontSize: '12px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Asset portfolio</span>
                                <span style={{ color: '#fff', fontSize: '18px', fontWeight: '700', marginTop: '6px', lineHeight: '1.4' }}>
                                    Scooters, commuters and performance machines in one view
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT HALF: WHITE SIGN-IN FORM ── */}
                <div 
                    className="w-full lg:w-1/2 flex flex-col items-center justify-center relative"
                    style={{
                        background: '#FFFFFF', // Pure white background
                        minHeight: '100vh',
                        padding: '40px 24px',
                        boxSizing: 'border-box',
                        overflowY: 'auto'
                    }}
                >
                    <div 
                        style={{
                            width: '100%',
                            maxWidth: '460px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            padding: '10px 0'
                        }}
                    >
                        {/* Heading */}
                        <div style={{ marginBottom: '32px' }}>
                            <h1 style={{
                                margin: 0,
                                fontSize: '36px',
                                fontWeight: '800',
                                color: '#0F172A',
                                letterSpacing: '-0.03em',
                                fontFamily: "'Outfit', sans-serif"
                            }}>
                                Welcome back
                            </h1>
                            <p style={{
                                margin: '8px 0 0 0',
                                fontSize: '15px',
                                color: '#64748B',
                                lineHeight: '1.5',
                                fontWeight: '500'
                            }}>
                                Sign in to your <span style={{color: '#253C80', fontWeight: '700'}}>Material Handling asset</span> account.
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                            {/* Error Display */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                        animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '14px 16px',
                                            borderRadius: '12px',
                                            background: '#FEF2F2',
                                            border: '1px solid #FECACA',
                                            color: '#DC2626',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <AlertCircle size={18} style={{ flexShrink: 0 }} />
                                        <span>{error}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Email Field */}
                            <div style={{ marginBottom: '20px' }}>
                                <label htmlFor="login-email" style={{
                                    display: 'block',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    color: '#334155',
                                    marginBottom: '8px'
                                }}>
                                    Email address
                                </label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '12px',
                                    padding: '0 16px',
                                    background: '#F8FAFC',
                                    transition: 'all 0.2s ease',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                }}>
                                    <Mail size={18} color="#94A3B8" />
                                    <input
                                        id="login-email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="admin@asset.com"
                                        style={{
                                            width: '100%',
                                            border: 'none',
                                            outline: 'none',
                                            padding: '14px 12px',
                                            fontSize: '15px',
                                            color: '#0F172A',
                                            fontFamily: 'inherit',
                                            background: 'transparent'
                                        }}
                                        onFocus={e => { e.currentTarget.parentElement.style.borderColor = '#3B82F6'; e.currentTarget.parentElement.style.background = '#FFFFFF'; e.currentTarget.parentElement.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)'; }}
                                        onBlur={e => { e.currentTarget.parentElement.style.borderColor = '#CBD5E1'; e.currentTarget.parentElement.style.background = '#F8FAFC'; e.currentTarget.parentElement.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)'; }}
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label htmlFor="login-password" style={{
                                        display: 'block',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#334155'
                                    }}>
                                        Password
                                    </label>
                                    <span 
                                        onClick={() => toast('Please contact your System Administrator to reset your password.', { icon: '🔒', duration: 4000 })}
                                        style={{ fontSize: '12px', color: '#253C80', fontWeight: '600', cursor: 'pointer' }}
                                    >
                                        Forgot password?
                                    </span>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '12px',
                                    padding: '0 16px',
                                    background: '#F8FAFC',
                                    transition: 'all 0.2s ease',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                }}>
                                    <Lock size={18} color="#94A3B8" />
                                    <input
                                        id="login-password"
                                        name="password"
                                        type={showPwd ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        style={{
                                            width: '100%',
                                            border: 'none',
                                            outline: 'none',
                                            padding: '14px 12px',
                                            fontSize: '15px',
                                            color: '#0F172A',
                                            fontFamily: 'inherit',
                                            background: 'transparent'
                                        }}
                                        onFocus={e => { e.currentTarget.parentElement.style.borderColor = '#3B82F6'; e.currentTarget.parentElement.style.background = '#FFFFFF'; e.currentTarget.parentElement.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)'; }}
                                        onBlur={e => { e.currentTarget.parentElement.style.borderColor = '#CBD5E1'; e.currentTarget.parentElement.style.background = '#F8FAFC'; e.currentTarget.parentElement.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)'; }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPwd(v => !v)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#94A3B8',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '4px'
                                        }}
                                    >
                                        {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit button */}
                            <motion.button
                                id="login-submit"
                                type="submit"
                                disabled={isLoading}
                                whileHover={isLoading ? {} : { scale: 1.015, boxShadow: '0 10px 25px -5px rgba(37, 60, 128, 0.4)' }}
                                whileTap={isLoading ? {} : { scale: 0.985 }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    padding: '15px 24px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: 'linear-gradient(90deg, #1E3A8A 0%, #2563EB 100%)',
                                    color: '#ffffff',
                                    fontSize: '15px',
                                    fontWeight: '700',
                                    letterSpacing: '0.02em',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    opacity: isLoading ? 0.8 : 1,
                                    fontFamily: 'inherit',
                                    boxShadow: '0 8px 20px -6px rgba(37, 60, 128, 0.3)',
                                    transition: 'box-shadow 0.2s ease'
                                }}
                            >
                                {isLoading
                                    ? <div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'login-spin 0.8s linear infinite' }} />
                                    : <><span>Sign in to dashboard</span><ArrowRight size={18} /></>
                                }
                            </motion.button>
                        </form>

                        {/* Divider */}
                        <div style={{ margin: '32px 0', borderTop: '1px solid #E2E8F0', position: 'relative', display: 'flex', justifyContent: 'center' }}>
                            <span style={{ background: '#FFFFFF', padding: '0 12px', color: '#94A3B8', fontSize: '12px', fontWeight: '600', position: 'absolute', top: '-9px' }}>
                                DEMO CREDENTIALS
                            </span>
                        </div>

                        {/* Demo hint */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            fontSize: '13px',
                            color: '#64748B',
                            fontWeight: '500'
                        }}>
                            Email:&nbsp;<span style={{ color: '#0F172A', fontWeight: '700' }}>admin@asset.com</span>&nbsp;&nbsp;&nbsp;Pass:&nbsp;<span style={{ color: '#0F172A', fontWeight: '700' }}>admin123</span>
                        </div>

                        {/* ── HEAVY DUTY TROLLEY SHOWCASE ── */}
                        <div style={{ marginTop: '40px', padding: '24px', background: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                            <span style={{
                                display: 'block',
                                fontSize: '11px',
                                fontWeight: '800',
                                color: '#475569',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase'
                            }}>
                                Equipment Overview
                            </span>
                            <span style={{
                                display: 'block',
                                fontSize: '13px',
                                color: '#64748B',
                                marginTop: '4px'
                            }}>
                                Quick view of key trolley variants used across plants.
                            </span>

                            <div style={{
                                display: 'flex',
                                gap: '12px',
                                marginTop: '16px'
                            }}>
                                {/* Trolley 1 - Green Platform (Left side of t1.jpg) */}
                                <div style={{
                                    width: '72px',
                                    height: '72px',
                                    borderRadius: '12px',
                                    border: '1px solid #CBD5E1',
                                    overflow: 'hidden',
                                    background: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxSizing: 'border-box'
                                }}>
                                    <img 
                                        src={imgT1} 
                                        alt="Green Platform Trolley" 
                                        style={{ width: '144px', height: '72px', maxWidth: 'none', objectFit: 'cover', objectPosition: 'left' }} 
                                    />
                                </div>

                                {/* Trolley 2 - Shelf Trolley (Right side of t1.jpg) */}
                                <div style={{
                                    width: '72px',
                                    height: '72px',
                                    borderRadius: '12px',
                                    border: '1px solid #CBD5E1',
                                    overflow: 'hidden',
                                    background: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxSizing: 'border-box'
                                }}>
                                    <img 
                                        src={imgT1} 
                                        alt="Shelf Trolley" 
                                        style={{ width: '144px', height: '72px', maxWidth: 'none', objectFit: 'cover', objectPosition: 'right' }} 
                                    />
                                </div>

                                {/* Trolley 3 - Blue Platform (t2.jpg) */}
                                <div style={{
                                    width: '72px',
                                    height: '72px',
                                    borderRadius: '12px',
                                    border: '1px solid #CBD5E1',
                                    overflow: 'hidden',
                                    background: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4px',
                                    boxSizing: 'border-box'
                                }}>
                                    <img 
                                        src={imgT2} 
                                        alt="Blue Platform Trolley" 
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                    />
                                </div>

                                {/* Trolley 4 - Mesh Cage (t3.webp) */}
                                <div style={{
                                    width: '72px',
                                    height: '72px',
                                    borderRadius: '12px',
                                    border: '1px solid #CBD5E1',
                                    overflow: 'hidden',
                                    background: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4px',
                                    boxSizing: 'border-box'
                                }}>
                                    <img 
                                        src={imgT3} 
                                        alt="Mesh Cage Trolley" 
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            marginTop: '32px',
                            textAlign: 'center',
                            fontSize: '12px',
                            color: '#94A3B8',
                            fontWeight: '500'
                        }}>
                            © 2026 Asset Management. All rights reserved.
                        </div>

                    </div>
                </div>

            </div>
        </>
    );
};

export default Login;
