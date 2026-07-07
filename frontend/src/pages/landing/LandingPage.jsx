import React, { useState, useEffect, Suspense, lazy } from 'react';
import { fetchPublicStats } from '../../services/landingService';

// ── Eagerly loaded (above the fold)
import LandingNav   from './LandingNav';
import HeroSection  from './HeroSection';
import MarqueeStrip from './MarqueeStrip';
import ScrollToTop  from './ScrollToTop';

// ── Lazily loaded (below fold)
const ProcessSection       = lazy(() => import('./ProcessSection'));
const FeaturesSection      = lazy(() => import('./FeaturesSection'));
const HowItWorks           = lazy(() => import('./HowItWorks'));
const ModuleGrid           = lazy(() => import('./ModuleGrid'));
const SmartInsightsSection = lazy(() => import('./SmartInsightsSection'));
const DashboardPreview     = lazy(() => import('./DashboardPreview'));
const FAQSection           = lazy(() => import('./FAQSection'));
const CTASection           = lazy(() => import('./CTASection'));
const LandingFooter        = lazy(() => import('./LandingFooter'));

/* ── Generic section skeleton ── */
const SectionSkeleton = ({ height = 400, dark = false }) => (
  <div style={{
    height, background: dark ? '#0D1B3E' : '#F8FAFD',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: `3px solid ${dark ? 'rgba(255,255,255,0.08)' : '#E8ECF4'}`,
      borderTopColor: dark ? 'rgba(255,255,255,0.4)' : '#B31818',
      animation: 'lp-spin 0.75s linear infinite',
    }} />
    <style>{`@keyframes lp-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default function LandingPage() {
  const [publicStats, setPublicStats] = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    document.body.style.background = '#F8FAFD';
    document.body.style.overflowX  = 'hidden';
    document.title = 'Asset Management — Manufacturing Intelligence Portal';

    fetchPublicStats().then(({ data }) => {
      setPublicStats(data);
      setLoading(false);
    });

    return () => {
      document.body.style.background = '';
      document.body.style.overflowX  = '';
    };
  }, []);

  return (
    <div style={{
      fontFamily: "'Inter','DM Sans',sans-serif",
      minHeight: '100vh', background: '#F8FAFD', overflowX: 'hidden',
    }}>

      {/* ── 1. Sticky nav ── */}
      <LandingNav />

      {/* ── 2. Hero ── */}
      <HeroSection stats={loading ? null : publicStats} />

      {/* ── 3. Marquee ticker ── */}
      <MarqueeStrip />

      {/* ── 4. Automated Data Flow ── */}
      <Suspense fallback={<SectionSkeleton height={480} />}>
        <ProcessSection />
      </Suspense>

      {/* ── 5. Core System Architecture ── */}
      <Suspense fallback={<SectionSkeleton height={500} />}>
        <FeaturesSection />
      </Suspense>

      {/* ── 6. How It Works — dark 3-step ── */}
      <Suspense fallback={<SectionSkeleton height={480} dark />}>
        <HowItWorks />
      </Suspense>

      {/* ── 7. Platform Module Grid ── */}
      <Suspense fallback={<SectionSkeleton height={500} />}>
        <ModuleGrid />
      </Suspense>

      {/* ── 8. Live Activity Feed ── */}
      <Suspense fallback={<SectionSkeleton height={480} />}>
        <SmartInsightsSection liveStats={loading ? null : publicStats} />
      </Suspense>

      {/* ── 9. Video Demo ── */}
      <Suspense fallback={<SectionSkeleton height={550} dark />}>
        <DashboardPreview stats={loading ? null : publicStats} />
      </Suspense>

      {/* ── 10. FAQ ── */}
      <Suspense fallback={<SectionSkeleton height={400} />}>
        <FAQSection />
      </Suspense>

      {/* ── 11. Final CTA ── */}
      <Suspense fallback={<SectionSkeleton height={280} />}>
        <CTASection />
      </Suspense>

      {/* ── 12. Footer ── */}
      <Suspense fallback={<SectionSkeleton height={280} />}>
        <LandingFooter />
      </Suspense>

      <ScrollToTop />
    </div>
  );
}
