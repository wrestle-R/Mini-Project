from __future__ import annotations

import unittest

from shapely.geometry import Polygon

from backend.gis.environmental_scorer import assess_environmental_context
from backend.gis.infrastructure_scorer import assess_infrastructure_context
from backend.gis.schemas import BoundingBox, OsmContextResult, OsmFeature


class GisIntelligenceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.land_poly = Polygon([(0, 0), (100, 0), (100, 100), (0, 100), (0, 0)])
        self.model_poly = Polygon([(10, 10), (60, 10), (60, 60), (10, 60), (10, 10)])
        self.empty_osm = OsmContextResult(
            bbox=BoundingBox(min_lon=0, min_lat=0, max_lon=1, max_lat=1),
            roads=[],
            landuse=[],
            places=[],
            buildings=[],
            exclusions=[],
            infrastructure=[],
        )

    def test_environmental_context_detects_water_overlap_risk(self) -> None:
        osm = self.empty_osm.model_copy(
            update={
                "exclusions": [
                    OsmFeature(
                        feature_type="exclusion",
                        tags={"natural": "water"},
                        geometry={
                            "type": "Polygon",
                            "coordinates": [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]],
                        },
                    )
                ]
            }
        )

        summary = assess_environmental_context(self.land_poly, self.model_poly, 0, 0, osm)
        self.assertIsNotNone(summary)
        assert summary is not None
        self.assertGreater(summary.metrics.water_overlap_area_sqm, 0)
        self.assertIn(summary.flood_risk_level, {"high", "critical"})
        self.assertTrue(summary.constraints)

    def test_infrastructure_context_scores_available_utilities(self) -> None:
        osm = self.empty_osm.model_copy(
            update={
                "infrastructure": [
                    OsmFeature(
                        feature_type="infrastructure",
                        tags={"power": "line", "infrastructure_type": "power"},
                        geometry={"type": "LineString", "coordinates": [[0, 0], [0, 0.001]]},
                    ),
                    OsmFeature(
                        feature_type="infrastructure",
                        tags={"man_made": "water_works", "infrastructure_type": "water"},
                        geometry={"type": "Point", "coordinates": [0.0003, 0.0003]},
                    ),
                    OsmFeature(
                        feature_type="infrastructure",
                        tags={"highway": "bus_stop", "infrastructure_type": "transit"},
                        geometry={"type": "Point", "coordinates": [0.0002, 0.0002]},
                    ),
                ]
            }
        )

        summary = assess_infrastructure_context(self.land_poly, 0, 0, osm, nearest_road_distance_m=25)
        self.assertIsNotNone(summary)
        assert summary is not None
        self.assertGreater(summary.readiness_score, 0)
        self.assertIn("power", summary.available_utilities)
        self.assertIn("water", summary.available_utilities)
        self.assertTrue(summary.logistics_notes)


if __name__ == "__main__":
    unittest.main()
