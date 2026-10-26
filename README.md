# AIdoctors: SIM RS–SATUSEHAT Interoperability & Smart Triaging Middleware

Sistem middleware interoperabilitas **SIM RS Radiologi – SATUSEHAT Kemenkes RI (HL7 FHIR R4)** yang dilengkapi fitur pendukung **Smart Triaging perdarahan intrakranial (Intracranial Hemorrhage / ICH)** pada pemeriksaan **CT kepala non-kontras**.

---

## 🏛️ Aturan Arsitektur Mutlak (Architectural Guardrails)

1. **Prinsip Human-in-the-Loop:**
   - AI bertindak semata-mata sebagai asisten triase dan skrining awal.
   - Status temuan AI (`Observation` dan `DiagnosticReport`) berstatus awal strictly `preliminary`.
   - **Tidak ada data atau laporan diagnostik yang dikirimkan ke ekosistem SATUSEHAT sebelum dokter spesialis radiologi memvalidasi dan menekan tombol Setujui (ACC)**.
2. **Prinsip Triase Aman (Non-Demoting Queue):**
   - AI hanya memiliki wewenang menaikkan prioritas antrean (`tier = MERAH`) jika `skor_studi >= ambang`.
   - AI **dilarang keras menurunkan prioritas pasien** (`tier = NORMAL` tetap mempertahankan posisi murni berdasarkan waktu kedatangan / FIFO).
3. **Baku Kontrak Data Mutlak:**
   - Seluruh modul backend, model Pydantic, antarmuka frontend, dan bundle FHIR wajib mematuhi variabel:
     - `study_uid`: DICOM Study Instance UID unik
     - `skor_studi`: Probabilitas keseluruhan perdarahan intrakranial [0.0 - 1.0]
     - `skor_subtipe`: Probabilitas 5 subtipe perdarahan (`epidural`, `intraparenkim`, `intraventrikel`, `subaraknoid`, `subdural`)
     - `tier`: Klasifikasi antrean (`MERAH` atau `NORMAL`)
     - `irisan_kunci`: Irisan aksial dengan lesi dominan/puncak
     - `heatmap`: Representasi spasial visualisasi Grad-CAM
     - `draf_laporan`: Draf templat radiologi (`temuan`, `kesan`, `catatan_wajib`)
     - `versi_model`: Identitas arsitektur ML (misal: `EfficientNet-B0 v1.2`)
     - `ambang`: Ambang batas triase (default: `0.50`)
     - `waktu_inferensi`: Durasi komputasi (target SLA: `< 60 Detik`)

---

## 📁 Struktur Direktori Monorepo

```plaintext
aidoctors/
├── backend/
│   ├── app/
│   │   ├── api/          # Router FastAPI: /api/v1/triage & /api/v1/satusehat
│   │   ├── core/         # Konfigurasi, ambang batas, & in-memory/DB state
│   │   ├── services/     # Engine AI (EfficientNet-B0 + HU Windowing), Triase Aman, & FHIR R4
│   │   └── models/       # Skema Pydantic V2 & ORM
│   ├── weights/          # aidoctors_effnet_epoch_3.pth (.gitignore)
│   ├── requirements.txt  # Dependensi Python FastAPI & PyTorch
│   └── main.py           # Entrypoint aplikasi server FastAPI
├── frontend/
│   ├── src/
│   │   ├── components/   # Komponen UI (Header, DicomCanvasViewer, Modal)
│   │   ├── pages/        # Layar 1 (Triage Queue), Layar 2 (Viewer), Layar 3 (SATUSEHAT Audit)
│   │   ├── services/     # API Client (apiClient.js)
│   │   └── data/         # Mock data & FHIR bundle generator
│   ├── package.json      # Dependensi React + Vite + Tailwind CSS
│   └── vite.config.js
├── sample_data/          # Berkas uji citra CT Scan (.dcm / .nii)
└── README.md
```

---

## 🚀 Panduan Menjalankan Sistem

### 1. Menjalankan Backend (FastAPI)

> **Prasyarat:** Python 3.10+ terpasang.

Masuk ke direktori backend dan instal dependensi:

```bash
cd backend
pip install -r requirements.txt
```

Jalankan server backend FastAPI:

```bash
python main.py
```

* Backend API berjalan di: 👉 **http://localhost:8000**
* Dokumentasi Interaktif Swagger UI: 👉 **http://localhost:8000/docs**

---

### 2. Menjalankan Frontend (React + Vite)

> **Prasyarat:** Node.js 18+ terpasang.

Buka terminal baru, masuk ke direktori frontend:

```bash
cd frontend
npm install
npm run dev
```

* Antarmuka Web SIM RS Radiologi berjalan di: 👉 **http://localhost:5173**

---

## 🖥️ 3 Layar Kerja Radiologi

1. **Layar 1: Antrean Triase (Triage Queue)**
   - Smart Triaging otomatis memprioritaskan kasus `[ MERAH ]` ke baris paling atas berdasarkan `skor_studi` tertinggi.
   - Kasus `[ NORMAL ]` tidak pernah didegradasi, menjaga prinsip keadilan antrean FIFO.
2. **Layar 2: Detail Kasus & DICOM Viewer (Cornerstone.js Simulator)**
   - Clinical Safety Banner: *"PERINGATAN: Dugaan AI, bukan diagnosis klinis mutlak. Keputusan akhir berada pada dokter spesialis radiologi."*
   - Navigasi irisan aksial dengan 3 profil Windowing: Brain (C:40, W:80), Subdural (C:80, W:200), Bone (C:40, W:380).
   - Overlay Grad-CAM dengan slider opasitas visual.
   - Editor draf laporan radiologi dan tombol otorisasi **Setujui (ACC) & Kirim ke SATUSEHAT**.
3. **Layar 3: Interoperabilitas HL7 FHIR SATUSEHAT & Jejak Audit**
   - Transmisi idempoten (HTTP 200 OK) ke gateway SATUSEHAT DTO Kemenkes.
   - Pemetaan 5 Resource FHIR R4: `Patient`, `Encounter`, `ServiceRequest`, `ImagingStudy`, `Observation`, dan `DiagnosticReport`.
   - Viewer kode JSON Bundle dengan stempel waktu kronologis audit log.
