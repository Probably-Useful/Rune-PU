"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { Highlight } from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Markdown } from "tiptap-markdown";
import { createLowlight, common } from "lowlight";

import "./editor.css";

const lowlight = createLowlight(common);

// Available languages for the code block selector
const LANGUAGES = [
  "plaintext", "javascript", "typescript", "python", "java", "c", "cpp",
  "csharp", "go", "rust", "ruby", "php", "swift", "kotlin", "sql",
  "html", "css", "scss", "json", "yaml", "xml", "bash", "shell",
  "markdown", "docker", "graphql",
];

// Custom Code Block node view with language selector
function CodeBlockView({ node, updateAttributes, extension }: any) {
  const language = node.attrs.language || extension.options.defaultLanguage || "plaintext";

  return (
    <NodeViewWrapper className="code-block-wrapper">
      <div className="code-block-header">
        <select
          className="code-block-lang-select"
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          contentEditable={false}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <span className="code-block-badge">Code</span>
      </div>
      <pre>
        <NodeViewContent as={"code" as any} />
      </pre>
    </NodeViewWrapper>
  );
}

interface RuneEditorProps {
  content: string; // TipTap JSON string
  title: string;
  onSave: (newContent: string, newTitle: string) => void;
  isSaving: boolean;
}

export default function RuneEditor({
  content,
  title,
  onSave,
  isSaving,
}: RuneEditorProps) {
  const [pageTitle, setPageTitle] = useState(title);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuCoords, setSlashMenuCoords] = useState({ top: 0, left: 0 });
  const [slashSearch, setSlashSearch] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: false,
        underline: false,
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands or start writing...",
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "editor-link",
        },
      }),
      Highlight.configure({ multicolor: true }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView);
        },
      }).configure({
        lowlight,
        defaultLanguage: "javascript",
      }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: content ? JSON.parse(content) : { type: "doc", content: [] },
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      // Only send content changes here — title is handled separately by handleTitleChange
      onSave(json, "");

      // Slash command trigger detection
      const { selection } = editor.state;
      const { $from } = selection;
      const textBefore = $from.parent.textBetween(
        Math.max(0, $from.parentOffset - 10),
        $from.parentOffset,
        undefined,
        "\uFFFC"
      );

      const slashIndex = textBefore.lastIndexOf("/");
      if (slashIndex !== -1) {
        const search = textBefore.slice(slashIndex + 1);
        setSlashSearch(search);

        try {
          const view = editor.view;
          const start = view.coordsAtPos($from.pos - search.length - 1);
          setSlashMenuCoords({
            top: start.bottom + window.scrollY,
            left: start.left + window.scrollX,
          });
          setShowSlashMenu(true);
        } catch {
          setShowSlashMenu(false);
        }
      } else {
        setShowSlashMenu(false);
      }
    },
  });

  // Keep title input in sync
  useEffect(() => {
    setPageTitle(title);
  }, [title]);

  // Keep editor content in sync when switched
  useEffect(() => {
    if (editor && content) {
      try {
        const currentJson = JSON.stringify(editor.getJSON());
        if (currentJson !== content) {
          editor.commands.setContent(JSON.parse(content));
        }
      } catch (e) {
        console.error("Failed to parse content in editor", e);
      }
    }
  }, [content, editor]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPageTitle(val);
    if (editor) {
      onSave(JSON.stringify(editor.getJSON()), val);
    }
  }, [editor, onSave]);

  if (!editor) return null;

  // Slash commands actions
  const insertBlock = (type: string) => {
    const { selection } = editor.state;
    const { $from } = selection;
    const currentLineText = $from.parent.textContent;
    const slashIndex = currentLineText.lastIndexOf("/");

    if (slashIndex !== -1) {
      editor
        .chain()
        .focus()
        .deleteRange({
          from: $from.pos - (currentLineText.length - slashIndex),
          to: $from.pos,
        })
        .run();
    }

    switch (type) {
      case "h1":
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case "h2":
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case "h3":
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case "bullet":
        editor.chain().focus().toggleBulletList().run();
        break;
      case "ordered":
        editor.chain().focus().toggleOrderedList().run();
        break;
      case "todo":
        editor.chain().focus().toggleTaskList().run();
        break;
      case "code":
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case "table":
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case "hr":
        editor.chain().focus().setHorizontalRule().run();
        break;
      default:
        break;
    }
    setShowSlashMenu(false);
  };

  const slashCommandsList = [
    { id: "h1", title: "Heading 1", desc: "Big section heading", icon: "H1" },
    { id: "h2", title: "Heading 2", desc: "Medium section heading", icon: "H2" },
    { id: "h3", title: "Heading 3", desc: "Small section heading", icon: "H3" },
    { id: "bullet", title: "Bulleted List", desc: "Create a simple bulleted list", icon: "•" },
    { id: "ordered", title: "Numbered List", desc: "Create a list with numbering", icon: "1." },
    { id: "todo", title: "To-do List", desc: "Track tasks with checkboxes", icon: "☑" },
    { id: "code", title: "Code Block", desc: "Code snippet with syntax highlight", icon: "</>" },
    { id: "table", title: "Table", desc: "Insert a simple grid", icon: "田" },
    { id: "hr", title: "Divider", desc: "Visually divide blocks", icon: "―" },
  ];

  const filteredCommands = slashCommandsList.filter((cmd) =>
    cmd.title.toLowerCase().includes(slashSearch.toLowerCase())
  );

  return (
    <div className="rune-editor-container">
      {/* Editor Header */}
      <div className="editor-meta">
        <input
          type="text"
          className="editor-title-input"
          placeholder="Untitled Page"
          value={pageTitle}
          onChange={handleTitleChange}
        />
        <div className="editor-status">
          {isSaving ? (
            <span className="saving-text">
              <span className="saving-spinner" /> Saving...
            </span>
          ) : (
            <span className="saved-text">🔒 Encrypted & Saved</span>
          )}
        </div>
      </div>

      {/* Editor Toolbar */}
      <div className="editor-toolbar">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "active" : ""}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "active" : ""}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive("underline") ? "active" : ""}
          title="Underline"
        >
          <u>U</u>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive("strike") ? "active" : ""}
          title="Strike"
        >
          <s>S</s>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={editor.isActive("code") ? "active" : ""}
          title="Inline Code"
        >
          <code>&lt;/&gt;</code>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={editor.isActive("highlight") ? "active" : ""}
          title="Highlight"
        >
          🖋️
        </button>

        <span className="toolbar-divider" />

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive("heading", { level: 1 }) ? "active" : ""}
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive("heading", { level: 2 }) ? "active" : ""}
        >
          H2
        </button>

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "active" : ""}
        >
          • List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={editor.isActive("taskList") ? "active" : ""}
        >
          ☑ Todo
        </button>

        <span className="toolbar-divider" />

        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          ↩️
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          ↪️
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="editor-body">
        <EditorContent editor={editor} />
      </div>

      {/* Selection Bubble Menu */}
      {editor && (
        <BubbleMenu className="bubble-menu-wrapper" editor={editor}>
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "active" : ""}
          >
            Bold
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "active" : ""}
          >
            Italic
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive("underline") ? "active" : ""}
          >
            Underline
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={editor.isActive("highlight") ? "active" : ""}
          >
            Highlight
          </button>
        </BubbleMenu>
      )}

      {/* Slash command popover */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div
          className="slash-menu"
          style={{
            top: `${slashMenuCoords.top}px`,
            left: `${slashMenuCoords.left}px`,
          }}
        >
          <div className="slash-menu-header">Basic Blocks</div>
          <div className="slash-menu-list">
            {filteredCommands.map((cmd) => (
              <button
                key={cmd.id}
                className="slash-menu-item"
                onClick={() => insertBlock(cmd.id)}
              >
                <span className="slash-menu-item-icon">{cmd.icon}</span>
                <div className="slash-menu-item-text">
                  <div className="slash-menu-item-title">{cmd.title}</div>
                  <div className="slash-menu-item-desc">{cmd.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
