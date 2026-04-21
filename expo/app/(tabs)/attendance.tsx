import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';

export default function AttendanceTab() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text className="text-2xl font-semibold text-foreground">Attendance</Text>
      <Text className="mt-1 text-sm text-muted-foreground">
        Attendance tools are coming soon. This section is intentionally kept as a placeholder in v1.
      </Text>

      <View className="mt-6 rounded-2xl border border-dashed border-border bg-card p-5">
        <Text className="text-sm text-muted-foreground">Attendance content shell</Text>
      </View>
    </ScrollView>
  );
}
