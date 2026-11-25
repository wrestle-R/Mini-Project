import { useFocusEffect } from 'expo-router';
import { CheckCircle2Icon, Clock3Icon, FolderSearchIcon, SendHorizonalIcon } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useWorkerSession } from '@/contexts/worker-session-context';
import { applyToWorkerProject, getWorkerProjects } from '@/lib/api';
import type { WorkerProjectItem } from '@/lib/types';

type ProjectTab = 'available' | 'applied' | 'ongoing';

function SegmentButton({ label, active, onPress, count }: { label: string; active: boolean; onPress: () => void; count: number }) {
  return (
    <Pressable
      className={`rounded-lg px-3 py-2 ${active ? 'bg-primary' : 'bg-transparent'}`}
      onPress={onPress}
    >
      <Text className={`text-sm ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
        {label} {count > 0 ? `(${count})` : ''}
      </Text>
    </Pressable>
  );
}

function ProjectCard({
  project,
  tab,
  onApply,
  applying,
}: {
  project: WorkerProjectItem;
  tab: ProjectTab;
  onApply: (id: string, message: string) => Promise<void>;
  applying: boolean;
}) {
  const [message, setMessage] = useState('');

  return (
    <View className="rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">{project.title}</Text>
          {!!project.company?.name && (
            <Text className="mt-0.5 text-xs text-muted-foreground">{project.company.name}</Text>
          )}
        </View>
        <View className="rounded-md bg-muted px-2 py-1">
          <Text className="text-[11px] text-muted-foreground">{project.status}</Text>
        </View>
      </View>

      {!!project.description && (
        <Text className="mt-2 text-xs leading-5 text-muted-foreground">{project.description}</Text>
      )}

      <Text className="mt-2 text-xs text-muted-foreground">
        {project.location?.displayName || 'Location pending'}
      </Text>

      {tab === 'available' && !project.applicationStatus && (
        <View className="mt-3 gap-2">
          <TextInput
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            onChangeText={setMessage}
            placeholder="Optional message"
            placeholderTextColor="#888"
            value={message}
          />
          <Button disabled={applying} onPress={() => onApply(project.id, message)} size="sm">
            {applying ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Icon as={SendHorizonalIcon} className="text-primary-foreground" />
                <Text>Apply</Text>
              </>
            )}
          </Button>
        </View>
      )}

      {tab !== 'available' && (
        <View className="mt-3 flex-row items-center gap-2">
          <Icon
            as={project.applicationStatus === 'accepted' ? CheckCircle2Icon : Clock3Icon}
            className={project.applicationStatus === 'accepted' ? 'text-green-600' : 'text-amber-600'}
          />
          <Text className="text-xs text-muted-foreground">
            {project.applicationStatus === 'accepted' ? 'Accepted' : project.applicationStatus ?? 'Pending'}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ProjectsTab() {
  const { firebaseUser } = useWorkerSession();
  const [tab, setTab] = useState<ProjectTab>('available');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<WorkerProjectItem[]>([]);
  const [applyingProjectId, setApplyingProjectId] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const token = await firebaseUser.getIdToken();
      const data = await getWorkerProjects(token);
      setProjects(data.projects ?? []);
    } catch {
      setError('Failed to load projects. Pull to refresh or reopen this tab.');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  const available = useMemo(
    () => projects.filter((p) => p.isOpen && !p.applicationStatus),
    [projects]
  );
  const applied = useMemo(
    () => projects.filter((p) => p.applicationStatus === 'pending' || p.applicationStatus === 'rejected'),
    [projects]
  );
  const ongoing = useMemo(
    () => projects.filter((p) => p.applicationStatus === 'accepted'),
    [projects]
  );

  const current = tab === 'available' ? available : tab === 'applied' ? applied : ongoing;

  const apply = async (projectId: string, message: string) => {
    if (!firebaseUser) return;
    try {
      setApplyingProjectId(projectId);
      const token = await firebaseUser.getIdToken();
      await applyToWorkerProject(token, projectId, message);
      await loadProjects();
    } catch {
      setError('Could not submit application. Please try again.');
    } finally {
      setApplyingProjectId(null);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text className="text-2xl font-semibold text-foreground">Projects</Text>
      <Text className="mt-1 text-sm text-muted-foreground">Browse, apply, and track your worker projects.</Text>

      <View className="mt-4 flex-row self-start rounded-xl border border-border bg-card p-1">
        <SegmentButton active={tab === 'available'} count={available.length} label="Available" onPress={() => setTab('available')} />
        <SegmentButton active={tab === 'applied'} count={applied.length} label="Applied" onPress={() => setTab('applied')} />
        <SegmentButton active={tab === 'ongoing'} count={ongoing.length} label="Ongoing" onPress={() => setTab('ongoing')} />
      </View>

      {loading && (
        <View className="mt-6 flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" />
          <Text className="text-sm text-muted-foreground">Loading projects...</Text>
        </View>
      )}

      {!!error && <Text className="mt-4 text-sm text-destructive">{error}</Text>}

      {!loading && current.length === 0 && (
        <View className="mt-6 items-center rounded-xl border border-border bg-card px-4 py-10">
          <Icon as={FolderSearchIcon} className="mb-2 text-muted-foreground" size={20} />
          <Text className="text-sm text-muted-foreground">
            {tab === 'available'
              ? 'No open projects available right now.'
              : tab === 'applied'
              ? 'No applied projects yet.'
              : 'No ongoing projects yet.'}
          </Text>
        </View>
      )}

      <View className="mt-4 gap-3">
        {current.map((project) => (
          <ProjectCard
            key={project.id}
            applying={applyingProjectId === project.id}
            onApply={apply}
            project={project}
            tab={tab}
          />
        ))}
      </View>
    </ScrollView>
  );
}
