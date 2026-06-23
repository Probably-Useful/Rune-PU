"use client";

import React, { useEffect, useRef, useCallback } from "react";
import styles from "./KnowledgeGraph.module.css";
import { GraphData } from "@/lib/nlp";

interface KnowledgeGraphProps {
  graphData: GraphData;
  activeTabId: string;
  onNodeClick: (tabId: string) => void;
}

const COLORS = ["#7c3aed", "#06b6d4", "#f472b6", "#10b981", "#f59e0b", "#60a5fa", "#e879f9"];

export default function KnowledgeGraph({
  graphData,
  activeTabId,
  onNodeClick,
}: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;

  const buildGraph = useCallback(async () => {
    if (!containerRef.current) return;

    // Cleanup previous
    if (graphRef.current) {
      graphRef.current._destructor?.();
      graphRef.current = null;
    }
    containerRef.current.innerHTML = "";

    if (graphData.nodes.length === 0) return;

    const ForceGraphModule = await import("force-graph");
    const ForceGraph = (ForceGraphModule.default || ForceGraphModule) as any;

    const nodes = graphData.nodes.map((node) => {
      const cluster = graphData.clusters.get(node.id) ?? 0;
      return {
        id: node.id,
        name: node.title,
        keywords: node.keywords,
        color: COLORS[cluster % COLORS.length],
        val: node.id === activeTabId ? 6 : 3,
      };
    });

    const links = graphData.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      value: edge.similarity,
    }));

    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 400;

    const graph = ForceGraph()(containerRef.current)
      .width(width)
      .height(height)
      .backgroundColor("rgba(0,0,0,0)")
      .graphData({ nodes, links })
      // Custom node rendering — Obsidian style
      .nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const isActive = node.id === activeTabId;
        const radius = isActive ? 8 : 5;
        const fontSize = Math.max(11 / globalScale, 3);

        // Glow for active node
        if (isActive) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
          ctx.fillStyle = `${node.color}33`;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        if (isActive) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2 / globalScale;
          ctx.stroke();
        }

        // Label
        if (globalScale > 0.7 || nodes.length <= 20 || isActive) {
          ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = isActive ? "#f1f5f9" : "#a1a1aa";
          const label = node.name.length > 22 ? node.name.slice(0, 20) + "…" : node.name;
          ctx.fillText(label, node.x, node.y + radius + 3);
        }
      })
      .nodePointerAreaPaint((node: any, color: string, ctx: CanvasRenderingContext2D) => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      })
      // Link styling
      .linkColor(() => "rgba(124, 92, 255, 0.3)")
      .linkWidth((link: any) => 1 + (link.value || 0.1) * 3)
      // Interaction
      .enableNodeDrag(true)
      .enablePointerInteraction(true)
      .onNodeClick((node: any) => {
        if (node?.id) onNodeClickRef.current(node.id as string);
      })
      .onNodeHover((node: any) => {
        if (containerRef.current) {
          containerRef.current.style.cursor = node ? "pointer" : "grab";
        }
      })
      // Force config — compact Obsidian-style layout
      .d3AlphaDecay(0.02)
      .d3VelocityDecay(0.35)
      .warmupTicks(100)
      .cooldownTicks(300);

    // Tighter forces to keep nodes grouped
    graph.d3Force("charge")?.strength(-60);
    graph.d3Force("link")?.distance(40).strength(0.7);
    graph.d3Force("center")?.strength(0.8);

    // Zoom to fit after layout stabilizes
    setTimeout(() => {
      graph.zoomToFit(400, 60);
    }, 600);

    graphRef.current = graph;

    // Handle container resize
    const ro = new ResizeObserver(() => {
      if (containerRef.current && graphRef.current) {
        graphRef.current
          .width(containerRef.current.clientWidth)
          .height(containerRef.current.clientHeight || 400);
      }
    });
    ro.observe(containerRef.current);

    return () => ro.disconnect();
  }, [graphData, activeTabId]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    buildGraph().then((c) => {
      cleanup = c as any;
    });

    return () => {
      cleanup?.();
      if (graphRef.current) {
        graphRef.current._destructor?.();
        graphRef.current = null;
      }
      if (containerRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        containerRef.current.innerHTML = "";
      }
    };
  }, [buildGraph]);

  return (
    <div className={styles.graphContainer}>
      <div ref={containerRef} className={styles.cy} />
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.activeDot} />
          <span>Active Page</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.connectionLine} />
          <span>Similarity Connection</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.connectionLine} />
          <span>Scroll to zoom · Drag to pan</span>
        </div>
      </div>
    </div>
  );
}
