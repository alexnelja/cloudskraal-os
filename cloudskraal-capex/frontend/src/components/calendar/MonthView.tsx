import { useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarEvent, Task } from '../../types/calendar';
import { ENTERPRISE_COLORS } from '../../types/farm';
import { PRIORITY_COLORS } from '../../types/calendar';

interface MonthViewProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  tasks: Task[];
  selectedDate: string | null;
  onDayClick: (date: string) => void;
  onRangeSelect: (startDate: string, endDate: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function getToday(): string {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

interface DayCell {
  date: string;
  day: number;
  inMonth: boolean;
}

function buildGrid(year: number, month: number): DayCell[] {
  const firstDay = new Date(year, month - 1, 1);
  // Monday = 0 ... Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrev = new Date(year, month - 1, 0).getDate();

  const cells: DayCell[] = [];

  // Previous month padding
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  for (let i = startDow - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    cells.push({ date: toDateStr(prevYear, prevMonth, d), day: d, inMonth: false });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: toDateStr(year, month, d), day: d, inMonth: true });
  }

  // Next month padding to fill 6 rows
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ date: toDateStr(nextYear, nextMonth, d), day: d, inMonth: false });
  }

  return cells;
}

/** Return [earlier, later] dates regardless of input order */
function normalizeRange(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

function isDateInRange(date: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const [lo, hi] = normalizeRange(start, end);
  return date >= lo && date <= hi;
}

interface EventBar {
  event: CalendarEvent;
  startCol: number;
  span: number;
  continuesLeft: boolean;
  continuesRight: boolean;
}

function getEventBarsForRow(rowDates: string[], events: CalendarEvent[]): EventBar[] {
  const bars: EventBar[] = [];
  for (const ev of events) {
    if (!ev.end_date) continue;
    const evStart = ev.start_date.slice(0, 10);
    const evEnd = ev.end_date.slice(0, 10);
    if (evStart === evEnd) continue; // single-day, not a bar

    const rowStart = rowDates[0];
    const rowEnd = rowDates[6];

    // Does this event overlap this row?
    if (evEnd < rowStart || evStart > rowEnd) continue;

    const actualStart = evStart < rowStart ? rowStart : evStart;
    const actualEnd = evEnd > rowEnd ? rowEnd : evEnd;
    const startIdx = rowDates.indexOf(actualStart);
    const endIdx = rowDates.indexOf(actualEnd);
    if (startIdx === -1 || endIdx === -1) continue;
    const span = endIdx - startIdx + 1;

    bars.push({
      event: ev,
      startCol: startIdx,
      span,
      continuesLeft: evStart < rowStart,
      continuesRight: evEnd > rowEnd,
    });
  }
  return bars;
}

export default function MonthView({
  year,
  month,
  events,
  tasks,
  selectedDate,
  onDayClick,
  onRangeSelect,
  onPrevMonth,
  onNextMonth,
}: MonthViewProps) {
  const today = getToday();
  const grid = buildGrid(year, month);

  // Drag state
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<string | null>(null);

  // Split grid into rows of 7
  const rows: DayCell[][] = [];
  for (let i = 0; i < grid.length; i += 7) {
    rows.push(grid.slice(i, i + 7));
  }

  // Identify multi-day events (those with end_date != start_date)
  const multiDayEvents = events.filter(
    (ev) => ev.end_date && ev.start_date.slice(0, 10) !== ev.end_date.slice(0, 10),
  );

  // Set of dates covered by multi-day events, for excluding from dots
  const multiDayDates = new Set<string>();
  for (const ev of multiDayEvents) {
    const start = ev.start_date.slice(0, 10);
    const end = ev.end_date!.slice(0, 10);
    // Mark all dates this event covers
    const d = new Date(start + 'T00:00:00');
    const endD = new Date(end + 'T00:00:00');
    while (d <= endD) {
      multiDayDates.add(toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate()));
      d.setDate(d.getDate() + 1);
    }
  }

  // Index single-day events and tasks by date
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    // Skip multi-day events from dots
    if (ev.end_date && ev.start_date.slice(0, 10) !== ev.end_date.slice(0, 10)) continue;
    const d = ev.start_date.slice(0, 10);
    if (!eventsByDate.has(d)) eventsByDate.set(d, []);
    eventsByDate.get(d)!.push(ev);
  }

  const tasksByDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.due_date) {
      const d = t.due_date.slice(0, 10);
      if (!tasksByDate.has(d)) tasksByDate.set(d, []);
      tasksByDate.get(d)!.push(t);
    }
  }

  function getDots(date: string): { color: string; label: string }[] {
    const dots: { color: string; label: string }[] = [];
    const dayEvents = eventsByDate.get(date) ?? [];
    const dayTasks = tasksByDate.get(date) ?? [];

    for (const ev of dayEvents) {
      dots.push({
        color: ev.color ?? ENTERPRISE_COLORS[ev.enterprise ?? ''] ?? '#6b7280',
        label: ev.title,
      });
    }
    for (const t of dayTasks) {
      dots.push({
        color: ENTERPRISE_COLORS[t.enterprise ?? ''] ?? PRIORITY_COLORS[t.priority] ?? '#6b7280',
        label: t.title,
      });
    }
    return dots;
  }

  // --- Drag handlers ---
  const handlePointerDown = useCallback((date: string) => {
    dragStartRef.current = date;
    setDragStart(date);
    setDragEnd(date);
    setIsDragging(true);
  }, []);

  const handlePointerEnter = useCallback((date: string) => {
    if (dragStartRef.current) {
      setDragEnd(date);
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragStartRef.current) {
      const start = dragStartRef.current;
      const end = dragEnd;
      dragStartRef.current = null;
      setIsDragging(false);

      if (start && end && start !== end) {
        const [lo, hi] = normalizeRange(start, end);
        onRangeSelect(lo, hi);
      } else if (start) {
        onDayClick(start);
      }

      setDragStart(null);
      setDragEnd(null);
    }
  }, [dragEnd, onRangeSelect, onDayClick]);

  // Touch support helpers
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragStartRef.current) return;
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const dateAttr = el?.closest('[data-date]')?.getAttribute('data-date');
      if (dateAttr) {
        setDragEnd(dateAttr);
      }
    },
    [],
  );

  return (
    <div
      className="flex flex-col h-full select-none"
      onMouseUp={handlePointerUp}
      onTouchEnd={handlePointerUp}
      onTouchMove={handleTouchMove}
    >
      {/* Navigation header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
        <button
          onClick={onPrevMonth}
          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-stone-800">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button
          onClick={onNextMonth}
          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-stone-200">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="text-center text-xs font-medium text-stone-500 py-2"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Day grid — row by row */}
      <div className="flex-1 flex flex-col">
        {rows.map((rowCells, rowIdx) => {
          const rowDates = rowCells.map((c) => c.date);
          const bars = getEventBarsForRow(rowDates, multiDayEvents);

          return (
            <div key={rowIdx} className="relative grid grid-cols-7 flex-1 min-h-0">
              {/* Day cells */}
              {rowCells.map((cell) => {
                const isToday = cell.date === today;
                const isSelected = cell.date === selectedDate;
                const inDragRange = isDragging && isDateInRange(cell.date, dragStart, dragEnd);
                const dots = getDots(cell.date);

                return (
                  <div
                    key={cell.date}
                    data-date={cell.date}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePointerDown(cell.date);
                    }}
                    onMouseEnter={() => handlePointerEnter(cell.date)}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      handlePointerDown(cell.date);
                    }}
                    className={`
                      relative border-b border-r border-stone-100 p-1 md:p-2
                      text-left flex flex-col min-h-[48px] md:min-h-[80px]
                      transition-colors cursor-pointer
                      ${!inDragRange && !isSelected ? 'hover:bg-stone-50' : ''}
                      ${isSelected && !inDragRange ? 'bg-emerald-50' : ''}
                      ${isToday ? 'ring-2 ring-inset ring-emerald-500 bg-emerald-50/50' : ''}
                      ${inDragRange ? 'bg-emerald-100/60' : ''}
                    `}
                  >
                    <span
                      className={`
                        text-xs md:text-sm font-medium
                        ${cell.inMonth ? 'text-stone-800' : 'text-stone-300'}
                        ${isToday ? 'text-emerald-700 font-bold' : ''}
                      `}
                    >
                      {cell.day}
                    </span>

                    {/* Dots (single-day events + tasks) */}
                    {dots.length > 0 && (
                      <div className="flex gap-0.5 mt-1 flex-wrap">
                        {dots.slice(0, 4).map((dot, i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: dot.color }}
                            title={dot.label}
                          />
                        ))}
                        {dots.length > 4 && (
                          <span className="text-[8px] text-stone-400">+{dots.length - 4}</span>
                        )}
                      </div>
                    )}

                    {/* Desktop: show up to 2 single-day event titles */}
                    <div className="hidden md:flex flex-col gap-0.5 mt-1 overflow-hidden flex-1">
                      {dots.slice(0, 2).map((dot, i) => (
                        <span
                          key={i}
                          className="text-[10px] leading-tight text-stone-600 truncate"
                        >
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full mr-0.5 align-middle"
                            style={{ backgroundColor: dot.color }}
                          />
                          {dot.label}
                        </span>
                      ))}
                      {dots.length > 2 && (
                        <span className="text-[10px] text-stone-400">
                          +{dots.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Multi-day event bars (absolutely positioned across the row) */}
              {bars.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ bottom: '2px' }}>
                  {bars.map((bar, i) => {
                    const borderRadius = bar.continuesLeft && bar.continuesRight
                      ? '0'
                      : bar.continuesLeft
                        ? '0 4px 4px 0'
                        : bar.continuesRight
                          ? '4px 0 0 4px'
                          : '4px';
                    return (
                      <div
                        key={`${bar.event.id}-${rowIdx}`}
                        className="absolute h-[18px] text-[10px] font-medium text-white px-1 truncate flex items-center pointer-events-auto"
                        title={bar.event.title}
                        style={{
                          left: `${(bar.startCol / 7) * 100}%`,
                          width: `${(bar.span / 7) * 100}%`,
                          bottom: `${i * 20}px`,
                          backgroundColor:
                            bar.event.color ?? ENTERPRISE_COLORS[bar.event.enterprise ?? ''] ?? '#6b7280',
                          borderRadius,
                        }}
                      >
                        {!bar.continuesLeft && bar.event.title}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
