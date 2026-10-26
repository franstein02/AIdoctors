# Dasbor Dokter SIM RS - Modul Radiologi (AIdoctors Middleware)

Aplikasi antarmuka web (*Frontend UI*) untuk sistem **SIM RS Radiologi** yang terintegrasi dengan alur **Smart Triaging AIdoctors** dan interoperabilitas **HL7 FHIR SATUSEHAT Kemenkes RI**.

Aplikasi ini berfungsi sebagai ruang kerja dokter spesialis radiologi untuk memantau antrean prioritas gawat darurat, meninjau irisan citra CT kepala bersama indikasi Grad-CAM, serta memvalidasi laporan diagnostik sebelum dikirim ke ekosistem SATUSEHAT secara idempoten.

---

## 🚀 Prasyarat & Cara Menjalankan Aplikasi

Aplikasi ini dibangun menggunakan **React.js + Vite** (prototipe antarmuka frontend interaktif tanpa dependensi langsung ke server modalitas fisik).

> **Prasyarat:** Pastikan komputer Anda telah terpasang **Node.js** (versi 18.x atau lebih baru).

### 1. Masuk ke Direktori Proyek:
```bash
cd aidoctors/frontend
```
*(atau sesuaikan dengan direktori lokal folder frontend Anda)*

### 2. Instal Dependensi (Jika baru pertama kali di-clone/dijalankan):
```bash
npm install
```

### 3. Jalankan Server Pengembangan (Vite):
```bash
npm run dev
```

### 4. Buka di Browser:
Akses alamat lokal berikut:
👉 **http://localhost:5173/**

---

## 🖥️ Fitur & 3 Layar Utama

### 1. Layar 1: Antrean Triase (Triage Queue)
- **Smart Triaging Otomatis:** Pasien dengan indikasi kritis berstatus **[ MERAH ] (Darurat)** otomatis dinaikkan ke baris teratas antrean berdasarkan `skor_studi` tertinggi.
- **Safety Principle:** AI hanya menaikkan prioritas kasus darurat dan **tidak pernah menurunkan** peringkat pasien normal (kasus normal tetap mempertahankan posisi murni berdasarkan waktu kedatangan/FIFO).
- **3 Kartu Metrik Ringkas:** Menampilkan akumulasi Kasus Kritis (Merah), Kasus Normal, dan Laporan Terkirim FHIR.
- **Simulasi Unggah DICOM Baru:** Tombol interaktif untuk menguji alur inferensi CT scan secara instan.

### 2. Layar 2: Detail Kasus & DICOM Viewer (Cornerstone.js Simulator)
- **Clinical Safety Banner:** Peringatan etik wajib di bagian atas: *"PERINGATAN: Dugaan AI, bukan diagnosis klinis mutlak. Keputusan akhir berada pada dokter spesialis radiologi."*
- **Tata Letak Split-Screen Responsif:**
  - **Sisi Kiri (60%):** Viewer citra aksial CT scan kepala berlatar gelap (*dark mode*) dilengkapi kontrol gulir irisan (*slice navigation*) dan pintasan irisan kunci (*key slices*).
  - **3 Profil Windowing Medis:** Pilihan preset kontras *Brain Window* (C:40, W:80), *Subdural Window* (C:80, W:200), dan *Bone Window* (C:40, W:380).
  - **Heatmap Grad-CAM Overlay:** Tombol *toggle* sakelar visual untuk melihat area kecurigaan perdarahan dengan slider penyesuaian opasitas.
  - **Sisi Kanan (40%):** Panel probabilitas AI (skor studi umum + 5 subtipe perdarahan) dan editor draf laporan terstruktur berbasis templat.
- **3 Tombol Aksi Klinis Dokter:**
  - **Setujui (ACC) & Kirim ke SATUSEHAT:** Menetapkan laporan menjadi status *final* dan memicu pembentukan bundle FHIR.
  - **Edit Draf:** Membuka mode sunting teks laporan templat.
  - **Tolak Draf AI:** Mengosongkan draf AI agar dokter dapat mengetik laporan manual dari awal.

### 3. Layar 3: Interoperabilitas HL7 FHIR SATUSEHAT & Audit Log
- **Kartu Metrik Kinerja & SLA:** Memantau waktu inferensi real-time (target latensi < 60 detik), versi model arsitektur (EfficientNet-B0), dan respons transmisi (HTTP 200 OK Idempoten).
- **Tabel Pemetaan 5 Resource HL7 FHIR R4:**
  1. `Patient & Encounter`: Identitas sintetis pasien dan data kunjungan rawat darurat.
  2. `ServiceRequest`: Rujukan permintaan pemeriksaan radiologi SIM RS (*basedOn*).
  3. `ImagingStudy`: Metadata DICOM (UID studi, modalitas CT, jumlah seri & instans).
  4. `Observation`: Temuan deteksi AI dengan transisi status dari *preliminary* (dugaan AI) menjadi *final* (usai disetujui dokter).
  5. `DiagnosticReport`: Laporan akhir radiologi berstatus *final* yang merujuk pada seluruh resource pendukung.
- **Jejak Audit & Penampil Payload:** Linimasa riwayat kronologis stempel waktu (*timestamp*) dan *Dark Code Viewer* JSON Bundle FHIR yang dapat disalin (*copy*) maupun diunduh (*export*).

---

## 🛠️ Spesifikasi Teknologi (Tech Stack)

- **Frontend Framework:** React.js
- **Tooling & Bundler:** Vite
- **Styling:** Tailwind CSS (Fluid Full-Width Responsive)
- **Icons:** Lucide React
- **Standar & Protokol Medis:** DICOM (Cornerstone.js Simulator / Orthanc Mock), HL7 FHIR Release 4