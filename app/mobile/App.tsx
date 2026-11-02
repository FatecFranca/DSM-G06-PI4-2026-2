import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { HarvestScreen } from './src/screens/HarvestScreen';
import { IrrigationScreen } from './src/screens/IrrigationScreen';
import { StatusScreen } from './src/screens/StatusScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { colors } from './src/styles/theme';
import { clearAuthToken, restoreAuthToken, setAuthExpiredHandler } from './src/services/api';

const Tab = createBottomTabNavigator();

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);

  useEffect(() => {
    void restoreAuthToken().then((token) => {
      setAuthenticated(Boolean(token));
      setRestoringSession(false);
    }).catch(() => {
      setRestoringSession(false);
    });
  }, []);

  useEffect(() => {
    setAuthExpiredHandler(() => setAuthenticated(false));
    return () => setAuthExpiredHandler(null);
  }, []);

  if (restoringSession) return null;
  if (!authenticated) return <AuthScreen onAuthenticated={() => setAuthenticated(true)} />;
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.green,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: styles.tabBar,
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
        <Tab.Screen name="Irrigação" component={IrrigationScreen} />
        <Tab.Screen name="Colheitas" component={HarvestScreen} />
        <Tab.Screen name="Perfil">
          {() => <ProfileScreen onLogout={() => { void clearAuthToken(); setAuthenticated(false); }} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: 'rgba(255,255,255,0.96)', borderTopColor: colors.border, height: 72, paddingBottom: 8, paddingTop: 7 },
  tabLabel: { fontSize: 11, fontWeight: '700' },
});