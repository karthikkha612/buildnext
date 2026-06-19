import { Stack } from 'expo-router';

export default function ProjectLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/progress" />
      <Stack.Screen name="[id]/materials" />
      <Stack.Screen name="[id]/subcontractors" />
      <Stack.Screen name="[id]/timeline" />
      <Stack.Screen name="[id]/notify" />
      <Stack.Screen name="[id]/payments" />
      <Stack.Screen name="[id]/reports" />
    </Stack>
  );
}
