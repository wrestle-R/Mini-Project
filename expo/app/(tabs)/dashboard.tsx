import { useFocusEffect } from 'expo-router';
import { BriefcaseIcon, CheckCheckIcon, ClipboardListIcon, TriangleAlertIcon } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useWorkerSession } from '@/contexts/worker-session-context';
import { getWorkerDashboardStats } from '@/lib/api';
import type { DashboardMapProject, WorkerStats } from '@/lib/types';

const INDIA_CENTER = { latitude: 20.5937, longitude: 78.9629 };

const defaultStats: WorkerStats = {
  openOpportunities: 0,
  pendingApplications: 0,
  acceptedProjects: 0,
  currentAssignments: 0,
};

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ComponentProps<typeof Icon>['as'] }) {
  return (
    <View className="w-[48%] rounded-xl border border-border bg-card p-3">
      <View className="mb-2 h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        <Icon as={icon} className="text-primary" />
      </View>
      <Text className="text-xl font-semibold text-foreground">{value.toLocaleString()}</Text>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}

export default function DashboardTab() {
  const { user, firebaseUser, degraded, error } = useWorkerSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<WorkerStats>(defaultStats);
  const [mapProjects, setMapProjects] = useState<DashboardMapProject[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }

    try {
      setFetchError(null);
      setLoading(true);
      const token = await firebaseUser.getIdToken();
      const data = await getWorkerDashboardStats(token);
      setStats({
        openOpportunities: Number(data.stats?.openOpportunities ?? 0),
        pendingApplications: Number(data.stats?.pendingApplications ?? 0),
        acceptedProjects: Number(data.stats?.acceptedProjects ?? 0),
        currentAssignments: Number(data.stats?.currentAssignments ?? 0),
      });
      setMapProjects(data.mapProjects ?? []);
    } catch {
      setFetchError('Could not load live dashboard data right now.');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const markers = useMemo(
    () =>
      mapProjects.filter(
        (project) =>
          project.location?.lat != null &&
          project.location?.lng != null &&
          !isNaN(Number(project.location.lat)) &&
          !isNaN(Number(project.location.lng))
      ),
    [mapProjects]
  );

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Worker';

  const mapHtml = useMemo(() => {
    const safeMarkers =
      markers.length > 0
        ? markers.map((project) => ({
            id: project.id,
            title: project.title ?? 'Project',
            status: project.status ?? '',
            lat: Number(project.location.lat),
            lng: Number(project.location.lng),
          }))
        : [
            {
              id: 'default-center',
              title: 'India center',
              status: '',
              lat: INDIA_CENTER.latitude,
              lng: INDIA_CENTER.longitude,
            },
          ];

    const markerJson = JSON.stringify(safeMarkers);
    return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #f8fafc; }
      .leaflet-control-attribution { font-size: 10px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const markers = ${markerJson};
      const map = L.map('map', { zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const markerRefs = [];
      markers.forEach((m) => {
        const marker = L.marker([m.lat, m.lng]).addTo(map);
        marker.bindPopup('<strong>' + (m.title || 'Project') + '</strong><br/>' + (m.status || '') + '<br/>' + m.lat.toFixed(5) + ', ' + m.lng.toFixed(5));
        markerRefs.push(marker);
      });

      if (markerRefs.length > 1) {
        const group = L.featureGroup(markerRefs);
        map.fitBounds(group.getBounds().pad(0.2));
      } else if (markerRefs.length === 1) {
        map.setView(markerRefs[0].getLatLng(), 13);
      } else {
        map.setView([20.5937, 78.9629], 4);
      }
    </script>
  </body>
</html>`;
  }, [markers]);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <View className="rounded-2xl border border-border bg-card p-4">
        <Text className="text-xs uppercase tracking-widest text-muted-foreground">Worker Dashboard</Text>
        <Text className="mt-1 text-2xl font-semibold text-foreground">Welcome back, {displayName}</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Track your current opportunities and assignments.</Text>
      </View>

      {(degraded || error || fetchError) && (
        <View className="mt-4 flex-row items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-50 p-3 dark:bg-amber-950/20">
          <Icon as={TriangleAlertIcon} className="text-amber-600" />
          <Text className="flex-1 text-xs text-amber-700 dark:text-amber-300">
            {fetchError ?? error ?? 'Some data is currently unavailable. Showing limited mode.'}
          </Text>
        </View>
      )}

      <View className="mt-4 flex-row flex-wrap justify-between gap-y-3">
        <StatCard label="Open Opportunities" value={stats.openOpportunities} icon={BriefcaseIcon} />
        <StatCard label="Pending Applications" value={stats.pendingApplications} icon={ClipboardListIcon} />
        <StatCard label="Accepted Projects" value={stats.acceptedProjects} icon={CheckCheckIcon} />
        <StatCard label="Current Assignments" value={stats.currentAssignments} icon={BriefcaseIcon} />
      </View>

      <View className="mt-5 rounded-2xl border border-border bg-card p-4">
        <Text className="text-lg font-semibold text-foreground">Current Project Map</Text>
        <Text className="mt-1 text-xs text-muted-foreground">
          Live map of accepted/current projects with available coordinates.
        </Text>

        <View className="mt-3 overflow-hidden rounded-xl border border-border">
          <WebView
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={{ height: 210, width: '100%', backgroundColor: '#f8fafc' }}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            nestedScrollEnabled
          />
        </View>
        <Text className="mt-2 text-[11px] text-muted-foreground">Map tiles: OpenStreetMap</Text>

        {markers.length === 0 && (
          <Text className="mt-2 text-xs text-muted-foreground">
            No project coordinates available yet. Map is centered to India by default.
          </Text>
        )}

        {markers.length > 0 && (
          <View className="mt-2 gap-1">
            {markers.slice(0, 4).map((project) => (
              <Text key={`${project.id}-coords`} className="text-xs text-muted-foreground">
                {project.title}: {Number(project.location.lat).toFixed(5)}, {Number(project.location.lng).toFixed(5)}
              </Text>
            ))}
          </View>
        )}
      </View>

      {loading && (
        <View className="mt-4 flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" />
          <Text className="text-sm text-muted-foreground">Loading dashboard...</Text>
        </View>
      )}
    </ScrollView>
  );
}
