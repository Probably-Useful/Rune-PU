"use client";

import React, { useState, useMemo } from "react";
import styles from "./RuneDashboard.module.css";
import { buildTFIDFVectors, buildSimilarityGraph, extractTextFromTipTap, tokenize } from "@/lib/nlp";
import KnowledgeGraph from "./KnowledgeGraph";

interface DecryptedTab {
  id: string;
  title: string;
  decryptedContent: string; // Plaintext string or TipTap JSON string
  isDefault?: boolean;
}

interface RuneDashboardProps {
  tabs: DecryptedTab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
}

export default function RuneDashboard({
  tabs,
  activeTabId,
  onTabSelect,
}: RuneDashboardProps) {
  const [similarityThreshold, setSimilarityThreshold] = useState(0.15);

  // Filter out the dashboard tab from NLP processing
  const textTabs = useMemo(() => {
    return tabs
      .filter((tab) => !tab.isDefault)
      .map((tab) => {
        let text = "";
        try {
          // If content is a TipTap JSON string
          const parsed = JSON.parse(tab.decryptedContent);
          text = extractTextFromTipTap(parsed);
        } catch {
          // Fallback to plain string if parsing fails
          text = tab.decryptedContent || "";
        }
        return {
          id: tab.id,
          title: tab.title || "Untitled Page",
          text: text,
        };
      });
  }, [tabs]);

  // Compute total statistics
  const stats = useMemo(() => {
    let totalWords = 0;
    const allTokens: string[] = [];

    textTabs.forEach((t) => {
      const words = t.text.split(/\s+/).filter(Boolean).length;
      totalWords += words;
      allTokens.push(...tokenize(t.text));
    });

    // Find top keyword across all documents
    const tokenFreqs: Record<string, number> = {};
    allTokens.forEach((tok) => {
      tokenFreqs[tok] = (tokenFreqs[tok] || 0) + 1;
    });

    const topKeywords = Object.entries(tokenFreqs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);

    return {
      totalPages: textTabs.length,
      totalWords,
      topKeywords: topKeywords.length > 0 ? topKeywords : ["None yet"],
      averageWordsPerPage: textTabs.length > 0 ? Math.round(totalWords / textTabs.length) : 0,
    };
  }, [textTabs]);

  // Run the NLP pipeline to build the similarity vectors and graph
  const graphData = useMemo(() => {
    if (textTabs.length === 0) {
      return { nodes: [], edges: [], clusters: new Map() };
    }
    const vectors = buildTFIDFVectors(textTabs);
    return buildSimilarityGraph(vectors, similarityThreshold);
  }, [textTabs, similarityThreshold]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>🔮 Sanctum</h1>
        <p className={styles.subtitle}>
          Private insights and connections generated locally in your browser.
        </p>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>📄</span>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Pages</span>
            <span className={styles.statValue}>{stats.totalPages}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>✍️</span>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Words</span>
            <span className={styles.statValue}>{stats.totalWords}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>🗝️</span>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Top Themes</span>
            <span className={styles.statValue} style={{ fontSize: "14px", marginTop: "4px" }}>
              {stats.topKeywords.join(", ")}
            </span>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>📏</span>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Avg Words/Page</span>
            <span className={styles.statValue}>{stats.averageWordsPerPage}</span>
          </div>
        </div>
      </div>

      {/* Graph Section */}
      <div className={styles.graphSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>🕸️ Nexus Graph</h2>
            <p className={styles.sectionDesc}>
              Nodes represent pages. Lines connect pages sharing semantic themes and keywords. Click a node to open that page.
            </p>
          </div>
          <div className={styles.sliderGroup}>
            <label htmlFor="threshold-slider" className={styles.sliderLabel}>
              Link Sensitivity: {(similarityThreshold * 100).toFixed(0)}%
            </label>
            <input
              id="threshold-slider"
              type="range"
              min="0.05"
              max="0.8"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
              className={styles.slider}
            />
          </div>
        </div>

        {textTabs.length > 0 ? (
          <KnowledgeGraph
            graphData={graphData}
            activeTabId={activeTabId}
            onNodeClick={onTabSelect}
          />
        ) : (
          <div className={styles.emptyGraph}>
            <p>Write notes in your other tabs to visualize semantic connections.</p>
          </div>
        )}
      </div>

      {/* Page List Section */}
      <div className={styles.pagesSection}>
        <h2 className={styles.sectionTitle}>Page Analysis</h2>
        <div className={styles.pagesList}>
          {textTabs.map((doc) => {
            const nodeVec = graphData.nodes.find((n) => n.id === doc.id);
            const keywords = nodeVec ? nodeVec.keywords : [];
            const connections = graphData.edges.filter(
              (e) => e.source === doc.id || e.target === doc.id
            ).length;

            return (
              <div
                key={doc.id}
                className={styles.pageItem}
                onClick={() => onTabSelect(doc.id)}
              >
                <div className={styles.pageMain}>
                  <span className={styles.pageIcon}>📄</span>
                  <div>
                    <h3 className={styles.pageTitle}>{doc.title}</h3>
                    <div className={styles.pageKeywords}>
                      {keywords.slice(0, 4).map((kw) => (
                        <span key={kw} className={styles.keywordBadge}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={styles.pageMetrics}>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Words</span>
                    <span className={styles.metricVal}>
                      {doc.text.split(/\s+/).filter(Boolean).length}
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Links</span>
                    <span className={styles.metricVal}>{connections}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {textTabs.length === 0 && (
            <div className={styles.emptyPages}>No pages created yet. Create a tab to get started!</div>
          )}
        </div>
      </div>
    </div>
  );
}
