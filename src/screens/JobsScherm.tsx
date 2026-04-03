import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, PanResponder, Dimensions, Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { fetchJobs, postInteresse, JobEvent } from '../lib/api'

const { width: SCREEN_W } = Dimensions.get('window')
const SWIPE_THRESHOLD = SCREEN_W * 0.35

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-BE', { weekday: 'long', day: '2-digit', month: 'long' })
}

function fmtTime(s: string | null, e: string | null) {
  if (!s) return ''
  return `${s.slice(0, 5)}${e ? ` – ${e.slice(0, 5)}` : ''}`
}

export default function JobsScherm() {
  const [loading,  setLoading]  = useState(true)
  const [jobs,     setJobs]     = useState<JobEvent[]>([])
  const [index,    setIndex]    = useState(0)
  const [empId,    setEmpId]    = useState<string | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [feedback, setFeedback] = useState<'ja' | 'nee' | null>(null)

  const pan = useRef(new Animated.ValueXY()).current

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: emp } = await supabase
        .from('employees').select('id')
        .ilike('phone', `%${user.phone?.replace(/\D/g, '').slice(-9)}%`)
        .limit(1).single()
      if (!emp) { setLoading(false); return }
      setEmpId(emp.id)
      try {
        const list = await fetchJobs(emp.id)
        setJobs(list)
      } catch { /* ignore */ }
      setLoading(false)
    }
    init()
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
      onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) {
          swipeRight()
        } else if (g.dx < -SWIPE_THRESHOLD) {
          swipeLeft()
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start()
        }
      },
    })
  ).current

  async function decide(status: 'interesse' | 'niet_interesse') {
    if (!empId || deciding) return
    const job = jobs[index]
    if (!job) return
    setDeciding(true)
    setFeedback(status === 'interesse' ? 'ja' : 'nee')
    try {
      await postInteresse(empId, { planner_event_id: job.id, status })
    } catch { /* ignore */ }
    setTimeout(() => {
      pan.setValue({ x: 0, y: 0 })
      setFeedback(null)
      setIndex(i => i + 1)
      setDeciding(false)
    }, 400)
  }

  function swipeRight() {
    Animated.timing(pan, { toValue: { x: SCREEN_W * 1.5, y: 0 }, duration: 300, useNativeDriver: false }).start(() => decide('interesse'))
  }
  function swipeLeft() {
    Animated.timing(pan, { toValue: { x: -SCREEN_W * 1.5, y: 0 }, duration: 300, useNativeDriver: false }).start(() => decide('niet_interesse'))
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#fff" /></View>

  const job = jobs[index]

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_W / 2, 0, SCREEN_W / 2],
    outputRange: ['-8deg', '0deg', '8deg'],
  })
  const likeOpacity  = pan.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' })
  const nopeOpacity  = pan.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' })

  return (
    <View style={s.container}>
      <Text style={s.pageTitle}>Nieuwe jobs</Text>
      <Text style={s.sub}>Shifts die bij jou passen</Text>

      {!job ? (
        <View style={s.emptyWrap}>
          <Ionicons name="checkmark-done-outline" size={48} color="#4ade80" />
          <Text style={s.emptyTitle}>Je bent bijgewerkt!</Text>
          <Text style={s.emptyText}>Geen nieuwe jobs op dit moment.{'\n'}Check later opnieuw.</Text>
        </View>
      ) : (
        <View style={s.cardArea}>
          {/* Next card (background) */}
          {jobs[index + 1] && (
            <View style={[s.card, s.cardBehind]}>
              <Text style={s.cardClient}>{jobs[index + 1].klant ?? jobs[index + 1].titel}</Text>
            </View>
          )}

          {/* Active card */}
          <Animated.View
            style={[s.card, { transform: [{ translateX: pan.x }, { rotate }] }]}
            {...panResponder.panHandlers}
          >
            {/* LIKE / NOPE overlays */}
            <Animated.View style={[s.likeOverlay, { opacity: likeOpacity }]}>
              <Text style={s.likeText}>JA!</Text>
            </Animated.View>
            <Animated.View style={[s.nopeOverlay, { opacity: nopeOpacity }]}>
              <Text style={s.nopeText}>NEE</Text>
            </Animated.View>

            <Text style={s.cardClient}>{job.klant ?? job.titel}</Text>
            {job.locatie && <Text style={s.cardLoc}>{job.locatie}</Text>}

            <View style={s.divider} />

            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Datum</Text>
              <Text style={s.infoVal}>{fmtDate(job.datum_start)}</Text>
            </View>
            {(job.tijdstip_start || job.tijdstip_einde) && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Tijdstip</Text>
                <Text style={s.infoVal}>{fmtTime(job.tijdstip_start, job.tijdstip_einde)}</Text>
              </View>
            )}
            {job.functie && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Functie</Text>
                <Text style={s.infoVal}>{job.functie}</Text>
              </View>
            )}
            {job.dresscode && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Kledij</Text>
                <Text style={s.infoVal}>{job.dresscode}</Text>
              </View>
            )}
            {job.briefing && (
              <View style={[s.infoRow, { alignItems: 'flex-start' }]}>
                <Text style={s.infoLabel}>Info</Text>
                <Text style={[s.infoVal, { flex: 1 }]}>{job.briefing}</Text>
              </View>
            )}

            {job.locatie && (
              <TouchableOpacity
                style={s.mapsBtn}
                onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(job.locatie!)}`)}
              >
                <Text style={s.mapsBtnText}>Bekijk op kaart</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Action buttons */}
          <View style={s.buttons}>
            <TouchableOpacity
              style={[s.btn, s.btnNope, feedback === 'nee' && s.btnActive]}
              onPress={swipeLeft}
              disabled={deciding}
            >
              <Ionicons name="close-outline" size={24} color="#f87171" />
              <Text style={[s.btnLabel, { color: '#f87171' }]}>Niet interessant</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.btnLike, feedback === 'ja' && s.btnActive]}
              onPress={swipeRight}
              disabled={deciding}
            >
              <Ionicons name="checkmark-outline" size={24} color="#4ade80" />
              <Text style={[s.btnLabel, { color: '#4ade80' }]}>Ik wil dit!</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.counter}>{jobs.length - index} job{jobs.length - index !== 1 ? 's' : ''} resterend</Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 64, paddingHorizontal: 20 },
  center:      { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  pageTitle:   { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 2 },
  sub:         { fontSize: 12, color: '#444', marginBottom: 20 },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon:   { marginBottom: 8 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: '#fff' },
  emptyText:   { fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 20 },
  cardArea:    { flex: 1, alignItems: 'center' },
  card:        {
    width: SCREEN_W - 40, backgroundColor: '#111', borderRadius: 20,
    borderWidth: 1, borderColor: '#1e1e1e', padding: 24,
    position: 'absolute', top: 0,
  },
  cardBehind:  { top: 8, opacity: 0.5, transform: [{ scale: 0.96 }] },
  likeOverlay: {
    position: 'absolute', top: 20, left: 20,
    borderWidth: 3, borderColor: '#4ade80', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4, transform: [{ rotate: '-15deg' }],
  },
  likeText:    { fontSize: 28, fontWeight: '900', color: '#4ade80' },
  nopeOverlay: {
    position: 'absolute', top: 20, right: 20,
    borderWidth: 3, borderColor: '#f87171', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4, transform: [{ rotate: '15deg' }],
  },
  nopeText:    { fontSize: 28, fontWeight: '900', color: '#f87171' },
  cardClient:  { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  cardLoc:     { fontSize: 12, color: '#555', marginBottom: 16 },
  divider:     { height: 1, backgroundColor: '#1e1e1e', marginBottom: 16 },
  infoRow:     { flexDirection: 'row', gap: 12, marginBottom: 10 },
  infoLabel:   { fontSize: 11, color: '#444', width: 60 },
  infoVal:     { fontSize: 13, color: '#ccc', flexShrink: 1 },
  mapsBtn:     { marginTop: 16, backgroundColor: '#1e1e1e', borderRadius: 10, padding: 10, alignItems: 'center' },
  mapsBtnText: { fontSize: 12, color: '#60a5fa' },
  buttons:     {
    flexDirection: 'row', gap: 16, position: 'absolute',
    bottom: 90, left: 0, right: 0, justifyContent: 'center',
  },
  btn:         {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e',
    borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14,
  },
  btnNope:     { borderColor: '#2e1010' },
  btnLike:     { borderColor: '#0a2a1a' },
  btnActive:   { opacity: 0.6 },
  btnIcon:     { marginBottom: 2 },
  btnLabel:    { fontSize: 13, fontWeight: '600' },
  counter:     { position: 'absolute', bottom: 60, fontSize: 11, color: '#333' },
})
