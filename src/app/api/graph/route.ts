import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildAdjacency, egoNetwork } from "@/lib/graph";
import type { GraphEdge, GraphNode } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id, person_id, display_name, username, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
  }

  // Load a generous slice of connections for ego BFS (MVP scale)
  const { data: edges, error: edgesError } = await service
    .from("connections")
    .select("id, person_a_id, person_b_id")
    .limit(10000);

  if (edgesError) {
    return NextResponse.json({ error: edgesError.message }, { status: 500 });
  }

  const adj = buildAdjacency(edges ?? []);
  const { nodeIds, edgePairs } = egoNetwork(adj, profile.person_id, 2, 200);

  const personIds = Array.from(nodeIds);

  const { data: persons } = await service
    .from("persons")
    .select("id, claimed")
    .in("id", personIds);

  const { data: users } = await service
    .from("users")
    .select("person_id, username, display_name, avatar_url, bio")
    .in("person_id", personIds);

  const { data: imports } = await service
    .from("contact_imports")
    .select("person_id, contact_name")
    .eq("owner_user_id", user.id)
    .in("person_id", personIds);

  const personMap = new Map((persons ?? []).map((p) => [p.id, p]));
  const userMap = new Map((users ?? []).map((u) => [u.person_id, u]));
  const importMap = new Map((imports ?? []).map((i) => [i.person_id, i.contact_name]));

  const nodes: GraphNode[] = personIds.map((id) => {
    if (id === profile.person_id) {
      return {
        id,
        label: profile.display_name,
        kind: "self",
        username: profile.username,
        avatar_url: profile.avatar_url,
      };
    }

    const u = userMap.get(id);
    const claimed = personMap.get(id)?.claimed ?? false;

    if (claimed && u) {
      return {
        id,
        label: u.display_name,
        kind: "claimed",
        username: u.username,
        avatar_url: u.avatar_url,
        bio: u.bio,
      };
    }

    // Owner can see their imported contact name; others see empty anonymous nodes
    const ownerName = importMap.get(id);
    const fromImport = Boolean(ownerName);
    return {
      id,
      label: fromImport ? ownerName! : "Anonymous",
      kind: "unclaimed",
      from_import: fromImport,
    };
  });

  const graphEdges: GraphEdge[] = edgePairs.map(([source, target]) => ({
    id: `${source}-${target}`,
    source,
    target,
  }));

  const claimedCount = nodes.filter((n) => n.kind === "claimed" || n.kind === "self").length;
  const unclaimedCount = nodes.filter((n) => n.kind === "unclaimed").length;

  return NextResponse.json({
    nodes,
    edges: graphEdges,
    stats: {
      total: nodes.length,
      claimed: claimedCount,
      unclaimed: unclaimedCount,
    },
  });
}
