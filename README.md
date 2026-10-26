# Dasbor Dokter SIM RS - Modul Radiologi (AIdoctors Middleware)

Aplikasi antarmuka web (Frontend UI) untuk sistem **SIM RS Radiologi** yang terintegrasi dengan alur **Smart Triaging AIdoctors** dan interoperabilitas **HL7 FHIR SATUSEHAT Kemenkes RI**.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi ini dibangun menggunakan **React.js + Vite** (Frontend Murni tanpa ketergantungan backend luar), sehingga **TIDAK** menggunakan `uvicorn` (uvicorn hanya untuk backend Python FastAPI).

### 1. Buka Terminal / PowerShell di Direktori Proyek:
```bash
cd d:\PlayIT\AIdoctors
```

### 2. Instal Dependensi (Jika baru pertama kali di-clone/dijalankan):
```bash
npm install
```

### 3. Jalankan Server Pengembangan (Vite):
```bash
npm run dev
```

### 4. Buka Browser:
Akses alamat lokal berikut:
👉 **http://localhost:5173/**

---

## 🖥️ Fitur & 3 Layar Utama:

1. **Layar 1: Antrean Triase (Triage Queue)**
   - Smart Triaging: Pasien berstatus **[ MERAH ] (Darurat)** otomatis diprioritaskan di baris teratas berdasarkan `skor_studi` tertinggi.
   - 3 Kartu Metrik Ringkas: Kasus Kritis, Kasus Normal, dan Laporan Terkirim FHIR.
   - Fitur **Simulasi Unggah DICOM Baru** untuk menguji alur inferensi CT scan.

2. **Layar 2: Detail Kasus & DICOM Viewer (Cornerstone.js Simulator)**
   - Tata letak *split-screen*: 60% viewer citra aksial CT scan kepala berlatar gelap, 40% panel probabilitas AI & editor draf laporan.
   - Pilihan 3 Windowing: *Brain Window*, *Subdural Window*, dan *Bone Window*.
   - **Toggle Heatmap Grad-CAM** dengan slider opasitas untuk melihat lokasi perdarahan.
   - 3 Tombol Aksi Dokter: *Setujui (ACC) & Kirim ke SATUSEHAT*, *Edit Draf*, dan *Tolak Draf AI*.

3. **Layar 3: Interoperabilitas HL7 FHIR SATUSEHAT & Audit Log**
   - Kartu Metrik Kinerja & SLA (*Waktu inferensi 14.2s < 60s*, *EfficientNet-B0 v1.2*, *HTTP 200 OK Idempoten*).
   - Tabel pemetaan 5 Resource FHIR R4: `Patient & Encounter`, `ServiceRequest`, `ImagingStudy`, `Observation` (transisi *preliminary* -> *final*), dan `DiagnosticReport`.
   - Timeline audit log kronologis dan *Dark Code Viewer* JSON Bundle FHIR yang dapat disalin dan diunduh.

---

## 🛠️ Spesifikasi Teknologi (Tech Stack)

- **Frontend Framework:** React.js 19
- **Bundler & Dev Server:** Vite 8
- **Styling:** Tailwind CSS v3 (Fluid Full-Width Responsive)
- **Icons:** Lucide React
- **Standard Medis:** DICOM (Orthanc Server Mock), HL7 FHIR Release 4
