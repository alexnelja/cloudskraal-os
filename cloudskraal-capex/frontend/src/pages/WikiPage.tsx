import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Plus, ChevronRight, ArrowLeft, Network, X, CalendarDays } from 'lucide-react';
// WikiSearch moved to Cmd+K palette; sidebar uses inline filter
import WikiRenderer from '../components/wiki/WikiRenderer';
import WikiCommandPalette from '../components/wiki/WikiCommandPalette';
import WikiGraph from '../components/wiki/WikiGraph';
import WikiFileTree from '../components/wiki/WikiFileTree';
import WikiTagCloud from '../components/wiki/WikiTagCloud';
import WikiSinglePage from '../components/wiki/WikiSinglePage';
import { getWikiPages, getWikiPage, deleteWikiPage, updateWikiPage, getDailyNote, createWikiPage } from '../api/wiki';
import { WIKI_CATEGORIES } from '../types/wiki';
import type { WikiPageSummary, WikiPage as WikiPageType } from '../types/wiki';

// ============================================================================
// Graph View
// ============================================================================

function WikiGraphView() {
  const navigate = useNavigate();
  const [graphTheme, setGraphTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [previewPage, setPreviewPage] = useState<WikiPageType | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [graphForce, setGraphForce] = useState(300);
  const [graphDistance, setGraphDistance] = useState(80);
  const [graphNodeSize, setGraphNodeSize] = useState(1);

  const isDark = graphTheme === 'dark' || (graphTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  function handleNodePreview(slug: string, position: { x: number; y: number }) {
    if (previewSlug === slug) { setPreviewSlug(null); setPreviewPage(null); return; }
    setPreviewSlug(slug);
    setPreviewPos(position);
    setPreviewLoading(true);
    getWikiPage(slug).then((p) => { setPreviewPage(p); setPreviewLoading(false); }).catch(() => setPreviewLoading(false));
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative" style={{ background: isDark ? '#1a1a1a' : '#fff' }}>
      {/* Floating controls */}
      <div className="absolute top-3 left-3 z-20">
        <button onClick={() => navigate('/wiki')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-stone-800 text-stone-300 hover:bg-stone-700' : 'bg-white text-stone-600 hover:bg-stone-50 shadow-sm border border-stone-200'}`}>
          <ArrowLeft size={14} /> Back
        </button>
      </div>
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <div className={`flex items-center gap-0.5 rounded-lg p-0.5 ${isDark ? 'bg-stone-800' : 'bg-stone-100'}`}>
          {(['light', 'dark'] as const).map((t) => (
            <button key={t} onClick={() => setGraphTheme(t)} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${graphTheme === t ? (isDark ? 'bg-stone-600 text-white' : 'bg-white text-stone-900 shadow-sm') : (isDark ? 'text-stone-400' : 'text-stone-500')}`}>
              {t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowControls(!showControls)} className={`px-2 py-1.5 rounded-lg text-[10px] font-medium ${isDark ? 'bg-stone-800 text-stone-400' : 'bg-white text-stone-500 shadow-sm border border-stone-200'}`}>Settings</button>
      </div>
      {/* Settings panel */}
      {showControls && (
        <div className={`absolute top-12 right-3 z-20 w-52 rounded-lg p-3 space-y-3 wiki-scale-in ${isDark ? 'bg-stone-800 text-stone-300' : 'bg-white text-stone-700 shadow-lg border border-stone-200'}`}>
          <div>
            <label className="text-[10px] font-medium block mb-1">Repel Force: {graphForce}</label>
            <input type="range" min="50" max="800" value={graphForce} onChange={(e) => setGraphForce(Number(e.target.value))} className="w-full h-1 accent-emerald-600" />
          </div>
          <div>
            <label className="text-[10px] font-medium block mb-1">Link Distance: {graphDistance}</label>
            <input type="range" min="20" max="200" value={graphDistance} onChange={(e) => setGraphDistance(Number(e.target.value))} className="w-full h-1 accent-emerald-600" />
          </div>
          <div>
            <label className="text-[10px] font-medium block mb-1">Node Size: {graphNodeSize.toFixed(1)}x</label>
            <input type="range" min="5" max="20" value={graphNodeSize * 10} onChange={(e) => setGraphNodeSize(Number(e.target.value) / 10)} className="w-full h-1 accent-emerald-600" />
          </div>
          <button onClick={() => { setGraphForce(300); setGraphDistance(80); setGraphNodeSize(1); }} className={`text-[10px] w-full py-1 rounded ${isDark ? 'bg-stone-700 hover:bg-stone-600' : 'bg-stone-100 hover:bg-stone-200'} transition-colors`}>Reset</button>
        </div>
      )}

      <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full text-[10px] ${isDark ? 'bg-stone-800/80 text-stone-500' : 'bg-white/80 text-stone-400 shadow-sm'}`}>
        Click to preview · Double-click to open · Scroll to zoom · Drag to pan
      </div>

      <div className="flex-1">
        <WikiGraph onPageSelect={(s) => navigate(`/wiki/${s}`)} onNodePreview={handleNodePreview} highlightSlug={previewSlug} theme={graphTheme} forceStrength={graphForce} linkDistance={graphDistance} nodeScale={graphNodeSize} />
        {previewSlug && (
          <div className="absolute z-30 w-[360px] max-h-[420px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{
            left: Math.min(previewPos.x + 16, (typeof window !== 'undefined' ? window.innerWidth - 400 : 600)),
            top: Math.min(previewPos.y - 40, (typeof window !== 'undefined' ? window.innerHeight - 500 : 400)),
          }}>
            {previewLoading ? (
              <div className="p-6 text-center"><p className="text-stone-400 text-sm">Loading...</p></div>
            ) : previewPage ? (
              <>
                <div className="px-4 pt-4 pb-3 border-b border-[#f3f4f3]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-stone-900">{previewPage.title}</h3>
                      {previewPage.category && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white mt-1 inline-block" style={{ backgroundColor: WIKI_CATEGORIES[previewPage.category]?.color ?? '#6b7280' }}>
                          {WIKI_CATEGORIES[previewPage.category]?.label ?? previewPage.category}
                        </span>
                      )}
                    </div>
                    <button onClick={() => { setPreviewSlug(null); setPreviewPage(null); }} className="p-1 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"><X size={16} /></button>
                  </div>
                </div>
                <div className="px-4 py-3 overflow-y-auto flex-1 max-h-[260px]">
                  <WikiRenderer body={previewPage.body.slice(0, 800) + (previewPage.body.length > 800 ? '\n\n...' : '')} />
                </div>
                <div className="px-4 py-3 border-t border-[#f3f4f3] flex items-center justify-between">
                  <span className="text-[10px] text-stone-400">{previewPage.outgoing_links?.length ?? 0} links · {previewPage.backlinks?.length ?? 0} backlinks</span>
                  <button onClick={() => navigate(`/wiki/${previewSlug}`)} className="text-xs font-medium text-white bg-gradient-to-br from-[#005d42] to-[#047857] px-3 py-1.5 rounded-lg hover:opacity-90">Open →</button>
                </div>
              </>
            ) : (
              <div className="p-6 text-center"><p className="text-stone-400 text-sm">Page not found</p></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Welcome View
// ============================================================================

function WikiWelcome({ onNewPage }: { onNewPage: () => void }) {
  return (
    <div className="h-full flex items-center justify-center bg-white">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-stone-800 mb-1">Cloudskraal Wiki</h2>
        <p className="text-sm text-stone-400 mb-4">Select a page from the sidebar, or create a new one.</p>
        <button onClick={onNewPage} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 transition-colors">
          <Plus size={16} /> New Page
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Wiki Layout (router + sidebar)
// ============================================================================

export default function WikiPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [allPages, setAllPages] = useState<WikiPageSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [treeFilter, setTreeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Parse slug from pathname
  const pathParts = location.pathname.replace(/^\/wiki\/?/, '').split('/').filter(Boolean);
  const isGraph = pathParts[0] === 'graph';
  const slug = (!isGraph && pathParts[0]) ? pathParts[0] : undefined;

  const fetchAllPages = useCallback(() => {
    getWikiPages().then(setAllPages).catch(console.error);
  }, []);

  useEffect(() => {
    fetchAllPages();
  }, [fetchAllPages]);

  async function handleNewPage() {
    try {
      const page = await createWikiPage({ title: 'Untitled', body: '' });
      fetchAllPages();
      navigate(`/wiki/${page.slug}`);
    } catch {
      const page = await createWikiPage({ title: `Untitled ${Date.now() % 10000}`, body: '' });
      fetchAllPages();
      navigate(`/wiki/${page.slug}`);
    }
  }

  return (
    <>
      <WikiCommandPalette />
      <div className="h-[calc(100vh-5rem)] md:h-screen flex overflow-hidden">
        {/* Left sidebar */}
        <div
          className="flex-shrink-0 bg-white border-r border-[#f3f4f3] flex-col overflow-hidden hidden md:flex"
          style={{ width: sidebarOpen ? 240 : 0, opacity: sidebarOpen ? 1 : 0, transition: 'width 0.2s ease, opacity 0.15s ease' }}
        >
          <div className="w-60 flex flex-col h-full">
            <div className="flex-shrink-0 px-3 py-2.5 border-b border-[#f3f4f3]">
              <div className="relative">
                <input
                  type="text"
                  value={treeFilter}
                  onChange={(e) => setTreeFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setTreeFilter('');
                  }}
                  placeholder="Filter pages..."
                  className="w-full pl-7 pr-2 py-1.5 text-[12px] bg-stone-50 border border-stone-200 rounded-md text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400"
                />
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                {treeFilter && (
                  <button onClick={() => setTreeFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 px-3 py-2 border-b border-[#f3f4f3] flex items-center gap-1.5">
              <button onClick={() => { const today = new Date().toISOString().slice(0, 10); getDailyNote(today).then((p) => navigate(`/wiki/${p.slug}`)).catch(console.error); }} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-100 rounded transition-colors">
                <CalendarDays size={12} /> Today
              </button>
              <Link to="/wiki/graph" className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-100 rounded transition-colors">
                <Network size={12} /> Graph
              </Link>
              <button onClick={handleNewPage} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors ml-auto">
                <Plus size={12} /> New
              </button>
            </div>
            {categoryFilter && (
              <div className="flex-shrink-0 px-3 py-1.5 bg-emerald-50 flex items-center gap-2 text-xs">
                <span className="text-emerald-700 font-medium">Filtered: {WIKI_CATEGORIES[categoryFilter]?.label ?? categoryFilter}</span>
                <button onClick={() => setCategoryFilter(null)} className="text-emerald-600 hover:text-emerald-800"><X size={12} /></button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              <WikiFileTree
                pages={allPages.filter(p => {
                  if (treeFilter && !p.title.toLowerCase().includes(treeFilter.toLowerCase())) return false;
                  if (categoryFilter && (p.category ?? 'general') !== categoryFilter) return false;
                  return true;
                })}
                activeSlug={slug ?? null}
                onSelect={(s) => navigate(`/wiki/${s}`)}
                onMoveTo={async (s, cat) => { await updateWikiPage(s, { category: cat }); fetchAllPages(); }}
                onRename={async (s, t) => { await updateWikiPage(s, { title: t }); fetchAllPages(); }}
                onDuplicate={async (s) => {
                  const o = await getWikiPage(s);
                  const p = await createWikiPage({ title: `${o.title} (copy)`, body: o.body, category: o.category ?? undefined, enterprise: o.enterprise ?? undefined, tags: o.tags });
                  fetchAllPages(); navigate(`/wiki/${p.slug}`);
                }}
                onDelete={async (s) => { await deleteWikiPage(s); fetchAllPages(); if (slug === s) navigate('/wiki'); }}
                onTogglePin={async (s, pinned) => { await updateWikiPage(s, { pinned }); fetchAllPages(); }}
                onCopyLink={(title) => { navigator.clipboard.writeText(`[[${title}]]`); }}
              />
            </div>
            <div className="flex-shrink-0 border-t border-[#f3f4f3]">
              <WikiTagCloud onTagSelect={() => navigate('/wiki')} />
            </div>
            <div className="flex-shrink-0 px-3 py-2 border-t border-[#f3f4f3] text-[10px] text-stone-400">
              {allPages.length} pages
            </div>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden md:flex items-center justify-center w-5 flex-shrink-0 bg-white border-r border-[#f3f4f3] hover:bg-stone-50 text-stone-400 hover:text-stone-600"
          style={{ transition: 'background-color 0.15s ease' }}
        >
          <ChevronRight size={12} style={{ transition: 'transform 0.2s ease', transform: sidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </button>

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {isGraph ? (
            <WikiGraphView />
          ) : slug ? (
            <WikiSinglePage
              key={slug}
              slug={slug}
              rightSidebarOpen={sidebarOpen}
              onTitleChange={() => fetchAllPages()}
              onFilterCategory={(cat) => { setCategoryFilter(prev => prev === cat ? null : cat); setTreeFilter(''); }}
            />
          ) : (
            <WikiWelcome onNewPage={handleNewPage} />
          )}
        </div>
      </div>
    </>
  );
}
