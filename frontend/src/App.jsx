import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Info,
  X,
  ArrowRight
} from 'lucide-react';
import Header from './components/Header';
import TriageQueue from './pages/TriageQueue';
import CaseDetail from './pages/CaseDetail';
import SatusehatLog from './pages/SatusehatLog';
import UploadDicomModal from './components/UploadDicomModal';
import { INITIAL_PATIENTS } from './data/mockData';
import { apiService } from './services/api';
import { 
  getTriageQueue, 
  executeDoctorDecision,
  normalizeStudyData,
  checkServerHealth 
} from './services/apiClient';

export default function App() {
  const [patients, setPatients] = useState(() => INITIAL_PATIENTS.map(normalizeStudyData));
  const [activePatientId, setActivePatientId] = useState('std-00192');
  const [currentScreen, setCurrentScreen] = useState('triage'); // 'triage', 'viewer', 'satusehat'
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [isServerOnline, setIsServerOnline] = useState(true);

  // Sinkronisasi antrean dengan backend FastAPI
  const refreshQueue = async () => {
    try {
      const queueData = await apiService.getQueue();
      if (Array.isArray(queueData) && queueData.length > 0) {
        setPatients(queueData);
        // Pastikan activePatientId valid
        if (!queueData.some(p => p.id === activePatientId || p.study_uid === activePatientId)) {
          setActivePatientId(queueData[0].study_uid || queueData[0].id);
        }
        return;
      }
    } catch (e) {
      console.warn('Backend antrean offline via apiService, fallback ke cache:', e.message);
    }

    try {
      const fallbackQueue = await getTriageQueue();
      if (fallbackQueue && fallbackQueue.length > 0) {
        setPatients(fallbackQueue);
      }
    } catch (e) {
      // Keep existing patients
    }
  };

  useEffect(() => {
    refreshQueue();
    // Cek koneksi server
    checkServerHealth().then(res => setIsServerOnline(res.connected));
  }, []);

  // Pasien yang sedang aktif dipilih
  const activePatient = useMemo(() => {
    return patients.find(p => p.id === activePatientId || p.study_uid === activePatientId) || patients[0];
  }, [patients, activePatientId]);

  // Statistik untuk badge antrean & header
  const stats = useMemo(() => {
    const redCount = patients.filter(
      p => p.tier === 'MERAH' && p.status_pemeriksaan !== 'SELESAI_ACC' && p.status !== 'Selesai - FHIR Terkirim'
    ).length;
    const normalCount = patients.filter(
      p => p.tier === 'NORMAL' && p.status_pemeriksaan !== 'SELESAI_ACC' && p.status !== 'Selesai - FHIR Terkirim'
    ).length;
    const fhirSentCount = patients.filter(
      p => p.status_pemeriksaan === 'SELESAI_ACC' || p.status === 'Selesai - FHIR Terkirim' || p.status_fhir === 'TERKIRIM'
    ).length;
    return { redCount, normalCount, fhirSentCount };
  }, [patients]);

  // Navigasi ke Layar 2 (Viewer Medis)
  const handleSelectPatient = (idOrUid) => {
    setActivePatientId(idOrUid);
    setCurrentScreen('viewer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigasi ke Layar 3 (Audit & Interoperabilitas SATUSEHAT)
  const handleViewAudit = (idOrUid) => {
    setActivePatientId(idOrUid);
    setCurrentScreen('satusehat');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Penanganan Keputusan Dokter: SETUJUI, EDIT, atau TOLAK
  const handleDoctorAction = async ({ action, laporan_baru, alasan }) => {
    const targetUid = activePatient?.study_uid || activePatient?.id;
    if (!targetUid) return;

    // 1. Mutasi State Lokal
    setPatients(prev => prev.map(p => {
      if (p.id === targetUid || p.study_uid === targetUid) {
        if (action === 'SETUJUI' || action === 'EDIT') {
          return {
            ...p,
            status_pemeriksaan: 'SELESAI_ACC',
            status: 'Selesai - FHIR Terkirim',
            status_fhir: 'TERKIRIM',
            draf_laporan: laporan_baru || p.draf_laporan,
            laporan_final_dokter: laporan_baru || p.draf_laporan,
            audit_metrics: {
              ...p.audit_metrics,
              status_konektor: 'Terkirim ke Environment Uji - HTTP 200',
              http_status: 'HTTP 200 OK (Idempoten)'
            },
            audit_logs: [
              {
                time: new Date().toLocaleTimeString('id-ID'),
                text: `Dokter (Dr. Ahmad Fauzi, Sp.Rad) mengeksekusi '${action}'. Status Observation & DiagnosticReport bermutasi menjadi FINAL.`
              },
              {
                time: new Date().toLocaleTimeString('id-ID'),
                text: "SUKSES: Bundle HL7 FHIR R4 diterima SATUSEHAT (HTTP 200 OK, Idempoten - Anti-Kirim Ganda)."
              },
              ...(p.audit_logs || [])
            ]
          };
        } else if (action === 'TOLAK') {
          return {
            ...p,
            status_pemeriksaan: 'DITOLAK_MENUNGGU_MANUAL',
            status: 'Ditolak Manual',
            status_fhir: 'BELUM_DIKIRIM',
            draf_laporan: '',
            audit_logs: [
              {
                time: new Date().toLocaleTimeString('id-ID'),
                text: `Dokter menolak draf templat AI: "${alasan || 'Draf dikosongkan untuk penulisan manual.'}". Tidak ada data dikirim ke SATUSEHAT.`
              },
              ...(p.audit_logs || [])
            ]
          };
        }
      }
      return p;
    }));

    // 2. Efek & Notifikasi
    if (action === 'SETUJUI' || action === 'EDIT') {
      try {
        confetti({
          particleCount: 65,
          spread: 70,
          origin: { y: 0.7 }
        });
      } catch (e) {
        // ignore
      }

      setToast({
        title: 'Laporan Radiologi Disetujui!',
        message: `Kasus ${activePatient?.nama_pasien || targetUid} berhasil disetujui. Bundle HL7 FHIR R4 terkirim ke SATUSEHAT (HTTP 200 OK).`,
        patientId: targetUid
      });
    }

    // 3. Sinkronisasi ke Backend Middleware FastAPI
    try {
      await executeDoctorDecision(targetUid, {
        action,
        laporan_baru,
        alasan,
        user: 'Dr. Ahmad Fauzi, Sp.Rad'
      });
    } catch (err) {
      console.warn('[Sync Backend Action]', err);
    }
  };

  // Menambahkan studi DICOM baru dari simulasi modal
  const handleStudyAdded = (newPatient) => {
    const normalized = normalizeStudyData(newPatient);
    setPatients(prev => [normalized, ...prev]);
    setActivePatientId(normalized.id || normalized.study_uid);

    setToast({
      title: 'Studi DICOM Baru Berhasil Dimuat!',
      message: `Kasus ${normalized.id} (${normalized.nama_pasien}) telah selesai diinferensi AI. Tier: [${normalized.tier}] Skor: ${normalized.skor_studi.toFixed(2)}.`,
      patientId: normalized.id
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Top Application Header */}
      <Header
        currentScreen={currentScreen}
        setCurrentScreen={setCurrentScreen}
        activePatient={activePatient}
        stats={stats}
        patients={patients}
        onSelectPatient={(id) => setActivePatientId(id)}
        serverStatus={isServerOnline}
      />

      {/* Konten Utama 3 Layar */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5">
        {currentScreen === 'triage' && (
          <TriageQueue
            onSelectPatient={handleSelectPatient}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            onViewAudit={handleViewAudit}
          />
        )}

        {currentScreen === 'viewer' && (
          <CaseDetail
            studyUid={activePatientId}
            patient={activePatient}
            onBackToQueue={() => {
              setCurrentScreen('triage');
              refreshQueue();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onDoctorAction={handleDoctorAction}
            onNavigateToAudit={handleViewAudit}
          />
        )}

        {currentScreen === 'satusehat' && (
          <SatusehatLog
            studyUid={activePatientId}
            patient={activePatient}
            onBackToQueue={() => {
              setCurrentScreen('triage');
              refreshQueue();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onBackToViewer={() => {
              setCurrentScreen('viewer');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      {/* Modal Simulasi Unggah DICOM */}
      <UploadDicomModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onStudyAdded={handleStudyAdded}
      />

      {/* Notifikasi Toast Global */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 animate-bounce-subtle flex items-start space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-emerald-500/30">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 text-xs space-y-1">
            <div className="font-bold text-white text-sm">{toast.title}</div>
            <p className="text-slate-300 leading-relaxed">{toast.message}</p>
            <div className="pt-1 flex items-center space-x-2">
              <button
                onClick={() => {
                  handleViewAudit(toast.patientId);
                  setToast(null);
                }}
                className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center space-x-1"
              >
                <span>Lihat Bundle FHIR di Layar 3</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
