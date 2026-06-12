// Spec 4.1b — lifecycle controls for a task: state stepper + transitions.
// Verify posts the captured actuals (inputs + worker hours) straight into COP
// on the backend; this card is the operator's capture surface for that.
import { useEffect, useMemo, useState } from 'react';
import { Play, CheckCircle, SealCheck, XCircle, Plus, Trash } from '@phosphor-icons/react';
import { transitionTask, getTaskEvents, type TaskEvent } from '../../api/calendar';
import { getEmployees } from '../../api/employees';
import type { Task, TaskLifecycleState } from '../../types/calendar';

const STEPS: TaskLifecycleState[] = ['scheduled', 'in_progress', 'completed', 'verified'];
const STEP_LABELS: Record<TaskLifecycleState, string> = {
  scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed',
  verified: 'Verified', cancelled: 'Cancelled',
};
const STATE_COLORS: Record<TaskLifecycleState, string> = {
  scheduled: '#78716c', in_progress: '#d97706', completed: '#059669',
  verified: '#047857', cancelled: '#dc2626',
};

function currentState(task: Task): TaskLifecycleState {
  if (task.state) return task.state;
  return task.status === 'completed' ? 'completed' : 'scheduled';
}

interface WorkerRow { employee_id: string; hours: string }

export default function TaskLifecycleCard({
  task,
  onTransitioned,
}: {
  task: Task;
  onTransitioned: () => void;
}) {
  const state = currentState(task);
  const [form, setForm] = useState<'complete' | 'verify' | 'cancel' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);

  // complete form
  const [durationHrs, setDurationHrs] = useState('');
  const [areaHa, setAreaHa] = useState('');
  // verify form
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [workers, setWorkers] = useState<WorkerRow[]>([{ employee_id: '', hours: '' }]);
  // cancel form
  const [reason, setReason] = useState('');

  useEffect(() => {
    getTaskEvents(task.id).then(setEvents).catch(() => setEvents([]));
  }, [task.id]);

  useEffect(() => {
    if (form === 'verify' && employees.length === 0) {
      getEmployees().then(es => setEmployees(es.map(e => ({ id: e.id, name: e.name })))).catch(() => {});
    }
  }, [form, employees.length]);

  const run = async (payload: Parameters<typeof transitionTask>[1]) => {
    setBusy(true);
    setError(null);
    try {
      await transitionTask(task.id, payload);
      setForm(null);
      onTransitioned();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const trail = useMemo(
    () => events.map(e => `${e.event_type} ${e.at.slice(0, 10)}${e.by ? ` · ${e.by}` : ''}`).join('  →  '),
    [events],
  );

  const stepIdx = STEPS.indexOf(state);
  const BTN = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors';
  const INPUT = 'w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm bg-white';
  const SMALL_LABEL = 'block text-[10px] uppercase tracking-wide font-semibold text-stone-500 mb-1';

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3" data-testid="task-lifecycle-card">
      {/* state stepper */}
      <div className="flex items-center gap-1.5 mb-2.5">
        {state === 'cancelled' ? (
          <span className="text-xs font-semibold" style={{ color: STATE_COLORS.cancelled }}>
            Cancelled{task.cancelled_reason ? ` — ${task.cancelled_reason}` : ''}
          </span>
        ) : (
          STEPS.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              {i > 0 && <span className={`h-px w-4 ${i <= stepIdx ? 'bg-emerald-600' : 'bg-stone-300'}`} />}
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={i <= stepIdx
                  ? { backgroundColor: `${STATE_COLORS[s]}1a`, color: STATE_COLORS[s], fontWeight: i === stepIdx ? 700 : 500 }
                  : { color: '#a8a29e' }}>
                {STEP_LABELS[s]}
              </span>
            </span>
          ))
        )}
      </div>

      {/* verified summary */}
      {state === 'verified' && (
        <p className="text-xs text-emerald-800">
          Actuals posted to COP{task.verified_at ? ` on ${task.verified_at.slice(0, 10)}` : ''}
          {task.verified_by ? ` by ${task.verified_by}` : ''}. Inventory + labour entries are tagged to this task.
        </p>
      )}

      {/* actions */}
      {state !== 'verified' && state !== 'cancelled' && (
        <div className="flex flex-wrap items-center gap-2">
          {state === 'scheduled' && (
            <button type="button" disabled={busy} className={`${BTN} bg-amber-600 text-white hover:bg-amber-700`}
              onClick={() => run({ to_state: 'in_progress' })}>
              <Play size={13} weight="fill" /> Start
            </button>
          )}
          {state === 'in_progress' && (
            <button type="button" className={`${BTN} bg-emerald-700 text-white hover:bg-emerald-800`}
              onClick={() => setForm(form === 'complete' ? null : 'complete')}>
              <CheckCircle size={13} weight="fill" /> Complete…
            </button>
          )}
          {state === 'completed' && (
            <button type="button" className={`${BTN} bg-emerald-800 text-white hover:bg-emerald-900`}
              onClick={() => setForm(form === 'verify' ? null : 'verify')}>
              <SealCheck size={13} weight="fill" /> Verify & post actuals…
            </button>
          )}
          <button type="button" className={`${BTN} text-red-700 hover:bg-red-50`}
            onClick={() => setForm(form === 'cancel' ? null : 'cancel')}>
            <XCircle size={13} /> Cancel task…
          </button>
        </div>
      )}

      {/* complete form */}
      {form === 'complete' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="lc-hours" className={SMALL_LABEL}>Hours worked</label>
            <input id="lc-hours" aria-label="Hours worked" type="number" min="0" step="0.5"
              className={INPUT} value={durationHrs} onChange={e => setDurationHrs(e.target.value)} />
          </div>
          <div>
            <label htmlFor="lc-area" className={SMALL_LABEL}>Area covered (ha)</label>
            <input id="lc-area" aria-label="Area covered (ha)" type="number" min="0" step="0.1"
              className={INPUT} value={areaHa} onChange={e => setAreaHa(e.target.value)} />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="button" disabled={busy}
              className={`${BTN} bg-emerald-700 text-white hover:bg-emerald-800`}
              onClick={() => run({
                to_state: 'completed',
                ...(durationHrs !== '' ? { actual_duration_hrs: Number(durationHrs) } : {}),
                ...(areaHa !== '' ? { actual_area_ha: Number(areaHa) } : {}),
              })}>
              Confirm complete
            </button>
          </div>
        </div>
      )}

      {/* verify form */}
      {form === 'verify' && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-stone-500">
            Who did the work? Verify writes one labour entry per worker into COP — exactly once.
          </p>
          {workers.map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <select aria-label={`Worker ${i + 1}`} className={INPUT} value={w.employee_id}
                onChange={e => setWorkers(ws => ws.map((x, j) => j === i ? { ...x, employee_id: e.target.value } : x))}>
                <option value="">— select worker —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <input aria-label={`Hours ${i + 1}`} type="number" min="0" step="0.5" placeholder="hrs"
                className={`${INPUT} max-w-[90px]`} value={w.hours}
                onChange={e => setWorkers(ws => ws.map((x, j) => j === i ? { ...x, hours: e.target.value } : x))} />
              {workers.length > 1 && (
                <button type="button" aria-label={`Remove worker ${i + 1}`}
                  className="text-stone-400 hover:text-red-600"
                  onClick={() => setWorkers(ws => ws.filter((_, j) => j !== i))}>
                  <Trash size={15} />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button type="button" className={`${BTN} text-stone-600 hover:bg-stone-100`}
              onClick={() => setWorkers(ws => [...ws, { employee_id: '', hours: '' }])}>
              <Plus size={13} /> Add worker
            </button>
            <button type="button" disabled={busy}
              className={`${BTN} bg-emerald-800 text-white hover:bg-emerald-900`}
              onClick={() => run({
                to_state: 'verified',
                workers: workers
                  .filter(w => w.employee_id && w.hours !== '')
                  .map(w => ({ employee_id: w.employee_id, hours: Number(w.hours) })),
              })}>
              Confirm verify
            </button>
          </div>
        </div>
      )}

      {/* cancel form */}
      {form === 'cancel' && (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="lc-reason" className={SMALL_LABEL}>Reason</label>
            <input id="lc-reason" aria-label="Reason" className={INPUT}
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <button type="button" disabled={busy || !reason.trim()}
            className={`${BTN} bg-red-600 text-white hover:bg-red-700 disabled:opacity-40`}
            onClick={() => run({ to_state: 'cancelled', reason: reason.trim() })}>
            Confirm cancel
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-red-600 break-all">{error}</p>}
      {trail && <p className="mt-2 text-[10px] text-stone-400">{trail}</p>}
    </div>
  );
}
