import { Circle, CheckCircle2, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MockTask {
  id: number;
  day: string;
  title: string;
  assignee: string;
  done: boolean;
  linkTo?: string;
}

// TODO: Replace with real calendar/task API data
const MOCK_TASKS: MockTask[] = [
  { id: 1, day: 'Mon', title: 'Drench ewe flock — Camp 4', assignee: 'Piet', done: false, linkTo: '/livestock' },
  { id: 2, day: 'Mon', title: 'Service irrigation pump', assignee: 'Johan', done: true, linkTo: '/equipment' },
  { id: 3, day: 'Tue', title: 'Rooibos field inspection — Block C', assignee: 'Alex', done: false, linkTo: '/fields' },
  { id: 4, day: 'Wed', title: 'Mix lamb creep feed', assignee: 'Piet', done: false },
  { id: 5, day: 'Wed', title: 'Vineyard pruning — Chenin Blanc', assignee: 'Jannie', done: false, linkTo: '/fields' },
  { id: 6, day: 'Thu', title: 'Vet check — ram lot', assignee: 'Dr Botha', done: false, linkTo: '/livestock' },
  { id: 7, day: 'Fri', title: 'Lupine harvest prep — Field 12', assignee: 'Johan', done: false, linkTo: '/fields' },
];

export default function DashboardTasks() {
  // Group tasks by day
  const grouped = MOCK_TASKS.reduce<Record<string, MockTask[]>>((acc, task) => {
    if (!acc[task.day]) acc[task.day] = [];
    acc[task.day].push(task);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73]">
          This Week's Tasks
        </h3>
        <Link to="/calendar/tasks" className="text-xs font-medium text-emerald-700 hover:text-emerald-800">
          View all
        </Link>
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).map(([day, tasks]) => (
          <div key={day}>
            <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#6e7a73] bg-[#f3f4f3] rounded-lg px-2 py-1 mb-1">
              {day}
            </p>
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 px-2 py-2 hover:bg-[#f3f4f3] rounded-lg transition-colors"
              >
                {task.done ? (
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                ) : (
                  <Circle size={16} className="text-[#bdc9c1] shrink-0" />
                )}
                <span
                  className={`flex-1 text-sm truncate ${
                    task.done ? 'line-through text-[#6e7a73]' : 'text-[#1a2e1a]'
                  }`}
                >
                  {task.title}
                </span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                  {task.assignee}
                </span>
                {task.linkTo && (
                  <Link to={task.linkTo} className="text-[#6e7a73] hover:text-emerald-700 shrink-0">
                    <LinkIcon size={12} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
