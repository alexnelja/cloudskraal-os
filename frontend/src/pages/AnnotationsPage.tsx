import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAnnotations } from '../api/annotations';
import type { Annotation, AnnotationType } from '../types/annotation';
import { formatDistance, formatArea } from '../components/map/tools/metricFormat';

type SortKey = 'title' | 'type' | 'created_at';
type FilterValue = 'all' | AnnotationType;

function metricFor(a: Annotation): string {
  if (a.type === 'line') return formatDistance(a.length_m);
  if (a.type === 'polygon') return formatArea(a.area_m2);
  return '';
}

function typeLabel(t: AnnotationType): string {
  if (t === 'line') return 'Line';
  if (t === 'polygon') return 'Polygon';
  return 'Pin';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export default function AnnotationsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    listAnnotations()
      .then((r) => { setRows(r); setLoading(false); })
      .catch((err) => { console.error(err); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (filter !== 'all') list = list.filter((r) => r.type === filter);
    if (q) list = list.filter((r) => r.title.toLowerCase().includes(q));
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, filter, search, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Annotations</h1>
        <button
          type="button"
          onClick={() => navigate('/map')}
          className="px-3 py-1 text-sm bg-stone-100 hover:bg-stone-200 rounded"
        >
          Back to map
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title…"
          className="border rounded px-3 py-1 text-sm"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterValue)}
          className="border rounded px-3 py-1 text-sm"
        >
          <option value="all">All types</option>
          <option value="line">Lines</option>
          <option value="polygon">Polygons</option>
          <option value="pin">Pins</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} of {rows.length}</span>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-500">No annotations match.</div>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-stone-100">
            <tr>
              {[
                { k: 'title', label: 'Title' },
                { k: 'type', label: 'Type' },
                { k: 'created_at', label: 'Created' },
              ].map((col) => (
                <th
                  key={col.k}
                  onClick={() => toggleSort(col.k as SortKey)}
                  className="text-left px-3 py-2 cursor-pointer hover:bg-stone-200"
                >
                  {col.label}
                  {sortKey === col.k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th className="text-left px-3 py-2">Metric</th>
              <th className="text-left px-3 py-2">Field</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => navigate(`/map?annotation=${r.id}`)}
                className="cursor-pointer hover:bg-amber-50 border-t"
              >
                <td className="px-3 py-2">{r.title}</td>
                <td className="px-3 py-2">{typeLabel(r.type)}</td>
                <td className="px-3 py-2">{formatDate(r.created_at)}</td>
                <td className="px-3 py-2">{metricFor(r)}</td>
                <td className="px-3 py-2 text-gray-500">{r.field_id ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
