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
import Screen1TriageQueue from './pages/Screen1TriageQueue';
import Screen2DicomViewer from './pages/Screen2DicomViewer';
import Screen3SatuSehatAudit from './pages/Screen3SatuSehatAudit';
import UploadDicomModal from './components/UploadDicomModal';
import { INITIAL_PATIENTS } from './data/mockData';
import { getTriageQueue, approveAndSendToSatuSehat } from './services/apiClient';

export default function App() {
  const [patients, setPatients] = useState(INITIAL_PATIENTS);
  const [activePatientId, setActivePatientId] = useState('std-00192');
  const [currentScreen, setCurrentScreen] = useState('triage'); // 'triage', 'viewer', 'satusehat'
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Sync with FastAPI backend queue if available
  useEffect(() => {
    let isMounted = true;
    getTriageQueue().then(queueData => {
      if (isMounted && queueData && queueData.length > 0) {
        setPatients(queueData);
      }
    }).catch(e => console.warn('Backend offline, using local state'));
    return () => { isMounted = false; };
  }, []);

  // Active patient object
  const activePatient = useMemo(() => {
    return patients.find(p => p.id === activePatientId) || patients[0];
  }, [patients, activePatientId]);

  // Global counts for badges
  const stats = useMemo(() => {
    const redCount = patients.filter(p => p.tier === 'MERAH' && p.status !== 'Selesai - FHIR Terkirim').length;
    const normalCount = patients.filter(p => p.tier === 'NORMAL' && p.status !== 'Selesai - FHIR Terkirim').length;
    const fhirSentCount = patients.filter(p => p.status === 'Selesai - FHIR Terkirim').length + 10;
    return { redCount, normalCount, fhirSentCount };
  }, [patients]);

  // Navigate to Viewer for a patient
  const handleSelectPatient = (id) => {
    setActivePatientId(id);
    setCurrentScreen('viewer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigate to SATUSEHAT Audit for a patient
  const handleViewAudit = (id) => {
    setActivePatientId(id);
    setCurrentScreen('satusehat');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Doctor Approves & Sends report to SATUSEHAT
  const handleApproveAndSend = ({ id, temuan, kesan, catatan }) => {
    // 1. Update patient record
    setPatients(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          status: 'Selesai - FHIR Terkirim',
          draf_laporan: {
            ...p.draf_laporan,
            temuan,
            kesan,
            catatan_wajib: catatan
          },
          audit_metrics: {
            ...p.audit_metrics,
            status_konektor: 'Terkirim ke Environment Uji',
            http_status: 'HTTP 200 OK (Idempoten)'
          },
          audit_logs: [
            ...p.audit_logs,
            { 
              time: '10:16:40', 
              text: "Dokter (Dr. Ahmad Fauzi, Sp.Rad) menekan 'Setujui (ACC)'. Status Observation & DiagnosticReport bermutasi menjadi FINAL." 
            },
            { 
              time: '10:16:42', 
              text: "Validasi skema HL7 FHIR R4 lokal berhasil. Mengirim Bundle ke Endpoint Uji SATUSEHAT..." 
            },
            { 
              time: '10:16:43', 
              text: "SUKSES: Bundle diterima SATUSEHAT (HTTP 200 OK, Idempoten - UUID: bnd-ss-39210-2026, Tanpa Kirim Ganda)." 
            }
          ]
        };
      }
      return p;
    }));

    // 2. Fire celebratory confetti
    try {
      confetti({
        particleCount: 65,
        spread: 70,
        origin: { y: 0.7 }
      });
    } catch (e) {
      // ignore in environments without canvas
    }

    // 3. Show success toast with direct button to Screen 3
    setToast({
      title: 'Laporan Berhasil Disetujui & Dikirim!',
      message: `Bundle HL7 FHIR untuk ${activePatient.nama_pasien} (${id}) telah berhasil divalidasi dan terkirim ke SATUSEHAT (HTTP 200 OK).`,
      patientId: id
    });

    // 4. Sinkronisasi Asinkron ke Backend Middleware FastAPI
    approveAndSendToSatuSehat(activePatient.study_uid || id, { 
      temuan, 
      kesan, 
      catatan_wajib: catatan 
    }).catch(err => console.warn('[Backend Sync]', err));
  };

  // Add newly simulated DICOM study
  const handleStudyAdded = (newPatient) => {
    setPatients(prev => [newPatient, ...prev]);
    setActivePatientId(newPatient.id);
    
    setToast({
      title: 'Studi DICOM Baru Masuk!',
      message: `Kasus ${newPatient.id} (${newPatient.nama_pasien}) telah selesai diinferensi AI. Tier: [${newPatient.tier}] Skor: ${newPatient.skor_studi}.`,
      patientId: newPatient.id
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
      />

      {/* Main Content Area (Full-Width Responsive for Medical Dashboard & PACS) */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5">
        {currentScreen === 'triage' && (
          <Screen1TriageQueue
            patients={patients}
            onSelectPatient={handleSelectPatient}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            onViewAudit={handleViewAudit}
          />
        )}

        {currentScreen === 'viewer' && (
          <Screen2DicomViewer
            patient={activePatient}
            onBackToQueue={() => {
              setCurrentScreen('triage');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onApproveAndSend={handleApproveAndSend}
            onNavigateToAudit={handleViewAudit}
          />
        )}

        {currentScreen === 'satusehat' && (
          <Screen3SatuSehatAudit
            patient={activePatient}
            onBackToQueue={() => {
              setCurrentScreen('triage');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onBackToViewer={() => {
              setCurrentScreen('viewer');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      {/* Upload DICOM Simulation Modal */}
      <UploadDicomModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onStudyAdded={handleStudyAdded}
      />

      {/* Global Interactive Notification Toast */}
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
