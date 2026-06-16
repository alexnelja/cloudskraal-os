type PestResult = {
  total_chemical?: number | null;
  unit?: string | null;
  total_water_l?: number | null;
  total_cost_zar?: number | null;
};

function n(v: number | null | undefined) {
  return v == null ? '—' : v.toLocaleString('en-ZA', { maximumFractionDigits: 2 });
}

export default function TankMix({ result }: { result: PestResult }) {
  const unit = result.unit ?? '';
  const hasWater = result.total_water_l != null && result.total_water_l > 0;
  const doseLabel = `${n(result.total_chemical)} ${unit}`.trim();
  return (
    <div className="w-full">
      {hasWater ? (
        <div data-testid="tankmix-water" className="rounded-xl border border-stone-200 overflow-hidden">
          <div className="bg-sky-100 px-3 py-4 text-center text-xs text-sky-800">
            {`water ${n(result.total_water_l)} L`}
          </div>
          <div className="bg-emerald-600 text-white px-3 py-1.5 text-center text-xs">
            {`chemical ${doseLabel}`}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-emerald-600 text-white px-3 py-3 text-center text-sm">
          {`dose ${doseLabel}`}
        </div>
      )}
      <div className="mt-2 flex justify-between text-xs text-stone-500">
        <span>Total dose</span>
        <span className="font-semibold text-stone-800">{`R ${n(result.total_cost_zar)}`}</span>
      </div>
    </div>
  );
}
