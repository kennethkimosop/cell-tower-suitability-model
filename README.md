# GIS-Based Spatial Suitability Analysis for 3G/4G/5G Tower Placement

**Study Area:** Embu County, Kenya  
**Tools Used:** Google Earth Engine (JavaScript), QGIS, Python

## Project Overview

Despite growing reliance on digital connectivity, advanced cellular infrastructure (3G/4G/5G) is unevenly distributed across Embu County. This project identifies underserved populated areas and determines suitable zones for infrastructure expansion using spatial Multi-Criteria Decision Analysis (MCDA).

## Workflow Architecture

1. **Google Earth Engine (GEE):** Executed server-side raster calculations, Euclidean distance transforms, DEM terrain derivation, and weighted overlay modeling.
2. **QGIS:** Imported processed raster surfaces and vector layers for cartographic composition, symbology, and layout production.

## Data Sources

- **Administrative Boundary:** GADM (Level 1 - Embu County)
- **Cell Site Records:** OpenCelliD (1,341 recorded sites; filtered to 118 advanced UMTS/LTE/NR sites)
- **Road Network:** Humanitarian Data Exchange (HDX)
- **Populated Places:** HDX / OpenStreetMap (37 recorded settlement nodes)
- **Elevation (DEM):** USGS SRTM 30m Global Elevation

## Multi-Criteria Suitability Model

Five criteria layers were normalized to a common scale ( \text{ to } 1$) and aggregated using weighted linear combination:

README.mdS = 0.35P + 0.25G + 0.20R + 0.10E + 0.10TREADME.md

Where:

- **P (Settlement Proximity - 35%):** Prioritizes locations near recorded settlements.
- **G (Infrastructure Gap - 25%):** Prioritizes locations furthest from existing advanced sites.
- **R (Road Accessibility - 20%):** Minimizes construction and access costs.
- **E (Elevation - 10%):** Favors line-of-sight signal transmission.
- **T (Slope - 10%):** Favors stable topography; slopes $> 25^\circ$ strictly excluded.

## Repository Structure

- Documentation/ - Project technical report and presentation materials
- Final Maps/ - High-resolution cartographic map deliverables
- processed/ - Extracted vector boundaries and processed shapefiles
- Outputs/ - Model exports and intermediate raster packages
- RawData/ - Source attribute records and tabular data

### Reproducing the Analysis in Google Earth Engine

1. Open the [Google Earth Engine Code Editor](https://code.earthengine.google.com/).
2. Open the script located at [`scripts/GEE_Analysis_Script.js`](./scripts/GEE_Analysis_Script.js).
3. Ensure asset IDs match your account's asset storage:
   - Study Boundary: `projects/originhackathon-comm/assets/EmbuCounty`
   - Cell Towers: `projects/originhackathon-comm/assets/639CellTowers`
   - Populated Places: `projects/originhackathon-comm/assets/populated_places_points`
   - Road Lines: `projects/originhackathon-comm/assets/roads_lines`
4. Click **Run** to generate the interactive preview and execute the tasks in the **Tasks** panel to export the GeoTIFFs and Shapefiles.
