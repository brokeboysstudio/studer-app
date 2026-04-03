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

type View_ = 'email' | 'otp-phone' | 'otp-code'

function formatPhone(raw: string): string {
  const clean = raw.replace(/\s/g, '')
  return clean.startsWith('+') ? clean : `+32${clean.replace(/^0/, '')}`
}

export default function LoginScherm({ navigation, onLogin }: Props) {
  const [view,       setView]       = useState<View_>('email')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [phone,      setPhone]      = useState('')
  const [otp,        setOtp]        = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  function clearError() { setError(null) }

  // ── Email / wachtwoord ───────────────────────────────────────────────────────

  async function handleEmailLogin() {
    clearError()
    setLoading(true)
    try {
      const { data, error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (e) throw e

      // Verify employee exists for this email
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('email', data.user.email!)
        .limit(1)
        .single()

      if (!emp) {
        await supabase.auth.signOut()
        setError('Geen worker account gevonden voor dit e-mailadres.')
        setLoading(false)
        return
      }
      onLogin?.()
    } catch (e: any) {
      setError(e.message ?? 'Inloggen mislukt')
    } finally {
      setLoading(false)
    }
  }

  // ── OTP ─────────────────────────────────────────────────────────────────────

  async function handleSendOtp() {
    clearError()
    setLoading(true)
    try {
      const { error: e } = await supabase.auth.signInWithOtp({ phone: formatPhone(phone) })
      if (e) throw e
      setView('otp-code')
    } catch (e: any) {
      setError(e.message ?? 'Kan code niet versturen')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    clearError()
    setLoading(true)
    try {
      const formatted = formatPhone(phone)
      const { error: e } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: 'sms' })
      if (e) throw e

      const digits = formatted.replace(/\D/g, '').slice(-9)
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .ilike('phone', `%${digits}%`)
        .limit(1)
        .single()

      if (!emp) {
        await supabase.auth.signOut()
        setError('Geen account gevonden voor dit nummer. Solliciteer eerst via de app.')
        setView('email')
        setLoading(false)
        return
      }
      onLogin?.()
    } catch (e: any) {
      setError(e.message ?? 'Ongeldige code')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.container}>
      <View style={s.inner}>
        <Image source={require('../../assets/logo-white.png')} style={s.logo} resizeMode="contain" />

        {/* ── Email / wachtwoord view ── */}
        {view === 'email' && (
          <>
            <Text style={s.title}>Inloggen</Text>
            <Text style={s.sub}>Voor Studer medewerkers</Text>

            <TextInput
              style={s.input}
              value={email}
              onChangeText={v => { setEmail(v); clearError() }}
              placeholder="jan@studer.agency"
              placeholderTextColor="#444"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <View style={s.passwordWrap}>
              <TextInput
                style={s.passwordInput}
                value={password}
                onChangeText={v => { setPassword(v); clearError() }}
                placeholder="Wachtwoord"
                placeholderTextColor="#444"
                secureTextEntry={!showPass}
                autoComplete="password"
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(p => !p)}>
                <Text style={s.eyeIcon}>{showPass ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            {error && <Text style={s.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[s.btn, (!email.trim() || !password) && s.btnDisabled]}
              onPress={handleEmailLogin}
              disabled={!email.trim() || !password || loading}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Inloggen</Text>}
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>of</Text>
              <View style={s.dividerLine} />
            </View>

            <TouchableOpacity style={s.outlineBtn} onPress={() => { clearError(); setView('otp-phone') }}>
              <Text style={s.outlineBtnText}>Inloggen met telefoonnummer</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── OTP phone view ── */}
        {view === 'otp-phone' && (
          <>
            <Text style={s.title}>Via telefoon</Text>
            <Text style={s.sub}>We sturen je een eenmalige code</Text>

            <TextInput
              style={s.input}
              value={phone}
              onChangeText={v => { setPhone(v); clearError() }}
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

            <TouchableOpacity style={s.back} onPress={() => { setView('email'); clearError() }}>
              <Text style={s.backText}>← Inloggen met e-mail</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── OTP code view ── */}
        {view === 'otp-code' && (
          <>
            <Text style={s.title}>Voer code in</Text>
            <Text style={s.subSmall}>Code verstuurd naar {phone}</Text>

            <TextInput
              style={s.input}
              value={otp}
              onChangeText={v => { setOtp(v); clearError() }}
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

            <TouchableOpacity style={s.back} onPress={() => { setView('otp-phone'); setOtp(''); clearError() }}>
              <Text style={s.backText}>Ander nummer</Text>
            </TouchableOpacity>
          </>
        )}

        {navigation && (
          <TouchableOpacity onPress={() => navigation.navigate('Welkom')} style={[s.back, { marginTop: 28 }]}>
            <Text style={s.backText}>← Terug</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0a0a' },
  inner:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logo:         { width: 100, height: 30, marginBottom: 40 },
  title:        { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 6, textAlign: 'center' },
  sub:          { fontSize: 13, color: '#555', marginBottom: 28, textAlign: 'center' },
  subSmall:     { fontSize: 11, color: '#444', marginBottom: 16, textAlign: 'center' },
  input:        { width: '100%', backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 16, marginBottom: 12 },
  passwordWrap: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 12, marginBottom: 12 },
  passwordInput:{ flex: 1, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 16 },
  eyeBtn:       { paddingHorizontal: 14 },
  eyeIcon:      { fontSize: 16 },
  btn:          { width: '100%', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled:  { opacity: 0.3 },
  btnText:      { color: '#000', fontWeight: '700', fontSize: 15 },
  outlineBtn:   { width: '100%', borderWidth: 1, borderColor: '#333', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  outlineBtnText:{ color: '#888', fontWeight: '500', fontSize: 14 },
  dividerRow:   { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 20 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: '#1e1e1e' },
  dividerText:  { color: '#333', fontSize: 12, marginHorizontal: 12 },
  errorText:    { color: '#f87171', fontSize: 13, marginBottom: 12, textAlign: 'center', lineHeight: 18 },
  back:         { marginTop: 16 },
  backText:     { color: '#555', fontSize: 13 },
})
