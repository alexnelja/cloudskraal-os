import { useState, useMemo } from 'react';
import { CaretUp, CaretDown, Trash, FunnelSimple } from '@phosphor-icons/react';
import type { Task } from '../../types/calendar';
import { PRIORITY_COLORS } from '../../types/calendar';
import type { Tag, TaskStatusConfig } from '../../types/taskManager';

export interface ListViewProps {
  tasks: Task[];
  statuses: TaskStatusConfig[];
  tags: Tag[];
  onStatusChange: (taskId: string, statusId: string) => void;
  onDelete: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
}

type SortField = 'title' | 'status' | 'priority' | 'due_date' | 'assigned_to' | 'field_name';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ListView({
  tasks,
  statuses,
  tags: allTags,
  onStatusChange,
  onDelete,
  onSelectTask,
}: ListViewProps) {
  // Sorting
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterTag, setFilterTag] = useState('');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Status dropdown open for a specific task
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);
  // Bulk status dropdown
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let result = tasks;
    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (filterStatus) {
      result = result.filter((t) => t.status_id === filterStatus);
    }
    if (filterPriority) {
      result = result.filter((t) => t.priority === filterPriority);
    }
    if (filterTag) {
      result = result.filter((t) => t.tags?.some((tag) => tag.id === filterTag));
    }
    return result;
  }, [tasks, searchText, filterStatus, filterPriority, filterTag]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'status':
          cmp = (a.status_name ?? '').localeCompare(b.status_name ?? '');
          break;
        case 'priority':
          cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          break;
        case 'due_date': {
          const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          cmp = da - db;
          break;
        }
        case 'assigned_to':
          cmp = (a.assigned_to ?? '').localeCompare(b.assigned_to ?? '');
          break;
        case 'field_name':
          cmp = (a.field_name ?? '').localeCompare(b.field_name ?? '');
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const allSelected = sorted.length > 0 && sorted.every((t) => selected.has(t.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((t) => t.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkStatusChange = (statusId: string) => {
    selected.forEach((id) => onStatusChange(id, statusId));
    setSelected(new Set());
    setBulkStatusOpen(false);
  };

  const handleBulkDelete = () => {
    selected.forEach((id) => onDelete(id));
    setSelected(new Set());
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <CaretUp size={12} weight="bold" className="inline ml-0.5" />
    ) : (
      <CaretDown size={12} weight="bold" className="inline ml-0.5" />
    );
  };

  const headerClass =
    'text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-500 py-2 px-3 border-b border-stone-200/60 cursor-pointer hover:text-stone-700 text-left whitespace-nowrap select-none';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-stone-100 bg-stone-50/40">
        <FunnelSimple size={14} className="text-stone-400 shrink-0" />
        <input
          type="text"
          placeholder="Search title..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="text-xs bg-white border border-stone-200 rounded px-2 py-1 w-40 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs bg-white border border-stone-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="text-xs bg-white border border-stone-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
        >
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="text-xs bg-white border border-stone-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr>
              <th className={`${headerClass} w-8`}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-amber-600"
                  aria-label="Select all"
                />
              </th>
              <th className={headerClass} onClick={() => toggleSort('title')}>
                Title
                <SortIcon field="title" />
              </th>
              <th className={headerClass} onClick={() => toggleSort('status')}>
                Status
                <SortIcon field="status" />
              </th>
              <th className={headerClass} onClick={() => toggleSort('priority')}>
                Priority
                <SortIcon field="priority" />
              </th>
              <th className={`${headerClass} cursor-default hover:text-stone-500`}>Tags</th>
              <th className={headerClass} onClick={() => toggleSort('field_name')}>
                Field
                <SortIcon field="field_name" />
              </th>
              <th className={headerClass} onClick={() => toggleSort('due_date')}>
                Due Date
                <SortIcon field="due_date" />
              </th>
              <th className={headerClass} onClick={() => toggleSort('assigned_to')}>
                Assignee
                <SortIcon field="assigned_to" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-stone-400 text-sm py-12">
                  No tasks match your filters
                </td>
              </tr>
            ) : (
              sorted.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-stone-100 hover:bg-stone-50/50 cursor-pointer transition-colors"
                  onClick={() => onSelectTask(task.id)}
                >
                  {/* Checkbox */}
                  <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(task.id)}
                      onChange={() => toggleOne(task.id)}
                      className="accent-amber-600"
                      aria-label={`Select ${task.title}`}
                    />
                  </td>

                  {/* Title */}
                  <td className="py-2.5 px-3 font-medium text-stone-800 max-w-[240px] truncate">
                    {task.title}
                  </td>

                  {/* Status pill */}
                  <td className="py-2.5 px-3 relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() =>
                        setStatusDropdownId(statusDropdownId === task.id ? null : task.id)
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2.5 py-0.5 transition-colors"
                      style={{
                        backgroundColor: `${task.status_color ?? '#9ca3af'}20`,
                        color: task.status_color ?? '#9ca3af',
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: task.status_color ?? '#9ca3af' }}
                      />
                      {task.status_name ?? task.status}
                    </button>
                    {statusDropdownId === task.id && (
                      <div className="absolute z-20 mt-1 left-3 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                        {statuses.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              onStatusChange(task.id, s.id);
                              setStatusDropdownId(null);
                            }}
                            className="w-full text-left text-xs px-3 py-1.5 hover:bg-stone-50 flex items-center gap-2"
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Priority */}
                  <td className="py-2.5 px-3">
                    <span className="flex items-center gap-1.5 text-xs">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                      />
                      {PRIORITY_LABELS[task.priority] ?? task.priority}
                    </span>
                  </td>

                  {/* Tags */}
                  <td className="py-2.5 px-3">
                    <span className="flex items-center gap-1 flex-wrap">
                      {(task.tags ?? []).slice(0, 2).map((tag) => (
                        <span
                          key={tag.id}
                          className="text-[10px] font-medium rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {(task.tags ?? []).length > 2 && (
                        <span className="text-[10px] text-stone-400">
                          +{(task.tags ?? []).length - 2}
                        </span>
                      )}
                    </span>
                  </td>

                  {/* Field */}
                  <td className="py-2.5 px-3 text-xs text-stone-500">
                    {task.field_name ?? '—'}
                  </td>

                  {/* Due date */}
                  <td
                    className={`py-2.5 px-3 text-xs ${
                      isOverdue(task.due_date) ? 'text-red-600 font-medium' : 'text-stone-500'
                    }`}
                  >
                    {formatDate(task.due_date)}
                  </td>

                  {/* Assignee */}
                  <td className="py-2.5 px-3 text-xs text-stone-500">
                    {task.assigned_to ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-stone-200 px-4 py-2 flex items-center gap-3 z-20">
          <span className="text-xs font-medium text-stone-600">
            {selected.size} selected
          </span>

          {/* Bulk status change */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setBulkStatusOpen(!bulkStatusOpen)}
              className="text-xs bg-white border border-stone-200 rounded px-2.5 py-1 hover:bg-stone-50 transition-colors"
            >
              Change status
            </button>
            {bulkStatusOpen && (
              <div className="absolute bottom-full mb-1 left-0 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[140px] z-30">
                {statuses.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleBulkStatusChange(s.id)}
                    className="w-full text-left text-xs px-3 py-1.5 hover:bg-stone-50 flex items-center gap-2"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleBulkDelete}
            className="text-xs text-red-600 border border-red-200 rounded px-2.5 py-1 hover:bg-red-50 transition-colors flex items-center gap-1"
          >
            <Trash size={12} />
            Delete selected
          </button>
        </div>
      )}
    </div>
  );
}
