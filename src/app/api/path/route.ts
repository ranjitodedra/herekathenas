import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildAdjacency, findShortestPath } from "@/lib/graph";
import type { PathHop } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const targetPersonId = String(body.targetPersonId ?? "").trim();
  const targetUsername = String(body.targetUsername ?? "")
    .trim()
    .toLowerCase();

  if (!targetPersonId && !targetUsername) {
    return NextResponse.json({ error: "Target required" }, { status: 400 });
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

  let targetId = targetPersonId;

  if (!targetId && targetUsername) {
    const { data: targetUser } = await service
      .from("users")
      .select("person_id")
      .eq("username", targetUsername)
      .eq("onboarding_completed", true)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ error: "Person not found", found: false }, { status: 404 });
    }
    targetId = targetUser.person_id;
  }

  if (targetId === profile.person_id) {
    return NextResponse.json({
      found: true,
      distance: 0,
      path: [
        {
          person_id: profile.person_id,
          label: profile.display_name,
          kind: "self",
          username: profile.username,
          avatar_url: profile.avatar_url,
        } satisfies PathHop,
      ],
    });
  }

  const { data: edges, error: edgesError } = await service
    .from("connections")
    .select("person_a_id, person_b_id")
    .limit(20000);

  if (edgesError) {
    return NextResponse.json({ error: edgesError.message }, { status: 500 });
  }

  const adj = buildAdjacency(edges ?? []);
  const pathIds = findShortestPath(adj, profile.person_id, targetId, 8, 5000);

  await service.from("events").insert({
    user_id: user.id,
    event_name: "path_search",
    metadata: {
      target_person_id: targetId,
      found: Boolean(pathIds),
      distance: pathIds ? pathIds.length - 1 : null,
    },
  });

  if (!pathIds) {
    return NextResponse.json({
      found: false,
      message: "No connection found. You currently don't have a known path.",
    });
  }

  const { data: persons } = await service
    .from("persons")
    .select("id, claimed")
    .in("id", pathIds);

  const { data: users } = await service
    .from("users")
    .select("person_id, username, display_name, avatar_url")
    .in("person_id", pathIds);

  const { data: imports } = await service
    .from("contact_imports")
    .select("person_id, contact_name")
    .eq("owner_user_id", user.id)
    .in("person_id", pathIds);

  const personMap = new Map((persons ?? []).map((p) => [p.id, p]));
  const userMap = new Map((users ?? []).map((u) => [u.person_id, u]));
  const importMap = new Map((imports ?? []).map((i) => [i.person_id, i.contact_name]));

  const path: PathHop[] = pathIds.map((id) => {
    if (id === profile.person_id) {
      return {
        person_id: id,
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
        person_id: id,
        label: u.display_name,
        kind: "claimed",
        username: u.username,
        avatar_url: u.avatar_url,
      };
    }
    return {
      person_id: id,
      label: importMap.get(id) ?? "Anonymous",
      kind: "unclaimed",
      from_import: importMap.has(id),
    };
  });

  return NextResponse.json({
    found: true,
    distance: path.length - 1,
    path,
  });
}
