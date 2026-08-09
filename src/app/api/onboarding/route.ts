import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phoneHash = String(user.user_metadata?.phone_hash ?? "").trim();
  if (!phoneHash) {
    return NextResponse.json(
      { error: "Phone identity missing. Sign in again with your phone number." },
      { status: 400 },
    );
  }

  const body = await request.json();
  const displayName = String(body.displayName ?? "").trim();
  const username = String(body.username ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const skipImport = Boolean(body.skipImport);

  if (!displayName || displayName.length < 2) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }
  if (!username || username.length < 3) {
    return NextResponse.json(
      { error: "Username must be at least 3 characters (a-z, 0-9, _)" },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  const { data: existingProfile } = await service
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json({ ok: true, alreadyOnboarded: true, next: "/dashboard" });
  }

  const { data: usernameTaken } = await service
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (usernameTaken) {
    return NextResponse.json({ error: "Username is taken" }, { status: 409 });
  }

  // Claim existing unclaimed person by phone_hash, or create a new person.
  const { data: matchPerson } = await service
    .from("persons")
    .select("id, claimed")
    .eq("phone_hash", phoneHash)
    .maybeSingle();

  let personId: string;

  if (matchPerson) {
    if (matchPerson.claimed) {
      return NextResponse.json(
        { error: "This phone number is already linked to another account" },
        { status: 409 },
      );
    }
    personId = matchPerson.id;
    const { error: claimError } = await service
      .from("persons")
      .update({ claimed: true, phone_hash: phoneHash })
      .eq("id", personId);
    if (claimError) {
      return NextResponse.json({ error: claimError.message }, { status: 500 });
    }
  } else {
    const { data: newPerson, error: personError } = await service
      .from("persons")
      .insert({ phone_hash: phoneHash, claimed: true })
      .select("id")
      .single();
    if (personError || !newPerson) {
      return NextResponse.json(
        { error: personError?.message ?? "Failed to create person" },
        { status: 500 },
      );
    }
    personId = newPerson.id;
  }

  const { error: userError } = await service.from("users").insert({
    id: user.id,
    person_id: personId,
    username,
    display_name: displayName,
    onboarding_completed: true,
  });

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  await service.from("events").insert({
    user_id: user.id,
    event_name: "onboarding_completed",
    metadata: { claimed_existing: Boolean(matchPerson), skip_import: skipImport },
  });

  return NextResponse.json({
    ok: true,
    personId,
    claimedExisting: Boolean(matchPerson),
    next: skipImport ? "/dashboard" : "/import",
  });
}
