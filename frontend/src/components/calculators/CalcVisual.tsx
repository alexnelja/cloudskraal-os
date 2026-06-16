import type { CalcDef } from '../../config/calculators';
import EnvelopeGauge from './EnvelopeGauge';
import TankMix from './TankMix';
import SprayerSchematic from './SprayerSchematic';
import PipeSchematic from './PipeSchematic';
import PumpSchematic from './PumpSchematic';

type ResultMap = Record<string, number | string | null | undefined>;
const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);

export default function CalcVisual({ calc, result }: { calc: CalcDef; result: ResultMap }) {
  const v = calc.visual;
  if (!v) return null;

  if (v.kind === 'tankmix') {
    return (
      <div className="mb-4">
        <TankMix result={{
          total_chemical: num(result.total_chemical),
          unit: typeof result.unit === 'string' ? result.unit : null,
          total_water_l: num(result.total_water_l),
          total_cost_zar: num(result.total_cost_zar),
        }} />
      </div>
    );
  }

  const value = num(result[v.gauge.resultKey]);
  if (value == null) return null;

  const recommended = v.kind === 'gauge+schematic' && v.schematic === 'pump'
    ? num(result.recommended_motor_kw) ?? undefined
    : undefined;

  return (
    <div className="mb-4 space-y-3">
      <EnvelopeGauge value={value} gauge={v.gauge} recommended={recommended} />
      {v.kind === 'gauge+schematic' && v.schematic === 'sprayer' && <SprayerSchematic lHa={value} />}
      {v.kind === 'gauge+schematic' && v.schematic === 'pipe' && (
        <PipeSchematic velocity={value} headLoss={num(result.head_loss_m)} />
      )}
      {v.kind === 'gauge+schematic' && v.schematic === 'pump' && (
        <PumpSchematic kw={value} motorKw={num(result.recommended_motor_kw)} />
      )}
    </div>
  );
}
