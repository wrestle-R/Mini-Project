import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "GIS Land Selection · BuildSync",
  description:
    "AI-powered geospatial land selection for India. Navigate by natural language, draw polygons, and get ranked land recommendations powered by OSM and spatial intelligence.",
};

interface GisLandSelectionLayoutProps {
  children: ReactNode;
}

export default function GisLandSelectionLayout({ children }: GisLandSelectionLayoutProps) {
  return children;
}
