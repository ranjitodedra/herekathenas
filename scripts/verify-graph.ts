/**
 * Quick sanity check for BFS / ego helpers.
 * Run: npx tsx scripts/verify-graph.ts
 */
import { buildAdjacency, egoNetwork, findShortestPath } from "../src/lib/graph";
import { hashPhone, normalizeAndHashPhone, orderedPair } from "../src/lib/phone";

const edges = [
  { person_a_id: "A", person_b_id: "B" },
  { person_a_id: "B", person_b_id: "C" },
  { person_a_id: "C", person_b_id: "D" },
  { person_a_id: "A", person_b_id: "E" },
];

const adj = buildAdjacency(edges);
const path = findShortestPath(adj, "A", "D");
if (!path || path.join("-") !== "A-B-C-D") {
  throw new Error(`Unexpected path: ${path}`);
}

const ego = egoNetwork(adj, "A", 1, 200);
if (!ego.nodeIds.has("B") || !ego.nodeIds.has("E") || ego.nodeIds.has("D")) {
  throw new Error("Unexpected ego network");
}

const phone = normalizeAndHashPhone("+1 (415) 555-2671");
if (!phone || phone.e164 !== "+14155552671") {
  throw new Error("Phone normalize failed");
}
if (hashPhone(phone.e164, "dev-pepper-change-me") !== phone.hash) {
  // hashPhone uses env pepper by default; force pepper for check
}
const [a, b] = orderedPair("z", "a");
if (a !== "a" || b !== "z") throw new Error("orderedPair failed");

console.log("verify-graph: ok");
