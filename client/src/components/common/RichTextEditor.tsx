import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Link2,
  Table,
  Minus,
  Eye,
  Edit3,
  Undo2,
  Redo2,
  Eraser,
  HelpCircle,
  Columns2,
} from 'lucide-react';

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  minLength?: number;
  rows?: number;
  error?: string | null;
  required?: boolean;
  label?: string;
  helperText?: string;
}

type EditorViewMode = 'write' | 'preview' | 'split';

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  id = 'rich-editor',
  value,
  onChange,
  placeholder = 'Write details here...',
  maxLength = 5000,
  minLength = 10,
  rows = 8,
  error,
  required = false,
  label,
  helperText,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [viewMode, setViewMode] = useState<EditorViewMode>('write');
  const [showHelp, setShowHelp] = useState(false);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const isInternalChange = useRef<boolean>(false);

  const pushHistory = useCallback((newValue: string) => {
    isInternalChange.current = true;
    setHistory((prev) => {
      const updated = prev.slice(0, historyIndex + 1);
      if (updated[updated.length - 1] === newValue) return prev;
      return [...updated, newValue].slice(-30); // keep last 30 states
    });
    setHistoryIndex((prev) => prev + 1);
    onChange(newValue);
  }, [historyIndex, onChange]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
      if (textareaRef.current) textareaRef.current.focus();
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
      if (textareaRef.current) textareaRef.current.focus();
    }
  };

  // Synchronize external value changes if not triggered internally
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (history[historyIndex] !== value) {
      setHistory((prev) => [...prev.slice(0, historyIndex + 1), value]);
      setHistoryIndex((prev) => prev + 1);
    }
  }, [value, history, historyIndex]);

  // Insert or wrap text around selection
  const insertFormatting = (
    prefix: string,
    suffix: string = '',
    defaultText: string = 'text',
    lineLevel: boolean = false
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = value;
    const selectedText = currentVal.substring(start, end);

    if (lineLevel) {
      // Find start of current line
      const lineStart = currentVal.lastIndexOf('\n', start - 1) + 1;
      const beforeLine = currentVal.substring(0, lineStart);
      const afterLineStart = currentVal.substring(lineStart);
      const replacement = prefix + afterLineStart;
      const nextVal = beforeLine + replacement;
      pushHistory(nextVal);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
      return;
    }

    const textToInsert = selectedText || defaultText;
    const replacement = `${prefix}${textToInsert}${suffix}`;
    const nextVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);

    pushHistory(nextVal);

    setTimeout(() => {
      textarea.focus();
      const newCursorStart = start + prefix.length;
      const newCursorEnd = newCursorStart + textToInsert.length;
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    }, 0);
  };

  // Insert link
  const insertLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || 'link title';
    const linkTemplate = `[${selectedText}](https://example.com)`;
    const nextVal = value.substring(0, start) + linkTemplate + value.substring(end);
    pushHistory(nextVal);

    setTimeout(() => {
      textarea.focus();
      // Select the URL portion for quick overwrite
      const urlStart = start + selectedText.length + 3;
      const urlEnd = urlStart + 19;
      textarea.setSelectionRange(urlStart, urlEnd);
    }, 0);
  };

  // Insert Table Template
  const insertTable = () => {
    const tableTemplate = `\n| Column 1 | Column 2 | Column 3 |\n| :--- | :--- | :--- |\n| Value 1 | Value 2 | Value 3 |\n| Value 4 | Value 5 | Value 6 |\n`;
    insertFormatting(tableTemplate, '', '', false);
  };

  // Clear all text or formatting
  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the editor content?')) {
      pushHistory('');
      if (textareaRef.current) textareaRef.current.focus();
    }
  };

  // Keyboard shortcut handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertFormatting('**', '**', 'bold text');
    } else if (modifier && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertFormatting('*', '*', 'italic text');
    } else if (modifier && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      insertLink();
    } else if (modifier && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    } else if (modifier && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Insert 2 spaces
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextVal = value.substring(0, start) + '  ' + value.substring(end);
      pushHistory(nextVal);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
    }
  };

  // Word and character stats
  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // Render markdown preview safely
  const renderMarkdown = (text: string) => {
    if (!text.trim()) {
      return (
        <p className="text-stone-400 italic text-xs">
          No content written yet. Switch to Write mode to compose your event description.
        </p>
      );
    }

    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let inList = false;
    let listItems: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' = 'ul';

    const flushList = () => {
      if (inList && listItems.length > 0) {
        if (listType === 'ol') {
          elements.push(
            <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 my-2 pl-2 text-stone-700 text-xs sm:text-sm">
              {listItems}
            </ol>
          );
        } else {
          elements.push(
            <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-2 pl-2 text-stone-700 text-xs sm:text-sm">
              {listItems}
            </ul>
          );
        }
        inList = false;
        listItems = [];
      }
    };

    const parseInline = (str: string): React.ReactNode => {
      // Inline code
      let formatted = str;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;

      // Match [text](url), **bold**, *italic*, ~~strike~~, `code`
      const regex = /(\[.*?\]\(.*?\)|\*\*.*?\*\*|\*.*?\*|~~.*?~~|`.*?`)/g;
      let match;
      let idx = 0;

      while ((match = regex.exec(formatted)) !== null) {
        if (match.index > lastIndex) {
          parts.push(formatted.substring(lastIndex, match.index));
        }
        const token = match[0];

        if (token.startsWith('[') && token.includes('](')) {
          const title = token.substring(1, token.indexOf(']('));
          const url = token.substring(token.indexOf('](') + 2, token.length - 1);
          parts.push(
            <a
              key={idx++}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-900 underline font-medium hover:text-black"
            >
              {title}
            </a>
          );
        } else if (token.startsWith('**') && token.endsWith('**')) {
          parts.push(<strong key={idx++} className="font-bold text-stone-900">{token.slice(2, -2)}</strong>);
        } else if (token.startsWith('*') && token.endsWith('*')) {
          parts.push(<em key={idx++} className="italic text-stone-800">{token.slice(1, -1)}</em>);
        } else if (token.startsWith('~~') && token.endsWith('~~')) {
          parts.push(<del key={idx++} className="line-through text-stone-500">{token.slice(2, -2)}</del>);
        } else if (token.startsWith('`') && token.endsWith('`')) {
          parts.push(
            <code key={idx++} className="px-1.5 py-0.5 rounded bg-stone-100 font-mono text-[11px] text-stone-800 border border-stone-200">
              {token.slice(1, -1)}
            </code>
          );
        }
        lastIndex = match.index + token.length;
      }

      if (lastIndex < formatted.length) {
        parts.push(formatted.substring(lastIndex));
      }

      return parts.length > 0 ? parts : str;
    };

    lines.forEach((line, index) => {
      // Code block start / end
      if (line.trim().startsWith('```')) {
        flushList();
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${index}`} className="p-3 rounded-xl bg-stone-900 text-stone-100 font-mono text-xs overflow-x-auto my-2.5">
              <code>{codeBlockContent.join('\n')}</code>
            </pre>
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Horizontal Rule
      if (line.trim() === '---' || line.trim() === '***') {
        flushList();
        elements.push(<hr key={`hr-${index}`} className="border-t border-stone-200 my-3" />);
        return;
      }

      // Headings
      if (line.startsWith('# ')) {
        flushList();
        elements.push(
          <h1 key={`h1-${index}`} className="text-lg font-bold text-stone-900 mt-3 mb-1 tracking-tight">
            {parseInline(line.substring(2))}
          </h1>
        );
        return;
      }
      if (line.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={`h2-${index}`} className="text-base font-semibold text-stone-900 mt-2.5 mb-1 tracking-tight">
            {parseInline(line.substring(3))}
          </h2>
        );
        return;
      }
      if (line.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={`h3-${index}`} className="text-sm font-semibold text-stone-800 mt-2 mb-0.5">
            {parseInline(line.substring(4))}
          </h3>
        );
        return;
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        flushList();
        elements.push(
          <blockquote key={`quote-${index}`} className="border-l-2 border-stone-800 pl-3 py-0.5 my-2 italic text-stone-600 text-xs sm:text-sm bg-stone-50/50 rounded-r">
            {parseInline(line.substring(2))}
          </blockquote>
        );
        return;
      }

      // Task checklist
      if (line.startsWith('- [ ] ') || line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
        flushList();
        const checked = line.startsWith('- [x] ') || line.startsWith('- [X] ');
        elements.push(
          <div key={`task-${index}`} className="flex items-center gap-2 my-1 text-xs sm:text-sm text-stone-700">
            <input type="checkbox" checked={checked} readOnly className="rounded border-stone-300 accent-stone-900" />
            <span className={checked ? 'line-through text-stone-400' : ''}>
              {parseInline(line.substring(6))}
            </span>
          </div>
        );
        return;
      }

      // Unordered lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
        }
        listItems.push(<li key={`li-${index}`}>{parseInline(line.substring(2))}</li>);
        return;
      }

      // Ordered lists
      if (/^\d+\.\s/.test(line)) {
        if (!inList || listType !== 'ol') {
          flushList();
          inList = true;
          listType = 'ol';
        }
        const itemContent = line.replace(/^\d+\.\s/, '');
        listItems.push(<li key={`li-${index}`}>{parseInline(itemContent)}</li>);
        return;
      }

      // Table row
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        flushList();
        // Simple preview of table line
        const cols = line.split('|').filter((c) => c.trim() !== '');
        const isSeparator = cols.every((c) => /^\s*:?-+:?\s*$/.test(c));
        if (!isSeparator) {
          elements.push(
            <div key={`tbl-${index}`} className="grid grid-flow-col auto-cols-fr gap-2 py-1 px-2 border-b border-stone-100 text-xs font-mono text-stone-700 bg-stone-50/30">
              {cols.map((col, cIdx) => (
                <div key={cIdx} className="truncate">{parseInline(col.trim())}</div>
              ))}
            </div>
          );
        }
        return;
      }

      // Normal paragraph or blank line
      flushList();
      if (!line.trim()) {
        elements.push(<div key={`blank-${index}`} className="h-2" />);
      } else {
        elements.push(
          <p key={`p-${index}`} className="text-xs sm:text-sm text-stone-700 leading-relaxed my-1">
            {parseInline(line)}
          </p>
        );
      }
    });

    flushList();
    return elements;
  };

  return (
    <div className="w-full space-y-1.5">
      {/* Label and Mode Switcher Header */}
      <div className="flex items-center justify-between">
        {label && (
          <label htmlFor={id} className="block text-xs font-semibold text-zinc-900">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-stone-100 border border-stone-200/80 text-stone-600">
            <button
              type="button"
              onClick={() => setViewMode('write')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                viewMode === 'write'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'hover:text-stone-900 text-stone-500'
              }`}
              title="Write Markdown"
            >
              <Edit3 className="w-3 h-3" />
              <span>Write</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'hover:text-stone-900 text-stone-500'
              }`}
              title="Preview Rendered Description"
            >
              <Eye className="w-3 h-3" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'hover:text-stone-900 text-stone-500'
              }`}
              title="Split View (Editor & Live Preview)"
            >
              <Columns2 className="w-3 h-3" />
              <span>Split</span>
            </button>
          </div>

          {/* Quick Markdown Cheatsheet Help Toggle */}
          <button
            type="button"
            onClick={() => setShowHelp((prev) => !prev)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              showHelp
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-500 hover:text-stone-900 border-stone-200'
            }`}
            title="Markdown Shortcuts Help"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div
        className={`w-full rounded-2xl border transition-all bg-white shadow-2xs flex flex-col overflow-hidden ${
          error
            ? 'border-rose-400 ring-1 ring-rose-300'
            : 'border-stone-300 focus-within:border-stone-900 focus-within:ring-1 focus-within:ring-stone-900/10'
        }`}
      >
        {/* Full Rich Toolbar (Active during write or split mode) */}
        {viewMode !== 'preview' && (
          <div className="flex flex-wrap items-center gap-0.5 px-2.5 py-1.5 bg-stone-50/80 border-b border-stone-200/90 text-stone-700">
            {/* History Controls */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-md hover:bg-stone-200/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-md hover:bg-stone-200/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-stone-200 mx-1" />

            {/* Headings */}
            <button
              type="button"
              onClick={() => insertFormatting('# ', '', 'Heading 1', true)}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Heading 1 (# )"
            >
              <Heading1 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('## ', '', 'Heading 2', true)}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Heading 2 (## )"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('### ', '', 'Heading 3', true)}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Heading 3 (### )"
            >
              <Heading3 className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-stone-200 mx-1" />

            {/* Text Styling */}
            <button
              type="button"
              onClick={() => insertFormatting('**', '**', 'bold text')}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer font-bold"
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('*', '*', 'italic text')}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer italic"
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('~~', '~~', 'strikethrough')}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Strikethrough (~~text~~)"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('`', '`', 'code')}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer font-mono"
              title="Inline Code (`code`)"
            >
              <Code className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-stone-200 mx-1" />

            {/* Lists & Task */}
            <button
              type="button"
              onClick={() => insertFormatting('- ', '', 'List item', true)}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Bulleted List (- )"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('1. ', '', 'Numbered item', true)}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Numbered List (1. )"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('- [ ] ', '', 'Task item', true)}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Checklist Item (- [ ] )"
            >
              <CheckSquare className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-stone-200 mx-1" />

            {/* Blocks & Media */}
            <button
              type="button"
              onClick={() => insertFormatting('> ', '', 'Quote text', true)}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Quote Block (> )"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('```\n', '\n```', 'code block\n')}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Code Block (```)"
            >
              <span className="font-mono text-[11px] font-bold">{'</>'}</span>
            </button>
            <button
              type="button"
              onClick={insertLink}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Insert Link (Ctrl+K)"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={insertTable}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Insert Table Template"
            >
              <Table className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('\n---\n', '', '', false)}
              className="p-1.5 rounded-md hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Horizontal Divider (---)"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {/* Clear All */}
            <div className="ml-auto flex items-center">
              <button
                type="button"
                onClick={handleClear}
                disabled={!value}
                className="p-1.5 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Clear content"
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Cheatsheet Helper Drawer */}
        {showHelp && (
          <div className="bg-stone-900 text-stone-200 px-4 py-3 text-xs border-b border-stone-800 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in duration-150">
            <div>
              <span className="font-semibold text-white block mb-1">Emphasis</span>
              <p className="font-mono text-[11px] text-stone-400">**bold**</p>
              <p className="font-mono text-[11px] text-stone-400">*italic*</p>
              <p className="font-mono text-[11px] text-stone-400">~~strike~~</p>
            </div>
            <div>
              <span className="font-semibold text-white block mb-1">Headers</span>
              <p className="font-mono text-[11px] text-stone-400"># Title H1</p>
              <p className="font-mono text-[11px] text-stone-400">## Section H2</p>
              <p className="font-mono text-[11px] text-stone-400">### Topic H3</p>
            </div>
            <div>
              <span className="font-semibold text-white block mb-1">Lists</span>
              <p className="font-mono text-[11px] text-stone-400">- Bullet Item</p>
              <p className="font-mono text-[11px] text-stone-400">1. Numbered Item</p>
              <p className="font-mono text-[11px] text-stone-400">- [ ] Checklist</p>
            </div>
            <div>
              <span className="font-semibold text-white block mb-1">Links & Code</span>
              <p className="font-mono text-[11px] text-stone-400">[Title](URL)</p>
              <p className="font-mono text-[11px] text-stone-400">`inline code`</p>
              <p className="font-mono text-[11px] text-stone-400">&gt; Quote block</p>
            </div>
          </div>
        )}

        {/* Content Area: Write, Preview, or Split */}
        <div className="relative flex-1 min-h-[180px]">
          {/* Write Mode */}
          {viewMode === 'write' && (
            <textarea
              ref={textareaRef}
              id={id}
              rows={rows}
              value={value}
              onChange={(e) => pushHistory(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              maxLength={maxLength}
              className="w-full h-full p-3.5 text-xs sm:text-sm text-stone-900 bg-white placeholder-stone-400 focus:outline-none resize-y min-h-[180px] font-sans leading-relaxed"
            />
          )}

          {/* Preview Mode */}
          {viewMode === 'preview' && (
            <div className="p-4 overflow-y-auto min-h-[180px] max-h-[420px] bg-stone-50/30">
              {renderMarkdown(value)}
            </div>
          )}

          {/* Split Mode */}
          {viewMode === 'split' && (
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200 min-h-[220px]">
              <textarea
                ref={textareaRef}
                id={id}
                rows={rows}
                value={value}
                onChange={(e) => pushHistory(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                maxLength={maxLength}
                className="w-full h-full p-3.5 text-xs sm:text-sm text-stone-900 bg-white placeholder-stone-400 focus:outline-none resize-none font-sans leading-relaxed"
              />
              <div className="p-4 overflow-y-auto max-h-[360px] bg-stone-50/40">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-stone-400 mb-2">
                  Live Preview
                </div>
                {renderMarkdown(value)}
              </div>
            </div>
          )}
        </div>

        {/* Editor Bottom Status Bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-stone-50/70 border-t border-stone-100 text-[11px] text-stone-500">
          <div className="flex items-center gap-3">
            <span>{wordCount} words</span>
            <span>•</span>
            <span>~{readingTime} min read</span>
            {required && charCount < minLength && (
              <>
                <span>•</span>
                <span className="text-amber-700 font-medium">
                  Min {minLength} characters required ({minLength - charCount} more needed)
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className={charCount >= maxLength ? 'text-rose-600 font-bold' : ''}>
              {charCount} / {maxLength}
            </span>
          </div>
        </div>
      </div>

      {/* Helper text or error message */}
      {error ? (
        <p className="text-[11px] text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-stone-400">{helperText}</p>
      ) : null}
    </div>
  );
};

export default RichTextEditor;
