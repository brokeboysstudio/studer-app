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

// ── Tab icon ──────────────────────────────────────────────────────────────────

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

  const screenOpts = {
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
  }

  return (
    <Tab.Navigator screenOptions={screenOpts}>
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

// ── Worker stack (tabs + modal screens) ───────────────────────────────────────
// Prikklok, Contracten en Autocheck zijn bereikbaar via navigate() vanuit
// tabs. Ze zitten in deze parent stack zodat ze over de tab bar heen renderen.

const WorkerStack = createNativeStackNavigator()

function WorkerStackNav({ isChauffeur }: { isChauffeur: boolean }) {
  return (
    <WorkerStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
      <WorkerStack.Screen name="Tabs">
        {() => <WorkerTabs isChauffeur={isChauffeur} />}
      </WorkerStack.Screen>
      <WorkerStack.Screen
        name="Prikklok"
        component={PrikklokScherm}
        options={{ animation: 'slide_from_bottom' }}
      />
      <WorkerStack.Screen
        name="Contracten"
        component={ContractenScherm}
        options={{ animation: 'slide_from_right' }}
      />
      <WorkerStack.Screen
        name="Autocheck"
        component={AutocheckScherm}
        options={{ animation: 'slide_from_right' }}
      />
    </WorkerStack.Navigator>
  )
}

// ── Registration stack ────────────────────────────────────────────────────────

const RegStack = createNativeStackNavigator<RootStackParamList>()

function RegistrationStack() {
  return (
    <RegStack.Navigator
      initialRouteName="Welkom"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0A0A' },
        animation: 'slide_from_right',
      }}
    >
      <RegStack.Screen name="Welkom"      component={WelkomScherm} />
      <RegStack.Screen name="StapEen"     component={StapEenScherm} />
      <RegStack.Screen name="StapTwee"    component={StapTweeScherm} />
      <RegStack.Screen name="Bevestiging" component={BevestigingScherm} />
    </RegStack.Navigator>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

type AppMode = 'loading' | 'registration' | 'login' | 'worker'

export default function App() {
  const [mode,        setMode]        = useState<AppMode>('loading')
  const [isChauffeur, setIsChauffeur] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) initWorker()
      else   setMode('registration')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (s) {
        initWorker()
      } else if (event === 'SIGNED_OUT') {
        // Explicit logout → toon LoginScherm zodat bestaande workers kunnen inloggen
        setMode('login')
      }
      // INITIAL_SESSION zonder session → al afgehandeld door getSession hierboven
    })

    return () => subscription.unsubscribe()
  }, [])

  async function initWorker() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.phone) {
      const { data: emp } = await supabase
        .from('employees').select('id')
        .ilike('phone', `%${user.phone.replace(/\D/g, '').slice(-9)}%`)
        .limit(1).single()
      if (emp) {
        try {
          const { isChauffeur: isC } = await fetchRole(emp.id)
          setIsChauffeur(isC)
        } catch { /* default worker */ }
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
        <WorkerStackNav isChauffeur={isChauffeur} />
      ) : mode === 'login' ? (
        <LoginScherm onLogin={() => initWorker()} />
      ) : (
        <RegistrationStack />
      )}
    </NavigationContainer>
  )
}
