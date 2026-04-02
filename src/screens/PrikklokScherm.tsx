import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'
import { inkloppen, uitkloppen } from '../lib/api'

type State = 'idle' | 'bezig' | 'loading'

export default function PrikklokScherm() {
  const [state,        setState]        = useState<State>('loading')
  const [employeeId,   setEmployeeId]   = useState<string | null>(null)
  const [registratieId,setRegistratieId]= useState<string | null>(null)
  const [ingekloktOp,  setIngekloktOp]  = useState<Date | null>(null)
  const [elapsed,      setElapsed]      = useState(0) // seconds
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setState('idle'); return }

      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .ilike('phone', `%${user.phone?.replace(/\D/g,'').slice(-9)}%`)
        .limit(1).single()

      setEmployeeId(emp?.id ?? null)

      // Check for open tijdsregistratie
      if (emp?.id) {
        const { data: open } = await supabase
          .from('tijdsregistraties')
          .select('id, ingeklokt_op')
          .eq('employee_id', emp.id)
          .eq('status', 'bezig')
          .order('aangemaakt_op', { ascending: false })
          .limit(1).single()

        if (open) {
          setRegistratieId(open.id)
          const start = new Date(open.ingeklokt_op)
          setIngekloktOp(start)
          setState('bezig')
        } else {
          setState('idle')
        }
      } else {
        setState('idle')
      }
    }
    init()
  }, [])

  // Elapsed timer
  useEffect(() => {
    if (state === 'bezig' && ingekloktOp) {
      setElapsed(Math.floor((Date.now() - ingekloktOp.getTime()) / 1000))
      timer.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - ingekloktOp.getTime()) / 1000))
      }, 1000)
    } else {
      if (timer.current) clearInterval(timer.current)
    }
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [state, ingekloktOp])

  async function getGps(): Promise<{ lat: number; lon: number } | undefined> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return undefined
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      return { lat: loc.coords.latitude, lon: loc.coords.longitude }
    } catch { return undefined }
  }

  async function handleInkloppen() {
    if (!employeeId) return Alert.alert('Fout', 'Worker niet gevonden')
    setState('loading')
    const gps = await getGps()
    try {
      const result = await inkloppen(employeeId, null, gps?.lat, gps?.lon)
      setRegistratieId(result.id)
      setIngekloktOp(new Date(result.ingeklokt_op))
      setState('bezig')
    } catch (e: any) {
      Alert.alert('Fout', e.message)
      setState('idle')
    }
  }

  async function handleUitkloppen() {
    if (!registratieId) return
    setState('loading')
    const gps = await getGps()
    try {
      const result = await uitkloppen(registratieId, gps?.lat, gps?.lon)
      Alert.alert('Uitgeklokt', `Geregistreerd: ${result.uren_geregistreerd?.toFixed(2) ?? '?'} uur`)
      setRegistratieId(null)
      setIngekloktOp(null)
      setState('idle')
    } catch (e: any) {
      Alert.alert('Fout', e.message)
      setState('bezig')
    }
  }

  function fmtElapsed(sec: number): string {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  return (
    <View style={sty.container}>
      <Text style={sty.pageTitle}>Prikklok</Text>

      {state === 'loading' && <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />}

      {state === 'idle' && (
        <View style={sty.center}>
          <TouchableOpacity style={sty.btnGreen} onPress={handleInkloppen}>
            <Text style={sty.btnIcon}>▶</Text>
            <Text style={sty.btnLabel}>Inkloppen</Text>
          </TouchableOpacity>
          <Text style={sty.hint}>GPS wordt automatisch opgeslagen</Text>
        </View>
      )}

      {state === 'bezig' && (
        <View style={sty.center}>
          <View style={sty.timerBox}>
            <Text style={sty.timerLabel}>Bezig</Text>
            <Text style={sty.timer}>{fmtElapsed(elapsed)}</Text>
            {ingekloktOp && (
              <Text style={sty.ingeklokt}>Ingeklokt om {ingekloktOp.toLocaleTimeString('nl-BE', { hour:'2-digit', minute:'2-digit' })}</Text>
            )}
          </View>
          <TouchableOpacity style={sty.btnRed} onPress={handleUitkloppen}>
            <Text style={sty.btnIcon}>■</Text>
            <Text style={sty.btnLabel}>Uitkloppen</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const sty = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 24, paddingTop: 60 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 40 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -60 },
  timerBox:  { alignItems: 'center', marginBottom: 48 },
  timerLabel:{ fontSize: 11, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 },
  timer:     { fontSize: 52, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'], letterSpacing: 2 },
  ingeklokt: { fontSize: 12, color: '#555', marginTop: 8 },
  btnGreen:  { width: 160, height: 160, borderRadius: 80, backgroundColor: '#1a2e10', borderWidth: 2, borderColor: '#4ade80', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnRed:    { width: 160, height: 160, borderRadius: 80, backgroundColor: '#2e1010', borderWidth: 2, borderColor: '#f87171', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnIcon:   { fontSize: 28, color: '#fff' },
  btnLabel:  { fontSize: 14, fontWeight: '700', color: '#fff' },
  hint:      { fontSize: 11, color: '#333', marginTop: 24 },
})
