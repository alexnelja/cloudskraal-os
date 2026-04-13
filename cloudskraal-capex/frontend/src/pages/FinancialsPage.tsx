import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Search, Filter } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getFinancialDashboard, getFinancialTransactions, getEnterprises } from '../api/financials';
import type { FinancialDashboard, FinancialTransaction, Enterprise } from '../types/phase3';
import ThreeStatementModel from '../components/financials/ThreeStatementModel';

function formatCurrency(val: number | null): string {
  if (val == null) return '-';
  return `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
}

function formatCurrencyShort(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `R${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `R${(val / 1_000).toFixed(0)}K`;
  return `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function FinancialsPage() {
  const [dashboard, setDashboard] = useState<FinancialDashboard | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [view, setView] = useState<'overview' | 'model'>('model');

  // Filters
  const [filterEnterprise, setFilterEnterprise] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getFinancialDashboard(),
      getEnterprises(),
      getFinancialTransactions(),
    ])
      .then(([dash, ent, txs]) => {
        setDashboard(dash);
        setEnterprises(ent);
        setTransactions(txs);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load financials:', err);
        setLoading(false);
      });
  }, []);

  const fetchTransactions = useCallback(() => {
    setTxLoading(true);
    const params: Record<string, string> = {};
    if (filterEnterprise) params.enterprise_id = filterEnterprise;
    if (filterType) params.type = filterType;
    if (filterCategory) params.category = filterCategory;
    if (filterDateFrom) params.date_from = filterDateFrom;
    if (filterDateTo) params.date_to = filterDateTo;
    getFinancialTransactions(Object.keys(params).length > 0 ? params : undefined)
      .then((txs) => {
        setTransactions(txs);
        setTxLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load transactions:', err);
        setTxLoading(false);
      });
  }, [filterEnterprise, filterType, filterCategory, filterDateFrom, filterDateTo]);

  useEffect(() => {
    if (!loading) fetchTransactions();
  }, [fetchTransactions, loading]);

  // Search filter (client-side)
  const filteredTransactions = searchText
    ? transactions.filter((tx) => {
        const text = searchText.toLowerCase();
        return (
          (tx.description ?? '').toLowerCase().includes(text) ||
          (tx.category ?? '').toLowerCase().includes(text) ||
          (tx.enterprise_name ?? '').toLowerCase().includes(text) ||
          (tx.source_reference ?? '').toLowerCase().includes(text)
        );
      })
    : transactions;

  if (loading) {
    return (
      <div className="h-[calc(100vh-5rem)] md:h-screen flex items-center justify-center">
        <p className="text-stone-400 text-sm">Loading financials...</p>
      </div>
    );
  }

  // Chart data
  const chartData = dashboard?.byEnterprise.map((e) => ({
    name: e.name.length > 15 ? e.name.slice(0, 15) + '...' : e.name,
    fullName: e.name,
    revenue: e.revenue,
    expenses: e.expenses,
    net: e.net,
  })) ?? [];

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <PageHeader icon={BarChart3} title="Financials">
        <div className="flex bg-stone-100 rounded-lg p-0.5">
          <button
            onClick={() => setView('overview')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              view === 'overview' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setView('model')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              view === 'model' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Financial Model
          </button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto bg-white page-fade-in">
        <div className="max-w-6xl mx-auto p-4 space-y-6">

          {/* Three-Statement Financial Model */}
          {view === 'model' && <ThreeStatementModel />}

          {/* === Overview mode === */}

          {/* Dashboard metric cards */}
          {view === 'overview' && dashboard && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                <p className="text-xs text-emerald-600 uppercase tracking-wide mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-emerald-800">{formatCurrencyShort(dashboard.totalRevenue)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
                <p className="text-xs text-red-600 uppercase tracking-wide mb-1">Total Expenses</p>
                <p className="text-3xl font-bold text-red-800">{formatCurrencyShort(dashboard.totalExpenses)}</p>
              </div>
              <div className={`border rounded-2xl p-5 text-center ${
                dashboard.netIncome >= 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className="text-xs text-stone-600 uppercase tracking-wide mb-1">Net Income</p>
                <p className={`text-3xl font-bold ${dashboard.netIncome >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                  {formatCurrencyShort(dashboard.netIncome)}
                </p>
              </div>
            </div>
          )}

          {/* Enterprise P&L chart */}
          {view === 'overview' && chartData.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stone-700 mb-3">Enterprise P&L</h2>
              <div className="rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 50 + 60)}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => formatCurrencyShort(v)}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      labelFormatter={(_label, payload) => {
                        const p = payload as unknown as Array<{ payload?: { fullName?: string } }>;
                        if (p && p.length > 0 && p[0].payload) {
                          return p[0].payload.fullName ?? String(_label);
                        }
                        return String(_label);
                      }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#047857" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#dc2626" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Enterprise breakdown cards */}
          {view === 'overview' && dashboard && dashboard.byEnterprise.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stone-700 mb-3">Enterprise Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dashboard.byEnterprise.map((ent) => {
                  const margin = ent.revenue > 0 ? ((ent.net / ent.revenue) * 100).toFixed(0) : '0';
                  return (
                    <div key={ent.name} className="rounded-2xl p-4">
                      <h3 className="text-sm font-bold text-stone-800 mb-3">{ent.name}</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-stone-500">Revenue</span>
                          <span className="text-emerald-700 font-medium">{formatCurrency(ent.revenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Expenses</span>
                          <span className="text-red-600 font-medium">{formatCurrency(ent.expenses)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-[#f3f4f3]">
                          <span className="text-stone-500">Net</span>
                          <span className={`font-bold ${ent.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {formatCurrency(ent.net)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Margin</span>
                          <span className={`font-medium ${ent.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {margin}%
                          </span>
                        </div>
                      </div>
                      {/* Mini bar */}
                      <div className="mt-3 h-2 bg-stone-100 rounded-full overflow-hidden">
                        {ent.revenue > 0 && (
                          <div
                            className={`h-full rounded-full ${ent.net >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, Math.max(0, (ent.net / ent.revenue) * 100))}%` }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transactions */}
          {view === 'overview' && <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-stone-700">Transactions</h2>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-stone-600 hover:text-stone-800 bg-stone-100 rounded-lg"
              >
                <Filter size={12} />
                Filters
              </button>
            </div>

            {/* Search + filters */}
            <div className="mb-3 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>

              {showFilters && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <select
                    value={filterEnterprise}
                    onChange={(e) => setFilterEnterprise(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                  >
                    <option value="">All Enterprises</option>
                    {enterprises.map((ent) => (
                      <option key={ent.id} value={ent.id}>{ent.name}</option>
                    ))}
                  </select>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                  >
                    <option value="">All Types</option>
                    <option value="revenue">Revenue</option>
                    <option value="expense">Expense</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Category"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                  />
                  <input
                    type="date"
                    placeholder="From"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                  />
                  <input
                    type="date"
                    placeholder="To"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Transactions table */}
            <div className="overflow-x-auto rounded-2xl">
              {txLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-stone-400 text-sm">Loading transactions...</p>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-stone-400 text-sm">No transactions found.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-[#f3f4f3] border-b border-[#f3f4f3]">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-stone-600">Date</th>
                      <th className="text-left px-4 py-2 font-medium text-stone-600">Description</th>
                      <th className="text-left px-4 py-2 font-medium text-stone-600 hidden sm:table-cell">Enterprise</th>
                      <th className="text-left px-4 py-2 font-medium text-stone-600 hidden md:table-cell">Category</th>
                      <th className="text-left px-4 py-2 font-medium text-stone-600 hidden lg:table-cell">Type</th>
                      <th className="text-right px-4 py-2 font-medium text-stone-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-[#f3f4f3]">
                        <td className="px-4 py-2.5 text-stone-800 whitespace-nowrap">{formatDate(tx.date)}</td>
                        <td className="px-4 py-2.5 text-stone-600">
                          {tx.description ?? '-'}
                          {tx.source_reference && (
                            <span className="text-[10px] text-stone-400 ml-1">({tx.source_reference})</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-stone-600 hidden sm:table-cell">{tx.enterprise_name ?? '-'}</td>
                        <td className="px-4 py-2.5 text-stone-600 hidden md:table-cell">{tx.category ?? '-'}</td>
                        <td className="px-4 py-2.5 hidden lg:table-cell">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            tx.type === 'revenue'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-medium whitespace-nowrap ${
                          tx.type === 'revenue' ? 'text-emerald-700' : 'text-red-600'
                        }`}>
                          {tx.type === 'revenue' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>}

        </div>
      </div>
    </div>
  );
}
