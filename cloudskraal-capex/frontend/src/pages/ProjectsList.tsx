import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Filter, ArrowUpDown, FolderOpen } from 'lucide-react';
import ProjectModal from '../components/ProjectModal';
import { getProjects, createProject } from '../api/client';
import type { ProjectSummary, ProjectType, ProjectStatus, PriorityTier, CreateProjectPayload } from '../types';
import { formatZAR, formatPercent, formatCompactZAR } from '../utils/format';

const ALL_TYPES: ProjectType[] = [
  'equipment',
  'infrastructure',
  'land',
  'livestock',
  'irrigation',
  'solar',
  'storage',
  'vehicle',
  'other',
];

const ALL_STATUSES: ProjectStatus[] = ['draft', 'evaluating', 'approved', 'rejected', 'completed'];

const ALL_PRIORITIES: PriorityTier[] = ['tier1', 'tier2', 'tier3'];

const PRIORITY_LABELS: Record<PriorityTier, string> = {
  tier1: 'Must-do 2026',
  tier2: 'Should-do',
  tier3: 'Nice-to-have',
};

const PRIORITY_COLORS: Record<PriorityTier, string> = {
  tier1: 'bg-red-100 text-red-700',
  tier2: 'bg-blue-100 text-blue-700',
  tier3: 'bg-stone-100 text-stone-600',
};

const PRIORITY_ORDER: Record<PriorityTier, number> = {
  tier1: 0,
  tier2: 1,
  tier3: 2,
};

export default function ProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortField, setSortField] = useState<'name' | 'initialOutlay' | 'bestNpv' | 'bestIrr'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
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

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filtered = projects
    .filter((p) => filterType === 'all' || p.type === filterType)
    .filter((p) => filterStatus === 'all' || p.status === filterStatus)
    .filter((p) => filterPriority === 'all' || p.priority === filterPriority)
    .sort((a, b) => {
      // Always sort by priority first (tier1 first), then by selected field
      const priCmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      if (priCmp !== 0) return priCmp;
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'initialOutlay') cmp = a.initialOutlay - b.initialOutlay;
      else if (sortField === 'bestNpv') cmp = (a.bestNpv ?? -Infinity) - (b.bestNpv ?? -Infinity);
      else if (sortField === 'bestIrr') cmp = (a.bestIrr ?? -Infinity) - (b.bestIrr ?? -Infinity);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const statusColors: Record<string, string> = {
    draft: 'bg-stone-100 text-stone-600',
    evaluating: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-600',
    completed: 'bg-blue-100 text-blue-700',
  };

  const SortHeader = ({
    field,
    children,
    align = 'left',
  }: {
    field: typeof sortField;
    children: React.ReactNode;
    align?: string;
  }) => (
    <th
      className={`px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown
          size={12}
          className={sortField === field ? 'text-emerald-700' : 'text-stone-400'}
        />
      </span>
    </th>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Projects</h1>
          <p className="text-sm text-stone-500">Manage your capital expenditure projects</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 transition-colors"
        >
          <Plus size={18} />
          New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Filter size={16} className="text-stone-400" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All Types</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All Priorities</option>
          {ALL_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <span className="text-xs text-stone-400 ml-auto">
          {filtered.length} project{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-stone-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen size={40} className="mx-auto text-stone-300 mb-3" />
            <p className="text-sm text-stone-400 mb-3">No projects found</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              <Plus size={16} />
              Create a project
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#f3f4f3] border-b border-[#f3f4f3]">
                <SortHeader field="name">Name</SortHeader>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Type
                </th>
                <SortHeader field="initialOutlay" align="right">
                  Initial Outlay
                </SortHeader>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Status
                </th>
                <SortHeader field="bestNpv" align="right">
                  Best NPV
                </SortHeader>
                <SortHeader field="bestIrr" align="right">
                  Best IRR
                </SortHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((project) => (
                <tr key={project.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/projects/${project.id}`}
                        className="text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                      >
                        {project.name}
                      </Link>
                      {project.priority && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                            PRIORITY_COLORS[project.priority] || 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {PRIORITY_LABELS[project.priority] || project.priority}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                      {project.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-stone-700">
                    {formatZAR(project.initialOutlay)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        statusColors[project.status] || 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {project.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {project.bestNpv != null ? (
                      <span className={project.bestNpv >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                        {formatCompactZAR(project.bestNpv)}
                      </span>
                    ) : (
                      <span className="text-stone-400">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {project.bestIrr != null ? (
                      <span className={project.bestIrr >= 0.10 ? 'text-emerald-700' : 'text-amber-600'}>
                        {formatPercent(project.bestIrr)}
                      </span>
                    ) : (
                      <span className="text-stone-400">--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
