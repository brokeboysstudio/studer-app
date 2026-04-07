import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions,
} from 'react-native'
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { fetchThread, sendBericht, ChatBericht } from '../lib/api'

type ChatParams = { threadId: string; title: string; empId: string }

const { width: W } = Dimensions.get('window')
const MAX_BUBBLE_W = W * 0.74

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
}

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ bericht, prevAfzender }: { bericht: ChatBericht; prevAfzender?: string }) {
  const isWorker = bericht.afzender === 'worker'
  const isSysteem = bericht.type === 'systeem'

  if (isSysteem) {
    return (
      <View style={b.systeemWrap}>
        <Text style={b.systeemTxt}>{bericht.inhoud}</Text>
      </View>
    )
  }

  if (isWorker) {
    return (
      <View style={b.workerWrap}>
        <View style={b.workerBubble}>
          <Text style={b.workerTxt}>{bericht.inhoud}</Text>
          <View style={b.workerMeta}>
            <Text style={b.workerTime}>{fmtTime(bericht.created_at)}</Text>
            <Ionicons
              name={bericht.gelezen_at ? 'checkmark-done' : 'checkmark'}
              size={12}
              color="rgba(255,255,255,0.6)"
              style={{ marginLeft: 3 }}
            />
          </View>
        </View>
      </View>
    )
  }

  // Studer message (left side)
  const showAvatar = prevAfzender !== 'studer'
  return (
    <View style={b.studerWrap}>
      {showAvatar ? (
        <View style={b.avatar}>
          <Text style={b.avatarTxt}>{initials(bericht.afzender_naam)}</Text>
        </View>
      ) : (
        <View style={b.avatarPlaceholder} />
      )}
      <View style={{ maxWidth: MAX_BUBBLE_W }}>
        {showAvatar && bericht.afzender_naam && (
          <Text style={b.senderName}>{bericht.afzender_naam}</Text>
        )}
        <View style={b.studerBubble}>
          <Text style={b.studerTxt}>{bericht.inhoud}</Text>
        </View>
        <Text style={b.studerTime}>{fmtTime(bericht.created_at)}</Text>
      </View>
    </View>
  )
}

const b = StyleSheet.create({
  systeemWrap:      { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 24 },
  systeemTxt:       { fontSize: 11, color: '#444', fontStyle: 'italic', textAlign: 'center' },

  workerWrap:       { alignItems: 'flex-end', paddingHorizontal: 16, marginBottom: 4 },
  workerBubble:     {
    backgroundColor: '#00B67A', borderRadius: 18, borderBottomRightRadius: 4,
    paddingHorizontal: 14, paddingVertical: 9, maxWidth: MAX_BUBBLE_W,
  },
  workerTxt:        { fontSize: 14, color: '#fff', lineHeight: 20 },
  workerMeta:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  workerTime:       { fontSize: 10, color: 'rgba(255,255,255,0.65)' },

  studerWrap:       { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, marginBottom: 4, gap: 8 },
  avatar:           {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#1a2e1a', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarPlaceholder:{ width: 30, flexShrink: 0 },
  avatarTxt:        { fontSize: 11, fontWeight: '700', color: '#4ade80' },
  senderName:       { fontSize: 10, color: '#555', marginBottom: 3, marginLeft: 2 },
  studerBubble:     {
    backgroundColor: '#1c1c1e', borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  studerTxt:        { fontSize: 14, color: '#e5e5e5', lineHeight: 20 },
  studerTime:       { fontSize: 10, color: '#444', marginTop: 3, marginLeft: 2 },
})

// ── Actie bericht ─────────────────────────────────────────────────────────────

function ActieBericht({ bericht }: { bericht: ChatBericht }) {
  return (
    <View style={a.wrap}>
      <View style={a.studerWrap}>
        <View style={a.avatar}>
          <Text style={a.avatarTxt}>{initials(bericht.afzender_naam)}</Text>
        </View>
        <View>
          {bericht.afzender_naam && (
            <Text style={a.senderName}>{bericht.afzender_naam}</Text>
          )}
          <View style={a.bubble}>
            <Text style={a.txt}>{bericht.inhoud}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={[a.btn, bericht.actie_voltooid && a.btnDone]}
        disabled={bericht.actie_voltooid}
      >
        <Text style={a.btnTxt}>
          {bericht.actie_voltooid ? 'Bevestigd' : 'Bevestigen'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const a = StyleSheet.create({
  wrap:        { paddingHorizontal: 12, marginBottom: 4 },
  studerWrap:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  avatar:      { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1a2e1a', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { fontSize: 11, fontWeight: '700', color: '#4ade80' },
  senderName:  { fontSize: 10, color: '#555', marginBottom: 3 },
  bubble:      { backgroundColor: '#1c1c1e', borderRadius: 14, padding: 12, maxWidth: MAX_BUBBLE_W },
  txt:         { fontSize: 14, color: '#e5e5e5', lineHeight: 20 },
  btn:         { marginTop: 8, marginLeft: 38, backgroundColor: '#1e1e1e', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  btnDone:     { borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.08)' },
  btnTxt:      { fontSize: 13, color: '#ccc', fontWeight: '600' },
})

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ChatScherm() {
  const route     = useRoute<RouteProp<{ Chat: ChatParams }, 'Chat'>>()
  const navigation = useNavigation<any>()
  const { threadId, title, empId } = route.params

  const [loading,   setLoading]   = useState(true)
  const [berichten, setBerichten] = useState<ChatBericht[]>([])
  const [input,     setInput]     = useState('')
  const [sending,   setSending]   = useState(false)
  const listRef = useRef<FlatList>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchThread(empId, threadId)
      setBerichten(data.berichten)
    } catch { /* ignore */ }
    setLoading(false)
  }, [empId, threadId])

  useEffect(() => { load() }, [load])

  // Scroll to bottom on load and new messages
  useEffect(() => {
    if (berichten.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80)
    }
  }, [berichten.length])

  async function handleSend() {
    const txt = input.trim()
    if (!txt || sending) return
    setInput('')
    setSending(true)
    const optimistic: ChatBericht = {
      id: `tmp_${Date.now()}`,
      thread_id: threadId,
      afzender: 'worker',
      afzender_naam: null,
      inhoud: txt,
      type: 'tekst',
      actie_type: null,
      actie_voltooid: false,
      gelezen_at: null,
      created_at: new Date().toISOString(),
    }
    setBerichten(prev => [...prev, optimistic])
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
    try {
      const bericht = await sendBericht(empId, threadId, txt)
      setBerichten(prev => prev.map(b => b.id === optimistic.id ? bericht : b))
    } catch {
      setBerichten(prev => prev.filter(b => b.id !== optimistic.id))
      setInput(txt)
    }
    setSending(false)
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#fff" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={berichten}
          keyExtractor={b => b.id}
          contentContainerStyle={s.listContent}
          renderItem={({ item, index }) => {
            const prev = index > 0 ? berichten[index - 1] : null
            if (item.type === 'actie') {
              return <ActieBericht bericht={item} />
            }
            return (
              <MessageBubble
                bericht={item}
                prevAfzender={prev?.afzender}
              />
            )
          }}
          ListEmptyComponent={
            <View style={s.emptyChat}>
              <Text style={s.emptyChatTxt}>Stuur een bericht om het gesprek te starten</Text>
            </View>
          }
        />
      )}

      {/* Input bar */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Bericht..."
          placeholderTextColor="#444"
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[s.sendBtn, input.trim().length > 0 && s.sendBtnActive]}
          onPress={handleSend}
          disabled={sending || !input.trim()}
        >
          <Ionicons
            name="send-outline"
            size={20}
            color={input.trim().length > 0 ? '#00B67A' : '#333'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0a0a' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
  },
  backBtn:      { width: 40, alignItems: 'flex-start' },
  headerTitle:  { flex: 1, fontSize: 16, fontWeight: '600', color: '#fff', textAlign: 'center' },
  listContent:  { paddingVertical: 16, gap: 2 },
  emptyChat:    { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyChatTxt: { fontSize: 13, color: '#333', fontStyle: 'italic' },
  inputBar:     {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
  },
  input:        {
    flex: 1, backgroundColor: '#111', borderRadius: 20,
    borderWidth: 1, borderColor: '#1e1e1e',
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#fff', maxHeight: 100,
    lineHeight: 20,
  },
  sendBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendBtnActive:{},
})
