import React, { useState } from 'react';
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle, 
  Edit3, 
  XCircle, 
  Send, 
  Share2, 
  Brain, 
  FileCheck, 
  Sparkles, 
  FileText, 
  Info,
  Layers,
  ChevronRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import DicomCanvasViewer from './DicomCanvasViewer';

export default function Screen2DicomViewer({
  patient,
  onBackToQueue,
  onApproveAndSend,
  onNavigateToAudit
}) {
  const [currentSlice, setCurrentSlice] = useState(patient.current_slice || 18);
  const [showHeatmap, setShowHeatmap] = useState(patient.tier === 'MERAH');
  const [windowMode, setWindowMode] = useState('brain');

  // Report editor state
  const [isEditing, setIsEditing] = useState(false);
  const [reportFindings, setReportFindings] = useState(patient.draf_laporan?.temuan || '');
  const [reportImpression, setReportImpression] = useState(patient.draf_laporan?.kesan || '');
  const [reportNote, setReportNote] = useState(patient.draf_laporan?.catatan_wajib || 'Perlu konfirmasi dokter radiologi.');
  const [isRejected, setIsRejected] = useState(false);
  const [saveToast, setSaveToast] = useState('');

  // Subtype metadata list
  const subtypesList = [
    { key: 'subdural', label: 'Subdural Hemorrhage (SDH)', score: patient.skor_subtipe?.subdural || 0 },
    { key: 'intraparenkim', label: 'Intraparenchymal (ICH)', score: patient.skor_subtipe?.intraparenkim || 0 },
    { key: 'epidural', label: 'Epidural Hemorrhage (EDH)', score: patient.skor_subtipe?.epidural || 0 },
    { key: 'subaraknoid', label: 'Subarachnoid Hemorrhage (SAH)', score: patient.skor_subtipe?.subaraknoid || 0 },
    { key: 'intraventrikel', label: 'Intraventricular (IVH)', score: patient.skor_subtipe?.intraventrikel || 0 }
  ];

  // Handle Reject Draf AI: Clear template to blank for manual typing
  const handleRejectDraft = () => {
    setIsRejected(true);
    setIsEditing(true);
    setReportFindings('');
    setReportImpression('');
    setReportNote('Draf AI ditolak oleh dokter spesialis radiologi. Laporan disusun manual.');
    setSaveToast('Draf AI telah ditolak & dikosongkan. Silakan isi laporan manual.');
    setTimeout(() => setSaveToast(''), 4000);
  };

  // Handle Approve and Send
  const handleApprove = () => {
    onApproveAndSend({
      id: patient.id,
      temuan: reportFindings,
      kesan: reportImpression,
      catatan: reportNote
    });
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-12">
      {/* 1. Header Bar Kasus & Navigasi Cepat */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToQueue}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Antrean</span>
          </button>

          <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

          <div className="flex items-center space-x-2">
            <span className="font-mono font-bold text-slate-900 text-sm">
              Kasus: {patient.id}
            </span>
            <span className="text-slate-400">|</span>
            <span className="font-bold text-slate-800 text-sm">
              Pasien: {patient.nama_pasien}
            </span>
            <span className="text-slate-500 text-xs">
              ({patient.usia} Thn, {patient.jenis_kelamin})
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <span className="text-xs text-slate-500 font-medium">Status Triase:</span>
          {patient.tier === 'MERAH' ? (
            <span className="inline-flex items-center space-x-1 bg-[#DC2626] text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-sm shadow-red-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
              <span>[ MERAH ] (Darurat)</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 bg-slate-700 text-white text-xs font-semibold px-2.5 py-1 rounded-md">
              <span>[ NORMAL ]</span>
            </span>
          )}

          <button
            onClick={() => onNavigateToAudit(patient.id)}
            className="text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg font-semibold flex items-center space-x-1 transition-colors"
          >
            <span>Status SATUSEHAT</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Banner Peringatan Wajib Etika Medis (Warna Kuning/Oranye Terang #F59E0B) */}
      <div className="bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl flex items-center justify-between shadow-sm border border-amber-400/80">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-black/15 flex items-center justify-center font-bold">
            <AlertTriangle className="w-4 h-4 text-slate-950" />
          </div>
          <div className="text-xs font-medium">
            <strong className="font-extrabold uppercase tracking-wide">
              PERINGATAN KLINIS:
            </strong>{' '}
            Dugaan AI, bukan diagnosis. Keputusan klinis dan penetapan diagnosa akhir sepenuhnya berada pada dokter spesialis radiologi yang berwenang.
          </div>
        </div>
        <span className="hidden md:inline-block bg-black/10 px-2 py-0.5 rounded text-[11px] font-mono font-semibold">
          AI Assistive Mode
        </span>
      </div>

      {/* 3. Split-screen Layout: 60% Left DICOM Viewer, 40% Right AI Score & Report Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[640px]">
        {/* ==================== KOLOM KIRI (60%): DICOM VIEWER ==================== */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <DicomCanvasViewer
            patient={patient}
            currentSlice={currentSlice}
            setCurrentSlice={setCurrentSlice}
            showHeatmap={showHeatmap}
            setShowHeatmap={setShowHeatmap}
            windowMode={windowMode}
            setWindowMode={setWindowMode}
          />
        </div>

        {/* ==================== KOLOM KANAN (40%): AI SCORES & REPORT ==================== */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Panel Probabilitas AI */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <Brain className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900 m-0">
                  Panel Skor Deteksi AI (0.00 – 1.00)
                </h3>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                PyTorch EfficientNet-B0
              </span>
            </div>

            {/* Skor Utama Studi (skor_studi) */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              patient.tier === 'MERAH'
                ? 'bg-red-50/70 border-red-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <span className="text-xs font-semibold text-slate-600 block">
                  Skor Studi Umum (skor_studi)
                </span>
                <span className="text-[11px] text-slate-500">
                  Ambang batas triase: <strong>0.50</strong>
                </span>
              </div>

              <div className="flex items-baseline space-x-2">
                <span className={`text-2xl font-black font-mono ${
                  patient.tier === 'MERAH' ? 'text-red-600' : 'text-slate-700'
                }`}>
                  {patient.skor_studi.toFixed(2)}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  patient.tier === 'MERAH'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {patient.tier} ({patient.tingkat_keparahan})
                </span>
              </div>
            </div>

            {/* Rincian 5 Skor Subtipe (skor_subtipe) */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Rincian 5 Skor Subtipe Perdarahan:</span>
                <span className="text-slate-400 font-mono font-normal text-[10px]">Multi-label CNN</span>
              </div>

              <div className="space-y-2">
                {subtypesList.map((sub) => {
                  const isDominant = sub.key === patient.lesion_type || (patient.tier === 'MERAH' && sub.score >= 0.7);
                  return (
                    <div key={sub.key} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${
                          isDominant ? 'text-red-700 font-bold' : 'text-slate-700'
                        }`}>
                          {sub.label}
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          {sub.score.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isDominant
                              ? 'bg-gradient-to-r from-amber-500 to-red-600'
                              : sub.score >= 0.3
                              ? 'bg-amber-400'
                              : 'bg-slate-300'
                          }`}
                          style={{ width: `${Math.max(4, sub.score * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Kotak Editor Draf Laporan (draf_laporan berbasis templat terstruktur) */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex-1 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900 m-0">
                  Editor Draf Laporan Radiologi
                </h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                isEditing
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {isEditing ? 'Mode Sunting Aktif' : 'Draf Templat Terstruktur'}
              </span>
            </div>

            {saveToast && (
              <div className="bg-amber-50 text-amber-900 text-xs p-2 rounded border border-amber-200 flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span>{saveToast}</span>
              </div>
            )}

            {/* Bagian Temuan */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                <span>Temuan Radiologis (Findings):</span>
                <span className="text-[10px] text-slate-400 font-normal">Rujukan Irisan Kunci</span>
              </label>
              {isEditing ? (
                <textarea
                  rows={4}
                  value={reportFindings}
                  onChange={(e) => setReportFindings(e.target.value)}
                  placeholder="Ketik temuan radiologi..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              ) : (
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed max-h-36 overflow-y-auto">
                  {reportFindings || <span className="text-slate-400 italic">Draf dikosongkan. Klik 'Edit Draf' untuk menulis temuan.</span>}
                </div>
              )}
            </div>

            {/* Bagian Kesan */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                Kesan (Impression / Conclusion):
              </label>
              {isEditing ? (
                <textarea
                  rows={2}
                  value={reportImpression}
                  onChange={(e) => setReportImpression(e.target.value)}
                  placeholder="Ketik kesimpulan kesan..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              ) : (
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 font-semibold leading-relaxed">
                  {reportImpression || <span className="text-slate-400 font-normal italic">Kesan kosong.</span>}
                </div>
              )}
            </div>

            {/* Catatan Wajib Sistem */}
            <div className="bg-slate-100 p-2 rounded-lg border border-slate-200 text-[11px] text-slate-600 italic">
              <strong>Catatan Wajib:</strong> {reportNote}
            </div>

            {/* Tombol Keputusan & Validasi Dokter */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Aksi Validasi Dokter Radiologi:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Tombol Setujui (ACC) & Kirim ke SATUSEHAT */}
                <button
                  onClick={handleApprove}
                  className="sm:col-span-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 active:scale-98 transition-all"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-200" />
                  <span>Setujui (ACC) & Kirim ke SATUSEHAT</span>
                </button>

                {/* 2. Tombol Edit Draf */}
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`border font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors ${
                    isEditing
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-300'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Simpan Suntingan' : 'Edit Draf'}</span>
                </button>

                {/* 3. Tombol Tolak Draf AI */}
                <button
                  onClick={handleRejectDraft}
                  className="border border-red-300 bg-white hover:bg-red-50 text-red-600 font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Tolak Draf AI</span>
                </button>

                {/* Tombol Reset ke Templat Asli */}
                <button
                  onClick={() => {
                    setIsRejected(false);
                    setIsEditing(false);
                    setReportFindings(patient.draf_laporan?.temuan || '');
                    setReportImpression(patient.draf_laporan?.kesan || '');
                    setReportNote(patient.draf_laporan?.catatan_wajib || 'Perlu konfirmasi dokter radiologi.');
                  }}
                  title="Kembalikan templat awal AI"
                  className="border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <span>Reset Templat</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
