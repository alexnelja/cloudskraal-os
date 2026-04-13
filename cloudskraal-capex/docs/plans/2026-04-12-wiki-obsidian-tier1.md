# Wiki Obsidian Tier 1 — Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 Obsidian-inspired UX features to the Cloudskraal wiki: highlight syntax, ToC sidebar, link hover preview, `[[` autocomplete, collapsible headings, and Cmd+K command palette.

**Architecture:** All Tier 1 features are frontend-only — no backend changes. WikiRenderer gets new markdown pre-processing (highlights) and post-processing (heading IDs, fold toggles). New components: WikiTableOfContents, WikiLinkPreview, WikiLinkAutocomplete, WikiCommandPalette. Existing components modified: WikiRenderer, WikiInlineEditor, WikiPage, index.css.

**Tech Stack:** React 19, markdown-it, IntersectionObserver, Tailwind CSS, Lucide icons, existing wiki API.

---

### Task 1: `==highlight==` Syntax Support

**Files:**
- Modify: `frontend/src/components/wiki/WikiRenderer.tsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/wiki/WikiInlineEditor.tsx`

- [ ] **Step 1: Add highlight pre-processor to WikiRenderer**

In `frontend/src/components/wiki/WikiRenderer.tsx`, add this function after `processWikiLinks`:

```tsx
function processHighlights(body: string): string {
  return body.replace(/==(.*?)==/g, '<mark>$1</mark>');
}
```

Update the render pipeline in the `WikiRenderer` component:

```tsx
const processed = processCallouts(processHighlights(processWikiLinks(body)));
```

- [ ] **Step 2: Add highlight CSS**

In `frontend/src/index.css`, after the `.wiki-content .wiki-link:hover` block (~line 102), add:

```css
.wiki-content mark {
  background: #fef08a;
  padding: 0.0625rem 0.25rem;
  border-radius: 0.125rem;
  color: #1c1917;
}
```

- [ ] **Step 3: Add highlight button to editor toolbar**

In `frontend/src/components/wiki/WikiInlineEditor.tsx`:

Add `Highlighter` to the lucide-react import:

```tsx
import { ..., Highlighter } from 'lucide-react';
```

Add a new case in `handleToolbarAction`:

```tsx
case 'highlight':
  wrapSelectionOrInsert(textarea, '==', 'highlighted');
  break;
```

Add the button to `toolbarButtons` array, after the italic entry:

```tsx
{ action: 'highlight', icon: Highlighter, label: 'Highlight' },
```

- [ ] **Step 4: Test manually**

Open the wiki, edit a page, type `==some text==`. Verify it renders with a yellow highlight. Click the toolbar highlight button and verify it inserts `==highlighted==`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/wiki/WikiRenderer.tsx frontend/src/index.css frontend/src/components/wiki/WikiInlineEditor.tsx
git commit -m "feat(wiki): add ==highlight== syntax support"
```

---

### Task 2: Table of Contents Sidebar

**Files:**
- Create: `frontend/src/components/wiki/WikiTableOfContents.tsx`
- Modify: `frontend/src/components/wiki/WikiRenderer.tsx`
- Modify: `frontend/src/pages/WikiPage.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add heading IDs to WikiRenderer**

In `frontend/src/components/wiki/WikiRenderer.tsx`, update the component to add `id` attributes to headings. Replace the entire component with:

```tsx
export default function WikiRenderer({ body, onHeadingsReady }: { body: string; onHeadingsReady?: (headings: { id: string; text: string; level: number }[]) => void }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const processed = processCallouts(processHighlights(processWikiLinks(body)));
  let html = md.render(processed);

  // Inject IDs into headings and extract heading data
  const headings: { id: string; text: string; level: number }[] = [];
  let headingCounter = 0;
  html = html.replace(/<h([1-3])>(.*?)<\/h\1>/g, (_match, level, text) => {
    const plainText = text.replace(/<[^>]+>/g, '');
    const id = `heading-${headingCounter++}-${plainText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`;
    headings.push({ id, text: plainText, level: parseInt(level) });
    return `<h${level} id="${id}">${text}</h${level}>`;
  });

  useEffect(() => {
    onHeadingsReady?.(headings);
  }, [body]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' && target.dataset.wikiLink) {
      e.preventDefault();
      navigate(`/wiki/${target.dataset.wikiLink}`);
    }
  };

  return (
    <div
      ref={containerRef}
      className="wiki-content"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

Add `useRef` and `useEffect` to the imports at the top of the file.

- [ ] **Step 2: Create WikiTableOfContents component**

Create `frontend/src/components/wiki/WikiTableOfContents.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { List } from 'lucide-react';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface WikiTableOfContentsProps {
  headings: Heading[];
}

export default function WikiTableOfContents({ headings }: WikiTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Track active heading via IntersectionObserver
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first heading that is intersecting
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }, []);

  if (headings.length < 2) return null;

  return (
    <div className="mb-5">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 hover:text-stone-700 transition-colors w-full"
      >
        <List size={12} />
        <span>Contents</span>
        <span className="text-stone-400 font-normal">({headings.length})</span>
        <span className="ml-auto text-[10px] text-stone-400">{collapsed ? '+'  : '-'}</span>
      </button>
      {!collapsed && (
        <nav className="space-y-0.5">
          {headings.map((heading) => (
            <button
              key={heading.id}
              onClick={() => scrollTo(heading.id)}
              className={`block w-full text-left text-sm truncate transition-colors rounded px-2 py-0.5 ${
                activeId === heading.id
                  ? 'text-emerald-700 bg-emerald-50 font-medium'
                  : 'text-stone-600 hover:text-stone-800 hover:bg-stone-50'
              }`}
              style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire ToC into WikiSinglePage sidebar**

In `frontend/src/pages/WikiPage.tsx`:

Add import at the top:

```tsx
import WikiTableOfContents from '../components/wiki/WikiTableOfContents';
```

In the `WikiSinglePage` function, add state:

```tsx
const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);
```

Update the `<WikiRenderer>` call (around line 519) to pass the callback:

```tsx
<WikiRenderer body={page.body} onHeadingsReady={setHeadings} />
```

In the sidebar div (around line 523), add the ToC as the first child, before the outgoing links section:

```tsx
<WikiTableOfContents headings={headings} />
```

- [ ] **Step 4: Test manually**

Open a wiki page with multiple headings. Verify the ToC appears in the right sidebar. Click a heading in the ToC and verify smooth scrolling. Scroll the page and verify the active heading highlights in the ToC.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/wiki/WikiTableOfContents.tsx frontend/src/components/wiki/WikiRenderer.tsx frontend/src/pages/WikiPage.tsx
git commit -m "feat(wiki): add table of contents sidebar with scroll-sync"
```

---

### Task 3: Link Preview on Hover

**Files:**
- Create: `frontend/src/components/wiki/WikiLinkPreview.tsx`
- Modify: `frontend/src/components/wiki/WikiRenderer.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Create WikiLinkPreview component**

Create `frontend/src/components/wiki/WikiLinkPreview.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
import { getWikiPage } from '../../api/wiki';
import { WIKI_CATEGORIES } from '../../types/wiki';
import type { WikiPage } from '../../types/wiki';
import MarkdownIt from 'markdown-it';

const previewMd = new MarkdownIt({ html: false, linkify: false });

// Simple in-memory cache
const pageCache = new Map<string, WikiPage>();

interface WikiLinkPreviewProps {
  slug: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

export default function WikiLinkPreview({ slug, anchorRect, onClose }: WikiLinkPreviewProps) {
  const [page, setPage] = useState<WikiPage | null>(pageCache.get(slug) ?? null);
  const [loading, setLoading] = useState(!pageCache.has(slug));
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pageCache.has(slug)) {
      setPage(pageCache.get(slug)!);
      setLoading(false);
      return;
    }
    let cancelled = false;
    getWikiPage(slug)
      .then((data) => {
        if (!cancelled) {
          pageCache.set(slug, data);
          setPage(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  // Position: prefer above the link, fall back to below
  const popoverWidth = 320;
  const popoverHeight = 200;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let top = anchorRect.top - popoverHeight - 8;
  if (top < 8) top = anchorRect.bottom + 8;
  if (top + popoverHeight > viewportH - 8) top = viewportH - popoverHeight - 8;

  let left = anchorRect.left + (anchorRect.width / 2) - (popoverWidth / 2);
  if (left < 8) left = 8;
  if (left + popoverWidth > viewportW - 8) left = viewportW - popoverWidth - 8;

  const cat = page?.category ? WIKI_CATEGORIES[page.category] : null;

  // Render first ~150 chars of body as plain markdown
  const snippet = page ? page.body.slice(0, 200).replace(/\[\[([^\]]+)\]\]/g, '$1') : '';
  const snippetHtml = previewMd.render(snippet + (page && page.body.length > 200 ? '...' : ''));

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in"
      style={{ top, left, width: popoverWidth, maxHeight: popoverHeight }}
      onMouseLeave={onClose}
    >
      {loading ? (
        <div className="p-4 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-stone-300 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      ) : page ? (
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <h4 className="text-sm font-bold text-stone-900 truncate flex-1">{page.title}</h4>
            {cat && (
              <span
                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              >
                {cat.label}
              </span>
            )}
          </div>
          <div
            className="text-xs text-stone-600 leading-relaxed line-clamp-4 wiki-preview-content"
            dangerouslySetInnerHTML={{ __html: snippetHtml }}
          />
          <div className="flex items-center gap-3 mt-2 text-[10px] text-stone-400">
            <span>{page.outgoing_links.length} links</span>
            <span>{page.backlinks.length} backlinks</span>
          </div>
        </div>
      ) : (
        <div className="p-3 text-xs text-stone-400">Page not found</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate hover detection into WikiRenderer**

In `frontend/src/components/wiki/WikiRenderer.tsx`, update the component to track hovered wiki links:

Add `useState` to the imports. Add this state and handler inside the component, before the return:

```tsx
const [hoverState, setHoverState] = useState<{ slug: string; rect: DOMRect } | null>(null);
const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleMouseOver = useCallback((e: React.MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'A' && target.dataset.wikiLink) {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoverState({
        slug: target.dataset.wikiLink!,
        rect: target.getBoundingClientRect(),
      });
    }, 200);
  }
}, []);

const handleMouseOut = useCallback((e: React.MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'A' && target.dataset.wikiLink) {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    // Delay closing so user can move mouse to the popover
    hoverTimerRef.current = setTimeout(() => {
      setHoverState(null);
    }, 150);
  }
}, []);
```

Add the import for WikiLinkPreview at the top:

```tsx
import WikiLinkPreview from './WikiLinkPreview';
```

Update the return JSX to add mouse handlers and render the preview:

```tsx
return (
  <>
    <div
      ref={containerRef}
      className="wiki-content"
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      dangerouslySetInnerHTML={{ __html: html }}
    />
    {hoverState && (
      <WikiLinkPreview
        slug={hoverState.slug}
        anchorRect={hoverState.rect}
        onClose={() => setHoverState(null)}
      />
    )}
  </>
);
```

Add `useState, useCallback` to the imports if not already there.

- [ ] **Step 3: Add preview content CSS**

In `frontend/src/index.css`, add after the highlight CSS:

```css
.wiki-preview-content p { margin: 0.125rem 0; }
.wiki-preview-content h1, .wiki-preview-content h2, .wiki-preview-content h3 { font-size: 0.75rem; font-weight: 600; margin: 0.125rem 0; }
```

- [ ] **Step 4: Test manually**

Open a wiki page that contains `[[links]]` to other pages. Hover over a wiki link. Verify a preview popover appears after ~200ms showing the target page title, category badge, and body snippet. Move the mouse away and verify it disappears.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/wiki/WikiLinkPreview.tsx frontend/src/components/wiki/WikiRenderer.tsx frontend/src/index.css
git commit -m "feat(wiki): add link preview popover on hover"
```

---

### Task 4: `[[` Autocomplete in Editor

**Files:**
- Create: `frontend/src/components/wiki/WikiLinkAutocomplete.tsx`
- Modify: `frontend/src/components/wiki/WikiInlineEditor.tsx`

- [ ] **Step 1: Create WikiLinkAutocomplete component**

Create `frontend/src/components/wiki/WikiLinkAutocomplete.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
import { searchWiki } from '../../api/wiki';
import { WIKI_CATEGORIES } from '../../types/wiki';
import type { WikiPageSummary } from '../../types/wiki';

interface WikiLinkAutocompleteProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (title: string) => void;
  onClose: () => void;
}

export default function WikiLinkAutocomplete({ query, position, onSelect, onClose }: WikiLinkAutocompleteProps) {
  const [results, setResults] = useState<WikiPageSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch results on query change
  useEffect(() => {
    if (!query.trim()) {
      // Show recent/all pages when no query
      setLoading(true);
      searchWiki('')
        .then((data) => { setResults(data.slice(0, 8)); setLoading(false); })
        .catch(() => setLoading(false));
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      searchWiki(query.trim())
        .then((data) => {
          setResults(data.slice(0, 8));
          setSelectedIndex(0);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  // Click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Expose keyboard handler via DOM event on window
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (results.length > 0) {
          onSelect(results[selectedIndex].title);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [results, selectedIndex, onSelect, onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 max-h-64 overflow-y-auto bg-white rounded-lg shadow-xl border border-stone-200"
      style={{ top: position.top, left: Math.min(position.left, window.innerWidth - 300) }}
    >
      {loading && results.length === 0 ? (
        <div className="px-3 py-2 text-xs text-stone-400">Searching...</div>
      ) : results.length === 0 ? (
        <div className="px-3 py-2 text-xs text-stone-400">
          No pages found{query ? ` for "${query}"` : ''}
        </div>
      ) : (
        <div className="py-1">
          {results.map((page, i) => {
            const cat = page.category ? WIKI_CATEGORIES[page.category] : null;
            return (
              <button
                key={page.id}
                onClick={() => onSelect(page.title)}
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm transition-colors ${
                  i === selectedIndex
                    ? 'bg-emerald-50 text-emerald-900'
                    : 'hover:bg-stone-50 text-stone-700'
                }`}
              >
                <span className="flex-1 truncate">{page.title}</span>
                {cat && (
                  <span
                    className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-white flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  >
                    {cat.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate autocomplete into WikiInlineEditor**

In `frontend/src/components/wiki/WikiInlineEditor.tsx`:

Add import at the top:

```tsx
import WikiLinkAutocomplete from './WikiLinkAutocomplete';
```

Add state inside the component, after the `slashMenu` state:

```tsx
const [linkAutocomplete, setLinkAutocomplete] = useState<{
  visible: boolean;
  position: { top: number; left: number };
  bracketStart: number; // position of the first `[`
  query: string;
} | null>(null);
```

Add an `onInput` handler to detect `[[` being typed. Add this function before `handleKeyDown`:

```tsx
const handleInput = useCallback(() => {
  const textarea = textareaRef.current;
  if (!textarea) return;
  const pos = textarea.selectionStart;
  const text = textarea.value;

  // Check if we just typed `[[`
  if (pos >= 2 && text[pos - 1] === '[' && text[pos - 2] === '[') {
    const coords = getCursorCoords(textarea);
    setLinkAutocomplete({
      visible: true,
      position: coords,
      bracketStart: pos - 2,
      query: '',
    });
    return;
  }

  // If autocomplete is open, update query
  if (linkAutocomplete?.visible) {
    const afterBrackets = text.substring(linkAutocomplete.bracketStart + 2, pos);
    // Close if user typed `]]` or newline
    if (afterBrackets.includes(']]') || afterBrackets.includes('\n')) {
      setLinkAutocomplete(null);
      return;
    }
    setLinkAutocomplete(prev => prev ? { ...prev, query: afterBrackets } : null);
  }
}, [linkAutocomplete]);
```

Add the `onInput` prop to the textarea element:

```tsx
<textarea
  ref={textareaRef}
  value={body}
  onChange={(e) => setBody(e.target.value)}
  onInput={handleInput}
  onKeyDown={handleKeyDown}
  ...
/>
```

Add the autocomplete component after the slash menu in the JSX:

```tsx
{linkAutocomplete?.visible && (
  <WikiLinkAutocomplete
    query={linkAutocomplete.query}
    position={linkAutocomplete.position}
    onSelect={(title) => {
      // Replace `[[query` with `[[Title]]`
      const textarea = textareaRef.current;
      if (!textarea) return;
      const before = body.substring(0, linkAutocomplete.bracketStart);
      const after = body.substring(textarea.selectionStart);
      const newBody = before + `[[${title}]]` + after;
      setBody(newBody);
      setLinkAutocomplete(null);
      setTimeout(() => {
        if (textarea) {
          const newPos = linkAutocomplete.bracketStart + title.length + 4; // [[ + title + ]]
          textarea.focus();
          textarea.selectionStart = newPos;
          textarea.selectionEnd = newPos;
        }
      }, 0);
    }}
    onClose={() => setLinkAutocomplete(null)}
  />
)}
```

- [ ] **Step 3: Test manually**

Open the wiki editor. Type `[[` and verify a dropdown appears with page suggestions. Type more characters to filter. Press Enter or click to select. Verify the full `[[Title]]` is inserted and cursor is positioned after it.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/wiki/WikiLinkAutocomplete.tsx frontend/src/components/wiki/WikiInlineEditor.tsx
git commit -m "feat(wiki): add [[ autocomplete for wiki links in editor"
```

---

### Task 5: Collapsible/Foldable Headings

**Files:**
- Modify: `frontend/src/components/wiki/WikiRenderer.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add fold toggles to headings in WikiRenderer**

In `frontend/src/components/wiki/WikiRenderer.tsx`, update the heading ID injection to also add a fold toggle. Replace the heading regex replacement with:

```tsx
html = html.replace(/<h([1-3])( id="[^"]*")?>(.*?)<\/h\1>/g, (_match, level, idAttr, text) => {
  const plainText = text.replace(/<[^>]+>/g, '');
  const id = idAttr
    ? idAttr.match(/id="([^"]*)"/)?.[1] ?? `heading-${headingCounter}`
    : `heading-${headingCounter}-${plainText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`;
  headingCounter++;
  headings.push({ id, text: plainText, level: parseInt(level) });
  return `<h${level} id="${id}" class="wiki-foldable-heading" data-level="${level}"><span class="wiki-fold-toggle" data-heading-id="${id}">&#9654;</span>${text}</h${level}>`;
});
```

Note: Since we already have the heading ID injection from Task 2, we're extending it here. The final version replaces the Task 2 regex. The headings array extraction still works the same way.

Update the `handleClick` function to also handle fold toggles:

```tsx
const handleClick = (e: React.MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'A' && target.dataset.wikiLink) {
    e.preventDefault();
    navigate(`/wiki/${target.dataset.wikiLink}`);
    return;
  }
  // Fold toggle
  if (target.classList.contains('wiki-fold-toggle')) {
    const headingId = target.dataset.headingId;
    if (!headingId) return;
    const heading = document.getElementById(headingId);
    if (!heading) return;
    const level = parseInt(heading.dataset.level ?? '1');
    const isFolded = heading.classList.contains('is-folded');

    // Toggle all siblings until next heading of same or higher level
    let sibling = heading.nextElementSibling;
    while (sibling) {
      const siblingTag = sibling.tagName;
      if (/^H[1-3]$/.test(siblingTag)) {
        const siblingLevel = parseInt(siblingTag[1]);
        if (siblingLevel <= level) break;
      }
      (sibling as HTMLElement).style.display = isFolded ? '' : 'none';
      sibling = sibling.nextElementSibling;
    }

    heading.classList.toggle('is-folded');
  }
};
```

- [ ] **Step 2: Add fold toggle CSS**

In `frontend/src/index.css`, add after the highlight CSS:

```css
/* Wiki foldable headings */
.wiki-content .wiki-fold-toggle {
  display: inline-block;
  width: 16px;
  font-size: 0.6em;
  color: #a8a29e;
  cursor: pointer;
  transition: transform 0.15s ease, color 0.15s ease;
  user-select: none;
  margin-right: 2px;
  vertical-align: middle;
}
.wiki-content .wiki-fold-toggle:hover {
  color: #57534e;
}
.wiki-content .wiki-foldable-heading.is-folded > .wiki-fold-toggle {
  transform: rotate(0deg);
  color: #047857;
}
.wiki-content .wiki-foldable-heading:not(.is-folded) > .wiki-fold-toggle {
  transform: rotate(90deg);
}
```

- [ ] **Step 3: Test manually**

Open a wiki page with multiple headings and content between them. Click the fold toggle (triangle) on a heading. Verify the content below it collapses until the next heading of equal or higher level. Click again to expand. Verify the toggle icon rotates.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/wiki/WikiRenderer.tsx frontend/src/index.css
git commit -m "feat(wiki): add collapsible/foldable headings"
```

---

### Task 6: Cmd+K Command Palette

**Files:**
- Create: `frontend/src/components/wiki/WikiCommandPalette.tsx`
- Modify: `frontend/src/pages/WikiPage.tsx`

- [ ] **Step 1: Create WikiCommandPalette component**

Create `frontend/src/components/wiki/WikiCommandPalette.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Plus, Network, ArrowRight } from 'lucide-react';
import { searchWiki } from '../../api/wiki';
import { WIKI_CATEGORIES } from '../../types/wiki';
import type { WikiPageSummary } from '../../types/wiki';

interface PaletteItem {
  id: string;
  type: 'page' | 'action';
  title: string;
  subtitle?: string;
  category?: string;
  slug?: string;
  action?: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export default function WikiCommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PaletteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global Cmd+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build actions list
  const actions: PaletteItem[] = [
    { id: 'new-page', type: 'action', title: 'New Page', subtitle: 'Create a new wiki page', icon: Plus, action: () => { navigate('/wiki'); /* trigger new page modal via state */ } },
    { id: 'graph', type: 'action', title: 'Knowledge Graph', subtitle: 'View the wiki knowledge graph', icon: Network, action: () => navigate('/wiki/graph') },
    { id: 'wiki-home', type: 'action', title: 'Wiki Home', subtitle: 'Go to wiki home page', icon: FileText, action: () => navigate('/wiki') },
  ];

  // Search pages on query change
  const fetchPages = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoading(true);
    timerRef.current = setTimeout(() => {
      searchWiki(q)
        .then((pages) => {
          const pageItems: PaletteItem[] = pages.slice(0, 10).map((p) => ({
            id: p.id,
            type: 'page' as const,
            title: p.title,
            subtitle: p.category ? WIKI_CATEGORIES[p.category]?.label : undefined,
            category: p.category ?? undefined,
            slug: p.slug,
            icon: FileText,
          }));

          // Filter actions by query too
          const filteredActions = q
            ? actions.filter((a) => a.title.toLowerCase().includes(q.toLowerCase()))
            : actions;

          setItems([...filteredActions, ...pageItems]);
          setSelectedIndex(0);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 150);
  }, [navigate]);

  useEffect(() => {
    if (open) {
      fetchPages(query);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, open, fetchPages]);

  function executeItem(item: PaletteItem) {
    setOpen(false);
    if (item.type === 'action' && item.action) {
      item.action();
    } else if (item.slug) {
      navigate(`/wiki/${item.slug}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length > 0) executeItem(items[selectedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-200">
          <Search size={18} className="text-stone-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, actions..."
            className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-stone-400"
          />
          <kbd className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded font-mono">esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-stone-400">Searching...</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-stone-400">No results found</div>
          ) : (
            <div className="py-1">
              {items.map((item, i) => {
                const cat = item.category ? WIKI_CATEGORIES[item.category] : null;
                return (
                  <button
                    key={item.id}
                    onClick={() => executeItem(item)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      i === selectedIndex
                        ? 'bg-emerald-50'
                        : 'hover:bg-stone-50'
                    }`}
                  >
                    <item.icon size={16} className={`flex-shrink-0 ${i === selectedIndex ? 'text-emerald-700' : 'text-stone-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${i === selectedIndex ? 'text-emerald-900 font-medium' : 'text-stone-800'}`}>
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-xs text-stone-400 truncate">{item.subtitle}</p>
                      )}
                    </div>
                    {cat && (
                      <span
                        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-white flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      >
                        {cat.label}
                      </span>
                    )}
                    {i === selectedIndex && (
                      <ArrowRight size={14} className="text-emerald-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-stone-100 flex items-center gap-4 text-[10px] text-stone-400">
          <span><kbd className="bg-stone-100 px-1 py-0.5 rounded font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="bg-stone-100 px-1 py-0.5 rounded font-mono">↵</kbd> open</span>
          <span><kbd className="bg-stone-100 px-1 py-0.5 rounded font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount command palette in WikiPage**

In `frontend/src/pages/WikiPage.tsx`, add import:

```tsx
import WikiCommandPalette from '../components/wiki/WikiCommandPalette';
```

Update the `WikiPage` component (the main router at the bottom, ~line 734) to wrap everything and include the palette:

```tsx
export default function WikiPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();

  return (
    <>
      <WikiCommandPalette />
      {location.pathname === '/wiki/graph' ? (
        <WikiGraphView />
      ) : slug ? (
        <WikiSinglePage />
      ) : (
        <WikiHome />
      )}
    </>
  );
}
```

- [ ] **Step 3: Test manually**

Navigate to any wiki page. Press Cmd+K. Verify the command palette opens. Type a page name and verify results appear. Use arrow keys to navigate and Enter to open. Verify Escape closes the palette. Test the "Knowledge Graph" and "Wiki Home" actions.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/wiki/WikiCommandPalette.tsx frontend/src/pages/WikiPage.tsx
git commit -m "feat(wiki): add Cmd+K command palette for quick navigation"
```

---

### Task 7: Final Integration Check

- [ ] **Step 1: Verify all features work together**

Open the wiki and test this flow:
1. Press Cmd+K, search for a page, open it
2. Verify the ToC appears in the sidebar with correct headings
3. Click a ToC entry — verify smooth scroll
4. Hover over a `[[wiki link]]` — verify preview popover
5. Click Edit, type `[[` — verify autocomplete dropdown
6. Select a page from autocomplete — verify `[[Title]]` inserted
7. Type `==some highlighted text==` — verify yellow highlight in preview
8. Click a fold toggle on a heading — verify content collapses
9. Click again — verify it expands

- [ ] **Step 2: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(wiki): tier 1 integration fixes"
```
