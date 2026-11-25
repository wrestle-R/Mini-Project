"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default marker icon paths (broken in webpack/Next.js)
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const markerIconCache = new Map<string, L.DivIcon>();

function getMarkerIcon(color: string) {
  const cached = markerIconCache.get(color);
  if (cached) return cached;

  const icon = L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #ffffff;box-shadow:0 1px 6px rgba(0,0,0,.45);"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  markerIconCache.set(color, icon);
  return icon;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}

interface LeafletMapProps {
  lat: number;
  lng: number;
  zoom: number;
  onMapClick?: (lat: number, lng: number) => void;
  markers?: {
    id: string;
    lat: number;
    lng: number;
    popup?: string;
    color?: string;
  }[];
  className?: string;
  scrollWheelZoom?: boolean;
}

export default function LeafletMap({
  lat,
  lng,
  zoom,
  onMapClick,
  markers,
  className,
  scrollWheelZoom = false,
}: LeafletMapProps) {
  const visibleMarkers = (markers || []).filter(
    (marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lng)
  );

  return (
    <div className={className || "h-52 w-full overflow-hidden rounded-xl border"}>
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={scrollWheelZoom}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap lat={lat} lng={lng} zoom={zoom} />
        {typeof onMapClick === "function" && (
          <MapClickHandler onMapClick={onMapClick} />
        )}
        {visibleMarkers.length > 0
          ? visibleMarkers.map((marker) => (
              <Marker
                key={marker.id}
                position={[marker.lat, marker.lng]}
                icon={getMarkerIcon(marker.color || "#2563eb")}
              >
                {marker.popup ? <Popup>{marker.popup}</Popup> : null}
              </Marker>
            ))
          : Number.isFinite(lat) && Number.isFinite(lng) && (
              <Marker position={[lat, lng]} />
            )}
      </MapContainer>
    </div>
  );
}
