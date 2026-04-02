import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { RootStackParamList } from '../../App'
import ProgressBar from '../components/ProgressBar'
import { submitApplication } from '../lib/supabase'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Bevestiging'>
  route: RouteProp<RootStackParamList, 'Bevestiging'>
}

const SEGMENT_LABELS: Record<string, string> = {
  student: 'Student',
  flexi:   'Flexi-job',
  other:   'Andere',
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <View style={row.wrap}>
      <Text style={row.label}>{label}</Text>
      <Text style={row.value}>{value}</Text>
    </View>
  )
}

const row = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  label: {
    fontSize: 14,
    fontWeight: '400',
    color: '#555555',
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '400',
    color: '#CCCCCC',
    flex: 1.5,
    textAlign: 'right',
  },
})

const BASE_URL = 'https://studer-os.vercel.app'

export default function BevestigingScherm({ navigation, route }: Props) {
  const { data, pushToken, track, cvUri, cvNaam, cvMime } = route.params
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function verstuur() {
    setLoading(true)
    setError(null)
    try {
      const result = await submitApplication({
        voornaam:      data.voornaam      ?? '',
        achternaam:    data.achternaam    ?? '',
        telefoon:      data.telefoon      ?? '',
        geboortedatum: data.geboortedatum,
        segment:       data.segment,
        stad:          data.stad,
        hoe_bij_studer: data.hoe_bij_studer,
        via_wie:       data.via_wie,
        track,
        push_token:    pushToken,
      })

      // Upload CV if selected
      if (cvUri && result?.id) {
        try {
          const formData = new FormData()
          formData.append('file', {
            uri:  cvUri,
            name: cvNaam ?? 'cv.pdf',
            type: cvMime ?? 'application/pdf',
          } as unknown as Blob)
          await fetch(`${BASE_URL}/api/applications/${result.id}/cv`, {
            method: 'POST',
            body:   formData,
          })
        } catch {
          // CV upload is non-critical — proceed anyway
        }
      }

      setSuccess(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Onbekende fout'
      setError(`Er ging iets mis. Probeer opnieuw.\n\n${msg}`)
    } finally {
      setLoading(false)
    }
  }

  // ─── Success ────────────────────────────────────────────────────────────
  if (success) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.successContent}>
            <View style={styles.checkCircle}>
              <View style={styles.checkStem} />
              <View style={styles.checkKick} />
            </View>
            <Text style={styles.successTitle}>Super!</Text>
            <Text style={styles.successSub}>
              We bellen je zo snel{'\n'}mogelijk.
            </Text>
          </View>
          <View style={styles.successFooter}>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => navigation.navigate('Welkom')}
              activeOpacity={0.85}
            >
              <Text style={styles.resetText}>Nieuwe aanvraag</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  // ─── Overzicht ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ProgressBar step={3} total={3} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepLabel}>Stap 3 van 3</Text>
          <Text style={styles.title}>Controleer je{'\n'}gegevens</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Persoonlijk</Text>
            <Row
              label="Naam"
              value={`${data.voornaam ?? ''} ${data.achternaam ?? ''}`.trim() || null}
            />
            <Row label="Telefoon"      value={data.telefoon} />
            <Row label="Geboortedatum" value={data.geboortedatum} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voorkeur</Text>
            <Row
              label="Traject"
              value={track === 'direct' ? 'Direct' : track === 'select' ? 'Select' : null}
            />
            <Row
              label="Type"
              value={data.segment ? SEGMENT_LABELS[data.segment] : null}
            />
            <Row label="Stad"            value={data.stad} />
            <Row label="Hoe gevonden"    value={data.hoe_bij_studer} />
            <Row label="Doorverwezen door" value={data.via_wie} />
            {cvNaam ? <Row label="CV" value={cvNaam} /> : null}
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>Terug</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
            onPress={verstuur}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#0A0A0A" />
              : <Text style={styles.sendText}>Verstuur</Text>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16 },

  stepLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#444444',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 28,
  },

  section: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#444444',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingTop: 14,
    paddingBottom: 2,
  },

  errorBox: {
    borderWidth: 1,
    borderColor: '#CC4444',
    borderRadius: 8,
    padding: 14,
    marginTop: 4,
    backgroundColor: '#1A0909',
  },
  errorText: { color: '#CC4444', fontSize: 14, lineHeight: 20 },

  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  backBtn: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: '#666666', fontSize: 16, fontWeight: '500' },
  sendBtn: {
    flex: 2,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#0A0A0A', fontSize: 16, fontWeight: '700' },

  // ─── Success ────────────────────────────────────────────────────────────
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  // Checkmark: two lines forming a ✓
  checkStem: {
    position: 'absolute',
    width: 10,
    height: 1.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    transform: [
      { rotate: '45deg' },
      { translateX: -6 },
      { translateY: 2 },
    ],
  },
  checkKick: {
    position: 'absolute',
    width: 20,
    height: 1.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    transform: [
      { rotate: '-45deg' },
      { translateX: 4 },
    ],
  },
  successTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  successSub: {
    fontSize: 18,
    fontWeight: '400',
    color: '#666666',
    textAlign: 'center',
    lineHeight: 26,
  },
  successFooter: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  resetBtn: {
    height: 56,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: { color: '#666666', fontSize: 16, fontWeight: '500' },
})
