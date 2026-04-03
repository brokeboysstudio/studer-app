import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert, Switch, Image,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import {
  fetchWagenSchade,
  createCheck,
  submitSchade,
  WagenInfo,
  SchadeHistorie,
} from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

const ZONES = ['voor', 'achter', 'links', 'rechts', 'dak', 'interieur'] as const
type Zone = typeof ZONES[number]

type CheckType = 'vertrek' | 'aankomst'
type Step = 'intro' | 'zones' | 'review_zone' | 'vuilheid' | 'bevestigen' | 'done'

interface ZoneResult {
  uri:          string
  base64:       string
  schade:       boolean
  omschrijving: string
}

const ZONE_LABELS: Record<Zone, string> = {
  voor:      'Voor',
  achter:    'Achter',
  links:     'Links',
  rechts:    'Rechts',
  dak:       'Dak',
  interieur: 'Interieur',
}

// ─── Car SVG ──────────────────────────────────────────────────────────────────

const ZONE_RECTS: Record<Zone, { x: number; y: number; w: number; h: number; rx: number }> = {
  voor:      { x: 15,  y: 10,  w: 130, h: 75,  rx: 22 },
  achter:    { x: 15,  y: 175, w: 130, h: 75,  rx: 22 },
  links:     { x: 10,  y: 85,  w: 50,  h: 90,  rx: 8  },
  rechts:    { x: 100, y: 85,  w: 50,  h: 90,  rx: 8  },
  dak:       { x: 60,  y: 85,  w: 40,  h: 42,  rx: 6  },
  interieur: { x: 60,  y: 127, w: 40,  h: 48,  rx: 6  },
}

function CarSvg({
  zoneResults,
  historicalSchade,
  onZonePress,
}: {
  zoneResults:      Record<Zone, ZoneResult | null>
  historicalSchade: SchadeHistorie[]
  onZonePress:      (zone: Zone) => void
}) {
  function zoneFill(zone: Zone) {
    const result = zoneResults[zone]
    if (result) {
      if (result.schade) return '#f87171'
      return '#4ade80'
    }
    const hasHist = historicalSchade.some(s => s.zone === zone)
    if (hasHist) return '#fb923c'
    return '#2a2a2a'
  }

  function zoneOpacity(zone: Zone) {
    return zoneResults[zone] ? 1 : 0.85
  }

  return (
    <Svg width={160} height={260} viewBox="0 0 160 260">
      {/* Car body outline */}
      <Rect x="10" y="10" width="140" height="240" rx="30" fill="#161616" stroke="#333" strokeWidth="1" />

      {/* Zone cells */}
      {ZONES.map(zone => {
        const r = ZONE_RECTS[zone]
        const fill = zoneFill(zone)
        return (
          <G key={zone} onPress={() => onZonePress(zone)}>
            <Rect
              x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx}
              fill={fill}
              opacity={zoneOpacity(zone)}
              stroke={zoneResults[zone] ? fill : '#444'}
              strokeWidth="1"
            />
            <SvgText
              x={r.x + r.w / 2}
              y={r.y + r.h / 2 + 4}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill={zoneResults[zone] ? '#0a0a0a' : '#888'}
            >
              {ZONE_LABELS[zone]}
            </SvgText>
          </G>
        )
      })}
    </Svg>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AutocheckScherm() {
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)

  // Data
  const [wagens,           setWagens]           = useState<WagenInfo[]>([])
  const [selectedWagen,    setSelectedWagen]    = useState<WagenInfo | null>(null)
  const [historicalSchade, setHistoricalSchade] = useState<SchadeHistorie[]>([])
  const [employeeId,       setEmployeeId]       = useState<string | null>(null)

  // Flow state
  const [step,          setStep]          = useState<Step>('intro')
  const [checkType,     setCheckType]     = useState<CheckType>('vertrek')
  const [zoneResults,   setZoneResults]   = useState<Record<Zone, ZoneResult | null>>({
    voor: null, achter: null, links: null, rechts: null, dak: null, interieur: null,
  })
  const [activeZone,    setActiveZone]    = useState<Zone | null>(null)
  const [cameraOpen,    setCameraOpen]    = useState(false)
  const [cameraTarget,  setCameraTarget]  = useState<'zone' | 'vuil'>('zone')
  const [capturedUri,   setCapturedUri]   = useState<string | null>(null)
  const [capturedB64,   setCapturedB64]   = useState<string | null>(null)
  const [reviewSchade,  setReviewSchade]  = useState(false)
  const [reviewDesc,    setReviewDesc]    = useState('')

  // Vuilheid
  const [vuil,         setVuil]         = useState(false)
  const [vuilFotoUri,  setVuilFotoUri]  = useState<string | null>(null)
  const [vuilFotoB64,  setVuilFotoB64]  = useState<string | null>(null)
  const [opmerkingen,  setOpmerkingen]  = useState('')

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [loadingWagens, setLoadingWagens] = useState(true)

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.phone) {
        const { data: emp } = await supabase
          .from('employees')
          .select('id')
          .ilike('phone', `%${user.phone.replace(/\D/g, '').slice(-9)}%`)
          .limit(1)
          .single()
        if (emp) setEmployeeId(emp.id)
      }

      const { data } = await supabase
        .from('wagens')
        .select('id, nummerplaat, merk, model, kantoor')
        .order('nummerplaat')
      setWagens((data ?? []) as WagenInfo[])
      setLoadingWagens(false)
    }
    init()
  }, [])

  async function selectWagen(wagen: WagenInfo) {
    setSelectedWagen(wagen)
    try {
      const schade = await fetchWagenSchade(wagen.id)
      setHistoricalSchade(schade)
    } catch {
      setHistoricalSchade([])
    }
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  async function openCamera(zone: Zone) {
    if (!permission?.granted) {
      const { granted } = await requestPermission()
      if (!granted) {
        Alert.alert('Geen toegang', 'Camera toegang is vereist voor de autocheck.')
        return
      }
    }
    setActiveZone(zone)
    setCameraTarget('zone')
    setCapturedUri(null)
    setCapturedB64(null)
    setReviewSchade(false)
    setReviewDesc('')
    setCameraOpen(true)
  }

  async function openVuilCamera() {
    if (!permission?.granted) {
      const { granted } = await requestPermission()
      if (!granted) return
    }
    setCameraTarget('vuil')
    setCapturedUri(null)
    setCapturedB64(null)
    setCameraOpen(true)
  }

  async function takePicture() {
    if (!cameraRef.current) return
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 })
      if (!photo) return
      setCapturedUri(photo.uri)
      setCapturedB64(photo.base64 ?? '')
      setCameraOpen(false)
      // For vuil, store immediately
      if (cameraTarget === 'vuil') {
        setVuilFotoUri(photo.uri)
        setVuilFotoB64(photo.base64 ?? '')
      }
      // For zone, go to review step
    } catch (e) {
      Alert.alert('Fout', 'Foto maken mislukt.')
    }
  }

  function confirmZonePhoto() {
    if (!activeZone || !capturedUri || !capturedB64) return
    setZoneResults(prev => ({
      ...prev,
      [activeZone]: {
        uri:          capturedUri,
        base64:       capturedB64,
        schade:       reviewSchade,
        omschrijving: reviewDesc,
      },
    }))
    setActiveZone(null)
    setCapturedUri(null)
    setCapturedB64(null)
    setStep('zones')
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!selectedWagen) return
    setSubmitting(true)
    try {
      // 1. Create check
      const { check_id } = await createCheck(selectedWagen.id, {
        employee_id: employeeId ?? undefined,
        type:        checkType,
        vuil,
        opmerkingen: opmerkingen || undefined,
      })

      // 2. Upload schade per zone
      const schadeZones = ZONES.filter(z => zoneResults[z]?.schade)
      for (const zone of schadeZones) {
        const r = zoneResults[zone]!
        await submitSchade(selectedWagen.id, check_id, {
          zone,
          omschrijving: r.omschrijving || undefined,
          foto:         r.base64,
        })
      }

      setStep('done')
    } catch (e) {
      Alert.alert('Fout', 'Check indienen mislukt. Controleer je verbinding.')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setStep('intro')
    setSelectedWagen(null)
    setHistoricalSchade([])
    setCheckType('vertrek')
    setZoneResults({ voor: null, achter: null, links: null, rechts: null, dak: null, interieur: null })
    setVuil(false)
    setVuilFotoUri(null)
    setVuilFotoB64(null)
    setOpmerkingen('')
    setCapturedUri(null)
    setCapturedB64(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CAMERA OVERLAY
  // ─────────────────────────────────────────────────────────────────────────

  if (cameraOpen) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View style={s.cameraUi}>
          <TouchableOpacity onPress={() => setCameraOpen(false)} style={s.camClose}>
            <Text style={s.camCloseText}>✕ Annuleer</Text>
          </TouchableOpacity>
          {activeZone && (
            <Text style={s.camZoneLabel}>{ZONE_LABELS[activeZone as Zone]}</Text>
          )}
          <TouchableOpacity onPress={takePicture} style={s.shutterBtn}>
            <View style={s.shutterInner} />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHOTO REVIEW (after taking zone photo)
  // ─────────────────────────────────────────────────────────────────────────

  if (capturedUri && cameraTarget === 'zone' && activeZone) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.pad}>
        <TouchableOpacity onPress={() => { setCapturedUri(null); setStep('zones') }} style={s.backBtn}>
          <Text style={s.backText}>← Terug</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>Zone: {ZONE_LABELS[activeZone]}</Text>

        <Image source={{ uri: capturedUri }} style={s.reviewPhoto} resizeMode="cover" />

        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.label}>Schade aanwezig?</Text>
            <Switch
              value={reviewSchade}
              onValueChange={setReviewSchade}
              trackColor={{ false: '#333', true: '#f87171' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {reviewSchade && (
          <View style={s.card}>
            <Text style={s.label}>Omschrijving</Text>
            <TextInput
              style={s.input}
              value={reviewDesc}
              onChangeText={setReviewDesc}
              placeholder="Beschrijf de schade…"
              placeholderTextColor="#444"
              multiline
            />
          </View>
        )}

        <TouchableOpacity style={s.primaryBtn} onPress={confirmZonePhoto}>
          <Text style={s.primaryBtnText}>Bevestig</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: DONE
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>✓</Text>
        <Text style={s.pageTitle}>Check ingediend</Text>
        <Text style={s.sub}>Het voertuig is succesvol gecheckt.</Text>
        <TouchableOpacity style={[s.primaryBtn, { marginTop: 32, width: 200 }]} onPress={resetForm}>
          <Text style={s.primaryBtnText}>Nieuwe check</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: INTRO
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'intro') {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.pad}>
        <Text style={s.pageTitle}>Autocheck</Text>
        <Text style={s.sub}>Selecteer een wagen en start de voertuigcontrole.</Text>

        {/* Check type */}
        <Text style={s.sectionLabel}>Type check</Text>
        <View style={s.segmentRow}>
          {(['vertrek', 'aankomst'] as CheckType[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.segment, checkType === t && s.segmentActive]}
              onPress={() => setCheckType(t)}
            >
              <Text style={[s.segmentText, checkType === t && s.segmentTextActive]}>
                {t === 'vertrek' ? 'Vertrek' : 'Aankomst'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Wagen selectie */}
        <Text style={s.sectionLabel}>Wagen</Text>
        {loadingWagens ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
        ) : wagens.length === 0 ? (
          <Text style={s.empty}>Geen wagens beschikbaar</Text>
        ) : (
          wagens.map(w => (
            <TouchableOpacity
              key={w.id}
              style={[s.card, selectedWagen?.id === w.id && s.cardSelected]}
              onPress={() => selectWagen(w)}
            >
              <Text style={s.cardTitle}>{w.nummerplaat}</Text>
              <Text style={s.cardSub}>
                {[w.merk, w.model].filter(Boolean).join(' ') || '—'}
                {w.kantoor ? ` · ${w.kantoor}` : ''}
              </Text>
            </TouchableOpacity>
          ))
        )}

        {selectedWagen && (
          <>
            {/* Historical schade */}
            {historicalSchade.length > 0 && (
              <View style={s.histBox}>
                <Text style={s.histTitle}>Bekende schade ({historicalSchade.length} zones)</Text>
                {historicalSchade.map(s2 => (
                  <Text key={s2.id} style={s.histItem}>
                    • {ZONE_LABELS[s2.zone as Zone] ?? s2.zone}
                    {s2.omschrijving ? ` — ${s2.omschrijving}` : ''}
                    {s2.nieuw ? ' 🔴' : ' 🟡'}
                  </Text>
                ))}
              </View>
            )}

            <TouchableOpacity style={s.primaryBtn} onPress={() => setStep('zones')}>
              <Text style={s.primaryBtnText}>Start check →</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: ZONES
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'zones') {
    const checkedCount = ZONES.filter(z => zoneResults[z] !== null).length
    const allDone      = checkedCount === ZONES.length

    return (
      <ScrollView style={s.container} contentContainerStyle={s.pad}>
        <TouchableOpacity onPress={() => setStep('intro')} style={s.backBtn}>
          <Text style={s.backText}>← Wagen</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>Zones controleren</Text>
        <Text style={s.sub}>{selectedWagen?.nummerplaat} · {checkType}</Text>

        {/* SVG Car */}
        <View style={s.svgWrap}>
          <CarSvg
            zoneResults={zoneResults}
            historicalSchade={historicalSchade}
            onZonePress={zone => openCamera(zone)}
          />
        </View>

        {/* Legend */}
        <View style={s.legend}>
          <View style={s.legendItem}><View style={[s.dot, { backgroundColor: '#2a2a2a' }]} /><Text style={s.legendText}>Niet gecheckt</Text></View>
          <View style={s.legendItem}><View style={[s.dot, { backgroundColor: '#4ade80' }]} /><Text style={s.legendText}>OK</Text></View>
          <View style={s.legendItem}><View style={[s.dot, { backgroundColor: '#f87171' }]} /><Text style={s.legendText}>Schade</Text></View>
          <View style={s.legendItem}><View style={[s.dot, { backgroundColor: '#fb923c' }]} /><Text style={s.legendText}>Historisch</Text></View>
        </View>

        {/* Zone list for quick status */}
        <View style={s.zoneList}>
          {ZONES.map(zone => {
            const r = zoneResults[zone]
            return (
              <TouchableOpacity
                key={zone}
                style={s.zoneRow}
                onPress={() => openCamera(zone)}
              >
                <View style={[s.zoneDot, {
                  backgroundColor: r ? (r.schade ? '#f87171' : '#4ade80') : '#2a2a2a',
                }]} />
                <Text style={s.zoneRowLabel}>{ZONE_LABELS[zone]}</Text>
                <Text style={s.zoneRowStatus}>
                  {r ? (r.schade ? 'Schade' : 'OK') : 'Tap om te checken'}
                </Text>
                <Text style={s.zoneChevron}>{'›'}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={s.progress}>{checkedCount}/{ZONES.length} zones gecheckt</Text>

        <TouchableOpacity
          style={[s.primaryBtn, !allDone && s.primaryBtnMuted]}
          onPress={() => { if (allDone) setStep('vuilheid') }}
        >
          <Text style={s.primaryBtnText}>
            {allDone ? 'Volgende: Vuilheid →' : `Nog ${ZONES.length - checkedCount} zones te gaan`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: VUILHEID
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'vuilheid') {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.pad}>
        <TouchableOpacity onPress={() => setStep('zones')} style={s.backBtn}>
          <Text style={s.backText}>← Zones</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>Vuilheid</Text>
        <Text style={s.sub}>Is het voertuig vuil achtergelaten?</Text>

        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.label}>Voertuig vuil</Text>
            <Switch
              value={vuil}
              onValueChange={setVuil}
              trackColor={{ false: '#333', true: '#fb923c' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {vuil && (
          <>
            <TouchableOpacity style={s.photoBtn} onPress={openVuilCamera}>
              {vuilFotoUri ? (
                <Image source={{ uri: vuilFotoUri }} style={s.reviewPhoto} resizeMode="cover" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={20} color="#888" style={{ marginBottom: 4 }} />
                  <Text style={s.photoBtnText}>Foto toevoegen</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={s.card}>
          <Text style={s.label}>Opmerkingen</Text>
          <TextInput
            style={s.input}
            value={opmerkingen}
            onChangeText={setOpmerkingen}
            placeholder="Extra opmerkingen…"
            placeholderTextColor="#444"
            multiline
          />
        </View>

        <TouchableOpacity style={s.primaryBtn} onPress={() => setStep('bevestigen')}>
          <Text style={s.primaryBtnText}>Volgende: Overzicht →</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: BEVESTIGEN
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'bevestigen') {
    const schadeZones  = ZONES.filter(z => zoneResults[z]?.schade)
    const okZones      = ZONES.filter(z => zoneResults[z] && !zoneResults[z]!.schade)

    return (
      <ScrollView style={s.container} contentContainerStyle={s.pad}>
        <TouchableOpacity onPress={() => setStep('vuilheid')} style={s.backBtn}>
          <Text style={s.backText}>← Vuilheid</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>Overzicht</Text>

        <View style={s.summarySection}>
          <Text style={s.summaryLabel}>Wagen</Text>
          <Text style={s.summaryValue}>{selectedWagen?.nummerplaat} · {checkType}</Text>
        </View>

        <View style={s.summarySection}>
          <Text style={s.summaryLabel}>Vuilheid</Text>
          <Text style={[s.summaryValue, vuil && { color: '#fb923c' }]}>{vuil ? 'Vuil achtergelaten' : 'Proper'}</Text>
        </View>

        {schadeZones.length > 0 && (
          <View style={s.summarySection}>
            <Text style={s.summaryLabel}>Schade ({schadeZones.length} zones)</Text>
            {schadeZones.map(zone => (
              <View key={zone} style={s.summaryZoneRow}>
                <Text style={s.summaryZoneName}>🔴 {ZONE_LABELS[zone]}</Text>
                {zoneResults[zone]?.omschrijving ? (
                  <Text style={s.summaryZoneDesc}>{zoneResults[zone]!.omschrijving}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {okZones.length > 0 && (
          <View style={s.summarySection}>
            <Text style={s.summaryLabel}>OK ({okZones.length} zones)</Text>
            <Text style={s.summaryValue}>{okZones.map(z => ZONE_LABELS[z]).join(', ')}</Text>
          </View>
        )}

        {opmerkingen ? (
          <View style={s.summarySection}>
            <Text style={s.summaryLabel}>Opmerkingen</Text>
            <Text style={s.summaryValue}>{opmerkingen}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[s.primaryBtn, submitting && s.primaryBtnMuted]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#0a0a0a" />
            : <Text style={s.primaryBtnText}>Verstuur check ✓</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    )
  }

  return null
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0a0a0a' },
  center:             { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  pad:                { padding: 20, paddingTop: 60, paddingBottom: 40 },

  pageTitle:          { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  sub:                { fontSize: 12, color: '#555', marginBottom: 20 },
  sectionLabel:       { fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  empty:              { color: '#333', fontSize: 13, textAlign: 'center', marginTop: 20 },
  label:              { fontSize: 13, color: '#aaa', flex: 1 },
  progress:           { fontSize: 11, color: '#555', textAlign: 'center', marginVertical: 12 },

  backBtn:            { marginBottom: 16 },
  backText:           { color: '#60a5fa', fontSize: 14 },

  card:               { backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardSelected:       { borderColor: '#60a5fa' },
  cardTitle:          { fontSize: 14, fontWeight: '600', color: '#fff' },
  cardSub:            { fontSize: 11, color: '#555', marginTop: 2 },

  segmentRow:         { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segment:            { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e', alignItems: 'center' },
  segmentActive:      { backgroundColor: '#1a2a40', borderColor: '#60a5fa' },
  segmentText:        { fontSize: 13, color: '#666', fontWeight: '500' },
  segmentTextActive:  { color: '#60a5fa' },

  histBox:            { backgroundColor: '#111', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#2a1a00' },
  histTitle:          { fontSize: 11, color: '#fb923c', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  histItem:           { fontSize: 12, color: '#888', marginBottom: 4 },

  primaryBtn:         { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  primaryBtnMuted:    { backgroundColor: '#222' },
  primaryBtnText:     { fontSize: 14, fontWeight: '700', color: '#0a0a0a' },

  svgWrap:            { alignItems: 'center', marginVertical: 20 },

  legend:             { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 16 },
  legendItem:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:                { width: 10, height: 10, borderRadius: 5 },
  legendText:         { fontSize: 10, color: '#555' },

  zoneList:           { backgroundColor: '#111', borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  zoneRow:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', gap: 10 },
  zoneDot:            { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  zoneRowLabel:       { fontSize: 13, color: '#fff', fontWeight: '500', flex: 1 },
  zoneRowStatus:      { fontSize: 11, color: '#555' },
  zoneChevron:        { fontSize: 16, color: '#444' },

  rowBetween:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  input:              { color: '#ccc', fontSize: 13, marginTop: 8, minHeight: 60, paddingTop: 4 },

  photoBtn:           { backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 10 },
  photoBtnText:       { fontSize: 14, color: '#888' },
  reviewPhoto:        { width: '100%', height: 200, borderRadius: 12, marginBottom: 12 },

  summarySection:     { backgroundColor: '#111', borderRadius: 12, padding: 14, marginBottom: 10 },
  summaryLabel:       { fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  summaryValue:       { fontSize: 13, color: '#ccc' },
  summaryZoneRow:     { marginBottom: 4 },
  summaryZoneName:    { fontSize: 13, color: '#f87171', fontWeight: '500' },
  summaryZoneDesc:    { fontSize: 11, color: '#555', marginLeft: 16 },

  // Camera UI
  cameraUi:           { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 40 },
  camClose:           { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  camCloseText:       { color: '#fff', fontSize: 14 },
  camZoneLabel:       { alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, color: '#fff', fontSize: 16, fontWeight: '700' },
  shutterBtn:         { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  shutterInner:       { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
})
