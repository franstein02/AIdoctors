# Direktori Berkas Uji (sample_data) - AIdoctors

Direktori ini digunakan untuk menyimpan berkas citra medis CT scan kepala non-kontras dalam format:
- `.dcm` (DICOM format standar RSNA / PACS Orthanc)
- `.nii` / `.nii.gz` (NIfTI 3D neuroimaging)

### Format & Struktur Data Uji
Pemeriksaan CT scan kepala aksial non-kontras terdiri dari serangkaian irisan (*slices*), umumnya 24 hingga 64 irisan per studi.
Parameter akuisisi umum:
- **Matrix:** 512 x 512
- **Ketebalan Irisan (Slice Thickness):** 2.5 mm – 5.0 mm
- **Skala Densitas:** Hounsfield Unit (HU) dengan `RescaleSlope` dan `RescaleIntercept`

### Pengujian Inferensi
Berkas di direktori ini dapat dimuat melalui:
1. Endpoint API FastAPI: `POST /api/v1/triage/upload`
2. Modalitas simulasi upload pada antarmuka frontend Layar 1 (`Screen1TriageQueue.jsx`)
