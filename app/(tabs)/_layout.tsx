import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { router } from 'expo-router';
import { LayoutDashboard, FileText, Compass, Settings } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';

export default function TabLayout() {
  const { user, initialized } = useAuthStore();

  // Redirect to login if auth is fully initialized and there's no user.
  useEffect(() => {
    if (initialized && !user) {
      router.replace('/(auth)/login');
    }
  }, [initialized, user]);

  if (!user) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Hide built-in tab bar — PersistentTabBar in root layout handles navigation
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size ?? 22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Vault',
          tabBarIcon: ({ color, size }) => <FileText size={size ?? 22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Life Events',
          tabBarIcon: ({ color, size }) => <Compass size={size ?? 22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size ?? 22} color={color} strokeWidth={1.8} />,
        }}
      />
    </Tabs>
  );
}
