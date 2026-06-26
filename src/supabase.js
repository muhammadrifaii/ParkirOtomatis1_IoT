// src/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mypdzjaisfwqhiqvldql.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGR6amFpc2Z3cWhpcXZsZHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODM0NDUsImV4cCI6MjA4MDg1OTQ0NX0.uJiZHi5OKns4eVnGYqrtSvJ3-ABRtZ8c_uDECUVS9hw'

export const supabase = createClient(supabaseUrl, supabaseKey)

// ============= FUNGSI UNTUK LOG TABLE =============

// Fungsi untuk format waktu (tanpa konversi timezone)
function formatWaktu(isoString) {
  // Parse tanpa konversi timezone
  const date = new Date(isoString)
  
  // Ambil komponen waktu langsung (assume sudah WIB dari Supabase)
  const year = date.getUTCFullYear()
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Oct', 'Nov', 'Des'][date.getUTCMonth()]
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  
  return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds}`
}

// Ambil semua logs (terbaru duluan)
export async function getLogs() {
  try {
    const { data, error } = await supabase
      .from('log')
      .select('*')
      .order('waktu', { ascending: false })
    
    if (error) throw error
    
    // Format waktu setiap log
    return data.map(log => ({
      ...log,
      waktu: formatWaktu(log.waktu)
    }))
  } catch (error) {
    console.error('❌ Error fetching logs:', error)
    return []
  }
}

// Subscribe ke perubahan realtime di tabel log
export function subscribeToLogs(callback) {
  const channel = supabase
    .channel('log-changes')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'log'
      },
      (payload) => {
        console.log('🔔 Realtime event:', payload)
        
        // Format waktu untuk data baru
        if (payload.new && payload.new.waktu) {
          payload.new.waktu = formatWaktu(payload.new.waktu)
        }
        
        callback(payload)
      }
    )
    .subscribe()
  
  return channel
}

// ============= FUNGSI UNTUK SLOT TABLE =============

// Ambil data slot
export async function getSlot() {
  try {
    const { data, error } = await supabase
      .from('slot')
      .select('*')
      .eq('id', 1)
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('❌ Error fetching slot:', error)
    return null
  }
}

// Subscribe ke perubahan slot
export function subscribeToSlot(callback) {
  const channel = supabase
    .channel('slot-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'slot',
        filter: 'id=eq.1'
      },
      (payload) => {
        console.log('🔔 Slot updated:', payload)
        callback(payload)
      }
    )
    .subscribe()
  
  return channel
}

// Update slot (opsional, jika mau update dari web)
export async function updateSlot(jumlah) {
  try {
    const { data, error } = await supabase
      .from('slot')
      .update({ jumlah })
      .eq('id', 1)
      .select()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('❌ Error updating slot:', error)
    return null
  }
}