import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { RootStackParamList } from '../../App'
import ProgressBar from '../components/ProgressBar'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'StapTwee'>
  route: RouteProp<RootStackParamList, 'StapTwee'>
}

const SEGMENTEN = [
  {
    key: 'student' as const,
    label: 'Student',
    desc: 'Bijverdienen naast je studies',
  },
  {
    key: 'flexi' as const,
    label: 'Flexi-job',
    desc: 'Extra inkomsten met een flexibel schema',
  },
  {
    key: 'other' as const,
    label: 'Geen van bovenstaande',
    desc: 'Vast contract, deeltijds of voltijds',
  },
]

const STEDEN = [
  'Antwerpen', 'Gent', 'Brussel', 'Leuven', 'Hasselt',
  'Brugge', 'Kortrijk', 'Roeselare', 'Aalst', 'Sint-Niklaas',
  'Mechelen', 'Turnhout', 'Genk', 'Tongeren',
]

const HOE_OPTIES = [
  'Via een vriend/kennis',
  'Sociale media',
  'Website',
  'Jobbeurs',
  'School',
  'Andere',
]

export default function StapTweeScherm({ navigation, route }: Props) {
  const { pushToken, track, data } = route.params

  const [segment,      setSegment]      = useState<typeof SEGMENTEN[0]['key'] | undefined>()
  const [stad,         setStad]         = useState<string | undefined>()
  const [hoe,          setHoe]          = useState<string | undefined>()
  const [viaWie,       setViaWie]       = useState('')
  const [errors,       setErrors]       = useState<Record<string, string>>({})

  const showViaWie = hoe === 'Via een vriend/kennis'

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!segment)       e.segment  = 'Kies een optie'
    if (!stad)          e.stad     = 'Kies een stad'
    if (!hoe)           e.hoe      = 'Kies een optie'
    if (showViaWie && !viaWie.trim()) e.viaWie = 'Verplicht'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (!validate()) return
    navigation.navigate('Bevestiging', {
      pushToken,
      track,
      data: {
        ...data,
        segment,
        stad,
        hoe_bij_studer: hoe,
        via_wie: showViaWie ? viaWie.trim() : undefined,
      },
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ProgressBar step={2} total={3} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.stepLabel}>Stap 2 van 3</Text>
          <Text style={styles.title}>Wat past{'\n'}bij jou?</Text>

          {/* ─── Segment ─────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Type tewerkstelling</Text>
          {errors.segment ? <Text style={styles.sectionError}>{errors.segment}</Text> : null}
          <View style={styles.segmentCards}>
            {SEGMENTEN.map(seg => {
              const active = segment === seg.key
              return (
                <TouchableOpacity
                  key={seg.key}
                  style={[styles.segmentCard, active && styles.segmentCardActive]}
                  onPress={() => setSegment(seg.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                    {seg.label}
                  </Text>
                  <Text style={[styles.segmentDesc, active && styles.segmentDescActive]}>
                    {seg.desc}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* ─── Stad ────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Stad</Text>
          {errors.stad ? <Text style={styles.sectionError}>{errors.stad}</Text> : null}
          <View style={styles.chipWrap}>
            {STEDEN.map(s => {
              const active = stad === s
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setStad(s)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* ─── Hoe gevonden ────────────────────────────── */}
          <Text style={styles.sectionLabel}>Hoe heb je ons gevonden?</Text>
          {errors.hoe ? <Text style={styles.sectionError}>{errors.hoe}</Text> : null}
          <View style={styles.chipWrap}>
            {HOE_OPTIES.map(h => {
              const active = hoe === h
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setHoe(h)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{h}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Voorwaardelijk veld: via wie? */}
          {showViaWie && (
            <View style={styles.field}>
              <Text style={styles.label}>Naam van je vriend of kennis</Text>
              <TextInput
                style={[styles.input, !!errors.viaWie && styles.inputError]}
                value={viaWie}
                onChangeText={setViaWie}
                placeholder="Voornaam achternaam"
                placeholderTextColor="#333333"
                autoCapitalize="words"
                autoCorrect={false}
              />
              {!!errors.viaWie && <Text style={styles.error}>{errors.viaWie}</Text>}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>Terug</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.85}>
            <Text style={styles.nextText}>Volgende</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
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
    marginBottom: 36,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionError: {
    color: '#CC4444',
    fontSize: 13,
    marginBottom: 6,
    marginTop: -4,
  },

  // Segment cards
  segmentCards: { gap: 10, marginBottom: 32 },
  segmentCard: {
    minHeight: 100,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 8,
    padding: 20,
    justifyContent: 'center',
  },
  segmentCardActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#141414',
  },
  segmentLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 6,
  },
  segmentLabelActive: { color: '#FFFFFF' },
  segmentDesc: {
    fontSize: 14,
    fontWeight: '400',
    color: '#333333',
    lineHeight: 20,
  },
  segmentDescActive: { color: '#555555' },

  // City chips
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    backgroundColor: '#111111',
  },
  chipActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#1A1A1A',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#555555',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },

  // Via wie veld
  field: { marginBottom: 20 },
  label: {
    fontSize: 16,
    fontWeight: '400',
    color: '#888888',
    marginBottom: 8,
  },
  input: {
    height: 52,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
  },
  inputError: { borderColor: '#CC4444' },
  error: { color: '#CC4444', fontSize: 13, marginTop: 6 },

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
  nextBtn: {
    flex: 2,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { color: '#0A0A0A', fontSize: 16, fontWeight: '700' },
})
