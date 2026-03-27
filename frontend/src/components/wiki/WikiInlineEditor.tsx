import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  MessageSquareQuote,
  CheckSquare,
  Code,
  Quote,
  Minus,
  Eye,
  EyeOff,
  Save,
  X,
} from 'lucide-react';
import WikiRenderer from './WikiRenderer';
import SlashCommandMenu from './SlashCommandMenu';

interface WikiInlineEditorProps {
  initialBody: string;
  onSave: (body: string) => void;
  onCancel: () => void;
  saving?: boolean;
}

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string = '',
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end);
  const newText = before + selected + after;
  textarea.setRangeText(newText, start, end, 'end');
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function wrapSelectionOrInsert(
  textarea: HTMLTextAreaElement,
  wrapper: string,
  placeholder: string,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  if (start !== end) {
    insertAtCursor(textarea, wrapper, wrapper);
  } else {
    const text = wrapper + placeholder + wrapper;
    textarea.setRangeText(text, start, end, 'end');
    // Position cursor to select the placeholder
    textarea.selectionStart = start + wrapper.length;
    textarea.selectionEnd = start + wrapper.length + placeholder.length;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function prependToLine(textarea: HTMLTextAreaElement, prefix: string) {
  const start = textarea.selectionStart;
  const value = textarea.value;
  // Find the start of the current line
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = value.indexOf('\n', start);
  const actualEnd = lineEnd === -1 ? value.length : lineEnd;
  const line = value.substring(lineStart, actualEnd);
  // Remove existing heading prefixes
  const cleaned = line.replace(/^#{1,6}\s*/, '');
  const newLine = prefix + cleaned;
  textarea.setRangeText(newLine, lineStart, actualEnd, 'end');
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function getCursorCoords(textarea: HTMLTextAreaElement): { top: number; left: number } {
  const mirror = document.createElement('div');
  const style = getComputedStyle(textarea);
  mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;width:${style.width};font:${style.font};padding:${style.padding};border:${style.border};line-height:${style.lineHeight};letter-spacing:${style.letterSpacing};`;
  mirror.textContent = textarea.value.substring(0, textarea.selectionStart);
  const span = document.createElement('span');
  span.textContent = '|';
  mirror.appendChild(span);
  document.body.appendChild(mirror);

  const textareaRect = textarea.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();

  document.body.removeChild(mirror);

  return {
    top: textareaRect.top + (spanRect.top - mirrorRect.top) - textarea.scrollTop + 24,
    left: textareaRect.left + (spanRect.left - mirrorRect.left),
  };
}

export default function WikiInlineEditor({
  initialBody,
  onSave,
  onCancel,
  saving,
}: WikiInlineEditorProps) {
  const [body, setBody] = useState(initialBody);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(initialBody);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Slash command state
  const [slashMenu, setSlashMenu] = useState<{
    visible: boolean;
    position: { top: number; left: number };
    slashStart: number;
  }>({ visible: false, position: { top: 0, left: 0 }, slashStart: 0 });

  // Auto-grow textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(400, textarea.scrollHeight) + 'px';
    }
  }, [body]);

  // Debounced preview update
  useEffect(() => {
    if (showPreview) {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => {
        setPreviewHtml(body);
      }, 300);
    }
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [body, showPreview]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const metaKey = e.metaKey || e.ctrlKey;

      // Cmd+S save
      if (metaKey && e.key === 's') {
        e.preventDefault();
        onSave(body);
        return;
      }

      // Cmd+B bold
      if (metaKey && e.key === 'b') {
        e.preventDefault();
        wrapSelectionOrInsert(textarea, '**', 'bold');
        return;
      }

      // Cmd+I italic
      if (metaKey && e.key === 'i') {
        e.preventDefault();
        wrapSelectionOrInsert(textarea, '*', 'italic');
        return;
      }

      // Tab inserts 2 spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        insertAtCursor(textarea, '  ');
        return;
      }

      // Escape closes slash menu or cancels
      if (e.key === 'Escape') {
        if (slashMenu.visible) {
          setSlashMenu((prev) => ({ ...prev, visible: false }));
          return;
        }
      }

      // Slash command trigger
      if (e.key === '/' && !metaKey && !e.shiftKey) {
        // Check if we're at the start of a line or after whitespace
        const pos = textarea.selectionStart;
        const charBefore = pos > 0 ? textarea.value[pos - 1] : '\n';
        if (charBefore === '\n' || charBefore === ' ' || charBefore === '\t' || pos === 0) {
          // Delay to let the '/' character be inserted first
          setTimeout(() => {
            const coords = getCursorCoords(textarea);
            setSlashMenu({
              visible: true,
              position: coords,
              slashStart: pos,
            });
          }, 0);
        }
      }
    },
    [body, onSave, slashMenu.visible],
  );

  function handleSlashInsert(text: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    // Remove the slash and any filter text typed after it
    const currentPos = textarea.selectionStart;
    const newValue =
      body.substring(0, slashMenu.slashStart) +
      text +
      body.substring(currentPos);
    setBody(newValue);
    setSlashMenu((prev) => ({ ...prev, visible: false }));
    // Focus back and position cursor after inserted text
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newPos = slashMenu.slashStart + text.length;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
      }
    }, 0);
  }

  function handleSlashClose() {
    setSlashMenu((prev) => ({ ...prev, visible: false }));
  }

  function handleToolbarAction(action: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();

    switch (action) {
      case 'bold':
        wrapSelectionOrInsert(textarea, '**', 'bold');
        break;
      case 'italic':
        wrapSelectionOrInsert(textarea, '*', 'italic');
        break;
      case 'h1':
        prependToLine(textarea, '# ');
        break;
      case 'h2':
        prependToLine(textarea, '## ');
        break;
      case 'h3':
        prependToLine(textarea, '### ');
        break;
      case 'link':
        insertAtCursor(textarea, '[[', ']]');
        break;
      case 'callout':
        insertAtCursor(textarea, '\n> [!note] Title\n> Content\n');
        break;
      case 'checklist':
        insertAtCursor(textarea, '\n- [ ] ');
        break;
      case 'code': {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.substring(start, end);
        if (selected.includes('\n')) {
          insertAtCursor(textarea, '\n```\n', '\n```\n');
        } else if (selected.length > 0) {
          insertAtCursor(textarea, '`', '`');
        } else {
          insertAtCursor(textarea, '`code`');
          textarea.selectionStart = start + 1;
          textarea.selectionEnd = start + 5;
        }
        break;
      }
      case 'quote': {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start !== end) {
          const selected = textarea.value.substring(start, end);
          const quoted = selected
            .split('\n')
            .map((line) => '> ' + line)
            .join('\n');
          textarea.setRangeText(quoted, start, end, 'end');
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          insertAtCursor(textarea, '> ');
        }
        break;
      }
      case 'divider':
        insertAtCursor(textarea, '\n---\n');
        break;
    }
  }

  const toolbarButtons = [
    { action: 'bold', icon: Bold, label: 'Bold' },
    { action: 'italic', icon: Italic, label: 'Italic' },
    { action: 'h1', icon: Heading1, label: 'Heading 1' },
    { action: 'h2', icon: Heading2, label: 'Heading 2' },
    { action: 'h3', icon: Heading3, label: 'Heading 3' },
    { action: 'link', icon: LinkIcon, label: 'Link' },
    { action: 'callout', icon: MessageSquareQuote, label: 'Callout' },
    { action: 'checklist', icon: CheckSquare, label: 'Checklist' },
    { action: 'code', icon: Code, label: 'Code' },
    { action: 'quote', icon: Quote, label: 'Quote' },
    { action: 'divider', icon: Minus, label: 'Divider' },
  ];

  return (
    <div className="relative">
      {/* Floating Toolbar */}
      <div className="sticky top-0 z-20 bg-white border-b border-stone-200 shadow-sm px-4 py-2 flex items-center gap-1 flex-wrap">
        {/* Format buttons */}
        <div className="flex items-center gap-0.5">
          {toolbarButtons.map((btn) => (
            <button
              key={btn.action}
              onClick={() => handleToolbarAction(btn.action)}
              title={btn.label}
              className="p-1.5 rounded hover:bg-stone-100 text-stone-600 hover:text-stone-900 transition-colors"
            >
              <btn.icon size={16} />
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              showPreview
                ? 'bg-stone-800 text-white'
                : 'border border-stone-300 text-stone-700 hover:bg-stone-50'
            }`}
          >
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            Preview
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 border border-stone-300 text-stone-700 text-xs font-medium rounded-lg hover:bg-stone-50 transition-colors"
          >
            <span className="flex items-center gap-1">
              <X size={14} />
              Cancel
            </span>
          </button>
          <button
            onClick={() => onSave(body)}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write your wiki page in Markdown... Type / for commands"
          className="w-full px-6 py-4 text-sm bg-white resize-none focus:outline-none"
          style={{
            minHeight: '400px',
            lineHeight: '1.7',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          }}
        />

        {/* Slash command menu */}
        {slashMenu.visible && textareaRef.current && (
          <SlashCommandMenu
            textarea={textareaRef.current}
            onInsert={handleSlashInsert}
            onClose={handleSlashClose}
            position={slashMenu.position}
          />
        )}
      </div>

      {/* Preview */}
      {showPreview && (
        <div className="border-t border-stone-200">
          <div className="px-6 py-2 bg-stone-50 border-b border-stone-200">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Preview
            </span>
          </div>
          <div className="px-6 py-4 max-w-4xl">
            {previewHtml.trim() ? (
              <WikiRenderer body={previewHtml} />
            ) : (
              <p className="text-sm text-stone-400">Preview will appear here...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
