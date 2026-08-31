import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#0284c7',
          headerTitleStyle: { fontWeight: 'bold', color: '#0f172a' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#f8fafc' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'DevQR', headerShown: false }} />
        <Stack.Screen name="scanner" options={{ title: 'Scan Debug Session', presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="preview" options={{ title: 'Debug Session' }} />
        <Stack.Screen name="sessions" options={{ title: 'Debug Sessions' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="arch" options={{ title: 'Architecture Studio', headerShown: false }} />
        <Stack.Screen name="generator" options={{ title: 'AI App Studio', headerShown: false }} />
        <Stack.Screen name="terminal" options={{ title: 'Live Terminal', headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: 'Setup DevQR', headerShown: false }} />
      </Stack>
    </>
  );
}
