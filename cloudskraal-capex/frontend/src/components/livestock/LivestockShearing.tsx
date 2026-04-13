import type { ShearingRecord } from '../../types/phase2';
import EditableCell from '../EditableCell';

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  records: ShearingRecord[];
  onUpdate: (id: string, data: Partial<ShearingRecord>) => void;
}

export default function LivestockShearing({ records, onUpdate }: Props) {
  if (records.length === 0) {
    return (
      <div className="p-4">
        <p className="text-xs text-stone-400">No shearing records yet.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="overflow-x-auto rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-[#f3f4f3] border-b border-[#f3f4f3]">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-stone-600">Date</th>
              <th className="text-left px-3 py-2 font-medium text-stone-600 hidden sm:table-cell">Group</th>
              <th className="text-right px-3 py-2 font-medium text-stone-600">Head</th>
              <th className="text-right px-3 py-2 font-medium text-stone-600">Total kg</th>
              <th className="text-right px-3 py-2 font-medium text-stone-600 hidden sm:table-cell">Avg kg</th>
              <th className="text-right px-3 py-2 font-medium text-stone-600 hidden sm:table-cell">Micron</th>
              <th className="text-right px-3 py-2 font-medium text-stone-600 hidden md:table-cell">Yield %</th>
              <th className="text-left px-3 py-2 font-medium text-stone-600 hidden md:table-cell">Buyer</th>
              <th className="text-right px-3 py-2 font-medium text-stone-600 hidden sm:table-cell">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {records.map((rec) => (
              <tr key={rec.id} className="border-b border-[#f3f4f3]">
                <td className="px-3 py-2 text-stone-800">
                  <EditableCell
                    value={rec.date ?? ''}
                    type="date"
                    onSave={(val) => onUpdate(rec.id, { date: val })}
                  />
                </td>
                <td className="px-3 py-2 text-stone-600 hidden sm:table-cell">{rec.group_name ?? '-'}</td>
                <td className="px-3 py-2 text-right text-stone-800">
                  <EditableCell
                    value={rec.head_shorn != null ? String(rec.head_shorn) : ''}
                    type="number"
                    onSave={(val) => onUpdate(rec.id, { head_shorn: val ? Number(val) : null })}
                  />
                </td>
                <td className="px-3 py-2 text-right font-medium text-stone-800">
                  <EditableCell
                    value={rec.total_fleece_kg != null ? String(rec.total_fleece_kg) : ''}
                    type="number"
                    onSave={(val) => onUpdate(rec.id, { total_fleece_kg: val ? Number(val) : null })}
                  />
                </td>
                <td className="px-3 py-2 text-right text-stone-600 hidden sm:table-cell">
                  <EditableCell
                    value={rec.avg_fleece_kg != null ? String(rec.avg_fleece_kg) : ''}
                    type="number"
                    onSave={(val) => onUpdate(rec.id, { avg_fleece_kg: val ? Number(val) : null })}
                  />
                </td>
                <td className="px-3 py-2 text-right text-stone-600 hidden sm:table-cell">
                  <EditableCell
                    value={rec.micron_avg != null ? String(rec.micron_avg) : ''}
                    type="number"
                    onSave={(val) => onUpdate(rec.id, { micron_avg: val ? Number(val) : null })}
                  />
                </td>
                <td className="px-3 py-2 text-right text-stone-600 hidden md:table-cell">
                  <EditableCell
                    value={rec.yield_pct != null ? String(rec.yield_pct) : ''}
                    type="number"
                    onSave={(val) => onUpdate(rec.id, { yield_pct: val ? Number(val) : null })}
                  />
                </td>
                <td className="px-3 py-2 text-stone-600 hidden md:table-cell">
                  <EditableCell
                    value={rec.buyer ?? ''}
                    onSave={(val) => onUpdate(rec.id, { buyer: val || null })}
                  />
                </td>
                <td className="px-3 py-2 text-right font-medium text-emerald-700 hidden sm:table-cell">
                  <EditableCell
                    value={rec.total_revenue != null ? String(rec.total_revenue) : ''}
                    type="number"
                    onSave={(val) => onUpdate(rec.id, { total_revenue: val ? Number(val) : null })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
