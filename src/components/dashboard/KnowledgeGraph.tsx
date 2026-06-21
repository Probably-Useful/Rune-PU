"use client";

import React, { useEffect, useRef, useCallback } from "react";
import styles from "./KnowledgeGraph.module.css";
import { GraphData } from "@/lib/nlp";

interface KnowledgeGraphProps {
  graphData: GraphData;
  activeTabId: string;
  onNodeClick: (tabId: string) => void;
}

const COLORS = ["#7c3aed", "#06b6d4", "#f472b6", "#10b981", "#f59e0b"];

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

    const ForceGraph3DModule = await import("3d-force-graph");
    const ForceGraph3D = ForceGraph3DModule.default as any;

    const nodes = graphData.nodes.map((node) => {
      const cluster = graphData.clusters.get(node.id) ?? 0;
      return {
        id: node.id,
        name: node.title,
        color: COLORS[cluster % COLORS.length],
        val: node.id === activeTabId ? 4 : 1.5,
      };
    });

    const links = graphData.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      value: edge.similarity,
    }));

    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 400;

    const graph = ForceGraph3D()(containerRef.current)
      .width(width)
      .height(height)
      .backgroundColor("rgba(0,0,0,0)")
      .graphData({ nodes, links })
      .nodeColor((node: any) => node.color)
      .nodeVal((node: any) => node.val)
      .nodeLabel((node: any) => node.name)
      .nodeOpacity(0.92)
      .nodeResolution(16)
      .linkColor(() => "rgba(130, 130, 180, 0.35)")
      .linkWidth((link: any) => Math.max(0.5, link.value * 4))
      .linkOpacity(0.5)
      .enableNodeDrag(true)
      .onNodeClick((node: any) => {
        if (node?.id) onNodeClickRef.current(node.id as string);
      })
      .onNodeHover((node: any) => {
        if (containerRef.current) {
          containerRef.current.style.cursor = node ? "pointer" : "default";
        }
      });

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
          <span>Drag to rotate · Scroll to zoom</span>
        </div>
      </div>
    </div>
  );
}
