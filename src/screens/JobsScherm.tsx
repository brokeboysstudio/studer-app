import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, PanResponder, Dimensions, Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { fetchJobs, postInteresse, JobEvent } from '../lib/api'

const { width: W, height: H } = Dimensions.get('window')
const SWIPE_THRESHOLD = W * 0.35
const CARD_H = H * 0.62
const PHOTO_H = Math.round(CARD_H * 0.55)

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-BE', { weekday: 'short', day: '2-digit', month: 'short' })
}

function fmtTime(s: string | null, e: string | null) {
  if (!s) return ''
  return `${s.slice(0, 5)}${e ? ` – ${e.slice(0, 5)}` : ''}`
}

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function JobsScherm() {
  const [loading,  setLoading]  = useState(true)
  const [jobs,     setJobs]     = useState<JobEvent[]>([])
  const [index,    setIndex]    = useState(0)
  const [empId,    setEmpId]    = useState<string | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [feedback, setFeedback] = useState<'ja' | 'nee' | null>(null)
  const [expanded, setExpanded] = useState(false)

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

  // Reset expanded when card changes
  useEffect(() => { setExpanded(false) }, [index])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
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
    try { await postInteresse(empId, { planner_event_id: job.id, status }) } catch { /* ignore */ }
    setTimeout(() => {
      pan.setValue({ x: 0, y: 0 })
      setFeedback(null)
      setIndex(i => i + 1)
      setDeciding(false)
    }, 350)
  }

  function swipeRight() {
    Animated.timing(pan, { toValue: { x: W * 1.5, y: 0 }, duration: 280, useNativeDriver: false })
      .start(() => decide('interesse'))
  }
  function swipeLeft() {
    Animated.timing(pan, { toValue: { x: -W * 1.5, y: 0 }, duration: 280, useNativeDriver: false })
      .start(() => decide('niet_interesse'))
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#fff" /></View>

  const job = jobs[index]
  const remaining = jobs.length - index

  const rotate = pan.x.interpolate({
    inputRange: [-W / 2, 0, W / 2],
    outputRange: ['-6deg', '0deg', '6deg'],
  })
  const likeOpacity = pan.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' })
  const nopeOpacity = pan.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' })

  // Progress dots
  const totalDots = Math.min(jobs.length, 6)
  const activeDot = Math.min(index, totalDots - 1)

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.pageTitle}>Nieuwe jobs</Text>
        <Text style={s.sub}>Shifts die bij jou passen</Text>
      </View>

      {/* Progress dots */}
      {jobs.length > 0 && (
        <View style={s.dots}>
          {Array.from({ length: totalDots }).map((_, i) => (
            <View key={i} style={[s.dot, i === activeDot && s.dotActive]} />
          ))}
          {jobs.length > 6 && (
            <Text style={s.dotsMore}>+{jobs.length - 6} meer</Text>
          )}
        </View>
      )}

      {!job ? (
        <View style={s.emptyWrap}>
          <Ionicons name="checkmark-done-outline" size={48} color="#4ade80" />
          <Text style={s.emptyTitle}>Je bent bijgewerkt!</Text>
          <Text style={s.emptyText}>Geen nieuwe jobs op dit moment.{'\n'}Check later opnieuw.</Text>
        </View>
      ) : (
        <>
          <View style={s.cardArea}>
            {/* Background card */}
            {jobs[index + 1] && (
              <View style={[s.card, s.cardBehind]}>
                <Text style={s.cardClientBg}>{jobs[index + 1].klant ?? jobs[index + 1].titel}</Text>
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

              {/* ─ Photo / header section ─ */}
              <View style={s.photoSection}>
                {job.foto_url ? (
                  <Image source={{ uri: job.foto_url }} style={s.photo} resizeMode="cover" />
                ) : (
                  <View style={[s.photoFallback]}>
                    <Text style={s.photoInitials}>{getInitials(job.klant)}</Text>
                  </View>
                )}
                {/* Dark gradient overlay at bottom of photo */}
                <View style={s.photoGradient} />
                {/* Vrije plaatsen badge over photo */}
                {job.vrije_plaatsen !== null && job.vrije_plaatsen !== undefined && (
                  <View style={[s.plaatstBadge, job.vrije_plaatsen < 3 ? s.badgeOrange : s.badgeGreen]}>
                    <Text style={s.plaatsBadgeText}>
                      {job.vrije_plaatsen} {job.vrije_plaatsen === 1 ? 'plaats vrij' : 'plaatsen vrij'}
                    </Text>
                  </View>
                )}
              </View>

              {/* ─ Content section ─ */}
              <View style={s.content}>
                <Text style={s.cardClient} numberOfLines={1}>{job.klant ?? '—'}</Text>
                <Text style={s.cardTitel} numberOfLines={1}>{job.titel}</Text>

                <View style={s.infoRow}>
                  <Ionicons name="calendar-outline" size={13} color="#666" />
                  <Text style={s.infoText}>{fmtDate(job.datum_start)}</Text>
                  {(job.tijdstip_start || job.tijdstip_einde) && (
                    <>
                      <View style={s.dot2} />
                      <Ionicons name="time-outline" size={13} color="#666" />
                      <Text style={s.infoText}>{fmtTime(job.tijdstip_start, job.tijdstip_einde)}</Text>
                    </>
                  )}
                </View>

                {job.locatie && (
                  <View style={s.infoRow}>
                    <Ionicons name="location-outline" size={13} color="#555" />
                    <Text style={[s.infoText, { color: '#555' }]} numberOfLines={1}>{job.locatie}</Text>
                  </View>
                )}

                {job.dresscode && (
                  <View style={s.dresscodePill}>
                    <Text style={s.dresscodeText}>{job.dresscode}</Text>
                  </View>
                )}

                {/* Collapsible kledij/briefing */}
                {(job.kledij || job.briefing || job.notities) && (
                  <TouchableOpacity
                    style={s.meerInfoBtn}
                    onPress={() => setExpanded(e => !e)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={s.meerInfoText}>Meer info</Text>
                    <Ionicons name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={13} color="#555" />
                  </TouchableOpacity>
                )}
                {expanded && (
                  <View style={s.expandedBox}>
                    {job.kledij && (
                      <View style={s.expandedRow}>
                        <Text style={s.expandedLabel}>Kledij</Text>
                        <Text style={s.expandedVal}>{job.kledij}</Text>
                      </View>
                    )}
                    {job.briefing && (
                      <View style={s.expandedRow}>
                        <Text style={s.expandedLabel}>Info</Text>
                        <Text style={s.expandedVal}>{job.briefing}</Text>
                      </View>
                    )}
                    {job.notities && (
                      <View style={s.expandedRow}>
                        <Text style={s.expandedLabel}>Notities</Text>
                        <Text style={s.expandedVal}>{job.notities}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Animated.View>
          </View>

          {/* Action buttons */}
          <View style={s.buttons}>
            <TouchableOpacity
              style={[s.btn, s.btnNope, feedback === 'nee' && s.btnActive]}
              onPress={swipeLeft}
              disabled={deciding}
            >
              <Ionicons name="close-outline" size={22} color="#f87171" />
              <Text style={[s.btnLabel, { color: '#f87171' }]}>Niet interessant</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.btnLike, feedback === 'ja' && s.btnActive]}
              onPress={swipeRight}
              disabled={deciding}
            >
              <Ionicons name="checkmark-outline" size={22} color="#4ade80" />
              <Text style={[s.btnLabel, { color: '#4ade80' }]}>Ik wil dit!</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.counter}>{remaining} job{remaining !== 1 ? 's' : ''} resterend</Text>
        </>
      )}
    </View>
  )
}

const STUDER_GREEN = '#00B67A'

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 56 },
  center:         { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  header:         { paddingHorizontal: 20, marginBottom: 10 },
  pageTitle:      { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 2 },
  sub:            { fontSize: 12, color: '#444' },
  dots:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 12 },
  dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: '#222' },
  dotActive:      { backgroundColor: '#fff', width: 16, borderRadius: 4 },
  dotsMore:       { fontSize: 10, color: '#444', marginLeft: 4 },
  emptyWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: '#fff' },
  emptyText:      { fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 20 },

  cardArea:       { flex: 1, alignItems: 'center', paddingHorizontal: 16 },
  card:           {
    width: W - 32, height: CARD_H,
    backgroundColor: '#111', borderRadius: 20,
    borderWidth: 1, borderColor: '#1e1e1e',
    position: 'absolute', top: 0,
    overflow: 'hidden',
  },
  cardBehind:     { top: 8, opacity: 0.5, transform: [{ scale: 0.97 }] },

  likeOverlay:    {
    position: 'absolute', top: 20, left: 20, zIndex: 10,
    borderWidth: 3, borderColor: '#4ade80', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4, transform: [{ rotate: '-15deg' }],
  },
  likeText:       { fontSize: 26, fontWeight: '900', color: '#4ade80' },
  nopeOverlay:    {
    position: 'absolute', top: 20, right: 20, zIndex: 10,
    borderWidth: 3, borderColor: '#f87171', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4, transform: [{ rotate: '15deg' }],
  },
  nopeText:       { fontSize: 26, fontWeight: '900', color: '#f87171' },

  photoSection:   { width: '100%', height: PHOTO_H, position: 'relative' },
  photo:          { width: '100%', height: '100%' },
  photoFallback:  {
    width: '100%', height: '100%',
    backgroundColor: STUDER_GREEN,
    alignItems: 'center', justifyContent: 'center',
  },
  photoInitials:  { fontSize: 64, fontWeight: '900', color: 'rgba(255,255,255,0.4)' },
  photoGradient:  {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%',
    backgroundColor: 'transparent',
    // Simulate gradient with a semi-transparent overlay
    background: 'linear-gradient(transparent, #111)' as any,
    // On React Native, use opacity trick:
  },
  plaatstBadge:   {
    position: 'absolute', bottom: 12, right: 12,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeGreen:     { backgroundColor: 'rgba(0,182,122,0.9)' },
  badgeOrange:    { backgroundColor: 'rgba(251,146,60,0.9)' },
  plaatsBadgeText:{ fontSize: 11, fontWeight: '700', color: '#fff' },

  content:        { flex: 1, padding: 16, gap: 6 },
  cardClient:     { fontSize: 19, fontWeight: '800', color: '#fff' },
  cardClientBg:   { fontSize: 16, fontWeight: '700', color: '#333', padding: 16, marginTop: PHOTO_H + 8 },
  cardTitel:      { fontSize: 13, color: '#555', marginBottom: 4 },
  infoRow:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText:       { fontSize: 12, color: '#777' },
  dot2:           { width: 3, height: 3, borderRadius: 2, backgroundColor: '#333', marginHorizontal: 2 },
  dresscodePill:  {
    alignSelf: 'flex-start', backgroundColor: 'rgba(0,182,122,0.15)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(0,182,122,0.3)',
    marginTop: 2,
  },
  dresscodeText:  { fontSize: 11, color: STUDER_GREEN, fontWeight: '600' },
  meerInfoBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  meerInfoText:   { fontSize: 11, color: '#555' },
  expandedBox:    { backgroundColor: '#0d0d0d', borderRadius: 10, padding: 10, gap: 6, marginTop: 4 },
  expandedRow:    { flexDirection: 'row', gap: 8 },
  expandedLabel:  { fontSize: 10, color: '#444', width: 52 },
  expandedVal:    { fontSize: 11, color: '#888', flex: 1, lineHeight: 16 },

  buttons:        { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 },
  btn:            {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e',
    borderRadius: 14, height: 56,
  },
  btnNope:        { borderColor: '#2e1010' },
  btnLike:        { borderColor: '#0a2a1a' },
  btnActive:      { opacity: 0.5 },
  btnLabel:       { fontSize: 13, fontWeight: '600' },
  counter:        { textAlign: 'center', fontSize: 11, color: '#333', paddingBottom: 8 },
})
