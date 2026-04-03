const BASE = 'https://studer-os.vercel.app'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkerMessage {
  id:            string
  type:          'info' | 'shift' | 'document' | 'actie' | string
  titel:         string
  inhoud:        string
  gelezen:       boolean
  actie_vereist: boolean
  actie_gedaan:  boolean
  aangemaakt_op: string
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WagenInfo {
  id:          string
  nummerplaat: string
  merk:        string | null
  model:       string | null
  kantoor:     string | null
}

export interface SchadeHistorie {
  id:           string
  zone:         string
  foto_url:     string
  omschrijving: string | null
  nieuw:        boolean
  created_at:   string
}

// ── Wagens ────────────────────────────────────────────────────────────────────

export async function fetchWagenSchade(wagenId: string): Promise<SchadeHistorie[]> {
  const res = await fetch(`${BASE}/api/wagens/${wagenId}/schade`)
  if (!res.ok) throw new Error('Schadehistorie ophalen mislukt')
  return res.json()
}

export async function createCheck(wagenId: string, body: {
  employee_id?: string
  shift_id?:   string
  type:        'vertrek' | 'aankomst'
  vuil?:       boolean
  opmerkingen?: string
}): Promise<{ check_id: string }> {
  const res = await fetch(`${BASE}/api/wagens/${wagenId}/checks`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Check aanmaken mislukt')
  return res.json()
}

export async function submitSchade(wagenId: string, checkId: string, body: {
  zone:          string
  omschrijving?: string
  foto:          string  // base64
}): Promise<void> {
  const res = await fetch(`${BASE}/api/wagens/${wagenId}/checks/${checkId}/schade`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Schade uploaden mislukt')
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function fetchMessages(employeeId: string): Promise<WorkerMessage[]> {
  const res = await fetch(`${BASE}/api/workers/${employeeId}/messages`)
  if (!res.ok) throw new Error('Berichten ophalen mislukt')
  return res.json()
}

export async function markRead(employeeId: string, messageId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/workers/${employeeId}/messages/${messageId}/read`, {
    method: 'PATCH',
  })
  if (!res.ok) throw new Error('Markeren als gelezen mislukt')
}

export async function confirmShift(employeeId: string, messageId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/workers/${employeeId}/messages/${messageId}/actie`, {
    method: 'PATCH',
  })
  if (!res.ok) throw new Error('Bevestiging mislukt')
}

export async function inkloppen(employee_id: string, event_id: string | null, gps_lat?: number, gps_lon?: number) {
  const res = await fetch(`${BASE}/api/tijdsregistratie/inkloppen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee_id, event_id, gps_lat, gps_lon }),
  })
  if (!res.ok) throw new Error('Inkloppen mislukt')
  return res.json() as Promise<{ id: string; ingeklokt_op: string }>
}

export async function uitkloppen(registratie_id: string, gps_lat?: number, gps_lon?: number) {
  const res = await fetch(`${BASE}/api/tijdsregistratie/uitkloppen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registratie_id, gps_lat, gps_lon }),
  })
  if (!res.ok) throw new Error('Uitkloppen mislukt')
  return res.json() as Promise<{ id: string; uitgeklokt_op: string; uren_geregistreerd: number }>
}

export async function onderteken(token: string, naam: string) {
  const res = await fetch(`${BASE}/api/contracten/onderteken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, naam }),
  })
  if (!res.ok) throw new Error('Ondertekening mislukt')
  return res.json() as Promise<{ ok: boolean }>
}
