import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MarkdownIt from 'markdown-it';
// @ts-expect-error no types for markdown-it-footnote
import footnotePlugin from 'markdown-it-footnote';
import DOMPurify from 'dompurify';
import WikiLinkPreview from './WikiLinkPreview';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
md.use(footnotePlugin);

// Allowed tags/attrs for DOMPurify — strict whitelist
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'strong', 'em', 'del', 's',
    'code', 'pre', 'mark', 'div', 'span', 'ul', 'ol', 'li', 'blockquote', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'img',
    'input', 'sup', 'sub', 'section', 'nav',
  ],
  ALLOWED_ATTR: [
    'href', 'class', 'id', 'style', 'data-wiki-link', 'data-level', 'data-heading-id',
    'data-callout', 'data-mermaid-rendered', 'type', 'checked', 'disabled',
    'src', 'alt', 'title',
  ],
};

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function processHighlights(body: string): string {
  return body.replace(/==(.*?)==/g, '<mark>$1</mark>');
}

function processWikiLinks(body: string): string {
  return body.replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
    const slug = titleToSlug(title.trim());
    return `<a href="/wiki/${slug}" class="wiki-link" data-wiki-link="${slug}">${title.trim()}</a>`;
  });
}

const CALLOUT_ICONS: Record<string, string> = {
  note: '\u{1F4DD}',
  warning: '\u26A0\uFE0F',
  tip: '\u{1F4A1}',
  danger: '\u{1F525}',
  example: '\u{1F4CB}',
  todo: '\u2611\uFE0F',
  info: '\u2139\uFE0F',
  success: '\u2705',
  question: '\u2753',
  bug: '\u{1F41B}',
  quote: '\u{1F4AC}',
};

function processCallouts(body: string): string {
  return body.replace(
    /^> \[!(note|warning|tip|danger|example|todo|info|success|question|bug|quote)\][+-]?[ ]*(.*)\n((?:>[ ]?.*\n?)*)/gm,
    (_match, type: string, title: string, content: string) => {
      const cleanContent = content.replace(/^>[ ]?/gm, '').trim();
      const icon = CALLOUT_ICONS[type] || '\u2139\uFE0F';
      const displayTitle = title.trim() || type.charAt(0).toUpperCase() + type.slice(1);
      return `<div class="callout callout-${type}" data-callout="${type}">
<div class="callout-title">${icon} ${displayTitle}</div>
<div class="callout-content">\n\n${cleanContent}\n\n</div>
</div>\n`;
    },
  );
}

/** Runs the full markdown pipeline and returns rendered HTML + extracted headings. */
function renderMarkdown(body: string, brokenSlugs?: Set<string>): { html: string; headings: WikiHeading[] } {
  const processed = processCallouts(processHighlights(processWikiLinks(body)));
  let html = md.render(processed);

  // Mark broken links
  if (brokenSlugs && brokenSlugs.size > 0) {
    html = html.replace(/class="wiki-link" data-wiki-link="([^"]+)"/g, (match, slug) => {
      if (brokenSlugs.has(slug)) {
        return `class="wiki-link wiki-link-broken" data-wiki-link="${slug}"`;
      }
      return match;
    });
  }

  const headings: WikiHeading[] = [];
  let headingCounter = 0;
  html = html.replace(/<h([1-3])>(.*?)<\/h\1>/g, (_match, level, text) => {
    const plainText = text.replace(/<[^>]+>/g, '');
    const id = `heading-${headingCounter++}-${plainText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`;
    headings.push({ id, text: plainText, level: parseInt(level) });
    return `<h${level} id="${id}" class="wiki-foldable-heading" data-level="${level}"><span class="wiki-fold-toggle" data-heading-id="${id}">&#9654;</span>${text}</h${level}>`;
  });

  // Convert task list items to interactive checkboxes
  let checkboxIndex = 0;
  html = html.replace(/<li>([\s\S]*?)<\/li>/g, (match, content) => {
    const trimmed = content.trim();
    if (trimmed.startsWith('[ ] ')) {
      const idx = checkboxIndex++;
      return `<li class="wiki-task-item"><input type="checkbox" data-checkbox-idx="${idx}" class="wiki-checkbox" />${trimmed.slice(4)}</li>`;
    }
    if (trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
      const idx = checkboxIndex++;
      return `<li class="wiki-task-item wiki-task-done"><input type="checkbox" checked data-checkbox-idx="${idx}" class="wiki-checkbox" />${trimmed.slice(4)}</li>`;
    }
    return match;
  });

  // Sanitize HTML to prevent XSS
  html = DOMPurify.sanitize(html, PURIFY_CONFIG);

  return { html, headings };
}

export interface WikiHeading {
  id: string;
  text: string;
  level: number;
}

interface WikiRendererProps {
  body: string;
  onHeadingsReady?: (headings: WikiHeading[]) => void;
  brokenSlugs?: Set<string>;
  onCheckboxToggle?: (newBody: string) => void;
}

export default function WikiRenderer({ body, onHeadingsReady, brokenSlugs, onCheckboxToggle }: WikiRendererProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState<{ slug: string; rect: DOMRect } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memoize the expensive markdown processing — only re-runs when body changes
  const { html, headings } = useMemo(() => renderMarkdown(body, brokenSlugs), [body, brokenSlugs]);

  useEffect(() => {
    onHeadingsReady?.(headings);
  }, [headings, onHeadingsReady]);

  // Render mermaid diagrams after mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const mermaidBlocks = container.querySelectorAll<HTMLElement>('code.language-mermaid');
    if (mermaidBlocks.length === 0) return;

    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
      mermaidBlocks.forEach(async (block, i) => {
        const pre = block.parentElement;
        if (!pre || pre.dataset.mermaidRendered) return;
        pre.dataset.mermaidRendered = 'true';
        try {
          const { svg } = await mermaid.render(`mermaid-${Date.now()}-${i}`, block.textContent ?? '');
          const wrapper = document.createElement('div');
          wrapper.className = 'wiki-mermaid';
          wrapper.innerHTML = svg;
          pre.replaceWith(wrapper);
        } catch {
          // Leave as code block if mermaid syntax is invalid
        }
      });
    });
  }, [html]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Interactive checkbox toggle
    if (target.tagName === 'INPUT' && target.classList.contains('wiki-checkbox') && onCheckboxToggle) {
      const idx = parseInt((target as HTMLInputElement).dataset.checkboxIdx ?? '-1');
      if (idx >= 0) {
        // Find the nth checkbox pattern in the raw body and toggle it
        let count = 0;
        const newBody = body.replace(/- \[([ xX])\]/g, (match, check) => {
          if (count++ === idx) {
            return check === ' ' ? '- [x]' : '- [ ]';
          }
          return match;
        });
        onCheckboxToggle(newBody);
      }
      return;
    }

    if (target.tagName === 'A' && target.dataset.wikiLink) {
      e.preventDefault();
      navigate(`/wiki/${target.dataset.wikiLink}`);
      return;
    }
    if (target.classList.contains('wiki-fold-toggle')) {
      const headingId = target.dataset.headingId;
      if (!headingId) return;
      const heading = document.getElementById(headingId);
      if (!heading) return;
      const level = parseInt(heading.dataset.level ?? '1');
      const isFolded = heading.classList.contains('is-folded');

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
  }, [navigate, body, onCheckboxToggle]);

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
      hoverTimerRef.current = setTimeout(() => {
        setHoverState(null);
      }, 150);
    }
  }, []);

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
}
