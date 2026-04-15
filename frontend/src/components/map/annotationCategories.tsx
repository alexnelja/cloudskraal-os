import type { ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import {
  Gauge, Lightning, Drop, Cylinder, Faders, Plug, PlugCharging, SunHorizon,
  BowlFood, Grains, Barricade, House, Tractor, Wrench, Flag, MapPin,
  Path, Footprints, Lightbulb, Jeep, Barn, Park, ShippingContainer,
  LineSegment, WaveSquare,
} from '@phosphor-icons/react';
import type { AnnotationType } from '../../types/annotation';

export interface CategoryDef {
  id: string;
  label: string;
  Icon: ComponentType<IconProps>;
}

export const PIN_CATEGORIES: CategoryDef[] = [
  { id: 'pump', label: 'Pump', Icon: Gauge },
  { id: 'motor', label: 'Motor', Icon: Lightning },
  { id: 'borehole', label: 'Borehole', Icon: Drop },
  { id: 'tank', label: 'Tank', Icon: Cylinder },
  { id: 'valve', label: 'Valve', Icon: Faders },
  { id: 'electrical_box', label: 'Electrical', Icon: Plug },
  { id: 'solar_panel', label: 'Solar', Icon: SunHorizon },
  { id: 'trough', label: 'Trough', Icon: BowlFood },
  { id: 'feed_station', label: 'Feed', Icon: Grains },
  { id: 'gate', label: 'Gate', Icon: Barricade },
  { id: 'shed', label: 'Shed', Icon: House },
  { id: 'silo', label: 'Silo', Icon: Cylinder },
  { id: 'tractor', label: 'Tractor', Icon: Tractor },
  { id: 'implement', label: 'Implement', Icon: Wrench },
  { id: 'beacon', label: 'Beacon', Icon: Flag },
  { id: 'generic', label: 'Generic', Icon: MapPin },
];

export const LINE_CATEGORIES: CategoryDef[] = [
  { id: 'pipe', label: 'Pipe', Icon: WaveSquare },
  { id: 'cable', label: 'Cable', Icon: PlugCharging },
  { id: 'powerline', label: 'Powerline', Icon: Lightning },
  { id: 'fence', label: 'Fence', Icon: LineSegment },
  { id: 'road', label: 'Road', Icon: Jeep },
  { id: 'path', label: 'Path', Icon: Footprints },
  { id: 'irrigation_line', label: 'Irrigation', Icon: Drop },
  { id: 'generic', label: 'Generic', Icon: Path },
];

export const POLYGON_CATEGORIES: CategoryDef[] = [
  { id: 'dam', label: 'Dam', Icon: Drop },
  { id: 'kraal', label: 'Kraal', Icon: LineSegment },
  { id: 'paddock', label: 'Paddock', Icon: Park },
  { id: 'yard', label: 'Yard', Icon: Barn },
  { id: 'orchard_block', label: 'Orchard', Icon: Grains },
  { id: 'crop_block', label: 'Crop Block', Icon: Grains },
  { id: 'alien_veg_patch', label: 'Alien Veg', Icon: Lightbulb },
  { id: 'shed_area', label: 'Shed Area', Icon: ShippingContainer },
  { id: 'generic', label: 'Generic', Icon: MapPin },
];

export const CATEGORIES: Record<AnnotationType, CategoryDef[]> = {
  pin: PIN_CATEGORIES,
  line: LINE_CATEGORIES,
  polygon: POLYGON_CATEGORIES,
};

export function getCategoryDef(type: AnnotationType, id: string | null | undefined): CategoryDef {
  const list = CATEGORIES[type] ?? [];
  if (!id) return list.find((c) => c.id === 'generic') ?? list[0];
  return list.find((c) => c.id === id) ?? list.find((c) => c.id === 'generic') ?? list[0];
}
