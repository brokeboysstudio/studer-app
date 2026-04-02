import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { supabase } from '../lib/supabase'

type Step = 'phone' | 'otp'

export default function LoginScherm({ onLogin }: { onLogin: () => void }) {
  const [step,       setStep]       = useState<Step>('phone')
  const [phone,      setPhone]      = useState('')
  const [otp,        setOtp]        = useState('')
  const [loading,    setLoading]    = useState(false)

  async function handleSendOtp() {
    const formatted = phone.replace(/\s/g, '').startsWith('+') ? phone.replace(/\s/g, '') : `+32${phone.replace(/\s/g, '').replace(/^0/, '')}`
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
      if (error) throw error
      setStep('otp')
    } catch (e: any) {
      Alert.alert('Fout', e.message ?? 'Kan OTP niet versturen')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    const formatted = phone.replace(/\s/g, '').startsWith('+') ? phone.replace(/\s/g, '') : `+32${phone.replace(/\s/g, '').replace(/^0/, '')}`
    setLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: 'sms' })
      if (error) throw error
      onLogin()
    } catch (e: any) {
      Alert.alert('Fout', e.message ?? 'Ongeldige code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.container}>
      <View style={s.inner}>
        <View style={s.logo}>
          <Text style={s.logoText}>S</Text>
        </View>
        <Text style={s.title}>Studer Worker</Text>
        <Text style={s.sub}>Log in met je telefoonnummer</Text>

        {step === 'phone' ? (
          <>
            <TextInput
              style={s.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+32 478 12 34 56"
              placeholderTextColor="#444"
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <TouchableOpacity style={[s.btn, !phone.trim() && s.btnDisabled]} onPress={handleSendOtp} disabled={!phone.trim() || loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Verstuur code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.subSmall}>Code verstuurd naar {phone}</Text>
            <TextInput
              style={s.input}
              value={otp}
              onChangeText={setOtp}
              placeholder="123456"
              placeholderTextColor="#444"
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity style={[s.btn, otp.length < 6 && s.btnDisabled]} onPress={handleVerifyOtp} disabled={otp.length < 6 || loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Bevestig</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('phone')} style={s.back}>
              <Text style={s.backText}>Ander nummer</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0a0a0a' },
  inner:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logo:       { width: 48, height: 48, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText:   { color: '#000', fontWeight: '900', fontSize: 20 },
  title:      { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 6 },
  sub:        { fontSize: 13, color: '#555', marginBottom: 32 },
  subSmall:   { fontSize: 11, color: '#444', marginBottom: 16 },
  input:      { width: '100%', backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 16, marginBottom: 12 },
  btn:        { width: '100%', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled:{ opacity: 0.3 },
  btnText:    { color: '#000', fontWeight: '700', fontSize: 15 },
  back:       { marginTop: 16 },
  backText:   { color: '#555', fontSize: 13 },
})
