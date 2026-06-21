"use client";

import React, { useState } from "react";
import styles from "./WorkspaceLayout.module.css";
import TabBar, { TabInfo, FolderInfo } from "./TabBar";
import RuneEditor from "../editor/RuneEditor";
import RuneDashboard from "../dashboard/RuneDashboard";
import SelfDestructSettings from "./SelfDestructSettings";
import { deriveKey, hashDerivedKey, createVerificationBlob, generateSalt, uint8ArrayToBase64 } from "@/lib/crypto";
import { encryptWithEmbeddedIv, decryptWithEmbeddedIv } from "@/lib/crypto";

interface Tab {
  id: string;
  title: string;
  encryptedContent: string;
  encryptedTitle: string;
  iv: string;
  sortOrder: number;
  contentHash: string;
}

interface DecryptedTab extends TabInfo {
  decryptedContent: string;
}

interface WorkspaceLayoutProps {
  slug: string;
  passwordHash: string;
  derivedKey: CryptoKey;
  initialTabs: Tab[];
  initialSelfDestructAt: string | null;
  workspaceCount: number;
  onLock: () => void;
  onDecryptedTabsChange?: (tabs: DecryptedTab[]) => void;
}

export default function WorkspaceLayout({
  slug,
  passwordHash,
  derivedKey,
  initialTabs,
  initialSelfDestructAt,
  workspaceCount,
  onLock,
}: WorkspaceLayoutProps) {
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [decryptedTabs, setDecryptedTabs] = useState<DecryptedTab[]>(() => {
    const defaultTab: DecryptedTab = {
      id: "dashboard",
      title: "Sanctum",
      decryptedContent: "",
      isDefault: true,
      folderId: null,
    };
    return [defaultTab];
  });
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("dashboard");
  const [selfDestructAt, setSelfDestructAt] = useState<string | null>(initialSelfDestructAt);
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Dual-password setup states
  const [secondPassword, setSecondPassword] = useState("");
  const [secondPasswordConfirm, setSecondPasswordConfirm] = useState("");
  const [secLoading, setSecLoading] = useState(false);
  const [secSuccess, setSecSuccess] = useState("");
  const [secError, setSecError] = useState("");
  const [secCreated, setSecCreated] = useState(false);

  // Refs for save coordination
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = React.useRef(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Decrypt all tabs on mount and when initialTabs change
  React.useEffect(() => {
    const decryptAll = async () => {
      isSyncingRef.current = true;
      const { decrypt } = await import("@/lib/crypto");

      const decryptedList: DecryptedTab[] = [
        {
          id: "dashboard",
          title: "Sanctum",
          decryptedContent: "",
          isDefault: true,
          folderId: null,
        },
      ];

      for (const tab of tabs) {
        try {
          const decContent = await decrypt(tab.encryptedContent, derivedKey, tab.iv);
          let decTitle: string;
          try {
            decTitle = await decryptWithEmbeddedIv(tab.encryptedTitle, derivedKey);
          } catch {
            decTitle = await decrypt(tab.encryptedTitle, derivedKey, tab.iv);
          }
          // Preserve existing folder assignment if tab already exists in state
          const existingTab = decryptedTabs.find((t) => t.id === tab.id);
          decryptedList.push({
            id: tab.id,
            title: decTitle || "Untitled Page",
            decryptedContent: decContent,
            folderId: existingTab?.folderId ?? null,
          });
        } catch (e) {
          console.error("Failed to decrypt tab:", tab.id, e);
        }
      }

      // Preserve any unsaved "new-" tabs that haven't been persisted yet
      const newTabs = decryptedTabs.filter((t) => t.id.startsWith("new-"));
      setDecryptedTabs([...decryptedList, ...newTabs]);
      // Allow saves again after a short delay (let editor re-render settle)
      setTimeout(() => { isSyncingRef.current = false; }, 300);
    };

    decryptAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, derivedKey]);

  // Debounced/Buffered Save function

  const saveWorkspaceTabs = async (updatedDecryptedTabs: DecryptedTab[]) => {
    if (isSyncingRef.current) return;

    // Abort any in-flight save
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSaving(true);
    setSaveError("");

    try {
      const { encrypt } = await import("@/lib/crypto");
      const encryptedPayload = [];

      for (const tab of updatedDecryptedTabs) {
        if (tab.isDefault) continue;

        const origTab = tabs.find((t) => t.id === tab.id);
        const isNew = tab.id.startsWith("new-") || !origTab;

        const encContentResult = await encrypt(tab.decryptedContent, derivedKey);
        const encTitle = await encryptWithEmbeddedIv(tab.title, derivedKey);

        encryptedPayload.push({
          id: isNew ? undefined : tab.id,
          encryptedContent: encContentResult.ciphertext,
          encryptedTitle: encTitle,
          iv: encContentResult.iv,
          sortOrder: updatedDecryptedTabs.indexOf(tab),
        });
      }

      // Skip save if nothing to save
      if (encryptedPayload.length === 0) {
        setIsSaving(false);
        return;
      }

      const res = await fetch(`/api/rune/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordHash, tabs: encryptedPayload }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === "CONFLICT") {
          throw new Error("Conflict: The database has newer edits. Reload to merge.");
        }
        throw new Error(data.error || "Save failed");
      }

      if (data.tabs) {
        isSyncingRef.current = true;
        setTabs(data.tabs);

        // Map new- IDs to real IDs in decryptedTabs
        const existingIds = new Set(tabs.map((t) => t.id));
        const returnedNewTabs = data.tabs.filter((t: any) => !existingIds.has(t.id));

        if (returnedNewTabs.length > 0) {
          setDecryptedTabs((prev) => {
            const updated = [...prev];
            for (const returned of returnedNewTabs) {
              const newIdx = updated.findIndex((t) => t.id.startsWith("new-"));
              if (newIdx !== -1) {
                updated[newIdx] = { ...updated[newIdx], id: returned.id };
              }
            }
            return updated;
          });
          setActiveTabId((prevId) => {
            if (prevId.startsWith("new-")) {
              const matched = returnedNewTabs[0];
              return matched ? matched.id : prevId;
            }
            return prevId;
          });
        }

        setTimeout(() => { isSyncingRef.current = false; }, 500);
      }
    } catch (err: any) {
      // Ignore aborted requests — they're intentional
      if (err.name === "AbortError") {
        // A newer save superseded this one, not an error
        return;
      }
      console.error("[Rune] Save error:", err.message, err);
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditorChange = (newJson: string, newTitle: string) => {
    if (isSyncingRef.current) return;

    const updated = decryptedTabs.map((t) => {
      if (t.id === activeTabId) {
        // If newTitle is empty, it's a content-only update — keep existing title
        const resolvedTitle = newTitle || t.title || "Untitled Page";
        return { ...t, decryptedContent: newJson, title: resolvedTitle };
      }
      return t;
    });

    setDecryptedTabs(updated);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveWorkspaceTabs(updated);
    }, 2000);
  };

  const handleAddTab = () => {
    const newId = `new-${crypto.randomUUID()}`;
    const newTab: DecryptedTab = {
      id: newId,
      title: "Untitled Page",
      decryptedContent: JSON.stringify({ type: "doc", content: [] }),
      folderId: null,
    };

    const updated = [...decryptedTabs, newTab];
    setDecryptedTabs(updated);
    setActiveTabId(newId);
    saveWorkspaceTabs(updated);
  };

  const handleCloseTab = (tabId: string) => {
    const confirmClose = window.confirm("Are you sure you want to delete this page permanently?");
    if (!confirmClose) return;

    const updated = decryptedTabs.filter((t) => t.id !== tabId);
    setDecryptedTabs(updated);

    if (activeTabId === tabId) {
      setActiveTabId("dashboard");
    }

    saveWorkspaceTabs(updated);
  };

  // Folder handlers
  const handleFolderCreate = (name: string) => {
    const newFolder: FolderInfo = {
      id: `folder-${crypto.randomUUID()}`,
      name,
      isExpanded: true,
    };
    setFolders([...folders, newFolder]);
  };

  const handleFolderRename = (folderId: string, name: string) => {
    setFolders(folders.map((f) => (f.id === folderId ? { ...f, name } : f)));
  };

  const handleFolderDelete = (folderId: string) => {
    // Move pages in this folder back to root
    setDecryptedTabs(
      decryptedTabs.map((t) => (t.folderId === folderId ? { ...t, folderId: null } : t))
    );
    setFolders(folders.filter((f) => f.id !== folderId));
  };

  const handleFolderToggle = (folderId: string) => {
    setFolders(
      folders.map((f) => (f.id === folderId ? { ...f, isExpanded: !f.isExpanded } : f))
    );
  };

  const handleTabMove = (tabId: string, folderId: string | null) => {
    setDecryptedTabs(
      decryptedTabs.map((t) => (t.id === tabId ? { ...t, folderId } : t))
    );
  };

  const handleCreateSecondPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecError("");
    setSecSuccess("");

    if (!secondPassword) {
      setSecError("Password is required");
      return;
    }
    if (secondPassword !== secondPasswordConfirm) {
      setSecError("Passwords do not match");
      return;
    }

    setSecLoading(true);

    try {
      const salt = generateSalt();
      const key = await deriveKey(secondPassword, salt);
      const hash = await hashDerivedKey(key);
      const verif = await createVerificationBlob(slug, key);

      const res = await fetch(`/api/rune/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passwordHash: hash,
          passwordSalt: uint8ArrayToBase64(salt),
          verificationBlob: verif.encryptedSlug,
          verificationIv: verif.iv,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add secondary workspace");

      setSecSuccess("Secondary workspace added! Try logging in with either password.");
      setSecondPassword("");
      setSecondPasswordConfirm("");
      setSecCreated(true);
    } catch (err: any) {
      setSecError(err.message);
    } finally {
      setSecLoading(false);
    }
  };

  const activeTab = decryptedTabs.find((t) => t.id === activeTabId);

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logoRow}>
          <span className={styles.logo}>Rune</span>
          <span className={styles.slugBadge}>{slug}</span>
        </div>

        {/* Vertical Tab/Folder navigation */}
        <div className={styles.sidebarContent}>
          <TabBar
            tabs={decryptedTabs}
            folders={folders}
            activeTabId={activeTabId}
            onTabSelect={(id) => {
              setActiveTabId(id);
              setShowSettings(false);
            }}
            onTabAdd={handleAddTab}
            onTabClose={handleCloseTab}
            onFolderCreate={handleFolderCreate}
            onFolderRename={handleFolderRename}
            onFolderDelete={handleFolderDelete}
            onFolderToggle={handleFolderToggle}
            onTabMove={handleTabMove}
          />
        </div>

        {/* Sidebar Footer */}
        <div className={styles.sidebarFooter}>
          {saveError && <div className={styles.saveError}>⚠️ Sync error. Retry.</div>}
          <button
            className={`${styles.footerBtn} ${showSettings ? styles.active : ""}`}
            onClick={() => {
              setShowSettings(true);
              setActiveTabId("");
            }}
          >
            <span>⚙️ Settings</span>
          </button>
          <button className={styles.lockBtn} onClick={onLock}>
            <span>🔒 Lock Workspace</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {showSettings ? (
          <div className={styles.settingsArea}>
            <div className={styles.settingsHeader}>
              <h2>Settings</h2>
              <button className={styles.closeSettings} onClick={() => { setShowSettings(false); setActiveTabId("dashboard"); }}>
                Close
              </button>
            </div>

            <div className={styles.settingsGrid}>
              <div className={styles.settingsCard}>
                <SelfDestructSettings
                  slug={slug}
                  passwordHash={passwordHash}
                  initialSelfDestructAt={selfDestructAt}
                  onUpdate={setSelfDestructAt}
                />
              </div>

              <div className={styles.settingsCard}>
                <h3>👥 Dual-Password Workspace</h3>
                <p className={styles.settingsDesc}>
                  Create a completely independent hidden workspace at this exact same URL slug.
                  Logging in with Password A will show this workspace; logging in with Password B will show the other.
                </p>

                {workspaceCount >= 2 || secCreated ? (
                  <div className={styles.secSuccess}>
                    ✨ Dual-password workspace is active. This Rune has two independent workspaces — one per password.
                  </div>
                ) : (
                  <form onSubmit={handleCreateSecondPassword} className={styles.secForm}>
                    <div className={styles.inputGroup}>
                      <label htmlFor="sec-pass" className={styles.inputLabel}>New Secondary Password</label>
                      <input
                        id="sec-pass"
                        type="password"
                        className={styles.input}
                        placeholder="Enter second password..."
                        value={secondPassword}
                        onChange={(e) => setSecondPassword(e.target.value)}
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label htmlFor="sec-pass-confirm" className={styles.inputLabel}>Confirm Secondary Password</label>
                      <input
                        id="sec-pass-confirm"
                        type="password"
                        className={styles.input}
                        placeholder="Confirm second password..."
                        value={secondPasswordConfirm}
                        onChange={(e) => setSecondPasswordConfirm(e.target.value)}
                      />
                    </div>
                    {secError && <div className={styles.secError}>⚠️ {secError}</div>}
                    {secSuccess && <div className={styles.secSuccess}>✨ {secSuccess}</div>}

                    <button type="submit" className={styles.secSubmit} disabled={secLoading}>
                      {secLoading ? "Creating..." : "Forge Secondary Password"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : activeTabId === "dashboard" ? (
          <RuneDashboard
            tabs={decryptedTabs}
            activeTabId={activeTabId}
            onTabSelect={setActiveTabId}
          />
        ) : activeTab ? (
          <RuneEditor
            key={activeTab.id}
            title={activeTab.title}
            content={activeTab.decryptedContent}
            onSave={handleEditorChange}
            isSaving={isSaving}
          />
        ) : (
          <div className={styles.noTab}>Select or add a page from the sidebar to begin.</div>
        )}
      </main>
    </div>
  );
}
