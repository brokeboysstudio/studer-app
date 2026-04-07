import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Animated, PanResponder, Dimensions,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { fetchThreads, archiveerThread, ChatThread } from '../lib/api'

const { width: W } = Dimensions.get('window')

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'gisteren'
  return d.toLocaleDateString('nl-BE', { weekday: 'short' })
}

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ── Swipeable thread row ──────────────────────────────────────────────────────

function ThreadRow({ thread, onPress, onArchive }: {
  thread: ChatThread
  onPress: () => void
  onArchive: () => void
}) {
  const translateX = useRef(new Animated.Value(0)).current
  const archiveBtnW = 88

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -archiveBtnW - 20))
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -archiveBtnW / 2) {
          Animated.spring(translateX, { toValue: -archiveBtnW, useNativeDriver: true }).start()
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
        }
      },
    })
  ).current

  function handleArchive() {
    Animated.timing(translateX, { toValue: -W, duration: 200, useNativeDriver: true })
      .start(onArchive)
  }

  const preview = thread.laatste_bericht
  const isUnread = thread.ongelezen_count > 0

  return (
    <View style={row.wrap}>
      {/* Archive button behind */}
      <View style={row.archiveBg}>
        <TouchableOpacity style={row.archiveBtn} onPress={handleArchive}>
          <Ionicons name="archive-outline" size={18} color="#fff" />
          <Text style={row.archiveTxt}>Archiveer</Text>
        </TouchableOpacity>
      </View>

      {/* Foreground */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity style={row.item} onPress={onPress} activeOpacity={0.75}>
          {/* Avatar */}
          <View style={[row.avatar, isUnread && row.avatarUnread]}>
            <Text style={row.avatarText}>
              {initials(preview?.afzender_naam ?? thread.title)}
            </Text>
          </View>

          {/* Content */}
          <View style={row.textArea}>
            <View style={row.topLine}>
              <Text style={[row.title, isUnread && row.titleBold]} numberOfLines={1}>{thread.title ?? 'Studer'}</Text>
              <Text style={row.time}>{thread.laatste_bericht_at ? fmtTime(thread.laatste_bericht_at) : ''}</Text>
            </View>
            <View style={row.bottomLine}>
              <Text
                style={[row.preview, preview?.type === 'systeem' && row.previewItalic]}
                numberOfLines={1}
              >
                {preview?.inhoud ?? 'Geen berichten'}
              </Text>
              {isUnread && (
                <View style={row.badge}>
                  <Text style={row.badgeTxt}>{thread.ongelezen_count > 99 ? '99+' : thread.ongelezen_count}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const row = StyleSheet.create({
  wrap:         { position: 'relative', overflow: 'hidden' },
  archiveBg:    {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 88, backgroundColor: '#f87171',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  archiveBtn:   { alignItems: 'center', gap: 2 },
  archiveTxt:   { fontSize: 10, color: '#fff', fontWeight: '600' },
  item:         {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#0a0a0a',
  },
  avatar:       {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#1a2e1a', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarUnread: { backgroundColor: '#003d22' },
  avatarText:   { fontSize: 16, fontWeight: '700', color: '#4ade80' },
  textArea:     { flex: 1, gap: 3 },
  topLine:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:        { fontSize: 14, color: '#999', flex: 1 },
  titleBold:    { color: '#fff', fontWeight: '600' },
  time:         { fontSize: 11, color: '#444', marginLeft: 8, flexShrink: 0 },
  bottomLine:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview:      { fontSize: 12, color: '#444', flex: 1 },
  previewItalic:{ fontStyle: 'italic', color: '#383838' },
  badge:        {
    backgroundColor: '#00B67A', borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
    marginLeft: 8, flexShrink: 0,
  },
  badgeTxt:     { fontSize: 10, fontWeight: '700', color: '#fff' },
})

// ── Main screen ───────────────────────────────────────────────────────────────

export default function InboxScherm() {
  const navigation = useNavigation<any>()
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [empId,      setEmpId]      = useState<string | null>(null)
  const [threads,    setThreads]    = useState<ChatThread[]>([])
  const [archived,   setArchived]   = useState<ChatThread[]>([])
  const [tab,        setTab]        = useState<'inbox' | 'gearchiveerd'>('inbox')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setRefreshing(false); return }

    let eid = empId
    if (!eid) {
      if (user.phone) {
        const { data: emp } = await supabase
          .from('employees').select('id')
          .ilike('phone', `%${user.phone.replace(/\D/g, '').slice(-9)}%`)
          .limit(1).single()
        eid = emp?.id ?? null
      }
      if (!eid && user.email) {
        const { data: emp2 } = await supabase
          .from('employees').select('id').eq('email', user.email).limit(1).single()
        eid = emp2?.id ?? null
      }
      if (eid) setEmpId(eid)
    }

    if (eid) {
      try {
        const [inbox, arch] = await Promise.all([
          fetchThreads(eid, false),
          fetchThreads(eid, true),
        ])
        setThreads(inbox)
        setArchived(arch)
      } catch { /* ignore */ }
    }
    setLoading(false)
    setRefreshing(false)
  }, [empId])

  useEffect(() => { load() }, [load])

  async function handleArchive(thread: ChatThread) {
    if (!empId) return
    try { await archiveerThread(empId, thread.id) } catch { /* ignore */ }
    setThreads(prev => prev.filter(t => t.id !== thread.id))
    setArchived(prev => [{ ...thread, gearchiveerd: true }, ...prev])
  }

  async function handleUnarchive(thread: ChatThread) {
    if (!empId) return
    try { await archiveerThread(empId, thread.id) } catch { /* ignore */ }
    setArchived(prev => prev.filter(t => t.id !== thread.id))
    setThreads(prev => [{ ...thread, gearchiveerd: false }, ...prev])
  }

  const current = tab === 'inbox' ? threads : archived
  const unreadCount = threads.filter(t => t.ongelezen_count > 0).length

  if (loading) return <View style={s.center}><ActivityIndicator color="#fff" /></View>

  return (
    <View style={s.container}>
      <Text style={s.pageTitle}>Berichten</Text>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === 'inbox' && s.tabActive]}
          onPress={() => setTab('inbox')}
        >
          <Text style={[s.tabText, tab === 'inbox' && s.tabTextActive]}>
            Inbox{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'gearchiveerd' && s.tabActive]}
          onPress={() => setTab('gearchiveerd')}
        >
          <Text style={[s.tabText, tab === 'gearchiveerd' && s.tabTextActive]}>Gearchiveerd</Text>
        </TouchableOpacity>
      </View>

      {current.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="chatbubble-outline" size={40} color="#222" />
          <Text style={s.emptyText}>
            {tab === 'inbox' ? 'Geen berichten' : 'Geen gearchiveerde gesprekken'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={current}
          keyExtractor={t => t.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#fff" />}
          renderItem={({ item }) => (
            <ThreadRow
              thread={item}
              onPress={() => navigation.navigate('Chat', { threadId: item.id, title: item.title ?? 'Studer', empId })}
              onArchive={() => tab === 'inbox' ? handleArchive(item) : handleUnarchive(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 64 },
  center:       { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  pageTitle:    { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 16, paddingHorizontal: 20 },
  tabs:         { flexDirection: 'row', backgroundColor: '#111', marginHorizontal: 20, borderRadius: 12, padding: 4, marginBottom: 8 },
  tab:          { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabActive:    { backgroundColor: '#1e1e1e' },
  tabText:      { fontSize: 12, color: '#444' },
  tabTextActive:{ color: '#fff', fontWeight: '600' },
  separator:    { height: 1, backgroundColor: '#0f0f0f' },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText:    { fontSize: 13, color: '#333' },
})
