"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import PasswordModal from "@/components/workspace/PasswordModal";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { deriveKey, hashDerivedKey, createVerificationBlob, generateSalt, uint8ArrayToBase64, base64ToUint8Array, verifyPassword } from "@/lib/crypto";

interface WorkspaceConfig {
  passwordSalt: string;
  verificationBlob: string;
  verificationIv: string;
}

export default function RuneWorkspacePage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";

  // Page loading & state
  const [loading, setLoading] = useState(true);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [exists, setExists] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceConfig[]>([]);
  const [selfDestructAt, setSelfDestructAt] = useState<string | null>(null);

  // Authenticated states
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [derivedKey, setDerivedKey] = useState<CryptoKey | null>(null);
  const [passwordHash, setPasswordHash] = useState("");
  const [tabs, setTabs] = useState<any[]>([]);
  const [error, setError] = useState("");

  // Check if Rune exists on mount
  useEffect(() => {
    if (!slug) return;

    const checkRune = async () => {
      try {
        const res = await fetch(`/api/rune/${slug}`);
        const data = await res.json();

        if (res.ok && data.exists) {
          setExists(true);
          setWorkspaces(data.workspaces || []);
          setSelfDestructAt(data.selfDestructAt || null);
        } else {
          setExists(false);
        }
      } catch (err) {
        console.error("Error checking Rune existence:", err);
        setExists(false);
      } finally {
        setLoading(false);
      }
    };

    checkRune();
  }, [slug]);

  // Handle Unlock or Forge
  const handleUnlock = async (password: string, isSecondPassword?: boolean, secondPassword?: string) => {
    setUnlockLoading(true);
    setError("");

    try {
      if (!exists) {
        // --- FORGE FLOW ---
        // 1. Derive key for workspace A
        const saltA = generateSalt();
        const keyA = await deriveKey(password, saltA);
        const hashA = await hashDerivedKey(keyA);
        const verifA = await createVerificationBlob(slug, keyA);

        // Save Workspace A
        const resA = await fetch(`/api/rune/${slug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passwordHash: hashA,
            passwordSalt: uint8ArrayToBase64(saltA),
            verificationBlob: verifA.encryptedSlug,
            verificationIv: verifA.iv,
          }),
        });

        const dataA = await resA.json();
        if (!resA.ok) throw new Error(dataA.error || "Failed to forge Rune");

        // 2. Optional: Setup Workspace B
        if (isSecondPassword && secondPassword) {
          const saltB = generateSalt();
          const keyB = await deriveKey(secondPassword, saltB);
          const hashB = await hashDerivedKey(keyB);
          const verifB = await createVerificationBlob(slug, keyB);

          await fetch(`/api/rune/${slug}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              passwordHash: hashB,
              passwordSalt: uint8ArrayToBase64(saltB),
              verificationBlob: verifB.encryptedSlug,
              verificationIv: verifB.iv,
            }),
          });
        }

        // 3. Create initial tab for workspace A (blank JSON)
        const { encrypt, encryptWithEmbeddedIv } = await import("@/lib/crypto");
        const initContent = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [] }] });
        const initTitle = "Untitled Page";
        
        const encContent = await encrypt(initContent, keyA);
        const encTitle = await encryptWithEmbeddedIv(initTitle, keyA);

        const tabPayload = [{
          id: undefined,
          encryptedContent: encContent.ciphertext,
          encryptedTitle: encTitle,
          iv: encContent.iv,
          sortOrder: 1,
        }];

        const saveRes = await fetch(`/api/rune/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passwordHash: hashA, tabs: tabPayload }),
        });

        const saveData = await saveRes.json();
        if (!saveRes.ok) throw new Error(saveData.error || "Failed to save initial page");

        // Set authenticated states
        setDerivedKey(keyA);
        setPasswordHash(hashA);
        setTabs(saveData.tabs || []);
        setIsUnlocked(true);
        setExists(true);
      } else {
        // --- UNLOCK FLOW ---
        let matchedKey: CryptoKey | null = null;
        let matchedHash = "";

        // Loop through all workspace configurations to find a matching password
        for (const ws of workspaces) {
          const saltArr = base64ToUint8Array(ws.passwordSalt);
          const { valid, key } = await verifyPassword(
            password,
            saltArr,
            ws.verificationBlob,
            ws.verificationIv,
            slug
          );

          if (valid && key) {
            matchedKey = key;
            matchedHash = await hashDerivedKey(key);
            break;
          }
        }

        if (!matchedKey || !matchedHash) {
          throw new Error("Incorrect password. Verification failed.");
        }

        // Fetch encrypted tabs
        const res = await fetch(`/api/rune/${slug}?hash=${encodeURIComponent(matchedHash)}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Failed to fetch workspace data");

        // Set authenticated states
        setDerivedKey(matchedKey);
        setPasswordHash(matchedHash);
        setTabs(data.tabs || []);
        setSelfDestructAt(data.selfDestructAt || null);
        setIsUnlocked(true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to unlock Rune. Please try again.");
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleLock = () => {
    // Zero out sensitive states
    setDerivedKey(null);
    setPasswordHash("");
    setTabs([]);
    setIsUnlocked(false);
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-sans)",
          color: "var(--text-secondary)",
          background: "var(--bg-primary)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div className="saving-spinner" style={{ width: "32px", height: "32px", borderWidth: "3px", margin: "0 auto var(--space-md) auto" }} />
          <div>Decoding Rune Cipher...</div>
        </div>
      </div>
    );
  }

  if (isUnlocked && derivedKey) {
    return (
      <WorkspaceLayout
        slug={slug}
        passwordHash={passwordHash}
        derivedKey={derivedKey}
        initialTabs={tabs}
        initialSelfDestructAt={selfDestructAt}
        workspaceCount={workspaces.length}
        onLock={handleLock}
      />
    );
  }

  return (
    <PasswordModal
      slug={slug}
      isNewRune={!exists}
      onUnlock={handleUnlock}
      error={error}
      loading={unlockLoading}
    />
  );
}
