import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { fetchMessages, markRead, confirmShift, WorkerMessage } from '../lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  info:     '#60a5fa',
  shift:    '#a78bfa',
  document: '#fb923c',
  actie:    '#f87171',
}

function typeColor(type: string) {
  return TYPE_COLORS[type] ?? '#888'
}

function relTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return `${diff}s geleden`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m geleden`
  if (diff < 86400) return `${Math.floor(diff / 3600)}u geleden`
  return `${Math.floor(diff / 86400)}d geleden`
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function InboxScherm() {
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [messages,   setMessages]   = useState<WorkerMessage[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected,   setSelected]   = useState<WorkerMessage | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmed,  setConfirmed]  = useState<Set<string>>(new Set())

  async function resolveEmployeeId() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.phone) return null
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .ilike('phone', `%${user.phone.replace(/\D/g, '').slice(-9)}%`)
      .limit(1)
      .single()
    return emp?.id ?? null
  }

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)

    let empId = employeeId
    if (!empId) {
      empId = await resolveEmployeeId()
      if (empId) setEmployeeId(empId)
    }

    if (empId) {
      try {
        const msgs = await fetchMessages(empId)
        setMessages(msgs)
      } catch {
        // silently ignore, show stale data
      }
    }

    setLoading(false)
    setRefreshing(false)
  }, [employeeId])

  useEffect(() => { load() }, [])

  async function openMessage(msg: WorkerMessage) {
    setSelected(msg)
    if (!msg.gelezen && employeeId) {
      try {
        await markRead(employeeId, msg.id)
        setMessages(prev =>
          prev.map(m => m.id === msg.id ? { ...m, gelezen: true } : m),
        )
      } catch { /* ignore */ }
    }
  }

  async function handleConfirm() {
    if (!selected || !employeeId) return
    setConfirming(true)
    try {
      await confirmShift(employeeId, selected.id)
      setConfirmed(prev => new Set(prev).add(selected.id))
      setMessages(prev =>
        prev.map(m => m.id === selected.id ? { ...m, actie_gedaan: true } : m),
      )
      setSelected(prev => prev ? { ...prev, actie_gedaan: true } : prev)
    } catch {
      Alert.alert('Fout', 'Bevestiging mislukt. Probeer opnieuw.')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  // ── Detail view ──────────────────────────────────────────────────────────────

  if (selected) {
    const isDone = selected.actie_gedaan || confirmed.has(selected.id)
    return (
      <ScrollView style={s.container} contentContainerStyle={s.pad}>
        <TouchableOpacity onPress={() => setSelected(null)} style={s.backBtn}>
          <Text style={s.backText}>← Terug</Text>
        </TouchableOpacity>

        <View style={s.detailHeader}>
          <View style={[s.typePill, { backgroundColor: typeColor(selected.type) + '22', borderColor: typeColor(selected.type) + '44' }]}>
            <Text style={[s.typePillText, { color: typeColor(selected.type) }]}>{selected.type}</Text>
          </View>
          <Text style={s.detailTitle}>{selected.titel}</Text>
          <Text style={s.detailTime}>{relTime(selected.aangemaakt_op)}</Text>
        </View>

        <View style={s.bodyBlock}>
          <Text style={s.bodyText}>{selected.inhoud || '—'}</Text>
        </View>

        {selected.actie_vereist && (
          isDone ? (
            <View style={s.confirmedRow}>
              <Text style={s.confirmedText}>✓ Shift bevestigd</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.confirmBtn, confirming && s.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={confirming}
            >
              {confirming
                ? <ActivityIndicator color="#0a0a0a" size="small" />
                : <Text style={s.confirmBtnText}>Bevestig shift</Text>
              }
            </TouchableOpacity>
          )
        )}
      </ScrollView>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────

  const unread = messages.filter(m => !m.gelezen).length

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.pad}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#fff" />}
    >
      <View style={s.headerRow}>
        <Text style={s.pageTitle}>Inbox</Text>
        {unread > 0 && (
          <View style={s.unreadBadge}>
            <Text style={s.unreadCount}>{unread}</Text>
          </View>
        )}
      </View>

      {messages.length === 0 ? (
        <Text style={s.empty}>Geen berichten</Text>
      ) : (
        messages.map(msg => (
          <TouchableOpacity
            key={msg.id}
            style={[s.card, !msg.gelezen && s.cardUnread]}
            onPress={() => openMessage(msg)}
          >
            <View style={s.cardLeft}>
              {!msg.gelezen && <View style={s.unreadDot} />}
              <View style={{ flex: 1 }}>
                <View style={s.cardTopRow}>
                  <View style={[s.typePill, { backgroundColor: typeColor(msg.type) + '22', borderColor: typeColor(msg.type) + '44' }]}>
                    <Text style={[s.typePillText, { color: typeColor(msg.type) }]}>{msg.type}</Text>
                  </View>
                  <Text style={s.cardTime}>{relTime(msg.aangemaakt_op)}</Text>
                </View>
                <Text style={[s.cardTitle, !msg.gelezen && s.cardTitleUnread]} numberOfLines={1}>
                  {msg.titel}
                </Text>
                {msg.inhoud ? (
                  <Text style={s.cardSub} numberOfLines={1}>{msg.inhoud}</Text>
                ) : null}
              </View>
            </View>
            {msg.actie_vereist && (
              <View style={[s.actieBadge, msg.actie_gedaan && s.actieBadgeDone]}>
                <Text style={[s.actieBadgeText, msg.actie_gedaan && s.actieBadgeTextDone]}>
                  {msg.actie_gedaan ? '✓' : '!'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#0a0a0a' },
  center:              { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  pad:                 { padding: 20, paddingTop: 60 },

  headerRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  pageTitle:           { fontSize: 20, fontWeight: '700', color: '#fff' },
  unreadBadge:         { backgroundColor: '#3b82f6', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  unreadCount:         { fontSize: 11, fontWeight: '700', color: '#fff' },

  empty:               { color: '#333', fontSize: 13, textAlign: 'center', marginTop: 40 },

  card:                { backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardUnread:          { borderColor: '#1d3a5c' },
  cardLeft:            { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1 },
  unreadDot:           { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3b82f6', marginTop: 5, flexShrink: 0 },
  cardTopRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle:           { fontSize: 13, fontWeight: '500', color: '#aaa' },
  cardTitleUnread:     { color: '#fff', fontWeight: '600' },
  cardSub:             { fontSize: 11, color: '#444', marginTop: 2 },
  cardTime:            { fontSize: 10, color: '#444' },

  typePill:            { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  typePillText:        { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  actieBadge:          { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f87171', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', flexShrink: 0, marginLeft: 8 },
  actieBadgeDone:      { backgroundColor: '#16a34a' },
  actieBadgeText:      { fontSize: 11, fontWeight: '700', color: '#fff' },
  actieBadgeTextDone:  { fontSize: 12 },

  // Detail
  backBtn:             { marginBottom: 16 },
  backText:            { color: '#60a5fa', fontSize: 14 },
  detailHeader:        { marginBottom: 16 },
  detailTitle:         { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 8, marginBottom: 4 },
  detailTime:          { fontSize: 11, color: '#555' },
  bodyBlock:           { backgroundColor: '#0d0d0d', borderRadius: 12, padding: 16, marginBottom: 20 },
  bodyText:            { fontSize: 13, color: '#aaa', lineHeight: 20 },

  confirmBtn:          { backgroundColor: '#4ade80', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmBtnDisabled:  { opacity: 0.5 },
  confirmBtnText:      { fontSize: 14, fontWeight: '700', color: '#0a0a0a' },

  confirmedRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#0d2318', borderWidth: 1, borderColor: '#16a34a44' },
  confirmedText:       { fontSize: 14, fontWeight: '600', color: '#4ade80' },
})
