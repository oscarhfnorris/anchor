/**
 * The status screen — Anchor's home screen, in its Phase 0 form.
 *
 * This is not a placeholder. Phase 1 grows this same route into the screen that shows both alarms
 * and, crucially, whether the last one actually fired (D25/D29). What it does today is prove the
 * stack end to end on a real device: that migrations ran, that the database round-trips through
 * Drizzle, and that NativeWind is styling rather than merely installed.
 *
 * Proving the write matters more than it looks. Opening a database succeeds even when the schema
 * never applied; writing a row and reading it back is what actually demonstrates the driver works.
 */
import Constants from 'expo-constants';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import migrations from '@/db/migrations/migrations';
import { db } from '@/db/client';
import { readSettings, touchSettings } from '@/db/repositories';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-4 py-2">
      <Text className="text-sm text-neutral-500">{label}</Text>
      <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{value}</Text>
    </View>
  );
}

export default function StatusScreen() {
  const { success, error } = useMigrations(db, migrations);
  const [roundTrip, setRoundTrip] = useState<string>('tap to run');

  const runRoundTrip = useCallback(async () => {
    try {
      const written = await touchSettings(db);
      const read = await readSettings(db);
      setRoundTrip(
        read && read.updatedAt === written ? `ok — updated_at ${read.updatedAt}` : 'mismatch',
      );
    } catch (e) {
      setRoundTrip(`failed — ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const migrationState = error ? `failed — ${error.message}` : success ? 'applied' : 'running…';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <ScrollView contentContainerClassName="gap-8 p-6">
        <View className="gap-1">
          <Text className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
            Anchor
          </Text>
          <Text className="text-sm text-neutral-500">
            Phase 0 — the template. No alarms yet.
          </Text>
        </View>

        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Database
          </Text>
          <Row label="Migrations" value={migrationState} />
          <Row label="Round trip" value={roundTrip} />
          <Pressable
            onPress={runRoundTrip}
            className="mt-2 items-center rounded-lg bg-neutral-900 px-4 py-3 active:opacity-80 dark:bg-neutral-100"
          >
            <Text className="text-sm font-medium text-white dark:text-neutral-900">
              Write and read back
            </Text>
          </Pressable>
        </View>

        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Build
          </Text>
          <Row label="Expo SDK" value={Constants.expoConfig?.sdkVersion ?? 'unknown'} />
          <Row label="App version" value={Constants.expoConfig?.version ?? 'unknown'} />
          <Row label="Platform" value={`${Platform.OS} ${String(Platform.Version)}`} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
