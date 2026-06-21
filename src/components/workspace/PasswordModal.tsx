"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./PasswordModal.module.css";

interface PasswordModalProps {
  slug: string;
  isNewRune: boolean;
  onUnlock: (password: string, isSecondPassword?: boolean, secondPassword?: string) => void;
  error?: string;
  loading?: boolean;
}

export default function PasswordModal({
  slug,
  isNewRune,
  onUnlock,
  error,
  loading = false,
}: PasswordModalProps) {
  const [password, setPassword] = useState("");
  const [secondPassword, setSecondPassword] = useState("");
  const [showDualSetup, setShowDualSetup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    if (isNewRune && showDualSetup && secondPassword.trim()) {
      onUnlock(password, true, secondPassword);
    } else {
      onUnlock(password);
    }
  };

  const getStrengthLevel = (pw: string): { level: number; label: string; color: string } => {
    if (pw.length === 0) return { level: 0, label: "", color: "transparent" };
    if (pw.length < 4) return { level: 1, label: "Weak", color: "var(--danger)" };
    if (pw.length < 8) return { level: 2, label: "Fair", color: "var(--warning)" };
    if (pw.length < 12 && /[A-Z]/.test(pw) && /[0-9]/.test(pw))
      return { level: 3, label: "Strong", color: "var(--success)" };
    if (pw.length >= 12) return { level: 4, label: "Very Strong", color: "var(--accent-secondary)" };
    return { level: 2, label: "Fair", color: "var(--warning)" };
  };

  const strength = getStrengthLevel(password);

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        {/* Lock Icon */}
        <div className={styles.lockIcon}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="20" width="32" height="24" rx="4" stroke="url(#lockGrad)" strokeWidth="2.5" />
            <path d="M16 20V14C16 9.58172 19.5817 6 24 6C28.4183 6 32 9.58172 32 14V20" stroke="url(#lockGrad)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="24" cy="32" r="3" fill="url(#lockGrad)" />
            <defs>
              <linearGradient id="lockGrad" x1="8" y1="6" x2="40" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7c3aed" />
                <stop offset="1" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h2 className={styles.title}>
          {isNewRune ? "Forge a New Rune" : "Unlock Your Rune"}
        </h2>
        <p className={styles.slug}>
          <span className={styles.slugPrefix}>rune/</span>
          {slug}
        </p>

        {isNewRune && (
          <p className={styles.newRuneHint}>
            This Rune doesn&apos;t exist yet. Set a password to create it.
          </p>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="password-input" className={styles.label}>
              {isNewRune ? "Create Password" : "Enter Password"}
            </label>
            <div className={styles.inputWrapper}>
              <input
                ref={inputRef}
                id="password-input"
                type={showPassword ? "text" : "password"}
                className={styles.input}
                placeholder={isNewRune ? "Choose a strong password..." : "Enter your password..."}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className={styles.toggleVis}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {/* Password Strength */}
            {isNewRune && password.length > 0 && (
              <div className={styles.strengthBar}>
                <div className={styles.strengthTrack}>
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={styles.strengthSegment}
                      style={{
                        background: strength.level >= level ? strength.color : "var(--glass-border)",
                      }}
                    />
                  ))}
                </div>
                <span className={styles.strengthLabel} style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {/* Dual Password Setup */}
          {isNewRune && (
            <div className={styles.dualSetup}>
              <button
                type="button"
                className={styles.dualToggle}
                onClick={() => setShowDualSetup(!showDualSetup)}
              >
                <span className={styles.dualIcon}>{showDualSetup ? "▼" : "▶"}</span>
                <span>Set up dual-password workspace</span>
                <span className={styles.dualBadge}>Optional</span>
              </button>

              {showDualSetup && (
                <div className={styles.dualFields}>
                  <p className={styles.dualHint}>
                    A second password will unlock a completely separate, hidden workspace at this same URL.
                  </p>
                  <div className={styles.inputWrapper}>
                    <input
                      id="second-password-input"
                      type={showPassword ? "text" : "password"}
                      className={styles.input}
                      placeholder="Choose a second password..."
                      value={secondPassword}
                      onChange={(e) => setSecondPassword(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={!password.trim() || loading}
          >
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              <>
                <span>{isNewRune ? "Forge Rune" : "Unlock"}</span>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3.75 9H14.25M14.25 9L9.75 4.5M14.25 9L9.75 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className={styles.securityNote}>
          🔒 Your password never leaves this device. All encryption happens in your browser.
        </p>
      </div>
    </div>
  );
}
