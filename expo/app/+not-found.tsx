import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center gap-2 bg-background px-6">
        <Text className="text-base font-medium text-foreground">This screen does not exist.</Text>

        <Link href="/">
          <Text className="text-sm text-primary">Go back to dashboard</Text>
        </Link>
      </View>
    </>
  );
}
