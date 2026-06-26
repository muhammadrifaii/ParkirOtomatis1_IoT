<template>
  <div class="card">
    <div class="header">
      <div>
        <h2>🅿️ Status Slot Parkir</h2>
        <small class="hint">
          <span class="live-dot"></span>
          Update realtime dari IoT
        </small>
      </div>
      <button class="refresh-btn" @click="refreshData" :disabled="isRefreshing">
        <span :class="{ spinning: isRefreshing }">🔄</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Memuat data dari database...</p>
    </div>

    <template v-else>
      <!-- Stats Grid -->
      <div class="grid">
        <div class="box total">
          <div class="box-icon">📦</div>
          <div class="box-content">
            <p>Total Slot</p>
            <h3 class="counter">{{ maxSlot }}</h3>
          </div>
        </div>

        <div class="box available">
          <div class="box-icon">✅</div>
          <div class="box-content">
            <p>Tersedia</p>
            <h3 class="counter">{{ slotTersedia }}</h3>
          </div>
        </div>

        <div class="box used">
          <div class="box-icon">🚗</div>
          <div class="box-content">
            <p>Terpakai</p>
            <h3 class="counter">{{ slotTerpakai }}</h3>
          </div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="progress-wrap">
        <div class="progress-label">
          Penggunaan: <strong>{{ slotTerpakai }} / {{ maxSlot }}</strong>
          <span class="percentage">{{ percent }}%</span>
        </div>
        <div class="progress">
          <div class="bar" :style="{ width: percent + '%' }" :class="getProgressClass()"></div>
        </div>
      </div>

      <!-- Visual Parking Slots -->
      <div class="parking-visual">
        <h3 class="section-title">Layout Parkir</h3>
        <div class="slots-grid">
          <div 
            v-for="slot in slots" 
            :key="slot.id"
            class="slot"
            :class="{ occupied: slot.occupied }"
          >
            <div class="slot-number">{{ slot.id }}</div>
            <div class="slot-icon">{{ slot.occupied ? '🚗' : '✓' }}</div>
            <div class="slot-status">{{ slot.occupied ? 'Terisi' : 'Kosong' }}</div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="legend">
        <div class="legend-item">
          <div class="legend-box occupied"></div>
          <span>Terisi</span>
        </div>
        <div class="legend-item">
          <div class="legend-box available"></div>
          <span>Tersedia</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getSlot, subscribeToSlot } from '../supabase'

// Data
const loading = ref(true)
const isRefreshing = ref(false)
const maxSlot = ref(4) // Default dari ESP32
const slotTersedia = ref(0)
let realtimeChannel = null

// Computed
const slotTerpakai = computed(() => maxSlot.value - slotTersedia.value)
const percent = computed(() => Math.round((slotTerpakai.value / maxSlot.value) * 100))

// Generate visual slots
const slots = computed(() => {
  const result = []
  for (let i = 1; i <= maxSlot.value; i++) {
    result.push({
      id: i,
      occupied: i <= slotTerpakai.value
    })
  }
  return result
})

// Methods
const fetchSlotData = async () => {
  loading.value = true
  try {
    const data = await getSlot()
    if (data) {
      slotTersedia.value = data.jumlah
      console.log('📊 Slot tersedia:', data.jumlah)
    }
  } catch (error) {
    console.error('❌ Error fetching slot:', error)
  } finally {
    loading.value = false
  }
}

const refreshData = async () => {
  isRefreshing.value = true
  await fetchSlotData()
  setTimeout(() => {
    isRefreshing.value = false
  }, 500)
}

const getProgressClass = () => {
  if (percent.value >= 80) return 'critical'
  if (percent.value >= 50) return 'warning'
  return 'normal'
}

const setupRealtime = () => {
  realtimeChannel = subscribeToSlot((payload) => {
    if (payload.eventType === 'UPDATE') {
      const newData = payload.new
      slotTersedia.value = newData.jumlah
      console.log('🔔 Slot update realtime:', newData.jumlah)
    }
  })
}

// Lifecycle
onMounted(async () => {
  await fetchSlotData()
  setupRealtime()
})

onUnmounted(() => {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe()
    console.log('🔌 Realtime slot disconnected')
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
  transform: translateY(-2px);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  display: inline-block;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.box {
  padding: 18px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all 0.3s ease;
}

.box:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}

.box-icon {
  font-size: 32px;
  opacity: 0.9;
}

.box-content {
  flex: 1;
}

.box-content p {
  margin: 0 0 4px 0;
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0.9;
}

.box-content h3 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
}

.total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.available {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: #0a0e27;
}

.used {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: #0a0e27;
}

.progress-wrap {
  margin-bottom: 28px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #cfe6ff;
  margin-bottom: 10px;
  font-size: 0.95rem;
}

.percentage {
  color: #43e97b;
  font-weight: 700;
  font-size: 1.1rem;
}

.progress {
  background: rgba(255,255,255,0.05);
  height: 16px;
  border-radius: 999px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
}

.bar {
  height: 100%;
  border-radius: 999px;
  transition: width 500ms ease, background 300ms ease;
  position: relative;
  overflow: hidden;
}

.bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.bar.normal {
  background: linear-gradient(90deg, #43e97b, #38f9d7);
}

.bar.warning {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
}

.bar.critical {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.parking-visual {
  margin-top: 28px;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 1.1rem;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.slot {
  background: rgba(67, 233, 123, 0.1);
  border: 2px solid rgba(67, 233, 123, 0.3);
  border-radius: 12px;
  padding: 16px 12px;
  text-align: center;
  transition: all 0.3s ease;
  position: relative;
}

.slot.occupied {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.slot-number {
  font-size: 0.75rem;
  font-weight: 700;
  color: #99b4d6;
  margin-bottom: 8px;
}

.slot-icon {
  font-size: 28px;
  margin-bottom: 6px;
}

.slot-status {
  font-size: 0.75rem;
  font-weight: 600;
  color: #43e97b;
}

.slot.occupied .slot-status {
  color: #ef4444;
}

.legend {
  display: flex;
  gap: 20px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #b8cce4;
}

.legend-box {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid;
}

.legend-box.occupied {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
}

.legend-box.available {
  background: rgba(67, 233, 123, 0.2);
  border-color: rgba(67, 233, 123, 0.4);
}

@media (max-width: 768px) {
  .slots-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 8px;
  }
  
  .slot {
    padding: 12px 8px;
  }
  
  .slot-icon {
    font-size: 24px;
  }
}
</style>