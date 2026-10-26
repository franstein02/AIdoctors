// frontend/src/services/api.js - Layanan Pemanggil API Terpusat AIdoctors
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const apiService = {
  // Layar 1: Ambil antrean triase pasien
  async getQueue() {
    const res = await fetch(`${API_BASE_URL}/queue`);
    if (!res.ok) throw new Error(`Gagal memuat antrean: HTTP ${res.status}`);
    return await res.json();
  },

  // Layar 2: Ambil rincian studi dan hasil AI satu kasus
  async getCaseDetail(studyUid) {
    const res = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(studyUid)}`);
    if (!res.ok) throw new Error(`Gagal memuat detail kasus: HTTP ${res.status}`);
    return await res.json();
  },

  // Layar 2: Kirim keputusan aksi dokter (SETUJUI, EDIT, atau TOLAK)
  async submitDoctorAction(studyUid, action, reportText, doctorNotes = '') {
    const res = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(studyUid)}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action, // 'SETUJUI' | 'EDIT' | 'TOLAK'
        report_text: reportText,
        doctor_notes: doctorNotes
      })
    });
    if (!res.ok) throw new Error(`Gagal menyimpan validasi: HTTP ${res.status}`);
    return await res.json();
  },

  // Layar 3: Ambil pratinjau Bundle JSON HL7 FHIR R4
  async getFhirPreview(studyUid) {
    const res = await fetch(`${API_BASE_URL}/satusehat/preview/${encodeURIComponent(studyUid)}`);
    if (!res.ok) throw new Error(`Gagal memuat pratinjau FHIR: HTTP ${res.status}`);
    return await res.json();
  },

  // Layar 3: Ambil riwayat audit log & status SATUSEHAT
  async getSatusehatLogs() {
    const res = await fetch(`${API_BASE_URL}/satusehat/logs`);
    if (!res.ok) throw new Error(`Gagal memuat log audit: HTTP ${res.status}`);
    return await res.json();
  },

  // Coba ulang kirim (Retry) transmisi SATUSEHAT
  async retrySendFhir(studyUid) {
    const res = await fetch(`${API_BASE_URL}/satusehat/send/${encodeURIComponent(studyUid)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`Gagal mengirim ulang FHIR: HTTP ${res.status}`);
    return await res.json();
  }
};

export default apiService;
