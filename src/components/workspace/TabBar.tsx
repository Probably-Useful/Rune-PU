"use client";

import React, { useState, useRef } from "react";
import styles from "./TabBar.module.css";

export interface TabInfo {
  id: string;
  title: string;
  isDefault?: boolean;
  folderId?: string | null;
}

export interface FolderInfo {
  id: string;
  name: string;
  isExpanded: boolean;
}

interface TabBarProps {
  tabs: TabInfo[];
  folders: FolderInfo[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabAdd: () => void;
  onTabClose: (tabId: string) => void;
  onFolderCreate: (name: string) => void;
  onFolderRename: (folderId: string, name: string) => void;
  onFolderDelete: (folderId: string) => void;
  onFolderToggle: (folderId: string) => void;
  onTabMove: (tabId: string, folderId: string | null) => void;
}

export default function TabBar({
  tabs,
  folders,
  activeTabId,
  onTabSelect,
  onTabAdd,
  onTabClose,
  onFolderCreate,
  onFolderRename,
  onFolderDelete,
  onFolderToggle,
  onTabMove,
}: TabBarProps) {
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onFolderCreate(newFolderName.trim());
      setNewFolderName("");
      setShowNewFolder(false);
    }
  };

  const handleRenameFolder = (folderId: string) => {
    if (editingFolderName.trim()) {
      onFolderRename(folderId, editingFolderName.trim());
    }
    setEditingFolderId(null);
    setEditingFolderName("");
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tabId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget(targetId);
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    if (draggedTabId) {
      onTabMove(draggedTabId, folderId);
    }
    setDraggedTabId(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTarget(null);
  };

  // Separate tabs: default (dashboard), root-level, and per-folder
  const defaultTab = tabs.find((t) => t.isDefault);
  const rootTabs = tabs.filter((t) => !t.isDefault && !t.folderId);

  const renderTab = (tab: TabInfo) => (
    <div
      key={tab.id}
      className={`${styles.tab} ${tab.id === activeTabId ? styles.active : ""} ${
        draggedTabId === tab.id ? styles.dragging : ""
      }`}
      onClick={() => onTabSelect(tab.id)}
      draggable={!tab.isDefault}
      onDragStart={(e) => handleDragStart(e, tab.id)}
      onDragEnd={handleDragEnd}
    >
      <span className={styles.tabIcon}>📄</span>
      <span className={styles.tabTitle}>{tab.title}</span>
      {!tab.isDefault && (
        <button
          className={styles.closeBtn}
          onClick={(e) => {
            e.stopPropagation();
            onTabClose(tab.id);
          }}
          title="Delete page"
          aria-label={`Delete ${tab.title}`}
        >
          ×
        </button>
      )}
    </div>
  );

  return (
    <div className={styles.container}>
      {/* Dashboard tab */}
      {defaultTab && (
        <div
          className={`${styles.tab} ${styles.defaultTab} ${
            defaultTab.id === activeTabId ? styles.active : ""
          }`}
          onClick={() => onTabSelect(defaultTab.id)}
        >
          <span className={styles.tabIcon}>📊</span>
          <span className={styles.tabTitle}>{defaultTab.title}</span>
        </div>
      )}

      <div className={styles.divider} />

      {/* Root-level drop zone */}
      <div
        className={`${styles.rootZone} ${dragOverTarget === "root" ? styles.dropHighlight : ""}`}
        onDragOver={(e) => handleDragOver(e, "root")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
      >
        {/* Root tabs */}
        {rootTabs.map(renderTab)}
      </div>

      {/* Folders */}
      {folders.map((folder) => {
        const folderTabs = tabs.filter((t) => t.folderId === folder.id);
        return (
          <div
            key={folder.id}
            className={`${styles.folder} ${
              dragOverTarget === folder.id ? styles.dropHighlight : ""
            }`}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder.id)}
          >
            <div className={styles.folderHeader}>
              <button
                className={styles.folderToggle}
                onClick={() => onFolderToggle(folder.id)}
                aria-label={folder.isExpanded ? "Collapse folder" : "Expand folder"}
              >
                <span className={`${styles.chevron} ${folder.isExpanded ? styles.expanded : ""}`}>
                  ▶
                </span>
              </button>
              {editingFolderId === folder.id ? (
                <input
                  className={styles.folderNameInput}
                  value={editingFolderName}
                  onChange={(e) => setEditingFolderName(e.target.value)}
                  onBlur={() => handleRenameFolder(folder.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameFolder(folder.id);
                    if (e.key === "Escape") {
                      setEditingFolderId(null);
                      setEditingFolderName("");
                    }
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className={styles.folderName}
                  onDoubleClick={() => {
                    setEditingFolderId(folder.id);
                    setEditingFolderName(folder.name);
                  }}
                >
                  📁 {folder.name}
                </span>
              )}
              <span className={styles.folderCount}>{folderTabs.length}</span>
              <button
                className={styles.folderDeleteBtn}
                onClick={() => onFolderDelete(folder.id)}
                title="Delete folder"
                aria-label={`Delete folder ${folder.name}`}
              >
                ×
              </button>
            </div>
            {folder.isExpanded && (
              <div className={styles.folderContent}>
                {folderTabs.length > 0 ? (
                  folderTabs.map(renderTab)
                ) : (
                  <div className={styles.folderEmpty}>Drop pages here</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.addBtn} onClick={onTabAdd} title="New page" aria-label="New page">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>New Page</span>
        </button>
        <button
          className={styles.addBtn}
          onClick={() => {
            setShowNewFolder(true);
            setTimeout(() => newFolderInputRef.current?.focus(), 50);
          }}
          title="New folder"
          aria-label="New folder"
        >
          <span>📁</span>
          <span>New Folder</span>
        </button>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className={styles.newFolderRow}>
          <input
            ref={newFolderInputRef}
            className={styles.folderNameInput}
            placeholder="Folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") {
                setShowNewFolder(false);
                setNewFolderName("");
              }
            }}
            onBlur={() => {
              if (!newFolderName.trim()) {
                setShowNewFolder(false);
              }
            }}
          />
          <button className={styles.confirmBtn} onClick={handleCreateFolder}>
            ✓
          </button>
        </div>
      )}
    </div>
  );
}
