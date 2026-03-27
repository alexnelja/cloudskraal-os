import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, AlertTriangle, Wrench, Plus, X } from 'lucide-react';
import { getEquipment, getEquipmentById, getEquipmentSummary, getEquipmentAlerts, addMaintenanceLog } from '../api/equipment';
import type { Equipment, EquipmentSummary } from '../types/phase2';
import { EQUIPMENT_TYPE_ICONS } from '../types/phase2';

function formatCurrency(val: number | null): string {
  if (val == null) return '-';
  return `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

const STATUS_COLORS: Record<string, string> = {
  active: '#047857',
  maintenance: '#d97706',
  decommissioned: '#9ca3af',
  stored: '#6b7280',
};

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [alerts, setAlerts] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState({ type: 'service', date: '', description: '', cost: '', performed_by: '' });
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      getEquipment(typeFilter ? { type: typeFilter } : undefined),
      getEquipmentSummary(),
      getEquipmentAlerts(),
    ])
      .then(([eq, sum, al]) => {
        setEquipment(eq);
        setSummary(sum);
        setAlerts(al);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load equipment:', err);
        setLoading(false);
      });
  }, [typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!selectedId) { setSelectedItem(null); return; }
    setDetailLoading(true);
    getEquipmentById(selectedId)
      .then((item) => { setSelectedItem(item); setDetailLoading(false); })
      .catch((err) => { console.error('Failed to load equipment detail:', err); setDetailLoading(false); });
  }, [selectedId]);

  async function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    try {
      await addMaintenanceLog(selectedId, {
        type: logForm.type,
        date: logForm.date,
        description: logForm.description || null,
        cost: logForm.cost ? Number(logForm.cost) : null,
        performed_by: logForm.performed_by || null,
      });
      setShowLogForm(false);
      setLogForm({ type: 'service', date: '', description: '', cost: '', performed_by: '' });
      // Refresh detail
      const item = await getEquipmentById(selectedId);
      setSelectedItem(item);
      fetchData();
    } catch (err) {
      console.error('Failed to add log:', err);
    }
  }

  const typeKeys = summary ? Object.keys(summary.byType) : [];

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#f3f4f3] px-4 py-3 bg-white">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Wrench size={20} className="text-emerald-700" />
            <h1 className="text-lg font-bold text-stone-900">Equipment Register</h1>
          </div>
          <div className="flex-1" />
          {summary && (
            <div className="flex items-center gap-4 text-xs">
              <div className="text-center">
                <p className="text-stone-400">Total Items</p>
                <p className="text-lg font-bold text-stone-800">{summary.total}</p>
              </div>
              <div className="text-center">
                <p className="text-stone-400">Total Value</p>
                <p className="text-lg font-bold text-stone-800">{formatCurrency(summary.totalValue)}</p>
              </div>
              <div className="text-center">
                <p className="text-stone-400">Overdue Service</p>
                <p className={`text-lg font-bold ${summary.overdueService > 0 ? 'text-red-600' : 'text-stone-800'}`}>
                  {summary.overdueService}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Type filter pills */}
        {typeKeys.length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button
              onClick={() => setTypeFilter(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                typeFilter === null ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All
            </button>
            {typeKeys.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  typeFilter === t ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {EQUIPMENT_TYPE_ICONS[t] ?? ''} {t.charAt(0).toUpperCase() + t.slice(1)} ({summary!.byType[t]})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Overdue service alert banner */}
      {alerts.length > 0 && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">{alerts.length} item{alerts.length !== 1 ? 's' : ''}</span> with overdue service:{' '}
            {alerts.slice(0, 3).map((a) => a.name).join(', ')}
            {alerts.length > 3 && ` +${alerts.length - 3} more`}
          </p>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Table */}
        <div className="flex-1 overflow-auto bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-stone-400 text-sm">Loading equipment...</p>
            </div>
          ) : equipment.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-stone-400 text-sm">No equipment found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#f3f4f3] border-b border-[#f3f4f3]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-stone-600">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-600 hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-600 hidden md:table-cell">Make/Model</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-600 hidden lg:table-cell">Farm</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-600">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-600 hidden md:table-cell">Next Service</th>
                  <th className="text-right px-4 py-2 font-medium text-stone-600 hidden sm:table-cell">Value</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((item) => {
                  const overdue = isOverdue(item.next_service_date);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`border-b border-[#f3f4f3] cursor-pointer transition-colors ${
                        selectedId === item.id ? 'bg-emerald-50' : 'hover:bg-stone-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-800">{item.name}</p>
                        {item.code && <p className="text-[10px] text-stone-400">{item.code}</p>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-stone-600">
                          {EQUIPMENT_TYPE_ICONS[item.type] ?? ''} {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-stone-600">
                        {[item.make, item.model].filter(Boolean).join(' ') || '-'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-stone-600">
                        {item.farm_name ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                          style={{ backgroundColor: STATUS_COLORS[item.status] ?? '#6b7280' }}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className={`px-4 py-3 hidden md:table-cell ${overdue ? 'text-red-600 font-medium' : 'text-stone-600'}`}>
                        {formatDate(item.next_service_date)}
                        {overdue && ' (overdue)'}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell text-stone-600">
                        {formatCurrency(item.current_value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selectedId && (
          <div className="md:w-[420px] md:flex-shrink-0 border-t md:border-t-0 md:border-l border-[#f3f4f3] bg-white overflow-y-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-stone-400 text-sm">Loading...</p>
              </div>
            ) : selectedItem ? (
              <div className="p-4">
                {/* Close + title */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1 text-stone-400 hover:text-stone-600 md:hidden"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h2 className="text-lg font-bold text-stone-900 flex-1">{selectedItem.name}</h2>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1 text-stone-400 hover:text-stone-600 hidden md:block"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Info card */}
                <div className="bg-stone-50 rounded-lg p-4 mb-4 space-y-2 text-sm">
                  {selectedItem.code && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Code</span>
                      <span className="text-stone-800 font-medium">{selectedItem.code}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-stone-500">Type</span>
                    <span className="text-stone-800">{EQUIPMENT_TYPE_ICONS[selectedItem.type] ?? ''} {selectedItem.type}</span>
                  </div>
                  {selectedItem.make && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Make / Model</span>
                      <span className="text-stone-800">{[selectedItem.make, selectedItem.model].filter(Boolean).join(' ')}</span>
                    </div>
                  )}
                  {selectedItem.year && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Year</span>
                      <span className="text-stone-800">{selectedItem.year}</span>
                    </div>
                  )}
                  {selectedItem.farm_name && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Farm</span>
                      <span className="text-stone-800">{selectedItem.farm_name}</span>
                    </div>
                  )}
                  {selectedItem.department && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Department</span>
                      <span className="text-stone-800">{selectedItem.department}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-stone-500">Status</span>
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                      style={{ backgroundColor: STATUS_COLORS[selectedItem.status] ?? '#6b7280' }}
                    >
                      {selectedItem.status}
                    </span>
                  </div>
                  {selectedItem.hours_meter != null && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Hours</span>
                      <span className="text-stone-800">{selectedItem.hours_meter.toLocaleString()} hrs</span>
                    </div>
                  )}
                  {selectedItem.purchase_price != null && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Purchase Price</span>
                      <span className="text-stone-800">{formatCurrency(selectedItem.purchase_price)}</span>
                    </div>
                  )}
                  {selectedItem.current_value != null && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Current Value</span>
                      <span className="text-stone-800 font-medium">{formatCurrency(selectedItem.current_value)}</span>
                    </div>
                  )}
                  {selectedItem.next_service_date && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Next Service</span>
                      <span className={isOverdue(selectedItem.next_service_date) ? 'text-red-600 font-medium' : 'text-stone-800'}>
                        {formatDate(selectedItem.next_service_date)}
                      </span>
                    </div>
                  )}
                  {selectedItem.notes && (
                    <div className="pt-2 border-t border-[#f3f4f3]">
                      <p className="text-stone-500 text-xs mb-1">Notes</p>
                      <p className="text-stone-700 text-xs">{selectedItem.notes}</p>
                    </div>
                  )}
                </div>

                {/* Maintenance log header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Maintenance Log ({selectedItem.maintenance_logs?.length ?? 0})
                  </h3>
                  <button
                    onClick={() => setShowLogForm(!showLogForm)}
                    className="flex items-center gap-1 px-2 py-1 bg-emerald-700 text-white text-[10px] font-medium rounded-lg hover:bg-emerald-800 transition-colors"
                  >
                    <Plus size={12} />
                    Log Maintenance
                  </button>
                </div>

                {/* Log form */}
                {showLogForm && (
                  <form onSubmit={handleLogSubmit} className="bg-stone-50 rounded-lg p-3 mb-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={logForm.type}
                        onChange={(e) => setLogForm({ ...logForm, type: e.target.value })}
                        className="col-span-1 px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                      >
                        <option value="service">Service</option>
                        <option value="repair">Repair</option>
                        <option value="inspection">Inspection</option>
                        <option value="oil_change">Oil Change</option>
                      </select>
                      <input
                        type="date"
                        value={logForm.date}
                        onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                        required
                        className="col-span-1 px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Description"
                      value={logForm.description}
                      onChange={(e) => setLogForm({ ...logForm, description: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Cost (R)"
                        value={logForm.cost}
                        onChange={(e) => setLogForm({ ...logForm, cost: e.target.value })}
                        className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Performed by"
                        value={logForm.performed_by}
                        onChange={(e) => setLogForm({ ...logForm, performed_by: e.target.value })}
                        className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowLogForm(false)}
                        className="px-3 py-1 text-xs text-stone-600 hover:text-stone-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-emerald-800"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                )}

                {/* Maintenance timeline */}
                {selectedItem.maintenance_logs && selectedItem.maintenance_logs.length > 0 ? (
                  <div className="space-y-0">
                    {selectedItem.maintenance_logs.map((log, idx) => (
                      <div key={log.id} className="flex gap-3">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 flex-shrink-0 mt-1" />
                          {idx < selectedItem.maintenance_logs!.length - 1 && (
                            <div className="w-px flex-1 bg-stone-200" />
                          )}
                        </div>
                        {/* Content */}
                        <div className="pb-4 flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-stone-800">{formatDate(log.date)}</span>
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-200 text-stone-700">
                              {log.type}
                            </span>
                          </div>
                          {log.description && (
                            <p className="text-xs text-stone-600 mb-0.5">{log.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-stone-400">
                            {log.cost != null && <span>Cost: {formatCurrency(log.cost)}</span>}
                            {log.performed_by && <span>By: {log.performed_by}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400">No maintenance records yet.</p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
