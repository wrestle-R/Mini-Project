import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { TriangleAlertIcon } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useWorkerSession } from '@/contexts/worker-session-context';
import { getWorkerAttendance } from '@/lib/api';
import type { WorkerAttendanceRow } from '@/lib/types';

export default function AttendanceTab() {
  const { firebaseUser, degraded, error } = useWorkerSession();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<WorkerAttendanceRow[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadAttendance = useCallback(async () => {
    if (!firebaseUser) {
      setLoading(false);
      setRows([]);
      return;
    }

    try {
      setLoading(true);
      setFetchError(null);
      const token = await firebaseUser.getIdToken();
      const data = await getWorkerAttendance(token);
      setRows(Array.isArray(data?.attendance) ? data.attendance : []);
    } catch {
      setFetchError('Could not load attendance right now.');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useFocusEffect(
    useCallback(() => {
      loadAttendance();
    }, [loadAttendance])
  );

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text className="text-2xl font-semibold text-foreground">Attendance</Text>

      {(degraded || error || fetchError) && (
        <View className="mt-3 flex-row items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-50 p-3 dark:bg-amber-950/20">
          <Icon as={TriangleAlertIcon} className="text-amber-600" />
          <Text className="flex-1 text-xs text-amber-700 dark:text-amber-300">
            {fetchError ?? error ?? 'Some data is unavailable. Showing limited mode.'}
          </Text>
        </View>
      )}

      <View className="mt-4 rounded-2xl border border-border bg-card p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-foreground">Recent Logs</Text>
          <Pressable onPress={loadAttendance}>
            <Text className="text-sm font-medium text-primary">Refresh</Text>
          </Pressable>
        </View>

        {loading ? (
          <View className="py-6 flex-row items-center justify-center gap-2">
            <ActivityIndicator size="small" />
            <Text className="text-sm text-muted-foreground">Loading attendance...</Text>
          </View>
        ) : rows.length === 0 ? (
          <Text className="py-3 text-sm text-muted-foreground">No attendance records yet.</Text>
        ) : (
          <View className="gap-2">
            {rows.map((row) => (
              <View key={row.id} className="rounded-xl border border-border bg-background p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-foreground">{row.projectTitle || 'IoT Site'}</Text>
                  <Text className={`text-xs font-semibold ${row.status === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
                    {row.status}
                  </Text>
                </View>
                <Text className="mt-1 text-xs text-muted-foreground">{row.date}</Text>
                <Text className="mt-1 text-xs text-muted-foreground">Check-in: {row.checkIn}</Text>
                <Text className="text-xs text-muted-foreground">Check-out: {row.checkOut}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

    </ScrollView>
  );
}
