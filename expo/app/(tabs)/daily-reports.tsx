import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { RefreshCcwIcon, SendHorizonalIcon, TriangleAlertIcon } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useWorkerSession } from '@/contexts/worker-session-context';
import { createWorkerDailyReport, getWorkerDailyReports } from '@/lib/api';
import type { CreateDailyReportPayload, WorkerDailyReport } from '@/lib/types';

export default function DailyReportsTab() {
  const { firebaseUser, degraded, error } = useWorkerSession();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<WorkerDailyReport[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateDailyReportPayload>({
    projectId: '',
    reportDate: new Date().toISOString().slice(0, 10),
    workSummary: '',
    manpowerCount: '1',
    materialsUsed: '',
    blockers: '',
    nextDayPlan: '',
    notes: '',
  });

  const loadReports = useCallback(async () => {
    if (!firebaseUser) {
      setLoading(false);
      setReports([]);
      return;
    }

    try {
      setLoading(true);
      setFetchError(null);
      const token = await firebaseUser.getIdToken();
      const data = await getWorkerDailyReports(token);
      setReports(Array.isArray(data?.reports) ? data.reports : []);
      setProjects(Array.isArray(data?.projects) ? data.projects : []);

      if (data?.projects?.length && !form.projectId) {
        setForm((prev) => ({ ...prev, projectId: data.projects[0].id }));
      }
    } catch {
      setFetchError('Could not load daily reports right now.');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, form.projectId]);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  const handleSubmit = async () => {
    if (!firebaseUser || !form.projectId || !form.workSummary) {
      setSubmitError('Project and Work Summary are required.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      const token = await firebaseUser.getIdToken();
      await createWorkerDailyReport(token, form);
      
      // Reset form on success except projectId and date
      setForm((prev) => ({
        ...prev,
        workSummary: '',
        manpowerCount: '1',
        materialsUsed: '',
        blockers: '',
        nextDayPlan: '',
        notes: '',
      }));
      
      await loadReports();
    } catch (e: any) {
      setSubmitError(e.message || 'Failed to submit daily report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
      <Text className="text-2xl font-semibold text-foreground">Daily Reports</Text>
      <Text className="mt-1 flex-1 text-sm text-muted-foreground">Keep your team updated on site progress.</Text>

      {(degraded || error || fetchError) && (
        <View className="mt-4 flex-row items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-50 p-3 dark:bg-amber-950/20">
          <Icon as={TriangleAlertIcon} className="text-amber-600" />
          <Text className="flex-1 text-xs text-amber-700 dark:text-amber-300">
            {fetchError ?? error ?? 'Some data is unavailable. Showing limited mode.'}
          </Text>
        </View>
      )}

      {/* Report Form */}
      <View className="mt-4 rounded-2xl border border-border bg-card p-4">
        <Text className="mb-3 text-lg font-semibold text-foreground">New Report</Text>

        {projects.length === 0 ? (
           <Text className="text-sm text-muted-foreground mb-2">No active projects available to submit a report for.</Text>
        ) : (
          <View className="gap-3">
            <View>
              <Text className="mb-1 text-xs font-medium text-foreground">Project</Text>
              <View className="rounded-lg border border-border bg-background px-3 py-2">
                <Text className="text-sm text-foreground">
                  {projects.find((p) => p.id === form.projectId)?.title || 'Select a project...'}
                </Text>
              </View>
              {projects.length > 1 && (
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {projects.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => setForm((prev) => ({ ...prev, projectId: p.id }))}
                      className={`rounded-md px-3 py-1.5 ${form.projectId === p.id ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <Text className={`text-xs ${form.projectId === p.id ? 'text-primary-foreground' : 'text-foreground'}`}>
                        {p.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1 text-xs font-medium text-foreground">Date (YYYY-MM-DD)</Text>
                <TextInput
                  value={form.reportDate}
                  onChangeText={(val) => setForm((prev) => ({ ...prev, reportDate: val }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="e.g. 2026-05-02"
                  placeholderTextColor="#888"
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-xs font-medium text-foreground">Manpower</Text>
                <TextInput
                  value={form.manpowerCount}
                  onChangeText={(val) => setForm((prev) => ({ ...prev, manpowerCount: val }))}
                  keyboardType="numeric"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="Count"
                  placeholderTextColor="#888"
                />
              </View>
            </View>

            <View>
              <Text className="mb-1 text-xs font-medium text-foreground">Work Summary *</Text>
              <TextInput
                value={form.workSummary}
                onChangeText={(val) => setForm((prev) => ({ ...prev, workSummary: val }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="min-h-[60px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="What was done today?"
                placeholderTextColor="#888"
              />
            </View>

            <View>
              <Text className="mb-1 text-xs font-medium text-foreground">Materials Used</Text>
              <TextInput
                value={form.materialsUsed}
                onChangeText={(val) => setForm((prev) => ({ ...prev, materialsUsed: val }))}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="Cement, steel, etc."
                placeholderTextColor="#888"
              />
            </View>

            <View>
              <Text className="mb-1 text-xs font-medium text-foreground">Blockers (optional)</Text>
              <TextInput
                value={form.blockers}
                onChangeText={(val) => setForm((prev) => ({ ...prev, blockers: val }))}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="Anything holding you back?"
                placeholderTextColor="#888"
              />
            </View>

            <View>
              <Text className="mb-1 text-xs font-medium text-foreground">Next Day Plan</Text>
              <TextInput
                value={form.nextDayPlan}
                onChangeText={(val) => setForm((prev) => ({ ...prev, nextDayPlan: val }))}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="What's the plan for tomorrow?"
                placeholderTextColor="#888"
              />
            </View>

            {!!submitError && <Text className="mt-1 text-xs text-destructive">{submitError}</Text>}

            <Button className="mt-2" disabled={submitting} onPress={handleSubmit}>
              {submitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Icon as={SendHorizonalIcon} className="text-primary-foreground" />
                  <Text>Submit Report</Text>
                </>
              )}
            </Button>
          </View>
        )}
      </View>

      {/* Recent logs */}
      <View className="mt-6 rounded-2xl border border-border bg-card p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-foreground">Recent Reports</Text>
          <Pressable onPress={loadReports} className="flex-row items-center justify-center p-1">
            <Icon as={RefreshCcwIcon} className="text-primary mr-1" size={12} />
            <Text className="text-sm font-medium text-primary">Refresh</Text>
          </Pressable>
        </View>

        {loading && reports.length === 0 ? (
          <View className="py-6 flex-row items-center justify-center gap-2">
            <ActivityIndicator size="small" />
            <Text className="text-sm text-muted-foreground">Loading...</Text>
          </View>
        ) : reports.length === 0 ? (
          <Text className="py-3 text-sm text-muted-foreground">No reports found.</Text>
        ) : (
          <View className="gap-3">
            {reports.map((report) => (
              <View key={report.id} className="rounded-xl border border-border bg-background p-3">
                <Text className="text-sm font-semibold text-foreground">{report.project?.title || 'Unknown Project'}</Text>
                <Text className="mt-1 text-xs text-muted-foreground">{new Date(report.reportDate).toLocaleDateString()}</Text>
                
                <Text className="mt-2 text-xs font-medium text-foreground">Summary:</Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">{report.workSummary}</Text>
                
                {!!report.blockers && (
                  <View className="mt-2">
                    <Text className="text-xs font-medium text-destructive">Blockers:</Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">{report.blockers}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}