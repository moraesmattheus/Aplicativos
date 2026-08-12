import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppProvider } from '@/store/AppStore';

export default function RootLayout() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const c = Colors[dark ? 'dark' : 'light'];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
          <StatusBar style={dark ? 'light' : 'dark'} />
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: c.tint,
              tabBarInactiveTintColor: c.textSecondary,
              tabBarStyle: {
                backgroundColor: c.card,
                borderTopColor: c.border,
              },
            }}>
            <Tabs.Screen
              name="index"
              options={{
                title: 'Início',
                tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="curriculo"
              options={{
                title: 'Currículo',
                tabBarIcon: ({ color, size }) => <Ionicons name="document-text" color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="vagas"
              options={{
                title: 'Vagas',
                tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="kanban"
              options={{
                title: 'Kanban',
                tabBarIcon: ({ color, size }) => <Ionicons name="albums" color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="agenda"
              options={{
                title: 'Agenda',
                tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="perfil"
              options={{
                title: 'Perfil',
                tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
              }}
            />
            {/* rotas fora das abas */}
            <Tabs.Screen name="config" options={{ href: null }} />
          </Tabs>
        </ThemeProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
