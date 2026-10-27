import Link from "next/link";
import {
  BrainCircuit,
  Code2,
  FileBarChart,
  Mic,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: BrainCircuit,
    title: "AI-Powered Questions",
    description:
      "Adaptive questions that adjust based on your performance. Get follow-ups that dig deeper into your knowledge.",
  },
  {
    icon: Mic,
    title: "Voice & Video Interviews",
    description:
      "Practice with real-time audio and video. The AI interviewer listens, evaluates, and responds naturally.",
  },
  {
    icon: Code2,
    title: "Live Code Editor",
    description:
      "Write, run, and debug code in a built-in editor with syntax highlighting and sandboxed execution.",
  },
  {
    icon: ShieldCheck,
    title: "Activity Monitoring",
    description:
      "Simulate real interview conditions with tab-switch detection, clipboard monitoring, and focus tracking.",
  },
  {
    icon: FileBarChart,
    title: "Detailed Reports",
    description:
      "Get comprehensive feedback with scores, strengths, weaknesses, and actionable improvement suggestions.",
  },
  {
    icon: Sparkles,
    title: "Smart Evaluation",
    description:
      "AI analyzes your code quality, problem-solving approach, communication skills, and technical depth.",
  },
];

export default function HomePage() {
  return (
    <div className="home-page">
      {/* ─── Ambient Background ─── */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      {/* ─── Navigation ─── */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-brand">
            <BrainCircuit size={28} strokeWidth={1.5} />
            <span>AI Interviewer</span>
          </div>
          <div className="nav-actions">
            <Link href="/login" className="btn btn-ghost">
              Sign In
            </Link>
            <Link href="/register" className="btn btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <main>
        <section className="hero">
          <div className="hero-badge animate-fade-in">
            <Sparkles size={14} />
            <span>AI-Powered Interview Practice</span>
          </div>
          <h1 className="hero-title animate-slide-up">
            Ace Your Next
            <br />
            <span className="text-gradient">Technical Interview</span>
          </h1>
          <p className="hero-subtitle animate-slide-up">
            Practice with an AI interviewer that adapts to your skill level.
            Get real-time feedback on coding, system design, and behavioral
            questions.
          </p>
          <div className="hero-actions animate-slide-up">
            <Link href="/register" className="btn btn-primary btn-lg">
              Start Practicing Free
            </Link>
            <Link href="#features" className="btn btn-secondary btn-lg">
              See Features
            </Link>
          </div>

          {/* Stats */}
          <div className="hero-stats animate-fade-in">
            <div className="stat">
              <span className="stat-number">5+</span>
              <span className="stat-label">Question Types</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-number">10+</span>
              <span className="stat-label">Tech Topics</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-number">AI</span>
              <span className="stat-label">Powered Feedback</span>
            </div>
          </div>
        </section>

        {/* ─── Features ─── */}
        <section className="features-section" id="features">
          <h2 className="section-title">
            Everything you need to
            <span className="text-gradient"> prepare</span>
          </h2>
          <p className="section-subtitle">
            A complete interview simulation platform built with real-world
            engineering practices.
          </p>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="feature-card card"
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <div className="feature-icon">
                  <feature.icon size={24} strokeWidth={1.5} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="cta-section">
          <div className="cta-card card-glass">
            <h2>Ready to start practicing?</h2>
            <p>
              Create your account and take your first AI-powered mock interview
              in minutes.
            </p>
            <Link href="/register" className="btn btn-primary btn-lg">
              Get Started — It&apos;s Free
            </Link>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="footer">
        <p>
          Built as a portfolio project — demonstrating full-stack engineering,
          AI integration, and real-time systems.
        </p>
      </footer>

      <style>{`
        .home-page {
          position: relative;
          min-height: 100dvh;
          overflow-x: hidden;
        }

        /* ─── Ambient Background ─── */
        .ambient-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .ambient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.4;
        }
        .ambient-orb-1 {
          width: 600px;
          height: 600px;
          background: rgba(108, 92, 231, 0.15);
          top: -200px;
          left: -100px;
        }
        .ambient-orb-2 {
          width: 500px;
          height: 500px;
          background: rgba(168, 85, 247, 0.1);
          top: 300px;
          right: -150px;
        }
        .ambient-orb-3 {
          width: 400px;
          height: 400px;
          background: rgba(108, 92, 231, 0.08);
          bottom: 100px;
          left: 20%;
        }

        /* ─── Nav ─── */
        .nav {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(10, 10, 15, 0.8);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--surface-border);
        }
        .nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0.875rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .nav-brand {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          font-weight: 600;
          font-size: 1.125rem;
          color: var(--text-primary);
        }
        .nav-brand svg {
          color: var(--color-primary);
        }
        .nav-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        /* ─── Hero ─── */
        .hero {
          position: relative;
          z-index: 1;
          max-width: 800px;
          margin: 0 auto;
          padding: 5rem 1.5rem 4rem;
          text-align: center;
        }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 1rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--color-primary);
          background: var(--color-primary-subtle);
          border: 1px solid rgba(108, 92, 231, 0.2);
          border-radius: var(--radius-full);
          margin-bottom: 1.5rem;
        }
        .hero-title {
          font-size: 3.5rem;
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 1.15;
          margin-bottom: 1.25rem;
        }
        .hero-subtitle {
          font-size: 1.125rem;
          color: var(--text-secondary);
          max-width: 600px;
          margin: 0 auto 2rem;
          line-height: 1.7;
        }
        .hero-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 3rem;
        }
        .hero-stats {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2rem;
        }
        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .stat-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .stat-label {
          font-size: 0.8125rem;
          color: var(--text-tertiary);
        }
        .stat-divider {
          width: 1px;
          height: 40px;
          background: var(--surface-border);
        }

        /* ─── Features ─── */
        .features-section {
          position: relative;
          z-index: 1;
          max-width: 1100px;
          margin: 0 auto;
          padding: 4rem 1.5rem;
        }
        .section-title {
          text-align: center;
          font-size: 2rem;
          margin-bottom: 0.75rem;
        }
        .section-subtitle {
          text-align: center;
          color: var(--text-secondary);
          max-width: 500px;
          margin: 0 auto 3rem;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.25rem;
        }
        .feature-card {
          animation: slideUp 0.5s ease-out both;
        }
        .feature-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          background: var(--color-primary-subtle);
          color: var(--color-primary);
          margin-bottom: 1rem;
        }
        .feature-card h3 {
          font-size: 1.0625rem;
          margin-bottom: 0.5rem;
        }
        .feature-card p {
          font-size: 0.875rem;
          line-height: 1.6;
        }

        /* ─── CTA ─── */
        .cta-section {
          position: relative;
          z-index: 1;
          max-width: 700px;
          margin: 0 auto;
          padding: 3rem 1.5rem 5rem;
        }
        .cta-card {
          text-align: center;
          padding: 3rem 2rem;
        }
        .cta-card h2 {
          margin-bottom: 0.75rem;
        }
        .cta-card p {
          margin-bottom: 1.5rem;
        }

        /* ─── Footer ─── */
        .footer {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 2rem 1.5rem;
          border-top: 1px solid var(--surface-border);
        }
        .footer p {
          font-size: 0.8125rem;
          color: var(--text-tertiary);
        }

        /* ─── Responsive ─── */
        @media (max-width: 768px) {
          .hero-title {
            font-size: 2.25rem;
          }
          .hero-subtitle {
            font-size: 1rem;
          }
          .hero-stats {
            gap: 1.25rem;
          }
          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
