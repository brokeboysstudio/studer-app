import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RootStackParamList } from '../../App'

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Welkom'> }

async function requestPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Studer',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      })
    }
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') return null
    const token = await Notifications.getExpoPushTokenAsync()
    return token.data
  } catch {
    return null
  }
}

export default function WelkomScherm({ navigation }: Props) {
  const [pushToken, setPushToken] = useState<string | null>(null)

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Notifications.getExpoPushTokenAsync()
          .then(t => setPushToken(t.data))
          .catch(() => null)
      }
    })
  }, [])

  async function goSolliciteer() {
    // Request push token before starting the flow
    const token = pushToken ?? await requestPushToken().catch(() => null)
    navigation.navigate('StapEen', { pushToken: token, track: 'direct' })
  }

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.content}>
          {/* Logo */}
          <Image
            source={require('../../assets/logo-white.png')}
            style={s.logo}
            resizeMode="contain"
          />

          {/* Headline */}
          <View style={s.hero}>
            <Text style={s.headline}>Jouw shifts.{'\n'}Jouw planning.</Text>
            <Text style={s.sub}>Beheer je shifts, beschikbaarheid{'\n'}en communicatie vanuit één app.</Text>
          </View>
        </View>

        {/* CTA buttons */}
        <View style={s.footer}>
          <TouchableOpacity
            style={s.loginBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={s.loginBtnText}>Inloggen</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.solliciteerBtn}
            onPress={goSolliciteer}
            activeOpacity={0.75}
          >
            <Text style={s.solliciteerBtnText}>Nog geen account? Solliciteer nu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  safe:      { flex: 1, paddingHorizontal: 24 },
  content:   { flex: 1, justifyContent: 'center' },

  logo: {
    width: 110,
    height: 34,
    marginBottom: 56,
  },

  hero: {
    gap: 14,
  },
  headline: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 48,
    letterSpacing: -1,
  },
  sub: {
    fontSize: 16,
    fontWeight: '400',
    color: '#555555',
    lineHeight: 24,
  },

  footer: {
    paddingBottom: 16,
    gap: 12,
  },

  loginBtn: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0A',
  },

  solliciteerBtn: {
    height: 52,
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solliciteerBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555555',
  },
})
