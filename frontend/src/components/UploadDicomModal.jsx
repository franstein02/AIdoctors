import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Server, 
  Cpu, 
  CheckCircle2, 
  Layers, 
  Activity, 
  Brain, 
  AlertTriangle,
  Play
} from 'lucide-react';
import { SIMULATED_UPLOAD_PRESETS } from '../data/mockData';

export default function UploadDicomModal({ isOpen, onClose, onStudyAdded }) {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { title: 'Orthanc Mini-PACS Intake', desc: 'Menerima berkas DICOM via C-STORE / STOW-RS (Port 8042)...' },
    { title: 'Normalisasi Hounsfield Unit (HU)', desc: 'Ekstraksi 3 window: Brain, Subdural, & Bone Window...' },
    { title: 'Inferensi PyTorch CNN (EfficientNet-B0)', desc: 'Klasifikasi multi-label 6-kelas & kalkulasi Grad-CAM...' },
    { title: 'Smart Triaging & SATUSEHAT Mapping', desc: 'Penentuan prioritas Tier & penyusunan draf FHIR Observation...' }
  ];

  const handleStartInference = () => {
    setIsProcessing(true);
    setProgress(0);
    setCurrentStep(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = prev + 5;
        if (next >= 75) setCurrentStep(3);
        else if (next >= 50) setCurrentStep(2);
        else if (next >= 25) setCurrentStep(1);
        return next;
      });
    }, 120);

    setTimeout(() => {
      setIsProcessing(false);
      const preset = SIMULATED_UPLOAD_PRESETS[selectedPresetIndex];
      const newStudyId = `std-00${Math.floor(200 + Math.random() * 800)}`;
      
      const newPatient = {
        id: newStudyId,
        study_uid: `1.2.840.113619.2.55.3.${Math.floor(100000000 + Math.random() * 900000000)}`,
        nama_pasien: preset.nama,
        usia: preset.usia,
        jenis_kelamin: preset.gender,
        no_rm: `RM-994${Math.floor(100 + Math.random() * 899)}`,
        modalitas: "CT Kepala Non-Kontras",
        tanggal: "15 Okt 2026, Baru saja",
        tier: preset.tier,
        tier_label: preset.tier === 'MERAH' ? 'Darurat' : 'Normal',
        skor_studi: preset.skor_studi,
        tingkat_keparahan: preset.tier === 'MERAH' ? (preset.skor_studi > 0.9 ? 'Sangat Tinggi' : 'Tinggi') : 'Rendah',
        subtipe_dominan: preset.subtipe,
        skor_subtipe: preset.skor_subtipe,
        waktu_tunggu: "01 Menit",
        waktu_tunggu_menit: 1,
        status: "Belum Dibaca",
        total_slices: 32,
        current_slice: preset.irisan_kunci[0]?.slice || 16,
        irisan_kunci: preset.irisan_kunci,
        lesion_type: preset.lesion_type,
        draf_laporan: {
          temuan: preset.temuan,
          kesan: preset.kesan,
          catatan_wajib: "Perlu konfirmasi dan validasi dokter spesialis radiologi."
        },
        fhir_ids: {
          patient: `pat-ss-${Math.floor(10000 + Math.random() * 90000)}`,
          encounter: `enc-ss-${Math.floor(10000 + Math.random() * 90000)}`,
          serviceRequest: `sr-ss-${Math.floor(10000 + Math.random() * 90000)}`,
          imagingStudy: `img-ss-${Math.floor(10000 + Math.random() * 90000)}`,
          observation: `obs-ss-${Math.floor(10000 + Math.random() * 90000)}`,
          diagnosticReport: `dr-ss-${Math.floor(10000 + Math.random() * 90000)}`
        },
        audit_metrics: {
          waktu_inferensi: "13.4 Detik",
          target_latensi: "< 60 Detik",
          status_target: "Memenuhi Target (< 60 Detik)",
          versi_model: "EfficientNet-B0 v1.2",
          ambang_triase: 0.50,
          arsitektur: "CNN Multi-label 6-Class + Grad-CAM",
          status_konektor: "Terkirim ke Environment Uji",
          http_status: "HTTP 200 OK (Idempoten)"
        },
        audit_logs: [
          { time: "Baru saja", text: `DICOM diterima oleh Orthanc PACS (study_uid: ${newStudyId}).` },
          { time: "Baru saja", text: `Inferensi PyTorch CNN selesai (13.4s). Skor: ${preset.skor_studi}. Tier: ${preset.tier}.` },
          { time: "Baru saja", text: preset.tier === 'MERAH' ? 'Smart Triaging: Kasus dinaikkan ke urutan teratas antrean prioritas.' : 'Smart Triaging: Kasus ditempatkan pada antrean normal sesuai waktu kedatangan.' }
        ]
      };

      onStudyAdded(newPatient);
      onClose();
    }, 2800);
  };

  if (!isOpen) return null;

  const currentPreset = SIMULATED_UPLOAD_PRESETS[selectedPresetIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header Modal */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/30 text-red-400 flex items-center justify-center border border-red-500/40">
              <Upload className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold m-0 leading-none">
                Simulasi Unggah Berkas DICOM Baru
              </h3>
              <p className="text-[11px] text-slate-400 m-0 mt-0.5">
                Orthanc Mini-PACS Intake & Pipeline AI Smart Triaging AIdoctors
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Preset Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Pilih Skenario Kasus CT Scan Pasien:
            </label>
            <div className="space-y-2">
              {SIMULATED_UPLOAD_PRESETS.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => !isProcessing && setSelectedPresetIndex(idx)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedPresetIndex === idx
                      ? 'border-red-500 bg-red-50/70 shadow-sm ring-1 ring-red-400'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                  } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {p.label}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      p.tier === 'MERAH' ? 'bg-red-600 text-white' : 'bg-slate-600 text-white'
                    }`}>
                      {p.tier}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1 flex items-center space-x-2">
                    <span>Pasien: <strong>{p.nama}</strong> ({p.usia} Th / {p.gender})</span>
                    <span>•</span>
                    <span>Subtipe AI: <strong>{p.subtipe}</strong></span>
                    <span>•</span>
                    <span>Skor: <strong>{p.skor_studi}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Info Preview */}
          <div className="bg-slate-900 text-slate-300 p-3 rounded-xl text-xs space-y-1.5 font-mono border border-slate-800">
            <div className="flex items-center justify-between text-cyan-400 text-[11px]">
              <span className="flex items-center space-x-1">
                <Server className="w-3.5 h-3.5" />
                <span>Target PACS: Orthanc DICOM Server (Port 8042)</span>
              </span>
              <span>Modalitas: CT AXIAL</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Pipeline: Pydicom Windowing &rarr; PyTorch EfficientNet-B0 &rarr; Smart Triaging &rarr; HL7 FHIR R4
            </div>
          </div>

          {/* Progress Section when processing */}
          {isProcessing && (
            <div className="space-y-3 pt-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <span className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-red-600 animate-spin" />
                  <span>{steps[currentStep].title}</span>
                </span>
                <span className="font-mono text-red-600">{progress}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 h-full rounded-full transition-all duration-150"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              <div className="text-[11px] text-slate-500 italic">
                {steps[currentStep].desc}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Batal
          </button>

          <button
            onClick={handleStartInference}
            disabled={isProcessing}
            className="flex items-center space-x-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-md shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isProcessing ? 'Sedang Memproses...' : 'Mulai Analisis AI & Triase'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
