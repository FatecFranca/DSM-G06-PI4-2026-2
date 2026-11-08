import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HarvestScreen } from './src/screens/HarvestScreen';
import { IrrigationScreen } from './src/screens/IrrigationScreen';
import { StatusScreen } from './src/screens/StatusScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ThemeProvider, useTheme } from './src/styles/theme';
import { clearAuthToken, getCurrentUser, restoreAuthToken, setAuthExpiredHandler } from './src/services/api';

const Tab = createBottomTabNavigator();

export default function App() {
  return <SafeAreaProvider><ThemeProvider><ThemedApp /></ThemeProvider></SafeAreaProvider>;
}

function ThemedApp() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const [authenticated, setAuthenticated] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    void restoreAuthToken().then(async (token) => {
      if (!token) {
        setAuthenticated(false);
        return;
      }
      const current = await getCurrentUser();
      setPermissions(current.permissions);
      setAuthenticated(true);
    }).catch(async () => {
      await clearAuthToken();
      setAuthenticated(false);
    }).finally(() => {
      setRestoringSession(false);
    });
  }, []);

  async function handleAuthenticated() {
    const current = await getCurrentUser();
    setPermissions(current.permissions);
    setAuthenticated(true);
  }

  useEffect(() => {
    setAuthExpiredHandler(() => setAuthenticated(false));
    return () => setAuthExpiredHandler(null);
  }, []);

  if (restoringSession) return null;
  if (!authenticated) return <AuthScreen onAuthenticated={handleAuthenticated} />;
  const canControlIrrigation = permissions.includes('control_irrigation');
  return (
    <NavigationContainer>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.green,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { ...styles.tabBar, backgroundColor: colors.surface, borderTopColor: colors.border, height: 72 + insets.bottom, paddingBottom: 8 + insets.bottom },
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({ color, size }) => {
            const icon = route.name === 'Status'
              ? 'leaf-outline'
              : route.name === 'Irrigação'
                ? 'water-outline'
              : route.name === 'Colheitas'
                ? 'basket-outline'
                : 'person-outline';
            return <Ionicons name={icon} color={color} size={size} />;
          },
        })}
      >
        <Tab.Screen name="Status" component={StatusScreen} />
        {canControlIrrigation && <Tab.Screen name="Irrigação" component={IrrigationScreen} />}
        <Tab.Screen name="Colheitas" component={HarvestScreen} />
        <Tab.Screen name="Perfil">
          {() => <ProfileScreen onLogout={() => { void clearAuthToken(); setAuthenticated(false); }} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: { height: 72, paddingBottom: 8, paddingTop: 7 },
  tabLabel: { fontSize: 11, fontWeight: '700' },
});