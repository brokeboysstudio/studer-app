import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { fetchMessages } from '../lib/api'

interface PlannerEvent {
  id:             string
  titel:          string
  klant:          string | null
  datum_start:    string
  tijdstip_start: string | null
  tijdstip_einde: string | null
  locatie:        string | null
  status:         string
}

const NL_DAYS   = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag']
const NL_MONTHS = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']

function todayISO()    { return new Date().toISOString().split('T')[0] }
function tomorrowISO() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] }

function greet(name: string): string {
  const h = new Date().getHours()
  if (h < 12) return `Goedemorgen, ${name}`
  if (h < 18) return `Goedemiddag, ${name}`
  return `Goedenavond, ${name}`
}

function fmtTime(t: string | null) { return t ? t.slice(0, 5) : '' }

export default function HomeScherm() {
  const navigation = useNavigation<any>()

  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [firstName,    setFirstName]    = useState('daar')
  const [todayEvents,  setTodayEvents]  = useState<PlannerEvent[]>([])
  const [tomorrowEvts, setTomorrowEvts] = useState<PlannerEvent[]>([])
  const [unreadCount,  setUnreadCount]  = useState(0)
  const [pendingActie, setPendingActie] = useState(0)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setRefreshing(false); return }

    const { data: emp } = await supabase
      .from('employees')
      .select('id, full_name')
      .ilike('phone', `%${user.phone?.replace(/\D/g, '').slice(-9)}%`)
      .limit(1).single()

    if (!emp) { setLoading(false); setRefreshing(false); return }

    setFirstName(emp.full_name?.split(' ')[0] ?? 'daar')

    const tod = todayISO()
    const tom = tomorrowISO()

    // Bug 2 fix: Supabase JS v2 cannot filter on a joined table's columns via
    // .gte('planner_events.datum_start', ...). Instead: fetch the worker's
    // event_ids first, then query planner_events with a date filter directly.
    const { data: assignments } = await supabase
      .from('planner_event_workers')
      .select('event_id')
      .eq('employee_id', emp.id)

    const eventIds = (assignments ?? []).map((r: { event_id: string }) => r.event_id)

    if (eventIds.length > 0) {
      const { data: events } = await supabase
        .from('planner_events')
        .select('id, titel, klant, datum_start, tijdstip_start, tijdstip_einde, locatie, status')
        .in('id', eventIds)
        .gte('datum_start', tod)
        .lte('datum_start', tom)
        .order('datum_start', { ascending: true })

      const all = (events ?? []) as PlannerEvent[]
      setTodayEvents(all.filter(e => e.datum_start === tod))
      setTomorrowEvts(all.filter(e => e.datum_start === tom))
    } else {
      setTodayEvents([])
      setTomorrowEvts([])
    }

    try {
      const msgs = await fetchMessages(emp.id)
      setUnreadCount(msgs.filter(m => !m.gelezen).length)
      setPendingActie(msgs.filter(m => m.actie_vereist && !m.actie_gedaan).length)
    } catch { /* ignore */ }

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const now       = new Date()
  const dateLabel = `${NL_DAYS[now.getDay()]} ${now.getDate()} ${NL_MONTHS[now.getMonth()]} ${now.getFullYear()}`

  if (loading) return <View style={s.center}><ActivityIndicator color="#fff" /></View>

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.pad}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#fff" />}
    >
      <Text style={s.greeting}>{greet(firstName)}</Text>
      <Text style={s.date}>{dateLabel}</Text>

      {/* Vandaag */}
      <Text style={s.sectionTitle}>Vandaag</Text>
      {todayEvents.length === 0 ? (
        <View style={s.emptyCard}><Text style={s.emptyText}>Geen shift vandaag</Text></View>
      ) : todayEvents.map(ev => (
        <View key={ev.id} style={s.shiftCard}>
          <View style={s.shiftRow}>
            <Text style={s.shiftClient}>{ev.klant ?? ev.titel}</Text>
            <View style={[s.statusBadge, { backgroundColor: ev.status === 'bevestigd' ? '#0a2a1a' : '#1e1e1e' }]}>
              <Text style={[s.statusText, { color: ev.status === 'bevestigd' ? '#4ade80' : '#9ca3af' }]}>{ev.status}</Text>
            </View>
          </View>
          {(ev.tijdstip_start || ev.tijdstip_einde) && (
            <Text style={s.shiftTime}>{fmtTime(ev.tijdstip_start)}{ev.tijdstip_einde ? ` – ${fmtTime(ev.tijdstip_einde)}` : ''}</Text>
          )}
          {ev.locatie && <Text style={s.shiftLoc}>{ev.locatie}</Text>}
        </View>
      ))}

      {/* Morgen */}
      <Text style={s.sectionTitle}>Morgen</Text>
      {tomorrowEvts.length === 0 ? (
        <View style={s.emptyCard}><Text style={s.emptyText}>Geen shift morgen</Text></View>
      ) : tomorrowEvts.map(ev => (
        <View key={ev.id} style={[s.shiftCard, s.shiftCardCompact]}>
          <Text style={s.shiftClient}>{ev.klant ?? ev.titel}</Text>
          {ev.tijdstip_start && <Text style={s.shiftTime}>{fmtTime(ev.tijdstip_start)}{ev.tijdstip_einde ? ` – ${fmtTime(ev.tijdstip_einde)}` : ''}</Text>}
        </View>
      ))}

      {/* Openstaande acties */}
      {(unreadCount > 0 || pendingActie > 0) && (
        <>
          <Text style={s.sectionTitle}>Openstaande acties</Text>
          <View style={s.actiesCard}>
            {unreadCount > 0 && (
              <View style={s.actieRow}>
                <View style={s.actieDot} />
                <Text style={s.actieText}>{unreadCount} ongelezen bericht{unreadCount !== 1 ? 'en' : ''}</Text>
              </View>
            )}
            {pendingActie > 0 && (
              <View style={s.actieRow}>
                <View style={[s.actieDot, { backgroundColor: '#fb923c' }]} />
                <Text style={s.actieText}>{pendingActie} actie{pendingActie !== 1 ? 's' : ''} vereist</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Snelle acties — Bug 1 fix: knoppen navigeren nu naar echte schermen */}
      <Text style={s.sectionTitle}>Snelle acties</Text>
      <View style={s.quickRow}>
        <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('Prikklok')}>
          <Ionicons name="time-outline" size={24} color="#888" />
          <Text style={s.quickLabel}>Prikklok</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('Contracten')}>
          <Ionicons name="document-text-outline" size={24} color="#888" />
          <Text style={s.quickLabel}>Contracten</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('Autocheck')}>
          <Ionicons name="car-outline" size={24} color="#888" />
          <Text style={s.quickLabel}>Autocheck</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0a0a0a' },
  center:           { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  pad:              { padding: 20, paddingTop: 64, paddingBottom: 32 },
  greeting:         { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4 },
  date:             { fontSize: 13, color: '#555', marginBottom: 28 },
  sectionTitle:     { fontSize: 11, fontWeight: '700', color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 20 },
  emptyCard:        { backgroundColor: '#0d0d0d', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1a1a1a' },
  emptyText:        { fontSize: 13, color: '#333' },
  shiftCard:        { backgroundColor: '#111', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1e1e1e' },
  shiftCardCompact: { padding: 12 },
  shiftRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  shiftClient:      { fontSize: 14, fontWeight: '600', color: '#fff', flex: 1 },
  statusBadge:      { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  statusText:       { fontSize: 10, fontWeight: '600' },
  shiftTime:        { fontSize: 12, color: '#888', marginTop: 2 },
  shiftLoc:         { fontSize: 11, color: '#444', marginTop: 2 },
  actiesCard:       { backgroundColor: '#111', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1e1e1e', gap: 10 },
  actieRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actieDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#60a5fa' },
  actieText:        { fontSize: 13, color: '#ccc' },
  quickRow:         { flexDirection: 'row', gap: 10 },
  quickBtn:         { flex: 1, backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 },
  quickIcon:        { fontSize: 22 }, // kept for reference
  quickLabel:       { fontSize: 10, color: '#888', textAlign: 'center' },
})
