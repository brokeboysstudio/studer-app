import React, { useState, useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, ActivityIndicator, Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { supabase } from './src/lib/supabase'
import { fetchMessages, fetchRole, savePushToken } from './src/lib/api'

// Registration flow (public)
import WelkomScherm      from './src/screens/WelkomScherm'
import StapEenScherm     from './src/screens/StapEenScherm'
import StapTweeScherm    from './src/screens/StapTweeScherm'
import BevestigingScherm from './src/screens/BevestigingScherm'

// Worker app (authenticated)
import LoginScherm       from './src/screens/LoginScherm'
import HomeScherm        from './src/screens/HomeScherm'
import JobsScherm        from './src/screens/JobsScherm'
import MijnShiftsScherm  from './src/screens/MijnShiftsScherm'
import InboxScherm       from './src/screens/InboxScherm'
import ProfielScherm     from './src/screens/ProfielScherm'
import WagenScherm       from './src/screens/WagenScherm'
import PrikklokScherm    from './src/screens/PrikklokScherm'
import ContractenScherm  from './src/screens/ContractenScherm'
import AutocheckScherm   from './src/screens/AutocheckScherm'

import { ApplicationData } from './src/lib/supabase'

// ── Notification setup ────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

async function registerForPushNotifications(): Promise<string | null> {
  // Only run on physical devices (simulators don't support push)
  if (Platform.OS === 'web') return null
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return null
  try {
    const { data } = await Notifications.getExpoPushTokenAsync()
    return data
  } catch { return null }
}

// ── Nav types ─────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Welkom:      undefined
  StapEen:     { pushToken: string | null; track: 'direct' | 'select' }
  StapTwee:    { pushToken: string | null; track: 'direct' | 'select'; data: Partial<ApplicationData> }
  Bevestiging: { pushToken: string | null; track: 'direct' | 'select'; data: Partial<ApplicationData>; cvUri?: string | null; cvNaam?: string | null; cvMime?: string | null }
}

// ── Tab icon component ────────────────────────────────────────────────────────

function TabIcon({ icon, color, badge }: { icon: string; color: string; badge?: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20, opacity: color === '#fff' ? 1 : 0.35 }}>{icon}</Text>
      {badge && badge > 0 ? (
        <View style={{
          position: 'absolute', top: -4, right: -10,
          backgroundColor: '#3b82f6', borderRadius: 8,
          minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
        }}>
          <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </View>
  )
}

// ── Worker tab navigator ──────────────────────────────────────────────────────

const Tab = createBottomTabNavigator()

function WorkerTabs({ isChauffeur }: { isChauffeur: boolean }) {
  const [unread, setUnread] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function pollUnread() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.phone) return
    const { data: emp } = await supabase
      .from('employees').select('id')
      .ilike('phone', `%${user.phone.replace(/\D/g, '').slice(-9)}%`)
      .limit(1).single()
    if (!emp) return
    try {
      const msgs = await fetchMessages(emp.id)
      setUnread(msgs.filter((m: { gelezen: boolean }) => !m.gelezen).length)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    pollUnread()
    intervalRef.current = setInterval(pollUnread, 5 * 60 * 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const tabBar = ({
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
    tabBarLabelStyle: { fontSize: 10, marginTop: 1 },
  })

  return (
    <Tab.Navigator screenOptions={tabBar}>
      <Tab.Screen
        name="Home"
        component={HomeScherm}
        options={{ tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} />, tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Jobs"
        component={JobsScherm}
        options={{ tabBarIcon: ({ color }) => <TabIcon icon="✨" color={color} />, tabBarLabel: 'Jobs' }}
      />
      <Tab.Screen
        name="MijnShifts"
        component={MijnShiftsScherm}
        options={{ tabBarIcon: ({ color }) => <TabIcon icon="📅" color={color} />, tabBarLabel: 'Shifts' }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScherm}
        options={{
          tabBarIcon: ({ color }) => <TabIcon icon="✉️" color={color} badge={unread} />,
          tabBarLabel: 'Inbox',
        }}
      />
      <Tab.Screen
        name="Profiel"
        component={ProfielScherm}
        options={{ tabBarIcon: ({ color }) => <TabIcon icon="👤" color={color} />, tabBarLabel: 'Profiel' }}
      />
      {isChauffeur && (
        <Tab.Screen
          name="Wagen"
          component={WagenScherm}
          options={{ tabBarIcon: ({ color }) => <TabIcon icon="🚗" color={color} />, tabBarLabel: 'Wagen' }}
        />
      )}
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
  const [mode,        setMode]        = useState<AppMode>('loading')
  const [isChauffeur, setIsChauffeur] = useState(false)

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        initWorker()
      } else {
        setMode('registration')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) initWorker()
      else   setMode('registration')
    })

    return () => subscription.unsubscribe()
  }, [])

  async function initWorker() {
    // Detect role
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.phone) {
      const { data: emp } = await supabase
        .from('employees').select('id')
        .ilike('phone', `%${user.phone.replace(/\D/g, '').slice(-9)}%`)
        .limit(1).single()
      if (emp) {
        // Role detection
        try {
          const { isChauffeur: isC } = await fetchRole(emp.id)
          setIsChauffeur(isC)
        } catch { /* default to worker */ }

        // Push token registration
        try {
          const token = await registerForPushNotifications()
          if (token) await savePushToken(emp.id, token)
        } catch { /* non-critical */ }
      }
    }
    setMode('worker')
  }

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
        <WorkerTabs isChauffeur={isChauffeur} />
      ) : mode === 'login' ? (
        <LoginScherm onLogin={() => initWorker()} />
      ) : (
        <RegistrationStack />
      )}
    </NavigationContainer>
  )
}
