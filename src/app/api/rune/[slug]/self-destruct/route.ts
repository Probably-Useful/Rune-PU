import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/supabase";

// POST /api/rune/[slug]/self-destruct
// Schedule self-destruction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { passwordHash, destructAt } = await request.json();

    if (!passwordHash || !destructAt) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const store = getStore();
    const rune = await store.getRune(slug);
    if (!rune) {
      return NextResponse.json({ error: "Rune not found" }, { status: 404 });
    }

    // Verify workspace access
    const workspace = await store.getWorkspaceByPasswordHash(rune.id, passwordHash);
    if (!workspace) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update self-destruct time
    await store.scheduleSelfDestruct(slug, destructAt);

    return NextResponse.json({
      success: true,
      selfDestructAt: destructAt,
      message: `Rune scheduled to self-destruct at ${destructAt}`
    });
  } catch (error: any) {
    console.error("POST self-destruct error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/rune/[slug]/self-destruct
// Cancel self-destruction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { passwordHash } = await request.json();

    if (!passwordHash) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const store = getStore();
    const rune = await store.getRune(slug);
    if (!rune) {
      return NextResponse.json({ error: "Rune not found" }, { status: 404 });
    }

    // Verify workspace access
    const workspace = await store.getWorkspaceByPasswordHash(rune.id, passwordHash);
    if (!workspace) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await store.cancelSelfDestruct(slug);

    return NextResponse.json({
      success: true,
      selfDestructAt: null,
      message: "Self-destruction cancelled"
    });
  } catch (error: any) {
    console.error("DELETE self-destruct error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
