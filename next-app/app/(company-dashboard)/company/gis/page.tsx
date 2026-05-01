"use client";

import dynamic from "next/dynamic";

const GisLandSelectionPage = dynamic(() => import("@/app/gis-land-selection/page"), {
  ssr: false,
});

export default function CompanyGisPage() {
  return <GisLandSelectionPage />;
}
