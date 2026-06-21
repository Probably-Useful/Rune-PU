import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/supabase";

// GET /api/rune/[slug]
// If hash is provided, returns tabs for that workspace.
// Otherwise returns workspace metadata (salt, verification blob/iv) to let client unlock.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const store = getStore();
    const rune = await store.getRune(slug);

    if (!rune) {
      return NextResponse.json({ exists: false }, { status: 404 });
    }

    // Check if self-destruct is expired
    if (rune.self_destruct_at && new Date(rune.self_destruct_at) <= new Date()) {
      await store.destroyRune(slug);
      return NextResponse.json({ exists: false, message: "Rune has self-destructed" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const passwordHash = searchParams.get("hash");

    if (passwordHash) {
      // Find workspace by password hash
      const workspace = await store.getWorkspaceByPasswordHash(rune.id, passwordHash);
      if (!workspace) {
        return NextResponse.json({ error: "Invalid password hash" }, { status: 401 });
      }

      // Record access event
      await store.recordAccess();

      // Fetch tabs
      const tabs = await store.getTabsByWorkspace(workspace.id);
      return NextResponse.json({
        exists: true,
        selfDestructAt: rune.self_destruct_at,
        workspaceId: workspace.id,
        tabs: tabs.map(t => ({
          id: t.id,
          encryptedContent: t.encrypted_content,
          encryptedTitle: t.encrypted_title,
          iv: t.iv,
          sortOrder: t.sort_order,
          contentHash: t.content_hash,
          updatedAt: t.updated_at
        }))
      });
    }

    // No hash provided, return workspace configs for the client to verify locally
    const workspaces = await store.getWorkspacesByRuneId(rune.id);
    return NextResponse.json({
      exists: true,
      selfDestructAt: rune.self_destruct_at,
      workspaces: workspaces.map(w => ({
        passwordSalt: w.password_salt,
        verificationBlob: w.verification_blob,
        verificationIv: w.verification_iv
      }))
    });
  } catch (error: any) {
    console.error("GET rune error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/rune/[slug]
// Create a new Rune and/or a workspace inside it
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { passwordHash, passwordSalt, verificationBlob, verificationIv } = await request.json();

    if (!passwordHash || !passwordSalt || !verificationBlob || !verificationIv) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const store = getStore();
    let rune = await store.getRune(slug);

    if (!rune) {
      // Create new rune
      rune = await store.createRune(slug);
    } else {
      // Check if rune has self-destructed
      if (rune.self_destruct_at && new Date(rune.self_destruct_at) <= new Date()) {
        await store.destroyRune(slug);
        rune = await store.createRune(slug);
      }
    }

    // Check if workspace already exists for this password hash
    const existingWorkspace = await store.getWorkspaceByPasswordHash(rune.id, passwordHash);
    if (existingWorkspace) {
      return NextResponse.json({ error: "Workspace already exists" }, { status: 409 });
    }

    // Check if rune already has 2 workspaces (limit is 2)
    const workspaces = await store.getWorkspacesByRuneId(rune.id);
    if (workspaces.length >= 2) {
      return NextResponse.json({ error: "Maximum workspace limit reached" }, { status: 400 });
    }

    // Create workspace
    const workspace = await store.createWorkspace(
      rune.id,
      passwordHash,
      passwordSalt,
      verificationBlob,
      verificationIv
    );

    return NextResponse.json({
      success: true,
      workspaceId: workspace.id,
      message: workspaces.length === 0 ? "Rune created successfully" : "Secondary workspace added"
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST rune error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// PUT /api/rune/[slug]
// Sync/Save tabs for a workspace
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { passwordHash, tabs } = await request.json();

    if (!passwordHash || !Array.isArray(tabs)) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const store = getStore();
    const rune = await store.getRune(slug);
    if (!rune) {
      return NextResponse.json({ error: "Rune not found" }, { status: 404 });
    }

    // Check self-destruct
    if (rune.self_destruct_at && new Date(rune.self_destruct_at) <= new Date()) {
      await store.destroyRune(slug);
      return NextResponse.json({ error: "Rune has self-destructed" }, { status: 410 });
    }

    const workspace = await store.getWorkspaceByPasswordHash(rune.id, passwordHash);
    if (!workspace) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current tabs in workspace to handle deletions
    const currentTabs = await store.getTabsByWorkspace(workspace.id);
    const sentTabIds = new Set(tabs.map(t => t.id).filter(Boolean));

    // Delete tabs not sent in bulk update
    for (const currentTab of currentTabs) {
      if (!sentTabIds.has(currentTab.id)) {
        await store.deleteTab(currentTab.id);
      }
    }

    const savedTabs = [];

    // Save/Update tabs
    for (const tabData of tabs) {
      if (tabData.id) {
        // Update existing
        try {
          const updated = await store.updateTab(
            tabData.id,
            tabData.encryptedContent,
            tabData.encryptedTitle,
            tabData.iv,
            tabData.expectedHash || undefined
          );
          if (updated) {
            savedTabs.push(updated);
          }
        } catch (err: any) {
          if (err.message === "OVERWRITE_CONFLICT") {
            return NextResponse.json({
              error: "CONFLICT",
              tabId: tabData.id,
              message: "Write conflict detected. The document has been modified elsewhere."
            }, { status: 409 });
          }
          throw err;
        }
      } else {
        // Create new
        const created = await store.createTab(
          workspace.id,
          tabData.encryptedContent,
          tabData.encryptedTitle,
          tabData.iv,
          tabData.sortOrder || 0
        );
        savedTabs.push(created);
      }
    }

    return NextResponse.json({
      success: true,
      tabs: savedTabs.map(t => ({
        id: t.id,
        encryptedContent: t.encrypted_content,
        encryptedTitle: t.encrypted_title,
        iv: t.iv,
        sortOrder: t.sort_order,
        contentHash: t.content_hash,
        updatedAt: t.updated_at
      }))
    });
  } catch (error: any) {
    console.error("PUT tabs error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/rune/[slug]
// Delete the entire Rune
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { passwordHash } = await request.json();

    const store = getStore();
    const rune = await store.getRune(slug);
    if (!rune) {
      return NextResponse.json({ error: "Rune not found" }, { status: 404 });
    }

    // Must match a workspace password in this rune
    const workspace = await store.getWorkspaceByPasswordHash(rune.id, passwordHash);
    if (!workspace) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await store.destroyRune(slug);
    return NextResponse.json({ success: true, message: "Rune destroyed successfully" });
  } catch (error: any) {
    console.error("DELETE rune error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
