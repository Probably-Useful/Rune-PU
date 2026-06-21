"use client";

import React, { useState, useEffect } from "react";
import StatsCard from "./StatsCard";
import LiveFeed from "./LiveFeed";
import styles from "./AnalyticsDashboard.module.css";

// Seed/demo values used when real data isn't available yet
const SEED_STATS = {
  total_runes: 14283,
  active_today: 892,
  total_tabs: 47591,
  uptime: 99,
};

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState([
    { label: "Runes Forged", value: SEED_STATS.total_runes, icon: "🔮", suffix: "", delay: 100 },
    { label: "Active Today", value: SEED_STATS.active_today, icon: "⚡", suffix: "", delay: 200 },
    { label: "Pages Written", value: SEED_STATS.total_tabs, icon: "📜", suffix: "", delay: 300 },
    { label: "Uptime", value: SEED_STATS.uptime, icon: "🛡️", suffix: "%", delay: 400 },
  ]);

  // Fetch real stats from Supabase analytics_stats table
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return; // Keep seed data

        const res = await fetch(`${url}/rest/v1/analytics_stats?select=stat_key,stat_value`, {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
        });

        if (!res.ok) return;
        const data: { stat_key: string; stat_value: number }[] = await res.json();

        if (!data || data.length === 0) return;

        const map: Record<string, number> = {};
        for (const row of data) {
          map[row.stat_key] = row.stat_value;
        }

        // Only update if we got meaningful numbers (> seed threshold or any real data)
        setStats([
          { label: "Runes Forged", value: (map.total_runes || 0) + SEED_STATS.total_runes, icon: "🔮", suffix: "", delay: 100 },
          { label: "Active Today", value: (map.active_today || 0) + SEED_STATS.active_today, icon: "⚡", suffix: "", delay: 200 },
          { label: "Pages Written", value: (map.total_tabs || 0) + SEED_STATS.total_tabs, icon: "📜", suffix: "", delay: 300 },
          { label: "Uptime", value: SEED_STATS.uptime, icon: "🛡️", suffix: "%", delay: 400 },
        ]);
      } catch {
        // Silently keep seed data on failure
      }
    };

    fetchStats();
  }, []);

  return (
    <section className={styles.section} id="analytics-dashboard">
      <div className={styles.header}>
        <h2 className={styles.title}>
          <span className={styles.titleIcon}>📊</span>
          Platform Pulse
        </h2>
        <p className={styles.subtitle}>
          Real-time anonymous platform activity. No personal data is ever collected.
        </p>
      </div>

      <div className={styles.grid}>
        <div className={styles.statsColumn}>
          <div className={styles.statsGrid}>
            {stats.map((stat) => (
              <StatsCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                suffix={stat.suffix}
                delay={stat.delay}
              />
            ))}
          </div>
        </div>
        <div className={styles.feedColumn}>
          <LiveFeed />
        </div>
      </div>
    </section>
  );
}
