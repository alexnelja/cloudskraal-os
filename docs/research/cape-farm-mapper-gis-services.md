# Cape Farm Mapper & SA Agricultural GIS Services

## Elsenburg ArcGIS REST Services
**Base URL:** `https://gis.elsenburg.com/arcgis/rest/services`
Server: ArcGIS 10.91, freely accessible.

### Key Services
- `Soils/MapServer` — soil classification
- `Climate/MapServer` — monthly rainfall (1950-2000)
- `Vegetation/MapServer` — VegMap 2006 (435 types)
- `Geology/CGS_1M_Geology/MapServer` — geological classification
- `CapeNature/Fires/MapServer` — fire data
- `Topography/SUDEM80/MapServer` — DEM elevation
- `SG/` — Surveyor General cadastral boundaries
- `Agric_Census_2013/`, `Agric_Census_2017/` — census data

### Other Elsenburg Apps
- Cape Farm Mapper: https://gis.elsenburg.com/apps/cfm/
- Sentinel-2 Viewer: https://gis.elsenburg.com/apps/s2v/
- Weather Stations: https://gis.elsenburg.com/apps/wsp/

## NDA (National Dept of Agriculture) ArcGIS REST
**Base URL:** `https://ndagis.nda.agric.za/arcgis/rest/services`
Server: ArcGIS 11.3, freely accessible.

### Key Services
- `Western_Cape/MapServer` — 160+ layers: soil, rainfall, geology, vegetation, water, land use, agricultural capability
- `Northern_Cape/MapServer` — same layer structure for Nieuwoudtville area

## ISRIC SoilGrids (Global, 250m resolution)
**WMS:** `https://maps.isric.org/mapserv?map=/map/{property}.map`

Properties: pH, nitrogen, organic carbon, clay/sand/silt content, bulk density, CEC.
Depths: 0-5cm through 100-200cm.

## Other Free Sources
| Source | URL | Data |
|--------|-----|------|
| E-GIS Land Cover | egis.environment.gov.za | SANLC 2018/2020/2022, 73 classes |
| Council for Geoscience | maps.geoscience.org.za | Geology maps |
| DWS Water Resources | dws.gov.za/iwqs/gis_data/ | Rivers, catchments |
| AGIS Portal | agis.nda.agric.za | Agricultural atlas + downloads |

## MapLibre/Mapbox Integration
All ArcGIS REST services consumable via:
- Raster tiles: `.../MapServer/tile/{z}/{y}/{x}`
- Export endpoint: `.../MapServer/export?...`
- WMS: append `/WMSServer` to any MapServer URL
- Libraries: mapbox-gl-esri-sources, mapbox-gl-arcgis-featureserver
