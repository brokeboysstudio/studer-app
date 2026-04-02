import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { supabase } from '../lib/supabase'

interface Shift {
  id:           string
  shift_date:   string
  project_name: string | null
  client_name:  string | null
  total_hours:  number | null
  contract_type: string | null
}

interface PlannerEvent {
  id:              string
  titel:           string
  klant:           string | null
  datum_start:     string
  tijdstip_start:  string | null
  tijdstip_einde:  string | null
  locatie:         string | null
  briefing:        string | null
  dresscode:       string | null
  contactpersoon_naam: string | null
  contactpersoon_tel:  string | null
  status:          string
}

const STATUS_COLORS: Record<string, string> = {
  gepland:    '#60a5fa',
  bevestigd:  '#4ade80',
  afgewerkt:  '#9ca3af',
  geannuleerd:'#f87171',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-BE', { weekday: 'short', day: '2-digit', month: 'short' })
}

export default function ShiftsScherm() {
  const [events,   setEvents]   = useState<PlannerEvent[]>([])
  const [loading,  setLoading]  = useState(true)
  const [refresh,  setRefresh]  = useState(false)
  const [selected, setSelected] = useState<PlannerEvent | null>(null)

  async function load(isRefresh = false) {
    if (isRefresh) setRefresh(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setRefresh(false); return }

    // Get employee_id from phone
    const phone = user.phone
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .ilike('phone', `%${phone?.replace(/\D/g,'').slice(-9)}%`)
      .limit(1)
      .single()

    if (!emp) { setLoading(false); setRefresh(false); return }

    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('planner_event_workers')
      .select('event:planner_events(id, titel, klant, datum_start, tijdstip_start, tijdstip_einde, locatie, briefing, dresscode, contactpersoon_naam, contactpersoon_tel, status)')
      .eq('employee_id', emp.id)
      .gte('planner_events.datum_start', today)
      .order('planner_events.datum_start', { ascending: true })
      .limit(20)

    const evs = (data ?? [])
      .map((r: any) => r.event)
      .filter(Boolean)
      .sort((a: any, b: any) => a.datum_start.localeCompare(b.datum_start))

    setEvents(evs)
    setLoading(false)
    setRefresh(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color="#fff" />
    </View>
  )

  if (selected) return (
    <ScrollView style={s.container} contentContainerStyle={s.pad}>
      <TouchableOpacity onPress={() => setSelected(null)} style={s.backBtn}>
        <Text style={s.backText}>← Terug</Text>
      </TouchableOpacity>
      <Text style={s.title}>{selected.klant ?? selected.titel}</Text>
      <Text style={s.sub}>{fmtDate(selected.datum_start)}</Text>
      {selected.tijdstip_start && (
        <View style={s.row}><Text style={s.rowLabel}>Tijdstip</Text><Text style={s.rowValue}>{selected.tijdstip_start.slice(0,5)}{selected.tijdstip_einde ? ` – ${selected.tijdstip_einde.slice(0,5)}` : ''}</Text></View>
      )}
      {selected.locatie && (
        <View style={s.row}><Text style={s.rowLabel}>Locatie</Text><Text style={s.rowValue}>{selected.locatie}</Text></View>
      )}
      {selected.dresscode && (
        <View style={s.row}><Text style={s.rowLabel}>Dresscode</Text><Text style={s.rowValue}>{selected.dresscode}</Text></View>
      )}
      {selected.contactpersoon_naam && (
        <View style={s.row}><Text style={s.rowLabel}>Contact</Text><Text style={s.rowValue}>{selected.contactpersoon_naam}{selected.contactpersoon_tel ? ` · ${selected.contactpersoon_tel}` : ''}</Text></View>
      )}
      {selected.briefing && (
        <View style={s.block}>
          <Text style={s.blockLabel}>Briefing</Text>
          <Text style={s.blockText}>{selected.briefing}</Text>
        </View>
      )}
    </ScrollView>
  )

  return (
    <ScrollView style={s.container} contentContainerStyle={s.pad}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} tintColor="#fff" />}>
      <Text style={s.pageTitle}>Mijn Shifts</Text>
      {events.length === 0 ? (
        <Text style={s.empty}>Geen aankomende shifts</Text>
      ) : events.map(ev => {
        const color = STATUS_COLORS[ev.status] ?? '#888'
        return (
          <TouchableOpacity key={ev.id} style={s.card} onPress={() => setSelected(ev)}>
            <View style={s.cardLeft}>
              <View style={[s.dot, { backgroundColor: color }]} />
              <View>
                <Text style={s.cardTitle}>{ev.klant ?? ev.titel}</Text>
                <Text style={s.cardSub}>{fmtDate(ev.datum_start)}{ev.tijdstip_start ? ` · ${ev.tijdstip_start.slice(0,5)}` : ''}</Text>
                {ev.locatie && <Text style={s.cardMeta}>{ev.locatie}</Text>}
              </View>
            </View>
            <Text style={[s.badge, { color }]}>{ev.status}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center:    { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  pad:       { padding: 20, paddingTop: 60 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 20 },
  empty:     { color: '#333', fontSize: 13, textAlign: 'center', marginTop: 40 },
  card:      { backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  dot:       { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  cardSub:   { fontSize: 11, color: '#666', marginTop: 2 },
  cardMeta:  { fontSize: 10, color: '#444', marginTop: 1 },
  badge:     { fontSize: 10, fontWeight: '600' },
  backBtn:   { marginBottom: 16 },
  backText:  { color: '#60a5fa', fontSize: 14 },
  title:     { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  sub:       { fontSize: 13, color: '#555', marginBottom: 20 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#111' },
  rowLabel:  { fontSize: 12, color: '#444' },
  rowValue:  { fontSize: 12, color: '#ccc', flex: 1, textAlign: 'right' },
  block:     { backgroundColor: '#0d0d0d', borderRadius: 12, padding: 14, marginTop: 12 },
  blockLabel:{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  blockText: { fontSize: 13, color: '#aaa', lineHeight: 20 },
})
