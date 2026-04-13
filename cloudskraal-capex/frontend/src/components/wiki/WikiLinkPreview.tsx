import { useState, useEffect, useRef } from 'react';
import { getWikiPage } from '../../api/wiki';
import { WIKI_CATEGORIES } from '../../types/wiki';
import type { WikiPage } from '../../types/wiki';
import MarkdownIt from 'markdown-it';

const previewMd = new MarkdownIt({ html: false, linkify: false });

// LRU-ish cache: evict oldest when over 50 entries
const MAX_CACHE = 50;
const pageCache = new Map<string, WikiPage>();

function cacheSet(slug: string, page: WikiPage) {
  if (pageCache.size >= MAX_CACHE) {
    const oldest = pageCache.keys().next().value;
    if (oldest) pageCache.delete(oldest);
  }
  pageCache.set(slug, page);
}

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
          cacheSet(slug, data);
          setPage(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn(`Failed to load preview for ${slug}:`, err);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [slug]);

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

  const snippet = page ? page.body.slice(0, 200).replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/==(.*?)==/g, '$1') : '';
  const snippetHtml = previewMd.render(snippet + (page && page.body.length > 200 ? '...' : ''));

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden wiki-scale-in"
      style={{ top, left, width: popoverWidth, maxHeight: popoverHeight }}
      onMouseEnter={() => {/* keep open while hovering popover */}}
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
