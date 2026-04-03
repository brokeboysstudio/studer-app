import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, Alert,
  TextInput, Platform,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { indienTerugtrekking } from '../lib/api'

interface PlannerEvent {
  id:             string
  titel:          string
  klant:          string | null
  datum_start:    string
  tijdstip_start: string | null
  tijdstip_einde: string | null
  locatie:        string | null
  briefing:       string | null
  dresscode:      string | null
  contactpersoon_naam: string | null
  contactpersoon_tel:  string | null
  status:         string
}

const STATUS_COLORS: Record<string, string> = {
  gepland:    '#60a5fa',
  bevestigd:  '#4ade80',
  afgewerkt:  '#9ca3af',
  geannuleerd:'#f87171',
}

const REDENEN = [
  'Ziekte',
  'Overlijden familie',
  'Examen',
  'Vervoersproblemen',
  'Persoonlijke nood',
  'Andere',
]

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-BE', { weekday: 'short', day: '2-digit', month: 'short' })
}

type TerugtrekkingStep = 'warning' | 'reden' | 'confirm' | 'done'

export default function MijnShiftsScherm() {
  const navigation = useNavigation<any>()
  const [events,   setEvents]   = useState<PlannerEvent[]>([])
  const [loading,  setLoading]  = useState(true)
  const [refresh,  setRefresh]  = useState(false)
  const [selected, setSelected] = useState<PlannerEvent | null>(null)
  const [empId,    setEmpId]    = useState<string | null>(null)

  // Terugtrekking modal
  const [ttEvent,  setTtEvent]  = useState<PlannerEvent | null>(null)
  const [ttStep,   setTtStep]   = useState<TerugtrekkingStep>('warning')
  const [ttReden,  setTtReden]  = useState(REDENEN[0])
  const [ttToelichting, setTtToelichting] = useState('')
  const [ttSubmitting,  setTtSubmitting]  = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setRefresh(false); return }

    const { data: emp } = await supabase
      .from('employees').select('id')
      .ilike('phone', `%${user.phone?.replace(/\D/g, '').slice(-9)}%`)
      .limit(1).single()
    if (!emp) { setLoading(false); setRefresh(false); return }
    setEmpId(emp.id)

    const today = new Date().toISOString().split('T')[0]

    // Two-step query: can't filter on joined table columns in Supabase JS v2
    const { data: assignments } = await supabase
      .from('planner_event_workers')
      .select('event_id')
      .eq('employee_id', emp.id)

    const eventIds = (assignments ?? []).map((r: { event_id: string }) => r.event_id)
    let evs: PlannerEvent[] = []
    if (eventIds.length > 0) {
      const { data } = await supabase
        .from('planner_events')
        .select('id, titel, klant, datum_start, tijdstip_start, tijdstip_einde, locatie, briefing, dresscode, contactpersoon_naam, contactpersoon_tel, status')
        .in('id', eventIds)
        .gte('datum_start', today)
        .order('datum_start', { ascending: true })
        .limit(30)
      evs = (data ?? []) as PlannerEvent[]
    }
    setEvents(evs)
    setLoading(false)
    setRefresh(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openTerugtrekking(ev: PlannerEvent) {
    setTtEvent(ev)
    setTtStep('warning')
    setTtReden(REDENEN[0])
    setTtToelichting('')
    setSelected(null)
  }

  async function submitTerugtrekking() {
    if (!empId || !ttEvent) return
    if (ttReden === 'Andere' && !ttToelichting.trim()) {
      Alert.alert('Toelichting vereist', 'Voeg een toelichting toe bij reden "Andere".')
      return
    }
    setTtSubmitting(true)
    try {
      await indienTerugtrekking(empId, {
        planner_event_id: ttEvent.id,
        reden: ttReden,
        toelichting: ttToelichting || undefined,
      })
      setTtStep('done')
    } catch {
      Alert.alert('Fout', 'Aanvraag kon niet ingediend worden. Probeer opnieuw.')
    }
    setTtSubmitting(false)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#fff" /></View>

  // Detail view
  if (selected) return (
    <ScrollView style={s.container} contentContainerStyle={s.pad}>
      <TouchableOpacity onPress={() => setSelected(null)} style={s.backBtn}>
        <Text style={s.backText}>← Terug</Text>
      </TouchableOpacity>
      <Text style={s.title}>{selected.klant ?? selected.titel}</Text>
      <Text style={s.sub}>{fmtDate(selected.datum_start)}</Text>
      {selected.tijdstip_start && (
        <View style={s.row}>
          <Text style={s.rowLabel}>Tijdstip</Text>
          <Text style={s.rowValue}>{selected.tijdstip_start.slice(0, 5)}{selected.tijdstip_einde ? ` – ${selected.tijdstip_einde.slice(0, 5)}` : ''}</Text>
        </View>
      )}
      {selected.locatie && (
        <View style={s.row}><Text style={s.rowLabel}>Locatie</Text><Text style={s.rowValue}>{selected.locatie}</Text></View>
      )}
      {selected.dresscode && (
        <View style={s.row}><Text style={s.rowLabel}>Dresscode</Text><Text style={s.rowValue}>{selected.dresscode}</Text></View>
      )}
      {selected.contactpersoon_naam && (
        <View style={s.row}>
          <Text style={s.rowLabel}>Contact</Text>
          <Text style={s.rowValue}>{selected.contactpersoon_naam}{selected.contactpersoon_tel ? ` · ${selected.contactpersoon_tel}` : ''}</Text>
        </View>
      )}
      {selected.briefing && (
        <View style={s.block}>
          <Text style={s.blockLabel}>Briefing</Text>
          <Text style={s.blockText}>{selected.briefing}</Text>
        </View>
      )}
      <TouchableOpacity style={s.prikklokBtn} onPress={() => navigation.navigate('Prikklok')}>
        <Ionicons name="time-outline" size={16} color="#60a5fa" style={{ marginRight: 6 }} />
        <Text style={s.prikklokText}>Inkloppen</Text>
      </TouchableOpacity>
      {selected.status !== 'afgewerkt' && selected.status !== 'geannuleerd' && (
        <TouchableOpacity style={s.terugtrekBtn} onPress={() => openTerugtrekking(selected)}>
          <Text style={s.terugtrekText}>Terugtrekken</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )

  return (
    <>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.pad}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} tintColor="#fff" />}
      >
        <Text style={s.pageTitle}>Mijn Shifts</Text>
        {events.length === 0 ? (
          <Text style={s.empty}>Geen aankomende shifts</Text>
        ) : events.map(ev => {
          const color = STATUS_COLORS[ev.status] ?? '#888'
          return (
            <TouchableOpacity key={ev.id} style={s.card} onPress={() => setSelected(ev)}>
              <View style={s.cardLeft}>
                <View style={[s.dot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{ev.klant ?? ev.titel}</Text>
                  <Text style={s.cardSub}>{fmtDate(ev.datum_start)}{ev.tijdstip_start ? ` · ${ev.tijdstip_start.slice(0, 5)}` : ''}</Text>
                  {ev.locatie && <Text style={s.cardMeta}>{ev.locatie}</Text>}
                </View>
              </View>
              <Text style={[s.badge, { color }]}>{ev.status}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Terugtrekking modal */}
      <Modal visible={!!ttEvent && ttStep !== 'done'} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          {ttStep === 'warning' && (
            <>
              <Text style={s.modalTitle}>Terugtrekking</Text>
              <Text style={s.modalWarn}>
                Je staat ingepland voor{'\n'}
                <Text style={{ color: '#fff', fontWeight: '700' }}>{ttEvent?.klant ?? ttEvent?.titel}</Text>
                {ttEvent?.datum_start ? ` op ${fmtDate(ttEvent.datum_start)}` : ''}.
              </Text>
              <Text style={s.modalSub}>
                Terugtrekking moet gemotiveerd worden en kan gevolgen hebben voor je profiel.
              </Text>
              <TouchableOpacity style={s.modalBtnPrimary} onPress={() => setTtStep('reden')}>
                <Text style={s.modalBtnPrimaryText}>Doorgaan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSecondary} onPress={() => setTtEvent(null)}>
                <Text style={s.modalBtnSecondaryText}>Annuleer</Text>
              </TouchableOpacity>
            </>
          )}

          {ttStep === 'reden' && (
            <>
              <Text style={s.modalTitle}>Reden opgeven</Text>
              <Text style={s.modalLabel}>Reden</Text>
              <View style={s.redenList}>
                {REDENEN.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[s.redenItem, ttReden === r && s.redenItemActive]}
                    onPress={() => setTtReden(r)}
                  >
                    <View style={[s.radio, ttReden === r && s.radioActive]} />
                    <Text style={[s.redenText, ttReden === r && { color: '#fff' }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.modalLabel}>Toelichting{ttReden === 'Andere' ? ' (verplicht)' : ' (optioneel)'}</Text>
              <TextInput
                style={s.textInput}
                value={ttToelichting}
                onChangeText={setTtToelichting}
                placeholder="Voeg meer informatie toe…"
                placeholderTextColor="#333"
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity style={s.modalBtnPrimary} onPress={() => setTtStep('confirm')}>
                <Text style={s.modalBtnPrimaryText}>Verdergaan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSecondary} onPress={() => setTtStep('warning')}>
                <Text style={s.modalBtnSecondaryText}>← Terug</Text>
              </TouchableOpacity>
            </>
          )}

          {ttStep === 'confirm' && (
            <>
              <Text style={s.modalTitle}>Bevestigen</Text>
              <View style={s.summary}>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Shift</Text>
                  <Text style={s.summaryVal}>{ttEvent?.klant ?? ttEvent?.titel}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Datum</Text>
                  <Text style={s.summaryVal}>{ttEvent?.datum_start ? fmtDate(ttEvent.datum_start) : '—'}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Reden</Text>
                  <Text style={s.summaryVal}>{ttReden}</Text>
                </View>
                {ttToelichting ? (
                  <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>Toelichting</Text>
                    <Text style={[s.summaryVal, { flex: 1 }]}>{ttToelichting}</Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity
                style={[s.modalBtnPrimary, ttSubmitting && { opacity: 0.5 }]}
                onPress={submitTerugtrekking}
                disabled={ttSubmitting}
              >
                {ttSubmitting
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.modalBtnPrimaryText}>Aanvraag indienen</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSecondary} onPress={() => setTtStep('reden')}>
                <Text style={s.modalBtnSecondaryText}>← Terug</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      {/* Done modal */}
      <Modal visible={ttStep === 'done'} animationType="fade" transparent>
        <View style={s.doneOverlay}>
          <View style={s.doneCard}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#4ade80" />
            <Text style={s.doneTitle}>Aanvraag ingediend</Text>
            <Text style={s.doneSub}>Je planner wordt verwittigd en verwerkt je aanvraag zo snel mogelijk.</Text>
            <TouchableOpacity style={s.modalBtnPrimary} onPress={() => { setTtEvent(null); setTtStep('warning'); load() }}>
              <Text style={s.modalBtnPrimaryText}>Sluiten</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#0a0a0a' },
  center:              { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  pad:                 { padding: 20, paddingTop: 64, paddingBottom: 32 },
  pageTitle:           { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 20 },
  empty:               { color: '#333', fontSize: 13, textAlign: 'center', marginTop: 40 },
  card:                { backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft:            { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  dot:                 { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  cardTitle:           { fontSize: 14, fontWeight: '600', color: '#fff' },
  cardSub:             { fontSize: 11, color: '#666', marginTop: 2 },
  cardMeta:            { fontSize: 10, color: '#444', marginTop: 1 },
  badge:               { fontSize: 10, fontWeight: '600' },
  backBtn:             { marginBottom: 16 },
  backText:            { color: '#60a5fa', fontSize: 14 },
  title:               { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  sub:                 { fontSize: 13, color: '#555', marginBottom: 20 },
  row:                 { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#111' },
  rowLabel:            { fontSize: 12, color: '#444' },
  rowValue:            { fontSize: 12, color: '#ccc', flex: 1, textAlign: 'right' },
  block:               { backgroundColor: '#0d0d0d', borderRadius: 12, padding: 14, marginTop: 12 },
  blockLabel:          { fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  blockText:           { fontSize: 13, color: '#aaa', lineHeight: 20 },
  prikklokBtn:         { marginTop: 24, backgroundColor: '#111', borderWidth: 1, borderColor: '#1e3a5f', borderRadius: 10, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  prikklokText:        { fontSize: 13, color: '#60a5fa', fontWeight: '600' },
  terugtrekBtn:        { marginTop: 10, borderWidth: 1, borderColor: '#2e1010', borderRadius: 10, padding: 14, alignItems: 'center' },
  terugtrekText:       { fontSize: 13, color: '#f87171', fontWeight: '600' },
  // Modal
  modal:               { flex: 1, backgroundColor: '#0a0a0a', padding: 24, paddingTop: 60 },
  modalTitle:          { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 16 },
  modalWarn:           { fontSize: 15, color: '#888', marginBottom: 12, lineHeight: 22 },
  modalSub:            { fontSize: 12, color: '#444', marginBottom: 32, lineHeight: 18 },
  modalLabel:          { fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  redenList:           { gap: 8, marginBottom: 20 },
  redenItem:           { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e1e1e', backgroundColor: '#111' },
  redenItemActive:     { borderColor: '#60a5fa', backgroundColor: '#0d1926' },
  radio:               { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#333' },
  radioActive:         { borderColor: '#60a5fa', backgroundColor: '#60a5fa' },
  redenText:           { fontSize: 13, color: '#666' },
  textInput:           { backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13, marginBottom: 24, minHeight: 80, textAlignVertical: 'top' },
  modalBtnPrimary:     { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  modalBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#000' },
  modalBtnSecondary:   { borderRadius: 12, padding: 12, alignItems: 'center' },
  modalBtnSecondaryText:{ fontSize: 14, color: '#555' },
  summary:             { backgroundColor: '#111', borderRadius: 12, padding: 16, marginBottom: 24, gap: 10 },
  summaryRow:          { flexDirection: 'row', gap: 12 },
  summaryLabel:        { fontSize: 11, color: '#444', width: 70 },
  summaryVal:          { fontSize: 13, color: '#ccc' },
  // Done
  doneOverlay:         { flex: 1, backgroundColor: '#000000cc', alignItems: 'center', justifyContent: 'center' },
  doneCard:            { backgroundColor: '#111', borderRadius: 20, padding: 32, margin: 24, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#1e1e1e' },
  doneIcon:            { fontSize: 48 }, // replaced by Ionicons
  doneTitle:           { fontSize: 18, fontWeight: '700', color: '#fff' },
  doneSub:             { fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
})
