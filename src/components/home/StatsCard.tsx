"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./StatsCard.module.css";

interface StatsCardProps {
  label: string;
  value: number;
  icon: string;
  suffix?: string;
  delay?: number;
}

export default function StatsCard({
  label,
  value,
  icon,
  suffix = "",
  delay = 0,
}: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const animateCount = useCallback(() => {
    const duration = 1500;
    const steps = 40;
    const stepValue = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(stepValue * step), value);
      setDisplayValue(current);
      if (step >= steps) {
        clearInterval(timer);
        setDisplayValue(value);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsVisible(true);
      animateCount();
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay, animateCount]);

  return (
    <div
      className={`${styles.card} ${isVisible ? styles.visible : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={styles.iconWrap}>
        <span className={styles.icon}>{icon}</span>
      </div>
      <div className={styles.content}>
        <div className={styles.value}>
          {displayValue.toLocaleString()}
          {suffix && <span className={styles.suffix}>{suffix}</span>}
        </div>
        <div className={styles.label}>{label}</div>
      </div>
      <div className={styles.glow} aria-hidden="true" />
    </div>
  );
}
