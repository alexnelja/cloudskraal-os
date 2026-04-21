import { useState, useEffect } from 'react';
import { ChevronDown, X, GitCompare } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import type { ProjectSummary, Project, Scenario } from '../types';
import { getProjects, getProject } from '../api/client';
import { formatZAR, formatPercent, formatYears, formatCompactZAR } from '../utils/format';
import FactSheetButton from '../components/FactSheetButton';

interface Selection {
  projectId: string;
  scenarioId: string;
}

const COLORS = ['#047857', '#d97706', '#7c3aed', '#dc2626'];

export default function CompareProjects() {
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [loadedProjects, setLoadedProjects] = useState<Record<string, Project>>({});
  const [selections, setSelections] = useState<Selection[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchList = async () => {
      try {
        const data = await getProjects();
        setProjectList(data);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
        setProjectList([]);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, []);

  const loadProject = async (projectId: string) => {
    if (loadedProjects[projectId]) return;
    try {
      const data = await getProject(projectId);
      setLoadedProjects((prev) => ({ ...prev, [projectId]: data }));
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  };

  const addSelection = () => {
    if (selections.length >= 4) return;
    setSelections([...selections, { projectId: '', scenarioId: '' }]);
  };

  const updateSelection = async (index: number, field: 'projectId' | 'scenarioId', value: string) => {
    const updated = [...selections];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'projectId') {
      updated[index].scenarioId = '';
      if (value) await loadProject(value);
    }
    setSelections(updated);
  };

  const removeSelection = (index: number) => {
    setSelections(selections.filter((_, i) => i !== index));
  };

  // Build comparison data
  const comparisonRows: {
    project: Project;
    scenario: Scenario;
    color: string;
  }[] = [];

  selections.forEach((sel, i) => {
    const project = loadedProjects[sel.projectId];
    const scenario = project?.scenarios?.find((s) => s.id === sel.scenarioId);
    if (project && scenario) {
      comparisonRows.push({ project, scenario, color: COLORS[i % COLORS.length] });
    }
  });

  // Grouped bar chart data
  const barData = comparisonRows.map((row) => ({
    name: `${row.project.name}\n(${row.scenario.name})`,
    shortName: row.project.name.slice(0, 15),
    NPV: Math.round((row.scenario.npv ?? 0) / 1000),
    IRR: row.scenario.irr ?? 0,
    Payback: row.scenario.paybackYears ?? 0,
    PI: row.scenario.profitabilityIndex ?? 0,
  }));

  // Radar chart data - normalize values to 0-100 scale
  const radarMetrics = ['NPV', 'IRR', 'Payback', 'PI', 'WACC'] as const;
  const maxValues = {
    NPV: Math.max(...comparisonRows.map((r) => Math.abs(r.scenario.npv ?? 0)), 1),
    IRR: Math.max(...comparisonRows.map((r) => r.scenario.irr ?? 0), 1),
    Payback: Math.max(...comparisonRows.map((r) => r.scenario.paybackYears ?? 0), 1),
    PI: Math.max(...comparisonRows.map((r) => r.scenario.profitabilityIndex ?? 0), 1),
    WACC: Math.max(...comparisonRows.map((r) => r.scenario.wacc ?? 0), 1),
  };

  const radarData = radarMetrics.map((metric) => {
    const point: Record<string, string | number> = { metric };
    comparisonRows.forEach((row, i) => {
      let val = 0;
      if (metric === 'NPV') val = ((row.scenario.npv ?? 0) / maxValues.NPV) * 100;
      else if (metric === 'IRR') val = ((row.scenario.irr ?? 0) / maxValues.IRR) * 100;
      else if (metric === 'Payback')
        val = (1 - (row.scenario.paybackYears ?? 0) / maxValues.Payback) * 100; // invert: lower is better
      else if (metric === 'PI')
        val = ((row.scenario.profitabilityIndex ?? 0) / maxValues.PI) * 100;
      else if (metric === 'WACC') val = (1 - (row.scenario.wacc ?? 0) / maxValues.WACC) * 100; // invert
      point[`project${i}`] = Math.max(0, Math.round(val));
    });
    return point;
  });

  return (
    <div>
      <PageHeader
        icon={<GitCompare size={20} />}
        title="Compare Projects"
        subtitle="Select 2–4 projects and scenarios to compare side by side"
      />
      <div className="h-6" />

      {/* Selection area */}
      <div className="bg-white rounded-2xl p-5 mb-6">
        <div className="space-y-3">
          {selections.map((sel, index) => {
            const project = loadedProjects[sel.projectId];
            const scenarios = project?.scenarios || [];
            return (
              <div key={index} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <select
                  value={sel.projectId}
                  onChange={(e) => updateSelection(index, 'projectId', e.target.value)}
                  className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select a project...</option>
                  {projectList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCompactZAR(p.initialOutlay)})
                    </option>
                  ))}
                </select>
                <select
                  value={sel.scenarioId}
                  onChange={(e) => updateSelection(index, 'scenarioId', e.target.value)}
                  disabled={!sel.projectId || scenarios.length === 0}
                  className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  <option value="">Select a scenario...</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeSelection(index)}
                  className="text-stone-400 hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
        {selections.length < 4 && (
          <button
            onClick={addSelection}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            <ChevronDown size={14} />
            Add project to compare
          </button>
        )}
      </div>

      {/* Comparison content */}
      {comparisonRows.length >= 2 && (
        <div className="space-y-6">
          {/* Side-by-side comparison table */}
          <div className="bg-white rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f3f4f3] border-b border-[#f3f4f3]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Metric
                  </th>
                  {comparisonRows.map((row, i) => (
                    <th
                      key={i}
                      className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: row.color }}
                    >
                      <div>{row.project.name}</div>
                      <div className="font-normal text-stone-400 normal-case">
                        {row.scenario.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <tr>
                  <td className="px-4 py-3 text-sm text-stone-600">Initial Outlay</td>
                  {comparisonRows.map((row, i) => (
                    <td key={i} className="px-4 py-3 text-sm font-medium text-stone-800 text-right">
                      {formatZAR(row.project.initialOutlay)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-stone-600">WACC</td>
                  {comparisonRows.map((row, i) => (
                    <td key={i} className="px-4 py-3 text-sm font-medium text-stone-800 text-right">
                      {row.scenario.wacc != null ? formatPercent(row.scenario.wacc) : '--'}
                    </td>
                  ))}
                </tr>
                <tr className="bg-emerald-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-stone-700">NPV</td>
                  {comparisonRows.map((row, i) => (
                    <td
                      key={i}
                      className={`px-4 py-3 text-sm font-bold text-right ${
                        row.scenario.npv != null && row.scenario.npv >= 0
                          ? 'text-emerald-700'
                          : 'text-red-600'
                      }`}
                    >
                      {row.scenario.npv != null ? formatZAR(row.scenario.npv) : '--'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-stone-700">IRR</td>
                  {comparisonRows.map((row, i) => (
                    <td key={i} className="px-4 py-3 text-sm font-bold text-amber-700 text-right">
                      {row.scenario.irr != null ? formatPercent(row.scenario.irr) : '--'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-stone-600">Payback Period</td>
                  {comparisonRows.map((row, i) => (
                    <td key={i} className="px-4 py-3 text-sm font-medium text-stone-800 text-right">
                      {row.scenario.paybackYears != null
                        ? formatYears(row.scenario.paybackYears)
                        : '--'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-stone-600">Profitability Index</td>
                  {comparisonRows.map((row, i) => (
                    <td key={i} className="px-4 py-3 text-sm font-medium text-stone-800 text-right">
                      {row.scenario.profitabilityIndex != null
                        ? row.scenario.profitabilityIndex.toFixed(2)
                        : '--'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-stone-600">Monthly Payment</td>
                  {comparisonRows.map((row, i) => (
                    <td key={i} className="px-4 py-3 text-sm font-medium text-stone-800 text-right">
                      {row.scenario.monthlyPayment != null
                        ? formatZAR(row.scenario.monthlyPayment)
                        : '--'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-stone-600">Total Interest</td>
                  {comparisonRows.map((row, i) => (
                    <td key={i} className="px-4 py-3 text-sm font-medium text-red-600 text-right">
                      {row.scenario.totalInterest != null
                        ? formatZAR(row.scenario.totalInterest)
                        : '--'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-stone-600">Fact Sheet</td>
                  {comparisonRows.map((row, i) => (
                    <td key={i} className="px-4 py-3 text-right">
                      <FactSheetButton
                        projectId={row.project.id}
                        scenarioId={row.scenario.id}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grouped bar chart */}
            <div className="bg-white rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-stone-700 mb-4">Metric Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e7e5e4',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="NPV" name="NPV (R'000)" fill="#047857" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="IRR" name="IRR (%)" fill="#d97706" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="PI" name="Profitability Index" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Radar chart */}
            <div className="bg-white rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-stone-700 mb-4">
                Performance Radar (normalised)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e7e5e4" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#78716c' }} />
                  <PolarRadiusAxis tick={{ fontSize: 10, fill: '#a8a29e' }} domain={[0, 100]} />
                  {comparisonRows.map((row, i) => (
                    <Radar
                      key={i}
                      name={row.project.name}
                      dataKey={`project${i}`}
                      stroke={row.color}
                      fill={row.color}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {comparisonRows.length < 2 && selections.length > 0 && (
        <div className="text-center py-12 text-stone-400 text-sm">
          Select at least 2 projects with scenarios to see the comparison.
        </div>
      )}

      {selections.length === 0 && (
        <div className="text-center py-16">
          <p className="text-stone-400 text-sm mb-3">
            No projects selected. Add projects above to start comparing.
          </p>
          <button
            onClick={addSelection}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            Add a project
          </button>
        </div>
      )}
    </div>
  );
}
