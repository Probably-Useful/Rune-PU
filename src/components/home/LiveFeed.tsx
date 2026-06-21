"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./LiveFeed.module.css";

interface FeedEvent {
  id: number;
  event_type: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

const EVENT_DISPLAY: Record<string, { icon: string; text: string; color: string }> = {
  rune_created: { icon: "🔥", text: "A new Rune was forged", color: "var(--accent-primary)" },
  rune_accessed: { icon: "🔓", text: "A Rune was accessed", color: "var(--accent-secondary)" },
  rune_destroyed: { icon: "💀", text: "A Rune self-destructed", color: "var(--danger)" },
  tab_created: { icon: "📝", text: "A new page was inscribed", color: "var(--success)" },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Generate demo seed events
function generateSeedEvents(): FeedEvent[] {
  const types = ["rune_created", "rune_accessed", "tab_created", "rune_accessed", "rune_created", "tab_created", "rune_accessed"];
  return types.map((type, i) => ({
    id: i + 1,
    event_type: type,
    created_at: new Date(Date.now() - (types.length - i) * 45000).toISOString(),
    metadata: {},
  }));
}

export default function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>(generateSeedEvents);
  const [useReal, setUseReal] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // Try to fetch real events from Supabase
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return;

        const res = await fetch(
          `${url}/rest/v1/analytics_events?select=id,event_type,created_at,metadata&order=created_at.desc&limit=15`,
          {
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
            },
          }
        );

        if (!res.ok) return;
        const data: FeedEvent[] = await res.json();

        if (data && data.length > 0) {
          setEvents(data);
          setUseReal(true);
        }
      } catch {
        // Keep demo data
      }
    };

    fetchEvents();
  }, []);

  // Poll for new events if using real data, otherwise simulate
  useEffect(() => {
    if (useReal) {
      // Poll Supabase every 10s
      const interval = setInterval(async () => {
        try {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          if (!url || !key) return;

          const res = await fetch(
            `${url}/rest/v1/analytics_events?select=id,event_type,created_at,metadata&order=created_at.desc&limit=15`,
            {
              headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
              },
            }
          );

          if (res.ok) {
            const data: FeedEvent[] = await res.json();
            if (data && data.length > 0) setEvents(data);
          }
        } catch {
          // Ignore poll errors
        }
      }, 10000);

      return () => clearInterval(interval);
    } else {
      // Simulate new events for demo
      let eventId = events.length + 1;
      const interval = setInterval(() => {
        const possibleTypes = ["rune_created", "rune_accessed", "tab_created", "rune_accessed"];
        const type = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
        const newEvent: FeedEvent = {
          id: eventId++,
          event_type: type,
          created_at: new Date().toISOString(),
          metadata: {},
        };
        setEvents((prev) => [newEvent, ...prev].slice(0, 15));
      }, 4000 + Math.random() * 6000);

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useReal]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.liveIndicator}>
          <span className={styles.liveDot} />
          <span className={styles.liveText}>Live Activity</span>
        </div>
      </div>
      <div className={styles.feed} ref={feedRef}>
        {events.map((event, index) => {
          const display = EVENT_DISPLAY[event.event_type] || {
            icon: "✨",
            text: event.event_type,
            color: "var(--text-secondary)",
          };
          return (
            <div
              key={event.id}
              className={styles.event}
              style={{
                animationDelay: `${index * 50}ms`,
                borderLeftColor: display.color,
              }}
            >
              <span className={styles.eventIcon}>{display.icon}</span>
              <span className={styles.eventText}>{display.text}</span>
              <span className={styles.eventTime}>{timeAgo(event.created_at)}</span>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className={styles.empty}>Waiting for activity...</div>
        )}
      </div>
    </div>
  );
}
