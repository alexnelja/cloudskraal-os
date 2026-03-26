import { useState, useEffect } from 'react';
import { X, Link as LinkIcon, Eye, Pencil } from 'lucide-react';
import WikiRenderer from './WikiRenderer';
import WikiSearch from './WikiSearch';
import { createWikiPage, updateWikiPage } from '../../api/wiki';
import { WIKI_CATEGORIES } from '../../types/wiki';
import type { WikiPage } from '../../types/wiki';

interface WikiEditorProps {
  page?: WikiPage;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

const ENTERPRISES = [
  { value: '', label: 'None' },
  { value: 'rooibos', label: 'Rooibos' },
  { value: 'wine', label: 'Wine' },
  { value: 'sheep', label: 'Sheep' },
  { value: 'buchu', label: 'Buchu' },
  { value: 'sceletium', label: 'Sceletium' },
  { value: 'all', label: 'All Enterprises' },
];

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export default function WikiEditor({ page, open, onClose, onSave }: WikiEditorProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const [enterprise, setEnterprise] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [showLinkSearch, setShowLinkSearch] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(page?.title ?? '');
      setBody(page?.body ?? '');
      setCategory(page?.category ?? '');
      setEnterprise(page?.enterprise ?? '');
      setTagsStr(page?.tags.join(', ') ?? '');
      setError(null);
      setMobileTab('edit');
      setShowLinkSearch(false);
    }
  }, [open, page]);

  async function handleSave() {
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const tags = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      if (page) {
        await updateWikiPage(page.slug, {
          title: title.trim(),
          body,
          category: category || undefined,
          enterprise: enterprise || undefined,
          tags,
        });
      } else {
        await createWikiPage({
          title: title.trim(),
          body,
          category: category || undefined,
          enterprise: enterprise || undefined,
          tags,
        });
      }
      setSaving(false);
      onSave();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Failed to save.');
    }
  }

  function handleInsertLink(slug: string) {
    // Convert slug back to title-case for display
    const linkTitle = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    setBody((prev) => prev + `[[${linkTitle}]]`);
    setShowLinkSearch(false);
  }

  if (!open) return null;

  const slugPreview = titleToSlug(title);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 flex-shrink-0">
          <h2 className="text-lg font-bold text-stone-900">
            {page ? 'Edit Page' : 'New Wiki Page'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            {title.trim() && (
              <p className="mt-1 text-xs text-stone-400">
                Slug: <code className="bg-stone-100 px-1 rounded">/wiki/{slugPreview}</code>
              </p>
            )}
          </div>

          {/* Category + Enterprise row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">None</option>
                {Object.entries(WIKI_CATEGORIES).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Enterprise</label>
              <select
                value={enterprise}
                onChange={(e) => setEnterprise(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {ENTERPRISES.map((ent) => (
                  <option key={ent.value} value={ent.value}>
                    {ent.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="e.g. cultivation, irrigation, fynbos"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Insert Link helper */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLinkSearch(!showLinkSearch)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-stone-300 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <LinkIcon size={14} />
              Insert [[Link]]
            </button>
            {showLinkSearch && (
              <div className="flex-1 max-w-sm">
                <WikiSearch onSelect={handleInsertLink} />
              </div>
            )}
          </div>

          {/* Mobile tabs */}
          <div className="flex sm:hidden border-b border-stone-200">
            <button
              onClick={() => setMobileTab('edit')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                mobileTab === 'edit'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              onClick={() => setMobileTab('preview')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                mobileTab === 'preview'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <Eye size={14} />
              Preview
            </button>
          </div>

          {/* Editor: split on desktop, tabbed on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-h-[300px]">
            {/* Textarea */}
            <div className={`${mobileTab === 'preview' ? 'hidden sm:block' : ''}`}>
              <label className="block text-sm font-medium text-stone-700 mb-1 hidden sm:block">
                Markdown Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your wiki page in Markdown..."
                className="w-full h-[300px] sm:h-[400px] px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            {/* Preview */}
            <div className={`${mobileTab === 'edit' ? 'hidden sm:block' : ''}`}>
              <p className="text-sm font-medium text-stone-700 mb-1 hidden sm:block">Preview</p>
              <div className="border border-stone-200 rounded-lg p-4 h-[300px] sm:h-[400px] overflow-y-auto bg-stone-50">
                {body.trim() ? (
                  <WikiRenderer body={body} />
                ) : (
                  <p className="text-sm text-stone-400">Preview will appear here...</p>
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-stone-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : page ? 'Update Page' : 'Create Page'}
          </button>
        </div>
      </div>
    </div>
  );
}
