import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { supabase } from '../lib/supabase'
import { onderteken } from '../lib/api'

interface Contract {
  id:                  string
  status:              string
  ondertekening_token: string | null
  ondertekening_naam:  string | null
  ondertekend_op:      string | null
  geldig_van:          string | null
  geldig_tot:          string | null
  inhoud_gegenereerd:  string | null
  event?:              { titel: string; klant: string | null; datum_start: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  concept:     '#9ca3af',
  verstuurd:   '#60a5fa',
  ondertekend: '#4ade80',
  geweigerd:   '#f87171',
}

export default function ContractenScherm() {
  const [contracten,    setContracten]    = useState<Contract[]>([])
  const [loading,       setLoading]       = useState(true)
  const [employeeId,    setEmployeeId]    = useState<string | null>(null)
  const [selected,      setSelected]      = useState<Contract | null>(null)
  const [naam,          setNaam]          = useState('')
  const [signing,       setSigning]       = useState(false)
  const [showContent,   setShowContent]   = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: emp } = await supabase
        .from('employees')
        .select('id, full_name')
        .ilike('phone', `%${user.phone?.replace(/\D/g,'').slice(-9)}%`)
        .limit(1).single()

      if (emp) {
        setEmployeeId(emp.id)
        setNaam(emp.full_name ?? '')

        const { data } = await supabase
          .from('contracten')
          .select('*, event:planner_events(titel, klant, datum_start)')
          .eq('employee_id', emp.id)
          .order('aangemaakt_op', { ascending: false })
          .limit(20)

        setContracten((data ?? []) as Contract[])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSign() {
    if (!selected?.ondertekening_token || !naam.trim()) return
    setSigning(true)
    try {
      await onderteken(selected.ondertekening_token, naam.trim())
      Alert.alert('✓ Ondertekend', 'Het contract is succesvol ondertekend.')
      setContracten(prev => prev.map(c => c.id === selected.id ? { ...c, status: 'ondertekend' } : c))
      setSelected(null)
    } catch (e: any) {
      Alert.alert('Fout', e.message)
    } finally {
      setSigning(false)
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#fff" /></View>

  if (selected) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { setSelected(null); setShowContent(false) }}>
            <Text style={s.back}>← Terug</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{selected.event?.klant ?? selected.event?.titel ?? 'Contract'}</Text>
        </View>

        {showContent && selected.inhoud_gegenereerd ? (
          <WebView
            source={{ html: `<html><body style="background:#0d0d0d;color:#ccc;font-family:system-ui;padding:20px;font-size:14px;line-height:1.6">${selected.inhoud_gegenereerd}</body></html>` }}
            style={{ flex: 1, backgroundColor: '#0d0d0d' }}
          />
        ) : (
          <ScrollView style={s.pad}>
            <View style={s.infoBox}>
              <Row label="Status" value={selected.status} />
              {selected.geldig_van && <Row label="Geldig van" value={selected.geldig_van} />}
              {selected.geldig_tot && <Row label="Geldig tot" value={selected.geldig_tot} />}
              {selected.ondertekend_op && <Row label="Ondertekend op" value={new Date(selected.ondertekend_op).toLocaleDateString('nl-BE')} />}
            </View>

            {selected.inhoud_gegenereerd && (
              <TouchableOpacity style={s.viewBtn} onPress={() => setShowContent(true)}>
                <Text style={s.viewBtnText}>Bekijk contract</Text>
              </TouchableOpacity>
            )}

            {selected.status === 'verstuurd' && (
              <View style={s.signBox}>
                <Text style={s.signTitle}>Ondertekenen</Text>
                <TextInput
                  style={s.input}
                  value={naam}
                  onChangeText={setNaam}
                  placeholder="Volledige naam"
                  placeholderTextColor="#444"
                />
                <TouchableOpacity
                  style={[s.signBtn, (!naam.trim() || signing) && s.btnDisabled]}
                  onPress={handleSign}
                  disabled={!naam.trim() || signing}>
                  {signing ? <ActivityIndicator color="#000" /> : <Text style={s.signBtnText}>Ondertekenen</Text>}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    )
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.pad}>
      <Text style={s.pageTitle}>Mijn Contracten</Text>
      {contracten.length === 0 ? (
        <Text style={s.empty}>Geen contracten</Text>
      ) : contracten.map(c => {
        const color = STATUS_COLORS[c.status] ?? '#888'
        return (
          <TouchableOpacity key={c.id} style={s.card} onPress={() => setSelected(c)}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{c.event?.klant ?? c.event?.titel ?? 'Contract'}</Text>
              <Text style={s.cardSub}>{c.event?.datum_start ?? '—'}</Text>
            </View>
            <Text style={[s.status, { color }]}>{c.status}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
      <Text style={{ fontSize: 12, color: '#444' }}>{label}</Text>
      <Text style={{ fontSize: 12, color: '#ccc' }}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center:    { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  pad:       { padding: 20, paddingTop: 60 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 20 },
  empty:     { color: '#333', fontSize: 13, textAlign: 'center', marginTop: 40 },
  card:      { backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  cardSub:   { fontSize: 11, color: '#666', marginTop: 2 },
  status:    { fontSize: 11, fontWeight: '600' },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  back:      { color: '#60a5fa', fontSize: 14 },
  headerTitle: { fontSize: 15, fontWeight: '600', color: '#fff', flex: 1 },
  infoBox:   { backgroundColor: '#0d0d0d', borderRadius: 12, padding: 14, marginBottom: 12 },
  viewBtn:   { borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12 },
  viewBtnText:{ color: '#60a5fa', fontSize: 13 },
  signBox:   { backgroundColor: '#0d0d0d', borderRadius: 12, padding: 16 },
  signTitle: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 12 },
  input:     { backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15, marginBottom: 12 },
  signBtn:   { backgroundColor: '#fff', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnDisabled:{ opacity: 0.3 },
  signBtnText:{ color: '#000', fontWeight: '700', fontSize: 14 },
})
