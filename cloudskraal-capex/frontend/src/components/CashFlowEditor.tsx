import { useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { CashFlow } from '../types';
import { formatZAR, formatCompactZAR } from '../utils/format';
import ZARInput from './ZARInput';

interface CashFlowEditorProps {
  cashFlows: CashFlow[];
  onChange: (cashFlows: CashFlow[]) => void;
  onSave: () => void;
  saving?: boolean;
}

export default function CashFlowEditor({ cashFlows, onChange, onSave, saving }: CashFlowEditorProps) {
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [autoFillBase, setAutoFillBase] = useState(500000);
  const [autoFillGrowth, setAutoFillGrowth] = useState(5);
  const [autoFillCosts, setAutoFillCosts] = useState(200000);
  const [autoFillYears, setAutoFillYears] = useState(10);

  const updateRow = (index: number, field: 'revenue' | 'operatingCosts', value: number) => {
    const updated = cashFlows.map((cf, i) => {
      if (i !== index) return cf;
      const newCf = { ...cf, [field]: value };
      newCf.netCashFlow = newCf.revenue - newCf.operatingCosts;
      return newCf;
    });
    onChange(updated);
  };

  const addRow = () => {
    const nextYear = cashFlows.length > 0 ? Math.max(...cashFlows.map((cf) => cf.year)) + 1 : 1;
    onChange([
      ...cashFlows,
      {
        id: `temp-${Date.now()}`,
        projectId: cashFlows[0]?.projectId || '',
        year: nextYear,
        revenue: 0,
        operatingCosts: 0,
        netCashFlow: 0,
      },
    ]);
  };

  const removeRow = (index: number) => {
    onChange(cashFlows.filter((_, i) => i !== index));
  };

  const handleAutoFill = () => {
    const rows: CashFlow[] = [];
    for (let i = 0; i < autoFillYears; i++) {
      const revenue = autoFillBase * Math.pow(1 + autoFillGrowth / 100, i);
      const costs = autoFillCosts * Math.pow(1 + autoFillGrowth / 200, i);
      rows.push({
        id: `temp-${Date.now()}-${i}`,
        projectId: cashFlows[0]?.projectId || '',
        year: i + 1,
        revenue: Math.round(revenue),
        operatingCosts: Math.round(costs),
        netCashFlow: Math.round(revenue - costs),
      });
    }
    onChange(rows);
    setShowAutoFill(false);
  };

  // Cumulative cash flow chart data
  let cumulative = 0;
  const chartData = cashFlows.map((cf) => {
    cumulative += cf.netCashFlow;
    return {
      year: `Year ${cf.year}`,
      netCashFlow: cf.netCashFlow,
      cumulative,
    };
  });

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
          >
            <Plus size={16} />
            Add Year
          </button>
          <button
            onClick={() => setShowAutoFill(!showAutoFill)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <Wand2 size={16} />
            Auto-Fill
          </button>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Cash Flows'}
        </button>
      </div>

      {/* Auto-fill panel */}
      {showAutoFill && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-stone-800 mb-3">Auto-Fill Parameters</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-stone-600 mb-1">Base Revenue (Year 1)</label>
              <ZARInput
                value={autoFillBase}
                onChange={setAutoFillBase}
                className="w-full text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-600 mb-1">Growth Rate (%)</label>
              <input
                type="number"
                value={autoFillGrowth}
                onChange={(e) => setAutoFillGrowth(parseFloat(e.target.value) || 0)}
                step={0.5}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-600 mb-1">Base Op. Costs (Year 1)</label>
              <ZARInput
                value={autoFillCosts}
                onChange={setAutoFillCosts}
                className="w-full text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-600 mb-1">Number of Years</label>
              <input
                type="number"
                value={autoFillYears}
                onChange={(e) => setAutoFillYears(parseInt(e.target.value) || 1)}
                min={1}
                max={30}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setShowAutoFill(false)}
              className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-800"
            >
              Cancel
            </button>
            <button
              onClick={handleAutoFill}
              className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Generate
            </button>
          </div>
        </div>
      )}

      {/* Spreadsheet table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider w-20">
                Year
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Revenue (ZAR)
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Operating Costs (ZAR)
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Net Cash Flow
              </th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {cashFlows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-sm text-stone-400">
                  No cash flows yet. Add years or use auto-fill.
                </td>
              </tr>
            ) : (
              cashFlows.map((cf, i) => (
                <tr key={cf.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-4 py-2">
                    <span className="text-sm font-medium text-stone-700">{cf.year}</span>
                  </td>
                  <td className="px-4 py-2">
                    <ZARInput
                      value={cf.revenue}
                      onChange={(v) => updateRow(i, 'revenue', v)}
                      className="w-full"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <ZARInput
                      value={cf.operatingCosts}
                      onChange={(v) => updateRow(i, 'operatingCosts', v)}
                      className="w-full"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`text-sm font-semibold ${
                        cf.netCashFlow >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {formatZAR(cf.netCashFlow)}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => removeRow(i)}
                      className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cumulative cash flow chart */}
      {chartData.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-stone-700 mb-4">Cumulative Cash Flow</h4>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
              <YAxis
                tick={{ fontSize: 12, fill: '#78716c' }}
                tickFormatter={(v) => formatCompactZAR(v)}
              />
              <Tooltip
                formatter={(value) => [formatZAR(Number(value)), '']}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e7e5e4',
                  fontSize: '13px',
                }}
              />
              <ReferenceLine y={0} stroke="#78716c" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#047857"
                strokeWidth={2}
                dot={{ fill: '#047857', r: 4 }}
                name="Cumulative"
              />
              <Line
                type="monotone"
                dataKey="netCashFlow"
                stroke="#d97706"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#d97706', r: 3 }}
                name="Net Cash Flow"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
