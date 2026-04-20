import { useState, useEffect, useMemo } from 'react';
import FluidDialog from '../map/FluidDialog';
import type { Tag, TaskStatusConfig } from '../../types/taskManager';
import type { TaskPriority } from '../../types/calendar';
import { PRIORITY_COLORS } from '../../types/calendar';

interface TaskCreateFormProps {
  open: boolean;
  tags: Tag[];
  statuses: TaskStatusConfig[];
  fields: Array<{ id: string; name: string }>;
  onSave: (data: {
    title: string;
    description: string | null;
    status_id: string | null;
    priority: TaskPriority;
    due_date: string | null;
    assigned_to: string | null;
    estimated_minutes: number | null;
    field_id: string | null;
    tag_ids: string[];
  }) => void;
  onDismiss: () => void;
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const LABEL = 'text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-600 mb-1.5';
const INPUT =
  'w-full bg-white/60 border border-stone-300/80 rounded-lg px-3 py-2 text-stone-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/30';

export default function TaskCreateForm({
  open,
  tags,
  statuses,
  fields,
  onSave,
  onDismiss,
}: TaskCreateFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [fieldSearch, setFieldSearch] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [fieldDropdownOpen, setFieldDropdownOpen] = useState(false);

  const defaultStatusId = useMemo(() => {
    const def = statuses.find((s) => s.is_default === 1);
    return def?.id ?? statuses[0]?.id ?? null;
  }, [statuses]);

  const [statusId, setStatusId] = useState<string | null>(defaultStatusId);

  // Sync default status when statuses load
  useEffect(() => {
    if (!statusId && defaultStatusId) setStatusId(defaultStatusId);
  }, [defaultStatusId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredFields = useMemo(() => {
    if (!fieldSearch.trim()) return fields;
    const q = fieldSearch.toLowerCase();
    return fields.filter((f) => f.name.toLowerCase().includes(q));
  }, [fields, fieldSearch]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      status_id: statusId,
      priority,
      due_date: dueDate || null,
      assigned_to: assignedTo.trim() || null,
      estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      field_id: selectedFieldId,
      tag_ids: Array.from(selectedTagIds),
    });
    // Reset form
    setTitle('');
    setDescription('');
    setPriority('medium');
    setSelectedTagIds(new Set());
    setDueDate('');
    setAssignedTo('');
    setEstimatedMinutes('');
    setFieldSearch('');
    setSelectedFieldId(null);
    setStatusId(defaultStatusId);
  };

  const selectedFieldName = selectedFieldId
    ? fields.find((f) => f.id === selectedFieldId)?.name ?? ''
    : '';

  return (
    <FluidDialog open={open} onDismiss={onDismiss} maxWidth="max-w-md">
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-serif text-stone-900 tracking-tight">New Task</h2>

        {/* Title */}
        <div>
          <label className={LABEL}>Title</label>
          <input
            type="text"
            className={INPUT}
            placeholder="Task title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <label className={LABEL}>Description</label>
          <textarea
            className={INPUT}
            rows={2}
            placeholder="Optional description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Status */}
        <div>
          <label className={LABEL}>Status</label>
          <select
            className={INPUT}
            value={statusId ?? ''}
            onChange={(e) => setStatusId(e.target.value || null)}
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className={LABEL}>Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => {
              const isSelected = priority === p.value;
              const color = PRIORITY_COLORS[p.value];
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isSelected ? 'text-white' : 'text-stone-700 bg-stone-100'
                  }`}
                  style={isSelected ? { backgroundColor: color } : undefined}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <label className={LABEL}>Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const isSelected = selectedTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      isSelected ? 'text-white' : 'text-stone-700'
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: tag.color }
                        : {
                            backgroundColor: 'transparent',
                            border: `1px solid ${tag.color}`,
                            color: tag.color,
                          }
                    }
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Field (searchable dropdown) */}
        <div className="relative">
          <label className={LABEL}>Field</label>
          <input
            type="text"
            className={INPUT}
            placeholder="Search fields..."
            value={fieldDropdownOpen ? fieldSearch : selectedFieldName}
            onChange={(e) => {
              setFieldSearch(e.target.value);
              setFieldDropdownOpen(true);
            }}
            onFocus={() => setFieldDropdownOpen(true)}
            onBlur={() => setTimeout(() => setFieldDropdownOpen(false), 150)}
          />
          {fieldDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm text-stone-400 hover:bg-stone-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelectedFieldId(null);
                  setFieldSearch('');
                  setFieldDropdownOpen(false);
                }}
              >
                (no field)
              </button>
              {filteredFields.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm text-stone-900 hover:bg-emerald-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSelectedFieldId(f.id);
                    setFieldSearch('');
                    setFieldDropdownOpen(false);
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Due date + Assignee row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Due date</label>
            <input
              type="date"
              className={INPUT}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Assignee</label>
            <input
              type="text"
              className={INPUT}
              placeholder="Who?"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            />
          </div>
        </div>

        {/* Estimated minutes */}
        <div>
          <label className={LABEL}>Est. minutes</label>
          <input
            type="number"
            className={`${INPUT} max-w-[120px]`}
            min={0}
            placeholder="0"
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!title.trim()}
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: title.trim()
                ? 'linear-gradient(135deg, #059669, #047857)'
                : '#a8a29e',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </FluidDialog>
  );
}
