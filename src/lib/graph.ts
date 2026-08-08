export type Adjacency = Map<string, Set<string>>;

export function buildAdjacency(
  edges: Array<{ person_a_id: string; person_b_id: string }>,
): Adjacency {
  const adj: Adjacency = new Map();

  for (const edge of edges) {
    if (!adj.has(edge.person_a_id)) adj.set(edge.person_a_id, new Set());
    if (!adj.has(edge.person_b_id)) adj.set(edge.person_b_id, new Set());
    adj.get(edge.person_a_id)!.add(edge.person_b_id);
    adj.get(edge.person_b_id)!.add(edge.person_a_id);
  }

  return adj;
}

/** BFS shortest path. Returns person ids from start to target inclusive, or null. */
export function findShortestPath(
  adj: Adjacency,
  start: string,
  target: string,
  maxDepth = 8,
  maxVisited = 5000,
): string[] | null {
  if (start === target) return [start];

  const queue: string[] = [start];
  const visited = new Set<string>([start]);
  const previous = new Map<string, string>();
  const depth = new Map<string, number>([[start, 0]]);

  while (queue.length > 0) {
    if (visited.size > maxVisited) break;

    const current = queue.shift()!;
    const currentDepth = depth.get(current) ?? 0;
    if (currentDepth >= maxDepth) continue;

    const neighbors = adj.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      previous.set(neighbor, current);
      depth.set(neighbor, currentDepth + 1);

      if (neighbor === target) {
        return reconstructPath(previous, target);
      }

      queue.push(neighbor);
    }
  }

  return null;
}

function reconstructPath(previous: Map<string, string>, target: string): string[] {
  const path: string[] = [target];
  let current = target;
  while (previous.has(current)) {
    current = previous.get(current)!;
    path.push(current);
  }
  path.reverse();
  return path;
}

/** Ego network: nodes within `hops` of center, capped. */
export function egoNetwork(
  adj: Adjacency,
  center: string,
  hops = 2,
  maxNodes = 200,
): { nodeIds: Set<string>; edgePairs: Array<[string, string]> } {
  const nodeIds = new Set<string>([center]);
  let frontier = new Set<string>([center]);

  for (let h = 0; h < hops; h++) {
    const next = new Set<string>();
    for (const node of frontier) {
      const neighbors = adj.get(node);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (nodeIds.size >= maxNodes) break;
        if (!nodeIds.has(n)) {
          nodeIds.add(n);
          next.add(n);
        }
      }
      if (nodeIds.size >= maxNodes) break;
    }
    frontier = next;
    if (nodeIds.size >= maxNodes) break;
  }

  const edgePairs: Array<[string, string]> = [];
  for (const node of nodeIds) {
    const neighbors = adj.get(node);
    if (!neighbors) continue;
    for (const n of neighbors) {
      if (!nodeIds.has(n)) continue;
      if (node < n) edgePairs.push([node, n]);
    }
  }

  return { nodeIds, edgePairs };
}
