import { useState } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { Scenario, ScenarioPayload, RepaymentType } from '../types';
import { formatZAR, formatPercent, formatYears, formatCompactZAR } from '../utils/format';
import FactSheetButton from './FactSheetButton';

interface ScenarioEditorProps {
  projectId: string;
  scenarios: Scenario[];
  onAdd: (data: ScenarioPayload) => void;
  onUpdate: (scenarioId: string, data: Partial<ScenarioPayload>) => void;
  onDelete: (scenarioId: string) => void;
  onRefresh: () => void;
}

const REPAYMENT_TYPES: { value: RepaymentType; label: string }[] = [
  { value: 'equal_installments', label: 'Equal Installments' },
  { value: 'equal_principal', label: 'Equal Principal' },
  { value: 'bullet', label: 'Bullet Payment' },
];

function ScenarioCard({
  scenario,
  projectId,
  onUpdate,
  onDelete,
}: {
  scenario: Scenario;
  projectId: string;
  onUpdate: (data: Partial<ScenarioPayload>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: scenario.name,
    debtPercent: scenario.debtPercent,
    equityPercent: scenario.equityPercent,
    interestRate: scenario.interestRate,
    loanTermYears: scenario.loanTermYears,
    equityCostPercent: scenario.equityCostPercent,
    repaymentType: scenario.repaymentType,
  });

  const handleSave = () => {
    onUpdate(form);
    setEditing(false);
  };

  const handleDebtChange = (value: number) => {
    const clamped = Math.min(100, Math.max(0, value));
    setForm({ ...form, debtPercent: clamped, equityPercent: 100 - clamped });
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-stone-50 border-b border-stone-200">
        {editing ? (
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="text-sm font-semibold border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        ) : (
          <h4 className="text-sm font-semibold text-stone-800">{scenario.name}</h4>
        )}
        <div className="flex items-center gap-2">
          <FactSheetButton projectId={projectId} scenarioId={scenario.id} />
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-stone-500 hover:text-stone-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                Save
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
            >
              Edit
            </button>
          )}
          <button onClick={onDelete} className="text-stone-400 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Editable inputs */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5">
          <div>
            <label className="block text-[11px] text-stone-500 uppercase tracking-wider mb-0.5">
              Debt %
            </label>
            {editing ? (
              <input
                type="number"
                min={0}
                max={100}
                value={form.debtPercent}
                onChange={(e) => handleDebtChange(parseFloat(e.target.value) || 0)}
                className="w-full border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            ) : (
              <p className="text-sm font-medium text-stone-800">
                {formatPercent(scenario.debtPercent)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-[11px] text-stone-500 uppercase tracking-wider mb-0.5">
              Equity %
            </label>
            <p className="text-sm font-medium text-stone-800">
              {formatPercent(editing ? form.equityPercent : scenario.equityPercent)}
            </p>
          </div>
          <div>
            <label className="block text-[11px] text-stone-500 uppercase tracking-wider mb-0.5">
              Interest Rate
            </label>
            {editing ? (
              <input
                type="number"
                step={0.25}
                min={0}
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: parseFloat(e.target.value) || 0 })}
                className="w-full border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            ) : (
              <p className="text-sm font-medium text-stone-800">
                {formatPercent(scenario.interestRate)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-[11px] text-stone-500 uppercase tracking-wider mb-0.5">
              Loan Term (Years)
            </label>
            {editing ? (
              <input
                type="number"
                min={1}
                max={30}
                value={form.loanTermYears}
                onChange={(e) =>
                  setForm({ ...form, loanTermYears: parseInt(e.target.value) || 1 })
                }
                className="w-full border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            ) : (
              <p className="text-sm font-medium text-stone-800">{scenario.loanTermYears} years</p>
            )}
          </div>
          <div>
            <label className="block text-[11px] text-stone-500 uppercase tracking-wider mb-0.5">
              Equity Cost %
            </label>
            {editing ? (
              <input
                type="number"
                step={0.5}
                min={0}
                value={form.equityCostPercent}
                onChange={(e) =>
                  setForm({ ...form, equityCostPercent: parseFloat(e.target.value) || 0 })
                }
                className="w-full border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            ) : (
              <p className="text-sm font-medium text-stone-800">
                {formatPercent(scenario.equityCostPercent)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-[11px] text-stone-500 uppercase tracking-wider mb-0.5">
              Repayment Type
            </label>
            {editing ? (
              <select
                value={form.repaymentType}
                onChange={(e) =>
                  setForm({ ...form, repaymentType: e.target.value as RepaymentType })
                }
                className="w-full border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {REPAYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-medium text-stone-800">
                {REPAYMENT_TYPES.find((t) => t.value === scenario.repaymentType)?.label}
              </p>
            )}
          </div>
        </div>

        {/* Computed metrics */}
        <div className="border-t border-stone-100 pt-4">
          <h5 className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-3">
            Computed Metrics
          </h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-stone-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-stone-500 uppercase">WACC</p>
              <p className="text-sm font-bold text-stone-800">
                {scenario.wacc != null ? formatPercent(scenario.wacc) : '--'}
              </p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-emerald-600 uppercase">NPV</p>
              <p className="text-sm font-bold text-emerald-800">
                {scenario.npv != null ? formatCompactZAR(scenario.npv) : '--'}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-amber-600 uppercase">IRR</p>
              <p className="text-sm font-bold text-amber-800">
                {scenario.irr != null ? formatPercent(scenario.irr) : '--'}
              </p>
            </div>
            <div className="bg-stone-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-stone-500 uppercase">Payback</p>
              <p className="text-sm font-bold text-stone-800">
                {scenario.paybackYears != null ? formatYears(scenario.paybackYears) : '--'}
              </p>
            </div>
            <div className="bg-stone-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-stone-500 uppercase">PI</p>
              <p className="text-sm font-bold text-stone-800">
                {scenario.profitabilityIndex != null
                  ? scenario.profitabilityIndex.toFixed(2)
                  : '--'}
              </p>
            </div>
            <div className="bg-stone-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-stone-500 uppercase">Monthly Pmt</p>
              <p className="text-sm font-bold text-stone-800">
                {scenario.monthlyPayment != null ? formatCompactZAR(scenario.monthlyPayment) : '--'}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center col-span-2">
              <p className="text-[10px] text-red-500 uppercase">Total Interest</p>
              <p className="text-sm font-bold text-red-700">
                {scenario.totalInterest != null ? formatZAR(scenario.totalInterest) : '--'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScenarioEditor({
  projectId,
  scenarios,
  onAdd,
  onUpdate,
  onDelete,
  onRefresh,
}: ScenarioEditorProps) {
  const handleAddScenario = () => {
    onAdd({
      name: `Scenario ${scenarios.length + 1}`,
      debtPercent: 70,
      equityPercent: 30,
      interestRate: 11.5,
      loanTermYears: 10,
      equityCostPercent: 15,
      repaymentType: 'equal_installments',
    });
  };

  // Comparison chart data
  const comparisonData = scenarios
    .filter((s) => s.npv != null)
    .map((s) => ({
      name: s.name,
      NPV: s.npv ? Math.round(s.npv / 1000) : 0,
      IRR: s.irr ?? 0,
      Payback: s.paybackYears ?? 0,
    }));

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleAddScenario}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
        >
          <Plus size={16} />
          Add Scenario
        </button>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
        >
          <RefreshCw size={16} />
          Recalculate
        </button>
      </div>

      {/* Scenario cards */}
      {scenarios.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm">
          No scenarios yet. Add one to start evaluating funding options.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              projectId={projectId}
              onUpdate={(data) => onUpdate(scenario.id, data)}
              onDelete={() => onDelete(scenario.id)}
            />
          ))}
        </div>
      )}

      {/* Comparison chart */}
      {comparisonData.length > 1 && (
        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-stone-700 mb-4">Scenario Comparison</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* NPV comparison */}
            <div>
              <h5 className="text-xs text-stone-500 mb-2 uppercase tracking-wider">
                NPV (R thousands)
              </h5>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                  <Tooltip
                    formatter={(value) => [`R ${value}K`, 'NPV']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e7e5e4',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="NPV" fill="#047857" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* IRR & Payback */}
            <div>
              <h5 className="text-xs text-stone-500 mb-2 uppercase tracking-wider">
                IRR (%) &amp; Payback (Years)
              </h5>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e7e5e4',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="IRR" fill="#d97706" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Payback" fill="#78716c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
