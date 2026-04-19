import { useState } from 'react';
import { motion } from 'motion/react';
import { Trash, PencilSimple } from '@phosphor-icons/react';
import FluidDialog from '../map/FluidDialog';
import {
  createTag,
  updateTag,
  deleteTag,
  createStatus,
  updateStatus,
  deleteStatus,
} from '../../api/taskManager';
import type { Tag, TaskStatusConfig } from '../../types/taskManager';

type ManagerTab = 'tags' | 'statuses';
type TagGroup = 'all' | 'enterprise' | 'category' | 'custom';

interface TagManagerProps {
  open: boolean;
  onDismiss: () => void;
  tags: Tag[];
  statuses: TaskStatusConfig[];
  onTagsChanged: () => void;
}

const TAG_GROUPS: { id: TagGroup; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'category', label: 'Category' },
  { id: 'custom', label: 'Custom' },
];

const STATUS_CATEGORIES = ['active', 'done', 'closed'] as const;

export default function TagManager({
  open,
  onDismiss,
  tags,
  statuses,
  onTagsChanged,
}: TagManagerProps) {
  const [activeTab, setActiveTab] = useState<ManagerTab>('tags');
  const [groupFilter, setGroupFilter] = useState<TagGroup>('all');

  // Add tag form
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#d97706');
  const [newTagGroup, setNewTagGroup] = useState<Tag['group']>('custom');

  // Add status form
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#2563eb');
  const [newStatusCategory, setNewStatusCategory] =
    useState<TaskStatusConfig['category']>('active');

  // Editing state
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStatusName, setEditingStatusName] = useState('');

  const filteredTags =
    groupFilter === 'all'
      ? tags
      : tags.filter((t) => t.group === groupFilter);

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    await createTag({
      name: newTagName.trim(),
      color: newTagColor,
      group: newTagGroup,
    });
    setNewTagName('');
    setNewTagColor('#d97706');
    setNewTagGroup('custom');
    onTagsChanged();
  };

  const handleDeleteTag = async (id: string) => {
    if (!window.confirm('Delete this tag? It will be removed from all tasks.'))
      return;
    await deleteTag(id);
    onTagsChanged();
  };

  const handleUpdateTagName = async (id: string) => {
    if (!editingTagName.trim()) {
      setEditingTagId(null);
      return;
    }
    await updateTag(id, { name: editingTagName.trim() });
    setEditingTagId(null);
    onTagsChanged();
  };

  const handleUpdateTagColor = async (id: string, color: string) => {
    await updateTag(id, { color });
    onTagsChanged();
  };

  const handleAddStatus = async () => {
    if (!newStatusName.trim()) return;
    await createStatus({
      name: newStatusName.trim(),
      color: newStatusColor,
      category: newStatusCategory,
    });
    setNewStatusName('');
    setNewStatusColor('#2563eb');
    setNewStatusCategory('active');
    onTagsChanged();
  };

  const handleDeleteStatus = async (id: string) => {
    if (
      !window.confirm(
        'Delete this status? Tasks using it may lose their status.',
      )
    )
      return;
    await deleteStatus(id);
    onTagsChanged();
  };

  const handleUpdateStatusName = async (id: string) => {
    if (!editingStatusName.trim()) {
      setEditingStatusId(null);
      return;
    }
    await updateStatus(id, { name: editingStatusName.trim() });
    setEditingStatusId(null);
    onTagsChanged();
  };

  const handleUpdateStatusColor = async (id: string, color: string) => {
    await updateStatus(id, { color });
    onTagsChanged();
  };

  const tabs: { id: ManagerTab; label: string }[] = [
    { id: 'tags', label: 'Tags' },
    { id: 'statuses', label: 'Statuses' },
  ];

  return (
    <FluidDialog open={open} onDismiss={onDismiss} maxWidth="max-w-md">
      <div className="p-5">
        {/* Title */}
        <h2 className="text-lg font-serif text-stone-900 tracking-tight mb-4">
          Manage Tags &amp; Statuses
        </h2>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                whileTap={{ scale: 0.94 }}
                className={`px-3 py-1 text-[11px] uppercase tracking-wide rounded-full whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-stone-700 hover:text-stone-900'
                }`}
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, #d97706, #b45309)'
                    : 'rgba(245, 240, 233, 0.6)',
                  boxShadow: isActive
                    ? 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px -2px rgba(180, 83, 9, 0.4)'
                    : 'none',
                }}
              >
                {tab.label}
              </motion.button>
            );
          })}
        </div>

        {/* Tags tab */}
        {activeTab === 'tags' && (
          <div>
            {/* Group filter pills */}
            <div className="flex gap-1 mb-3">
              {TAG_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroupFilter(g.id)}
                  className={`px-2.5 py-0.5 text-[10px] uppercase tracking-wide rounded-full transition-colors ${
                    groupFilter === g.id
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Tag list */}
            <div className="max-h-60 overflow-y-auto">
              {filteredTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100 hover:bg-stone-50/50"
                >
                  <input
                    type="color"
                    value={tag.color}
                    onChange={(e) =>
                      handleUpdateTagColor(tag.id, e.target.value)
                    }
                    className="w-6 h-6 rounded-full border-0 cursor-pointer p-0"
                    title="Change color"
                  />
                  {editingTagId === tag.id ? (
                    <input
                      type="text"
                      value={editingTagName}
                      onChange={(e) => setEditingTagName(e.target.value)}
                      onBlur={() => handleUpdateTagName(tag.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateTagName(tag.id);
                        if (e.key === 'Escape') setEditingTagId(null);
                      }}
                      autoFocus
                      className="flex-1 text-sm bg-white border border-stone-300 rounded px-2 py-0.5 outline-none focus:border-amber-500"
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm text-stone-900 cursor-pointer"
                      onClick={() => {
                        setEditingTagId(tag.id);
                        setEditingTagName(tag.name);
                      }}
                    >
                      {tag.name}
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-wide text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                    {tag.group}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTagId(tag.id);
                      setEditingTagName(tag.name);
                    }}
                    className="text-stone-400 hover:text-stone-700"
                    aria-label="Edit tag"
                  >
                    <PencilSimple size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTag(tag.id)}
                    className="text-stone-400 hover:text-red-600"
                    aria-label="Delete tag"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))}
              {filteredTags.length === 0 && (
                <p className="text-sm text-stone-400 py-4 text-center">
                  No tags
                </p>
              )}
            </div>

            {/* Add tag row */}
            <div className="border-t border-dashed border-stone-300 pt-3 mt-2">
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-600 mb-2">
                Add tag
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-6 h-6 rounded-full border-0 cursor-pointer p-0"
                />
                <input
                  type="text"
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTag();
                  }}
                  className="flex-1 text-sm bg-white border border-stone-200 rounded px-2 py-1.5 outline-none focus:border-amber-500"
                />
                <select
                  value={newTagGroup}
                  onChange={(e) =>
                    setNewTagGroup(e.target.value as Tag['group'])
                  }
                  className="text-xs bg-white border border-stone-200 rounded px-1.5 py-1.5"
                >
                  <option value="custom">Custom</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="category">Category</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddTag}
                  disabled={!newTagName.trim()}
                  className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 rounded px-3 py-1.5 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Statuses tab */}
        {activeTab === 'statuses' && (
          <div>
            {/* Status list */}
            <div className="max-h-60 overflow-y-auto">
              {statuses.map((status) => (
                <div
                  key={status.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100 hover:bg-stone-50/50"
                >
                  <input
                    type="color"
                    value={status.color}
                    onChange={(e) =>
                      handleUpdateStatusColor(status.id, e.target.value)
                    }
                    className="w-6 h-6 rounded-full border-0 cursor-pointer p-0"
                    title="Change color"
                  />
                  {editingStatusId === status.id ? (
                    <input
                      type="text"
                      value={editingStatusName}
                      onChange={(e) => setEditingStatusName(e.target.value)}
                      onBlur={() => handleUpdateStatusName(status.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          handleUpdateStatusName(status.id);
                        if (e.key === 'Escape') setEditingStatusId(null);
                      }}
                      autoFocus
                      className="flex-1 text-sm bg-white border border-stone-300 rounded px-2 py-0.5 outline-none focus:border-amber-500"
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm text-stone-900 cursor-pointer"
                      onClick={() => {
                        setEditingStatusId(status.id);
                        setEditingStatusName(status.name);
                      }}
                    >
                      {status.name}
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-wide text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                    {status.category}
                  </span>
                  {status.is_default === 1 && (
                    <span className="text-[10px] uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      Default
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStatusId(status.id);
                      setEditingStatusName(status.name);
                    }}
                    className="text-stone-400 hover:text-stone-700"
                    aria-label="Edit status"
                  >
                    <PencilSimple size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteStatus(status.id)}
                    className="text-stone-400 hover:text-red-600"
                    aria-label="Delete status"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))}
              {statuses.length === 0 && (
                <p className="text-sm text-stone-400 py-4 text-center">
                  No statuses
                </p>
              )}
            </div>

            {/* Add status row */}
            <div className="border-t border-dashed border-stone-300 pt-3 mt-2">
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-600 mb-2">
                Add status
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  className="w-6 h-6 rounded-full border-0 cursor-pointer p-0"
                />
                <input
                  type="text"
                  placeholder="Status name"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddStatus();
                  }}
                  className="flex-1 text-sm bg-white border border-stone-200 rounded px-2 py-1.5 outline-none focus:border-amber-500"
                />
                <select
                  value={newStatusCategory}
                  onChange={(e) =>
                    setNewStatusCategory(
                      e.target.value as TaskStatusConfig['category'],
                    )
                  }
                  className="text-xs bg-white border border-stone-200 rounded px-1.5 py-1.5"
                >
                  {STATUS_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddStatus}
                  disabled={!newStatusName.trim()}
                  className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 rounded px-3 py-1.5 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FluidDialog>
  );
}
