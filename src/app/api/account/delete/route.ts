import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function DELETE() {
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
    .select("person_id")
    .eq("id", user.id)
    .maybeSingle();

  // Remove owner-private imports first
  await service.from("contact_imports").delete().eq("owner_user_id", user.id);
  await service.from("external_profiles").delete().eq("user_id", user.id);
  await service.from("events").delete().eq("user_id", user.id);

  if (profile?.person_id) {
    // Keep the person node in the graph as unclaimed so others' edges remain
    await service
      .from("persons")
      .update({ claimed: false, phone_hash: null })
      .eq("id", profile.person_id);
  }

  await service.from("users").delete().eq("id", user.id);

  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
