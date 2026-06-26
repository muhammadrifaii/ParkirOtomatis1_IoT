# 🅿️ ParkirOtomatis - Web Dashboard IoT

**ParkirOtomatis** adalah aplikasi **web dashboard real-time** untuk memantau dan mengelola sistem parkir otomatis berbasis IoT. Dibangun dengan **Vue 3 + Vite** dan terintegrasi dengan **Supabase** (PostgreSQL) sebagai backend.

Aplikasi ini menampilkan data langsung dari perangkat **ESP32/Arduino** yang mengontrol palang parkir dan sensor, sehingga pengguna dapat memantau kondisi parkir secara *real-time* melalui browser.

---

## ✨ Fitur-Fitur

### 🟢 Monitoring Slot Parkir

* Menampilkan total slot parkir, slot tersedia, dan slot terpakai
* **Progress bar** dengan warna indikator:

  * 🟢 Hijau (0–49%) — Normal
  * 🟡 Kuning (50–79%) — Warning
  * 🔴 Merah (80–100%) — Kritis
* **Grid visual** setiap slot parkir dengan ikon dan status (Kosong/Terisi)
* **Update real-time** via Supabase subscription — perubahan langsung terlihat tanpa refresh

### 📋 Log Aktivitas Kendaraan

* Tabel **riwayat** masuk/keluar kendaraan
* **Pencarian** (search) berdasarkan ID, status, atau waktu
* **Filter status** — Semua, Masuk, atau Keluar
* **Sortir** kolom (ID, Waktu) secara ascending/descending
* **Paginasi** (10 data per halaman)
* **Ekspor CSV** — unduh data log ke file CSV
* **Sorot data baru** — baris baru muncul dengan animasi highlight hijau
* **Notifikasi desktop** — pemberitahuan browser setiap ada kendaraan masuk/keluar

### 📊 Grafik Analitik (Chart.js)

1. **Aktivitas Per Jam (Hari Ini)** — grafik garis masuk/keluar tiap jam, menampilkan jam tersibuk
2. **Aktivitas 7 Hari Terakhir** — grafik garis tren masuk/keluar selama seminggu
3. **Perbandingan Masuk vs Keluar** — ringkasan jumlah masuk, keluar, dan selisih hari ini

* Semua grafik **real-time** — data baru langsung muncul tanpa reload

### 🔄 Update Real-Time

* Menggunakan **Supabase Realtime** (`postgres_changes`)
* Data slot parkir dan log aktivitas diperbarui secara otomatis begitu ada perubahan dari perangkat IoT

---

## 🛠️ Teknologi yang Digunakan

| Teknologi    | Kegunaan                                               |
| ------------ | ------------------------------------------------------ |
| **Vue 3**    | Framework frontend (Composition API, `<script setup>`) |
| **Vite 7**   | Build tool & dev server (cepat)                        |
| **Supabase** | Backend database PostgreSQL + real-time subscriptions  |
| **Chart.js** | Library grafik analitik                                |
| **CSS3**     | Dark theme, glassmorphism, animasi, responsive design  |

---

## 📁 Struktur Proyek

```text
ParkirOtomatis1/
├── index.html                  # Entry point HTML
├── package.json                # Manifes proyek & dependensi
├── vite.config.js              # Konfigurasi Vite
├── src/
│   ├── main.js                 # Bootstrap Vue app
│   ├── App.vue                 # Komponen root
│   ├── supabase.js             # Koneksi & helper Supabase
│   ├── style.css               # Global styling (dark theme)
│   ├── views/
│   │   └── Dashboard.vue       # Halaman utama dashboard
│   ├── components/
│   │   ├── SlotStatus.vue      # Komponen status slot parkir
│   │   └── LogTable.vue        # Komponen tabel log aktivitas
│   └── assets/
│       └── vue.svg             # Logo Vue
├── public/
│   └── vite.svg                # Favicon
└── .vscode/
    └── extensions.json         # Rekomendasi ekstensi VS Code
```

---

## 🚀 Cara Menjalankan

### Prasyarat

* **Node.js** versi 18+ terinstal
* Koneksi internet (untuk mengakses Supabase backend)

### Langkah-langkah

```bash
# 1. Clone repositori
git clone <URL_REPOSITORI>

# 2. Masuk ke folder proyek
cd ParkirOtomatis1-main

# 3. Install dependensi
npm install

# 4. Jalankan development server
npm run dev
```

Akses di browser:

http://localhost:5173

### Perintah Lainnya

```bash
# Build untuk produksi
npm run build

# Preview hasil build
npm run preview
```

---

## 🗄️ Setup Database di Supabase

Aplikasi ini menggunakan **Supabase** (PostgreSQL) sebagai backend. Ikuti langkah-langkah berikut untuk membuat database sendiri.

### 1. Buat Proyek di Supabase

1. Buka https://supabase.com dan login/daftar.
2. Klik **New Project**.
3. Isi nama proyek, password database (simpan password ini), dan pilih region.
4. Tunggu hingga provisioning selesai (~2 menit).

### 2. Buat Tabel `log`

Buka **SQL Editor** di dashboard Supabase, lalu jalankan query berikut:

```sql
-- Tabel untuk menyimpan log aktivitas masuk/keluar kendaraan
CREATE TABLE log (
  id BIGSERIAL PRIMARY KEY,
  waktu TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('Masuk', 'Keluar'))
);

-- Index untuk mempercepat pencarian berdasarkan waktu
CREATE INDEX idx_log_waktu ON log (waktu DESC);
```

### 3. Buat Tabel `slot`

```sql
-- Tabel untuk menyimpan jumlah slot parkir yang tersedia
CREATE TABLE slot (
  id BIGINT PRIMARY KEY DEFAULT 1,
  jumlah INTEGER NOT NULL DEFAULT 4,
  CHECK (id = 1) -- Hanya mengizinkan 1 baris
);

-- Insert baris awal dengan total 4 slot parkir
INSERT INTO slot (id, jumlah) VALUES (1, 4);
```

### 4. Aktifkan Realtime

Agar data dapat diperbarui secara real-time tanpa refresh:

1. Di dashboard Supabase, buka menu **Database → Replication**.
2. Pada bagian **Source**, pastikan tabel `log` dan `slot` sudah terdaftar.
3. Jika belum, klik **Add a table**, lalu pilih tabel yang diinginkan.

Atau jalankan query berikut di **SQL Editor**:

```sql
-- Aktifkan realtime untuk tabel log dan slot
ALTER PUBLICATION supabase_realtime ADD TABLE log;
ALTER PUBLICATION supabase_realtime ADD TABLE slot;
```

> **Catatan:** Pastikan kedua tabel sudah dibuat sebelum menjalankan query di atas.

### 5. Konfigurasi di Aplikasi

1. Buka file `src/supabase.js`.
2. Ganti `supabaseUrl` dan `supabaseKey` dengan kredensial dari proyek Supabase Anda:

   * `supabaseUrl` → Ambil dari **Project Settings → API → Project URL**
   * `supabaseKey` → Ambil dari **Project Settings → API → anon/public key**

```javascript
const supabaseUrl = 'https://project-anda.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### 6. Test dengan Data Dummy

```sql
-- Masukkan data dummy untuk testing
INSERT INTO log (status) VALUES ('Masuk'), ('Masuk'), ('Keluar'), ('Masuk');

INSERT INTO log (status, waktu) VALUES
  ('Masuk', NOW() - INTERVAL '2 hours'),
  ('Keluar', NOW() - INTERVAL '1 hour'),
  ('Masuk', NOW() - INTERVAL '30 minutes');
```

### 7. Atur Row Level Security (RLS) — Opsional

Jika ingin mengakses data tanpa autentikasi (public read/write):

```sql
-- Izinkan akses anonim untuk membaca dan menulis ke tabel log
ALTER TABLE log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON log
FOR ALL
USING (true)
WITH CHECK (true);

-- Izinkan akses anonim untuk membaca dan menulis ke tabel slot
ALTER TABLE slot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON slot
FOR ALL
USING (true)
WITH CHECK (true);
```

### 🔌 Koneksi dari ESP32/Arduino

Untuk mengirim data dari perangkat IoT ke Supabase:

**Contoh kirim data log (HTTP POST):**

```http
POST https://project-anda.supabase.co/rest/v1/log
Content-Type: application/json
apikey: <anon-key>
Authorization: Bearer <anon-key>

{
  "status": "Masuk"
}
```

**Contoh update jumlah slot:**

```http
PATCH https://project-anda.supabase.co/rest/v1/slot?id=eq.1
Content-Type: application/json
apikey: <anon-key>
Authorization: Bearer <anon-key>

{
  "jumlah": 3
}
```

---

## 🧠 Cara Kerja

1. **Perangkat IoT** (ESP32/Arduino) mendeteksi kendaraan masuk/keluar melalui sensor.
2. Data dikirim ke **Supabase** (tabel `log` dan `slot`).
3. **Web dashboard** mengambil data dari Supabase dan menampilkannya dalam bentuk:

   * Grid slot parkir (kosong/terisi)
   * Tabel log aktivitas
   * Grafik analitik
4. **Real-time subscription** memastikan dashboard selalu sinkron dengan data terbaru.

### Database Supabase

| Tabel  | Deskripsi                                                           |
| ------ | ------------------------------------------------------------------- |
| `log`  | **Riwayat** masuk/keluar kendaraan (kolom: `id`, `waktu`, `status`) |
| `slot` | Status ketersediaan slot parkir (kolom: `id`, `jumlah`)             |

---

## 🎯 Manfaat

* **Monitoring real-time** — pantau kondisi parkir dari mana saja melalui browser
* **Efisiensi operasional** — mengetahui jumlah kendaraan yang masuk/keluar tanpa harus mengecek langsung ke lapangan
* **Data historis** — **riwayat** aktivitas parkir tersimpan rapi dan dapat diekspor ke CSV untuk analisis lebih lanjut
* **Visualisasi data** — grafik harian/mingguan membantu melihat tren dan jam sibuk
* **Notifikasi otomatis** — mendapatkan pemberitahuan setiap ada kendaraan masuk/keluar
* **Open source** — dapat dikembangkan lebih lanjut sesuai kebutuhan

---

## 🔧 Pengembangan Lebih Lanjut (Ide)

Beberapa hal yang dapat ditambahkan di masa mendatang:

* Autentikasi pengguna (login multi-user)
* Manajemen tarif parkir
* Cetak tiket parkir digital
* Notifikasi via WhatsApp/Telegram
* Multiple lokasi parkir
* Mode gelap/terang (toggle)

---

## 📄 Lisensi

Proyek ini bersifat **privat/open source** — silakan dikembangkan sesuai kebutuhan.
