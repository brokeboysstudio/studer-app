import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { RootStackParamList } from '../../App'
import ProgressBar from '../components/ProgressBar'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'StapEen'>
  route: RouteProp<RootStackParamList, 'StapEen'>
}

function formatDMY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${date.getFullYear()}`
}

const MAX_DATE = new Date()
const MIN_DATE = new Date(1920, 0, 1)
const DEFAULT_PICKER_DATE = new Date(1995, 0, 1)

export default function StapEenScherm({ navigation, route }: Props) {
  const { pushToken, track } = route.params

  const [voornaam,   setVoornaam]   = useState('')
  const [achternaam, setAchternaam] = useState('')
  const [telefoon,   setTelefoon]   = useState('')
  const [birthDate,  setBirthDate]  = useState<Date | null>(null)
  const [tempDate,   setTempDate]   = useState<Date>(DEFAULT_PICKER_DATE)
  const [showPicker, setShowPicker] = useState(false)
  const [errors,     setErrors]     = useState<Record<string, string>>({})

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!voornaam.trim())   e.voornaam   = 'Verplicht'
    if (!achternaam.trim()) e.achternaam = 'Verplicht'
    if (telefoon.trim().length < 9) e.telefoon = 'Voer een geldig nummer in'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (!validate()) return
    navigation.navigate('StapTwee', {
      pushToken,
      track,
      data: {
        voornaam: voornaam.trim(),
        achternaam: achternaam.trim(),
        telefoon: telefoon.trim(),
        geboortedatum: birthDate ? formatDMY(birthDate) : undefined,
      },
    })
  }

  function onAndroidChange(event: DateTimePickerEvent, date?: Date) {
    setShowPicker(false)
    if (event.type === 'set' && date) setBirthDate(date)
  }

  function onIOSChange(_: DateTimePickerEvent, date?: Date) {
    if (date) setTempDate(date)
  }

  function confirmIOS() {
    setBirthDate(tempDate)
    setShowPicker(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ProgressBar step={1} total={3} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.stepLabel}>Stap 1 van 3</Text>
          <Text style={styles.title}>Wie ben je?</Text>

          {/* Voornaam + Achternaam */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Voornaam</Text>
              <TextInput
                style={[styles.input, !!errors.voornaam && styles.inputError]}
                value={voornaam}
                onChangeText={setVoornaam}
                placeholder="Jan"
                placeholderTextColor="#333333"
                autoCapitalize="words"
                autoCorrect={false}
              />
              {!!errors.voornaam && <Text style={styles.error}>{errors.voornaam}</Text>}
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Achternaam</Text>
              <TextInput
                style={[styles.input, !!errors.achternaam && styles.inputError]}
                value={achternaam}
                onChangeText={setAchternaam}
                placeholder="Janssen"
                placeholderTextColor="#333333"
                autoCapitalize="words"
                autoCorrect={false}
              />
              {!!errors.achternaam && <Text style={styles.error}>{errors.achternaam}</Text>}
            </View>
          </View>

          {/* Telefoon */}
          <View style={styles.field}>
            <Text style={styles.label}>Telefoonnummer (WhatsApp)</Text>
            <TextInput
              style={[styles.input, !!errors.telefoon && styles.inputError]}
              value={telefoon}
              onChangeText={setTelefoon}
              placeholder="0472 00 00 00"
              placeholderTextColor="#333333"
              keyboardType="phone-pad"
            />
            {!!errors.telefoon && <Text style={styles.error}>{errors.telefoon}</Text>}
          </View>

          {/* Geboortedatum */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Geboortedatum{' '}
              <Text style={styles.optional}>(optioneel)</Text>
            </Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                setTempDate(birthDate ?? DEFAULT_PICKER_DATE)
                setShowPicker(true)
              }}
              activeOpacity={0.8}
            >
              <Text style={birthDate ? styles.inputText : styles.inputPlaceholder}>
                {birthDate ? formatDMY(birthDate) : 'DD/MM/JJJJ'}
              </Text>
            </TouchableOpacity>

            {/* Android: calendar dialog */}
            {Platform.OS === 'android' && showPicker && (
              <DateTimePicker
                value={birthDate ?? DEFAULT_PICKER_DATE}
                mode="date"
                display="calendar"
                onChange={onAndroidChange}
                maximumDate={MAX_DATE}
                minimumDate={MIN_DATE}
              />
            )}
          </View>
        </ScrollView>

        {/* iOS spinner modal */}
        {Platform.OS === 'ios' && (
          <Modal visible={showPicker} transparent animationType="slide">
            <View style={styles.modalBackdrop}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowPicker(false)}>
                    <Text style={styles.modalCancel}>Annuleer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmIOS}>
                    <Text style={styles.modalConfirm}>Bevestig</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={onIOSChange}
                  maximumDate={MAX_DATE}
                  minimumDate={MIN_DATE}
                  style={styles.iosPicker}
                />
              </View>
            </View>
          </Modal>
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>Terug</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={next}
            activeOpacity={0.85}
          >
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
    letterSpacing: -0.5,
    marginBottom: 36,
  },

  row: { flexDirection: 'row', gap: 12 },

  field: { marginBottom: 20 },
  label: {
    fontSize: 16,
    fontWeight: '400',
    color: '#888888',
    marginBottom: 8,
  },
  optional: {
    fontSize: 14,
    color: '#444444',
  },

  input: {
    height: 52,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
  },
  inputError: { borderColor: '#CC4444' },
  inputText: { color: '#FFFFFF', fontSize: 16, fontWeight: '400' },
  inputPlaceholder: { color: '#333333', fontSize: 16, fontWeight: '400' },
  error: { color: '#CC4444', fontSize: 13, marginTop: 6 },

  // iOS date picker modal
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  modalCancel: { color: '#555555', fontSize: 16, fontWeight: '500' },
  modalConfirm: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  iosPicker: { backgroundColor: '#111111' },

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
