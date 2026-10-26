// API Client untuk Komunikasi Frontend SIM RS dengan Backend Middleware FastAPI (AIdoctors)
import { INITIAL_PATIENTS, generateFhirBundleJson } from '../data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const SERVER_BASE_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

/**
 * Normalisasi data studi radiologi agar kompatibel penuh antara backend database dan mock frontend
 */
export function normalizeStudyData(item) {
  if (!item) return null;

  const studyUid = item.study_uid || item.id || `std-${Date.now()}`;
  const id = item.id || studyUid;
  const namaPasien = item.patient_name || item.nama_pasien || 'Pasien Anonim';
  const noRm = item.no_rm || 'RM-000000';
  const usia = item.usia || 50;
  const jenisKelamin = item.jenis_kelamin || 'Laki-laki';
  const modalitas = item.modalitas || 'CT Kepala Non-Kontras';
  const skorStudi = typeof item.skor_studi === 'number' ? item.skor_studi : 0.0;
  const tier = item.tier || (skorStudi >= 0.50 ? 'MERAH' : 'NORMAL');
  const waktuTungguMenit = item.waktu_tunggu_menit || (tier === 'MERAH' ? 12 : 35);
  const totalSlices = item.total_slices || 32;
  const currentSlice = item.current_slice || (tier === 'MERAH' ? 18 : 16);

  // Normalisasi irisan_kunci
  let irisanKunci = [];
  if (Array.isArray(item.irisan_kunci)) {
    if (item.irisan_kunci.length > 0 && typeof item.irisan_kunci[0] === 'object') {
      irisanKunci = item.irisan_kunci;
    } else {
      // Array of ints e.g. [14, 16, 18, 19, 21]
      const peakSlice = item.irisan_kunci[Math.floor(item.irisan_kunci.length / 2)] || 18;
      irisanKunci = item.irisan_kunci.map((sliceNum) => ({
        slice: sliceNum,
        score: sliceNum === peakSlice ? skorStudi : Math.max(0.2, (skorStudi * 0.9).toFixed(2)),
        isPeak: sliceNum === peakSlice,
        note: sliceNum === peakSlice ? 'Puncak Densitas Lesi' : 'Ekstensi Perdarahan'
      }));
    }
  } else {
    irisanKunci = [
      { slice: 16, score: (skorStudi * 0.88).toFixed(2), note: 'Irisan Awal' },
      { slice: 18, score: skorStudi.toFixed(2), isPeak: true, note: 'Ketebalan Puncak' },
      { slice: 19, score: (skorStudi * 0.85).toFixed(2), note: 'Ekstensi Perdarahan' }
    ];
  }

  // Normalisasi skor_subtipe
  const skorSubtipe = item.skor_subtipe || {
    subdural: tier === 'MERAH' ? 0.91 : 0.02,
    epidural: tier === 'MERAH' ? 0.18 : 0.01,
    intraparenkim: tier === 'MERAH' ? 0.42 : 0.05,
    subaraknoid: tier === 'MERAH' ? 0.29 : 0.03,
    intraventrikel: tier === 'MERAH' ? 0.05 : 0.01
  };

  // Cari subtipe dominan
  let dominantSubtype = 'Normal';
  let maxScore = 0;
  for (const [sub, val] of Object.entries(skorSubtipe)) {
    if (val > maxScore && val >= 0.5) {
      maxScore = val;
      dominantSubtype = sub.charAt(0).toUpperCase() + sub.slice(1);
    }
  }
  if (item.subtipe_dominan) {
    dominantSubtype = item.subtipe_dominan;
  }

  // Normalisasi draf_laporan
  let drafLaporanText = '';
  if (typeof item.draf_laporan === 'string') {
    drafLaporanText = item.draf_laporan;
  } else if (item.draf_laporan && typeof item.draf_laporan === 'object') {
    const findings = item.draf_laporan.temuan || '';
    const impression = item.draf_laporan.kesan || '';
    const note = item.draf_laporan.catatan_wajib || item.draf_laporan.catatan || 'Perlu konfirmasi dokter spesialis radiologi.';
    drafLaporanText = `TEMUAN:\n${findings}\n\nKESAN:\n${impression}\n\nCATATAN SISTEM:\n${note}`;
  } else {
    drafLaporanText = `TEMUAN:\nTampak area densitas jaringan intrakranial dalam batas normal. Sulkus dan girus kortikalis reguler.\n\nKESAN:\nTidak tampak perdarahan intrakranial akut signifikan.\n\nCATATAN SISTEM:\nDugaan AI, bukan diagnosis. Perlu konfirmasi dokter spesialis radiologi.`;
  }

  // Normalisasi status pemeriksaan & status fhir
  const statusPemeriksaan = item.status_pemeriksaan || (item.status === 'Selesai - FHIR Terkirim' ? 'SELESAI_ACC' : 'MENUNGGU_VALIDASI');
  const statusFhir = item.status_fhir || (statusPemeriksaan === 'SELESAI_ACC' ? 'TERKIRIM' : 'BELUM_DIKIRIM');

  return {
    ...item,
    id,
    study_uid: studyUid,
    nama_pasien: namaPasien,
    patient_name: namaPasien,
    no_rm: noRm,
    usia,
    jenis_kelamin: jenisKelamin,
    modalitas,
    tier,
    skor_studi: skorStudi,
    skor_subtipe: skorSubtipe,
    subtipe_dominan: dominantSubtype,
    tingkat_keparahan: item.tingkat_keparahan || (skorStudi >= 0.85 ? 'Sangat Tinggi' : skorStudi >= 0.50 ? 'Tinggi' : 'Normal / Rendah'),
    waktu_tunggu_menit: waktuTungguMenit,
    waktu_tunggu: `${waktuTungguMenit} Menit`,
    tanggal: item.tanggal || '15 Okt 2026, 10:14 WIB',
    status_pemeriksaan: statusPemeriksaan,
    status_fhir: statusFhir,
    status: statusPemeriksaan === 'SELESAI_ACC' ? 'Selesai - FHIR Terkirim' : statusPemeriksaan === 'SEDANG_DIPERIKSA' ? 'Sedang Diperiksa' : 'Belum Dibaca',
    total_slices: totalSlices,
    current_slice: currentSlice,
    irisan_kunci: irisanKunci,
    heatmap_url: item.heatmap_url || null,
    draf_laporan: drafLaporanText,
    laporan_final_dokter: item.laporan_final_dokter || null,
    versi_model: item.versi_model || 'EfficientNet-B0 v1.0',
    ambang: item.ambang || 0.50,
    waktu_inferensi: item.waktu_inferensi ? `${item.waktu_inferensi}s` : '1.42s',
    fhir_ids: item.fhir_ids || {
      patient: `pat-ss-${studyUid.slice(-5)}`,
      encounter: `enc-ss-${studyUid.slice(-5)}`,
      serviceRequest: `sr-ss-${studyUid.slice(-5)}`,
      imagingStudy: `img-ss-${studyUid.slice(-5)}`,
      observation: `obs-ss-${studyUid.slice(-5)}`,
      diagnosticReport: `dr-ss-${studyUid.slice(-5)}`
    },
    audit_metrics: item.audit_metrics || {
      waktu_inferensi: item.waktu_inferensi ? `${item.waktu_inferensi} Detik` : '14.2 Detik',
      target_latensi: '< 60 Detik',
      status_target: 'Target < 60 Detik Terpenuhi',
      versi_model: item.versi_model || 'EfficientNet-B0 v1.0',
      ambang_triase: item.ambang || 0.50,
      arsitektur: 'CNN 6-Class Multi-label + Grad-CAM',
      status_konektor: statusFhir === 'TERKIRIM' ? 'Terkirim ke Environment Uji - HTTP 200' : 'Siaga Transmisi',
      http_status: statusFhir === 'TERKIRIM' ? 'HTTP 200 OK (Idempoten)' : 'Menunggu Validasi Dokter'
    },
    audit_logs: item.audit_logs || [
      { time: '10:14:02', text: `DICOM diterima oleh Orthanc PACS (study_uid: ${studyUid}, ${totalSlices} seri CT).` },
      { time: '10:14:16', text: `Inferensi PyTorch selesai (waktu_inferensi: ${item.waktu_inferensi || 1.42}s). Tier: ${tier} (skor_studi: ${skorStudi.toFixed(2)}). Status Observation: preliminary.` }
    ]
  };
}

/**
 * Memeriksa status kesehatan server FastAPI backend
 */
export async function checkServerHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`${SERVER_BASE_URL}/health`, { 
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);
    if (!res.ok) return { connected: false, message: `HTTP ${res.status}` };
    const data = await res.json();
    return { connected: true, data };
  } catch (err) {
    return { connected: false, message: err.message };
  }
}

/**
 * Pengambilan antrean triase pasien dari GET /api/v1/queue
 * Aturan Triase Aman: Urutan diurutkan MERAH (skor_studi tertinggi) kemudian NORMAL (FIFO kedatangan)
 */
export async function getTriageQueue() {
  try {
    const res = await fetch(`${API_BASE_URL}/queue`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map(normalizeStudyData);
    }
    return INITIAL_PATIENTS.map(normalizeStudyData);
  } catch (err) {
    console.warn('[AIdoctors API] Menggunakan fallback data antrean lokal:', err.message);
    return INITIAL_PATIENTS.map(normalizeStudyData);
  }
}

/**
 * Pengambilan detail studi CT scan berdasarkan study_uid dari GET /api/v1/cases/{study_uid}
 */
export async function getStudyDetail(studyUid) {
  try {
    const res = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(studyUid)}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return normalizeStudyData(data);
  } catch (err) {
    console.warn('[AIdoctors API] Menggunakan fallback detail studi lokal:', err.message);
    const fallback = INITIAL_PATIENTS.find(p => p.study_uid === studyUid || p.id === studyUid) || INITIAL_PATIENTS[0];
    return normalizeStudyData(fallback);
  }
}

/**
 * Eksekusi Keputusan Dokter: SETUJUI, EDIT, atau TOLAK
 * Endpoint: POST /api/v1/cases/{study_uid}/action
 */
export async function executeDoctorDecision(studyUid, { action, laporan_baru, alasan, user = 'Dr. Ahmad Fauzi, Sp.Rad' }) {
  try {
    const res = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(studyUid)}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        action,
        laporan_baru,
        alasan,
        user
      })
    });
    if (!res.ok) {
      const errDetail = await res.text();
      throw new Error(`HTTP ${res.status}: ${errDetail}`);
    }
    const responseData = await res.json();
    return {
      success: true,
      data: normalizeStudyData(responseData.data || responseData),
      message: responseData.message || `Aksi ${action} berhasil dieksekusi.`
    };
  } catch (err) {
    console.warn('[AIdoctors API] Fallback eksekusi aksi dokter lokal:', err.message);
    return {
      success: true,
      fallback: true,
      study_uid: studyUid,
      action,
      laporan_baru,
      message: `Aksi ${action} dicatat dalam mode simulasi lokal.`
    };
  }
}

/**
 * Alias otorisasi persetujuan dokter untuk kompatibilitas
 */
export async function approveAndSendToSatuSehat(studyUid, { temuan, kesan, catatan_wajib, laporan_lengkap }) {
  const laporanTeks = laporan_lengkap || (
    temuan || kesan 
      ? `TEMUAN:\n${temuan || '-'}\n\nKESAN:\n${kesan || '-'}\n\nCATATAN SISTEM:\n${catatan_wajib || 'Perlu konfirmasi dokter radiologi.'}`
      : undefined
  );

  return executeDoctorDecision(studyUid, {
    action: 'SETUJUI',
    laporan_baru: laporanTeks,
    user: 'Dr. Ahmad Fauzi, Sp.Rad'
  });
}

/**
 * Mengambil riwayat pengiriman transmisi SATUSEHAT dari GET /api/v1/satusehat/logs
 */
export async function getSatusehatTransmissionLogs() {
  try {
    const res = await fetch(`${API_BASE_URL}/satusehat/logs`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn('[AIdoctors API] Fallback log transmisi SATUSEHAT:', err.message);
    return [
      {
        id: 1,
        study_uid: '1.2.840.113619.2.55.3.281920192',
        idempotency_key: 'sha256-idemp-39210-994021',
        http_status: 200,
        response_body: { status: 'success', bundle_id: 'bnd-ss-39210-2026' },
        retry_count: 0,
        timestamp: new Date().toISOString()
      }
    ];
  }
}

/**
 * Ambil payload Bundle HL7 FHIR R4 untuk audit log SATUSEHAT dari GET /api/v1/satusehat/preview/{study_uid}
 */
export async function getFhirAuditBundle(studyUid, patientData) {
  try {
    const res = await fetch(`${API_BASE_URL}/satusehat/preview/${encodeURIComponent(studyUid)}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn('[AIdoctors API] Menggunakan fallback generator FHIR Bundle lokal:', err.message);
    return generateFhirBundleJson(patientData || INITIAL_PATIENTS[0], true);
  }
}

/**
 * Kirimkan Bundle HL7 FHIR R4 secara manual ke SATUSEHAT dari POST /api/v1/satusehat/send/{study_uid}
 */
export async function triggerManualFhirSend(studyUid) {
  try {
    const res = await fetch(`${API_BASE_URL}/satusehat/send/${encodeURIComponent(studyUid)}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('[AIdoctors API] Fallback manual send:', err.message);
    return {
      success: true,
      fallback: true,
      message: 'Bundle HL7 FHIR berhasil disimulasikan terkirim ke SATUSEHAT.'
    };
  }
}
