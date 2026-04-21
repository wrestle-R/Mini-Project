import { useFocusEffect } from 'expo-router';
import { BriefcaseIcon, CheckCheckIcon, ClipboardListIcon, TriangleAlertIcon } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

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
          !isNaN(Number(project.location.lng)) &&
          project.timeline === 'current'
      ),
    [mapProjects]
  );

  const initialRegion = {
    latitude: markers.length > 0 ? Number(markers[0]?.location?.lat) : INDIA_CENTER.latitude,
    longitude: markers.length > 0 ? Number(markers[0]?.location?.lng) : INDIA_CENTER.longitude,
    latitudeDelta: 14,
    longitudeDelta: 14,
  };

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Worker';

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
          <MapView style={{ height: 210, width: '100%' }} initialRegion={initialRegion}>
            {markers.map((project) => (
              <Marker
                key={project.id}
                coordinate={{
                  latitude: Number(project.location.lat),
                  longitude: Number(project.location.lng),
                }}
                description={project.status}
                title={project.title}
              />
            ))}
          </MapView>
        </View>

        {markers.length === 0 && (
          <Text className="mt-2 text-xs text-muted-foreground">
            No project coordinates available yet. Map is centered to India by default.
          </Text>
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
