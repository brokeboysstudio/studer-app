import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const supabaseUrl = 'https://vxpboswexsghrgramrrs.supabase.co'
const supabaseAnonKey = 'sb_publishable_UP8uDEM1slYvkG08Kw-d3w_-9qx4zzY'

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// ─── Supabase SQL migraties ──────────────────────────────────────────────────
// Voer uit in Supabase SQL Editor (project vxpboswexsghrgramrrs):
//
// -- Vorige migraties (indien nog niet uitgevoerd):
// ALTER TABLE applications DROP COLUMN IF EXISTS voorkeur_contact;
// ALTER TABLE applications DROP COLUMN IF EXISTS beschikbaarheden;
// ALTER TABLE applications DROP COLUMN IF EXISTS gewenste_start;
// ALTER TABLE applications DROP COLUMN IF EXISTS interesses;
// DO $$ BEGIN
//   IF EXISTS (SELECT 1 FROM information_schema.columns
//              WHERE table_name='applications' AND column_name='kantoor') THEN
//     ALTER TABLE applications RENAME COLUMN kantoor TO stad;
//   END IF;
// END $$;
// ALTER TABLE applications
//   DROP CONSTRAINT IF EXISTS applications_stad_check,
//   DROP CONSTRAINT IF EXISTS applications_kantoor_check;
// ALTER TABLE applications ADD CONSTRAINT applications_stad_check
//   CHECK (stad IS NULL OR stad IN (
//     'Antwerpen','Gent','Brussel','Leuven','Hasselt',
//     'Brugge','Kortrijk','Roeselare','Aalst','Sint-Niklaas',
//     'Mechelen','Turnhout','Genk','Tongeren'));
// ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_segment_check;
// ALTER TABLE applications ADD CONSTRAINT applications_segment_check
//   CHECK (segment IS NULL OR segment IN ('student', 'flexi', 'other'));
// ALTER TABLE applications ADD COLUMN IF NOT EXISTS via_wie text;
// ALTER TABLE applications ADD COLUMN IF NOT EXISTS push_token text;
//
// -- Nieuw: track kolom
// ALTER TABLE applications ADD COLUMN IF NOT EXISTS track text;
// ALTER TABLE applications ADD CONSTRAINT applications_track_check
//   CHECK (track IS NULL OR track IN ('direct', 'select'));
// ────────────────────────────────────────────────────────────────────────────

export interface ApplicationData {
  voornaam: string
  achternaam: string
  email?: string
  telefoon: string
  geboortedatum?: string
  segment?: 'student' | 'flexi' | 'other'
  stad?: string
  hoe_bij_studer?: string
  via_wie?: string
  track?: 'direct' | 'select'
  push_token?: string | null
}

export async function submitApplication(data: ApplicationData): Promise<{ id: string }> {
  const res = await fetch('https://studer-os.vercel.app/api/jobs/registreer', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voornaam:       data.voornaam,
      achternaam:     data.achternaam,
      email:          data.email ?? '',
      telefoon:       data.telefoon,
      geboortedatum:  data.geboortedatum ?? '',
      stad:           data.stad ?? '',
      track:          data.track ?? 'direct',
      is_student:     data.segment === 'student',
      segment:        data.segment ?? 'other',
      school:         '',
      studierichting: '',
      studiejaar:     null,
      functies:       [],
      rijbewijs:      false,
      eigen_wagen:    false,
      hoe_bij_studer: data.hoe_bij_studer ?? '',
      via_wie:        data.via_wie ?? null,
      push_token:     data.push_token ?? null,
    }),
  })
  const json = await res.json()
  if (!res.ok) {
    console.error('[submitApplication] API error:', JSON.stringify(json))
    throw new Error(json.error ?? 'Registratie mislukt')
  }
  return { id: json.employee_id }
}
