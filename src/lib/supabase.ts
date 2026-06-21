/**
 * Supabase Data Store
 *
 * Uses the real Supabase client when NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are set. Falls back to an in-memory
 * mock store for local dev without credentials.
 *
 * To connect: create a .env.local file in the rune/ root with:
 *   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Types
// ============================================================

export interface RuneRecord {
  id: string;
  slug: string;
  created_at: string;
  self_destruct_at: string | null;
  self_destruct_warning_sent: boolean;
  is_destroyed: boolean;
}

export interface WorkspaceRecord {
  id: string;
  rune_id: string;
  password_hash: string;
  password_salt: string;
  verification_blob: string;
  verification_iv: string;
  created_at: string;
  last_accessed_at: string;
}

export interface TabRecord {
  id: string;
  workspace_id: string;
  encrypted_content: string;
  encrypted_title: string;
  iv: string;
  sort_order: number;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsEvent {
  id: number;
  event_type: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

// ============================================================
// Store Interface
// ============================================================

export interface Store {
  getRune(slug: string): Promise<RuneRecord | null>;
  createRune(slug: string): Promise<RuneRecord>;
  destroyRune(slug: string): Promise<boolean>;
  scheduleSelfDestruct(slug: string, destructAt: string): Promise<boolean>;
  cancelSelfDestruct(slug: string): Promise<boolean>;
  getWorkspaceByPasswordHash(runeId: string, passwordHash: string): Promise<WorkspaceRecord | null>;
  getWorkspacesByRuneId(runeId: string): Promise<WorkspaceRecord[]>;
  createWorkspace(runeId: string, passwordHash: string, passwordSalt: string, verificationBlob: string, verificationIv: string): Promise<WorkspaceRecord>;
  getTabsByWorkspace(workspaceId: string): Promise<TabRecord[]>;
  createTab(workspaceId: string, encryptedContent: string, encryptedTitle: string, iv: string, sortOrder: number): Promise<TabRecord>;
  updateTab(tabId: string, encryptedContent: string, encryptedTitle: string, iv: string, expectedHash?: string): Promise<TabRecord | null>;
  deleteTab(tabId: string): Promise<boolean>;
  recordAccess(): Promise<void>;
  getRecentEvents(limit?: number): Promise<AnalyticsEvent[]>;
  getStats(): Promise<Record<string, number>>;
}

// ============================================================
// Supabase Store (real database)
// ============================================================

class SupabaseStore implements Store {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey);
  }

  async getRune(slug: string): Promise<RuneRecord | null> {
    const { data } = await this.client
      .from("runes")
      .select("*")
      .eq("slug", slug)
      .eq("is_destroyed", false)
      .single();
    return data ?? null;
  }

  async createRune(slug: string): Promise<RuneRecord> {
    const { data, error } = await this.client
      .from("runes")
      .insert({ slug })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await this.emitEvent("rune_created", {});
    return data;
  }

  async destroyRune(slug: string): Promise<boolean> {
    const { error } = await this.client
      .from("runes")
      .delete()
      .eq("slug", slug);
    if (error) return false;
    await this.emitEvent("rune_destroyed", {});
    return true;
  }

  async scheduleSelfDestruct(slug: string, destructAt: string): Promise<boolean> {
    const { error } = await this.client
      .from("runes")
      .update({ self_destruct_at: destructAt, self_destruct_warning_sent: false })
      .eq("slug", slug);
    return !error;
  }

  async cancelSelfDestruct(slug: string): Promise<boolean> {
    const { error } = await this.client
      .from("runes")
      .update({ self_destruct_at: null, self_destruct_warning_sent: false })
      .eq("slug", slug);
    return !error;
  }

  async getWorkspaceByPasswordHash(runeId: string, passwordHash: string): Promise<WorkspaceRecord | null> {
    const { data } = await this.client
      .from("workspaces")
      .select("*")
      .eq("rune_id", runeId)
      .eq("password_hash", passwordHash)
      .single();
    if (data) {
      // Update last_accessed_at
      await this.client
        .from("workspaces")
        .update({ last_accessed_at: new Date().toISOString() })
        .eq("id", data.id);
    }
    return data ?? null;
  }

  async getWorkspacesByRuneId(runeId: string): Promise<WorkspaceRecord[]> {
    const { data } = await this.client
      .from("workspaces")
      .select("*")
      .eq("rune_id", runeId);
    return data ?? [];
  }

  async createWorkspace(
    runeId: string,
    passwordHash: string,
    passwordSalt: string,
    verificationBlob: string,
    verificationIv: string
  ): Promise<WorkspaceRecord> {
    const { data, error } = await this.client
      .from("workspaces")
      .insert({
        rune_id: runeId,
        password_hash: passwordHash,
        password_salt: passwordSalt,
        verification_blob: verificationBlob,
        verification_iv: verificationIv,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async getTabsByWorkspace(workspaceId: string): Promise<TabRecord[]> {
    const { data } = await this.client
      .from("tabs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("sort_order", { ascending: true });
    return data ?? [];
  }

  async createTab(
    workspaceId: string,
    encryptedContent: string,
    encryptedTitle: string,
    iv: string,
    sortOrder: number
  ): Promise<TabRecord> {
    const contentHash = await this.computeHash(encryptedContent);
    const { data, error } = await this.client
      .from("tabs")
      .insert({
        workspace_id: workspaceId,
        encrypted_content: encryptedContent,
        encrypted_title: encryptedTitle,
        iv,
        sort_order: sortOrder,
        content_hash: contentHash,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await this.emitEvent("tab_created", {});
    return data;
  }

  async updateTab(
    tabId: string,
    encryptedContent: string,
    encryptedTitle: string,
    iv: string,
    expectedHash?: string
  ): Promise<TabRecord | null> {
    // Overwrite protection
    if (expectedHash) {
      const { data: existing } = await this.client
        .from("tabs")
        .select("content_hash")
        .eq("id", tabId)
        .single();
      if (existing && existing.content_hash !== expectedHash) {
        throw new Error("OVERWRITE_CONFLICT");
      }
    }

    const contentHash = await this.computeHash(encryptedContent);
    const { data, error } = await this.client
      .from("tabs")
      .update({
        encrypted_content: encryptedContent,
        encrypted_title: encryptedTitle,
        iv,
        content_hash: contentHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tabId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async deleteTab(tabId: string): Promise<boolean> {
    const { error } = await this.client.from("tabs").delete().eq("id", tabId);
    return !error;
  }

  async recordAccess(): Promise<void> {
    await this.emitEvent("rune_accessed", {});
  }

  async getRecentEvents(limit: number = 20): Promise<AnalyticsEvent[]> {
    const { data } = await this.client
      .from("analytics_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  }

  async getStats(): Promise<Record<string, number>> {
    const { data } = await this.client
      .from("analytics_stats")
      .select("stat_key, stat_value");
    const stats: Record<string, number> = {};
    for (const row of data ?? []) {
      stats[row.stat_key] = row.stat_value;
    }
    return stats;
  }

  private async emitEvent(eventType: string, metadata: Record<string, unknown>): Promise<void> {
    await this.client.from("analytics_events").insert({ event_type: eventType, metadata });
  }

  private async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(content));
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}

// ============================================================
// Mock In-Memory Store (local dev without Supabase)
// ============================================================

class MockStore implements Store {
  private runes: Map<string, RuneRecord> = new Map();
  private workspaces: Map<string, WorkspaceRecord> = new Map();
  private tabs: Map<string, TabRecord> = new Map();
  private events: AnalyticsEvent[] = [];
  private nextEventId = 1;
  private totalRunesCreated = 0;
  private totalTabsCreated = 0;

  async getRune(slug: string): Promise<RuneRecord | null> {
    return this.runes.get(slug) ?? null;
  }

  async createRune(slug: string): Promise<RuneRecord> {
    const rune: RuneRecord = {
      id: crypto.randomUUID(),
      slug,
      created_at: new Date().toISOString(),
      self_destruct_at: null,
      self_destruct_warning_sent: false,
      is_destroyed: false,
    };
    this.runes.set(slug, rune);
    this.totalRunesCreated++;
    this.emitEvent("rune_created", {});
    return rune;
  }

  async destroyRune(slug: string): Promise<boolean> {
    const rune = this.runes.get(slug);
    if (!rune) return false;
    for (const [tabId, tab] of this.tabs) {
      const ws = this.workspaces.get(tab.workspace_id);
      if (ws && ws.rune_id === rune.id) this.tabs.delete(tabId);
    }
    for (const [wsId, ws] of this.workspaces) {
      if (ws.rune_id === rune.id) this.workspaces.delete(wsId);
    }
    this.runes.delete(slug);
    this.emitEvent("rune_destroyed", {});
    return true;
  }

  async scheduleSelfDestruct(slug: string, destructAt: string): Promise<boolean> {
    const rune = this.runes.get(slug);
    if (!rune) return false;
    rune.self_destruct_at = destructAt;
    rune.self_destruct_warning_sent = false;
    return true;
  }

  async cancelSelfDestruct(slug: string): Promise<boolean> {
    const rune = this.runes.get(slug);
    if (!rune) return false;
    rune.self_destruct_at = null;
    rune.self_destruct_warning_sent = false;
    return true;
  }

  async getWorkspaceByPasswordHash(runeId: string, passwordHash: string): Promise<WorkspaceRecord | null> {
    for (const ws of this.workspaces.values()) {
      if (ws.rune_id === runeId && ws.password_hash === passwordHash) {
        ws.last_accessed_at = new Date().toISOString();
        return ws;
      }
    }
    return null;
  }

  async getWorkspacesByRuneId(runeId: string): Promise<WorkspaceRecord[]> {
    const result: WorkspaceRecord[] = [];
    for (const ws of this.workspaces.values()) {
      if (ws.rune_id === runeId) result.push(ws);
    }
    return result;
  }

  async createWorkspace(
    runeId: string,
    passwordHash: string,
    passwordSalt: string,
    verificationBlob: string,
    verificationIv: string
  ): Promise<WorkspaceRecord> {
    const ws: WorkspaceRecord = {
      id: crypto.randomUUID(),
      rune_id: runeId,
      password_hash: passwordHash,
      password_salt: passwordSalt,
      verification_blob: verificationBlob,
      verification_iv: verificationIv,
      created_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
    };
    this.workspaces.set(ws.id, ws);
    return ws;
  }

  async getTabsByWorkspace(workspaceId: string): Promise<TabRecord[]> {
    const result: TabRecord[] = [];
    for (const tab of this.tabs.values()) {
      if (tab.workspace_id === workspaceId) result.push(tab);
    }
    return result.sort((a, b) => a.sort_order - b.sort_order);
  }

  async createTab(
    workspaceId: string,
    encryptedContent: string,
    encryptedTitle: string,
    iv: string,
    sortOrder: number
  ): Promise<TabRecord> {
    const tab: TabRecord = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      encrypted_content: encryptedContent,
      encrypted_title: encryptedTitle,
      iv,
      sort_order: sortOrder,
      content_hash: await this.computeHash(encryptedContent),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.tabs.set(tab.id, tab);
    this.totalTabsCreated++;
    this.emitEvent("tab_created", {});
    return tab;
  }

  async updateTab(
    tabId: string,
    encryptedContent: string,
    encryptedTitle: string,
    iv: string,
    expectedHash?: string
  ): Promise<TabRecord | null> {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;
    if (expectedHash && tab.content_hash !== expectedHash) {
      throw new Error("OVERWRITE_CONFLICT");
    }
    tab.encrypted_content = encryptedContent;
    tab.encrypted_title = encryptedTitle;
    tab.iv = iv;
    tab.content_hash = await this.computeHash(encryptedContent);
    tab.updated_at = new Date().toISOString();
    return tab;
  }

  async deleteTab(tabId: string): Promise<boolean> {
    return this.tabs.delete(tabId);
  }

  async recordAccess(): Promise<void> {
    this.emitEvent("rune_accessed", {});
  }

  async getRecentEvents(limit: number = 20): Promise<AnalyticsEvent[]> {
    return this.events.slice(-limit).reverse();
  }

  async getStats(): Promise<Record<string, number>> {
    return {
      total_runes: this.totalRunesCreated,
      active_runes: this.runes.size,
      total_tabs: this.totalTabsCreated,
      active_tabs: this.tabs.size,
      total_workspaces: this.workspaces.size,
    };
  }

  private emitEvent(eventType: string, metadata: Record<string, unknown>): void {
    const event: AnalyticsEvent = {
      id: this.nextEventId++,
      event_type: eventType,
      created_at: new Date().toISOString(),
      metadata,
    };
    this.events.push(event);
    if (this.events.length > 1000) this.events = this.events.slice(-500);
  }

  private async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(content));
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}

// ============================================================
// Singleton Factory
// ============================================================

let storeInstance: Store | null = null;

export function getStore(): Store {
  if (!storeInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && key) {
      console.log("[Rune] Using Supabase store");
      storeInstance = new SupabaseStore(url, key);
    } else {
      console.log("[Rune] No Supabase credentials found, using in-memory mock store");
      storeInstance = new MockStore();
    }
  }
  return storeInstance;
}
