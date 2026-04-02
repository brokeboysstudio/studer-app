const BASE = 'https://studer-os.vercel.app'

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
