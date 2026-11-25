export interface ProjectLocation {
  displayName: string;
  lat: number | null;
  lng: number | null;
}

export function formatProjectLocation(input: unknown) {
  const location = normalizeProjectLocation(input);
  if (location.displayName) return location.displayName;
  if (location.lat !== null && location.lng !== null) {
    return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  }
  return "";
}

export function normalizeProjectLocation(input: unknown): ProjectLocation {
  if (typeof input === "string") {
    return {
      displayName: input.trim(),
      lat: null,
      lng: null,
    };
  }

  if (input && typeof input === "object") {
    const value = input as {
      displayName?: string;
      lat?: number | null;
      lng?: number | null;
    };
    return {
      displayName: (value.displayName || "").trim(),
      lat:
        typeof value.lat === "number" && Number.isFinite(value.lat)
          ? value.lat
          : null,
      lng:
        typeof value.lng === "number" && Number.isFinite(value.lng)
          ? value.lng
          : null,
    };
  }

  return {
    displayName: "",
    lat: null,
    lng: null,
  };
}
