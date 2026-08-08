"use client";

import { useEffect, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import type { GraphEdge, GraphNode } from "@/lib/types";

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  highlightPath?: string[];
  className?: string;
};

function displayLabel(n: GraphNode): string {
  if (n.kind === "unclaimed" && !n.from_import) return "";
  if (n.kind === "unclaimed" && n.label === "Anonymous") return "";
  const raw = n.label?.trim() ?? "";
  if (!raw) return "";
  // Shorten very long names so labels take less space and collide less
  return raw.length > 22 ? `${raw.slice(0, 20)}…` : raw;
}

function toElements(nodes: GraphNode[], edges: GraphEdge[]): ElementDefinition[] {
  return [
    ...nodes.map((n) => ({
      data: {
        id: n.id,
        label: displayLabel(n),
        kind: n.kind,
      },
    })),
    ...edges.map((e) => ({
      data: { id: e.id, source: e.source, target: e.target },
    })),
  ];
}

function isAlive(cy: Core | null): cy is Core {
  if (!cy) return false;
  const destroyed =
    typeof (cy as Core & { destroyed?: () => boolean }).destroyed === "function"
      ? (cy as Core & { destroyed: () => boolean }).destroyed()
      : false;
  return !destroyed && Boolean(cy.container());
}

/** Push overlapping nodes apart until every pair is at least `minDist` apart. */
function enforceMinNodeDistance(cy: Core, minDist: number) {
  const nodes = cy.nodes();
  if (nodes.length < 2) return;

  for (let pass = 0; pass < 12; pass++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const pa = a.position();
        const pb = b.position();
        let dx = pb.x - pa.x;
        let dy = pb.y - pa.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          // Identical positions: nudge on a deterministic angle
          const angle = ((i * 37 + j * 17) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 0.01;
        }
        if (dist >= minDist) continue;
        const push = (minDist - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        a.position({ x: pa.x - ux * push, y: pa.y - uy * push });
        b.position({ x: pb.x + ux * push, y: pb.y + uy * push });
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function buildAdj(edges: GraphEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  };
  for (const e of edges) {
    add(e.source, e.target);
    add(e.target, e.source);
  }
  return adj;
}

/**
 * Place you at the center; direct contacts on a ring; each contact's
 * private neighbors in a small arc around that contact (group hubs).
 */
function applyRadialGroupLayout(
  cy: Core,
  nodes: GraphNode[],
  edges: GraphEdge[],
  centerId: string,
) {
  const adj = buildAdj(edges);
  const placed = new Set<string>();
  const cx = 0;
  const cyPos = 0;

  const ringRadius = Math.max(200, 48 * Math.max(3, (adj.get(centerId)?.length ?? 0)));
  const groupRadius = 95;

  cy.getElementById(centerId).position({ x: cx, y: cyPos });
  placed.add(centerId);

  const ring = (adj.get(centerId) ?? []).filter((id) => cy.getElementById(id).nonempty());
  const nRing = ring.length || 1;

  ring.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / nRing - Math.PI / 2;
    const hx = cx + ringRadius * Math.cos(angle);
    const hy = cyPos + ringRadius * Math.sin(angle);
    cy.getElementById(id).position({ x: hx, y: hy });
    placed.add(id);

    // Neighbors unique to this hub (not center, not already placed) → arc around hub
    const group = (adj.get(id) ?? []).filter(
      (nid) => nid !== centerId && !placed.has(nid) && cy.getElementById(nid).nonempty(),
    );
    const gCount = group.length;
    if (!gCount) return;

    // Fan group outward from center so clusters read as satellites of the hub
    const outward = Math.atan2(hy - cyPos, hx - cx);
    const spread = Math.min(Math.PI * 0.9, 0.55 + gCount * 0.22);
    group.forEach((gid, gi) => {
      const t = gCount === 1 ? 0.5 : gi / (gCount - 1);
      const a = outward - spread / 2 + t * spread;
      cy.getElementById(gid).position({
        x: hx + groupRadius * Math.cos(a),
        y: hy + groupRadius * Math.sin(a),
      });
      placed.add(gid);
    });
  });

  // Any leftover nodes (disconnected / deeper) go on an outer ring
  const leftover = nodes.map((n) => n.id).filter((id) => !placed.has(id));
  if (leftover.length) {
    const outerR = ringRadius + groupRadius + 110;
    leftover.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / leftover.length;
      cy.getElementById(id).position({
        x: cx + outerR * Math.cos(angle),
        y: cyPos + outerR * Math.sin(angle),
      });
    });
  }
}

function applyGraph(cy: Core, nodes: GraphNode[], edges: GraphEdge[]) {
  cy.stop();
  cy.elements().remove();
  cy.add(toElements(nodes, edges));

  const self = nodes.find((n) => n.kind === "self");

  if (self) {
    applyRadialGroupLayout(cy, nodes, edges, self.id);
  } else {
    cy.layout({
      name: "cose",
      animate: false,
      randomize: true,
      nodeRepulsion: () => 22000,
      nodeOverlap: 56,
      idealEdgeLength: () => 170,
      edgeElasticity: () => 0.45,
      gravity: 0.28,
      numIter: 1000,
      componentSpacing: 90,
      nodeDimensionsIncludeLabels: true,
      padding: 56,
    }).run();
  }

  enforceMinNodeDistance(cy, 78);
  cy.resize();
  cy.fit(undefined, 64);
}

const STYLE: cytoscape.StylesheetStyle[] = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "font-family": "DM Sans, sans-serif",
      "font-size": 13,
      color: "#0c1a1f",
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 12,
      "text-max-width": 110,
      "text-wrap": "ellipsis",
      // Match canvas cream so edges disappear behind names
      "text-background-color": "#f7f3ee",
      "text-background-opacity": 1,
      "text-background-padding": 3,
      "text-background-shape": "roundrectangle",
      "z-index": 10,
      width: 28,
      height: 28,
      "background-color": "#c5d9d6",
      "border-width": 2,
      "border-color": "#16323a",
    },
  },
  {
    selector: 'node[kind = "claimed"]',
    style: {
      "background-color": "#2a9d8f",
      width: 34,
      height: 34,
    },
  },
  {
    selector: 'node[kind = "self"]',
    style: {
      "background-color": "#e07a5f",
      width: 40,
      height: 40,
      "border-width": 3,
      "border-color": "#0c1a1f",
      "font-size": 14,
      "font-weight": 700,
      "text-margin-y": 14,
    },
  },
  {
    selector: 'node[kind = "unclaimed"]',
    style: {
      "background-color": "#f7f3ee",
      "border-style": "dashed",
      "border-color": "#8aa3a0",
      width: 28,
      height: 28,
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "rgba(12,26,31,0.25)",
      "curve-style": "haystack",
      "haystack-radius": 0,
      opacity: 0.9,
      "z-index": 1,
    },
  },
  {
    selector: ".path",
    style: {
      "background-color": "#c45d42",
      "border-color": "#0c1a1f",
    },
  },
  {
    selector: ".path-edge",
    style: {
      width: 3,
      "line-color": "#e07a5f",
      "curve-style": "bezier",
      opacity: 1,
    },
  },
];

export function NetworkGraph({
  nodes,
  edges,
  onNodeClick,
  highlightPath,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const onNodeClickRef = useRef(onNodeClick);
  const [ready, setReady] = useState(false);

  nodesRef.current = nodes;
  edgesRef.current = edges;
  onNodeClickRef.current = onNodeClick;

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let cy: Core | null = null;
    let ro: ResizeObserver | null = null;

    const init = () => {
      if (cancelled || !containerRef.current) return;
      if (containerRef.current.clientHeight < 40) {
        requestAnimationFrame(init);
        return;
      }

      cy = cytoscape({
        container: containerRef.current,
        elements: [],
        style: STYLE,
        layout: { name: "null" },
        minZoom: 0.65,
        maxZoom: 3,
      });

      cy.on("tap", "node", (evt) => {
        const id = evt.target.id();
        const node = nodesRef.current.find((n) => n.id === id);
        const handler = onNodeClickRef.current;
        if (node && handler) handler(node);
      });

      cyRef.current = cy;
      applyGraph(cy, nodesRef.current, edgesRef.current);

      ro = new ResizeObserver(() => {
        if (!isAlive(cy)) return;
        cy.resize();
        cy.fit(undefined, 56);
      });
      ro.observe(containerRef.current);
      setReady(true);
    };

    init();

    return () => {
      cancelled = true;
      setReady(false);
      ro?.disconnect();
      if (cy) {
        try {
          cy.stop();
        } catch {
          // already torn down
        }
        cy.destroy();
      }
      cyRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const cy = cyRef.current;
    if (!isAlive(cy)) return;
    applyGraph(cy, nodes, edges);
  }, [nodes, edges, ready]);

  useEffect(() => {
    if (!ready) return;
    const cy = cyRef.current;
    if (!isAlive(cy)) return;

    cy.elements().removeClass("path path-edge");
    if (!highlightPath?.length) return;

    for (const id of highlightPath) {
      cy.$id(id).addClass("path");
    }
    for (let i = 0; i < highlightPath.length - 1; i++) {
      const a = highlightPath[i];
      const b = highlightPath[i + 1];
      const edge = cy.edges().filter((e) => {
        const s = e.data("source");
        const t = e.data("target");
        return (s === a && t === b) || (s === b && t === a);
      });
      edge.addClass("path-edge");
    }
  }, [highlightPath, nodes, edges, ready]);

  return (
    <div
      ref={containerRef}
      className={
        className ?? "h-full min-h-0 w-full overflow-hidden"
      }
      style={{ backgroundColor: "#f7f3ee" }}
    />
  );
}
