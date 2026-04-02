import { useState, useEffect, useCallback } from 'react';
import { Factory, X, ArrowLeft, CheckCircle2, Circle, Clock } from 'lucide-react';
import { getBatches, getBatch, getProductionDashboard, updateBatch } from '../api/production';
import type { ProductionBatch, ProductionDashboard, QualityTest, Sale } from '../types/phase2';
import { BATCH_STATUS_COLORS } from '../types/phase2';
import { ENTERPRISE_COLORS } from '../types/farm';
import EditableCell from '../components/EditableCell';

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(val: number | null): string {
  if (val == null) return '-';
  return `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
}

const KANBAN_COLUMNS = ['received', 'processing', 'graded', 'stored', 'sold', 'shipped'];
const KANBAN_LABELS: Record<string, string> = {
  received: 'Received',
  processing: 'Processing',
  graded: 'Graded',
  stored: 'Stored',
  sold: 'Sold',
  shipped: 'Shipped',
};

const ROOIBOS_STEPS = ['cutting', 'bruising', 'oxidation', 'drying', 'sifting', 'grading'];

export default function ProductionPage() {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [dashboard, setDashboard] = useState<ProductionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([getBatches(), getProductionDashboard()])
      .then(([b, d]) => {
        setBatches(b);
        setDashboard(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load production data:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!selectedId) { setSelectedBatch(null); return; }
    setDetailLoading(true);
    getBatch(selectedId)
      .then((b) => { setSelectedBatch(b); setDetailLoading(false); })
      .catch((err) => { console.error('Failed to load batch:', err); setDetailLoading(false); });
  }, [selectedId]);

  // Group batches by status for kanban
  const batchesByStatus: Record<string, ProductionBatch[]> = {};
  for (const col of KANBAN_COLUMNS) {
    batchesByStatus[col] = [];
  }
  for (const batch of batches) {
    const status = batch.status.toLowerCase();
    if (batchesByStatus[status]) {
      batchesByStatus[status].push(batch);
    } else {
      // Put unknown statuses in 'received'
      batchesByStatus['received'].push(batch);
    }
  }

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#f3f4f3] px-4 py-3 bg-white">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Factory size={20} className="text-emerald-700" />
            <h1 className="text-lg font-bold text-stone-900">Production Pipeline</h1>
          </div>
          <div className="flex-1" />
          {dashboard && (
            <div className="flex items-center gap-4 text-xs">
              <div className="text-center">
                <p className="text-stone-400">In Pipeline</p>
                <p className="text-lg font-bold text-stone-800">{dashboard.totalKgInPipeline.toLocaleString()} kg</p>
              </div>
              <div className="text-center">
                <p className="text-stone-400">Batches</p>
                <p className="text-lg font-bold text-stone-800">{batches.length}</p>
              </div>
              <div className="text-center">
                <p className="text-stone-400">Revenue</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(dashboard.totalRevenue)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Kanban board */}
        <div className="flex-1 overflow-x-auto overflow-y-auto bg-stone-50 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-stone-400 text-sm">Loading production data...</p>
            </div>
          ) : (
            <div className="flex gap-3 min-w-max md:min-w-0">
              {KANBAN_COLUMNS.map((status) => {
                const items = batchesByStatus[status];
                const color = BATCH_STATUS_COLORS[status] ?? '#6b7280';
                return (
                  <div key={status} className="flex-1 min-w-[200px] max-w-[280px]">
                    {/* Column header */}
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs font-semibold text-stone-700">{KANBAN_LABELS[status]}</span>
                      <span className="text-xs text-stone-400">({items.length})</span>
                    </div>
                    {/* Cards */}
                    <div className="space-y-2">
                      {items.map((batch) => (
                        <div
                          key={batch.id}
                          onClick={() => setSelectedId(batch.id)}
                          className={`w-full text-left bg-white rounded-lg border p-3 transition-colors cursor-pointer ${
                            selectedId === batch.id ? 'border-emerald-500' : 'border-[#f3f4f3]'
                          }`}
                        >
                          <p className="text-sm font-bold text-stone-800 mb-1">{batch.batch_code}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            {batch.product_type && (
                              <span className="text-[10px] text-stone-500">{batch.product_type}</span>
                            )}
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                              style={{ backgroundColor: ENTERPRISE_COLORS[batch.enterprise] ?? '#6b7280' }}
                            >
                              {batch.enterprise}
                            </span>
                            <span onClick={(e) => e.stopPropagation()}>
                              <EditableCell
                                value={batch.status}
                                type="select"
                                options={KANBAN_COLUMNS}
                                onSave={(val) => {
                                  setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, status: val } : b));
                                  updateBatch(batch.id, { status: val }).catch(() => fetchData());
                                }}
                                className="text-[10px] font-medium"
                              />
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-stone-600" onClick={(e) => e.stopPropagation()}>
                              <EditableCell
                                value={batch.current_quantity_kg != null ? String(batch.current_quantity_kg) : ''}
                                type="number"
                                onSave={(val) => {
                                  const num = val ? Number(val) : null;
                                  setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, current_quantity_kg: num } : b));
                                  updateBatch(batch.id, { current_quantity_kg: num }).catch(() => fetchData());
                                }}
                                className="text-xs text-stone-600"
                              />
                            </span>
                            <span onClick={(e) => e.stopPropagation()}>
                              <EditableCell
                                value={batch.quality_grade ?? ''}
                                onSave={(val) => {
                                  setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, quality_grade: val || null } : b));
                                  updateBatch(batch.id, { quality_grade: val || null }).catch(() => fetchData());
                                }}
                                className="text-[10px] text-purple-700 font-medium"
                              />
                            </span>
                          </div>
                          {batch.latest_step && (
                            <p className="text-[10px] text-stone-400 mt-1">Latest: {batch.latest_step}</p>
                          )}
                          {batch.step_count != null && batch.step_count > 0 && (
                            <p className="text-[10px] text-stone-400">{batch.step_count} step{batch.step_count !== 1 ? 's' : ''}</p>
                          )}
                        </div>
                      ))}
                      {items.length === 0 && (
                        <div className="rounded-lg border border-dashed border-[#f3f4f3] p-4 text-center">
                          <p className="text-xs text-stone-400">No batches</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedId && (
          <div className="md:w-[440px] md:flex-shrink-0 border-t md:border-t-0 md:border-l border-[#f3f4f3] bg-white overflow-y-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-stone-400 text-sm">Loading...</p>
              </div>
            ) : selectedBatch ? (
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setSelectedId(null)} className="p-1 text-stone-400 hover:text-stone-600 md:hidden">
                    <ArrowLeft size={18} />
                  </button>
                  <h2 className="text-lg font-bold text-stone-900 flex-1">{selectedBatch.batch_code}</h2>
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: BATCH_STATUS_COLORS[selectedBatch.status] ?? '#6b7280' }}
                  >
                    {selectedBatch.status}
                  </span>
                  <button onClick={() => setSelectedId(null)} className="p-1 text-stone-400 hover:text-stone-600 hidden md:block">
                    <X size={18} />
                  </button>
                </div>

                {/* Batch info */}
                <div className="bg-stone-50 rounded-lg p-4 mb-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Enterprise</span>
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                      style={{ backgroundColor: ENTERPRISE_COLORS[selectedBatch.enterprise] ?? '#6b7280' }}
                    >
                      {selectedBatch.enterprise}
                    </span>
                  </div>
                  {selectedBatch.product_type && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Product</span>
                      <span className="text-stone-800">{selectedBatch.product_type}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-stone-500">Initial Qty</span>
                    <span className="text-stone-800">{selectedBatch.initial_quantity_kg?.toLocaleString() ?? '-'} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Current Qty</span>
                    <span className="text-stone-800 font-medium">{selectedBatch.current_quantity_kg?.toLocaleString() ?? '-'} kg</span>
                  </div>
                  {selectedBatch.quality_grade && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Grade</span>
                      <span className="text-purple-700 font-medium">{selectedBatch.quality_grade}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-stone-500">Storage</span>
                    <EditableCell
                      value={selectedBatch.storage_location ?? ''}
                      onSave={(val) => {
                        setSelectedBatch(prev => prev ? { ...prev, storage_location: val || null } : prev);
                        setBatches(prev => prev.map(b => b.id === selectedBatch.id ? { ...b, storage_location: val || null } : b));
                        updateBatch(selectedBatch.id, { storage_location: val || null }).catch(() => fetchData());
                      }}
                      className="text-stone-800"
                    />
                  </div>
                  {selectedBatch.harvest_date_start && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Harvest</span>
                      <span className="text-stone-800">
                        {formatDate(selectedBatch.harvest_date_start)}
                        {selectedBatch.harvest_date_end && ` - ${formatDate(selectedBatch.harvest_date_end)}`}
                      </span>
                    </div>
                  )}
                  {selectedBatch.notes && (
                    <div className="pt-2 border-t border-[#f3f4f3]">
                      <p className="text-stone-500 text-xs mb-1">Notes</p>
                      <p className="text-stone-700 text-xs">{selectedBatch.notes}</p>
                    </div>
                  )}
                </div>

                {/* Rooibos processing workflow visualization */}
                {selectedBatch.enterprise === 'rooibos' && selectedBatch.steps && selectedBatch.steps.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Rooibos Workflow</h3>
                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                      {ROOIBOS_STEPS.map((step, idx) => {
                        const matchingStep = selectedBatch.steps?.find((s) => s.step_type.toLowerCase() === step);
                        const isDone = matchingStep?.end_datetime != null;
                        const isCurrent = matchingStep != null && !isDone;
                        let bgColor = '#e5e7eb'; // gray
                        if (isDone) bgColor = '#047857';
                        else if (isCurrent) bgColor = '#2563eb';
                        return (
                          <div key={step} className="flex items-center gap-1">
                            <div
                              className="px-2 py-1 rounded text-[10px] font-medium text-white min-w-[60px] text-center"
                              style={{ backgroundColor: bgColor }}
                            >
                              {step.charAt(0).toUpperCase() + step.slice(1)}
                            </div>
                            {idx < ROOIBOS_STEPS.length - 1 && (
                              <span className="text-stone-300 text-xs">&rarr;</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Processing timeline */}
                {selectedBatch.steps && selectedBatch.steps.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                      Processing Steps ({selectedBatch.steps.length})
                    </h3>
                    <div className="space-y-0">
                      {selectedBatch.steps.map((step, idx) => {
                        const isDone = step.end_datetime != null;
                        const isCurrent = step.start_datetime != null && !isDone;
                        return (
                          <div key={step.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              {isDone ? (
                                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                              ) : isCurrent ? (
                                <Clock size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                              ) : (
                                <Circle size={16} className="text-stone-300 flex-shrink-0 mt-0.5" />
                              )}
                              {idx < selectedBatch.steps!.length - 1 && (
                                <div className="w-px flex-1 bg-stone-200" />
                              )}
                            </div>
                            <div className="pb-3 flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-xs font-medium ${isDone ? 'text-stone-800' : isCurrent ? 'text-blue-700' : 'text-stone-400'}`}>
                                  Step {step.step_number}: {step.step_type}
                                </span>
                              </div>
                              <div className="text-[10px] text-stone-500 space-y-0.5">
                                {step.start_datetime && <p>Start: {formatDateTime(step.start_datetime)}</p>}
                                {step.end_datetime && <p>End: {formatDateTime(step.end_datetime)}</p>}
                                {(step.input_quantity_kg != null || step.output_quantity_kg != null) && (
                                  <p>
                                    {step.input_quantity_kg != null && `In: ${step.input_quantity_kg} kg`}
                                    {step.input_quantity_kg != null && step.output_quantity_kg != null && ' \u2192 '}
                                    {step.output_quantity_kg != null && `Out: ${step.output_quantity_kg} kg`}
                                    {step.loss_kg != null && step.loss_kg > 0 && ` (loss: ${step.loss_kg} kg)`}
                                  </p>
                                )}
                                {step.operator && <p>Operator: {step.operator}</p>}
                                {step.facility && <p>Facility: {step.facility}</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quality tests */}
                {selectedBatch.quality_tests && selectedBatch.quality_tests.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                      Quality Tests ({selectedBatch.quality_tests.length})
                    </h3>
                    <div className="rounded-2xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-[#f3f4f3] border-b border-[#f3f4f3]">
                          <tr>
                            <th className="text-left px-3 py-1.5 font-medium text-stone-600">Type</th>
                            <th className="text-left px-3 py-1.5 font-medium text-stone-600">Date</th>
                            <th className="text-left px-3 py-1.5 font-medium text-stone-600">Result</th>
                            <th className="text-center px-3 py-1.5 font-medium text-stone-600">Pass/Fail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBatch.quality_tests.map((qt: QualityTest) => (
                            <tr key={qt.id} className="border-b border-[#f3f4f3]">
                              <td className="px-3 py-2 text-stone-800">{qt.test_type ?? '-'}</td>
                              <td className="px-3 py-2 text-stone-600">{formatDate(qt.test_date)}</td>
                              <td className="px-3 py-2 text-stone-600">{qt.results ?? '-'}</td>
                              <td className="px-3 py-2 text-center">
                                {qt.pass_fail && (
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      qt.pass_fail.toLowerCase() === 'pass'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {qt.pass_fail}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sales */}
                {selectedBatch.sales && selectedBatch.sales.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                      Sales ({selectedBatch.sales.length})
                    </h3>
                    {selectedBatch.sales.map((sale: Sale) => (
                      <div key={sale.id} className="bg-stone-50 rounded-lg p-3 mb-2 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium text-stone-800">{sale.customer}</span>
                          <span className="font-bold text-emerald-700">{formatCurrency(sale.total_amount)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-stone-500">
                          {sale.quantity_kg != null && <span>{sale.quantity_kg.toLocaleString()} kg</span>}
                          {sale.unit_price != null && <span>@ R{sale.unit_price}/kg</span>}
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded font-medium ${
                              sale.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-700'
                                : sale.status === 'shipped'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-stone-200 text-stone-600'
                            }`}
                          >
                            {sale.status}
                          </span>
                        </div>
                        {sale.shipped_date && <p className="text-[10px] text-stone-400">Shipped: {formatDate(sale.shipped_date)}</p>}
                        {sale.paid_date && <p className="text-[10px] text-stone-400">Paid: {formatDate(sale.paid_date)}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
