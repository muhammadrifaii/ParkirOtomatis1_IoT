<template>
  <div class="card">
    <div class="header">
      <div>
        <h2>📋 Log Aktivitas Pintu</h2>
        <small class="hint">
          <span v-if="!loading" class="live-dot"></span>
          {{ filteredLogs.length }} aktivitas tercatat
        </small>
      </div>
      <div class="controls">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Cari ID atau status..." 
          />
        </div>
        <select v-model="filterStatus" class="filter-select">
          <option value="all">Semua Status</option>
          <option value="Masuk">Masuk</option>
          <option value="Keluar">Keluar</option>
        </select>
        <button class="refresh-btn" @click="fetchLogs" :disabled="loading">
          <span :class="{ spinning: loading }">🔄</span>
        </button>
        <button class="export-btn" @click="exportData">
          📊 Export
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="summary-row">
      <div class="summary-card in">
        <div class="summary-icon">⬇️</div>
        <div class="summary-content">
          <span class="summary-label">Kendaraan Masuk</span>
          <strong class="summary-value">{{ countMasuk }}</strong>
        </div>
      </div>
      <div class="summary-card out">
        <div class="summary-icon">⬆️</div>
        <div class="summary-content">
          <span class="summary-label">Kendaraan Keluar</span>
          <strong class="summary-value">{{ countKeluar }}</strong>
        </div>
      </div>
      <div class="summary-card total">
        <div class="summary-icon">📈</div>
        <div class="summary-content">
          <span class="summary-label">Total Aktivitas</span>
          <strong class="summary-value">{{ logs.length }}</strong>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && logs.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>Memuat data dari IoT...</p>
    </div>

    <!-- Table -->
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th @click="sortBy('id')" class="sortable">
              ID 
              <span class="sort-icon">{{ getSortIcon('id') }}</span>
            </th>
            <th @click="sortBy('waktu')" class="sortable">
              Waktu
              <span class="sort-icon">{{ getSortIcon('waktu') }}</span>
            </th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="item in paginatedLogs" 
            :key="item.id"
            class="table-row"
            :class="{ 'new-entry': isNewEntry(item.id) }"
          >
            <td>
              <span class="id-badge">#{{ item.id }}</span>
            </td>
            <td>
              <div class="time-cell">
                <span class="date-time">{{ item.waktu }}</span>
              </div>
            </td>
            <td>
              <span class="status-badge" :class="item.status.toLowerCase()">
                <span class="badge-icon">{{ item.status === 'Masuk' ? '⬇️' : '⬆️' }}</span>
                {{ item.status }}
              </span>
            </td>
            <td>
              <button class="action-btn" @click="viewDetail(item)">
                👁️ Detail
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <div v-if="filteredLogs.length === 0" class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>Tidak ada data yang ditemukan</p>
        <small>{{ logs.length === 0 ? 'Menunggu data dari perangkat IoT...' : 'Coba ubah filter atau kata kunci pencarian' }}</small>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="totalPages > 1 && !loading">
      <button 
        class="page-btn" 
        @click="currentPage--" 
        :disabled="currentPage === 1"
      >
        ← Prev
      </button>
      
      <div class="page-numbers">
        <button
          v-for="page in displayedPages"
          :key="page"
          class="page-number"
          :class="{ active: page === currentPage }"
          @click="currentPage = page"
        >
          {{ page }}
        </button>
      </div>

      <button 
        class="page-btn" 
        @click="currentPage++" 
        :disabled="currentPage === totalPages"
      >
        Next →
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'

// Data
const logs = ref([])
const loading = ref(true)
const searchQuery = ref('')
const filterStatus = ref('all')
const sortKey = ref('id')
const sortOrder = ref('desc')
const currentPage = ref(1)
const itemsPerPage = 10
const newEntries = ref(new Set())
let realtimeChannel = null

// Fungsi format waktu (konsisten untuk fetch dan realtime)
const formatWaktu = (isoString) => {
  const date = new Date(isoString)
  const year = date.getUTCFullYear()
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][date.getUTCMonth()]
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds}`
}

// Computed
const countMasuk = computed(() => 
  logs.value.filter(log => log.status === 'Masuk').length
)

const countKeluar = computed(() => 
  logs.value.filter(log => log.status === 'Keluar').length
)

const filteredLogs = computed(() => {
  let result = logs.value

  // Filter by search
  if (searchQuery.value) {
    result = result.filter(log => 
      log.id.toString().includes(searchQuery.value) ||
      log.status.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      log.waktu.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }

  // Filter by status
  if (filterStatus.value !== 'all') {
    result = result.filter(log => log.status === filterStatus.value)
  }

  // Sort
  result.sort((a, b) => {
    let aVal = a[sortKey.value]
    let bVal = b[sortKey.value]
    
    if (sortOrder.value === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

  return result
})

const totalPages = computed(() => 
  Math.ceil(filteredLogs.value.length / itemsPerPage)
)

const paginatedLogs = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredLogs.value.slice(start, end)
})

const displayedPages = computed(() => {
  const pages = []
  const maxDisplay = 5
  let start = Math.max(1, currentPage.value - Math.floor(maxDisplay / 2))
  let end = Math.min(totalPages.value, start + maxDisplay - 1)
  
  if (end - start < maxDisplay - 1) {
    start = Math.max(1, end - maxDisplay + 1)
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

// Methods
const fetchLogs = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('log')
      .select('*')
      .order('waktu', { ascending: false })
    
    if (error) throw error
    
    // Format waktu setiap log
    logs.value = data.map(log => ({
      ...log,
      waktu: formatWaktu(log.waktu)
    }))
    
    console.log('📊 Total log dimuat:', logs.value.length)
  } catch (error) {
    console.error('❌ Error fetching logs:', error)
    alert('Gagal memuat data log dari Supabase')
  } finally {
    loading.value = false
  }
}

const sortBy = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
}

const getSortIcon = (key) => {
  if (sortKey.value !== key) return '⇅'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

const isNewEntry = (id) => {
  return newEntries.value.has(id)
}

const viewDetail = (item) => {
  alert(`Detail Log #${item.id}\nWaktu: ${item.waktu}\nStatus: ${item.status}`)
}

const exportData = () => {
  if (filteredLogs.value.length === 0) {
    alert('Tidak ada data untuk diexport')
    return
  }

  const csv = [
    ['ID', 'Waktu', 'Status'],
    ...filteredLogs.value.map(log => [log.id, log.waktu, log.status])
  ].map(row => row.join(',')).join('\n')
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const timestamp = new Date().toISOString().slice(0,19).replace(/:/g,'-')
  a.download = `log-aktivitas-${timestamp}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}

const setupRealtime = () => {
  realtimeChannel = supabase
    .channel('log-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'log'
      },
      (payload) => {
        console.log('🔔 Data baru dari IoT:', payload.new)
        
        // Format waktu untuk data baru
        const newLog = {
          ...payload.new,
          waktu: formatWaktu(payload.new.waktu)
        }
        
        console.log('✅ Log terformat:', newLog)
        
        // Tambahkan ke array logs
        logs.value.unshift(newLog)
        
        // Mark sebagai entry baru
        newEntries.value.add(newLog.id)
        
        // Hapus highlight setelah 3 detik
        setTimeout(() => {
          newEntries.value.delete(newLog.id)
        }, 3000)
        
        // Notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Aktivitas Baru!', {
            body: `${newLog.status} - ${newLog.waktu}`,
            icon: '🚗'
          })
        }
      }
    )
    .subscribe()
}

// Lifecycle
onMounted(async () => {
  await fetchLogs()
  setupRealtime()
  
  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
})

onUnmounted(() => {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe()
    console.log('🔌 Realtime log disconnected')
  }
})
</script>

<style scoped>
.card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  padding: 24px;
  border-radius: 14px;
  backdrop-filter: blur(10px);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 20px;
  flex-wrap: wrap;
}

.header h2 {
  margin: 0 0 6px 0;
  font-size: 1.3rem;
  color: #ffffff;
}

.hint {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9fb4d9;
  font-size: 0.85rem;
}

.live-dot {
  width: 8px;
  height: 8px;
  background: #43e97b;
  border-radius: 50%;
  display: inline-block;
  animation: pulse-dot 2s ease-in-out infinite;
  box-shadow: 0 0 8px #43e97b;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.1); }
}

.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  font-size: 14px;
}

.search-box input {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #e6eef8;
  padding: 9px 12px 9px 36px;
  border-radius: 10px;
  width: 220px;
  transition: all 0.3s ease;
}

.search-box input:focus {
  outline: none;
  border-color: rgba(31, 111, 235, 0.5);
  background: rgba(255,255,255,0.08);
}

.filter-select {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #e6eef8;
  padding: 9px 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.filter-select:hover {
  background: rgba(255,255,255,0.08);
}

.refresh-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #fff;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.export-btn {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: #0a0e27;
  border: none;
  padding: 9px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.export-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(67, 233, 123, 0.3);
}

/* Summary Row */
.summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.summary-card:hover {
  transform: translateY(-2px);
}

.summary-card.in {
  background: rgba(67, 233, 123, 0.1);
  border: 1px solid rgba(67, 233, 123, 0.2);
}

.summary-card.out {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.summary-card.total {
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.2);
}

.summary-icon {
  font-size: 32px;
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 0.85rem;
  color: #99b4d6;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
}

/* Loading State */
.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: #99b4d6;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255,255,255,0.1);
  border-top-color: #43e97b;
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: spin 1s linear infinite;
}

.loading-state p {
  margin: 0;
  font-size: 1rem;
}

/* Table */
.table-wrap {
  overflow-x: auto;
  margin-bottom: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: rgba(255,255,255,0.03);
}

th {
  padding: 14px 16px;
  text-align: left;
  border-bottom: 2px solid rgba(255,255,255,0.06);
  color: #b8cce4;
  font-weight: 600;
  font-size: 0.9rem;
}

th.sortable {
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

th.sortable:hover {
  background: rgba(255,255,255,0.05);
  color: #ffffff;
}

.sort-icon {
  margin-left: 6px;
  opacity: 0.5;
}

td {
  padding: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.table-row {
  transition: all 0.2s ease;
}

.table-row:hover {
  background: rgba(255,255,255,0.02);
}

.table-row.new-entry {
  background: rgba(67, 233, 123, 0.1);
  animation: highlight 3s ease;
}

@keyframes highlight {
  0% { background: rgba(67, 233, 123, 0.2); }
  100% { background: transparent; }
}

.id-badge {
  background: rgba(102, 126, 234, 0.2);
  color: #8aa4ff;
  padding: 6px 12px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.9rem;
}

.time-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.date-time {
  color: #e6eef8;
  font-weight: 500;
  font-size: 0.9rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.9rem;
}

.status-badge.masuk {
  background: rgba(67, 233, 123, 0.15);
  color: #43e97b;
  border: 1px solid rgba(67, 233, 123, 0.3);
}

.status-badge.keluar {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.badge-icon {
  font-size: 14px;
}

.action-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #e6eef8;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.3s ease;
}

.action-btn:hover {
  background: rgba(255,255,255,0.1);
  transform: scale(1.05);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #99b4d6;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  color: #e6eef8;
}

.empty-state small {
  font-size: 0.9rem;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
}

.page-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #e6eef8;
  padding: 10px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.page-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
  transform: translateY(-2px);
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 6px;
}

.page-number {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #e6eef8;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.page-number:hover {
  background: rgba(255,255,255,0.1);
}

.page-number.active {
  background: linear-gradient(135deg, #1f6feb 0%, #1557c0 100%);
  border-color: transparent;
  color: white;
}

/* Responsive */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .controls {
    width: 100%;
    flex-direction: column;
  }
  
  .search-box input {
    width: 100%;
  }
  
  .summary-row {
    grid-template-columns: 1fr;
  }
  
  table {
    font-size: 0.9rem;
  }
  
  th, td {
    padding: 12px;
  }
}
</style>