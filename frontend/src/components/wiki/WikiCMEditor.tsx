import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { livePreviewPlugin, livePreviewTheme } from './cm-widgets';
import WikiSlashMenu from './WikiSlashMenu';
import WikiLinkMenu from './WikiLinkMenu';
import type { SlashItem } from './WikiSlashMenu';

interface WikiCMEditorProps {
  body: string;
  onSave: (newBody: string) => void;
  onCreatePage?: (title: string) => Promise<string>;
  onNavigate?: (slug: string) => void;
}

// Syntax highlighting for content (headings, bold, italic etc.)
const obsidianHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.5em', color: '#1c1917' },
  { tag: tags.heading2, fontWeight: '600', fontSize: '1.25em', color: '#292524' },
  { tag: tags.heading3, fontWeight: '600', fontSize: '1.1em', color: '#44403c' },
  { tag: tags.heading4, fontWeight: '600', color: '#57534e' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#a8a29e' },
  { tag: tags.link, color: '#047857', textDecoration: 'underline', textDecorationStyle: 'dotted' },
  { tag: tags.url, color: '#0369a1' },
  { tag: tags.monospace, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9em' },
  { tag: tags.quote, color: '#78716c', fontStyle: 'italic' },
  { tag: tags.contentSeparator, color: '#d6d3d1' },
]);

// Base editor theme
const wikiTheme = EditorView.theme({
  '&': {
    fontSize: '0.875rem',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#44403c',
    backgroundColor: 'transparent',
  },
  '.cm-content': { lineHeight: '1.7', padding: '0', caretColor: '#047857' },
  '.cm-line': { padding: '2px 0' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#047857', borderLeftWidth: '2px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': { display: 'none' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-activeLine': { backgroundColor: 'rgba(4, 120, 87, 0.03)', borderRadius: '2px' },
  // Fenced code block lines get a subtle background
  '.cm-line:has(.tok-monospace)': { backgroundColor: '#fafaf9', borderRadius: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(4, 120, 87, 0.15) !important',
  },
});

function getCursorCoords(view: EditorView): { top: number; left: number } {
  try {
    const head = view.state.selection.main.head;
    const coords = view.coordsAtPos(head);
    if (!coords) return { top: 0, left: 0 };
    return { top: coords.bottom + 4, left: coords.left };
  } catch {
    return { top: 0, left: 0 };
  }
}

export default function WikiCMEditor({ body, onSave, onCreatePage, onNavigate }: WikiCMEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onSaveRef = useRef(onSave);
  const onCreatePageRef = useRef(onCreatePage);
  const onNavigateRef = useRef(onNavigate);
  onSaveRef.current = onSave;
  onCreatePageRef.current = onCreatePage;
  onNavigateRef.current = onNavigate;

  // Slash menu state
  const [slashMenu, setSlashMenu] = useState<{
    visible: boolean; position: { top: number; left: number }; slashPos: number; filter: string;
  } | null>(null);
  const slashMenuRef = useRef(slashMenu);
  slashMenuRef.current = slashMenu;

  // [[ link menu state
  const [linkMenu, setLinkMenu] = useState<{
    visible: boolean; position: { top: number; left: number }; bracketPos: number; query: string;
  } | null>(null);
  const linkMenuRef = useRef(linkMenu);
  linkMenuRef.current = linkMenu;

  const handleSlashSelect = useCallback((item: SlashItem) => {
    const view = viewRef.current;
    const menu = slashMenuRef.current;
    if (!view || !menu) return;
    const cursorPos = view.state.selection.main.head;
    view.dispatch({
      changes: { from: menu.slashPos, to: cursorPos, insert: item.insert },
      selection: { anchor: menu.slashPos + item.insert.length },
    });
    view.focus();
    setSlashMenu(null);
  }, []);

  const handleSlashClose = useCallback(() => {
    setSlashMenu(null);
    viewRef.current?.focus();
  }, []);

  const handleLinkSelect = useCallback(async (title: string, exists: boolean) => {
    const view = viewRef.current;
    const menu = linkMenuRef.current;
    if (!view || !menu) return;
    const cursorPos = view.state.selection.main.head;
    const insertText = `[[${title}]]`;
    view.dispatch({
      changes: { from: menu.bracketPos, to: cursorPos, insert: insertText },
      selection: { anchor: menu.bracketPos + insertText.length },
    });
    view.focus();
    setLinkMenu(null);
    if (!exists && onCreatePageRef.current) {
      await onCreatePageRef.current(title);
    }
  }, []);

  const handleLinkClose = useCallback(() => {
    setLinkMenu(null);
    viewRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const saveKeymap = keymap.of([{
      key: 'Mod-s',
      run: (view) => { onSaveRef.current(view.state.doc.toString()); return true; },
    }]);

    // Slash command detection
    const slashHandler = EditorView.inputHandler.of((view, from, _to, text) => {
      if (text !== '/') return false;
      const line = view.state.doc.lineAt(from);
      const before = view.state.doc.sliceString(line.from, from);
      if (before.trim() !== '') return false;
      setTimeout(() => {
        const coords = getCursorCoords(view);
        setSlashMenu({ visible: true, position: coords, slashPos: from, filter: '' });
      }, 0);
      return false;
    });

    // Slash filter tracker
    const slashFilterTracker = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const menu = slashMenuRef.current;
      if (!menu?.visible) return;
      const pos = update.state.selection.main.head;
      const text = update.state.doc.sliceString(menu.slashPos, pos);
      if (!text.startsWith('/')) { setSlashMenu(null); return; }
      if (text.includes('\n')) { setSlashMenu(null); return; }
      setSlashMenu(prev => prev ? { ...prev, filter: text.slice(1) } : null);
    });

    // [[ link detection
    const linkHandler = EditorView.inputHandler.of((view, from, _to, text) => {
      if (text !== '[') return false;
      if (from > 0 && view.state.doc.sliceString(from - 1, from) === '[') {
        setTimeout(() => {
          const coords = getCursorCoords(view);
          setLinkMenu({ visible: true, position: coords, bracketPos: from - 1, query: '' });
        }, 0);
      }
      return false;
    });

    // [[ filter tracker
    const linkFilterTracker = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const menu = linkMenuRef.current;
      if (!menu?.visible) return;
      const pos = update.state.selection.main.head;
      const text = update.state.doc.sliceString(menu.bracketPos, pos);
      if (!text.startsWith('[[')) { setLinkMenu(null); return; }
      if (text.includes(']]')) { setLinkMenu(null); return; }
      if (text.slice(2).includes('\n')) { setLinkMenu(null); return; }
      setLinkMenu(prev => prev ? { ...prev, query: text.slice(2) } : null);
    });

    const state = EditorState.create({
      doc: body,
      extensions: [
        saveKeymap,
        slashHandler,
        slashFilterTracker,
        linkHandler,
        linkFilterTracker,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        history(),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(obsidianHighlight),
        wikiTheme,
        livePreviewPlugin,
        livePreviewTheme,
        highlightActiveLine(),
        drawSelection(),
        EditorView.lineWrapping,
        EditorView.domEventHandlers({
          blur: (_, view) => { onSaveRef.current(view.state.doc.toString()); },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    // Listen for wiki-navigate custom events from the widget plugin
    const handleWikiNav = (e: Event) => {
      const slug = (e as CustomEvent).detail?.slug;
      if (slug && onNavigateRef.current) {
        // Save first, then navigate
        onSaveRef.current(view.state.doc.toString());
        onNavigateRef.current(slug);
      }
    };
    containerRef.current.addEventListener('wiki-navigate', handleWikiNav);

    return () => {
      containerRef.current?.removeEventListener('wiki-navigate', handleWikiNav);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Sync body from outside
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== body) {
      view.dispatch({ changes: { from: 0, to: currentDoc.length, insert: body } });
    }
  }, [body]);

  return (
    <div ref={containerRef} className="wiki-cm-editor">
      {slashMenu?.visible && (
        <WikiSlashMenu
          position={slashMenu.position}
          filter={slashMenu.filter}
          onSelect={handleSlashSelect}
          onClose={handleSlashClose}
        />
      )}
      {linkMenu?.visible && (
        <WikiLinkMenu
          position={linkMenu.position}
          query={linkMenu.query}
          onSelect={handleLinkSelect}
          onClose={handleLinkClose}
        />
      )}
    </div>
  );
}
