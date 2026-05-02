import { Redirect, Tabs } from 'expo-router';
import { BriefcaseIcon, FileTextIcon, LayoutGridIcon, UserRoundIcon } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { useWorkerSession } from '@/contexts/worker-session-context';

export default function TabsLayout() {
  const { authLoaded, firebaseUser } = useWorkerSession();

  if (authLoaded && !firebaseUser) {
    return <Redirect href="/login" />;
  }

  if (!authLoaded) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1d4ed8',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Icon as={LayoutGridIcon} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color, size }) => <Icon as={BriefcaseIcon} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="daily-reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <Icon as={FileTextIcon} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Icon as={UserRoundIcon} color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
