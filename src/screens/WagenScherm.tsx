import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Linking,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { fetchWagenToewijzing, WagenToewijzing } from '../lib/api'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-BE', { weekday: 'long', day: '2-digit', month: 'short' })
}

function fmtTime(s: string | null, e: string | null) {
  if (!s) return ''
  return `${s.slice(0, 5)}${e ? ` – ${e.slice(0, 5)}` : ''}`
}

export default function WagenScherm() {
  const navigation = useNavigation<any>()
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [empId,       setEmpId]       = useState<string | null>(null)
  const [toewijzingen,setToewijzingen]= useState<WagenToewijzing[]>([])

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setRefreshing(false); return }
    const { data: emp } = await supabase
      .from('employees').select('id')
      .ilike('phone', `%${user.phone?.replace(/\D/g, '').slice(-9)}%`)
      .limit(1).single()
    if (!emp) { setLoading(false); setRefreshing(false); return }
    setEmpId(emp.id)
    try {
      const list = await fetchWagenToewijzing(emp.id)
      setToewijzingen(list)
    } catch { /* ignore */ }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <View style={s.center}><ActivityIndicator color="#fff" /></View>

  const current = toewijzingen[0] ?? null
  const upcoming = toewijzingen.slice(1)

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.pad}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#fff" />}
    >
      <Text style={s.pageTitle}>Mijn Wagen</Text>

      {!current ? (
        <View style={s.emptyCard}>
          <Ionicons name="car-outline" size={48} color="#333" />
          <Text style={s.emptyTitle}>Geen toewijzing</Text>
          <Text style={s.emptyText}>Er is momenteel geen wagen aan jou toegewezen.</Text>
        </View>
      ) : (
        <>
          {/* Wagen info */}
          {current.wagen && (
            <View style={s.wagenCard}>
              <View style={s.wagenHeader}>
                <Text style={s.wagenPlate}>{current.wagen.nummerplaat}</Text>
                {current.wagen.merk && (
                  <Text style={s.wagenMerk}>{current.wagen.merk}{current.wagen.model ? ` ${current.wagen.model}` : ''}</Text>
                )}
              </View>
            </View>
          )}

          {/* Toewijzing details */}
          <View style={s.card}>
            <Text style={s.cardLabel}>Huidige toewijzing</Text>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Periode</Text>
              <Text style={s.infoVal}>{fmtDate(current.datum_start)}{current.datum_eind !== current.datum_start ? ` → ${fmtDate(current.datum_eind)}` : ''}</Text>
            </View>
            {current.project && (
              <>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Klant</Text>
                  <Text style={s.infoVal}>{current.project.klant ?? current.project.titel}</Text>
                </View>
                {current.project.locatie && (
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Locatie</Text>
                    <Text style={s.infoVal}>{current.project.locatie}</Text>
                  </View>
                )}
                {(current.project.tijdstip_start || current.project.tijdstip_einde) && (
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Tijdstip</Text>
                    <Text style={s.infoVal}>{fmtTime(current.project.tijdstip_start, current.project.tijdstip_einde)}</Text>
                  </View>
                )}
              </>
            )}
            {current.doel && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Doel</Text>
                <Text style={s.infoVal}>{current.doel}</Text>
              </View>
            )}
          </View>

          {/* Actie buttons */}
          <View style={s.actionRow}>
            {current.project?.locatie && (
              <TouchableOpacity
                style={[s.actionBtn, s.actionBtnPrimary]}
                onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(current.project!.locatie!)}`)}
              >
                <Ionicons name="navigate-outline" size={18} color="#60a5fa" />
                <Text style={s.actionBtnText}>Navigeren</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.actionBtn, s.actionBtnPrimary]}
              onPress={() => navigation.navigate('Autocheck')}
            >
              <Ionicons name="car-outline" size={18} color="#60a5fa" />
              <Text style={s.actionBtnText}>Autocheck</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Volgende toewijzingen */}
      {upcoming.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Volgende toewijzingen</Text>
          {upcoming.map(tw => (
            <View key={tw.id} style={s.upcomingCard}>
              <View style={s.upcomingLeft}>
                <Text style={s.upcomingDate}>{fmtDate(tw.datum_start)}</Text>
                {tw.wagen && <Text style={s.upcomingPlate}>{tw.wagen.nummerplaat}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                {tw.project && <Text style={s.upcomingClient}>{tw.project.klant ?? tw.project.titel}</Text>}
                {tw.project?.locatie && <Text style={s.upcomingLoc}>{tw.project.locatie}</Text>}
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0a0a0a' },
  center:             { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  pad:                { padding: 20, paddingTop: 64, paddingBottom: 32 },
  pageTitle:          { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 20 },
  emptyCard:          { alignItems: 'center', gap: 10, paddingVertical: 48 },
  emptyIcon:          { marginBottom: 8 },
  emptyTitle:         { fontSize: 16, fontWeight: '700', color: '#fff' },
  emptyText:          { fontSize: 13, color: '#444', textAlign: 'center' },
  wagenCard:          { backgroundColor: '#111', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e1e' },
  wagenHeader:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wagenPlate:         { fontSize: 22, fontWeight: '900', color: '#fff', fontVariant: ['tabular-nums'], letterSpacing: 2 },
  wagenMerk:          { fontSize: 13, color: '#555' },
  card:               { backgroundColor: '#111', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e1e', gap: 10 },
  cardLabel:          { fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  infoRow:            { flexDirection: 'row', gap: 10 },
  infoLabel:          { fontSize: 11, color: '#444', width: 64 },
  infoVal:            { fontSize: 13, color: '#ccc', flex: 1 },
  actionRow:          { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 14, borderWidth: 1 },
  actionBtnPrimary:   { backgroundColor: '#111', borderColor: '#1e3a5f' },
  actionBtnIcon:      { marginRight: 4 },
  actionBtnText:      { fontSize: 13, color: '#60a5fa', fontWeight: '600' },
  sectionTitle:       { fontSize: 11, fontWeight: '700', color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  upcomingCard:       { backgroundColor: '#0d0d0d', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: '#1a1a1a' },
  upcomingLeft:       { gap: 2 },
  upcomingDate:       { fontSize: 11, color: '#555', fontWeight: '600' },
  upcomingPlate:      { fontSize: 12, color: '#888', fontWeight: '700', letterSpacing: 1 },
  upcomingClient:     { fontSize: 13, color: '#ccc', fontWeight: '600' },
  upcomingLoc:        { fontSize: 11, color: '#444' },
})
