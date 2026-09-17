// =========================================================================
// 1. DATA INITIALIZATION & STUDY AREA
// =========================================================================

// Load Boundary
var county = ee.FeatureCollection(
  "projects/originhackathon-comm/assets/EmbuCounty",
);

// Load Cell Towers
var towers = ee
  .FeatureCollection("projects/originhackathon-comm/assets/639CellTowers")
  .filterBounds(county);

// Load Population Points (Populated Places)
var population = ee
  .FeatureCollection(
    "projects/originhackathon-comm/assets/populated_places_points",
  )
  .filterBounds(county);

// Load Roads
var roads = ee
  .FeatureCollection("projects/originhackathon-comm/assets/roads_lines")
  .filterBounds(county);

// Center the map
Map.centerObject(county, 11);

// =========================================================================
// 2. TERRAIN ANALYSIS (SRTM 30m DEM)
// =========================================================================

var srtm = ee.Image("USGS/SRTMGL1_003").clip(county);
var elevation = srtm.select("elevation");

// Calculate Slope (in degrees)
var slope = ee.Terrain.slope(elevation);

// =========================================================================
// 3. TOWER FILTERING & GAP IDENTIFICATION
// =========================================================================

// Isolate the advanced networks (3G, 4G, 5G) and 2G (GSM)
var advancedTowers = towers.filter(
  ee.Filter.inList("radio", ["UMTS", "LTE", "NR"]),
);
var gsmTowers = towers.filter(ee.Filter.eq("radio", "GSM"));

print("--- TOWER ANALYTICS ---");
print("Total Towers in Embu:", towers.size());
print("Advanced Towers (3G/4G/5G):", advancedTowers.size());
print("GSM Towers (2G):", gsmTowers.size());
print("Populated Places Count:", population.size());

// =========================================================================
// 4. SITE SUITABILITY MODEL (MULTI-CRITERIA DECISION ANALYSIS)
// =========================================================================

// --- A. Calculate Distances ---
// 1. Distance to existing advanced towers (Max search: 10km). We want HIGH distance (Gaps).
var distTowers = advancedTowers
  .distance({ searchRadius: 10000, maxError: 50 })
  .clip(county);

// 2. Distance to Population (Max search: 5km). We want LOW distance (High demand).
var distPop = population
  .distance({ searchRadius: 5000, maxError: 50 })
  .clip(county);

// 3. Distance to Roads (Max search: 3km). We want LOW distance (Construction access).
var distRoads = roads
  .distance({ searchRadius: 3000, maxError: 50 })
  .clip(county);

// --- B. Normalize Factors (0 to 1 Scale, where 1 is Highly Suitable) ---

// 1. Coverage Gap Score: Further from existing 3G/4G/5G = Better (1 at 10km away)
var gapScore = distTowers.divide(10000).clamp(0, 1);

// 2. Population Score: Closer to population = Better (1 at 0km, 0 at 5km away)
var popScore = ee.Image(1).subtract(distPop.divide(5000)).clamp(0, 1);

// 3. Road Access Score: Closer to roads = Better (1 at 0km, 0 at 3km away)
var roadScore = ee.Image(1).subtract(distRoads.divide(3000)).clamp(0, 1);

// 4. Elevation Score: Higher elevation = Better line of sight
var minMaxElev = elevation.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: county.geometry(),
  scale: 90,
});
var minElev = ee.Number(minMaxElev.get("elevation_min"));
var maxElev = ee.Number(minMaxElev.get("elevation_max"));
var elevScore = elevation.subtract(minElev).divide(maxElev.subtract(minElev));

// 5. Slope Constraint Score: Flat is best. Linear drop off after 10 degrees, 0 suitability > 25 degrees.
var slopeScore = ee
  .Image(1)
  .where(slope.gt(10), ee.Image(1).subtract(slope.subtract(10).divide(15)))
  .where(slope.gt(25), 0)
  .clamp(0, 1);

// --- C. Weighted Overlay ---
// Weights: Population (35%), Coverage Gap (25%), Roads (20%), Elevation (10%), Slope (10%)
var suitabilityMap = popScore
  .multiply(0.35)
  .add(gapScore.multiply(0.25))
  .add(roadScore.multiply(0.2))
  .add(elevScore.multiply(0.1))
  .add(slopeScore.multiply(0.1))
  .rename("suitability_score");

// Mask out completely unsuitable steep areas (slope > 25 degrees)
var finalSuitability = suitabilityMap.updateMask(slope.lte(25)).clip(county);

// =========================================================================
// 5. MAP VISUALIZATION
// =========================================================================

// Base layers
Map.addLayer(
  elevation,
  {
    min: 500,
    max: 2500,
    palette: ["#f0f9e8", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe"],
  },
  "Elevation",
  false,
);
Map.addLayer(
  slope,
  { min: 0, max: 30, palette: ["white", "yellow", "red"] },
  "Slope",
  false,
);

// Infrastructure & Demand
Map.addLayer(roads, { color: "gray", strokeWidth: 1 }, "Road Network");
Map.addLayer(population, { color: "purple" }, "Populated Places");
Map.addLayer(gsmTowers, { color: "red" }, "GSM Towers (2G)");
Map.addLayer(advancedTowers, { color: "blue" }, "Existing 3G/4G/5G Towers");

// Suitability Result
var suitabilityVis = {
  min: 0.2,
  max: 0.85,
  palette: ["#d73027", "#fc8d59", "#fee08b", "#d9ef8b", "#91cf60", "#1a9850"],
};
Map.addLayer(finalSuitability, suitabilityVis, "Optimal 3G/4G/5G Suitability");

// Boundary
Map.addLayer(
  county.style({ color: "black", fillColor: "00000000", width: 2 }),
  {},
  "Embu Boundary",
);

// =========================================================================
// 6. EXPORTING DATA FOR QGIS (RASTERS AND VECTORS)
// =========================================================================

// --- RASTER EXPORTS (GeoTIFF) ---

// Export 1: Final Suitability Raster Map
Export.image.toDrive({
  image: finalSuitability,
  description: "Embu_3G_4G_5G_Suitability",
  folder: "GEE_Embu_Project",
  scale: 30,
  region: county.geometry(),
  maxPixels: 1e10,
});

// Export 2: Elevation DEM Raster
Export.image.toDrive({
  image: elevation,
  description: "Embu_Elevation_DEM",
  folder: "GEE_Embu_Project",
  scale: 30,
  region: county.geometry(),
  maxPixels: 1e10,
});

// Export 3: Slope Raster
Export.image.toDrive({
  image: slope,
  description: "Embu_Slope",
  folder: "GEE_Embu_Project",
  scale: 30,
  region: county.geometry(),
  maxPixels: 1e10,
});

// --- VECTOR EXPORTS (Shapefiles) ---

// Export 4: Embu Boundary
Export.table.toDrive({
  collection: county,
  description: "Embu_Boundary",
  folder: "GEE_Embu_Project",
  fileFormat: "SHP",
});

// Export 5: Advanced Towers (3G/4G/5G)
Export.table.toDrive({
  collection: advancedTowers,
  description: "Embu_Advanced_Towers",
  folder: "GEE_Embu_Project",
  fileFormat: "SHP",
});

// Export 6: GSM Towers (2G)
Export.table.toDrive({
  collection: gsmTowers,
  description: "Embu_GSM_Towers",
  folder: "GEE_Embu_Project",
  fileFormat: "SHP",
});

// Export 7: Populated Places
Export.table.toDrive({
  collection: population,
  description: "Embu_Populated_Places",
  folder: "GEE_Embu_Project",
  fileFormat: "SHP",
});

// Export 8: Road Network
Export.table.toDrive({
  collection: roads,
  description: "Embu_Road_Network",
  folder: "GEE_Embu_Project",
  fileFormat: "SHP",
});

// =========================================================================
// 7. ADDING A MAP LEGEND (UI PANEL)
// =========================================================================

// Create the main legend panel
var legend = ui.Panel({
  style: {
    position: "bottom-left",
    padding: "8px 15px",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
});

// Create and add the legend title
var legendTitle = ui.Label({
  value: "Telecom Site Suitability",
  style: {
    fontWeight: "bold",
    fontSize: "16px",
    margin: "0 0 4px 0",
    padding: "0",
  },
});
legend.add(legendTitle);

// Function to create categorical legend rows (Points/Lines)
var makeRow = function (color, name) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: color,
      padding: "8px",
      margin: "0 0 4px 0",
      border: "1px solid black",
    },
  });
  var description = ui.Label({
    value: name,
    style: { margin: "0 0 4px 6px" },
  });
  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow("horizontal"),
  });
};

// Add the infrastructure categories to the legend (including 2G)
legend.add(makeRow("blue", "Existing 3G/4G/5G Towers"));
legend.add(makeRow("red", "GSM Towers (2G)"));
legend.add(makeRow("purple", "Populated Places"));
legend.add(makeRow("gray", "Road Network"));

// Add a title for the gradient scale
var gradientTitle = ui.Label("Suitability Score", {
  fontWeight: "bold",
  fontSize: "14px",
  margin: "10px 0 4px 0",
});
legend.add(gradientTitle);

// Create the gradient color bar using your suitabilityVis palette
var makeColorBar = function (palette) {
  return ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: {
      bbox: [0, 0, 1, 0.1],
      dimensions: "100x10",
      format: "png",
      min: 0,
      max: 1,
      palette: palette,
    },
    style: { stretch: "horizontal", margin: "0px 8px", maxHeight: "20px" },
  });
};

var colorBar = makeColorBar(suitabilityVis.palette);

// Create labels for the gradient (Low to High)
var legendLabels = ui.Panel({
  widgets: [
    ui.Label("Low", { margin: "4px 8px" }),
    ui.Label("", {
      margin: "4px 8px",
      textAlign: "center",
      stretch: "horizontal",
    }),
    ui.Label("High", { margin: "4px 8px" }),
  ],
  layout: ui.Panel.Layout.flow("horizontal"),
});

// Add the gradient bar and labels to the legend
legend.add(colorBar);
legend.add(legendLabels);

// Finally, add the fully constructed legend to the Map
Map.add(legend);
