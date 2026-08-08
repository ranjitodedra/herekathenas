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

  const { data: imports } = await service
    .from("contact_imports")
    .select("person_id")
    .eq("owner_user_id", user.id);

  const personIds = (imports ?? []).map((i) => i.person_id);

  const { data: profile } = await service
    .from("users")
    .select("person_id")
    .eq("id", user.id)
    .single();

  if (profile && personIds.length) {
    // Delete edges between self and imported contacts only
    for (const pid of personIds) {
      const a = profile.person_id < pid ? profile.person_id : pid;
      const b = profile.person_id < pid ? pid : profile.person_id;
      await service
        .from("connections")
        .delete()
        .eq("person_a_id", a)
        .eq("person_b_id", b)
        .eq("source", "contact_import");
    }
  }

  await service.from("contact_imports").delete().eq("owner_user_id", user.id);

  await service.from("events").insert({
    user_id: user.id,
    event_name: "contacts_deleted",
    metadata: { count: personIds.length },
  });

  return NextResponse.json({ ok: true, deleted: personIds.length });
}
