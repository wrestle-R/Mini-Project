import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useWorkerSession } from '@/contexts/worker-session-context';

export default function IndexScreen() {
  const { authLoaded, firebaseUser } = useWorkerSession();

  if (!authLoaded) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <ActivityIndicator size="small" />
        <Text className="text-sm text-muted-foreground">Checking worker session...</Text>
      </View>
    );
  }

  if (!firebaseUser) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
