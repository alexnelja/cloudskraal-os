import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import WikiRenderer from './WikiRenderer';
import WikiCMEditor from './WikiCMEditor';
import WikiTableOfContents from './WikiTableOfContents';
import WikiProperties from './WikiProperties';
import WikiMiniGraph from './WikiMiniGraph';
import WikiHistory from './WikiHistory';
import WikiBottomSheet from './WikiBottomSheet';
import SidebarSection from './SidebarSection';
import type { WikiHeading } from './WikiRenderer';
import { getWikiPage, updateWikiPage, createWikiPage } from '../../api/wiki';
import { WIKI_CATEGORIES } from '../../types/wiki';
import type { WikiPage as WikiPageType } from '../../types/wiki';

/* Page cache for instant navigation */
export const pageCache = new Map<string, WikiPageType>();

interface WikiSinglePageProps {
  slug: string;
  rightSidebarOpen?: boolean;
  onTitleChange?: (slug: string, newTitle: string) => void;
  onFilterCategory?: (category: string) => void;
}

export default function WikiSinglePage({ slug, rightSidebarOpen = true, onTitleChange, onFilterCategory }: WikiSinglePageProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState<WikiPageType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headings, setHeadings] = useState<WikiHeading[]>([]);
  const [saving, setSaving] = useState(false);
  const brokenSlugsSet = useMemo(
    () => new Set(page?.broken_links?.map(l => l.slug)),
    [page?.broken_links]
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  // Save scroll position before navigating away
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !slug) return;
    return () => {
      sessionStorage.setItem(`wiki-scroll-${slug}`, String(el.scrollTop));
    };
  }, [slug]);

  // Restore scroll position after page loads
  useEffect(() => {
    if (!slug || !page || loading) return;
    const el = scrollRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem(`wiki-scroll-${slug}`);
    if (saved) {
      requestAnimationFrame(() => { el.scrollTop = parseInt(saved); });
    }
  }, [slug, page, loading]);

  // Fetch page on mount (key={slug} forces remount)
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const fromCache = pageCache.get(slug);
    if (fromCache) {
      setPage(fromCache);
      setLoading(false);
    }

    getWikiPage(slug)
      .then((data) => {
        if (cancelled) return;
        pageCache.set(slug, data);
        setPage(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        if (!fromCache) {
          setError('Page not found.');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [slug]);

  const cat = page?.category ? WIKI_CATEGORIES[page.category] : null;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      {/* Minimal top bar */}
      <div className="flex-shrink-0 px-4 py-1.5 flex items-center gap-2 bg-white text-[11px] text-stone-400">
        <span className="hidden md:inline">Wiki</span>
        {cat && (
          <>
            <ChevronRight size={10} className="text-stone-300" />
            <button
              onClick={() => onFilterCategory?.(page?.category ?? '')}
              className="hover:underline cursor-pointer"
              style={{ color: cat.color }}
            >{cat.label}</button>
          </>
        )}
        <ChevronRight size={10} className="text-stone-300" />
        <span className="text-stone-600 truncate">{page?.title ?? ''}</span>
        <div className="flex-1" />
        {saving && <span className="text-[10px] text-emerald-600">Saving...</span>}
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white">
        {loading && !page ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-stone-400 text-sm">Loading page...</p>
          </div>
        ) : error && !page ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-stone-500 text-sm">{error}</p>
            <button onClick={() => navigate('/wiki')} className="text-sm text-emerald-700 hover:text-emerald-800 font-medium">
              Back to Wiki
            </button>
          </div>
        ) : page ? (
          <div className="flex flex-col wiki-fade-in" key={page.slug}>
            <div className="flex flex-col md:flex-row flex-1 min-h-0">
              {/* Main content */}
              <div className="flex-1 min-w-0 px-6 md:px-10 py-6 max-w-4xl">
                {/* Inline editable title */}
                <input
                  type="text"
                  defaultValue={page.title}
                  autoFocus={page.title === 'Untitled' || page.title.startsWith('Untitled ')}
                  ref={(el) => {
                    if (el && (page.title === 'Untitled' || page.title.startsWith('Untitled '))) {
                      el.select();
                    }
                  }}
                  onBlur={(e) => {
                    const newTitle = e.target.value.trim();
                    if (newTitle && newTitle !== page.title && slug) {
                      updateWikiPage(slug, { title: newTitle }).then(() => {
                        setPage(prev => prev ? { ...prev, title: newTitle } : prev);
                        pageCache.delete(slug);
                        onTitleChange?.(slug, newTitle);
                      }).catch(console.error);
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="w-full text-3xl font-bold text-stone-900 bg-transparent border-none outline-none mb-4 placeholder:text-stone-300"
                  placeholder="Untitled"
                />

                {/* Hidden renderer for ToC */}
                <div className="hidden">
                  <WikiRenderer body={page.body} onHeadingsReady={setHeadings} brokenSlugs={brokenSlugsSet} />
                </div>

                <WikiCMEditor
                  body={page.body}
                  onSave={(newBody) => {
                    if (!slug || newBody === page.body) return;
                    const updated = { ...page, body: newBody };
                    setPage(updated);
                    pageCache.set(slug, updated);
                    setSaving(true);
                    updateWikiPage(slug, { body: newBody })
                      .then(() => setSaving(false))
                      .catch((err) => { console.error('Save failed:', err); setSaving(false); });
                  }}
                  onCreatePage={async (title) => {
                    const newPage = await createWikiPage({ title, body: '' });
                    return newPage.slug;
                  }}
                  onNavigate={(s) => navigate(`/wiki/${s}`)}
                />
              </div>

              {/* Right sidebar */}
              <div
                className="hidden md:block md:flex-shrink-0 border-l border-[#f3f4f3] overflow-y-auto overflow-x-hidden"
                style={{
                  width: rightSidebarOpen ? 280 : 0,
                  opacity: rightSidebarOpen ? 1 : 0,
                  padding: rightSidebarOpen ? '1rem 1.25rem' : 0,
                  transition: 'width 0.2s ease, opacity 0.15s ease, padding 0.2s ease',
                }}
              >
                <div className="w-[248px]">
                  <SidebarSection title="Properties">
                    <WikiProperties
                      page={page}
                      onUpdateAliases={(aliases) => {
                        updateWikiPage(slug, { aliases }).then(() => {
                          setPage(prev => prev ? { ...prev, aliases } : prev);
                        }).catch(console.error);
                      }}
                      onUpdateTags={(tags) => {
                        updateWikiPage(slug, { tags }).then(() => {
                          setPage(prev => prev ? { ...prev, tags } : prev);
                        }).catch(console.error);
                      }}
                    />
                  </SidebarSection>
                  <SidebarSection title="Contents" count={headings.length}>
                    <WikiTableOfContents headings={headings} />
                  </SidebarSection>
                  <SidebarSection title="Local Graph">
                    <WikiMiniGraph currentSlug={page.slug} currentTitle={page.title} currentCategory={page.category ?? 'general'} outgoingLinks={page.outgoing_links} backlinks={page.backlinks} />
                  </SidebarSection>
                  {page.outgoing_links.length > 0 && (
                    <SidebarSection title="Links" count={page.outgoing_links.length}>
                      <div className="space-y-1">
                        {page.outgoing_links.map((link) => (
                          <Link key={link.slug} to={`/wiki/${link.slug}`} className="block text-sm text-emerald-700 hover:text-emerald-800 hover:underline truncate">{link.title}</Link>
                        ))}
                      </div>
                    </SidebarSection>
                  )}
                  {page.backlinks.length > 0 && (
                    <SidebarSection title="Backlinks" count={page.backlinks.length}>
                      <div className="space-y-2">
                        {page.backlinks.map((link) => (
                          <Link key={link.slug} to={`/wiki/${link.slug}`} className="block hover:bg-stone-50 rounded p-1.5 -mx-1.5 transition-colors">
                            <span className="text-sm text-emerald-700 font-medium">{link.title}</span>
                            {link.context && (
                              <p className="text-[10px] text-stone-500 leading-relaxed mt-0.5 line-clamp-2">{link.context}</p>
                            )}
                          </Link>
                        ))}
                      </div>
                    </SidebarSection>
                  )}
                  {page.unlinked_mentions && page.unlinked_mentions.length > 0 && (
                    <SidebarSection title="Unlinked" count={page.unlinked_mentions.length} color="#b45309">
                      <div className="space-y-1.5">
                        {page.unlinked_mentions.slice(0, 10).map((m) => (
                          <div key={m.slug} className="flex items-center gap-1.5 text-sm">
                            <Link to={`/wiki/${m.slug}`} className="text-amber-700 hover:text-amber-800 hover:underline truncate flex-1">{m.title}</Link>
                            <span className="text-[10px] text-stone-400">{m.count}x</span>
                          </div>
                        ))}
                      </div>
                    </SidebarSection>
                  )}
                  {page.broken_links && page.broken_links.length > 0 && (
                    <SidebarSection title="Broken" count={page.broken_links.length} color="#dc2626">
                      <div className="space-y-1">
                        {page.broken_links.map((l) => (<span key={l.slug} className="block text-sm text-red-500 truncate">[[{l.title}]]</span>))}
                      </div>
                    </SidebarSection>
                  )}
                  <SidebarSection title="History">
                    <WikiHistory slug={page.slug} currentBody={page.body} />
                  </SidebarSection>
                </div>
              </div>
            </div>

            {/* Mobile bottom sheet */}
            <WikiBottomSheet title={`${page.outgoing_links.length + page.backlinks.length} links`}>
              <WikiTableOfContents headings={headings} />
              {page.outgoing_links.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Links ({page.outgoing_links.length})</h3>
                  <div className="space-y-1">
                    {page.outgoing_links.map((link) => (
                      <Link key={link.slug} to={`/wiki/${link.slug}`} className="block text-sm text-emerald-700 hover:underline truncate">{link.title}</Link>
                    ))}
                  </div>
                </div>
              )}
              {page.backlinks.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Backlinks ({page.backlinks.length})</h3>
                  <div className="space-y-1">
                    {page.backlinks.map((link) => (
                      <Link key={link.slug} to={`/wiki/${link.slug}`} className="block text-sm text-stone-600 hover:underline truncate">{link.title}</Link>
                    ))}
                  </div>
                </div>
              )}
            </WikiBottomSheet>
          </div>
        ) : null}
      </div>
    </div>
  );
}
