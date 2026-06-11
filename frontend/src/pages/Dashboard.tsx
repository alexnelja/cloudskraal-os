import { useState, useEffect, useRef, useCallback } from 'react';
import DataQualityCard from '../components/DataQualityCard';
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
  ShieldAlert,
  Sparkles,
  CircleDot,
  X,
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
import EnterprisePriceCurve from '../components/EnterprisePriceCurve';
import WeatherForecastPanel from '../components/WeatherForecastPanel';
import ProjectModal from '../components/ProjectModal';
import { useToast } from '../components/ui/Toaster';
import { StatusCycle } from '../components/EditableCell';
import { getProjects, getDashboardStats, createProject, updateProject } from '../api/client';
import type { ProjectSummary, DashboardStats, CreateProjectPayload } from '../types';
import { formatZAR, formatPercent, formatCompactZAR } from '../utils/format';
import { getUpcomingTasks, getOverdueTasks } from '../api/calendar';
import type { Task } from '../types/calendar';
import { PRIORITY_COLORS, STATUS_COLORS } from '../types/calendar';

interface ProjectPopup {
  project: ProjectSummary;
  position: { x: number; y: number };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [projectPopup, setProjectPopup] = useState<ProjectPopup | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Close popup on click outside or ESC
  const handleClosePopup = useCallback(() => setProjectPopup(null), []);

  useEffect(() => {
    if (!projectPopup) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClosePopup(); };
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) handleClosePopup();
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => { window.removeEventListener('keydown', handleKey); window.removeEventListener('mousedown', handleClick); };
  }, [projectPopup, handleClosePopup]);

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
      toast.show({
        variant: 'error',
        message: 'Failed to create project. Ensure the API is running.',
      });
    }
  };

  const recentProjects = projects.slice(0, 5);

  const handleBudgetBarClick = (data: any) => {
    if (data?.activePayload?.[0]) {
      const type = data.activePayload[0].payload.type?.toLowerCase();
      navigate(`/projects?type=${type}`);
    }
  };

  const handleNpvBarClick = (data: Record<string, unknown> | null) => {
    const payload = data as { activePayload?: { payload: { name: string; type: string } }[] } | null;
    if (payload?.activePayload?.[0]) {
      const clickedName = payload.activePayload[0].payload.name;
      const fullName = clickedName.endsWith('...') ? clickedName.slice(0, -3) : clickedName;
      const project = projects.find(p => p.name.startsWith(fullName));
      if (project) {
        // Position popup centrally since we don't have exact click coords from recharts
        const x = Math.min(window.innerWidth / 2 - 160, window.innerWidth - 340);
        const y = Math.min(window.innerHeight / 3, window.innerHeight - 320);
        setProjectPopup({ project, position: { x, y } });
      }
    }
  };

  const openProjectPopup = (project: ProjectSummary, e: React.MouseEvent) => {
    const x = Math.min(e.clientX, window.innerWidth - 340);
    const y = Math.min(e.clientY, window.innerHeight - 320);
    setProjectPopup({ project, position: { x, y } });
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-stone-500/10 text-stone-600',
    evaluating: 'bg-amber-500/10 text-amber-700',
    approved: 'bg-emerald-500/10 text-emerald-700',
    rejected: 'bg-red-500/10 text-red-600',
    completed: 'bg-blue-500/10 text-blue-700',
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--md-sys-color-on-surface)]">Dashboard</h1>
          <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Capital expenditure overview for Cloudskraal Boerderye</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="md-label-large md-shape-medium inline-flex items-center gap-2 px-4 py-2.5 md-duration-short3 md-ease-standard transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)',
          }}
        >
          <Plus size={18} aria-hidden="true" />
          New Project
        </button>
      </div>

      {/* Metric cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse">
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

      {/* COP data quality (2h.3) */}
      <div className="mb-8">
        <DataQualityCard year={2026} />
      </div>

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
              <div className="bg-white rounded-2xl p-5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--md-sys-color-on-surface-variant)] mb-4">Budget by Type (R millions)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={budgetByType} layout="vertical" margin={{ left: 20 }} onClick={handleBudgetBarClick}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#bdc9c1" strokeOpacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#6e7a73' }} />
                    <YAxis dataKey="type" type="category" tick={{ fontSize: 12, fill: '#6e7a73' }} width={90} />
                    <Tooltip
                      formatter={(value) => [`R ${value}M`, 'CapEx']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid rgba(189,201,193,0.15)', fontSize: '13px' }}
                    />
                    <Bar dataKey="total" fill="#047857" radius={[0, 6, 6, 0]} style={{ cursor: 'pointer' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* Top 10 NPV Ranking */}
          {(() => {
            // TYPE_COLORS: intentional data-viz palette for category
            // differentiation — same rationale as ENTERPRISE_COLORS in
            // types/farm. Do not tokenise.
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
              <div className="bg-white rounded-2xl p-5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--md-sys-color-on-surface-variant)] mb-4">Top 10 NPV Ranking (R thousands)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topNpv} layout="vertical" margin={{ left: 20 }} onClick={handleNpvBarClick}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#bdc9c1" strokeOpacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#6e7a73' }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#6e7a73' }} width={140} />
                    <Tooltip
                      formatter={(value) => [`R ${value}K`, 'NPV']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid rgba(189,201,193,0.15)', fontSize: '13px' }}
                    />
                    <Bar dataKey="npv" radius={[0, 6, 6, 0]} style={{ cursor: 'pointer' }}>
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
        const thisYear = new Date().getUTCFullYear();
        const TIER_CONFIG = {
          tier1: { label: `Must-do ${thisYear}`, borderColor: 'border-red-500', textColor: 'text-red-600', icon: ShieldAlert },
          tier2: { label: `Should-do ${thisYear}-${String(thisYear + 1).slice(-2)}`, borderColor: 'border-violet-500', textColor: 'text-violet-600', icon: Sparkles },
          tier3: { label: 'Nice-to-have', borderColor: 'border-stone-400', textColor: 'text-stone-500', icon: CircleDot },
        } as const;
        const tiers = (['tier1', 'tier2', 'tier3'] as const).map(tier => {
          const tierProjects = projects.filter(p => p.priority === tier);
          const totalBudget = tierProjects.reduce((sum, p) => sum + p.initialOutlay, 0);
          const totalNpv = tierProjects.reduce((sum, p) => sum + (p.bestNpv ?? 0), 0);
          const config = TIER_CONFIG[tier];
          return { tier, ...config, count: tierProjects.length, totalBudget, totalNpv, projects: tierProjects };
        });
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {tiers.map(t => {
              const TierIcon = t.icon;
              return (
                <div key={t.tier} className={`bg-white p-5 rounded-2xl border-l-4 ${t.borderColor}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[11px] font-bold uppercase tracking-[0.05em] ${t.textColor}`}>{t.label}</span>
                    <TierIcon size={16} className={t.textColor} />
                  </div>
                  <p className="text-lg font-bold text-[var(--md-sys-color-on-surface)]">{formatCompactZAR(t.totalBudget)}</p>
                  <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5">{t.count} projects &middot; NPV: {formatCompactZAR(t.totalNpv)}</p>
                  <div className="mt-3 space-y-1">
                    {t.projects.slice(0, 4).map(p => (
                      <div key={p.id} className="w-full flex items-center gap-1.5 text-xs hover:bg-[var(--md-sys-color-surface-container)] rounded px-1.5 py-1 transition-colors text-left">
                        <span onClick={(e) => { e.stopPropagation(); }}>
                          <StatusCycle
                            value={p.status}
                            options={['draft', 'evaluating', 'approved']}
                            colors={{ draft: '#78716c', evaluating: '#d97706', approved: '#047857' }}
                            onSave={(val) => {
                              setProjects(prev => prev.map(proj => proj.id === p.id ? { ...proj, status: val as typeof proj.status } : proj));
                              updateProject(p.id, { status: val as 'draft' | 'evaluating' | 'approved' }).catch(() => fetchData());
                            }}
                          />
                        </span>
                        <button onClick={(e) => openProjectPopup(p, e)} className="flex-1 flex items-center justify-between min-w-0">
                          <span className="text-[var(--md-sys-color-on-surface)] truncate mr-2">{p.name}</span>
                          <span className="text-[var(--md-sys-color-on-surface-variant)] whitespace-nowrap">{formatCompactZAR(p.initialOutlay)}</span>
                        </button>
                      </div>
                    ))}
                    {t.projects.length > 4 && (
                      <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] pl-1.5">+{t.projects.length - 4} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Price forecasts */}
      <div className="mb-6">
        <EnterprisePriceCurve enterprise="rooibos" />
      </div>

      {/* Weather forecast */}
      <div className="mb-6">
        <WeatherForecastPanel />
      </div>

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
          scheduled: <CalendarDays size={13} className="text-[var(--md-sys-color-on-surface-variant)]" />,
          triggered: <AlertTriangle size={13} className="text-amber-400" />,
          dependent: <Clock size={13} className="text-blue-400" />,
          manual: <Clock size={13} className="text-[var(--md-sys-color-on-surface-variant)]" />,
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
          <div className="bg-white rounded-2xl mb-6">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-[var(--md-sys-color-primary)]" />
                <h2 className="text-base font-semibold text-[var(--md-sys-color-on-surface)]">Upcoming Tasks</h2>
              </div>
              <Link
                to="/calendar/tasks"
                className="inline-flex items-center gap-1 text-sm text-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-primary)] hover:opacity-80 font-medium"
              >
                View all in Calendar <ArrowRight size={14} />
              </Link>
            </div>

            {/* Overdue alert */}
            {overdueTasks.length > 0 && (
              <Link
                to="/calendar/tasks"
                className="flex items-center gap-3 px-5 py-3 bg-[var(--md-sys-color-error)]/10 text-[var(--md-sys-color-error)] rounded-2xl hover:bg-[var(--md-sys-color-error)]/15 transition-colors mx-4 my-2"
              >
                <AlertTriangle size={16} className="text-[var(--md-sys-color-error)] shrink-0" />
                <span className="text-sm font-semibold text-[var(--md-sys-color-error)]">
                  {overdueTasks.length} overdue {overdueTasks.length === 1 ? 'task' : 'tasks'}
                </span>
                <div className="flex flex-wrap gap-x-4 gap-y-1 ml-1">
                  {overdueTasks.slice(0, 4).map(t => (
                    <span key={t.id} className="text-xs text-[var(--md-sys-color-error)]">
                      {t.title}
                      {t.due_date && (
                        <span className="text-[var(--md-sys-color-error)]/70 ml-1">&middot; {formatDueDate(t.due_date)}</span>
                      )}
                      {t.enterprise && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[var(--md-sys-color-error)]/10 text-[var(--md-sys-color-error)] text-[10px] font-medium">{t.enterprise}</span>
                      )}
                    </span>
                  ))}
                  {overdueTasks.length > 4 && (
                    <span className="text-xs text-[var(--md-sys-color-error)]/70">+{overdueTasks.length - 4} more</span>
                  )}
                </div>
              </Link>
            )}

            {/* Grouped upcoming tasks */}
            {groups.length > 0 ? (
              <div className="space-y-1 px-4 pb-4">
                {groups.map(group => (
                  <div key={group.label}>
                    <div className="px-1 py-2 bg-[var(--md-sys-color-surface-container)] rounded-lg mt-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--md-sys-color-on-surface-variant)] px-2">{group.label}</span>
                    </div>
                    {group.tasks.map(task => (
                      <Link
                        key={task.id}
                        to="/calendar/tasks"
                        className="flex items-center gap-3 px-3 py-3 hover:bg-[var(--md-sys-color-surface-container)] transition-colors rounded-xl"
                      >
                        {/* Priority left border accent */}
                        <div
                          className="w-1 h-10 rounded-full shrink-0"
                          style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? '#9ca3af' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--md-sys-color-on-surface)] truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.enterprise && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">{task.enterprise}</span>
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
                            <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{formatDueDate(task.due_date)}</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ))}
                {upcomingTasks.length > 10 && (
                  <div className="px-5 py-3 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    Showing 10 of {upcomingTasks.length} upcoming tasks.{' '}
                    <Link to="/calendar/tasks" className="text-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-primary)] hover:opacity-80 font-medium">
                      View all in Calendar &rarr;
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              upcomingTasks.length === 0 && overdueTasks.length === 0 && (
                <div className="px-5 py-6 text-sm text-[var(--md-sys-color-on-surface-variant)] text-center">No tasks in the next 7 days.</div>
              )
            )}
          </div>
        );
      })()}

      {/* Recent projects */}
      <div className="bg-white rounded-2xl">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--md-sys-color-on-surface)]">Recent Projects</h2>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-sm text-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-primary)] hover:opacity-80 font-medium"
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
            <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mb-3">No projects yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-primary)] hover:opacity-80"
            >
              <Plus size={16} />
              Create your first project
            </button>
          </div>
        ) : (
          <div className="px-2 pb-2">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between px-3 py-4 hover:bg-[var(--md-sys-color-surface-container)] rounded-xl transition-colors"
              >
                <div>
                  <p className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">{project.name}</p>
                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    <span className={`inline-block mr-2 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      statusColors[project.status] || 'bg-stone-500/10 text-stone-600'
                    }`}>
                      {project.status}
                    </span>
                    {project.type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">{formatZAR(project.initialOutlay)}</p>
                  {project.bestNpv != null && (
                    <p className="text-xs text-[var(--md-sys-color-primary)] font-medium">
                      NPV: {formatCompactZAR(project.bestNpv)}
                    </p>
                  )}
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

      {/* Project Detail Popup */}
      {projectPopup && (
        <div
          ref={popupRef}
          className="fixed bg-white rounded-2xl shadow-2xl p-5 w-[320px] z-50 animate-in fade-in duration-200"
          style={{
            left: `${projectPopup.position.x}px`,
            top: `${projectPopup.position.y}px`,
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] leading-tight pr-2">{projectPopup.project.name}</h3>
            <button onClick={handleClosePopup} className="p-0.5 text-stone-400 hover:text-stone-600 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 capitalize">{projectPopup.project.type}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[projectPopup.project.status] || 'bg-stone-500/10 text-stone-600'}`}>{projectPopup.project.status}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/10 text-violet-700">{projectPopup.project.priority}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mb-0.5">NPV</p>
              <p className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">{projectPopup.project.bestNpv != null ? formatCompactZAR(projectPopup.project.bestNpv) : '--'}</p>
            </div>
            <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mb-0.5">IRR</p>
              <p className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">{projectPopup.project.bestIrr != null ? formatPercent(projectPopup.project.bestIrr) : '--'}</p>
            </div>
            <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mb-0.5">Initial Outlay</p>
              <p className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">{formatCompactZAR(projectPopup.project.initialOutlay)}</p>
            </div>
            <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mb-0.5">Priority</p>
              <p className="text-sm font-bold text-[var(--md-sys-color-on-surface)] capitalize">{projectPopup.project.priority.replace('tier', 'Tier ')}</p>
            </div>
          </div>
          <Link
            to={`/projects/${projectPopup.project.id}`}
            onClick={handleClosePopup}
            className="md-label-large md-shape-medium block w-full text-center py-2 md-duration-short3 md-ease-standard transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
            }}
          >
            View Details &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
