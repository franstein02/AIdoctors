import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Upload, 
  Search, 
  Filter, 
  ChevronRight, 
  ShieldAlert, 
  Brain, 
  ArrowUpRight, 
  Activity,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

export default function Screen1TriageQueue({ 
  patients, 
  onSelectPatient, 
  onOpenUploadModal, 
  onViewAudit 
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalityFilter, setModalityFilter] = useState('ALL');

  // Calculate statistics
  const stats = useMemo(() => {
    const redCount = patients.filter(p => p.tier === 'MERAH' && p.status !== 'Selesai - FHIR Terkirim').length;
    const normalCount = patients.filter(p => p.tier === 'NORMAL' && p.status !== 'Selesai - FHIR Terkirim').length;
    const fhirSentCount = patients.filter(p => p.status === 'Selesai - FHIR Terkirim').length + 10; // includes historical
    return { redCount, normalCount, fhirSentCount };
  }, [patients]);

  // Apply Smart Triaging Sort:
  // 1. All "MERAH" cases come first, sorted by skor_studi DESCENDING, then by waktu_tunggu_menit DESCENDING
  // 2. All "NORMAL" cases come afterwards, sorted purely by arrival/waktu_tunggu_menit DESCENDING
  const sortedAndFilteredPatients = useMemo(() => {
    let list = [...patients];

    // Filter by status
    if (statusFilter !== 'ALL') {
      list = list.filter(p => {
        if (statusFilter === 'UNREAD') return p.status === 'Belum Dibaca';
        if (statusFilter === 'IN_PROGRESS') return p.status === 'Sedang Diperiksa';
        if (statusFilter === 'COMPLETED') return p.status === 'Selesai - FHIR Terkirim';
        return true;
      });
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.nama_pasien.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.study_uid.toLowerCase().includes(q) ||
        p.no_rm.toLowerCase().includes(q) ||
        p.subtipe_dominan.toLowerCase().includes(q)
      );
    }

    // Smart Triaging Sorting Logic
    list.sort((a, b) => {
      if (a.tier === 'MERAH' && b.tier !== 'MERAH') return -1;
      if (a.tier !== 'MERAH' && b.tier === 'MERAH') return 1;

      if (a.tier === 'MERAH' && b.tier === 'MERAH') {
        // Red tier: Higher AI study score first
        if (b.skor_studi !== a.skor_studi) {
          return b.skor_studi - a.skor_studi;
        }
        return b.waktu_tunggu_menit - a.waktu_tunggu_menit;
      }

      // Normal tier: arrival time order (longer waiting first)
      return b.waktu_tunggu_menit - a.waktu_tunggu_menit;
    });

    return list;
  }, [patients, statusFilter, searchQuery]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 1. Ringkasan Antrean (3 Metrik Kartu) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Kritis (Merah) */}
        <div className="bg-white rounded-xl p-4 border border-red-200 shadow-sm flex items-center justify-between hover:border-red-300 transition-all">
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-red-600 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping mr-0.5"></span>
              <span>Kasus Prioritas Merah (Kritis)</span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {stats.redCount}
              </span>
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                Wajib Evaluasi Cepat
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Probabilitas perdarahan melebihi ambang 0.50
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-500/20 flex-shrink-0">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* Card 2: Antrean Normal */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Kasus Antrean Normal</span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {stats.normalCount}
              </span>
              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                Sesuai Waktu Kedatangan
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Skor AI di bawah ambang batas (non-kritis)
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200 flex-shrink-0">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Terkirim ke SATUSEHAT */}
        <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm flex items-center justify-between hover:border-emerald-300 transition-all">
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Laporan Terkirim ke SATUSEHAT</span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {stats.fhirSentCount}
              </span>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                HL7 FHIR R4 Valid
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              DiagnosticReport & Observation disetujui dokter
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Filter & Action Toolbar */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Pasien, No. RM, atau Study UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="UNREAD">Belum Dibaca</option>
              <option value="IN_PROGRESS">Sedang Diperiksa</option>
              <option value="COMPLETED">Selesai / FHIR Terkirim</option>
            </select>
          </div>

          {/* Modality Filter */}
          <div className="hidden sm:flex items-center space-x-1 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 font-medium">
            <span className="text-slate-400">Modalitas:</span>
            <span className="font-semibold text-slate-800">CT Kepala Non-Kontras</span>
          </div>
        </div>

        {/* Action Button: Simulate New DICOM Upload */}
        <button
          onClick={onOpenUploadModal}
          className="flex items-center space-x-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-md shadow-red-500/20 active:scale-95 transition-all"
        >
          <Upload className="w-4 h-4" />
          <span>+ Simulasi Unggah DICOM Baru</span>
        </button>
      </div>

      {/* 3. Tabel Antrean Pasien (Smart Triaging Table) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4 w-36">PRIORITAS (TIER)</th>
                <th className="py-3 px-4">STUDY UID / DATA PASIEN</th>
                <th className="py-3 px-4 w-52">SKOR AI (skor_studi)</th>
                <th className="py-3 px-4 w-32">WAKTU TUNGGU</th>
                <th className="py-3 px-4 w-44">STATUS PEMERIKSAAN</th>
                <th className="py-3 px-4 text-right w-44">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs font-normal">
              {sortedAndFilteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Tidak ada antrean pemeriksaan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                sortedAndFilteredPatients.map((patient) => {
                  const isRed = patient.tier === 'MERAH';
                  const isDone = patient.status === 'Selesai - FHIR Terkirim';

                  return (
                    <tr
                      key={patient.id}
                      className={`transition-colors ${
                        isRed
                          ? 'bg-[#FEF2F2] hover:bg-[#FEE2E2]/80 border-l-4 border-l-[#DC2626]'
                          : 'bg-white hover:bg-slate-50/90 border-l-4 border-l-transparent'
                      }`}
                    >
                      {/* Kolom 1: PRIORITAS / TIER */}
                      <td className="py-3.5 px-4 align-middle">
                        {isRed ? (
                          <div className="inline-flex items-center space-x-1.5 bg-[#DC2626] text-white px-2.5 py-1 rounded-md text-[11px] font-bold shadow-sm shadow-red-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                            <span>[ MERAH ]</span>
                            <span className="text-[10px] font-normal opacity-90">(Darurat)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1.5 bg-slate-600 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold">
                            <span>[ NORMAL ]</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 mt-1 pl-1">
                          {isRed ? '★ Prioritas Atas (AI)' : 'Antrean Reguler'}
                        </div>
                      </td>

                      {/* Kolom 2: STUDY UID & DATA PASIEN */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex items-start space-x-2.5">
                          <div className={`p-2 rounded-lg mt-0.5 ${
                            isRed ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Brain className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-sm">
                                {patient.nama_pasien}
                              </span>
                              <span className="text-slate-400 font-mono text-[11px]">
                                ({patient.usia} Th / {patient.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'})
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-600 mt-0.5">
                              <span className="font-mono text-slate-500">ID: {patient.id}</span>
                              <span>•</span>
                              <span>No. RM: <strong className="text-slate-700 font-mono">{patient.no_rm}</strong></span>
                            </div>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5 font-mono">
                              <span className="truncate max-w-[220px]" title={patient.study_uid}>
                                UID: {patient.study_uid}
                              </span>
                              <span>•</span>
                              <span className="text-slate-600 font-sans">{patient.modalitas}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Kolom 3: SKOR AI (skor_studi) & Subtipe */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-slate-900">
                              {patient.skor_studi.toFixed(2)}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                              patient.skor_studi >= 0.85
                                ? 'bg-red-100 text-red-700'
                                : patient.skor_studi >= 0.50
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {patient.tingkat_keparahan}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isRed
                                  ? 'bg-gradient-to-r from-orange-500 to-red-600'
                                  : 'bg-slate-400'
                              }`}
                              style={{ width: `${Math.max(5, patient.skor_studi * 100)}%` }}
                            ></div>
                          </div>

                          {/* Subtipe Prediksi */}
                          <div className="text-[11px] text-slate-600 flex items-center justify-between">
                            <span>Subtipe:</span>
                            <span className={`font-medium ${
                              isRed ? 'text-red-700 font-bold' : 'text-slate-500'
                            }`}>
                              {patient.subtipe_dominan !== '-' ? patient.subtipe_dominan : 'Non-Hemoragik'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Kolom 4: WAKTU TUNGGU */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex items-center space-x-1.5 font-medium text-slate-800">
                          <Clock className={`w-3.5 h-3.5 ${
                            isRed ? 'text-red-500' : 'text-slate-400'
                          }`} />
                          <span className={isRed && patient.waktu_tunggu_menit > 10 ? 'font-bold text-red-700' : ''}>
                            {patient.waktu_tunggu}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Masuk: {patient.tanggal.split(',')[1] || '10:14 WIB'}
                        </div>
                      </td>

                      {/* Kolom 5: STATUS PEMERIKSAAN */}
                      <td className="py-3.5 px-4 align-middle">
                        {isDone ? (
                          <div className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Selesai / FHIR Terkirim</span>
                          </div>
                        ) : patient.status === 'Sedang Diperiksa' ? (
                          <div className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-md text-[11px] font-semibold">
                            <Activity className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                            <span>Sedang Diperiksa</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md text-[11px] font-medium">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Menunggu Validasi Dokter</span>
                          </div>
                        )}
                      </td>

                      {/* Kolom 6: AKSI */}
                      <td className="py-3.5 px-4 align-middle text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onSelectPatient(patient.id)}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95 ${
                              isRed
                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'
                                : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }`}
                          >
                            <span>Buka Pemeriksaan</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onViewAudit(patient.id)}
                            title="Lihat Log Audit & Pemetaan FHIR SATUSEHAT"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Banner Informasi Prinsip Aman (Smart Triaging Principle) */}
        <div className="bg-slate-900 text-slate-300 px-4 py-3 flex items-center justify-between border-t border-slate-800 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center border border-cyan-800/60">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white tracking-wide">
                Prinsip Aman Smart Triaging:
              </span>{' '}
              <span className="text-slate-300">
                AI hanya menaikkan prioritas antrean untuk kasus terduga kritis (Merah) dan tidak pernah menurunkan urutan antrean pasien (Normal tetap sesuai urutan kedatangan).
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
            <span>Standar Keselamatan Pasien: ISO/TS 5798 & Permenkes No 24/2022</span>
          </div>
        </div>
      </div>
    </div>
  );
}
