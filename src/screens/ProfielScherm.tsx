import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Switch,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'

// ── Beschikbaarheid (ingebouwd in Profiel) ────────────────────────────────────

type Status = 'beschikbaar' | 'niet_beschikbaar' | 'voorkeur_niet'
type AvailMap = Record<string, Status>

const STATUS_STYLE: Record<Status, { bg: string; text: string; label: string }> = {
  beschikbaar:     { bg: '#1a2e10', text: '#4ade80',  label: 'Beschikbaar' },
  niet_beschikbaar:{ bg: '#2e1010', text: '#f87171',  label: 'Niet beschikbaar' },
  voorkeur_niet:   { bg: '#1f1200', text: '#fb923c',  label: 'Voorkeur niet' },
}

const STATUS_CYCLE: Status[] = ['beschikbaar', 'niet_beschikbaar', 'voorkeur_niet']

// Old → new status name mapping for existing data
function normalizeStatus(s: string): Status {
  if (s === 'onbeschikbaar') return 'niet_beschikbaar'
  if (s === 'misschien') return 'voorkeur_niet'
  return s as Status
}

const NL_MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const NL_DAYS   = ['Ma','Di','Wo','Do','Vr','Za','Zo']

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfielScherm() {
  const navigation = useNavigation<any>()
  const [loading,   setLoading]   = useState(true)
  const [empId,     setEmpId]     = useState<string | null>(null)
  const [fullName,  setFullName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [section,   setSection]   = useState<'profiel' | 'beschikbaarheid' | 'instellingen'>('profiel')

  // Beschikbaarheid
  const now    = new Date()
  const [year,   setYear]   = useState(now.getFullYear())
  const [month,  setMonth]  = useState(now.getMonth())
  const [avail,  setAvail]  = useState<AvailMap>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [calLoading, setCalLoading] = useState(false)

  // Notificaties (lokale state — toekomstige integratie)
  const [notifShift,     setNotifShift]     = useState(true)
  const [notifBevestig,  setNotifBevestig]  = useState(true)
  const [notifBriefing,  setNotifBriefing]  = useState(true)
  const [notifHerinner,  setNotifHerinner]  = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: emp } = await supabase
      .from('employees').select('id, full_name, phone, email')
      .ilike('phone', `%${user.phone?.replace(/\D/g, '').slice(-9)}%`)
      .limit(1).single()
    if (!emp) { setLoading(false); return }
    setEmpId(emp.id)
    setFullName(emp.full_name ?? '')
    setPhone(emp.phone ?? '')
    setEmail(emp.email ?? '')
    await loadMonth(emp.id, now.getFullYear(), now.getMonth())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function loadMonth(eid: string, y: number, m: number) {
    setCalLoading(true)
    const start = toISO(y, m, 1)
    const end   = toISO(y, m, new Date(y, m + 1, 0).getDate())
    const { data } = await supabase
      .from('worker_availability')
      .select('datum, status')
      .eq('employee_id', eid).gte('datum', start).lte('datum', end)
    const map: AvailMap = {}
    for (const r of (data ?? [])) map[r.datum] = normalizeStatus(r.status)
    setAvail(map)
    setCalLoading(false)
  }

  async function handleDayPress(iso: string) {
    if (!empId) return
    const current = avail[iso]
    const next: Status = current
      ? STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length]
      : 'beschikbaar'
    setSaving(iso)
    if (current) {
      await supabase.from('worker_availability').update({ status: next }).eq('employee_id', empId).eq('datum', iso)
    } else {
      await supabase.from('worker_availability').upsert({ employee_id: empId, datum: iso, status: next }, { onConflict: 'employee_id,datum' })
    }
    setAvail(a => ({ ...a, [iso]: next }))
    setSaving(null)
  }

  async function handleClearDay(iso: string) {
    if (!empId || !avail[iso]) return
    setSaving(iso)
    await supabase.from('worker_availability').delete().eq('employee_id', empId).eq('datum', iso)
    setAvail(a => { const n = { ...a }; delete n[iso]; return n })
    setSaving(null)
  }

  function navigate(delta: number) {
    let m = month + delta, y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m); setYear(y)
    if (empId) loadMonth(empId, y, m)
  }

  const firstDay  = new Date(year, month, 1)
  const daysInMon = new Date(year, month + 1, 0).getDate()
  const startDow  = (firstDay.getDay() + 6) % 7
  const cells: (number | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= daysInMon; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  async function handleLogout() {
    Alert.alert('Afmelden', 'Ben je zeker dat je wil afmelden?', [
      { text: 'Annuleer', style: 'cancel' },
      { text: 'Afmelden', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#fff" /></View>

  return (
    <ScrollView style={s.container} contentContainerStyle={s.pad}>
      <Text style={s.pageTitle}>Profiel</Text>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['profiel', 'beschikbaarheid', 'instellingen'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, section === t && s.tabActive]} onPress={() => setSection(t)}>
            <Text style={[s.tabText, section === t && s.tabTextActive]}>
              {t === 'profiel' ? 'Profiel' : t === 'beschikbaarheid' ? 'Beschikbaar' : 'Instellingen'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Profiel sectie ── */}
      {section === 'profiel' && (
        <View style={s.section}>
          <View style={s.profileCard}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{fullName}</Text>
              {phone ? <Text style={s.meta}>{phone}</Text> : null}
              {email ? <Text style={s.meta}>{email}</Text> : null}
            </View>
          </View>

          <TouchableOpacity style={s.navBtn2} onPress={() => navigation.navigate('Contracten')}>
            <Ionicons name="document-text-outline" size={16} color="#60a5fa" style={{ marginRight: 6 }} />
            <Text style={s.navBtn2Text}>Contracten</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.dangerBtn} onPress={handleLogout}>
            <Text style={s.dangerBtnText}>Afmelden</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Beschikbaarheid sectie ── */}
      {section === 'beschikbaarheid' && (
        <View style={s.section}>
          <View style={s.calNav}>
            <TouchableOpacity onPress={() => navigate(-1)} style={s.navBtn}><Text style={s.navArrow}>‹</Text></TouchableOpacity>
            <Text style={s.monthLabel}>{NL_MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={() => navigate(1)} style={s.navBtn}><Text style={s.navArrow}>›</Text></TouchableOpacity>
          </View>

          {calLoading ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 40 }} />
          ) : (
            <View style={s.grid}>
              {NL_DAYS.map(d => <Text key={d} style={s.dayHeader}>{d}</Text>)}
              {cells.map((day, i) => {
                if (!day) return <View key={`e${i}`} style={s.cell} />
                const iso    = toISO(year, month, day)
                const status = avail[iso]
                const sty    = status ? STATUS_STYLE[status] : null
                const isToday = iso === new Date().toISOString().split('T')[0]
                return (
                  <TouchableOpacity
                    key={iso}
                    style={[s.cell, isToday && s.today, sty && { backgroundColor: sty.bg }]}
                    onPress={() => handleDayPress(iso)}
                    onLongPress={() => handleClearDay(iso)}
                  >
                    {saving === iso
                      ? <ActivityIndicator size="small" color="#888" />
                      : <Text style={[s.dayNum, sty && { color: sty.text }, isToday && !sty && { color: '#fff', fontWeight: '700' }]}>{day}</Text>
                    }
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          <View style={s.legend}>
            {(Object.entries(STATUS_STYLE) as [Status, typeof STATUS_STYLE[Status]][]).map(([k, v]) => (
              <View key={k} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: v.bg, borderColor: v.text }]} />
                <Text style={[s.legendText, { color: v.text }]}>{v.label}</Text>
              </View>
            ))}
          </View>
          <Text style={s.hint}>Tik om te wijzigen · Lang indrukken om te wissen</Text>
        </View>
      )}

      {/* ── Instellingen sectie ── */}
      {section === 'instellingen' && (
        <View style={s.section}>
          <Text style={s.settingsGroupLabel}>Notificaties</Text>
          <View style={s.settingsCard}>
            {[
              { label: 'Nieuwe shifts', value: notifShift,    set: setNotifShift },
              { label: 'Bevestigingsverzoeken', value: notifBevestig, set: setNotifBevestig },
              { label: 'Briefings',     value: notifBriefing, set: setNotifBriefing },
              { label: 'Shiftherinneringen', value: notifHerinner, set: setNotifHerinner },
            ].map(({ label, value, set }, i, arr) => (
              <View key={label} style={[s.settingsRow, i < arr.length - 1 && s.settingsRowBorder]}>
                <Text style={s.settingsLabel}>{label}</Text>
                <Switch
                  value={value}
                  onValueChange={set}
                  trackColor={{ false: '#1e1e1e', true: '#1a3a10' }}
                  thumbColor={value ? '#4ade80' : '#333'}
                />
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#0a0a0a' },
  center:            { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  pad:               { padding: 20, paddingTop: 64, paddingBottom: 40 },
  pageTitle:         { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 16 },
  tabs:              { flexDirection: 'row', backgroundColor: '#111', borderRadius: 12, padding: 4, marginBottom: 20, gap: 4 },
  tab:               { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabActive:         { backgroundColor: '#1e1e1e' },
  tabText:           { fontSize: 12, color: '#444' },
  tabTextActive:     { color: '#fff', fontWeight: '600' },
  section:           { gap: 16 },
  profileCard:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#111', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1e1e1e' },
  avatar:            { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center' },
  avatarText:        { fontSize: 18, fontWeight: '700', color: '#60a5fa' },
  name:              { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  meta:              { fontSize: 12, color: '#444' },
  navBtn2:           { backgroundColor: '#111', borderWidth: 1, borderColor: '#1e3a5f', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8, flexDirection: 'row', justifyContent: 'center' },
  navBtn2Text:       { fontSize: 13, color: '#60a5fa', fontWeight: '600' },
  dangerBtn:         { borderWidth: 1, borderColor: '#2e1010', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  dangerBtnText:     { fontSize: 13, color: '#f87171', fontWeight: '600' },
  // Calendar
  calNav:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn:            { padding: 8 },
  navArrow:          { fontSize: 24, color: '#888' },
  monthLabel:        { fontSize: 15, fontWeight: '600', color: '#fff' },
  grid:              { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader:         { width: '14.28%', textAlign: 'center', fontSize: 10, color: '#444', paddingBottom: 8, textTransform: 'uppercase' },
  cell:              { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 4 },
  today:             { borderWidth: 1, borderColor: '#333' },
  dayNum:            { fontSize: 13, color: '#555' },
  legend:            { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 12 },
  legendItem:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:         { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  legendText:        { fontSize: 11 },
  hint:              { fontSize: 10, color: '#333', marginTop: 8 },
  // Settings
  settingsGroupLabel:{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1 },
  settingsCard:      { backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#1e1e1e', overflow: 'hidden' },
  settingsRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  settingsLabel:     { fontSize: 14, color: '#ccc' },
})
