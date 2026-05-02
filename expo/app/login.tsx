import { Redirect } from 'expo-router';
import { LogInIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useWorkerSession } from '@/contexts/worker-session-context';

export default function LoginScreen() {
  const { firebaseUser, authLoaded, signIn, error } = useWorkerSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (authLoaded && firebaseUser) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setLocalError('Enter your email and password.');
      return;
    }

    try {
      setSubmitting(true);
      setLocalError(null);
      await signIn(email, password);
    } catch {
      setLocalError('Could not sign in. Check your credentials and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authLoaded) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <ActivityIndicator size="small" />
        <Text className="text-sm text-muted-foreground">Preparing sign in...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center bg-background px-6">
      <View className="rounded-2xl border border-border bg-card p-5">
        <Text className="text-2xl font-semibold text-foreground">Worker Sign In</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Access your dashboard, projects, daily reports, and profile.
        </Text>

        <View className="mt-5 gap-3">
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#888"
            value={email}
          />
          <TextInput
            autoCapitalize="none"
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
          />

          {(localError || error) && (
            <Text className="text-sm text-destructive">{localError ?? error}</Text>
          )}

          <Button className="mt-2" disabled={submitting} onPress={onSubmit}>
            {submitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Icon as={LogInIcon} className="text-primary-foreground" />
                <Text>Sign In</Text>
              </>
            )}
          </Button>
        </View>
      </View>
    </View>
  );
}
