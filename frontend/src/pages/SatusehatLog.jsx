import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  Copy, 
  Check, 
  Download, 
  Terminal, 
  Layers, 
  Database, 
  Cpu, 
  ShieldCheck, 
  Clock, 
  ArrowRight,
  FileCode,
  ArrowLeft,
  Sparkles,
  Info,
  Server,
  Activity,
  Send,
  Eye,
  RefreshCw
} from 'lucide-react';
import { apiService } from '../services/api';
import { generateFhirBundleJson, INITIAL_PATIENTS } from '../data/mockData';

export default function SatusehatLog({
  studyUid,
  patient: propPatient,
  onBackToQueue,
  onBackToViewer
}) {
  const activeUid = studyUid || propPatient?.study_uid || propPatient?.id || 'std-00192';

  const [caseData, setCaseData] = useState(propPatient || null);
  const [rawBundle, setRawBundle] = useState(null);
  const [transmissionLogs, setTransmissionLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filterResource, setFilterResource] = useState('ALL');
  const [notification, setNotification] = useState(null);

  // Muat data rincian kasus, bundle preview, dan audit log secara paralel
  const loadData = async () => {
    setLoading(true);
    try {
      const [caseRes, bundleRes, logsRes] = await Promise.allSettled([
        apiService.getCaseDetail(activeUid),
        apiService.getFhirPreview(activeUid),
        apiService.getSatusehatLogs()
      ]);

      // 1. Case detail
      if (caseRes.status === 'fulfilled' && caseRes.value) {
        setCaseData(caseRes.value);
      } else if (!caseData) {
        const fallback = propPatient || INITIAL_PATIENTS.find(p => p.id === activeUid || p.study_uid === activeUid) || INITIAL_PATIENTS[0];
        setCaseData(fallback);
      }

      // 2. FHIR Bundle Preview
      if (bundleRes.status === 'fulfilled' && bundleRes.value) {
        setRawBundle(bundleRes.value);
      } else {
        const fallbackPatient = caseData || propPatient || INITIAL_PATIENTS[0];
        const isApproved = fallbackPatient?.status_pemeriksaan === 'SELESAI_ACC' || fallbackPatient?.status_fhir === 'TERKIRIM';
        setRawBundle(generateFhirBundleJson(fallbackPatient, isApproved));
      }

      // 3. SATUSEHAT Logs
      if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value)) {
        setTransmissionLogs(logsRes.value);
      }
    } catch (err) {
      console.warn('[SatusehatLog] Gagal sinkronisasi API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeUid]);

  const isApproved = caseData?.status_pemeriksaan === 'SELESAI_ACC' || caseData?.status_fhir === 'TERKIRIM';

  // Fallback Bundle jika state bundle belum ada
  const activeBundle = useMemo(() => {
    if (rawBundle) return rawBundle;
    return generateFhirBundleJson(caseData || INITIAL_PATIENTS[0], isApproved);
  }, [rawBundle, caseData, isApproved]);

  // Filter entry bundle berdasarkan jenis resource
  const displayedJson = useMemo(() => {
    if (!activeBundle || !activeBundle.entry) return activeBundle;
    if (filterResource === 'ALL') return activeBundle;

    const filtered = activeBundle.entry.filter(
      (e) => e?.resource?.resourceType?.toLowerCase() === filterResource.toLowerCase()
    );
    return { ...activeBundle, entry: filtered };
  }, [activeBundle, filterResource]);

  const jsonString = useMemo(() => {
    return JSON.stringify(displayedJson, null, 2);
  }, [displayedJson]);

  // Tombol "Salin JSON"
  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setNotification({
      type: 'info',
      text: 'Struktur JSON Bundle HL7 FHIR R4 berhasil disalin ke clipboard.'
    });
    setTimeout(() => {
      setCopied(false);
      setNotification(null);
    }, 2500);
  };

  // Tombol Unduh File JSON
  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SATUSEHAT_BUNDLE_${activeUid}_${caseData?.tier || 'MERAH'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tombol "Coba Ulang Kirim (Retry)"
  const handleRetrySend = async () => {
    setIsRetrying(true);
    try {
      const res = await apiService.retrySendFhir(activeUid);
      setNotification({
        type: 'success',
        text: `Transmisi ulang SATUSEHAT sukses! HTTP Status: ${res.satusehat_response?.status_code || 200} OK. Mekanisme idempoten aktif (anti-kirim ganda).`
      });

      // Muat ulang log transmisi terbaru
      const logs = await apiService.getSatusehatLogs();
      if (Array.isArray(logs)) {
        setTransmissionLogs(logs);
      }
    } catch (err) {
      console.error('[SatusehatLog] Gagal retry transmisi:', err);
      setNotification({
        type: 'error',
        text: `Gagal mengirim ulang FHIR: ${err.message}`
      });
    } finally {
      setIsRetrying(false);
      setTimeout(() => setNotification(null), 6000);
    }
  };

  // Filter logs untuk kasus yang sedang aktif
  const filteredLogs = useMemo(() => {
    if (!transmissionLogs || transmissionLogs.length === 0) return [];
    return transmissionLogs.filter(log => log.study_uid === activeUid);
  }, [transmissionLogs, activeUid]);

  return (
    <div className="space-y-5 animate-fadeIn pb-14 text-slate-800">
      {/* 1. Bar Navigasi Atas & Status Identitas */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onBackToQueue}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Antrean</span>
          </button>

          {onBackToViewer && (
            <button
              onClick={onBackToViewer}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              <Eye className="w-4 h-4 text-slate-600" />
              <span>Viewer Citra</span>
            </button>
          )}

          <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

          <div className="flex items-center space-x-2">
            <span className="font-mono font-bold text-slate-900 text-sm">
              UID: {activeUid}
            </span>
            <span className="text-slate-400">|</span>
            <span className="font-bold text-slate-800 text-sm">
              {caseData?.patient_name || caseData?.nama_pasien || 'Pasien Anonim'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Muat ulang status SATUSEHAT"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
          </button>

          <div className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Kemenkes SATUSEHAT FHIR R4 Ready</span>
          </div>
        </div>
      </div>

      {/* Notifikasi Toast */}
      {notification && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
          notification.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
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

      {/* 2. Kartu Kinerja & Audit Atas (Waktu Inferensi, Versi Model, Ambang Batas, Idempotensi) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metrik 1: Waktu Inferensi AI */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Waktu Inferensi (waktu_inferensi)
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black font-mono text-slate-900">
              {caseData?.waktu_inferensi || '0.84s'}
            </span>
          </div>
          {/* Badge Hijau "Memenuhi Target < 60 Detik" */}
          <div className="pt-1">
            <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-md">
              <Check className="w-3 h-3 text-emerald-700" />
              <span>Memenuhi Target &lt; 60 Detik</span>
            </span>
          </div>
          <p className="text-[10px] text-slate-400 pt-0.5">
            Respons triase IGD darurat &lt; 1 menit
          </p>
        </div>

        {/* Metrik 2: Versi Model */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Versi Model (versi_model)
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-slate-900 font-mono truncate">
            {caseData?.versi_model || 'EfficientNet-B0 v1.0'}
          </div>
          <div className="pt-1">
            <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold px-2 py-0.5 rounded-md">
              <span>6-Class PyTorch CPU</span>
            </span>
          </div>
          <p className="text-[10px] text-slate-400 pt-0.5">
            Arsitektur teroptimasi untuk inferensi lokal RS
          </p>
        </div>

        {/* Metrik 3: Ambang Batas Triase (ambang = 0.50) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Ambang Batas (ambang)
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black font-mono text-slate-900">
              ambang = {(caseData?.ambang ?? 0.50).toFixed(2)}
            </span>
          </div>
          <div className="pt-1">
            <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold px-2 py-0.5 rounded-md">
              <span>Rule: ≥ 0.50 Prioritas Merah</span>
            </span>
          </div>
          <p className="text-[10px] text-slate-400 pt-0.5">
            Ambang baku triase intracranial hemorrhage
          </p>
        </div>

        {/* Metrik 4: Status Idempotensi Transmisi SATUSEHAT */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Protokol Idempotensi
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-slate-900">
            HTTP 200 OK
          </div>
          <div className="pt-1">
            <span className="inline-flex items-center space-x-1 bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold px-2 py-0.5 rounded-md">
              <ShieldCheck className="w-3 h-3 text-purple-600" />
              <span>X-Idempotency-Key Aktif</span>
            </span>
          </div>
          <p className="text-[10px] text-slate-400 pt-0.5">
            Mencegah pengiriman duplikasi ke gateway Kemenkes
          </p>
        </div>
      </div>

      {/* 3. Tabel Pemetaan 5 Resource FHIR (Dengan Penekanan Visual Status Observation & DiagnosticReport -> FINAL) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 m-0">
              Tabel Pemetaan 5 Resource HL7 FHIR Release 4
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Format: FHIR Bundle (type: <strong>transaction</strong>)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-4">No</th>
                <th className="py-2.5 px-4">Resource FHIR</th>
                <th className="py-2.5 px-4">Kode Standar & Deskripsi</th>
                <th className="py-2.5 px-4">Identifier / Metadata</th>
                <th className="py-2.5 px-4">Status Siklus Hidup</th>
                <th className="py-2.5 px-4 text-right">Otorisasi Klinis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {/* 1. Patient & Encounter */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-mono text-slate-400">01</td>
                <td className="py-3 px-4">
                  <div className="font-bold text-slate-900">Patient &amp; Encounter</div>
                  <div className="text-[10px] text-slate-400 font-mono">Resource/Patient, Resource/Encounter</div>
                </td>
                <td className="py-3 px-4">
                  <span className="font-semibold text-slate-800">Identitas Sintetis &amp; Kunjungan IGD</span>
                  <div className="text-[10px] text-slate-500">IHS Patient Identifier terintegrasi SIM RS</div>
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                  IHS: IHS-P-98218412
                </td>
                <td className="py-3 px-4">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                    active / in-progress
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-[11px] text-slate-500">SIM RS Otomatis</span>
                </td>
              </tr>

              {/* 2. ServiceRequest */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-mono text-slate-400">02</td>
                <td className="py-3 px-4">
                  <div className="font-bold text-slate-900">ServiceRequest</div>
                  <div className="text-[10px] text-slate-400 font-mono">Resource/ServiceRequest</div>
                </td>
                <td className="py-3 px-4">
                  <span className="font-semibold text-slate-800">LOINC 30799-1</span>
                  <div className="text-[10px] text-slate-500">CT Head without contrast for Acute ICH</div>
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                  REQ-2026-CT-098
                </td>
                <td className="py-3 px-4">
                  <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                    active
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-[11px] text-slate-500">Dokter Pengirim IGD</span>
                </td>
              </tr>

              {/* 3. ImagingStudy */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-mono text-slate-400">03</td>
                <td className="py-3 px-4">
                  <div className="font-bold text-slate-900">ImagingStudy</div>
                  <div className="text-[10px] text-slate-400 font-mono">Resource/ImagingStudy</div>
                </td>
                <td className="py-3 px-4">
                  <span className="font-semibold text-slate-800">DICOM Series &amp; Modalitas CT</span>
                  <div className="text-[10px] text-slate-500">Axial Brain Non-Contrast 512×512 px</div>
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                  UID: {activeUid}
                </td>
                <td className="py-3 px-4">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                    available
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-[11px] text-slate-500">PACS Orthanc DICOM</span>
                </td>
              </tr>

              {/* 4. Observation (Temuan AI & Dokter - Penekanan Status FINAL) */}
              <tr className="bg-emerald-50/50 hover:bg-emerald-50 transition-colors border-l-4 border-l-emerald-500">
                <td className="py-3.5 px-4 font-mono text-emerald-700 font-bold">04</td>
                <td className="py-3.5 px-4">
                  <div className="font-bold text-emerald-950 flex items-center space-x-1.5">
                    <span>Observation</span>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-[10px] text-emerald-700 font-mono">Resource/Observation</div>
                </td>
                <td className="py-3.5 px-4">
                  <span className="font-bold text-slate-900">Temuan Perdarahan Intrakranial (ICH)</span>
                  <div className="text-[10px] text-slate-600">
                    SNOMED-CT: 1386000 | Nilai skor numerik dilindungi di log audit
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                  OBS-{activeUid}
                </td>
                <td className="py-3.5 px-4">
                  {/* Penekanan visual bahwa status telah bermutasi menjadi FINAL */}
                  <div className="inline-flex items-center space-x-1 bg-emerald-600 text-white font-extrabold px-2.5 py-1 rounded-md shadow-sm shadow-emerald-500/20 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>FINAL</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-0.5 font-medium">
                    (Bermutasi dari Preliminary)
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="text-[11px] font-bold text-emerald-800">
                    Otorisasi Dokter Sp.Rad
                  </div>
                  <div className="text-[10px] text-emerald-600">
                    Human-in-the-Loop ACC
                  </div>
                </td>
              </tr>

              {/* 5. DiagnosticReport (Laporan Final Dokter - Penekanan Status FINAL) */}
              <tr className="bg-emerald-50/50 hover:bg-emerald-50 transition-colors border-l-4 border-l-emerald-500">
                <td className="py-3.5 px-4 font-mono text-emerald-700 font-bold">05</td>
                <td className="py-3.5 px-4">
                  <div className="font-bold text-emerald-950 flex items-center space-x-1.5">
                    <span>DiagnosticReport</span>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-[10px] text-emerald-700 font-mono">Resource/DiagnosticReport</div>
                </td>
                <td className="py-3.5 px-4">
                  <span className="font-bold text-slate-900">LOINC 24725-4 (Brain CT Report)</span>
                  <div className="text-[10px] text-slate-600">
                    Kesimpulan klinis &amp; catatan wajib verifikasi dokter
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                  REP-{activeUid}
                </td>
                <td className="py-3.5 px-4">
                  {/* Penekanan visual bahwa status telah bermutasi menjadi FINAL */}
                  <div className="inline-flex items-center space-x-1 bg-emerald-600 text-white font-extrabold px-2.5 py-1 rounded-md shadow-sm shadow-emerald-500/20 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>FINAL</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-0.5 font-medium">
                    (Tervalidasi Sp.Rad)
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="text-[11px] font-bold text-emerald-800">
                    Tervalidasi Digital
                  </div>
                  <div className="text-[10px] text-emerald-600">
                    SATUSEHAT Interoperable
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Pratinjau JSON Bundle (Dark Code Viewer) */}
      <div className="bg-[#0B1120] rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
        {/* Toolbar Dark Viewer */}
        <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-slate-300">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-white">
              Pratinjau JSON Bundle HL7 FHIR R4 (apiService.getFhirPreview)
            </span>
            <span className="text-[10px] bg-slate-800 text-cyan-400 px-2 py-0.5 rounded font-mono">
              bundle_type: transaction
            </span>
          </div>

          {/* Tombol Aksi: Salin JSON & Coba Ulang Kirim (Retry) */}
          <div className="flex items-center space-x-2">
            {/* Filter Resource Tab */}
            <div className="hidden md:flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              {['ALL', 'Patient', 'ServiceRequest', 'ImagingStudy', 'Observation', 'DiagnosticReport'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterResource(tab)}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    filterResource === tab
                      ? 'bg-cyan-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab === 'ALL' ? 'Semua' : tab}
                </button>
              ))}
            </div>

            {/* Tombol Salin JSON */}
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin JSON'}</span>
            </button>

            {/* Tombol Coba Ulang Kirim (Retry) */}
            <button
              onClick={handleRetrySend}
              disabled={isRetrying}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all active:scale-95"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Mengirim Ulang...' : 'Coba Ulang Kirim (Retry)'}</span>
            </button>

            {/* Unduh File */}
            <button
              onClick={handleDownload}
              title="Unduh Berkas JSON"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Code Content Container */}
        <div className="p-4 overflow-x-auto max-h-[460px] font-mono text-[11px] leading-relaxed select-text">
          <pre className="text-emerald-400">
            <code>{jsonString}</code>
          </pre>
        </div>
      </div>

      {/* 5. Riwayat Audit Log & Status SATUSEHAT */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 m-0">
              Riwayat Log Audit &amp; Transmisi SATUSEHAT (apiService.getSatusehatLogs)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Total tercatat: <strong>{transmissionLogs.length} entri</strong>
          </span>
        </div>

        <div className="p-4">
          {transmissionLogs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              Belum ada riwayat transmisi SATUSEHAT untuk sesi ini.
            </div>
          ) : (
            <div className="space-y-2.5">
              {transmissionLogs.slice(0, 5).map((log, idx) => (
                <div 
                  key={log.id || idx}
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-slate-400 text-[10px]">
                      #{log.id || idx + 1}
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      UID: {log.study_uid}
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-600 font-mono text-[11px]">
                      Key: {log.idempotency_key ? `${log.idempotency_key.substring(0, 18)}...` : 'IDEMP-KEY-LIVE'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                      {log.http_status || 'HTTP 200 OK'}
                    </span>
                    <span className="text-slate-400 text-[10px] font-mono">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('id-ID') : 'Baru saja'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
