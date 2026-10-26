import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Info,
  RotateCw,
  Clock,
  ShieldCheck,
  Save
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiService } from '../services/api';
import MedicalViewer from '../components/MedicalViewer';
import { INITIAL_PATIENTS } from '../data/mockData';

export default function CaseDetail({
  studyUid,
  patient: propPatient,
  onBackToQueue,
  onNavigateToAudit,
  onDoctorAction
}) {
  const activeUid = studyUid || propPatient?.study_uid || propPatient?.id || 'std-00192';

  const [caseData, setCaseData] = useState(propPatient || null);
  const [loading, setLoading] = useState(!propPatient);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Viewer state
  const [currentSlice, setCurrentSlice] = useState(18);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [windowMode, setWindowMode] = useState('brain');

  // Textarea Editor Draf Laporan
  const [draftText, setDraftText] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [notification, setNotification] = useState(null);
  const textareaRef = useRef(null);

  // Helper untuk mengekstrak string dari draf_laporan
  const formatDraftText = (rawDraft) => {
    if (!rawDraft) {
      return (
        "TEMUAN:\nTampak gambaran densitas parenkim intrakranial dalam batas normal. Tidak tampak ekstravasasi darah akut.\n\n" +
        "KESAN:\nTidak tampak tanda-tanda perdarahan intrakranial akut.\n\n" +
        "CATATAN SISTEM:\nDugaan AI, bukan diagnosis. Perlu konfirmasi dokter spesialis radiologi."
      );
    }
    if (typeof rawDraft === 'string') return rawDraft;
    if (typeof rawDraft === 'object') {
      const t = rawDraft.temuan || '';
      const k = rawDraft.kesan || '';
      const c = rawDraft.catatan_wajib || rawDraft.catatan || 'Perlu konfirmasi dokter spesialis radiologi.';
      return `TEMUAN:\n${t}\n\nKESAN:\n${k}\n\nCATATAN SISTEM:\n${c}`;
    }
    return String(rawDraft);
  };

  // 1. Pemuatan Data Kasus: Panggil apiService.getCaseDetail(studyUid)
  const loadCaseDetail = async (targetUid) => {
    if (!targetUid) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getCaseDetail(targetUid);
      setCaseData(data);
      setDraftText(formatDraftText(data.draf_laporan));
      const peakSlice = data.current_slice || (Array.isArray(data.irisan_kunci) && data.irisan_kunci.length > 0
        ? (typeof data.irisan_kunci[Math.floor(data.irisan_kunci.length / 2)] === 'object' 
            ? data.irisan_kunci[Math.floor(data.irisan_kunci.length / 2)].slice 
            : data.irisan_kunci[Math.floor(data.irisan_kunci.length / 2)])
        : (data.total_slices >= 200 ? 105 : 18));
      setCurrentSlice(peakSlice);
      setShowHeatmap(data.tier === 'MERAH');
    } catch (err) {
      console.warn(`[CaseDetail] Gagal memuat kasus ${targetUid} via API:`, err.message);
      // Fallback ke propPatient atau mock data lokal
      const fallback = propPatient || INITIAL_PATIENTS.find(p => p.id === targetUid || p.study_uid === targetUid) || INITIAL_PATIENTS[0];
      setCaseData(fallback);
      setDraftText(formatDraftText(fallback.draf_laporan));
      setCurrentSlice(fallback.current_slice || 18);
      setShowHeatmap(fallback.tier === 'MERAH');
      setError(`Mode offline: data dimuat dari cache lokal (${err.message}).`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCaseDetail(activeUid);
  }, [activeUid]);

  // Daftar 5 Subtipe Perdarahan Intrakranial (Kontrak Data 5 Kelas)
  const subtypesList = useMemo(() => {
    const rawScores = caseData?.skor_subtipe || {};
    return [
      { key: 'epidural', label: 'Epidural (EDH)', score: rawScores.epidural ?? 0.0 },
      { key: 'intraparenkim', label: 'Intraparenkim (ICH)', score: rawScores.intraparenkim ?? 0.0 },
      { key: 'intraventrikel', label: 'Intraventrikel (IVH)', score: rawScores.intraventrikel ?? 0.0 },
      { key: 'subaraknoid', label: 'Subaraknoid (SAH)', score: rawScores.subaraknoid ?? 0.0 },
      { key: 'subdural', label: 'Subdural (SDH)', score: rawScores.subdural ?? 0.0 },
    ];
  }, [caseData]);

  // Penanganan Tombol Hijau: "Setujui & Kirim ke SATUSEHAT"
  const handleApproveAndSend = async () => {
    setIsSubmitting(true);
    try {
      // 1. Eksekusi API endpoint backend
      await apiService.submitDoctorAction(
        activeUid, 
        'SETUJUI', 
        draftText, 
        'Disetujui dokter spesialis radiologi'
      );

      // Mutasi lokal
      setCaseData(prev => ({
        ...prev,
        status_pemeriksaan: 'SELESAI_ACC',
        status_fhir: 'TERKIRIM',
        laporan_final_dokter: draftText
      }));

      if (onDoctorAction) {
        onDoctorAction({ action: 'SETUJUI', laporan_baru: draftText });
      }

      // Animasi perayaan
      try {
        confetti({
          particleCount: 70,
          spread: 75,
          origin: { y: 0.65 }
        });
      } catch (e) {}

      setNotification({
        type: 'success',
        text: 'Kasus BERHASIL DISETUJUI! Bundle HL7 FHIR R4 terkirim ke SATUSEHAT (Status Observation & DiagnosticReport: FINAL). Mengalihkan ke Layar 3...'
      });

      // Arahkan dokter ke Layar 3 (Interoperabilitas SATUSEHAT)
      setTimeout(() => {
        if (onNavigateToAudit) {
          onNavigateToAudit(activeUid);
        }
      }, 1500);
    } catch (err) {
      console.error('[CaseDetail] Gagal menyetujui kasus:', err);
      setNotification({
        type: 'error',
        text: `Gagal mengirim validasi: ${err.message}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Penanganan Tombol Biru: "Edit Draf"
  const handleToggleEdit = async () => {
    if (!isEditMode) {
      // Aktifkan mode edit
      setIsEditMode(true);
      setTimeout(() => {
        if (textareaRef.current) textareaRef.current.focus();
      }, 100);
      setNotification({
        type: 'info',
        text: 'Mode edit draf aktif. Silakan modifikasi teks laporan templat AI sesuai telaah radiologi.'
      });
      setTimeout(() => setNotification(null), 3000);
    } else {
      // Simpan perubahan draf ke backend via aksi EDIT
      setIsSubmitting(true);
      try {
        await apiService.submitDoctorAction(
          activeUid, 
          'EDIT', 
          draftText, 
          'Draf disunting oleh dokter radiologi'
        );

        setIsEditMode(false);
        setCaseData(prev => ({
          ...prev,
          draf_laporan: draftText,
          laporan_final_dokter: draftText
        }));

        if (onDoctorAction) {
          onDoctorAction({ action: 'EDIT', laporan_baru: draftText });
        }

        setNotification({
          type: 'success',
          text: 'Perubahan draf laporan berhasil disimpan.'
        });
        setTimeout(() => setNotification(null), 3000);
      } catch (err) {
        setNotification({
          type: 'error',
          text: `Gagal menyimpan suntingan: ${err.message}`
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Penanganan Tombol Merah: "Tolak Draf AI"
  const handleRejectDraft = async () => {
    const confirmation = window.confirm(
      'Apakah Anda yakin ingin menolak draf AI ini? Kotak laporan akan dikosongkan untuk pengetikan manual tanpa transmisi FHIR otomatis.'
    );
    if (!confirmation) return;

    setIsSubmitting(true);
    try {
      const reason = 'Draf AI ditolak dokter spesialis radiologi. Laporan disusun manual dari awal.';
      await apiService.submitDoctorAction(activeUid, 'TOLAK', '', reason);

      setDraftText('');
      setIsEditMode(true);
      setCaseData(prev => ({
        ...prev,
        status_pemeriksaan: 'DITOLAK_MENUNGGU_MANUAL',
        status_fhir: 'BELUM_DIKIRIM',
        draf_laporan: ''
      }));

      if (onDoctorAction) {
        onDoctorAction({ action: 'TOLAK', laporan_baru: '', alasan: reason });
      }

      if (textareaRef.current) {
        textareaRef.current.focus();
      }

      setNotification({
        type: 'warning',
        text: 'Draf AI DITOLAK dan dikosongkan. Transmisi FHIR ditahan. Silakan ketik laporan mandiri dari awal.'
      });
      setTimeout(() => setNotification(null), 4500);
    } catch (err) {
      setNotification({
        type: 'error',
        text: `Gagal menolak draf: ${err.message}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Kembalikan templat bawaan
  const handleResetTemplate = () => {
    if (caseData) {
      setDraftText(formatDraftText(caseData.draf_laporan));
      setNotification({
        type: 'info',
        text: 'Draf laporan dipulihkan ke templat bawaan inferensi AI.'
      });
      setTimeout(() => setNotification(null), 2500);
    }
  };

  const isApproved = caseData?.status_pemeriksaan === 'SELESAI_ACC' || caseData?.status_fhir === 'TERKIRIM';
  const isRejected = caseData?.status_pemeriksaan === 'DITOLAK_MENUNGGU_MANUAL';

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-4 min-h-[500px]">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-red-600 animate-spin"></div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-800">Memuat Detail Kasus & Data Citra...</p>
          <p className="text-xs text-slate-400 font-mono mt-1">Study UID: {activeUid}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn pb-12">
      {/* 1. Bar Navigasi Kasus & Status Header */}
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
              UID: {activeUid}
            </span>
            <span className="text-slate-400">|</span>
            <span className="font-bold text-slate-800 text-sm">
              {caseData?.patient_name || caseData?.nama_pasien || 'Pasien Anonim'}
            </span>
            <span className="text-slate-500 text-xs hidden md:inline">
              ({caseData?.usia || 50} Thn, {caseData?.jenis_kelamin || 'Laki-laki'})
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <span className="text-xs text-slate-500 font-medium">Prioritas Triase:</span>
          {caseData?.tier === 'MERAH' ? (
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
            onClick={() => onNavigateToAudit && onNavigateToAudit(activeUid)}
            className="text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg font-semibold flex items-center space-x-1 transition-colors"
          >
            <span>Interoperabilitas SATUSEHAT</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Banner Peringatan Medis Kuning Terang (Human-in-the-Loop) */}
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
            : notification.type === 'error'
            ? 'bg-red-50 text-red-900 border-red-200'
            : 'bg-blue-50 text-blue-900 border-blue-200'
        }`}>
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-2 text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* 3. Tata Letak Split-Screen (Kolom Kiri 60% Viewer Citra Aksial, Kolom Kanan 40% Skor AI & Editor) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[660px]">
        {/* ================= KOLOM KIRI (VIEWER CITRA NIFTI RIIL & KONTROL GRAD-CAM) ================= */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <MedicalViewer
            studyUid={activeUid}
            initialSlice={currentSlice || caseData?.current_slice || (caseData?.total_slices >= 200 ? 105 : 16)}
            totalSlices={caseData?.total_slices || 224}
            keySlices={
              Array.isArray(caseData?.irisan_kunci) && caseData.irisan_kunci.length > 0
                ? caseData.irisan_kunci.map(k => typeof k === 'object' ? k.slice : k)
                : (caseData?.total_slices >= 200 ? [95, 100, 105, 110, 115] : [14, 16, 18, 19, 21])
            }
          />
        </div>

        {/* ================= KOLOM KANAN: PANEL PROBABILITAS AI & EDITOR DRAF ================= */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Panel Probabilitas AI (Sisi Kanan) */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <Brain className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900 m-0">
                  Panel Probabilitas AI (Kontrak Data)
                </h3>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                {caseData?.versi_model || 'EfficientNet-B0 v1.0'}
              </span>
            </div>

            {/* Nilai Utama skor_studi & Badge Status tier */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              caseData?.tier === 'MERAH'
                ? 'bg-red-50/70 border-red-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <span className="text-xs font-semibold text-slate-600 block">
                  Nilai Numerik Skor Studi (skor_studi)
                </span>
                <span className="text-[11px] text-slate-500">
                  Ambang batas triase: <strong>{caseData?.ambang ? caseData.ambang.toFixed(2) : '0.50'}</strong>
                </span>
              </div>

              <div className="flex items-baseline space-x-2">
                <span className={`text-2xl font-black font-mono ${
                  caseData?.tier === 'MERAH' ? 'text-red-600' : 'text-slate-700'
                }`}>
                  {(typeof caseData?.skor_studi === 'number' ? caseData.skor_studi : 0).toFixed(2)}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  caseData?.tier === 'MERAH'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {caseData?.tier || 'NORMAL'}
                </span>
              </div>
            </div>

            {/* 5 Bilah Grafik Horizontal (Progress Bar) untuk skor_subtipe */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>5 Bilah Grafik Subtipe Perdarahan (skor_subtipe):</span>
                <span className="text-slate-400 font-mono font-normal text-[10px]">Skala 0.00 – 1.00</span>
              </div>

              <div className="space-y-2.5">
                {subtypesList.map((sub) => {
                  const isHigh = sub.score >= (caseData?.ambang || 0.5);
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
                          style={{ width: `${Math.max(4, Math.min(100, sub.score * 100))}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Waktu Inferensi & Ambang */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Waktu Inferensi: <strong>{caseData?.waktu_inferensi || '0.84s'}</strong></span>
              </span>
              <span>Ambang: <strong>{caseData?.ambang || 0.50}</strong></span>
            </div>
          </div>

          {/* Editor Draf Laporan: Masukkan teks draf_laporan ke dalam state textarea */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex-1 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900 m-0">
                  Editor Draf Laporan (draf_laporan)
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
                <span>Isi Teks Laporan Radiologi:</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {isEditMode ? 'Dapat disunting bebas' : 'Klik "Edit Draf" untuk menyunting'}
                </span>
              </label>

              <textarea
                ref={textareaRef}
                rows={9}
                value={draftText}
                readOnly={!isEditMode && !isRejected}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Draf teks kosong. Silakan ketik laporan hasil pemeriksaan radiologi secara mandiri..."
                className={`w-full flex-1 p-3 rounded-lg text-xs font-mono leading-relaxed transition-all resize-y min-h-[170px] ${
                  isEditMode || isRejected
                    ? 'bg-white border-2 border-blue-500 text-slate-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-400'
                    : 'bg-slate-50 border border-slate-200 text-slate-800'
                }`}
              />
            </div>

            {/* Catatan Status Dokumen */}
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Status: <strong>{isApproved ? 'FINAL (Disetujui & FHIR Terkirim)' : isRejected ? 'DITOLAK (Penyusunan Manual)' : 'Preliminary (Menunggu Otorisasi)'}</strong></span>
              <button
                onClick={handleResetTemplate}
                title="Pulihkan templat awal AI"
                className="text-slate-500 hover:text-slate-800 text-[10px] font-medium underline flex items-center space-x-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset ke Templat Awal</span>
              </button>
            </div>

            {/* 3 Tombol Validasi Dokter */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Penanganan 3 Tombol Validasi Dokter:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Tombol Hijau: "Setujui & Kirim ke SATUSEHAT" */}
                <button
                  onClick={handleApproveAndSend}
                  disabled={isSubmitting || !draftText.trim()}
                  className="sm:col-span-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-4 rounded-lg shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 active:scale-98 transition-all"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-200" />
                  <span>
                    {isSubmitting ? 'Memproses Validasi...' : 'Setujui & Kirim ke SATUSEHAT'}
                  </span>
                </button>

                {/* 2. Tombol Biru: "Edit Draf" */}
                <button
                  onClick={handleToggleEdit}
                  disabled={isSubmitting}
                  className={`border font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors sm:col-span-2 ${
                    isEditMode
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300'
                  }`}
                >
                  {isEditMode ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                  <span>{isEditMode ? 'Simpan Suntingan (Aksi EDIT)' : 'Edit Draf'}</span>
                </button>

                {/* 3. Tombol Merah: "Tolak Draf AI" */}
                <button
                  onClick={handleRejectDraft}
                  disabled={isSubmitting}
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
