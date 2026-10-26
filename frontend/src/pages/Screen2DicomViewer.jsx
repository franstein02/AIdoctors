import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle, 
  Edit3, 
  XCircle, 
  Brain, 
  FileText, 
  Layers, 
  ChevronRight,
  Flame,
  Check,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import DicomCanvasViewer from '../components/DicomCanvasViewer';

export default function Screen2DicomViewer({
  patient,
  onBackToQueue,
  onApproveAndSend,
  onNavigateToAudit,
  onDoctorAction
}) {
  const [currentSlice, setCurrentSlice] = useState(patient?.current_slice || 18);
  const [showHeatmap, setShowHeatmap] = useState(patient?.tier === 'MERAH');
  const [windowMode, setWindowMode] = useState('brain');

  // Textarea Editor Draf Laporan
  const [draftText, setDraftText] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [notification, setNotification] = useState(null);
  const textareaRef = useRef(null);

  // Sync draft text whenever patient changes
  useEffect(() => {
    if (patient) {
      if (typeof patient.draf_laporan === 'string') {
        setDraftText(patient.draf_laporan);
      } else if (patient.draf_laporan && typeof patient.draf_laporan === 'object') {
        const t = patient.draf_laporan.temuan || '';
        const k = patient.draf_laporan.kesan || '';
        const c = patient.draf_laporan.catatan_wajib || patient.draf_laporan.catatan || 'Perlu konfirmasi dokter spesialis radiologi.';
        setDraftText(`TEMUAN:\n${t}\n\nKESAN:\n${k}\n\nCATATAN SISTEM:\n${c}`);
      } else {
        setDraftText(
          "TEMUAN:\nTampak gambaran densitas parenkim intrakranial dalam batas normal. Tidak tampak ekstravasasi darah akut.\n\n" +
          "KESAN:\nTidak tampak tanda-tanda perdarahan intrakranial akut.\n\n" +
          "CATATAN SISTEM:\nDugaan AI, bukan diagnosis. Perlu konfirmasi dokter spesialis radiologi."
        );
      }
      setCurrentSlice(patient.current_slice || 18);
      setShowHeatmap(patient.tier === 'MERAH');
      setIsEditMode(false);
    }
  }, [patient]);

  // Daftar 5 Subtipe Perdarahan Intrakranial
  const subtypesList = [
    { key: 'epidural', label: 'Epidural (EDH)', score: patient?.skor_subtipe?.epidural ?? 0.0 },
    { key: 'intraparenkim', label: 'Intraparenkim (ICH)', score: patient?.skor_subtipe?.intraparenkim ?? 0.0 },
    { key: 'intraventrikel', label: 'Intraventrikel (IVH)', score: patient?.skor_subtipe?.intraventrikel ?? 0.0 },
    { key: 'subaraknoid', label: 'Subaraknoid (SAH)', score: patient?.skor_subtipe?.subaraknoid ?? 0.0 },
    { key: 'subdural', label: 'Subdural (SDH)', score: patient?.skor_subtipe?.subdural ?? 0.0 },
  ];

  // Aksi 1 (Hijau): Setujui & Kirim ke SATUSEHAT
  const handleApproveAndSend = () => {
    if (onDoctorAction) {
      onDoctorAction({
        action: 'SETUJUI',
        laporan_baru: draftText,
        alasan: null
      });
    } else if (onApproveAndSend) {
      onApproveAndSend({
        id: patient.id || patient.study_uid,
        laporan_lengkap: draftText,
        temuan: draftText,
        kesan: 'Disetujui Dokter Spesialis Radiologi',
        catatan: 'Final disetujui dokter'
      });
    }

    setNotification({
      type: 'success',
      text: 'Kasus disetujui! Status Observation & DiagnosticReport bermutasi menjadi FINAL, Bundle HL7 FHIR dikirim ke SATUSEHAT.'
    });
    setTimeout(() => setNotification(null), 4500);
  };

  // Aksi 2 (Biru): Edit Draf (Mengaktifkan mode pengeditan teks templat)
  const handleToggleEdit = () => {
    const nextState = !isEditMode;
    setIsEditMode(nextState);
    if (nextState) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
      setNotification({
        type: 'info',
        text: 'Mode sunting aktif. Silakan modifikasi teks draf laporan templat sesuai telaah klinis.'
      });
      setTimeout(() => setNotification(null), 3000);
    } else {
      if (onDoctorAction) {
        onDoctorAction({
          action: 'EDIT',
          laporan_baru: draftText,
          alasan: null
        });
      }
      setNotification({
        type: 'info',
        text: 'Suntingan draf disimpan.'
      });
      setTimeout(() => setNotification(null), 2500);
    }
  };

  // Aksi 3 (Merah/Abu): Tolak Draf AI (Mengosongkan kotak draf teks agar dokter mengetik manual)
  const handleRejectDraft = () => {
    setDraftText('');
    setIsEditMode(true);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    if (onDoctorAction) {
      onDoctorAction({
        action: 'TOLAK',
        laporan_baru: '',
        alasan: 'Draf AI ditolak dokter spesialis radiologi. Disusun manual.'
      });
    }

    setNotification({
      type: 'warning',
      text: 'Draf AI ditolak dan dikosongkan. Status kasus: DITOLAK_MENUNGGU_MANUAL. Silakan ketik laporan manual.'
    });
    setTimeout(() => setNotification(null), 4500);
  };

  // Kembalikan draf templat asli bila diperlukan
  const handleResetTemplate = () => {
    if (typeof patient.draf_laporan === 'string') {
      setDraftText(patient.draf_laporan);
    } else if (patient.draf_laporan && typeof patient.draf_laporan === 'object') {
      const t = patient.draf_laporan.temuan || '';
      const k = patient.draf_laporan.kesan || '';
      const c = patient.draf_laporan.catatan_wajib || patient.draf_laporan.catatan || 'Perlu konfirmasi dokter spesialis radiologi.';
      setDraftText(`TEMUAN:\n${t}\n\nKESAN:\n${k}\n\nCATATAN SISTEM:\n${c}`);
    }
    setNotification({
      type: 'info',
      text: 'Templat draf AI dipulihkan ke kondisi awal.'
    });
    setTimeout(() => setNotification(null), 2500);
  };

  const isApproved = patient?.status_pemeriksaan === 'SELESAI_ACC' || patient?.status === 'Selesai - FHIR Terkirim';
  const targetUid = patient?.study_uid || patient?.id;

  return (
    <div className="space-y-4 animate-fadeIn pb-12">
      {/* 1. Bar Navigasi Kasus */}
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
              UID: {targetUid}
            </span>
            <span className="text-slate-400">|</span>
            <span className="font-bold text-slate-800 text-sm">
              {patient?.nama_pasien || patient?.patient_name}
            </span>
            <span className="text-slate-500 text-xs">
              ({patient?.usia || 50} Thn, {patient?.jenis_kelamin || 'Laki-laki'})
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <span className="text-xs text-slate-500 font-medium">Prioritas Triase:</span>
          {patient?.tier === 'MERAH' ? (
            <span className="inline-flex items-center space-x-1 bg-[#DC2626] text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-sm shadow-red-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
              <span>[ MERAH ] (Kritis)</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 bg-slate-700 text-white text-xs font-semibold px-2.5 py-1 rounded-md">
              <span>[ NORMAL ]</span>
            </span>
          )}

          <button
            onClick={() => onNavigateToAudit(targetUid)}
            className="text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg font-semibold flex items-center space-x-1 transition-colors"
          >
            <span>Interoperabilitas SATUSEHAT</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Banner Peringatan Medis Kuning Terang */}
      <div className="bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl flex items-center justify-between shadow-sm border border-amber-400">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-black/15 flex items-center justify-center font-bold flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-slate-950" />
          </div>
          <div className="text-xs font-medium leading-relaxed">
            <strong className="font-extrabold uppercase tracking-wide">
              PERINGATAN KLINIS:
            </strong>{' '}
            Dugaan AI, bukan diagnosis. Keputusan akhir berada pada dokter spesialis radiologi.
          </div>
        </div>
        <span className="hidden md:inline-block bg-black/10 px-2 py-0.5 rounded text-[11px] font-mono font-semibold flex-shrink-0">
          Human-in-the-Loop Mode
        </span>
      </div>

      {/* Notifikasi Toast Inline */}
      {notification && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
          notification.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : notification.type === 'warning'
            ? 'bg-amber-50 text-amber-900 border-amber-200'
            : 'bg-blue-50 text-blue-900 border-blue-200'
        }`}>
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* 3. Tata Letak Split-Screen (Kolom Kiri 60% Viewer Medis, Kolom Kanan 40% Skor & Editor) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[660px]">
        {/* ================= KOLOM KIRI (VIEWER MEDIS - LATAR GELAP #0B1120) ================= */}
        <div className="lg:col-span-7 flex flex-col h-full bg-[#0B1120] rounded-xl border border-slate-800 shadow-2xl overflow-hidden p-2">
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

        {/* ================= KOLOM KANAN: PANEL SKOR & EDITOR DRAF LAPORAN ================= */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Kartu Skor Deteksi AI */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <Brain className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900 m-0">
                  Panel Skor Deteksi AI
                </h3>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                {patient?.versi_model || 'EfficientNet-B0 v1.0'}
              </span>
            </div>

            {/* Nilai Utama skor_studi */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              patient?.tier === 'MERAH'
                ? 'bg-red-50/70 border-red-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <span className="text-xs font-semibold text-slate-600 block">
                  Nilai Utama Skor Studi (skor_studi)
                </span>
                <span className="text-[11px] text-slate-500">
                  Ambang batas triase: <strong>{patient?.ambang ? patient.ambang.toFixed(2) : '0.50'}</strong>
                </span>
              </div>

              <div className="flex items-baseline space-x-2">
                <span className={`text-2xl font-black font-mono ${
                  patient?.tier === 'MERAH' ? 'text-red-600' : 'text-slate-700'
                }`}>
                  {(typeof patient?.skor_studi === 'number' ? patient.skor_studi : 0).toFixed(2)}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  patient?.tier === 'MERAH'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {patient?.tier} ({patient?.tingkat_keparahan || (patient?.skor_studi >= 0.5 ? 'Tinggi' : 'Normal')})
                </span>
              </div>
            </div>

            {/* 5 Bilah Grafik Horizontal untuk skor_subtipe */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>5 Bilah Grafik Subtipe Perdarahan:</span>
                <span className="text-slate-400 font-mono font-normal text-[10px]">Multi-label 6-Class</span>
              </div>

              <div className="space-y-2.5">
                {subtypesList.map((sub) => {
                  const isHigh = sub.score >= 0.5;
                  return (
                    <div key={sub.key} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${
                          isHigh ? 'text-red-700 font-bold' : 'text-slate-700'
                        }`}>
                          {sub.label}
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          {sub.score.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isHigh
                              ? 'bg-gradient-to-r from-orange-500 to-red-600'
                              : sub.score >= 0.25
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

          {/* Kotak Teks Editor (textarea) Berisi draf_laporan */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex-1 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900 m-0">
                  Editor Draf Laporan Radiologi (draf_laporan)
                </h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                isEditMode
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {isEditMode ? 'Mode Edit Aktif' : 'Pratinjau Draf'}
              </span>
            </div>

            {/* Kotak Textarea Bebas Sunting */}
            <div className="flex-1 flex flex-col space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                <span>Isi Draf Laporan:</span>
                <span className="text-[10px] text-slate-400 font-normal">Dapat Disunting Bebas</span>
              </label>

              <textarea
                ref={textareaRef}
                rows={9}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Draf teks kosong. Silakan ketik laporan hasil pemeriksaan radiologi..."
                className={`w-full flex-1 p-3 rounded-lg text-xs font-mono leading-relaxed transition-all resize-y min-h-[170px] ${
                  isEditMode
                    ? 'bg-white border-2 border-blue-500 text-slate-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-400'
                    : 'bg-slate-50 border border-slate-200 text-slate-800'
                }`}
              />
            </div>

            {/* Catatan Integritas Klinis */}
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Status Dokumen: <strong>{isApproved ? 'FINAL (Telah Disetujui & Terkirim)' : 'Preliminary (Menunggu Otorisasi)'}</strong></span>
              <button
                onClick={handleResetTemplate}
                title="Pulihkan draf templat awal AI"
                className="text-slate-500 hover:text-slate-800 text-[10px] font-medium underline flex items-center space-x-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset ke Templat Awal</span>
              </button>
            </div>

            {/* 3 Tombol Keputusan Dokter di Sudut Kanan Bawah */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Keputusan Dokter Spesialis Radiologi:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Tombol Hijau: "Setujui & Kirim ke SATUSEHAT" */}
                <button
                  onClick={handleApproveAndSend}
                  className="sm:col-span-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 active:scale-98 transition-all"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-200" />
                  <span>Setujui & Kirim ke SATUSEHAT</span>
                </button>

                {/* 2. Tombol Biru: "Edit Draf" */}
                <button
                  onClick={handleToggleEdit}
                  className={`border font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors sm:col-span-2 ${
                    isEditMode
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditMode ? 'Simpan Suntingan' : 'Edit Draf'}</span>
                </button>

                {/* 3. Tombol Merah/Abu: "Tolak Draf AI" */}
                <button
                  onClick={handleRejectDraft}
                  className="border border-red-300 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors sm:col-span-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Tolak Draf AI</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
