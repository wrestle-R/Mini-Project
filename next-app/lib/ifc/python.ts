const DEFAULT_PYTHON_API_BASE_URL = "http://localhost:8000";

export function getPythonApiBaseUrl() {
  return process.env.PYTHON_API_BASE_URL || DEFAULT_PYTHON_API_BASE_URL;
}

export function buildPythonAssetUrl(assetPath: string) {
  if (!assetPath) return assetPath;
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
    return assetPath;
  }
  return `${getPythonApiBaseUrl()}${assetPath}`;
}
