/**
 * CodeMirror 6 Widget Decorations — Obsidian-style live preview
 * Replaces raw markdown with rendered widgets on non-cursor lines.
 */

import { EditorView, WidgetType, Decoration, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// ============================================================================
// Widget Types
// ============================================================================

class WikiLinkWidget extends WidgetType {
  title: string;
  slug: string;
  constructor(title: string, slug: string) { super(); this.title = title; this.slug = slug; }
  eq(other: WidgetType) { return other instanceof WikiLinkWidget && other.title === this.title; }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-wiki-link-widget';
    span.textContent = this.title;
    span.dataset.slug = this.slug;
    return span;
  }
  ignoreEvent(event: Event) {
    return !['mousedown', 'click', 'mouseenter', 'mouseleave'].includes(event.type);
  }
}

class CheckboxWidget extends WidgetType {
  checked: boolean;
  pos: number;
  constructor(checked: boolean, pos: number) { super(); this.checked = checked; this.pos = pos; }
  eq(other: WidgetType) { return other instanceof CheckboxWidget && other.checked === this.checked; }
  toDOM(): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.className = 'cm-checkbox-widget';
    input.dataset.pos = String(this.pos);
    return input;
  }
  ignoreEvent() { return false; }
}

class HighlightWidget extends WidgetType {
  text: string;
  constructor(text: string) { super(); this.text = text; }
  eq(other: WidgetType) { return other instanceof HighlightWidget && other.text === this.text; }
  toDOM(): HTMLElement {
    const mark = document.createElement('mark');
    mark.className = 'cm-highlight-widget';
    mark.textContent = this.text;
    return mark;
  }
  ignoreEvent() { return true; }
}

class ImageWidget extends WidgetType {
  alt: string;
  url: string;
  constructor(alt: string, url: string) { super(); this.alt = alt; this.url = url; }
  eq(other: WidgetType) { return other instanceof ImageWidget && other.url === this.url; }
  toDOM(): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-image-widget';
    const img = document.createElement('img');
    img.src = this.url;
    img.alt = this.alt;
    img.loading = 'lazy';
    img.onerror = () => { wrap.textContent = `[Image not found: ${this.alt}]`; };
    wrap.appendChild(img);
    return wrap;
  }
  ignoreEvent() { return true; }
}

// ============================================================================
// Helpers
// ============================================================================

function titleToSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

const hiddenMark = Decoration.mark({ class: 'cm-formatting-hidden' });

const FORMATTING_TYPES = new Set([
  'HeaderMark', 'EmphasisMark', 'LinkMark', 'CodeMark', 'QuoteMark', 'StrikethroughMark',
]);

// ============================================================================
// Main Plugin
// ============================================================================

type DecoRange = { from: number; to: number; deco: Decoration };

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: ReturnType<typeof Decoration.set>;
    constructor(view: EditorView) { this.decorations = this.build(view); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        try { this.decorations = this.build(update.view); }
        catch (e) { console.warn('Live preview error:', e); }
      }
    }

    build(view: EditorView) {
      const { state } = view;
      const cursorLine = state.doc.lineAt(state.selection.main.head).number;
      const ranges: DecoRange[] = [];
      const doc = state.doc.toString();

      // 1. Syntax tree formatting tokens → CSS hiding
      syntaxTree(state).iterate({
        enter: (node) => {
          if (!FORMATTING_TYPES.has(node.name)) return;
          const line = state.doc.lineAt(node.from);
          if (line.number === cursorLine) return;
          if (node.from < node.to) ranges.push({ from: node.from, to: node.to, deco: hiddenMark });
        },
      });

      // 2. Wiki links [[Title]] → widget
      const wikiRe = /\[\[([^\]]{1,500})\]\]/g;
      let wm;
      while ((wm = wikiRe.exec(doc)) !== null) {
        const start = wm.index;
        const end = start + wm[0].length;
        const line = state.doc.lineAt(start);
        if (line.number === cursorLine) continue;
        ranges.push({
          from: start, to: end,
          deco: Decoration.replace({ widget: new WikiLinkWidget(wm[1], titleToSlug(wm[1])) }),
        });
      }

      // 3. Highlights ==text==
      const hlRe = /==(.*?)==/g;
      let hm;
      while ((hm = hlRe.exec(doc)) !== null) {
        const start = hm.index;
        const end = start + hm[0].length;
        const line = state.doc.lineAt(start);
        if (line.number === cursorLine) continue;
        ranges.push({ from: start, to: end, deco: Decoration.replace({ widget: new HighlightWidget(hm[1]) }) });
      }

      // 4. Images ![alt](url)
      const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let im;
      while ((im = imgRe.exec(doc)) !== null) {
        const start = im.index;
        const end = start + im[0].length;
        const line = state.doc.lineAt(start);
        if (line.number === cursorLine) continue;
        ranges.push({ from: start, to: end, deco: Decoration.replace({ widget: new ImageWidget(im[1], im[2]) }) });
      }

      // 5. Checkboxes - [ ] and - [x]
      const cbRe = /^(\s*- \[)([ xX])(\])/gm;
      let cm;
      while ((cm = cbRe.exec(doc)) !== null) {
        const checkStart = cm.index + cm[1].length - 1;
        const checkEnd = checkStart + 3;
        const line = state.doc.lineAt(cm.index);
        if (line.number === cursorLine) continue;
        ranges.push({
          from: checkStart, to: checkEnd,
          deco: Decoration.replace({ widget: new CheckboxWidget(cm[2] !== ' ', cm.index) }),
        });
      }

      // Sort and build — RangeSetBuilder requires sorted, non-overlapping
      ranges.sort((a, b) => a.from - b.from || a.to - b.to);
      const builder = new RangeSetBuilder<Decoration>();
      let lastTo = 0;
      for (const r of ranges) {
        if (r.from >= lastTo && r.from < r.to) {
          builder.add(r.from, r.to, r.deco);
          lastTo = r.to;
        }
      }
      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      mousedown(event: MouseEvent, view: EditorView) {
        const target = event.target as HTMLElement;
        if (target.classList.contains('cm-wiki-link-widget')) {
          const slug = target.dataset.slug;
          if (slug) {
            event.preventDefault();
            view.dom.dispatchEvent(new CustomEvent('wiki-navigate', { detail: { slug }, bubbles: true }));
            return true;
          }
        }
        if (target.classList.contains('cm-checkbox-widget') && target instanceof HTMLInputElement) {
          event.preventDefault();
          const pos = parseInt(target.dataset.pos ?? '-1');
          if (pos >= 0) {
            const docStr = view.state.doc.toString();
            const match = docStr.substring(pos).match(/^(\s*- \[)([ xX])(\])/);
            if (match) {
              const checkPos = pos + match[1].length;
              view.dispatch({ changes: { from: checkPos, to: checkPos + 1, insert: match[2] === ' ' ? 'x' : ' ' } });
            }
          }
          return true;
        }
        return false;
      },
      mouseover(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.classList.contains('cm-wiki-link-widget')) return false;
        const slug = target.dataset.slug;
        if (!slug) return false;
        const existing = document.querySelector('.cm-link-tooltip');
        if (existing?.getAttribute('data-slug') === slug) return false;
        document.querySelectorAll('.cm-link-tooltip').forEach(el => el.remove());

        const tooltip = document.createElement('div');
        tooltip.className = 'cm-link-tooltip';
        tooltip.setAttribute('data-slug', slug);
        tooltip.innerHTML = '<div class="cm-link-tooltip-loading">Loading...</div>';
        const rect = target.getBoundingClientRect();
        Object.assign(tooltip.style, {
          position: 'fixed', zIndex: '100',
          top: `${rect.top - 8}px`, left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, -100%)',
        });
        document.body.appendChild(tooltip);

        fetch(`/api/wiki/${slug}`)
          .then(r => r.ok ? r.json() : null)
          .then(page => {
            if (!document.body.contains(tooltip)) return;
            if (page) {
              const snippet = page.body.slice(0, 150).replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/[#*=_~`>]/g, '');
              const titleEl = document.createElement('div');
              titleEl.className = 'cm-link-tooltip-title';
              titleEl.textContent = page.title;
              const bodyEl = document.createElement('div');
              bodyEl.className = 'cm-link-tooltip-body';
              bodyEl.textContent = snippet + (page.body.length > 150 ? '...' : '');
              tooltip.replaceChildren(titleEl, bodyEl);
            } else {
              tooltip.innerHTML = '<div class="cm-link-tooltip-empty">Page not found</div>';
            }
          })
          .catch(() => { if (document.body.contains(tooltip)) tooltip.remove(); });

        const remove = () => { tooltip.remove(); target.removeEventListener('mouseleave', remove); };
        target.addEventListener('mouseleave', remove);
        return false;
      },
    },
  }
);

// ============================================================================
// Theme
// ============================================================================

export const livePreviewTheme = EditorView.theme({
  '.cm-wiki-link-widget': {
    color: '#047857', textDecoration: 'underline', textDecorationStyle: 'dotted',
    textUnderlineOffset: '2px', cursor: 'pointer', fontWeight: '500',
  },
  '.cm-wiki-link-widget:hover': { color: '#065f46', textDecorationStyle: 'solid' },
  '.cm-checkbox-widget': {
    width: '15px', height: '15px', accentColor: '#047857',
    verticalAlign: 'middle', cursor: 'pointer', marginRight: '4px',
  },
  '.cm-highlight-widget': {
    background: '#fef08a', padding: '0.0625rem 0.25rem', borderRadius: '0.125rem', color: '#1c1917',
  },
  '.cm-image-widget img': {
    maxWidth: '100%', maxHeight: '300px', borderRadius: '0.5rem', border: '1px solid #e7e5e4',
  },
  '.cm-link-tooltip': {
    background: 'white', borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
    border: '1px solid #e7e5e4', padding: '8px 12px', maxWidth: '280px', fontSize: '12px',
  },
  '.cm-link-tooltip-title': { fontWeight: '600', color: '#1c1917', marginBottom: '2px' },
  '.cm-link-tooltip-body': { color: '#78716c', lineHeight: '1.4' },
  '.cm-link-tooltip-loading, .cm-link-tooltip-empty': { color: '#a8a29e' },
  '.cm-line .tok-keyword': { color: '#7c3aed' },
  '.cm-line .tok-string': { color: '#059669' },
  '.cm-line .tok-comment': { color: '#a8a29e', fontStyle: 'italic' },
  '.cm-line .tok-number': { color: '#d97706' },
  '.cm-line .tok-operator': { color: '#dc2626' },
  '.cm-line .tok-typeName': { color: '#0369a1' },
  '.cm-line .tok-propertyName': { color: '#b45309' },
  '.cm-formatting-hidden': {
    fontSize: '0 !important', color: 'transparent !important',
    display: 'inline', width: '0', overflow: 'hidden',
  },
});
