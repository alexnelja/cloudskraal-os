import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Plus, Pin, ChevronRight, Trash2, Pencil as PencilIcon, ArrowLeft, Network, X } from 'lucide-react';
import EditableCell from '../components/EditableCell';
import WikiSearch from '../components/wiki/WikiSearch';
import WikiRenderer from '../components/wiki/WikiRenderer';
import WikiEditor from '../components/wiki/WikiEditor';
import WikiInlineEditor from '../components/wiki/WikiInlineEditor';
import WikiGraph from '../components/wiki/WikiGraph';
import { getWikiPages, getWikiPage, deleteWikiPage, updateWikiPage } from '../api/wiki';
import { WIKI_CATEGORIES } from '../types/wiki';
import type { WikiPageSummary, WikiPage as WikiPageType } from '../types/wiki';
import { ENTERPRISE_COLORS, ENTERPRISE_LABELS } from '../types/farm';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/* ----- Wiki Home: page list ----- */

function WikiHome() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<WikiPageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const fetchPages = useCallback(() => {
    setLoading(true);
    getWikiPages(categoryFilter ? { category: categoryFilter } : undefined)
      .then((data) => {
        setPages(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load wiki pages:', err);
        setLoading(false);
      });
  }, [categoryFilter]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  function handleSearchSelect(slug: string) {
    navigate(`/wiki/${slug}`);
  }

  function handleEditorSave() {
    setShowEditor(false);
    fetchPages();
  }

  const pinnedPages = pages.filter((p) => p.pinned);
  const unpinnedPages = pages.filter((p) => !p.pinned);

  // Group unpinned by category
  const grouped: Record<string, WikiPageSummary[]> = {};
  for (const page of unpinnedPages) {
    const cat = page.category ?? 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(page);
  }

  // Sort categories by WIKI_CATEGORIES key order
  const categoryOrder = Object.keys(WIKI_CATEGORIES);
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => (categoryOrder.indexOf(a) === -1 ? 99 : categoryOrder.indexOf(a)) - (categoryOrder.indexOf(b) === -1 ? 99 : categoryOrder.indexOf(b)),
  );

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-[#f3f4f3] px-4 py-3 flex items-center gap-3 flex-wrap bg-white">
        <div className="flex-1 min-w-0">
          <WikiSearch onSelect={handleSearchSelect} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/wiki/graph"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-stone-300 text-stone-700 text-xs font-medium rounded-lg hover:bg-stone-50 transition-colors"
          >
            <Network size={14} />
            Graph
          </Link>
          <button
            onClick={() => setShowEditor(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-emerald-800 transition-colors"
          >
            <Plus size={14} />
            New Page
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex-shrink-0 border-b border-[#f3f4f3] px-4 py-2 flex items-center gap-2 flex-wrap bg-white">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            categoryFilter === null
              ? 'bg-stone-800 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          All
        </button>
        {Object.entries(WIKI_CATEGORIES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setCategoryFilter(categoryFilter === key ? null : key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              categoryFilter === key
                ? 'text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
            style={categoryFilter === key ? { backgroundColor: val.color } : undefined}
          >
            {val.label}
          </button>
        ))}
      </div>

      {/* Page list */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-stone-400 text-sm">Loading wiki...</p>
          </div>
        ) : pages.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-stone-400 text-sm">No wiki pages found.</p>
          </div>
        ) : (
          <div className="p-4 space-y-6 max-w-4xl mx-auto">
            {/* Pinned pages */}
            {pinnedPages.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Pin size={12} />
                  Pinned
                </h3>
                <div className="space-y-1">
                  {pinnedPages.map((page) => (
                    <PageRow key={page.id} page={page} onClick={() => navigate(`/wiki/${page.slug}`)} onUpdate={fetchPages} />
                  ))}
                </div>
              </div>
            )}

            {/* Grouped by category */}
            {sortedCategories.map((cat) => {
              const catMeta = WIKI_CATEGORIES[cat];
              return (
                <div key={cat}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: catMeta?.color ?? '#6b7280' }}
                    />
                    <span style={{ color: catMeta?.color ?? '#6b7280' }}>
                      {catMeta?.label ?? cat}
                    </span>
                    <span className="text-stone-400 font-normal">({grouped[cat].length})</span>
                  </h3>
                  <div className="space-y-1">
                    {grouped[cat].map((page) => (
                      <PageRow key={page.id} page={page} onClick={() => navigate(`/wiki/${page.slug}`)} onUpdate={fetchPages} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <WikiEditor open={showEditor} onClose={() => setShowEditor(false)} onSave={handleEditorSave} />
    </div>
  );
}

function PageRow({ page, onClick, onUpdate }: { page: WikiPageSummary; onClick: () => void; onUpdate?: () => void }) {
  const ENTERPRISES_LIST = ['', 'rooibos', 'wine', 'sheep', 'buchu', 'sceletium', 'all'];
  const categoryKeys = Object.keys(WIKI_CATEGORIES);

  return (
    <div
      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {page.pinned && <Pin size={12} className="inline mr-1.5 text-amber-500 flex-shrink-0" />}
          <span onClick={(e) => e.stopPropagation()}>
            <EditableCell
              value={page.title}
              onSave={(val) => {
                updateWikiPage(page.slug, { title: val }).then(() => onUpdate?.()).catch(console.error);
              }}
              className="text-sm font-medium text-stone-800 group-hover:text-emerald-700 transition-colors"
            />
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span onClick={(e) => e.stopPropagation()}>
            <EditableCell
              value={page.category ?? ''}
              type="select"
              options={['', ...categoryKeys]}
              onSave={(val) => {
                updateWikiPage(page.slug, { category: val || undefined }).then(() => onUpdate?.()).catch(console.error);
              }}
              className="text-[10px]"
            />
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <EditableCell
              value={page.enterprise ?? ''}
              type="select"
              options={ENTERPRISES_LIST}
              onSave={(val) => {
                updateWikiPage(page.slug, { enterprise: val || undefined }).then(() => onUpdate?.()).catch(console.error);
              }}
              className="text-[10px]"
            />
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <EditableCell
              value={page.tags.join(', ')}
              onSave={(val) => {
                const tags = val.split(',').map(t => t.trim()).filter(Boolean);
                updateWikiPage(page.slug, { tags }).then(() => onUpdate?.()).catch(console.error);
              }}
              className="text-[10px] text-stone-400"
            />
          </span>
        </div>
      </div>
      <span className="text-[10px] text-stone-400 flex-shrink-0 hidden sm:block">
        {formatDate(page.updated_at)}
      </span>
      <button onClick={onClick} className="flex-shrink-0">
        <ChevronRight size={14} className="text-stone-300" />
      </button>
    </div>
  );
}

/* ----- Single Page View ----- */

function WikiSinglePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<WikiPageType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editEnterprise, setEditEnterprise] = useState('');
  const [editTagsStr, setEditTagsStr] = useState('');

  const fetchPage = useCallback(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    getWikiPage(slug)
      .then((data) => {
        setPage(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load wiki page:', err);
        setError('Page not found.');
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  function startEditing() {
    if (!page) return;
    setEditTitle(page.title);
    setEditCategory(page.category ?? '');
    setEditEnterprise(page.enterprise ?? '');
    setEditTagsStr(page.tags.join(', '));
    setEditing(true);
  }

  async function handleInlineSave(body: string) {
    if (!slug || !page) return;
    setSaving(true);
    try {
      const tags = editTagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await updateWikiPage(slug, {
        title: editTitle.trim() || page.title,
        body,
        category: editCategory || undefined,
        enterprise: editEnterprise || undefined,
        tags,
      });
      setSaving(false);
      setEditing(false);
      fetchPage();
    } catch (err) {
      console.error('Failed to save:', err);
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditing(false);
  }

  async function handleDelete() {
    if (!slug) return;
    try {
      await deleteWikiPage(slug);
      navigate('/wiki');
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  const cat = page?.category ? WIKI_CATEGORIES[page.category] : null;
  const entColor = page?.enterprise ? ENTERPRISE_COLORS[page.enterprise] : null;
  const entLabel = page?.enterprise ? (ENTERPRISE_LABELS[page.enterprise] ?? page.enterprise) : null;

  const ENTERPRISES = [
    { value: '', label: 'None' },
    { value: 'rooibos', label: 'Rooibos' },
    { value: 'wine', label: 'Wine' },
    { value: 'sheep', label: 'Sheep' },
    { value: 'buchu', label: 'Buchu' },
    { value: 'sceletium', label: 'Sceletium' },
    { value: 'all', label: 'All Enterprises' },
  ];

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-[#f3f4f3] px-4 py-3 flex items-center gap-3 bg-white">
        <button
          onClick={() => navigate('/wiki')}
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Wiki
        </button>
        {cat && !editing && (
          <>
            <ChevronRight size={14} className="text-stone-300" />
            <span className="text-xs font-medium" style={{ color: cat.color }}>
              {cat.label}
            </span>
          </>
        )}
        <div className="flex-1" />
        {page && !editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={startEditing}
              className="flex items-center gap-1 px-3 py-1.5 border border-stone-300 text-stone-700 text-xs font-medium rounded-lg hover:bg-stone-50 transition-colors"
            >
              <PencilIcon size={14} />
              Edit
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-red-600">Delete?</span>
                <button
                  onClick={handleDelete}
                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 border border-stone-300 text-stone-600 text-xs rounded hover:bg-stone-50 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 border border-stone-300 text-stone-400 rounded-lg hover:text-red-600 hover:border-red-300 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-stone-400 text-sm">Loading page...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-stone-500 text-sm">{error}</p>
            <button
              onClick={() => navigate('/wiki')}
              className="text-sm text-emerald-700 hover:text-emerald-800 font-medium"
            >
              Back to Wiki
            </button>
          </div>
        ) : page && editing ? (
          /* Inline edit mode */
          <div className="max-w-4xl mx-auto">
            {/* Editable metadata fields */}
            <div className="px-6 pt-6 pb-4 space-y-3 border-b border-[#f3f4f3]">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Page title"
                className="w-full text-2xl font-bold text-stone-900 bg-transparent border-none outline-none focus:ring-0 placeholder:text-stone-300"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="px-3 py-1.5 border border-stone-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">No category</option>
                  {Object.entries(WIKI_CATEGORIES).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
                <select
                  value={editEnterprise}
                  onChange={(e) => setEditEnterprise(e.target.value)}
                  className="px-3 py-1.5 border border-stone-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {ENTERPRISES.map((ent) => (
                    <option key={ent.value} value={ent.value}>
                      {ent.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={editTagsStr}
                  onChange={(e) => setEditTagsStr(e.target.value)}
                  placeholder="Tags (comma-separated)"
                  className="px-3 py-1.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <WikiInlineEditor
              initialBody={page.body}
              onSave={handleInlineSave}
              onCancel={handleCancelEdit}
              saving={saving}
            />
          </div>
        ) : page ? (
          <div className="flex flex-col md:flex-row">
            {/* Main content */}
            <div className="flex-1 min-w-0 p-6 md:p-8 max-w-4xl">
              {/* Title + badges */}
              <h1 className="text-2xl font-bold text-stone-900 mb-2">{page.title}</h1>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {cat && (
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: cat.color }}
                  >
                    {cat.label}
                  </span>
                )}
                {entLabel && (
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: entColor ?? '#6b7280' }}
                  >
                    {entLabel}
                  </span>
                )}
              </div>

              {/* Tags */}
              {page.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  {page.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block px-2 py-0.5 bg-stone-100 text-stone-600 text-[11px] font-medium rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-xs text-stone-400 mb-6">
                Updated {formatDate(page.updated_at)}
              </p>

              {/* Rendered body */}
              <WikiRenderer body={page.body} />
            </div>

            {/* Sidebar (desktop) / Below content (mobile) */}
            <div className="md:w-[280px] md:flex-shrink-0 border-t md:border-t-0 md:border-l border-[#f3f4f3] p-4 md:p-5">
              {/* Outgoing links */}
              {page.outgoing_links.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                    Links ({page.outgoing_links.length})
                  </h3>
                  <div className="space-y-1">
                    {page.outgoing_links.map((link) => (
                      <Link
                        key={link.slug}
                        to={`/wiki/${link.slug}`}
                        className="block text-sm text-emerald-700 hover:text-emerald-800 hover:underline truncate"
                      >
                        {link.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Backlinks */}
              {page.backlinks.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                    Backlinks ({page.backlinks.length})
                  </h3>
                  <div className="space-y-1">
                    {page.backlinks.map((link) => (
                      <Link
                        key={link.slug}
                        to={`/wiki/${link.slug}`}
                        className="block text-sm text-stone-600 hover:text-emerald-700 hover:underline truncate"
                      >
                        {link.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {page.outgoing_links.length === 0 && page.backlinks.length === 0 && (
                <p className="text-xs text-stone-400">No linked pages yet.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ----- Graph view ----- */

function WikiGraphView() {
  const navigate = useNavigate();
  const [graphTheme, setGraphTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [previewPage, setPreviewPage] = useState<WikiPageType | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  function handlePageSelect(slug: string) {
    navigate(`/wiki/${slug}`);
  }

  function handleNodePreview(slug: string, position: { x: number; y: number }) {
    if (previewSlug === slug) {
      // Toggle off
      setPreviewSlug(null);
      setPreviewPage(null);
      return;
    }
    setPreviewSlug(slug);
    setPreviewPos(position);
    setPreviewLoading(true);
    getWikiPage(slug)
      .then((page) => { setPreviewPage(page); setPreviewLoading(false); })
      .catch(() => { setPreviewLoading(false); });
  }

  // Determine header colors based on theme
  const systemDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = graphTheme === 'dark' || (graphTheme === 'system' && systemDark);
  const headerBg = isDark ? 'bg-stone-900 border-stone-800' : 'bg-white/80 backdrop-blur-xl border-[#f3f4f3]';
  const headerText = isDark ? 'text-stone-300' : 'text-stone-700';
  const headerMuted = isDark ? 'text-stone-400' : 'text-stone-500';
  const headerDivider = isDark ? 'text-stone-600' : 'text-stone-300';

  const themeIcons = { light: '☀️', dark: '🌙', system: '💻' };

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      <div className={`flex-shrink-0 border-b ${headerBg} px-4 py-3 flex items-center gap-3`}>
        <button
          onClick={() => navigate('/wiki')}
          className={`flex items-center gap-1 text-sm ${headerMuted} hover:${headerText} transition-colors`}
        >
          <ArrowLeft size={16} />
          Wiki
        </button>
        <ChevronRight size={14} className={headerDivider} />
        <span className={`text-xs font-medium ${headerText} flex items-center gap-1.5`}>
          <Network size={13} />
          Knowledge Graph
        </span>
        <div className="flex-1" />
        {/* Theme toggle */}
        <div className="flex items-center gap-1 bg-stone-800/20 rounded-full p-0.5">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setGraphTheme(t)}
              className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                graphTheme === t
                  ? isDark ? 'bg-stone-700 text-white' : 'bg-white text-stone-900 shadow-sm'
                  : isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {themeIcons[t]}
            </button>
          ))}
        </div>
        <span className={`text-xs ${headerMuted}`}>Click a node to preview</span>
      </div>
      <div className="flex-1 relative">
        <WikiGraph
          onPageSelect={handlePageSelect}
          onNodePreview={handleNodePreview}
          highlightSlug={previewSlug}
          theme={graphTheme}
        />

        {/* Preview popup */}
        {previewSlug && (
          <div
            className="absolute z-30 w-[360px] max-h-[420px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{
              left: Math.min(previewPos.x + 16, (typeof window !== 'undefined' ? window.innerWidth - 400 : 600)),
              top: Math.min(previewPos.y - 40, (typeof window !== 'undefined' ? window.innerHeight - 500 : 400)),
            }}
          >
            {previewLoading ? (
              <div className="p-6 flex items-center justify-center">
                <p className="text-stone-400 text-sm">Loading...</p>
              </div>
            ) : previewPage ? (
              <>
                {/* Popup header */}
                <div className="px-4 pt-4 pb-3 border-b border-[#f3f4f3]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-stone-900">{previewPage.title}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        {previewPage.category && (
                          <span
                            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: WIKI_CATEGORIES[previewPage.category]?.color ?? '#6b7280' }}
                          >
                            {WIKI_CATEGORIES[previewPage.category]?.label ?? previewPage.category}
                          </span>
                        )}
                        {previewPage.enterprise && (
                          <span className="text-[10px] font-medium text-stone-500">{previewPage.enterprise}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setPreviewSlug(null); setPreviewPage(null); }}
                      className="p-1 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                {/* Popup body — rendered markdown preview */}
                <div className="px-4 py-3 overflow-y-auto flex-1 max-h-[260px]">
                  <WikiRenderer body={previewPage.body.slice(0, 800) + (previewPage.body.length > 800 ? '\n\n...' : '')} />
                </div>
                {/* Popup footer */}
                <div className="px-4 py-3 border-t border-[#f3f4f3] flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[10px] text-stone-400">
                    {previewPage.outgoing_links && (
                      <span>{previewPage.outgoing_links.length} links</span>
                    )}
                    {previewPage.backlinks && (
                      <span>{previewPage.backlinks.length} backlinks</span>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/wiki/${previewSlug}`)}
                    className="text-xs font-medium text-white bg-gradient-to-br from-[#005d42] to-[#047857] px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Open Page →
                  </button>
                </div>
              </>
            ) : (
              <div className="p-6 text-center">
                <p className="text-stone-400 text-sm">Page not found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----- Main Router ----- */

export default function WikiPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();

  if (location.pathname === '/wiki/graph') {
    return <WikiGraphView />;
  }

  if (slug) {
    return <WikiSinglePage />;
  }

  return <WikiHome />;
}
