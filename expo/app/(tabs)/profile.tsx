import { LogOutIcon, MoonStarIcon, SunIcon, UserRoundPenIcon } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePreferences } from '@/contexts/preferences-context';
import { useWorkerSession } from '@/contexts/worker-session-context';
import { updateWorkerProfileBasic } from '@/lib/api';
import type { LanguagePreference, MobileThemePreference } from '@/lib/types';

function OptionChip<T extends string>({
  label,
  value,
  selected,
  onPress,
}: {
  label: string;
  value: T;
  selected: boolean;
  onPress: (value: T) => void;
}) {
  return (
    <Pressable
      className={`rounded-lg border px-3 py-2 ${selected ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
      onPress={() => onPress(value)}
    >
      <Text className={`text-xs ${selected ? 'text-primary' : 'text-muted-foreground'}`}>{label}</Text>
    </Pressable>
  );
}

export default function ProfileTab() {
  const { user, firebaseUser, signOutUser, updateLocalUser } = useWorkerSession();
  const { theme, setTheme, language, setLanguage } = usePreferences();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [basic, setBasic] = useState({ firstName: '', lastName: '', phone: '' });

  useEffect(() => {
    setBasic({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phone: user.phone ?? '',
    });
  }, [user.firstName, user.lastName, user.phone]);

  const saveBasic = async () => {
    if (!firebaseUser) return;
    try {
      setSaving(true);
      setError(null);
      const token = await firebaseUser.getIdToken();
      const updated = await updateWorkerProfileBasic(token, {
        firstName: basic.firstName,
        lastName: basic.lastName,
        phone: basic.phone,
      });
      updateLocalUser({
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
      });
      setEditing(false);
    } catch {
      setError('Could not update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const photoFallback = 'https://ui-avatars.com/api/?name=Worker&background=e5e7eb&color=111827';

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text className="text-2xl font-semibold text-foreground">Profile</Text>
      <Text className="mt-1 text-sm text-muted-foreground">Minimal worker profile and preferences.</Text>

      <View className="mt-4 rounded-2xl border border-border bg-card p-4">
        <View className="flex-row items-center gap-3">
          <Image
            source={{ uri: user.photoUrl || photoFallback }}
            style={{ width: 64, height: 64, borderRadius: 9999, backgroundColor: '#e5e7eb' }}
          />
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">
              {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Worker'}
            </Text>
            <Text className="text-xs text-muted-foreground">{user.email ?? 'Email unavailable'}</Text>
          </View>
        </View>

        <View className="mt-4 gap-3">
          <TextInput
            className="rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            editable={editing}
            onChangeText={(value) => setBasic((prev) => ({ ...prev, firstName: value }))}
            placeholder="First name"
            placeholderTextColor="#888"
            value={basic.firstName}
          />
          <TextInput
            className="rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            editable={editing}
            onChangeText={(value) => setBasic((prev) => ({ ...prev, lastName: value }))}
            placeholder="Last name"
            placeholderTextColor="#888"
            value={basic.lastName}
          />
          <TextInput
            className="rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            editable={editing}
            onChangeText={(value) => setBasic((prev) => ({ ...prev, phone: value }))}
            placeholder="Phone"
            placeholderTextColor="#888"
            value={basic.phone}
          />
          <TextInput
            className="rounded-lg border border-border bg-muted px-3 py-2 text-muted-foreground"
            editable={false}
            value={user.email ?? ''}
          />
        </View>

        {!!error && <Text className="mt-3 text-sm text-destructive">{error}</Text>}

        {!editing ? (
          <Button className="mt-4" onPress={() => setEditing(true)}>
            <Icon as={UserRoundPenIcon} className="text-primary-foreground" />
            <Text>Edit Profile</Text>
          </Button>
        ) : (
          <View className="mt-4 flex-row gap-2">
            <Button className="flex-1" disabled={saving} onPress={saveBasic}>
              {saving ? <ActivityIndicator color="white" size="small" /> : <Text>Save</Text>}
            </Button>
            <Button
              className="flex-1"
              disabled={saving}
              onPress={() => {
                setEditing(false);
                setBasic({
                  firstName: user.firstName ?? '',
                  lastName: user.lastName ?? '',
                  phone: user.phone ?? '',
                });
              }}
              variant="outline"
            >
              <Text>Cancel</Text>
            </Button>
          </View>
        )}
      </View>

      <View className="mt-4 rounded-2xl border border-border bg-card p-4">
        <Text className="text-base font-semibold text-foreground">Theme Preference</Text>
        <View className="mt-3 flex-row gap-2">
          <OptionChip<MobileThemePreference>
            label="System"
            onPress={setTheme}
            selected={theme === 'system'}
            value="system"
          />
          <OptionChip<MobileThemePreference>
            label="Light"
            onPress={setTheme}
            selected={theme === 'light'}
            value="light"
          />
          <OptionChip<MobileThemePreference>
            label="Dark"
            onPress={setTheme}
            selected={theme === 'dark'}
            value="dark"
          />
        </View>
        <View className="mt-3 flex-row items-center gap-2">
          <Icon as={theme === 'dark' ? MoonStarIcon : SunIcon} className="text-muted-foreground" />
          <Text className="text-xs text-muted-foreground">Preference is stored only on this device in v1.</Text>
        </View>
      </View>

      <View className="mt-4 rounded-2xl border border-border bg-card p-4">
        <Text className="text-base font-semibold text-foreground">Language Preference</Text>
        <View className="mt-3 flex-row gap-2">
          <OptionChip<LanguagePreference>
            label="English"
            onPress={setLanguage}
            selected={language === 'en'}
            value="en"
          />
          <OptionChip<LanguagePreference>
            label="Hindi"
            onPress={setLanguage}
            selected={language === 'hi'}
            value="hi"
          />
          <OptionChip<LanguagePreference>
            label="Marathi"
            onPress={setLanguage}
            selected={language === 'mr'}
            value="mr"
          />
        </View>
        <Text className="mt-2 text-xs text-muted-foreground">
          Local preference scaffold only. No translation pipeline is connected in v1.
        </Text>
      </View>

      <Button className="mt-4" onPress={signOutUser} variant="outline">
        <Icon as={LogOutIcon} />
        <Text>Sign Out</Text>
      </Button>
    </ScrollView>
  );
}
