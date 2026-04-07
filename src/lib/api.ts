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

export interface JobEvent {
  id:             string
  titel:          string
  klant:          string | null
  datum_start:    string
  datum_einde:    string | null
  tijdstip_start: string | null
  tijdstip_einde: string | null
  locatie:        string | null
  dresscode:      string | null
  briefing:       string | null
  kledij:         string | null
  foto_url:       string | null
  workers_nodig:  number | null
  vrije_plaatsen: number | null
  bezet:          number | null
  notities:       string | null
}

export interface ChatThread {
  id:                 string
  title:              string | null
  type:               string
  gearchiveerd:       boolean
  laatste_bericht_at: string
  ongelezen_count:    number
  laatste_bericht: {
    inhoud:       string
    afzender:     'studer' | 'worker'
    afzender_naam: string | null
    type:         string
    created_at:   string
  } | null
}

export interface ChatBericht {
  id:              string
  thread_id:       string
  afzender:        'studer' | 'worker'
  afzender_naam:   string | null
  inhoud:          string
  type:            string
  actie_type:      string | null
  actie_voltooid:  boolean
  gelezen_at:      string | null
  created_at:      string
}

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

export interface WagenToewijzing {
  id:          string
  datum_start: string
  datum_eind:  string
  doel:        string | null
  wagen: {
    id:          string
    nummerplaat: string
    merk:        string | null
    model:       string | null
  } | null
  project: {
    id:             string
    titel:          string
    klant:          string | null
    locatie:        string | null
    tijdstip_start: string | null
    tijdstip_einde: string | null
  } | null
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
  foto:          string
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
  await fetch(`${BASE}/api/workers/${employeeId}/messages/${messageId}/read`, { method: 'PATCH' })
}

export async function confirmShift(employeeId: string, messageId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/workers/${employeeId}/messages/${messageId}/actie`, { method: 'PATCH' })
  if (!res.ok) throw new Error('Bevestiging mislukt')
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function fetchThreads(employeeId: string, gearchiveerd = false): Promise<ChatThread[]> {
  const res = await fetch(`${BASE}/api/workers/${employeeId}/chat?gearchiveerd=${gearchiveerd}`)
  if (!res.ok) throw new Error('Threads ophalen mislukt')
  return res.json()
}

export async function fetchThread(employeeId: string, threadId: string): Promise<{ thread: ChatThread; berichten: ChatBericht[] }> {
  const res = await fetch(`${BASE}/api/workers/${employeeId}/chat/${threadId}`)
  if (!res.ok) throw new Error('Thread ophalen mislukt')
  return res.json()
}

export async function sendBericht(employeeId: string, threadId: string, inhoud: string): Promise<ChatBericht> {
  const res = await fetch(`${BASE}/api/workers/${employeeId}/chat/${threadId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inhoud }),
  })
  if (!res.ok) throw new Error('Versturen mislukt')
  const data = await res.json()
  return data.bericht
}

export async function archiveerThread(employeeId: string, threadId: string): Promise<boolean> {
  const res = await fetch(`${BASE}/api/workers/${employeeId}/chat/${threadId}/archiveer`, { method: 'PATCH' })
  if (!res.ok) throw new Error('Archiveren mislukt')
  const data = await res.json()
  return data.gearchiveerd
}

export async function fetchUnreadChatCount(employeeId: string): Promise<number> {
  try {
    const threads = await fetchThreads(employeeId, false)
    return threads.reduce((sum, t) => sum + (t.ongelezen_count ?? 0), 0)
  } catch {
    return 0
  }
}

// ── Time ──────────────────────────────────────────────────────────────────────

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

// ── Contracten ────────────────────────────────────────────────────────────────

export async function onderteken(token: string, naam: string) {
  const res = await fetch(`${BASE}/api/contracten/onderteken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, naam }),
  })
  if (!res.ok) throw new Error('Ondertekening mislukt')
  return res.json() as Promise<{ ok: boolean }>
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export async function fetchJobs(employeeId: string): Promise<JobEvent[]> {
  const res = await fetch(`${BASE}/api/workers/${employeeId}/jobs`)
  if (!res.ok) throw new Error('Jobs ophalen mislukt')
  return res.json()
}

export async function postInteresse(
  employeeId: string,
  body: { planner_event_id?: string; shift_id?: string; status: 'interesse' | 'niet_interesse' },
): Promise<void> {
  await fetch(`${BASE}/api/workers/${employeeId}/jobs/interesse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Push token ────────────────────────────────────────────────────────────────

export async function savePushToken(employeeId: string, expo_push_token: string): Promise<void> {
  await fetch(`${BASE}/api/workers/${employeeId}/push-token`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expo_push_token }),
  })
}

// ── Wagen toewijzing ──────────────────────────────────────────────────────────

export async function fetchWagenToewijzing(employeeId: string): Promise<WagenToewijzing[]> {
  const res = await fetch(`${BASE}/api/workers/${employeeId}/wagen-toewijzing`)
  if (!res.ok) throw new Error('Wagentoewijzing ophalen mislukt')
  return res.json()
}

// ── Terugtrekking ─────────────────────────────────────────────────────────────

export async function indienTerugtrekking(
  employeeId: string,
  body: {
    planner_event_id?: string
    shift_id?:         string
    reden:             string
    reden_categorie?:  string
    toelichting?:      string
    bewijs_url?:       string
  },
): Promise<{ aanvraag_id: string }> {
  const res = await fetch(`${BASE}/api/workers/${employeeId}/terugtrekking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Aanvraag indienen mislukt')
  return res.json()
}

// ── Role ──────────────────────────────────────────────────────────────────────

export async function fetchRole(employeeId: string): Promise<{ role: string; isChauffeur: boolean }> {
  const res = await fetch(`${BASE}/api/workers/${employeeId}/role`)
  if (!res.ok) return { role: 'worker', isChauffeur: false }
  return res.json()
}
