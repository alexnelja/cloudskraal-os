import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  DollarSign,
  TrendingUp,
  Award,
  Plus,
  ArrowRight,
  CalendarDays,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import MetricCard from '../components/MetricCard';
import ProjectModal from '../components/ProjectModal';
import { getProjects, getDashboardStats, createProject } from '../api/client';
import type { ProjectSummary, DashboardStats, CreateProjectPayload } from '../types';
import { formatZAR, formatPercent, formatCompactZAR } from '../utils/format';
import { getUpcomingTasks, getOverdueTasks } from '../api/calendar';
import type { Task } from '../types/calendar';
import { PRIORITY_COLORS, STATUS_COLORS } from '../types/calendar';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, projectsData] = await Promise.all([
        getDashboardStats(),
        getProjects(),
      ]);
      setStats(statsData);
      setProjects(projectsData);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      // Use empty defaults when API is unavailable
      setStats({ totalProjects: 0, totalCapexBudget: 0, avgIrr: null, bestNpvProject: null });
      setProjects([]);
    } finally {
      setLoading(false);
    }
    getUpcomingTasks(7).then(setUpcomingTasks).catch(() => {});
    getOverdueTasks().then(setOverdueTasks).catch(() => {});
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (data: CreateProjectPayload) => {
    try {
      const project = await createProject(data);
      setShowModal(false);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Failed to create project. Ensure the API is running.');
    }
  };

  const recentProjects = projects.slice(0, 5);

  const statusColors: Record<string, string> = {
    draft: 'bg-stone-100 text-stone-600',
    evaluating: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-600',
    completed: 'bg-blue-100 text-blue-700',
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Dashboard</h1>
          <p className="text-sm text-stone-500">Capital expenditure overview for Cloudskraal Boerderye</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 transition-colors shadow-sm"
        >
          <Plus size={18} />
          New Project
        </button>
      </div>

      {/* Metric cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-stone-200 rounded-xl p-5 animate-pulse">
              <div className="h-3 bg-stone-200 rounded w-20 mb-3" />
              <div className="h-6 bg-stone-200 rounded w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Total Projects"
            value={stats?.totalProjects?.toString() || '0'}
            icon={FolderOpen}
          />
          <MetricCard
            label="Total CapEx Budget"
            value={formatCompactZAR(stats?.totalCapexBudget || 0)}
            icon={DollarSign}
          />
          <MetricCard
            label="Average IRR"
            value={stats?.avgIrr != null ? formatPercent(stats.avgIrr) : '--'}
            icon={TrendingUp}
            trend={stats?.avgIrr != null && stats.avgIrr > 0.10 ? 'up' : 'neutral'}
          />
          <MetricCard
            label="Best NPV Project"
            value={
              stats?.bestNpvProject
                ? formatCompactZAR(stats.bestNpvProject.npv)
                : '--'
            }
            icon={Award}
            subtitle={stats?.bestNpvProject?.name}
          />
        </div>
      )}

      {/* Charts */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {/* Budget by Type */}
          {(() => {
            const typeMap: Record<string, number> = {};
            projects.forEach((p) => {
              typeMap[p.type] = (typeMap[p.type] || 0) + p.initialOutlay;
            });
            const budgetByType = Object.entries(typeMap)
              .map(([type, total]) => ({
                type: type.charAt(0).toUpperCase() + type.slice(1),
                total: Math.round(total / 1_000_000 * 10) / 10,
              }))
              .sort((a, b) => b.total - a.total);
            return (
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-stone-700 mb-4">Budget by Type (R millions)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={budgetByType} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#78716c' }} />
                    <YAxis dataKey="type" type="category" tick={{ fontSize: 12, fill: '#78716c' }} width={90} />
                    <Tooltip
                      formatter={(value: number) => [`R ${value}M`, 'CapEx']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e7e5e4', fontSize: '13px' }}
                    />
                    <Bar dataKey="total" fill="#047857" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* Top 10 NPV Ranking */}
          {(() => {
            const TYPE_COLORS: Record<string, string> = {
              equipment: '#047857',
              infrastructure: '#0369a1',
              land: '#b45309',
              livestock: '#15803d',
              irrigation: '#0ea5e9',
              solar: '#eab308',
              storage: '#6366f1',
              vehicle: '#dc2626',
              other: '#78716c',
            };
            const topNpv = projects
              .filter((p) => p.bestNpv != null)
              .sort((a, b) => (b.bestNpv ?? 0) - (a.bestNpv ?? 0))
              .slice(0, 10)
              .map((p) => ({
                name: p.name.length > 25 ? p.name.slice(0, 22) + '...' : p.name,
                npv: Math.round((p.bestNpv ?? 0) / 1_000),
                type: p.type,
              }));
            if (topNpv.length === 0) return null;
            return (
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-stone-700 mb-4">Top 10 NPV Ranking (R thousands)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topNpv} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#78716c' }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#78716c' }} width={140} />
                    <Tooltip
                      formatter={(value: number) => [`R ${value}K`, 'NPV']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e7e5e4', fontSize: '13px' }}
                    />
                    <Bar dataKey="npv" radius={[0, 6, 6, 0]}>
                      {topNpv.map((entry, index) => (
                        <Cell key={index} fill={TYPE_COLORS[entry.type] || '#78716c'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tier Budget Summary */}
      {!loading && projects.length > 0 && (() => {
        const TIER_CONFIG = {
          tier1: { label: 'Must-do 2026', color: 'bg-red-50 border-red-200', textColor: 'text-red-700', badgeColor: 'bg-red-100 text-red-700' },
          tier2: { label: 'Should-do 2026–27', color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700', badgeColor: 'bg-blue-100 text-blue-700' },
          tier3: { label: 'Nice-to-have', color: 'bg-stone-50 border-stone-200', textColor: 'text-stone-600', badgeColor: 'bg-stone-100 text-stone-600' },
        } as const;
        const tiers = (['tier1', 'tier2', 'tier3'] as const).map(tier => {
          const tierProjects = projects.filter(p => p.priority === tier);
          const totalBudget = tierProjects.reduce((sum, p) => sum + p.initialOutlay, 0);
          const totalNpv = tierProjects.reduce((sum, p) => sum + (p.bestNpv ?? 0), 0);
          const config = TIER_CONFIG[tier];
          return { tier, ...config, count: tierProjects.length, totalBudget, totalNpv, projects: tierProjects };
        });
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            {tiers.map(t => (
              <div key={t.tier} className={`border rounded-xl p-5 shadow-sm ${t.color}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.badgeColor}`}>{t.label}</span>
                  <span className="text-xs text-stone-500">{t.count} projects</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-stone-500">Budget</p>
                    <p className={`text-lg font-bold ${t.textColor}`}>{formatCompactZAR(t.totalBudget)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-stone-500">Total NPV</p>
                    <p className={`text-lg font-bold ${t.totalNpv >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCompactZAR(t.totalNpv)}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {t.projects.slice(0, 4).map(p => (
                    <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between text-xs hover:bg-white/50 rounded px-1.5 py-1 transition-colors">
                      <span className="text-stone-700 truncate mr-2">{p.name}</span>
                      <span className="text-stone-500 whitespace-nowrap">{formatCompactZAR(p.initialOutlay)}</span>
                    </Link>
                  ))}
                  {t.projects.length > 4 && (
                    <p className="text-[10px] text-stone-400 pl-1.5">+{t.projects.length - 4} more</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Tasks Section */}
      {(upcomingTasks.length > 0 || overdueTasks.length > 0) && (() => {
        // Helper: format a due_date string into a day label
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        function dayLabel(dateStr: string): string {
          const d = new Date(dateStr);
          d.setHours(0, 0, 0, 0);
          const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
          if (diff === 0) return 'Today';
          if (diff === 1) return 'Tomorrow';
          return d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' });
        }

        function formatDueDate(dateStr: string): string {
          return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
        }

        const TASK_TYPE_ICONS: Record<string, React.ReactNode> = {
          scheduled: <CalendarDays size={13} className="text-stone-400" />,
          triggered: <AlertTriangle size={13} className="text-amber-400" />,
          dependent: <Clock size={13} className="text-blue-400" />,
          manual: <Clock size={13} className="text-stone-400" />,
        };

        // Group upcoming tasks by day label (max 10 shown)
        const capped = upcomingTasks.slice(0, 10);
        const groups: { label: string; tasks: Task[] }[] = [];
        for (const task of capped) {
          if (!task.due_date) continue;
          const label = dayLabel(task.due_date);
          const existing = groups.find(g => g.label === label);
          if (existing) {
            existing.tasks.push(task);
          } else {
            groups.push({ label, tasks: [task] });
          }
        }

        return (
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm mb-6">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-emerald-700" />
                <h2 className="text-base font-semibold text-stone-800">Upcoming Tasks</h2>
              </div>
              <Link
                to="/calendar/tasks"
                className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-800 font-medium"
              >
                View all in Calendar <ArrowRight size={14} />
              </Link>
            </div>

            {/* Overdue alert */}
            {overdueTasks.length > 0 && (
              <Link
                to="/calendar/tasks"
                className="flex items-center gap-3 px-5 py-3 bg-red-50 border-b border-red-100 hover:bg-red-100 transition-colors"
              >
                <AlertTriangle size={16} className="text-red-600 shrink-0" />
                <span className="text-sm font-semibold text-red-700">
                  {overdueTasks.length} overdue {overdueTasks.length === 1 ? 'task' : 'tasks'}
                </span>
                <div className="flex flex-wrap gap-x-4 gap-y-1 ml-1">
                  {overdueTasks.slice(0, 4).map(t => (
                    <span key={t.id} className="text-xs text-red-600">
                      {t.title}
                      {t.due_date && (
                        <span className="text-red-400 ml-1">· {formatDueDate(t.due_date)}</span>
                      )}
                      {t.enterprise && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-medium">{t.enterprise}</span>
                      )}
                    </span>
                  ))}
                  {overdueTasks.length > 4 && (
                    <span className="text-xs text-red-400">+{overdueTasks.length - 4} more</span>
                  )}
                </div>
              </Link>
            )}

            {/* Grouped upcoming tasks */}
            {groups.length > 0 ? (
              <div className="divide-y divide-stone-100">
                {groups.map(group => (
                  <div key={group.label}>
                    <div className="px-5 py-2 bg-stone-50 border-b border-stone-100">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">{group.label}</span>
                    </div>
                    {group.tasks.map(task => (
                      <Link
                        key={task.id}
                        to="/calendar/tasks"
                        className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50 transition-colors"
                      >
                        {/* Priority left border accent */}
                        <div
                          className="w-1 h-8 rounded-full shrink-0"
                          style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? '#9ca3af' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-800 truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.enterprise && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{task.enterprise}</span>
                            )}
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: `${STATUS_COLORS[task.status]}22`,
                                color: STATUS_COLORS[task.status] ?? '#9ca3af',
                              }}
                            >
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {TASK_TYPE_ICONS[task.type]}
                          {task.due_date && (
                            <span className="text-xs text-stone-400">{formatDueDate(task.due_date)}</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ))}
                {upcomingTasks.length > 10 && (
                  <div className="px-5 py-3 text-xs text-stone-400">
                    Showing 10 of {upcomingTasks.length} upcoming tasks.{' '}
                    <Link to="/calendar/tasks" className="text-emerald-700 hover:text-emerald-800 font-medium">
                      View all in Calendar →
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              upcomingTasks.length === 0 && overdueTasks.length === 0 && (
                <div className="px-5 py-6 text-sm text-stone-400 text-center">No tasks in the next 7 days.</div>
              )
            )}
          </div>
        );
      })()}

      {/* Recent projects */}
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h2 className="text-base font-semibold text-stone-800">Recent Projects</h2>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-800 font-medium"
          >
            View All <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-stone-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-stone-400 mb-3">No projects yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              <Plus size={16} />
              Create your first project
            </button>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <FolderOpen size={16} className="text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-800">{project.name}</p>
                    <p className="text-xs text-stone-500">
                      {project.type} &middot; {formatZAR(project.initialOutlay)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      statusColors[project.status] || 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {project.status}
                  </span>
                  {project.bestNpv != null && (
                    <span className="text-xs font-medium text-emerald-700">
                      NPV: {formatCompactZAR(project.bestNpv)}
                    </span>
                  )}
                  <ArrowRight size={14} className="text-stone-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <ProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
