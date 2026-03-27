import { useState, useEffect, useCallback } from 'react';
import { Users, ChevronDown, ChevronUp, Plus, Phone } from 'lucide-react';
import { getEmployees, getEmployeeSummary, getEmployeeById, addTimeEntry } from '../api/employees';
import { getEnterprises } from '../api/financials';
import type { Employee, EmployeeSummary, Enterprise } from '../types/phase3';
import { EMPLOYEE_TYPE_COLORS } from '../types/phase3';

function formatCurrency(val: number | null): string {
  if (val == null) return '-';
  return `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<EmployeeSummary | null>(null);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedEmployee, setExpandedEmployee] = useState<Employee | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [timeForm, setTimeForm] = useState({ date: '', hours_worked: '', activity_type: 'general', enterprise: '', notes: '' });

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      getEmployees(typeFilter ? { type: typeFilter } : undefined),
      getEmployeeSummary(),
      getEnterprises(),
    ])
      .then(([emp, sum, ent]) => {
        setEmployees(emp);
        setSummary(sum);
        setEnterprises(ent);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load employees:', err);
        setLoading(false);
      });
  }, [typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!expandedId) { setExpandedEmployee(null); return; }
    getEmployeeById(expandedId)
      .then((emp) => setExpandedEmployee(emp))
      .catch((err) => console.error('Failed to load employee detail:', err));
  }, [expandedId]);

  async function handleTimeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!expandedId) return;
    try {
      await addTimeEntry(expandedId, {
        date: timeForm.date,
        hours_worked: timeForm.hours_worked ? Number(timeForm.hours_worked) : null,
        activity_type: timeForm.activity_type || null,
        enterprise: timeForm.enterprise || null,
        notes: timeForm.notes || null,
      });
      setShowTimeForm(false);
      setTimeForm({ date: '', hours_worked: '', activity_type: 'general', enterprise: '', notes: '' });
      const emp = await getEmployeeById(expandedId);
      setExpandedEmployee(emp);
    } catch (err) {
      console.error('Failed to add time entry:', err);
    }
  }

  const typeKeys = summary ? Object.keys(summary.byType) : [];

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#f3f4f3] px-4 py-3 bg-white">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-emerald-700" />
            <h1 className="text-lg font-bold text-stone-900">Employees</h1>
          </div>
          <div className="flex-1" />
          {summary && (
            <div className="flex items-center gap-4 text-xs">
              <div className="text-center">
                <p className="text-stone-400">Total</p>
                <p className="text-lg font-bold text-stone-800">{summary.total}</p>
              </div>
              <div className="text-center">
                <p className="text-stone-400">Monthly Cost</p>
                <p className="text-lg font-bold text-stone-800">{formatCurrency(summary.totalMonthlyCost)}</p>
              </div>
              {typeKeys.map((t) => (
                <div key={t} className="text-center hidden sm:block">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: EMPLOYEE_TYPE_COLORS[t] ?? '#6b7280' }}
                  >
                    {t}: {summary.byType[t]}
                  </span>
                </div>
              ))}
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
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all`}
                style={
                  typeFilter === t
                    ? { backgroundColor: EMPLOYEE_TYPE_COLORS[t] ?? '#6b7280', color: '#fff' }
                    : undefined
                }
              >
                {t.charAt(0).toUpperCase() + t.slice(1)} ({summary!.byType[t]})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-stone-400 text-sm">Loading employees...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-stone-400 text-sm">No employees found.</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {employees.map((emp) => {
                const isExpanded = expandedId === emp.id;
                return (
                  <div key={emp.id} className="rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                      className="w-full text-left p-4 hover:bg-stone-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-stone-800 truncate">{emp.name}</h3>
                          <p className="text-xs text-stone-500">{emp.role ?? 'No role'}</p>
                          {emp.department && (
                            <p className="text-xs text-stone-400">{emp.department}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                            style={{ backgroundColor: EMPLOYEE_TYPE_COLORS[emp.type] ?? '#6b7280' }}
                          >
                            {emp.type}
                          </span>
                          {isExpanded ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-stone-500">
                        {emp.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={10} />
                            {emp.phone}
                          </span>
                        )}
                        {emp.farm_name && <span>{emp.farm_name}</span>}
                        {emp.monthly_salary != null && (
                          <span className="ml-auto font-medium text-stone-700">{formatCurrency(emp.monthly_salary)}/mo</span>
                        )}
                        {emp.hourly_rate != null && !emp.monthly_salary && (
                          <span className="ml-auto font-medium text-stone-700">R{emp.hourly_rate}/hr</span>
                        )}
                      </div>
                    </button>

                    {/* Expanded: time entries */}
                    {isExpanded && (
                      <div className="border-t border-[#f3f4f3] p-4 bg-stone-50">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                            Recent Time Entries ({expandedEmployee?.time_entries?.length ?? 0})
                          </h4>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowTimeForm(!showTimeForm); }}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-700 text-white text-[10px] font-medium rounded-lg hover:bg-emerald-800 transition-colors"
                          >
                            <Plus size={12} />
                            Add Entry
                          </button>
                        </div>

                        {/* Time entry form */}
                        {showTimeForm && (
                          <form onSubmit={handleTimeSubmit} className="bg-white rounded-lg p-3 mb-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={timeForm.date}
                                onChange={(e) => setTimeForm({ ...timeForm, date: e.target.value })}
                                required
                                className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                              />
                              <input
                                type="number"
                                step="0.5"
                                placeholder="Hours"
                                value={timeForm.hours_worked}
                                onChange={(e) => setTimeForm({ ...timeForm, hours_worked: e.target.value })}
                                required
                                className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={timeForm.activity_type}
                                onChange={(e) => setTimeForm({ ...timeForm, activity_type: e.target.value })}
                                className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                              >
                                <option value="general">General</option>
                                <option value="harvesting">Harvesting</option>
                                <option value="planting">Planting</option>
                                <option value="spraying">Spraying</option>
                                <option value="maintenance">Maintenance</option>
                                <option value="livestock">Livestock</option>
                                <option value="irrigation">Irrigation</option>
                                <option value="admin">Admin</option>
                              </select>
                              <select
                                value={timeForm.enterprise}
                                onChange={(e) => setTimeForm({ ...timeForm, enterprise: e.target.value })}
                                className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                              >
                                <option value="">Enterprise (optional)</option>
                                {enterprises.map((ent) => (
                                  <option key={ent.id} value={ent.name}>{ent.name}</option>
                                ))}
                              </select>
                            </div>
                            <input
                              type="text"
                              placeholder="Notes (optional)"
                              value={timeForm.notes}
                              onChange={(e) => setTimeForm({ ...timeForm, notes: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setShowTimeForm(false)}
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

                        {/* Time entries table */}
                        {expandedEmployee?.time_entries && expandedEmployee.time_entries.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-stone-100">
                                <tr>
                                  <th className="text-left px-2 py-1.5 font-medium text-stone-600">Date</th>
                                  <th className="text-right px-2 py-1.5 font-medium text-stone-600">Hours</th>
                                  <th className="text-left px-2 py-1.5 font-medium text-stone-600">Activity</th>
                                  <th className="text-left px-2 py-1.5 font-medium text-stone-600 hidden sm:table-cell">Enterprise</th>
                                </tr>
                              </thead>
                              <tbody>
                                {expandedEmployee.time_entries.slice(0, 10).map((te) => (
                                  <tr key={te.id} className="border-b border-[#f3f4f3]">
                                    <td className="px-2 py-1.5 text-stone-800">{formatDate(te.date)}</td>
                                    <td className="px-2 py-1.5 text-right text-stone-800 font-medium">{te.hours_worked ?? '-'}</td>
                                    <td className="px-2 py-1.5 text-stone-600">{te.activity_type ?? '-'}</td>
                                    <td className="px-2 py-1.5 text-stone-600 hidden sm:table-cell">{te.enterprise ?? '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-stone-400">No time entries yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
