import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "here-kathenas",
    time: new Date().toISOString(),
  });
}
