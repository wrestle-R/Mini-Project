import '@/global.css';

import { PreferencesProvider } from '@/contexts/preferences-context';
import { WorkerSessionProvider } from '@/contexts/worker-session-context';
import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
      <PreferencesProvider>
        <WorkerSessionProvider>
          <SafeAreaView style={{ flex: 1 }} className="flex-1 bg-background" edges={['top']}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }} />
            <PortalHost />
          </SafeAreaView>
        </WorkerSessionProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}
