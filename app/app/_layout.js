import { useEffect, useState, createContext, useContext } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getStoredUser, login, logout } from '../src/lib/auth';
import { demoLogin } from '../src/lib/demoData';
import AuthScreen from '../src/components/AuthScreen';
import { stopTracking, isTracking } from '../src/lib/locationService';

export const UserContext = createContext(null);
export function useUser() { return useContext(UserContext); }

export default function RootLayout() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Clean up stale background location task if iOS killed the app during a trip.
    // Skip if tracking is already active (relaunch during an intentional background trip).
    if (!isTracking()) stopTracking().catch(() => {});

    getStoredUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <View style={{ flex: 1, backgroundColor: '#fff' }} />;

  if (!user) {
    return (
      <>
        <StatusBar style="dark" />
        <AuthScreen
          onLogin={async (email, pin, name) => {
            const result = await login(email, pin, name);
            if (result.error === 'connection') return 'connection';
            if (result.error) return false;
            if (result.needsName) return 'needsName';
            if (result.user) { setUser(result.user); return true; }
            return false;
          }}
          onDemoLogin={async () => {
            const demoUser = await demoLogin();
            setUser(demoUser);
          }}
        />
      </>
    );
  }

  return (
    <UserContext.Provider value={{
      user,
      logout: async () => { await logout(); setUser(null); },
    }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </UserContext.Provider>
  );
}
