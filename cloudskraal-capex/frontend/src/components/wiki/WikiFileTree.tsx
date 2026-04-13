import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Pin, Copy, Trash2, PenLine, FolderInput, Bookmark, Link2 } from 'lucide-react';
import { WIKI_CATEGORIES } from '../../types/wiki';
import type { WikiPageSummary } from '../../types/wiki';

interface WikiFileTreeProps {
  pages: WikiPageSummary[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
  onMoveTo: (slug: string, category: string) => void;
  onRename: (slug: string, newTitle: string) => void;
  onDuplicate: (slug: string) => void;
  onDelete: (slug: string) => void;
  onTogglePin: (slug: string, pinned: boolean) => void;
  onCopyLink: (title: string) => void;
}

interface TreeNode {
  label: string;
  category: string;
  color: string;
  children: WikiPageSummary[];
}

/* ----- Context Menu ----- */

interface ContextMenuState {
  x: number;
  y: number;
  slug: string;
  title: string;
  pinned: boolean;
}

function ContextMenu({ menu, onClose, onAction }: {
  menu: ContextMenuState;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const items = [
    { id: 'rename', label: 'Rename...', icon: PenLine },
    { id: 'duplicate', label: 'Duplicate', icon: Copy },
    { id: 'moveto', label: 'Move to...', icon: FolderInput },
    { id: 'pin', label: menu.pinned ? 'Unpin' : 'Pin', icon: Bookmark },
    { id: 'copylink', label: 'Copy [[Link]]', icon: Link2 },
    { id: 'divider', label: '', icon: null },
    { id: 'delete', label: 'Delete', icon: Trash2, danger: true },
  ];

  // Position: ensure menu stays in viewport
  const top = Math.min(menu.y, window.innerHeight - 280);
  const left = Math.min(menu.x, window.innerWidth - 200);

  return (
    <div
      ref={ref}
      className="fixed z-[200] w-48 bg-white rounded-lg shadow-2xl border border-stone-200 py-1 wiki-scale-in"
      style={{ top, left }}
    >
      {items.map((item) => {
        if (item.id === 'divider') {
          return <div key="div" className="my-1 border-t border-stone-100" />;
        }
        const Icon = item.icon!;
        return (
          <button
            key={item.id}
            onClick={() => { onAction(item.id); onClose(); }}
            className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 text-[13px] transition-colors ${
              (item as any).danger
                ? 'text-red-600 hover:bg-red-50'
                : 'text-stone-700 hover:bg-stone-50'
            }`}
          >
            <Icon size={14} className={`flex-shrink-0 ${(item as any).danger ? 'text-red-400' : 'text-stone-400'}`} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/* ----- Move To Sub-menu ----- */

function MoveToMenu({ onSelect, onClose, currentCategory }: {
  onSelect: (category: string) => void;
  onClose: () => void;
  currentCategory: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div ref={ref} className="relative bg-white rounded-xl shadow-2xl w-64 py-2 wiki-scale-in">
        <h3 className="px-3 py-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Move to folder</h3>
        {Object.entries(WIKI_CATEGORIES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => { onSelect(key); onClose(); }}
            disabled={key === currentCategory}
            className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm transition-colors ${
              key === currentCategory ? 'text-stone-300' : 'text-stone-700 hover:bg-stone-50'
            }`}
          >
            <Folder size={14} style={{ color: val.color }} />
            {val.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ----- Rename Inline ----- */

function RenameInput({ initialTitle, onSave, onCancel }: {
  initialTitle: string;
  onSave: (newTitle: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialTitle);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => { if (value.trim() && value !== initialTitle) onSave(value.trim()); else onCancel(); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { if (value.trim()) onSave(value.trim()); }
        if (e.key === 'Escape') onCancel();
      }}
      className="w-full text-[13px] px-1.5 py-0.5 border border-emerald-400 rounded bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
      autoFocus
    />
  );
}

/* ----- Main File Tree ----- */

export default function WikiFileTree({ pages, activeSlug, onSelect, onMoveTo, onRename, onDuplicate, onDelete, onTogglePin, onCopyLink }: WikiFileTreeProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [moveToSlug, setMoveToSlug] = useState<{ slug: string; category: string } | null>(null);
  const [renamingSlug, setRenamingSlug] = useState<string | null>(null);
  const [dragSlug, setDragSlug] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [dropIndicatorSlug, setDropIndicatorSlug] = useState<string | null>(null);
  const [focusedSlug, setFocusedSlug] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => {
    const unpinned = pages.filter(p => !p.pinned);
    const groups: Record<string, WikiPageSummary[]> = {};
    for (const page of unpinned) {
      const cat = page.category ?? 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(page);
    }
    const categoryOrder = Object.keys(WIKI_CATEGORIES);
    return Object.entries(groups)
      .sort(([a], [b]) => {
        const ai = categoryOrder.indexOf(a);
        const bi = categoryOrder.indexOf(b);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .map(([cat, children]): TreeNode => ({
        label: WIKI_CATEGORIES[cat]?.label ?? cat,
        category: cat,
        color: WIKI_CATEGORIES[cat]?.color ?? '#6b7280',
        children: children.sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [pages]);

  const pinnedPages = pages.filter(p => p.pinned);

  // Flat list of visible slugs for keyboard navigation
  const visibleSlugs = useMemo(() => {
    const slugs: string[] = [];
    for (const p of pinnedPages) slugs.push(p.slug);
    for (const node of tree) {
      if (collapsed[node.category]) continue;
      for (const p of node.children) slugs.push(p.slug);
    }
    return slugs;
  }, [pinnedPages, tree, collapsed]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!visibleSlugs.length) return;
    const current = focusedSlug ?? activeSlug;
    const idx = current ? visibleSlugs.indexOf(current) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(idx + 1, visibleSlugs.length - 1);
      setFocusedSlug(visibleSlugs[next]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.max(idx - 1, 0);
      setFocusedSlug(visibleSlugs[next]);
    } else if (e.key === 'Enter' && focusedSlug) {
      e.preventDefault();
      onSelect(focusedSlug);
    }
  }, [visibleSlugs, focusedSlug, activeSlug, onSelect]);

  function toggleCollapse(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleContextMenu(e: React.MouseEvent, page: WikiPageSummary) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, slug: page.slug, title: page.title, pinned: page.pinned });
  }

  function handleContextAction(action: string) {
    if (!contextMenu) return;
    const { slug, title, pinned } = contextMenu;
    switch (action) {
      case 'rename': setRenamingSlug(slug); break;
      case 'duplicate': onDuplicate(slug); break;
      case 'moveto': {
        const page = pages.find(p => p.slug === slug);
        setMoveToSlug({ slug, category: page?.category ?? 'general' });
        break;
      }
      case 'pin': onTogglePin(slug, !pinned); break;
      case 'copylink': onCopyLink(title); break;
      case 'delete': onDelete(slug); break;
    }
  }

  // Drag handlers
  function handleDragStart(slug: string) {
    return (e: React.DragEvent) => {
      setDragSlug(slug);
      e.dataTransfer.effectAllowed = 'move';
      // Custom drag image — subtle label
      const ghost = document.createElement('div');
      const page = pages.find(p => p.slug === slug);
      ghost.textContent = page?.title ?? slug;
      ghost.style.cssText = 'position:fixed;top:-100px;background:#047857;color:white;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:500;';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      requestAnimationFrame(() => ghost.remove());
    };
  }

  function handleDragOverFolder(category: string) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverCategory(category);
    };
  }

  function handleDropOnFolder(category: string) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      if (dragSlug) {
        onMoveTo(dragSlug, category);
      }
      setDragSlug(null);
      setDragOverCategory(null);
    };
  }

  function handleDragEnd() {
    setDragSlug(null);
    setDragOverCategory(null);
    setDropIndicatorSlug(null);
  }

  function renderPage(page: WikiPageSummary, indent: boolean) {
    if (renamingSlug === page.slug) {
      return (
        <div key={page.id} className={`${indent ? 'pl-3 pr-2' : 'px-2'} py-0.5`}>
          <RenameInput
            initialTitle={page.title}
            onSave={(newTitle) => { onRename(page.slug, newTitle); setRenamingSlug(null); }}
            onCancel={() => setRenamingSlug(null)}
          />
        </div>
      );
    }

    return (
      <div key={page.id} className="relative">
        {dropIndicatorSlug === page.slug && dragSlug && (
          <div className="absolute top-0 left-3 right-2 h-0.5 bg-emerald-500 rounded-full" style={{ transform: 'translateY(-1px)' }} />
        )}
      <button
        onClick={() => onSelect(page.slug)}
        onContextMenu={(e) => handleContextMenu(e, page)}
        draggable
        onDragStart={handleDragStart(page.slug)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => { e.preventDefault(); setDropIndicatorSlug(page.slug); }}
        onDragLeave={() => { if (dropIndicatorSlug === page.slug) setDropIndicatorSlug(null); }}
        className={`w-full text-left flex items-center gap-2 ${indent ? 'pl-3 pr-2' : 'px-2'} py-1 rounded-r-md transition-colors text-[13px] ${
          activeSlug === page.slug
            ? 'bg-emerald-50 text-emerald-800 font-medium border-l-2 -ml-[1px]'
            : focusedSlug === page.slug
              ? 'bg-stone-100 text-stone-900 ring-1 ring-emerald-300'
              : dragSlug === page.slug
                ? 'opacity-40'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
        }`}
        style={activeSlug === page.slug ? { borderLeftColor: '#047857' } : undefined}
      >
        <FileText size={13} className="flex-shrink-0 text-stone-400" />
        <span className="truncate">{page.title}</span>
      </button>
      </div>
    );
  }

  return (
    <div ref={treeRef} className="text-sm select-none py-2 focus:outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Pinned */}
      {pinnedPages.length > 0 && (
        <div className="mb-2 px-2">
          <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-1 mb-1 flex items-center gap-1">
            <Pin size={10} /> Pinned
          </div>
          {pinnedPages.map((page) => renderPage(page, false))}
        </div>
      )}

      {/* Category folders */}
      {tree.map((node) => {
        const isCollapsed = collapsed[node.category] ?? false;
        const isDragOver = dragOverCategory === node.category;

        return (
          <div key={node.category} className="mb-0.5 px-2">
            <button
              onClick={() => toggleCollapse(node.category)}
              onDragOver={handleDragOverFolder(node.category)}
              onDragLeave={() => setDragOverCategory(null)}
              onDrop={handleDropOnFolder(node.category)}
              className={`w-full text-left flex items-center gap-1.5 px-1 py-1.5 text-stone-600 hover:text-stone-900 rounded-md hover:bg-stone-50 transition-all duration-150 ${
                isDragOver ? 'bg-emerald-50 ring-2 ring-emerald-400 scale-[1.02]' : ''
              }`}
            >
              {isCollapsed ? (
                <ChevronRight size={12} className="flex-shrink-0 text-stone-400" />
              ) : (
                <ChevronDown size={12} className="flex-shrink-0 text-stone-400" />
              )}
              {isCollapsed ? (
                <Folder size={14} className="flex-shrink-0" style={{ color: node.color }} />
              ) : (
                <FolderOpen size={14} className="flex-shrink-0" style={{ color: node.color }} />
              )}
              <span className="text-xs font-semibold truncate">{node.label}</span>
              <span className="text-[10px] text-stone-400 ml-auto">{node.children.length}</span>
            </button>

            {!isCollapsed && (
              <div className="ml-3 border-l border-stone-200">
                {node.children.map((page) => renderPage(page, true))}
              </div>
            )}
          </div>
        );
      })}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {/* Move-to dialog */}
      {moveToSlug && (
        <MoveToMenu
          currentCategory={moveToSlug.category}
          onSelect={(cat) => onMoveTo(moveToSlug.slug, cat)}
          onClose={() => setMoveToSlug(null)}
        />
      )}
    </div>
  );
}
