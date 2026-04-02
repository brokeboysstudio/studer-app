import React, { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, ActivityIndicator } from 'react-native'
import { supabase } from './src/lib/supabase'

// Registration flow (public)
import WelkomScherm      from './src/screens/WelkomScherm'
import StapEenScherm     from './src/screens/StapEenScherm'
import StapTweeScherm    from './src/screens/StapTweeScherm'
import BevestigingScherm from './src/screens/BevestigingScherm'

// Worker app (authenticated)
import LoginScherm           from './src/screens/LoginScherm'
import ShiftsScherm          from './src/screens/ShiftsScherm'
import BeschikbaarheidScherm from './src/screens/BeschikbaarheidScherm'
import PrikklokScherm        from './src/screens/PrikklokScherm'
import ContractenScherm      from './src/screens/ContractenScherm'

import { ApplicationData } from './src/lib/supabase'

// ── Nav types ─────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Welkom:      undefined
  StapEen:     { pushToken: string | null; track: 'direct' | 'select' }
  StapTwee:    { pushToken: string | null; track: 'direct' | 'select'; data: Partial<ApplicationData> }
  Bevestiging: { pushToken: string | null; track: 'direct' | 'select'; data: Partial<ApplicationData>; cvUri?: string | null; cvNaam?: string | null; cvMime?: string | null }
}

// ── Tab icon component ────────────────────────────────────────────────────────

function TabIcon({ name, color }: { name: string; color: string }) {
  const icons: Record<string, string> = {
    Shifts:         '📅',
    Beschikbaarheid:'📆',
    Prikklok:       '⏱',
    Contracten:     '📄',
  }
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 18, opacity: color === '#fff' ? 1 : 0.4 }}>{icons[name] ?? '•'}</Text>
    </View>
  )
}

// ── Worker tab navigator ──────────────────────────────────────────────────────

const Tab = createBottomTabNavigator()

function WorkerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0d0d0d',
          borderTopColor: '#1a1a1a',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 6,
          height: 68,
        },
        tabBarActiveTintColor:   '#fff',
        tabBarInactiveTintColor: '#444',
        tabBarLabelStyle: { fontSize: 10, marginTop: 2 },
        tabBarIcon: ({ color }) => <TabIcon name={route.name} color={color} />,
      })}
    >
      <Tab.Screen name="Shifts"          component={ShiftsScherm} />
      <Tab.Screen name="Beschikbaarheid" component={BeschikbaarheidScherm} />
      <Tab.Screen name="Prikklok"        component={PrikklokScherm} />
      <Tab.Screen name="Contracten"      component={ContractenScherm} />
    </Tab.Navigator>
  )
}

// ── Registration stack ────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>()

function RegistrationStack() {
  return (
    <Stack.Navigator
      initialRouteName="Welkom"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0A0A' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welkom"      component={WelkomScherm} />
      <Stack.Screen name="StapEen"     component={StapEenScherm} />
      <Stack.Screen name="StapTwee"    component={StapTweeScherm} />
      <Stack.Screen name="Bevestiging" component={BevestigingScherm} />
    </Stack.Navigator>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

type AppMode = 'loading' | 'registration' | 'login' | 'worker'

export default function App() {
  const [mode,    setMode]    = useState<AppMode>('loading')

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setMode(s ? 'worker' : 'registration')
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) setMode('worker')
    })

    return () => subscription.unsubscribe()
  }, [])

  if (mode === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      {mode === 'worker' ? (
        <WorkerTabs />
      ) : mode === 'login' ? (
        <LoginScherm onLogin={() => setMode('worker')} />
      ) : (
        // Registration flow — with "Worker login" link on Welkom
        <RegistrationStack />
      )}
    </NavigationContainer>
  )
}
