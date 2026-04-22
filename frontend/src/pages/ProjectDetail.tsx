import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Check, X } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Project, CashFlow, Scenario, ScenarioPayload, ProjectStatus } from '../types';
import {
  getProject,
  updateProject,
  setCashFlows as saveCashFlows,
  createScenario,
  updateScenario,
  deleteScenario,
} from '../api/client';
import { formatZAR, formatPercent, formatYears, formatCompactZAR } from '../utils/format';
import ZARInput from '../components/ZARInput';
import CashFlowEditor from '../components/CashFlowEditor';
import ScenarioEditor from '../components/ScenarioEditor';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toaster';

type Tab = 'overview' | 'cashflows' | 'scenarios';

const STATUS_OPTIONS: ProjectStatus[] = ['draft', 'evaluating', 'approved', 'rejected', 'completed'];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editingInfo, setEditingInfo] = useState(false);
  const [savingCashFlows, setSavingCashFlows] = useState(false);
  const [scenarioPendingDelete, setScenarioPendingDelete] = useState<string | null>(null);

  // Local cash flow state for editing
  const [localCashFlows, setLocalCashFlows] = useState<CashFlow[]>([]);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    initialOutlay: 0,
    usefulLifeYears: 10,
    salvageValue: 0,
    status: 'draft' as ProjectStatus,
  });

  const fetchProject = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getProject(id);
      setProject(data);
      setLocalCashFlows(data.cashFlows || []);
      setEditForm({
        name: data.name,
        description: data.description,
        initialOutlay: data.initialOutlay,
        usefulLifeYears: data.usefulLifeYears,
        salvageValue: data.salvageValue,
        status: data.status,
      });
    } catch (err) {
      console.error('Failed to fetch project:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleSaveInfo = async () => {
    if (!id) return;
    try {
      const updated = await updateProject(id, editForm);
      setProject(updated);
      setEditingInfo(false);
    } catch (err) {
      console.error('Failed to update project:', err);
      toast.show({ variant: 'error', message: 'Failed to save. Ensure the API is running.' });
    }
  };

  const handleSaveCashFlows = async () => {
    if (!id) return;
    setSavingCashFlows(true);
    try {
      const saved = await saveCashFlows(
        id,
        localCashFlows.map((cf) => ({
          year: cf.year,
          revenue: cf.revenue,
          operatingCosts: cf.operatingCosts,
        }))
      );
      setLocalCashFlows(saved);
      // Refresh the whole project to get updated scenario metrics
      await fetchProject();
    } catch (err) {
      console.error('Failed to save cash flows:', err);
      toast.show({ variant: 'error', message: 'Failed to save cash flows. Ensure the API is running.' });
    } finally {
      setSavingCashFlows(false);
    }
  };

  const handleAddScenario = async (data: ScenarioPayload) => {
    if (!id) return;
    try {
      await createScenario(id, data);
      await fetchProject();
    } catch (err) {
      console.error('Failed to add scenario:', err);
    }
  };

  const handleUpdateScenario = async (scenarioId: string, data: Partial<ScenarioPayload>) => {
    if (!id) return;
    try {
      await updateScenario(id, scenarioId, data);
      await fetchProject();
    } catch (err) {
      console.error('Failed to update scenario:', err);
    }
  };

  const handleDeleteScenario = (scenarioId: string) => {
    // Defers the actual deletion until the confirmation dialog resolves.
    setScenarioPendingDelete(scenarioId);
  };

  const confirmDeleteScenario = async () => {
    if (!id || !scenarioPendingDelete) return;
    const scenarioId = scenarioPendingDelete;
    setScenarioPendingDelete(null);
    try {
      await deleteScenario(id, scenarioId);
      await fetchProject();
    } catch (err) {
      console.error('Failed to delete scenario:', err);
      toast.show({ variant: 'error', message: 'Failed to delete scenario.' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-stone-200 rounded w-48 animate-pulse" />
        <div className="h-48 bg-stone-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-stone-500">Project not found</p>
        <Link to="/projects" className="text-sm text-emerald-700 hover:underline mt-2 inline-block">
          Back to projects
        </Link>
      </div>
    );
  }

  const scenarios: Scenario[] = project.scenarios || [];
  const scenarioChartData = scenarios
    .filter((s) => s.npv != null)
    .map((s) => ({
      name: s.name,
      NPV: Math.round((s.npv ?? 0) / 1000),
    }));

  const statusColors: Record<string, string> = {
    draft: 'bg-stone-100 text-stone-600',
    evaluating: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-600',
    completed: 'bg-blue-100 text-blue-700',
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'cashflows', label: 'Cash Flows' },
    { key: 'scenarios', label: 'Funding Scenarios' },
  ];

  return (
    <div>
      {/* Breadcrumb & header */}
      <div className="mb-6">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-2"
        >
          <ArrowLeft size={14} />
          Projects
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-stone-800">{project.name}</h1>
          <span
            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
              statusColors[project.status] || 'bg-stone-100 text-stone-600'
            }`}
          >
            {project.status}
          </span>
        </div>
        <p className="text-sm text-stone-500 mt-0.5">
          {project.type.charAt(0).toUpperCase() + project.type.slice(1)} &middot;{' '}
          {formatZAR(project.initialOutlay)}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#f3f4f3] mb-6">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-emerald-700 text-emerald-700'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Project info card */}
          <div className="bg-white rounded-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f3f4f3]">
              <h3 className="text-sm font-semibold text-stone-800">Project Information</h3>
              {editingInfo ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingInfo(false)}
                    className="text-stone-400 hover:text-stone-600"
                  >
                    <X size={16} />
                  </button>
                  <button
                    onClick={handleSaveInfo}
                    className="text-emerald-700 hover:text-emerald-800"
                  >
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingInfo(true)}
                  className="text-stone-400 hover:text-stone-600"
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] text-stone-500 uppercase tracking-wider mb-0.5">
                  Name
                </label>
                {editingInfo ? (
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                ) : (
                  <p className="text-sm font-medium text-stone-800">{project.name}</p>
                )}
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 uppercase tracking-wider mb-0.5">
                  Status
                </label>
                {editingInfo ? (
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value as ProjectStatus })
                    }
                    className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-medium text-stone-800">
                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 uppercase tracking-wider mb-0.5">
                  Initial Outlay
                </label>
                {editingInfo ? (
                  <ZARInput
                    value={editForm.initialOutlay}
                    onChange={(v) => setEditForm({ ...editForm, initialOutlay: v })}
                    className="w-full"
                  />
                ) : (
                  <p className="text-sm font-medium text-stone-800">
                    {formatZAR(project.initialOutlay)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 uppercase tracking-wider mb-0.5">
                  Useful Life
                </label>
                {editingInfo ? (
                  <input
                    type="number"
                    min={1}
                    value={editForm.usefulLifeYears}
                    onChange={(e) =>
                      setEditForm({ ...editForm, usefulLifeYears: parseInt(e.target.value) || 1 })
                    }
                    className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                ) : (
                  <p className="text-sm font-medium text-stone-800">
                    {project.usefulLifeYears} years
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 uppercase tracking-wider mb-0.5">
                  Salvage Value
                </label>
                {editingInfo ? (
                  <ZARInput
                    value={editForm.salvageValue}
                    onChange={(v) => setEditForm({ ...editForm, salvageValue: v })}
                    className="w-full"
                  />
                ) : (
                  <p className="text-sm font-medium text-stone-800">
                    {formatZAR(project.salvageValue)}
                  </p>
                )}
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[11px] text-stone-500 uppercase tracking-wider mb-0.5">
                  Description
                </label>
                {editingInfo ? (
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={2}
                    className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                ) : (
                  <p className="text-sm text-stone-700">{project.description || '--'}</p>
                )}
              </div>
            </div>
            {project.taxBenefit && (
              <div className="px-5 pb-5 -mt-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                  Tax Benefit: {project.taxBenefit}
                </span>
              </div>
            )}
          </div>

          {/* Scenario summary cards */}
          {scenarios.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-stone-700 mb-3">Scenario Summaries</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenarios.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white rounded-2xl p-4"
                  >
                    <h4 className="text-sm font-semibold text-stone-800 mb-3">{s.name}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-stone-500 uppercase">NPV</p>
                        <p
                          className={`text-sm font-bold ${
                            s.npv != null && s.npv >= 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {s.npv != null ? formatCompactZAR(s.npv) : '--'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-stone-500 uppercase">IRR</p>
                        <p className="text-sm font-bold text-amber-700">
                          {s.irr != null ? formatPercent(s.irr) : '--'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-stone-500 uppercase">Payback</p>
                        <p className="text-sm font-bold text-stone-700">
                          {s.paybackYears != null ? formatYears(s.paybackYears) : '--'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-stone-500 uppercase">WACC</p>
                        <p className="text-sm font-bold text-stone-700">
                          {s.wacc != null ? formatPercent(s.wacc) : '--'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NPV comparison chart */}
          {scenarioChartData.length > 0 && (
            <div className="bg-white rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-stone-700 mb-4">
                NPV Comparison (R thousands)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={scenarioChartData} barSize={60}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#78716c' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#78716c' }} />
                  <Tooltip
                    formatter={(value) => [`R ${value}K`, 'NPV']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e7e5e4',
                      fontSize: '13px',
                    }}
                  />
                  <Bar dataKey="NPV" fill="#047857" radius={[6, 6, 0, 0]} maxBarSize={80} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {scenarios.length === 0 && (
            <div className="text-center py-8 text-stone-400 text-sm">
              Add cash flows and funding scenarios to see metrics here.
            </div>
          )}
        </div>
      )}

      {activeTab === 'cashflows' && (
        <CashFlowEditor
          cashFlows={localCashFlows}
          onChange={setLocalCashFlows}
          onSave={handleSaveCashFlows}
          saving={savingCashFlows}
        />
      )}

      {activeTab === 'scenarios' && (
        <ScenarioEditor
          projectId={project.id}
          scenarios={scenarios}
          onAdd={handleAddScenario}
          onUpdate={handleUpdateScenario}
          onDelete={handleDeleteScenario}
          onRefresh={fetchProject}
        />
      )}

      <ConfirmDialog
        open={scenarioPendingDelete !== null}
        title="Delete scenario?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteScenario}
        onCancel={() => setScenarioPendingDelete(null)}
      />
    </div>
  );
}
