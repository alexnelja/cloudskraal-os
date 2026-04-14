import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { API_BASE_URL } from '../api/config';

interface PriceRow {
  id: string;
  enterprise: string;
  year: number;
  price_per_kg: number;
  notes: string | null;
}

interface Props {
  enterprise: string;  // e.g. 'rooibos'
  label?: string;      // display name for the header; defaults to enterprise
}

/**
 * Renders a forecast line chart for the given enterprise's price/kg.
 * Years are always relative to today: the chart windows to [currentYear - 1, currentYear + 4]
 * and highlights the current year with a ReferenceLine. No year is hardcoded.
 */
export default function EnterprisePriceCurve({ enterprise, label }: Props) {
  const [rows, setRows] = useState<PriceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/enterprise-prices?enterprise=${encodeURIComponent(enterprise)}`)
      .then(r => r.json())
      .then(setRows)
      .catch(e => setError(String(e)));
  }, [enterprise]);

  if (error) return <div className="text-xs text-red-600">{error}</div>;
  if (!rows) return <div className="h-32 bg-stone-100 rounded animate-pulse" />;
  if (rows.length === 0) return null;

  const thisYear = new Date().getUTCFullYear();
  const windowStart = thisYear - 1;
  const windowEnd = thisYear + 4;
  const data = rows
    .filter(r => r.year >= windowStart && r.year <= windowEnd)
    .sort((a, b) => a.year - b.year)
    .map(r => ({ year: r.year, price: r.price_per_kg }));

  if (data.length === 0) return null;

  const title = label ?? enterprise.charAt(0).toUpperCase() + enterprise.slice(1);

  return (
    <div className="rounded-lg border border-stone-100 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-stone-700">{title} price forecast</h3>
        <span className="text-xs text-stone-400">
          {data[0].year}–{data[data.length - 1].year} · R/kg
        </span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#78716c' }} />
          <YAxis tick={{ fontSize: 10, fill: '#78716c' }} width={30} tickFormatter={v => `R${v}`} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(v) => [`R${Number(v)}/kg`, 'Price']}
            labelFormatter={y => `${y}${y === thisYear ? ' (now)' : ''}`}
          />
          <ReferenceLine x={thisYear} stroke="#059669" strokeDasharray="3 3" label={{ value: 'now', fill: '#059669', fontSize: 10, position: 'top' }} />
          <Line type="monotone" dataKey="price" stroke="#059669" strokeWidth={2} dot={{ r: 4, fill: '#059669' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
