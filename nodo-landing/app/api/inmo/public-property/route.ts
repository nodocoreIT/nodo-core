import { NextResponse } from "next/server";
import { loadPublicProperty } from "@/lib/inmo/load-public-property";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "missing token" }, { status: 400 });
  }

  try {
    const property = await loadPublicProperty(token);
    if (!property) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(property);
  } catch (error) {
    console.error("public-property:", error);
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
