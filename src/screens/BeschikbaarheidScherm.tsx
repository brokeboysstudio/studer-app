import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native'
import { supabase } from '../lib/supabase'

type Status = 'beschikbaar' | 'onbeschikbaar' | 'misschien'
type AvailMap = Record<string, Status>

const STATUS_STYLE: Record<Status, { bg: string; text: string; label: string }> = {
  beschikbaar:  { bg: '#1a2e10', text: '#4ade80', label: 'Beschikbaar' },
  onbeschikbaar:{ bg: '#2e1010', text: '#f87171', label: 'Onbeschikbaar' },
  misschien:    { bg: '#1f1200', text: '#fb923c', label: 'Misschien' },
}

const NL_MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const NL_DAYS   = ['Ma','Di','Wo','Do','Vr','Za','Zo']

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

export default function BeschikbaarheidScherm() {
  const now      = new Date()
  const [year,   setYear]   = useState(now.getFullYear())
  const [month,  setMonth]  = useState(now.getMonth())
  const [avail,  setAvail]  = useState<AvailMap>({})
  const [loading,setLoading]= useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [empId,  setEmpId]  = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: emp } = await supabase
        .from('employees').select('id')
        .ilike('phone', `%${user.phone?.replace(/\D/g,'').slice(-9)}%`)
        .limit(1).single()
      if (!emp) { setLoading(false); return }
      setEmpId(emp.id)
      await loadMonth(emp.id, year, month)
      setLoading(false)
    }
    load()
  }, [])

  async function loadMonth(eid: string, y: number, m: number) {
    const start = toISO(y, m, 1)
    const end   = toISO(y, m, new Date(y, m+1, 0).getDate())
    const { data } = await supabase
      .from('worker_availability')
      .select('datum, status')
      .eq('employee_id', eid)
      .gte('datum', start).lte('datum', end)
    const map: AvailMap = {}
    for (const r of (data ?? [])) map[r.datum] = r.status as Status
    setAvail(map)
  }

  async function handleDayPress(iso: string) {
    if (!empId) return
    const cycle: Status[] = ['beschikbaar', 'onbeschikbaar', 'misschien']
    const current = avail[iso]
    if (current) {
      const next = cycle[(cycle.indexOf(current) + 1) % cycle.length]
      setSaving(iso)
      await supabase.from('worker_availability')
        .update({ status: next })
        .eq('employee_id', empId).eq('datum', iso)
      setAvail(a => ({ ...a, [iso]: next }))
    } else {
      setSaving(iso)
      await supabase.from('worker_availability')
        .upsert({ employee_id: empId, datum: iso, status: 'beschikbaar' }, { onConflict: 'employee_id,datum' })
      setAvail(a => ({ ...a, [iso]: 'beschikbaar' }))
    }
    setSaving(null)
  }

  function navigate(delta: number) {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m); setYear(y)
    if (empId) loadMonth(empId, y, m)
  }

  // Build calendar grid
  const firstDay  = new Date(year, month, 1)
  const daysInMon = new Date(year, month+1, 0).getDate()
  const startDow  = (firstDay.getDay() + 6) % 7 // Mon=0
  const cells: (number | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= daysInMon; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  if (loading) return <View style={s.center}><ActivityIndicator color="#fff" /></View>

  return (
    <ScrollView style={s.container} contentContainerStyle={s.pad}>
      <Text style={s.pageTitle}>Beschikbaarheid</Text>

      {/* Month nav */}
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigate(-1)} style={s.navBtn}><Text style={s.navArrow}>‹</Text></TouchableOpacity>
        <Text style={s.monthLabel}>{NL_MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={() => navigate(1)} style={s.navBtn}><Text style={s.navArrow}>›</Text></TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={s.grid}>
        {NL_DAYS.map(d => <Text key={d} style={s.dayHeader}>{d}</Text>)}

        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={s.cell} />
          const iso    = toISO(year, month, day)
          const status = avail[iso]
          const sty    = status ? STATUS_STYLE[status] : null
          const isToday = iso === new Date().toISOString().split('T')[0]
          return (
            <TouchableOpacity key={iso} style={[s.cell, isToday && s.today, sty && { backgroundColor: sty.bg }]}
              onPress={() => handleDayPress(iso)}>
              {saving === iso
                ? <ActivityIndicator size="small" color="#888" />
                : <Text style={[s.dayNum, sty && { color: sty.text }, isToday && !sty && { color: '#fff', fontWeight: '700' }]}>{day}</Text>
              }
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {(Object.entries(STATUS_STYLE) as [Status, typeof STATUS_STYLE[Status]][]).map(([k,v]) => (
          <View key={k} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: v.bg, borderColor: v.text }]} />
            <Text style={[s.legendText, { color: v.text }]}>{v.label}</Text>
          </View>
        ))}
      </View>
      <Text style={s.hint}>Tik op een dag om beschikbaarheid te wijzigen</Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0a0a0a' },
  center:     { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  pad:        { padding: 20, paddingTop: 60 },
  pageTitle:  { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 20 },
  nav:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn:     { padding: 8 },
  navArrow:   { fontSize: 24, color: '#888' },
  monthLabel: { fontSize: 15, fontWeight: '600', color: '#fff' },
  grid:       { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader:  { width: '14.28%', textAlign: 'center', fontSize: 10, color: '#444', paddingBottom: 8, textTransform: 'uppercase' },
  cell:       { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 4 },
  today:      { borderWidth: 1, borderColor: '#333' },
  dayNum:     { fontSize: 13, color: '#555' },
  legend:     { flexDirection: 'row', gap: 16, marginTop: 20, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  legendText: { fontSize: 11 },
  hint:       { fontSize: 10, color: '#333', marginTop: 12 },
})
