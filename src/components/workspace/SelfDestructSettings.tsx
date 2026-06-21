"use client";

import React, { useState, useEffect } from "react";
import styles from "./SelfDestructSettings.module.css";

interface SelfDestructSettingsProps {
  slug: string;
  passwordHash: string;
  initialSelfDestructAt: string | null;
  onUpdate: (newDestructAt: string | null) => void;
}

export default function SelfDestructSettings({
  slug,
  passwordHash,
  initialSelfDestructAt,
  onUpdate,
}: SelfDestructSettingsProps) {
  const [selfDestructAt, setSelfDestructAt] = useState<string | null>(initialSelfDestructAt);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDestroyText, setConfirmDestroyText] = useState("");
  const [showConfirmDestroy, setShowConfirmDestroy] = useState(false);

  // Countdown timer effect
  useEffect(() => {
    setSelfDestructAt(initialSelfDestructAt);
  }, [initialSelfDestructAt]);

  useEffect(() => {
    if (!selfDestructAt) {
      setTimeLeft("");
      return;
    }

    const calculateTimeLeft = () => {
      const difference = +new Date(selfDestructAt) - +new Date();
      if (difference <= 0) {
        setTimeLeft("Expired / Destroyed");
        window.location.reload();
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const mins = Math.floor((difference / 1000 / 60) % 60);
      const secs = Math.floor((difference / 1000) % 60);

      const parts = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (mins > 0 || hours > 0) parts.push(`${mins}m`);
      parts.push(`${secs}s`);

      setTimeLeft(parts.join(" "));
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [selfDestructAt]);

  const handleSchedule = async (minutes: number) => {
    const destructAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    await handleScheduleAt(destructAt);
  };

  const handleScheduleAt = async (destructAt: string) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/rune/${slug}/self-destruct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordHash, destructAt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule self-destruction");

      setSelfDestructAt(destructAt);
      onUpdate(destructAt);
      setSuccess("Self-destruction scheduled successfully!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/rune/${slug}/self-destruct`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordHash }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel self-destruction");

      setSelfDestructAt(null);
      onUpdate(null);
      setSuccess("Self-destruction cancelled!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImmediateDestroy = async () => {
    if (confirmDestroyText !== "DESTROY") return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/rune/${slug}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordHash }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to destroy Rune");

      // Redirect to homepage
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>💥 Self-Destruction</h3>
      <p className={styles.description}>
        Schedule this Rune to self-destruct. Once the timer expires, all workspaces and pages associated with this URL will be permanently deleted.
      </p>

      {selfDestructAt ? (
        <div className={styles.activeTimer}>
          <div className={styles.timerBadge}>⚠️ ACTIVE TIMER</div>
          <div className={styles.timeVal}>{timeLeft || "calculating..."}</div>
          <p className={styles.timerHint}>
            Self-destructing at: {new Date(selfDestructAt).toLocaleString()}
          </p>
          <button
            className={styles.cancelBtn}
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel Self-Destruction
          </button>
        </div>
      ) : (
        <div className={styles.setupContainer}>
          <div className={styles.presetsGrid}>
            <button
              className={styles.presetBtn}
              onClick={() => handleSchedule(60)} // 1 Hour
              disabled={loading}
            >
              1 Hour
            </button>
            <button
              className={styles.presetBtn}
              onClick={() => handleSchedule(24 * 60)} // 24 Hours
              disabled={loading}
            >
              24 Hours
            </button>
            <button
              className={styles.presetBtn}
              onClick={() => handleSchedule(7 * 24 * 60)} // 7 Days
              disabled={loading}
            >
              7 Days
            </button>
            <button
              className={styles.presetBtn}
              onClick={() => handleSchedule(30 * 24 * 60)} // 30 Days
              disabled={loading}
            >
              30 Days
            </button>
          </div>

          {/* Custom time input */}
          <div className={styles.customTimeRow}>
            <label className={styles.customLabel}>Custom:</label>
            <input
              id="custom-destruct-time"
              type="datetime-local"
              className={styles.customInput}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              disabled={loading}
            />
            <button
              className={styles.presetBtn}
              disabled={loading}
              onClick={() => {
                const input = document.getElementById("custom-destruct-time") as HTMLInputElement;
                const val = input?.value;
                if (!val) return;
                // datetime-local gives local time string like "2026-06-21T18:30"
                // new Date() parses this as local time
                const target = new Date(val);
                if (isNaN(target.getTime())) return;
                if (target.getTime() <= Date.now() + 60000) {
                  setError("Please pick a time at least 1 minute in the future.");
                  return;
                }
                handleScheduleAt(target.toISOString());
              }}
            >
              Set
            </button>
          </div>
        </div>
      )}

      {error && <div className={styles.error}>⚠️ {error}</div>}
      {success && <div className={styles.success}>✨ {success}</div>}

      <hr className={styles.divider} />

      {/* Immediate destruction */}
      <div className={styles.immediateSection}>
        <h4 className={styles.dangerTitle}>Immediate Destruction</h4>
        <p className={styles.dangerDesc}>
          Instantly delete this entire Rune and release its URL name. This cannot be undone.
        </p>

        {showConfirmDestroy ? (
          <div className={styles.confirmGroup}>
            <p className={styles.confirmLabel}>
              Type <strong>DESTROY</strong> in uppercase below to confirm:
            </p>
            <div className={styles.confirmInputRow}>
              <input
                type="text"
                className={styles.confirmInput}
                placeholder="DESTROY"
                value={confirmDestroyText}
                onChange={(e) => setConfirmDestroyText(e.target.value)}
              />
              <button
                className={styles.destroyBtn}
                disabled={confirmDestroyText !== "DESTROY" || loading}
                onClick={handleImmediateDestroy}
              >
                Permanently Delete Rune
              </button>
            </div>
            <button
              className={styles.backBtn}
              onClick={() => {
                setShowConfirmDestroy(false);
                setConfirmDestroyText("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className={styles.destroyTrigger}
            onClick={() => setShowConfirmDestroy(true)}
          >
            Destroy Rune Now
          </button>
        )}
      </div>
    </div>
  );
}
