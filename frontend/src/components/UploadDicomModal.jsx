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
import { apiService } from '../services/api';

export default function UploadDicomModal({ isOpen, onClose, onStudyAdded }) {
  const [activeTab, setActiveTab] = useState('file'); // 'file' | 'preset'
  const [selectedFile, setSelectedFile] = useState(null);
  const [patientName, setPatientName] = useState('');
  const [noRm, setNoRm] = useState('');
  const [patientAge, setPatientAge] = useState(54);
  const [patientGender, setPatientGender] = useState('Laki-laki');

  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);

  const steps = [
    { title: 'Intake Berkas CT / NIfTI', desc: 'Menerima dan memvalidasi berkas volume CT scan...' },
    { title: 'Normalisasi Hounsfield Unit (HU)', desc: 'Ekstraksi 3 window medis: Brain, Subdural, & Bone Window...' },
    { title: 'Inferensi PyTorch CNN (EfficientNet-B0)', desc: 'Klasifikasi multi-label 6-kelas & kalkulasi Grad-CAM...' },
    { title: 'Smart Triaging & SATUSEHAT Mapping', desc: 'Penentuan prioritas Tier & penyusunan draf laporan radiologi...' }
  ];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMessage(null);
      if (!patientName) {
        const base = file.name.replace(/\.[^/.]+$/, "").replace(/\.nii$/, "");
        setPatientName(`Pasien (${base})`);
      }
      if (!noRm) {
        setNoRm(`RM-${Math.floor(100000 + Math.random() * 900000)}`);
      }
    }
  };

  const handleStartInference = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProgress(0);
    setCurrentStep(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90; // Tahan di 90% sampai API selesai
        const next = prev + 10;
        if (next >= 75) setCurrentStep(3);
        else if (next >= 50) setCurrentStep(2);
        else if (next >= 25) setCurrentStep(1);
        return next;
      });
    }, 150);

    try {
      if (activeTab === 'file') {
        if (!selectedFile) {
          clearInterval(interval);
          setIsProcessing(false);
          setErrorMessage('Silakan pilih berkas .nii / .nii.gz terlebih dahulu.');
          return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('patient_name', patientName || 'Pasien Baru');
        formData.append('nama_pasien', patientName || 'Pasien Baru');
        formData.append('no_rm', noRm || `RM-${Math.floor(100000 + Math.random() * 900000)}`);
        formData.append('usia', String(patientAge || 50));
        formData.append('jenis_kelamin', patientGender || 'Laki-laki');

        const result = await apiService.uploadCtScan(formData);
        
        clearInterval(interval);
        setProgress(100);
        setCurrentStep(3);

        setTimeout(() => {
          setIsProcessing(false);
          onStudyAdded(result);
          onClose();
        }, 500);
      } else {
        // Mode Preset Simulasi Cepat
        setTimeout(() => {
          clearInterval(interval);
          setIsProcessing(false);
          const preset = SIMULATED_UPLOAD_PRESETS[selectedPresetIndex];
          const newStudyId = `std-00${Math.floor(200 + Math.random() * 800)}`;
          
          const newPatient = {
            id: newStudyId,
            study_uid: `1.2.840.113619.2.55.3.${Math.floor(100000000 + Math.random() * 900000000)}`,
            nama_pasien: preset.nama,
            patient_name: preset.nama,
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
            status_pemeriksaan: "MENUNGGU_VALIDASI",
            status_fhir: "BELUM_DIKIRIM",
            total_slices: 32,
            current_slice: preset.irisan_kunci[0]?.slice || 16,
            irisan_kunci: preset.irisan_kunci,
            lesion_type: preset.lesion_type,
            draf_laporan: {
              temuan: preset.temuan,
              kesan: preset.kesan,
              catatan_wajib: "Perlu konfirmasi dan validasi dokter spesialis radiologi."
            }
          };

          onStudyAdded(newPatient);
          onClose();
        }, 1500);
      }
    } catch (err) {
      clearInterval(interval);
      setIsProcessing(false);
      setErrorMessage(`Gagal memproses unggahan: ${err.message}`);
    }
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
                Unggah & Analisis Berkas CT Scan (Real-time AI)
              </h3>
              <p className="text-[11px] text-slate-400 m-0 mt-0.5">
                Intake Citra NIfTI / DICOM &rarr; Pipeline PyTorch EfficientNet-B0 &rarr; Smart Triaging
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
          {/* Tab Navigasi */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => !isProcessing && setActiveTab('file')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 ${
                activeTab === 'file'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Unggah Berkas NIfTI (.nii / .nii.gz)
            </button>
            <button
              type="button"
              onClick={() => !isProcessing && setActiveTab('preset')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 ${
                activeTab === 'preset'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Simulasi Skenario Kasus Cepat
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'file' ? (
            <div className="space-y-3.5">
              {/* File Dropzone */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Pilih Berkas Citra CT Kepala:
                </label>
                <label className="border-2 border-dashed border-slate-300 hover:border-red-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-red-50/30 transition-all text-center">
                  <input
                    type="file"
                    accept=".nii,.nii.gz,.dcm"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                    className="hidden"
                  />
                  <Upload className="w-7 h-7 text-red-600 mb-1.5" />
                  {selectedFile ? (
                    <div>
                      <p className="text-xs font-bold text-slate-900 m-0">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-emerald-600 m-0 mt-0.5 font-semibold">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Berkas siap dianalisis real-time
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-slate-700 m-0">
                        Klik atau seret berkas NIfTI (.nii, .nii.gz) ke sini
                      </p>
                      <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                        Volume aksial CT scan kepala 3D
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {/* Data Pasien Form */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nama Pasien:</label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Contoh: Tn. Bambang"
                    disabled={isProcessing}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">No. Rekam Medis (RM):</label>
                  <input
                    type="text"
                    value={noRm}
                    onChange={(e) => setNoRm(e.target.value)}
                    placeholder="Contoh: RM-994102"
                    disabled={isProcessing}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Usia (Tahun):</label>
                  <input
                    type="number"
                    value={patientAge}
                    onChange={(e) => setPatientAge(Number(e.target.value))}
                    disabled={isProcessing}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Jenis Kelamin:</label>
                  <select
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value)}
                    disabled={isProcessing}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* Preset Selector */
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
          )}

          {/* Technical Info Preview */}
          <div className="bg-slate-900 text-slate-300 p-3 rounded-xl text-xs space-y-1.5 font-mono border border-slate-800">
            <div className="flex items-center justify-between text-cyan-400 text-[11px]">
              <span className="flex items-center space-x-1">
                <Server className="w-3.5 h-3.5" />
                <span>Engine: PyTorch EfficientNet-B0 (Multi-label 6-Class)</span>
              </span>
              <span>Modalitas: CT Aksial</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Pipeline: 3-Windowing HU (40/80, 80/200, 40/380) &rarr; Inferensi Dinamis &rarr; Smart Triaging &rarr; HL7 FHIR R4
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
