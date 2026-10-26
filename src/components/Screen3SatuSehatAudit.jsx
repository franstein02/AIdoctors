import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Terminal, 
  Layers, 
  Database, 
  Cpu, 
  ShieldCheck, 
  Clock, 
  ArrowRight,
  FileCode,
  Sparkles,
  Info
} from 'lucide-react';
import { generateFhirBundleJson } from '../data/mockData';

export default function Screen3SatuSehatAudit({ patient, onBackToQueue, onBackToViewer }) {
  const isApproved = patient.status === 'Selesai - FHIR Terkirim';
  const [isRetrying, setIsRetrying] = useState(false);
  const [retrySuccess, setRetrySuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filterResource, setFilterResource] = useState('ALL');

  // Generate real FHIR Bundle JSON for this patient
  const fhirBundle = generateFhirBundleJson(patient, isApproved || retrySuccess);

  // Filter bundle preview if needed
  const displayedJson = React.useMemo(() => {
    if (filterResource === 'ALL') return fhirBundle;
    const filteredEntries = fhirBundle.entry.filter(
      e => e.resource.resourceType.toLowerCase() === filterResource.toLowerCase()
    );
    return { ...fhirBundle, entry: filteredEntries };
  }, [fhirBundle, filterResource]);

  const jsonString = JSON.stringify(displayedJson, null, 2);

  // Handle Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Handle Download JSON
  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SATUSEHAT_FHIR_${patient.id}_${patient.tier}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle Retry Send
  const handleRetrySend = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setIsRetrying(false);
      setRetrySuccess(true);
      setTimeout(() => setRetrySuccess(false), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* 1. Header Bar Interoperabilitas */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight m-0">
              SIM RS - Status Interoperabilitas HL7 FHIR SATUSEHAT & Audit Log
            </h2>
            <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded border border-emerald-200">
              Middleware AIdoctors
            </span>
          </div>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            Audit inferensi PyTorch AI & pengiriman payload HL7 FHIR R4 idempoten ke Environment Uji Kemenkes RI
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 font-medium">Kasus:</span>
          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200">
            {patient.id} ({patient.nama_pasien})
          </span>
          <button
            onClick={onBackToViewer}
            className="ml-2 text-cyan-700 hover:text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 px-3 py-1 rounded-lg font-semibold transition-colors"
          >
            Viewer DICOM
          </button>
        </div>
      </div>

      {/* 2. Indikator Alur / Lencana Keberhasilan Besar (Visual Integration Highlight) */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-xl p-4 shadow-md shadow-emerald-600/20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center border border-white/30 text-white shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-extrabold uppercase tracking-wider text-emerald-100">
                Lolos Validasi HL7 FHIR R4
              </span>
              <span className="bg-white/20 text-white text-[10px] px-2 py-0.2 rounded-full font-mono">
                Schema: STU3/R4 Compliant
              </span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight m-0 mt-0.5">
              Bundle HL7 FHIR Valid & Terkirim ke SATUSEHAT
            </h3>
            <div className="text-xs text-emerald-100 mt-0.5 flex items-center space-x-2 font-mono">
              <span>Endpoint: https://api-satusehat-dev.dto.kemkes.go.id/fhir-r4/v1</span>
              <span>•</span>
              <span className="text-emerald-200 font-bold">Idempoten: Aktif</span>
            </div>
          </div>
        </div>

        {/* Stepper Status Alur */}
        <div className="flex items-center space-x-2 text-xs bg-black/20 px-3.5 py-2 rounded-xl border border-white/10">
          <div className="flex items-center space-x-1 text-emerald-200 font-medium">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px]">1</span>
            <span>Orthanc PACS</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
          <div className="flex items-center space-x-1 text-emerald-200 font-medium">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px]">2</span>
            <span>AI Inference</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
          <div className="flex items-center space-x-1 text-emerald-200 font-medium">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px]">3</span>
            <span>Validasi Dokter</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
          <div className="flex items-center space-x-1 text-white font-bold">
            <span className="w-5 h-5 rounded-full bg-white text-emerald-800 flex items-center justify-center font-bold text-[10px]">4</span>
            <span>SATUSEHAT OK</span>
          </div>
        </div>
      </div>

      {/* 3. Kartu Metrik Audit & Kinerja (Bagian Atas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metrik 1: Waktu Inferensi (Latensi AI) */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Waktu Inferensi (Latensi AI)</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {patient.audit_metrics.waktu_inferensi}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {patient.audit_metrics.status_target}
            </span>
          </div>
          <p className="text-xs text-slate-500 m-0">
            GPU Server: NVIDIA T4 Tensor Core • 32 Slices CT
          </p>
        </div>

        {/* Metrik 2: Versi Model & Ambang Triase */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Versi Model & Ambang Triase</span>
            <Cpu className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-sm font-bold text-slate-900 font-mono">
            {patient.audit_metrics.versi_model}
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
              Ambang (Threshold): <strong>{patient.audit_metrics.ambang_triase.toFixed(2)}</strong>
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 text-[11px]">6-Class CNN + Grad-CAM</span>
          </div>
          <p className="text-xs text-slate-500 m-0">
            Arsitektur: EfficientNet-B0 Pralatih ImageNet
          </p>
        </div>

        {/* Metrik 3: Status Pengiriman SATUSEHAT */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Status Konektor SATUSEHAT</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center space-x-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{patient.audit_metrics.http_status}</span>
            </span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500">Environment Uji (Staging)</span>
            <button
              onClick={handleRetrySend}
              disabled={isRetrying}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
            >
              <RotateCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Mengirim...' : 'Coba Ulang Kirim'}</span>
            </button>
          </div>
          {retrySuccess && (
            <div className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1">
              <Check className="w-3.5 h-3.5" />
              <span>Sukses dikirim ulang! HTTP 200 OK (Idempoten).</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Tabel Pemetaan Resource HL7 FHIR R4 (5 Komponen Resource) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900 m-0">
              Status Pemetaan Resource HL7 FHIR R4
            </h3>
            <span className="text-xs text-emerald-700 bg-emerald-100 font-semibold px-2 py-0.5 rounded">
              Validator Lokal: LOLOS VALIDASI
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Model: fhir.resources Python (HL7 FHIR Release 4)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4 w-44">RESOURCE FHIR</th>
                <th className="py-2.5 px-4">SUMBER DATA AIDOCTORS / SIM RS</th>
                <th className="py-2.5 px-4 w-48">STATUS RESOURCE</th>
                <th className="py-2.5 px-4 w-44">ID SATUSEHAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-normal">
              {/* Row 1: Patient & Encounter */}
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                  Patient & Encounter
                </td>
                <td className="py-3 px-4 text-slate-700">
                  Data identitas ({patient.nama_pasien}, {patient.no_rm}) & kunjungan IGD sintetis sesuai profil SATUSEHAT (NIK terverifikasi).
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Valid & Terkirim</span>
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-800 font-semibold">
                  <div>{patient.fhir_ids.patient}</div>
                  <div className="text-slate-400 text-[10px]">{patient.fhir_ids.encounter}</div>
                </td>
              </tr>

              {/* Row 2: ServiceRequest */}
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                  ServiceRequest
                </td>
                <td className="py-3 px-4 text-slate-700">
                  Permintaan pemeriksaan radiologi SIM RS (CT Kepala Non-Kontras LOINC 24725-4, menjadi rujukan <code className="bg-slate-100 px-1 py-0.2 rounded font-mono text-[10px]">basedOn</code> pada laporan).
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Valid & Terkirim</span>
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-800 font-semibold">
                  {patient.fhir_ids.serviceRequest}
                </td>
              </tr>

              {/* Row 3: ImagingStudy */}
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                  ImagingStudy
                </td>
                <td className="py-3 px-4 text-slate-700">
                  Metadata DICOM Orthanc: <span className="font-mono text-[11px]">study_uid: {patient.study_uid}</span>, Modalitas CT, 1 seri, {patient.total_slices} instans citra aksial.
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Valid & Terkirim</span>
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-800 font-semibold">
                  {patient.fhir_ids.imagingStudy}
                </td>
              </tr>

              {/* Row 4: Observation (Highlighted status change: preliminary -> final) */}
              <tr className="bg-amber-50/30 hover:bg-amber-50/60 transition-colors border-l-4 border-l-amber-500">
                <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                  Observation
                </td>
                <td className="py-3 px-4 text-slate-700">
                  Temuan AI: Skor {patient.skor_studi} ({patient.subtipe_dominan}).{' '}
                  <span className="font-semibold text-amber-800">
                    Transisi Status Klinis: Berubah dari 'preliminary' (saat diestimasi AI) menjadi 'final' usai divalidasi dokter.
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center space-x-1 bg-emerald-600 text-white px-2 py-0.5 rounded text-[11px] font-bold shadow-sm">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{isApproved ? 'FINAL & Terkirim' : 'preliminary (AI)'}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isApproved ? '✓ Disetujui Dr. Ahmad Fauzi' : 'Menunggu ACC'}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-slate-800 font-semibold">
                  {patient.fhir_ids.observation}
                </td>
              </tr>

              {/* Row 5: DiagnosticReport */}
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                  DiagnosticReport
                </td>
                <td className="py-3 px-4 text-slate-700">
                  Laporan akhir resmi dokter radiologi. Merujuk ImagingStudy, ServiceRequest, dan Observation. Kesan: {patient.draf_laporan?.kesan}.
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>FINAL & Terkirim</span>
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-800 font-semibold">
                  {patient.fhir_ids.diagnosticReport}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Panel Log Aktivitas & Penampil JSON FHIR (Bagian Bawah 2 Kolom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Kolom Kiri (5 Kolom): Timeline & Audit Log Berurutan */}
        <div className="lg:col-span-5 bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900 m-0">
                Log Audit Sistem AIdoctors
              </h3>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              PostgreSQL Audit Trail
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px] pr-1">
            {/* Timeline Items */}
            <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {/* Event 1 */}
              <div className="relative">
                <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm flex items-center justify-center"></span>
                <div className="text-xs font-mono font-bold text-blue-700">[10:14:02 WIB]</div>
                <div className="text-xs text-slate-800 mt-0.5 leading-relaxed">
                  DICOM diterima oleh server Mini-PACS Orthanc (study_uid: {patient.id}, 32 seri citra aksial).
                </div>
              </div>

              {/* Event 2 */}
              <div className="relative">
                <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-cyan-500 border-2 border-white shadow-sm flex items-center justify-center"></span>
                <div className="text-xs font-mono font-bold text-cyan-700">[10:14:16 WIB]</div>
                <div className="text-xs text-slate-800 mt-0.5 leading-relaxed">
                  Inferensi AI PyTorch CNN selesai (waktu_inferensi: {patient.audit_metrics.waktu_inferensi}). Tier: <strong className={patient.tier === 'MERAH' ? 'text-red-600 font-bold' : 'text-slate-700'}>{patient.tier}</strong> (skor: {patient.skor_studi.toFixed(2)}). Status Observation: <code className="bg-slate-100 px-1 rounded font-mono text-[10px]">preliminary</code>.
                </div>
              </div>

              {/* Event 3 */}
              <div className="relative">
                <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow-sm flex items-center justify-center"></span>
                <div className="text-xs font-mono font-bold text-amber-700">[10:16:40 WIB]</div>
                <div className="text-xs text-slate-800 mt-0.5 leading-relaxed">
                  Dokter (Dr. Ahmad Fauzi, Sp.Rad) menekan <strong>'Setujui (ACC)'</strong>. Status Observation & DiagnosticReport bermutasi menjadi <strong className="text-emerald-700">FINAL</strong>.
                </div>
              </div>

              {/* Event 4 */}
              <div className="relative">
                <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white shadow-sm flex items-center justify-center"></span>
                <div className="text-xs font-mono font-bold text-indigo-700">[10:16:42 WIB]</div>
                <div className="text-xs text-slate-800 mt-0.5 leading-relaxed">
                  Validasi skema HL7 FHIR R4 lokal (fhir.resources validator) berhasil. Mengirim Transaction Bundle ke Endpoint Uji SATUSEHAT...
                </div>
              </div>

              {/* Event 5 */}
              <div className="relative">
                <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm flex items-center justify-center"></span>
                <div className="text-xs font-mono font-bold text-emerald-700">[10:16:43 WIB]</div>
                <div className="text-xs text-slate-800 mt-0.5 leading-relaxed">
                  <strong className="text-emerald-700">SUKSES (HTTP 200 OK):</strong> Bundle diterima SATUSEHAT. Respons bersifat <span className="underline decoration-emerald-500 font-semibold">Idempoten</span> (Anti-Kirim Ganda).
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Log tersimpan di PostgreSQL SIM RS</span>
            <span>Audit Level: High Security</span>
          </div>
        </div>

        {/* Kolom Kanan (7 Kolom): Penampil JSON Bundle HL7 FHIR R4 (Code Viewer Bergaya Gelap) */}
        <div className="lg:col-span-7 bg-[#090D16] rounded-xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
          {/* Header Code Viewer */}
          <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-slate-200">
                HL7 FHIR R4 Transaction Bundle Preview
              </span>
            </div>

            {/* Filter Resource dropdown & Copy / Download */}
            <div className="flex items-center space-x-2 text-xs">
              <select
                value={filterResource}
                onChange={(e) => setFilterResource(e.target.value)}
                className="bg-slate-950 text-slate-300 border border-slate-700 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="ALL">Semua Entry (Bundle Lengkap)</option>
                <option value="patient">Patient</option>
                <option value="servicerequest">ServiceRequest</option>
                <option value="imagingstudy">ImagingStudy</option>
                <option value="observation">Observation (AI Deteksi)</option>
                <option value="diagnosticreport">DiagnosticReport</option>
              </select>

              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors"
                title="Salin JSON Bundle"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copied ? 'Tersalin' : 'Salin JSON'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] transition-colors font-medium"
                title="Unduh berkas JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh</span>
              </button>
            </div>
          </div>

          {/* JSON Text Viewport */}
          <div className="p-4 flex-1 overflow-x-auto overflow-y-auto max-h-[460px] font-mono text-xs text-slate-300 leading-relaxed medical-scroll bg-[#060911]">
            <pre className="m-0 text-[11px]">
              <code>
                {jsonString}
              </code>
            </pre>
          </div>

          {/* Footer Bar */}
          <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Size: {(jsonString.length / 1024).toFixed(1)} KB • Encoding: UTF-8</span>
            <span className="text-cyan-400">SATUSEHAT HL7 FHIR Specification v4.0.1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
