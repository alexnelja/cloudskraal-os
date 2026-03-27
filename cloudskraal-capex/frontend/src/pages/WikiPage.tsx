import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Plus, Pin, ChevronRight, Trash2, Pencil, ArrowLeft, Network } from 'lucide-react';
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
                    <PageRow key={page.id} page={page} onClick={() => navigate(`/wiki/${page.slug}`)} />
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
                      <PageRow key={page.id} page={page} onClick={() => navigate(`/wiki/${page.slug}`)} />
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

function PageRow({ page, onClick }: { page: WikiPageSummary; onClick: () => void }) {
  const cat = page.category ? WIKI_CATEGORIES[page.category] : null;
  const entColor = page.enterprise ? ENTERPRISE_COLORS[page.enterprise] : null;
  const entLabel = page.enterprise ? ENTERPRISE_LABELS[page.enterprise] ?? page.enterprise : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 truncate group-hover:text-emerald-700 transition-colors">
          {page.pinned && <Pin size={12} className="inline mr-1.5 text-amber-500" />}
          {page.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {cat && (
            <span
              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
              style={{ backgroundColor: cat.color }}
            >
              {cat.label}
            </span>
          )}
          {entLabel && (
            <span
              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
              style={{ backgroundColor: entColor ?? '#6b7280' }}
            >
              {entLabel}
            </span>
          )}
          {page.tags.length > 0 && (
            <span className="text-[10px] text-stone-400">
              {page.tags.slice(0, 3).join(', ')}
              {page.tags.length > 3 && ` +${page.tags.length - 3}`}
            </span>
          )}
        </div>
      </div>
      <span className="text-[10px] text-stone-400 flex-shrink-0 hidden sm:block">
        {formatDate(page.updated_at)}
      </span>
      <ChevronRight size={14} className="text-stone-300 flex-shrink-0" />
    </button>
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
              <Pencil size={14} />
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

  function handlePageSelect(slug: string) {
    navigate(`/wiki/${slug}`);
  }

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-stone-800 px-4 py-3 flex items-center gap-3 bg-stone-900">
        <button
          onClick={() => navigate('/wiki')}
          className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-200 transition-colors"
        >
          <ArrowLeft size={16} />
          Wiki
        </button>
        <ChevronRight size={14} className="text-stone-600" />
        <span className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
          <Network size={13} />
          Knowledge Graph
        </span>
        <div className="flex-1" />
        <span className="text-xs text-stone-500">Click a node to open page</span>
      </div>
      <WikiGraph onPageSelect={handlePageSelect} />
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
