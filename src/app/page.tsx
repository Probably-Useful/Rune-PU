"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AnalyticsDashboard from "@/components/home/AnalyticsDashboard";
import styles from "./page.module.css";

export default function HomePage() {
  const [slugInput, setSlugInput] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleGo = () => {
    const slug = slugInput.trim().replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
    if (slug) {
      router.push(`/${slug}`);
    } else {
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleGo();
  };

  const features = [
    {
      icon: "🔐",
      title: "Dual-Password Workspaces",
      desc: "One URL, two secrets. Each password reveals a different workspace. Plausible deniability built in.",
    },
    {
      icon: "✨",
      title: "Inscribe Editor",
      desc: "A premium rich-text writing experience with slash commands, markdown support, code blocks with syntax highlighting, tables, and more.",
    },
    {
      icon: "🕸️",
      title: "Nexus Graph",
      desc: "A 3D interactive knowledge graph that maps semantic connections between your pages using client-side NLP. See how your ideas relate.",
    },
    {
      icon: "💀",
      title: "Scheduled Self-Destruct",
      desc: "Set a timer. When it expires, everything is permanently erased. No traces left behind.",
    },
    {
      icon: "🛡️",
      title: "Client-Side Encryption",
      desc: "AES-256-GCM encryption happens in your browser. We never see your password or your content.",
    },
    {
      icon: "📊",
      title: "Rune Analytics",
      desc: "Personal dashboard with word counts, activity tracking, and content insights — all private.",
    },
  ];

  const faqs = [
    {
      q: "How is Rune different from ProtectedText?",
      a: "Rune builds on the same privacy-first philosophy but adds Inscribe — a premium rich-text editor with slash commands and markdown, dual-password workspaces for plausible deniability, scheduled self-destruction, the Nexus knowledge graph, and a modern UI/UX.",
    },
    {
      q: "How does the dual-password system work?",
      a: "When you create a Rune, you set a primary password. From within your workspace, you can add a second password that unlocks a completely separate workspace at the same URL. Each password decrypts its own independent content — even the server can't tell which workspace you opened.",
    },
    {
      q: "Can you read my notes?",
      a: "No. Your password never leaves your browser. We only store encrypted blobs that are meaningless without your password. We use AES-256-GCM encryption with PBKDF2 key derivation — industry-standard, battle-tested cryptography.",
    },
    {
      q: "What happens when a Rune self-destructs?",
      a: "All encrypted data — every workspace, every tab — is permanently deleted from our servers. The URL is released and can never be reclaimed with the same data. This action is irreversible.",
    },
    {
      q: "What is the Nexus Graph?",
      a: "Each workspace has a Dashboard with an interactive 3D knowledge graph called Nexus. It analyzes your decrypted content using TF-IDF keyword extraction and cosine similarity, then visualizes connections between pages based on shared themes. All processing happens client-side in your browser — the server never sees your content.",
    },
    {
      q: "What is Inscribe?",
      a: "Inscribe is Rune's built-in rich-text editor. It supports slash commands, headings, lists, task lists, code blocks with language-specific syntax highlighting, tables, markdown paste, and inline formatting. Think of it as a full writing environment that lives behind your encryption layer.",
    },
    {
      q: "Is there a limit on content length?",
      a: "Each page can hold approximately 500,000 characters. You can create as many pages as you need within a workspace, organized into folders.",
    },
    {
      q: "What if I forget my password?",
      a: "We can't help you recover it. Your password never reaches our servers — we only store encrypted data. Without the password, the data is permanently inaccessible. This is a feature, not a bug.",
    },
  ];

  return (
    <main className={styles.main}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            End-to-End Encrypted
          </div>
          <h1 className={styles.title}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rune-logo.svg" alt="" width={56} height={56} className={styles.logoIcon} />
            <span className={styles.runeText}>Rune</span>
          </h1>
          <p className={styles.tagline}>
            Write freely. <span className={styles.accentText}>Encrypt everything</span>.
            <br />
            Encrypted, private, and completely yours until you decide it isn't.
          </p>

          {/* URL Input */}
          <div className={styles.inputGroup}>
            <div className={styles.inputWrapper}>
              <span className={styles.inputPrefix}>rune/</span>
              <input
                ref={inputRef}
                id="rune-slug-input"
                type="text"
                className={styles.input}
                placeholder="enter-your-secret-name"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button
              id="go-button"
              className={styles.goButton}
              onClick={handleGo}
            >
              <span>Enter the Rune</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <p className={styles.inputHint}>
            Already have one? Pick up where you left off. New here? Forge your clean slate.
          </p>
        </div>

        {/* Decorative elements */}
        <div className={styles.heroOrb1} aria-hidden="true" />
        <div className={styles.heroOrb2} aria-hidden="true" />
        <div className={styles.heroOrb3} aria-hidden="true" />
      </section>

      {/* Features Section */}
      <section className={styles.features} id="features-section">
        <div className="container">
          <h2 className={styles.sectionTitle}>
            Forged with <span className={styles.accentText}>precision</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            Every feature designed to keep your secrets safe while giving you the most premium writing experience.
          </p>
          <div className={styles.featuresGrid}>
            {features.map((feature, i) => (
              <div
                key={i}
                className={styles.featureCard}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Analytics Dashboard */}
      <section className={styles.analyticsSection} id="analytics-section">
        <div className="container">
          <AnalyticsDashboard />
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howItWorks} id="how-it-works">
        <div className="container">
          <h2 className={styles.sectionTitle}>
            How it <span className={styles.accentText}>works</span>
          </h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>01</div>
              <h3>Choose a name</h3>
              <p>Pick any URL name for your Rune. It&apos;s your unique address.</p>
            </div>
            <div className={styles.stepConnector} aria-hidden="true">
              <svg width="40" height="2" viewBox="0 0 40 2">
                <line x1="0" y1="1" x2="40" y2="1" stroke="var(--glass-border)" strokeWidth="2" strokeDasharray="4 4" />
              </svg>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>02</div>
              <h3>Set your password</h3>
              <p>Your password encrypts everything. We never see it.</p>
            </div>
            <div className={styles.stepConnector} aria-hidden="true">
              <svg width="40" height="2" viewBox="0 0 40 2">
                <line x1="0" y1="1" x2="40" y2="1" stroke="var(--glass-border)" strokeWidth="2" strokeDasharray="4 4" />
              </svg>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>03</div>
              <h3>Write freely</h3>
              <p>Inscribe editor. Multiple pages. Nexus graph. All encrypted.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.faqSection} id="faq-section">
        <div className="container">
          <h2 className={styles.sectionTitle}>
            Frequently <span className={styles.accentText}>asked</span>
          </h2>
          <div className={styles.faqList}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`${styles.faqItem} ${expandedFaq === i ? styles.faqExpanded : ""}`}
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
              >
                <div className={styles.faqQuestion}>
                  <span>{faq.q}</span>
                  <svg
                    className={styles.faqChevron}
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M5 8L10 13L15 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className={styles.faqAnswer}>
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerContent}>
            <div className={styles.footerLogo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/rune-logo.svg" alt="" width={28} height={28} />
              <span className={styles.footerRuneText}>Rune</span>
              <span className={styles.footerTagline}>Zero-knowledge encrypted workspaces.</span>
            </div>
            <div className={styles.footerMeta}>
              <p className={styles.footerWarrant}>
                <em>As of this writing, Rune has not received any government data requests or warrants.</em>
              </p>
              <p className={styles.footerCopyright}>
                © {new Date().getFullYear()} <a href="https://ProbablyUseful.space" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Probably Useful</a>. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
