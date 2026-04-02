import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RootStackParamList } from '../../App'

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Welkom'> }
type Track = 'direct' | 'select'

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

const TRACKS: { key: Track; title: string; sub: string; desc: string; btn: string }[] = [
  {
    key:   'direct',
    title: 'Direct',
    sub:   'Snel aan de slag',
    desc:  'Vul je profiel in, wij matchen je met de juiste jobs',
    btn:   'Direct solliciteren',
  },
  {
    key:   'select',
    title: 'Select',
    sub:   'Persoonlijk traject',
    desc:  'Kom langs op kantoor voor een kennismaking',
    btn:   'Plan een gesprek',
  },
]

export default function WelkomScherm({ navigation }: Props) {
  const [pushToken,      setPushToken]      = useState<string | null>(null)
  const [showNotifBanner, setShowNotifBanner] = useState(false)

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        // Already granted — silently get token
        Notifications.getExpoPushTokenAsync()
          .then(t => setPushToken(t.data))
          .catch(() => null)
      } else if (status === 'undetermined') {
        // Show our friendly banner before asking system
        setShowNotifBanner(true)
      }
      // 'denied' → don't ask again, token stays null
    })
  }, [])

  async function enableNotifications() {
    setShowNotifBanner(false)
    const token = await requestPushToken()
    setPushToken(token)
  }

  function goToStapEen(track: Track) {
    navigation.navigate('StapEen', { pushToken, track })
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo-white.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.headline}>Werk mee{'\n'}met Studer</Text>
            <Text style={styles.sub}>Solliciteer in minder dan 60 seconden</Text>
          </View>

          {/* Notification permission banner */}
          {showNotifBanner && (
            <View style={styles.notifBanner}>
              <View style={styles.notifBody}>
                <Text style={styles.notifTitle}>Blijf op de hoogte</Text>
                <Text style={styles.notifDesc}>
                  Zet notificaties aan zodat we je snel kunnen bereiken als er een passende job is.
                </Text>
              </View>
              <View style={styles.notifActions}>
                <TouchableOpacity
                  style={styles.notifBtnPrimary}
                  onPress={enableNotifications}
                  activeOpacity={0.85}
                >
                  <Text style={styles.notifBtnPrimaryText}>Inschakelen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.notifBtnSecondary}
                  onPress={() => setShowNotifBanner(false)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.notifBtnSecondaryText}>Overslaan</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Track kaarten */}
          <View style={styles.cards}>
            {TRACKS.map((t) => (
              <View key={t.key} style={styles.card}>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTrack}>{t.title}</Text>
                  <Text style={styles.cardSub}>{t.sub}</Text>
                  <Text style={styles.cardDesc}>{t.desc}</Text>
                </View>
                <TouchableOpacity
                  style={styles.cardBtn}
                  onPress={() => goToStapEen(t.key)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.cardBtnText}>{t.btn}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  safe:      { flex: 1 },
  scroll:    { paddingHorizontal: 24, paddingBottom: 32 },

  header: {
    paddingTop: 48,
    paddingBottom: 36,
  },
  logo: {
    width: 110,
    height: 34,
    marginBottom: 40,
  },
  headline: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 44,
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  sub: {
    fontSize: 16,
    fontWeight: '400',
    color: '#555555',
    lineHeight: 22,
  },

  // Notification banner
  notifBanner: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  notifBody: {
    marginBottom: 16,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  notifDesc: {
    fontSize: 14,
    fontWeight: '400',
    color: '#555555',
    lineHeight: 20,
  },
  notifActions: {
    flexDirection: 'row',
    gap: 10,
  },
  notifBtnPrimary: {
    flex: 1,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  notifBtnSecondary: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555555',
  },

  cards: {
    flexDirection: 'row',
    gap: 12,
  },

  card: {
    flex: 1,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    justifyContent: 'space-between',
    minHeight: 240,
  },

  cardBody: {
    marginBottom: 20,
  },
  cardTrack: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  cardSub: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22,
    marginBottom: 10,
  },
  cardDesc: {
    fontSize: 13,
    fontWeight: '400',
    color: '#444444',
    lineHeight: 18,
  },

  cardBtn: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A0A0A',
    letterSpacing: 0.1,
  },
})
