/**
 * Root layout.
 *
 * Deliberately minimal: one stack, no tabs. Anchor has a small number of screens (§10) and the
 * navigation shape is not a Phase 0 decision. The global stylesheet is imported here because it
 * must load in the same file as the top-most component.
 */
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import '../global.css';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
