<template>
  <div class="container">
    <!-- Header -->
    <header class="hero">
      <div class="hero-content">
        <div class="icon-badge">🚗</div>
        <div>
          <h1>Dashboard Pemantauan Parkir</h1>
          <p class="subtitle">Grafik aktivitas kendaraan masuk & keluar</p>
        </div>
      </div>
      <div class="actions">
        <button class="btn primary" @click="refreshData" :disabled="loading">
          <span class="icon" :class="{ spinning: loading }">🔄</span>
          Refresh
        </button>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="loading && !chartDataReady" class="loading-container">
      <div class="spinner"></div>
      <p>Memuat data analitik...</p>
    </div>

    <!-- Charts Grid -->
    <div v-else class="charts-grid">
      <!-- Grafik Per Jam (Hari Ini) -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>⏰ Aktivitas Per Jam (Hari Ini)</h3>
          <div class="chart-legend">
            <span class="legend-item">
              <span class="dot masuk"></span>
              Masuk
            </span>
            <span class="legend-item">
              <span class="dot keluar"></span>
              Keluar
            </span>
          </div>
        </div>
        <div class="chart-wrapper">
          <canvas ref="hourlyChart"></canvas>
        </div>
        <div class="chart-summary">
          <div class="summary-item">
            <span class="label">Jam Tersibuk:</span>
            <strong>{{ jamTersibuk }}</strong>
          </div>
          <div class="summary-item">
            <span class="label">Total Hari Ini:</span>
            <strong>{{ totalHariIni }}</strong>
          </div>
        </div>
      </div>

      <!-- Grafik Harian (7 hari terakhir) -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>📅 Aktivitas 7 Hari Terakhir</h3>
          <div class="chart-legend">
            <span class="legend-item">
              <span class="dot masuk"></span>
              Masuk
            </span>
            <span class="legend-item">
              <span class="dot keluar"></span>
              Keluar
            </span>
          </div>
        </div>
        <div class="chart-wrapper">
          <canvas ref="dailyChart"></canvas>
        </div>
        <div class="chart-summary">
          <div class="summary-item">
            <span class="label">Total Masuk (7 hari):</span>
            <strong>{{ totalMasuk7Hari }}</strong>
          </div>
          <div class="summary-item">
            <span class="label">Total Keluar (7 hari):</span>
            <strong>{{ totalKeluar7Hari }}</strong>
          </div>
        </div>
      </div>

      <!-- Grafik Perbandingan Masuk vs Keluar - FIXED -->
      <div class="chart-card full-width">
        <div class="chart-header">
          <h3>🔄 Perbandingan Masuk vs Keluar (Hari Ini)</h3>
          <small style="color: #99b4d6;">{{ todayLabel }}</small>
        </div>
        <div class="comparison-stats">
          <div class="stat-box masuk">
            <div class="stat-icon">⬇️</div>
            <div class="stat-content">
              <span class="stat-label">Kendaraan Masuk</span>
              <strong class="stat-value">{{ masukHariIni }}</strong>
            </div>
          </div>
          <div class="stat-box keluar">
            <div class="stat-icon">⬆️</div>
            <div class="stat-content">
              <span class="stat-label">Kendaraan Keluar</span>
              <strong class="stat-value">{{ keluarHariIni }}</strong>
            </div>
          </div>
          <div class="stat-box diff">
            <div class="stat-icon">📊</div>
            <div class="stat-content">
              <span class="stat-label">Selisih</span>
              <strong class="stat-value">{{ selisihHariIni }}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <section class="main-content">
      <SlotStatus />
    </section>

    <!-- Logs Section -->
    <section class="logs-area">
      <LogTable @logs-updated="handleLogsUpdate" />
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import SlotStatus from '../components/SlotStatus.vue'
import LogTable from '../components/LogTable.vue'
import { supabase } from '../supabase'
import Chart from 'chart.js/auto'

// Refs
const loading = ref(true)
const logs = ref([])
const hourlyChart = ref(null)
const dailyChart = ref(null)
const hourlyChartInstance = ref(null)
const dailyChartInstance = ref(null)
const chartDataReady = ref(false)
const updateKey = ref(0) // Force reactivity trigger

// Realtime
let realtimeChannel = null

// Helper: Get today date string (YYYY-MM-DD)
const getTodayDateString = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Format waktu
const formatWaktu = (isoString) => {
  const date = new Date(isoString)
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][date.getUTCMonth()]
  return `${day} ${month}`
}

// Computed - Label hari ini
const todayLabel = computed(() => {
  const now = new Date()
  const day = now.getDate()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const month = months[now.getMonth()]
  const year = now.getFullYear()
  return `${day} ${month} ${year}`
})

// Computed - Data Hari Ini (FIXED with reactivity trigger)
const masukHariIni = computed(() => {
  updateKey.value // Force reactivity
  const today = getTodayDateString()
  const filtered = logs.value.filter(log => {
    const logDate = log.waktu.split('T')[0] // Ambil bagian tanggal saja (YYYY-MM-DD)
    return logDate === today && log.status === 'Masuk'
  })
  console.log('✅ Masuk hari ini:', filtered.length, 'dari total', logs.value.length)
  return filtered.length
})

const keluarHariIni = computed(() => {
  updateKey.value // Force reactivity
  const today = getTodayDateString()
  const filtered = logs.value.filter(log => {
    const logDate = log.waktu.split('T')[0] // Ambil bagian tanggal saja (YYYY-MM-DD)
    return logDate === today && log.status === 'Keluar'
  })
  console.log('✅ Keluar hari ini:', filtered.length, 'dari total', logs.value.length)
  return filtered.length
})

const selisihHariIni = computed(() => masukHariIni.value - keluarHariIni.value)

const totalHariIni = computed(() => masukHariIni.value + keluarHariIni.value)

// Computed - Data 7 Hari
const totalMasuk7Hari = computed(() => {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
  
  return logs.value.filter(log => {
    const logDate = log.waktu.split('T')[0]
    return logDate >= sevenDaysAgoStr && log.status === 'Masuk'
  }).length
})

const totalKeluar7Hari = computed(() => {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
  
  return logs.value.filter(log => {
    const logDate = log.waktu.split('T')[0]
    return logDate >= sevenDaysAgoStr && log.status === 'Keluar'
  }).length
})

// Computed - Jam Tersibuk
const jamTersibuk = computed(() => {
  const hourlyData = getHourlyData()
  const totals = hourlyData.masuk.map((m, i) => m + hourlyData.keluar[i])
  const maxTotal = Math.max(...totals)
  if (maxTotal === 0) return '-'
  const maxIndex = totals.indexOf(maxTotal)
  return hourlyData.hours[maxIndex] || '-'
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
    logs.value = data || []
    console.log('📊 Total log dimuat:', logs.value.length)
    console.log('📅 Tanggal hari ini:', getTodayDateString())
  } catch (error) {
    console.error('❌ Error fetching logs:', error)
  } finally {
    loading.value = false
  }
}

const getHourlyData = () => {
  const hours = []
  const masukData = []
  const keluarData = []
  const today = getTodayDateString()
  
  // Buat array 24 jam (00:00 - 23:00)
  for (let i = 0; i < 24; i++) {
    const hourLabel = `${String(i).padStart(2, '0')}:00`
    hours.push(hourLabel)
    
    // Filter log berdasarkan jam (UTC timezone)
    const masuk = logs.value.filter(log => {
      const logDate = log.waktu.split('T')[0]
      const logTime = new Date(log.waktu)
      const logHour = logTime.getUTCHours()
      return logDate === today && logHour === i && log.status === 'Masuk'
    }).length
    
    const keluar = logs.value.filter(log => {
      const logDate = log.waktu.split('T')[0]
      const logTime = new Date(log.waktu)
      const logHour = logTime.getUTCHours()
      return logDate === today && logHour === i && log.status === 'Keluar'
    }).length
    
    masukData.push(masuk)
    keluarData.push(keluar)
  }
  
  return { hours, masuk: masukData, keluar: keluarData }
}

const getDailyData = () => {
  const days = []
  const masukData = []
  const keluarData = []
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    const masuk = logs.value.filter(log => {
      const logDate = log.waktu.split('T')[0]
      return logDate === dateStr && log.status === 'Masuk'
    }).length
    
    const keluar = logs.value.filter(log => {
      const logDate = log.waktu.split('T')[0]
      return logDate === dateStr && log.status === 'Keluar'
    }).length
    
    days.push(formatWaktu(date.toISOString()))
    masukData.push(masuk)
    keluarData.push(keluar)
  }
  
  return { days, masuk: masukData, keluar: keluarData }
}

const createHourlyChart = () => {
  if (!hourlyChart.value) return
  
  const data = getHourlyData()
  
  if (hourlyChartInstance.value) {
    hourlyChartInstance.value.destroy()
  }
  
  hourlyChartInstance.value = new Chart(hourlyChart.value, {
    type: 'line',
    data: {
      labels: data.hours,
      datasets: [
        {
          label: 'Masuk',
          data: data.masuk,
          borderColor: 'rgba(67, 233, 123, 1)',
          backgroundColor: 'rgba(67, 233, 123, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'rgba(67, 233, 123, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        },
        {
          label: 'Keluar',
          data: data.keluar,
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'rgba(239, 68, 68, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10, 14, 39, 0.95)',
          padding: 12,
          titleColor: '#fff',
          bodyColor: '#e6eef8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { 
            color: '#99b4d6',
            stepSize: 1
          },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          ticks: { 
            color: '#99b4d6',
            maxRotation: 45,
            minRotation: 45
          },
          grid: { display: false }
        }
      }
    }
  })
}

const createDailyChart = () => {
  if (!dailyChart.value) return
  
  const data = getDailyData()
  
  if (dailyChartInstance.value) {
    dailyChartInstance.value.destroy()
  }
  
  dailyChartInstance.value = new Chart(dailyChart.value, {
    type: 'line',
    data: {
      labels: data.days,
      datasets: [
        {
          label: 'Masuk',
          data: data.masuk,
          borderColor: 'rgba(67, 233, 123, 1)',
          backgroundColor: (context) => {
            const ctx = context.chart.ctx
            const gradient = ctx.createLinearGradient(0, 0, 0, 280)
            gradient.addColorStop(0, 'rgba(67, 233, 123, 0.4)')
            gradient.addColorStop(1, 'rgba(67, 233, 123, 0)')
            return gradient
          },
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointBackgroundColor: 'rgba(67, 233, 123, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 3,
          pointHoverBorderWidth: 4
        },
        {
          label: 'Keluar',
          data: data.keluar,
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: (context) => {
            const ctx = context.chart.ctx
            const gradient = ctx.createLinearGradient(0, 0, 0, 280)
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)')
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
            return gradient
          },
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointBackgroundColor: 'rgba(239, 68, 68, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 3,
          pointHoverBorderWidth: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10, 14, 39, 0.95)',
          padding: 12,
          titleColor: '#fff',
          bodyColor: '#e6eef8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
          boxPadding: 4
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { 
            color: '#99b4d6',
            stepSize: 1,
            padding: 10
          },
          grid: { 
            color: 'rgba(255,255,255,0.05)',
            drawBorder: false
          }
        },
        x: {
          ticks: { 
            color: '#99b4d6',
            padding: 10
          },
          grid: { 
            display: false,
            drawBorder: false
          }
        }
      }
    }
  })
}

const refreshData = async () => {
  await fetchLogs()
  await nextTick()
  createHourlyChart()
  createDailyChart()
}

const handleLogsUpdate = (newLogs) => {
  logs.value = newLogs
  createHourlyChart()
  createDailyChart()
}

const setupRealtime = () => {
  realtimeChannel = supabase
    .channel('log-dashboard-chart')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'log'
      },
      (payload) => {
        console.log('🔔 Log baru masuk:', payload.new)
        
        // Tambah data baru ke array dengan cara reaktif
        logs.value = [payload.new, ...logs.value]
        
        // Force trigger reactivity
        updateKey.value++
        
        // Log untuk debugging
        const logDate = payload.new.waktu.split('T')[0]
        const today = getTodayDateString()
        console.log('📅 Log date:', logDate, '| Today:', today, '| Match:', logDate === today)
        console.log('📊 Status:', payload.new.status)
        console.log('🔄 Update key:', updateKey.value)
        console.log('📈 Masuk sekarang:', masukHariIni.value, '| Keluar sekarang:', keluarHariIni.value)
        
        // Update charts
        createHourlyChart()
        createDailyChart()
      }
    )
    .subscribe()
}

// Lifecycle
onMounted(async () => {
  await fetchLogs()
  await nextTick()
  createHourlyChart()
  createDailyChart()
  chartDataReady.value = true
  setupRealtime()
})

onUnmounted(() => {
  if (hourlyChartInstance.value) hourlyChartInstance.value.destroy()
  if (dailyChartInstance.value) dailyChartInstance.value.destroy()
  if (realtimeChannel) realtimeChannel.unsubscribe()
})
</script>

<style scoped>
.container {
  padding: 28px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  background: linear-gradient(135deg, #0a0e27 0%, #1a1d3a 50%, #0f1629 100%);
  min-height: 100vh;
  color: #e6eef8;
}

/* Hero */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  margin-bottom: 28px;
  padding: 24px;
  background: rgba(255,255,255,0.02);
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.05);
  backdrop-filter: blur(10px);
}

.hero-content {
  display: flex;
  align-items: center;
  gap: 18px;
}

.icon-badge {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

h1 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #fff 0%, #a8c5e8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: #99b4d6;
  margin: 0;
  font-size: 0.95rem;
}

.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  padding: 10px 18px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #1f6feb 0%, #1557c0 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(31, 111, 235, 0.3);
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(31, 111, 235, 0.4);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon {
  font-size: 16px;
}

.spinning {
  display: inline-block;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Loading */
.loading-container {
  text-align: center;
  padding: 80px 20px;
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

/* Charts Grid */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.chart-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 24px;
  backdrop-filter: blur(10px);
}

.chart-card.full-width {
  grid-column: 1 / -1;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #ffffff;
}

.chart-legend {
  display: flex;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: #99b4d6;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.masuk {
  background: rgba(67, 233, 123, 1);
}

.dot.keluar {
  background: rgba(239, 68, 68, 1);
}

.chart-wrapper {
  height: 280px;
  margin-bottom: 16px;
}

.chart-summary {
  display: flex;
  justify-content: space-around;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.summary-item .label {
  font-size: 0.85rem;
  color: #99b4d6;
}

.summary-item strong {
  font-size: 20px;
  color: #ffffff;
}

/* Comparison Stats */
.comparison-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-box {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all 0.3s ease;
}

.stat-box:hover {
  transform: translateY(-2px);
  background: rgba(255,255,255,0.05);
}

.stat-box.masuk {
  border-color: rgba(67, 233, 123, 0.3);
}

.stat-box.keluar {
  border-color: rgba(239, 68, 68, 0.3);
}

.stat-box.diff {
  border-color: rgba(102, 126, 234, 0.3);
}

.stat-icon {
  font-size: 32px;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 0.85rem;
  color: #99b4d6;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
}

/* Main Content */
.main-content {
  margin-bottom: 24px;
}

.logs-area {
  margin-top: 8px;
}

/* Responsive */
@media (max-width: 1200px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .comparison-stats {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .hero {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>