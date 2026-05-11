import { useEffect, useState, createContext, useContext } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getStoredUser, login, logout } from '../src/lib/auth';
import { demoLogin } from '../src/lib/demoData';
import AuthScreen from '../src/components/AuthScreen';
import { stopTracking } from '../src/lib/locationService';

export const UserContext = createContext(null);
export function useUser() { return useContext(UserContext); }

export default function RootLayout() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Clean up any stale background location task left over if iOS killed
    // the app for memory while a trip was active. Without this, the task
    // keeps running and fires toll notifications with no active trip in the UI.
    stopTracking().catch(() => {});

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
          onLogin={async (name, pin, email) => {
            const result = await login(name, pin, email);
            if (result.error) return false;
            if (result.needsEmail) return 'needsEmail';
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
