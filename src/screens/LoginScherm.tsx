import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RootStackParamList } from '../../App'
import { supabase } from '../lib/supabase'

type Props = {
  navigation?: NativeStackNavigationProp<RootStackParamList, 'Login'>
  onLogin?:    () => void
}

type Step = 'phone' | 'otp'

function formatPhone(raw: string): string {
  const clean = raw.replace(/\s/g, '')
  return clean.startsWith('+') ? clean : `+32${clean.replace(/^0/, '')}`
}

export default function LoginScherm({ navigation, onLogin }: Props) {
  const [step,    setStep]    = useState<Step>('phone')
  const [phone,   setPhone]   = useState('')
  const [otp,     setOtp]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSendOtp() {
    setError(null)
    setLoading(true)
    try {
      const { error: e } = await supabase.auth.signInWithOtp({ phone: formatPhone(phone) })
      if (e) throw e
      setStep('otp')
    } catch (e: any) {
      setError(e.message ?? 'Kan code niet versturen')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setError(null)
    setLoading(true)
    try {
      const formatted = formatPhone(phone)
      const { error: e } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: 'sms' })
      if (e) throw e

      // Check employee exists for this phone
      const digits = formatted.replace(/\D/g, '').slice(-9)
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .ilike('phone', `%${digits}%`)
        .limit(1)
        .single()

      if (!emp) {
        // Auth succeeded but no employee — sign out and show message
        await supabase.auth.signOut()
        setError('Geen account gevonden voor dit nummer. Solliciteer eerst via de app.')
        setStep('phone')
        setLoading(false)
        return
      }

      // Auth + employee OK — App's onAuthStateChange handles transition to worker mode
      onLogin?.()
    } catch (e: any) {
      setError(e.message ?? 'Ongeldige code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.container}>
      <View style={s.inner}>
        <Image
          source={require('../../assets/logo-white.png')}
          style={s.logo}
          resizeMode="contain"
        />

        <Text style={s.title}>Inloggen</Text>
        <Text style={s.sub}>Log in met je telefoonnummer</Text>

        {step === 'phone' ? (
          <>
            <TextInput
              style={s.input}
              value={phone}
              onChangeText={v => { setPhone(v); setError(null) }}
              placeholder="+32 478 12 34 56"
              placeholderTextColor="#444"
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            {error && <Text style={s.errorText}>{error}</Text>}
            <TouchableOpacity
              style={[s.btn, !phone.trim() && s.btnDisabled]}
              onPress={handleSendOtp}
              disabled={!phone.trim() || loading}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Verstuur code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.subSmall}>Code verstuurd naar {phone}</Text>
            <TextInput
              style={s.input}
              value={otp}
              onChangeText={v => { setOtp(v); setError(null) }}
              placeholder="123456"
              placeholderTextColor="#444"
              keyboardType="number-pad"
              maxLength={6}
            />
            {error && <Text style={s.errorText}>{error}</Text>}
            <TouchableOpacity
              style={[s.btn, otp.length < 6 && s.btnDisabled]}
              onPress={handleVerifyOtp}
              disabled={otp.length < 6 || loading}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Bevestig</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); setError(null) }} style={s.back}>
              <Text style={s.backText}>Ander nummer</Text>
            </TouchableOpacity>
          </>
        )}

        {navigation && (
          <TouchableOpacity onPress={() => navigation.navigate('Welkom')} style={s.back}>
            <Text style={s.backText}>← Terug naar welkom</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0a0a0a' },
  inner:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logo:       { width: 100, height: 30, marginBottom: 40, resizeMode: 'contain' },
  title:      { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 6 },
  sub:        { fontSize: 13, color: '#555', marginBottom: 32 },
  subSmall:   { fontSize: 11, color: '#444', marginBottom: 16 },
  input:      { width: '100%', backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 16, marginBottom: 12 },
  btn:        { width: '100%', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled:{ opacity: 0.3 },
  btnText:    { color: '#000', fontWeight: '700', fontSize: 15 },
  errorText:  { color: '#f87171', fontSize: 13, marginBottom: 12, textAlign: 'center', lineHeight: 18 },
  back:       { marginTop: 20 },
  backText:   { color: '#555', fontSize: 13 },
})
