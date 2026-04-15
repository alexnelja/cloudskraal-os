import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Drop, Gauge, Leaf, ArrowClockwise } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../api/config';

interface SoilData {
  pH: number | null;
  clay_pct: number | null;
  soc_g_per_kg: number | null;
  source: string;
  as_of: string;
}

interface EnrichmentResponse {
  centroid: { lng: number; lat: number };
  soil: SoilData | null;
  error?: string;
}

interface Props {
  fieldId: string;
}

function Tile({
  icon: Icon,
  label,
  value,
  unit,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; weight?: 'duotone' | 'regular' | 'fill' }>;
  label: string;
  value: string | number | null;
  unit?: string;
  tone: 'amber' | 'emerald' | 'rose';
}) {
  const bg =
    tone === 'amber'
      ? 'linear-gradient(135deg, rgba(254, 243, 199, 0.9), rgba(253, 224, 155, 0.5))'
      : tone === 'emerald'
      ? 'linear-gradient(135deg, rgba(209, 250, 229, 0.9), rgba(167, 243, 208, 0.5))'
      : 'linear-gradient(135deg, rgba(255, 228, 230, 0.9), rgba(253, 186, 191, 0.5))';
  const fg =
    tone === 'amber' ? 'text-amber-800' : tone === 'emerald' ? 'text-emerald-800' : 'text-rose-800';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="rounded-xl p-3"
      style={{
        background: bg,
        border: '1px solid rgba(255, 255, 255, 0.7)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 4px 12px -4px rgba(60, 40, 20, 0.12)',
      }}
    >
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] ${fg} opacity-80`}>
        <Icon size={12} weight="duotone" />
        {label}
      </div>
      <div className={`mt-1 text-xl font-serif ${fg} tracking-tight`}>
        {value == null ? (
          <span className="opacity-40">—</span>
        ) : (
          <>
            {value}
            {unit && <span className="text-[11px] font-sans ml-1 opacity-70">{unit}</span>}
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function FieldEnrichmentTab({ fieldId }: Props) {
  const [data, setData] = useState<EnrichmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchIt = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`${API_BASE_URL}/fields/${fieldId}/enrichment`);
      if (!r.ok) throw new Error(`${r.status}`);
      setData(await r.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIt(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [fieldId]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-serif font-medium text-stone-900">Field enrichment</h3>
          <p className="text-[11px] text-stone-500 mt-0.5">
            External GIS data at this field's centroid
          </p>
        </div>
        <motion.button
          onClick={fetchIt}
          disabled={loading}
          whileTap={{ scale: 0.92, rotate: -180 }}
          whileHover={{ scale: 1.04 }}
          className="p-1.5 rounded-md hover:bg-stone-100 text-stone-500 disabled:opacity-40"
          aria-label="Refresh enrichment"
        >
          <ArrowClockwise size={14} weight="bold" />
        </motion.button>
      </div>

      {err && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2">
          Failed: {err}
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-3 gap-2 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-stone-100" />
          ))}
        </div>
      ) : data?.soil ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Tile icon={Drop} label="pH" value={data.soil.pH} tone="emerald" />
            <Tile icon={Leaf} label="Clay" value={data.soil.clay_pct} unit="%" tone="amber" />
            <Tile icon={Gauge} label="SOC" value={data.soil.soc_g_per_kg} unit="g/kg" tone="rose" />
          </div>
          <div className="text-[10px] text-stone-400 mt-2">
            {data.soil.source}
            <br />
            Centroid: {data.centroid.lat.toFixed(4)}, {data.centroid.lng.toFixed(4)}
          </div>
        </>
      ) : (
        <div className="text-xs text-stone-500">No soil data available at this location.</div>
      )}
    </div>
  );
}
