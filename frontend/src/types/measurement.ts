export type MeasurementKind = 'length' | 'area';
export type MeasurementUnit = 'm' | 'km' | 'm²' | 'ha';

export interface Measurement {
  id: string;
  name: string;
  kind: MeasurementKind;
  value: number;
  unit: MeasurementUnit;
  formatted: string;
  geometry: string;
  field_id: string | null;
  notes: string | null;
  created_at: string;
}
