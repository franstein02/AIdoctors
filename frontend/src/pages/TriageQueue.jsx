import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Upload, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Activity,
  Layers,
  Brain,
  ShieldAlert,
  RotateCw,
  Info,
  AlertCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import { INITIAL_PATIENTS } from '../data/mockData';

export default function TriageQueue({ 
  onSelectPatient, 
  onOpenUploadModal, 
  onViewAudit 
}) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. State Dinamis: Muat antrean riil dari apiService.getQueue()
  const fetchQueueData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getQueue();
      if (Array.isArray(data) && data.length > 0) {
        setQueue(data);
      } else {
        setQueue(INITIAL_PATIENTS);
      }
    } catch (err) {
      console.warn('[TriageQueue] Gagal terhubung ke backend FastAPI, menggunakan cadangan lokal:', err.message);
      setError(`Koneksi offline (${err.message}). Menampilkan simulasi antrean lokal.`);
      setQueue(INITIAL_PATIENTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
  }, []);

  // 2. Kartu Ringkasan: Hitung akumulasi metrik otomatis dari data antrean riil
  const stats = useMemo(() => {
    const redCount = queue.filter(item => item.tier === 'MERAH').length;
    const normalCount = queue.filter(item => item.tier === 'NORMAL').length;
    const fhirSentCount = queue.filter(
      item => item.status_pemeriksaan === 'SELESAI_ACC' || 
              item.status_fhir === 'TERKIRIM' || 
              item.status === 'Selesai - FHIR Terkirim'
    ).length;
    return { redCount, normalCount, fhirSentCount };
  }, [queue]);

  // 3. Pengurutan Baris Cerdas Aman (Smart Triaging Principle):
  //    - Tier MERAH selalu berada di urutan teratas (skor_studi tertinggi DESC, waktu tunggu DESC)
  //    - Tier NORMAL terurut murni sesuai waktu kedatangan (FIFO / waktu_tunggu_menit DESC)
  const sortedAndFilteredQueue = useMemo(() => {
    let list = [...queue];

    // Filter status operasional
    if (statusFilter !== 'ALL') {
      list = list.filter(p => {
        if (statusFilter === 'MENUNGGU') {
          return p.status_pemeriksaan === 'MENUNGGU_VALIDASI' || p.status === 'Belum Dibaca';
        }
        if (statusFilter === 'SEDANG_DIPERIKSA') {
          return p.status_pemeriksaan === 'SEDANG_DIPERIKSA' || p.status === 'Sedang Diperiksa';
        }
        if (statusFilter === 'SELESAI') {
          return p.status_pemeriksaan === 'SELESAI_ACC' || 
                 p.status_fhir === 'TERKIRIM' || 
                 p.status === 'Selesai - FHIR Terkirim';
        }
        return true;
      });
    }

    // Filter pencarian
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        (p.nama_pasien && p.nama_pasien.toLowerCase().includes(q)) ||
        (p.patient_name && p.patient_name.toLowerCase().includes(q)) ||
        (p.study_uid && p.study_uid.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.no_rm && p.no_rm.toLowerCase().includes(q)) ||
        (p.subtipe_dominan && p.subtipe_dominan.toLowerCase().includes(q))
      );
    }

    // Urutan triase aman: MERAH di atas, NORMAL di bawah
    list.sort((a, b) => {
      const aIsRed = a.tier === 'MERAH';
      const bIsRed = b.tier === 'MERAH';

      if (aIsRed && !bIsRed) return -1;
      if (!aIsRed && bIsRed) return 1;

      if (aIsRed && bIsRed) {
        const aScore = typeof a.skor_studi === 'number' ? a.skor_studi : 0;
        const bScore = typeof b.skor_studi === 'number' ? b.skor_studi : 0;
        if (bScore !== aScore) return bScore - aScore;
        return (b.waktu_tunggu_menit || 0) - (a.waktu_tunggu_menit || 0);
      }

      return (b.waktu_tunggu_menit || 0) - (a.waktu_tunggu_menit || 0);
    });

    return list;
  }, [queue, statusFilter, searchQuery]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Notifikasi Status Koneksi Offline / Error Fallback */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchQueueData}
            className="text-amber-900 font-bold hover:underline flex items-center space-x-1"
          >
            <RotateCw className="w-3 h-3" />
            <span>Coba Lagi</span>
          </button>
        </div>
      )}

      {/* 1. Kartu Ringkasan Atas: 3 Metrik Kotak Dinamis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kotak 1: Kasus Prioritas Merah (Kritis) */}
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
              Probabilitas perdarahan intrakranial ≥ 0.50
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-500/20 flex-shrink-0">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* Kotak 2: Kasus Antrean Normal */}
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
                Sesuai Waktu Kedatangan (FIFO)
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

        {/* Kotak 3: Laporan Terkirim FHIR (SELESAI_ACC / TERKIRIM) */}
        <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm flex items-center justify-between hover:border-emerald-300 transition-all">
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Laporan Terkirim FHIR</span>
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

      {/* 2. Toolbar Pencarian, Filter & Tombol Refresh Manual */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Kotak Pencarian */}
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

          {/* Filter Status */}
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="MENUNGGU">Menunggu Validasi</option>
              <option value="SEDANG_DIPERIKSA">Sedang Diperiksa</option>
              <option value="SELESAI">Selesai / Terkirim</option>
            </select>
          </div>

          {/* Tombol Refresh Manual */}
          <button
            onClick={fetchQueueData}
            disabled={loading}
            title="Muat Ulang Antrean dari Server FastAPI"
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all active:scale-95"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : 'text-slate-500'}`} />
            <span>{loading ? 'Memuat...' : 'Refresh Antrean'}</span>
          </button>
        </div>

        {/* Tombol Simulasi Unggah DICOM Baru */}
        {onOpenUploadModal && (
          <button
            onClick={onOpenUploadModal}
            className="flex items-center space-x-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-md shadow-red-500/20 active:scale-95 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>+ Unggah Studi DICOM Baru</span>
          </button>
        )}
      </div>

      {/* 3. Tabel Antrean Pasien (Triage Queue Table) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4 w-36">Prioritas</th>
                <th className="py-3 px-4">Study UID / Pasien</th>
                <th className="py-3 px-4 w-52">Skor AI (skor_studi)</th>
                <th className="py-3 px-4 w-32">Waktu Tunggu</th>
                <th className="py-3 px-4 w-44">Status Pemeriksaan</th>
                <th className="py-3 px-4 text-right w-44">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs font-normal">
              {loading && queue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RotateCw className="w-8 h-8 mx-auto mb-2 text-cyan-600 animate-spin" />
                    Menghubungkan ke backend FastAPI (http://localhost:8000/api/v1/queue)...
                  </td>
                </tr>
              ) : sortedAndFilteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Tidak ada antrean pemeriksaan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                sortedAndFilteredQueue.map((patient) => {
                  const isRed = patient.tier === 'MERAH';
                  const isDone = patient.status_pemeriksaan === 'SELESAI_ACC' || 
                                 patient.status_fhir === 'TERKIRIM' || 
                                 patient.status === 'Selesai - FHIR Terkirim';
                  const isRejected = patient.status_pemeriksaan === 'DITOLAK_MENUNGGU_MANUAL';
                  const targetUid = patient.study_uid || patient.id;

                  return (
                    <tr
                      key={targetUid}
                      className={`transition-colors ${
                        isRed
                          ? 'bg-[#FEF2F2] hover:bg-[#FEE2E2]/80 border-l-4 border-l-[#DC2626]'
                          : 'bg-white hover:bg-slate-50/90 border-l-4 border-l-transparent'
                      }`}
                    >
                      {/* Kolom 1: Prioritas */}
                      <td className="py-3.5 px-4 align-middle">
                        {isRed ? (
                          <div className="inline-flex items-center space-x-1.5 bg-[#DC2626] text-white px-2.5 py-1 rounded-md text-[11px] font-bold shadow-sm shadow-red-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                            <span>[ MERAH ]</span>
                            <span className="text-[10px] font-normal opacity-90">(Kritis)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1.5 bg-slate-600 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold">
                            <span>[ NORMAL ]</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 mt-1 pl-1">
                          {isRed ? '★ Prioritas AI' : 'Antrean Reguler'}
                        </div>
                      </td>

                      {/* Kolom 2: Study UID / Pasien */}
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
                                {patient.nama_pasien || patient.patient_name || 'Tn. Pasien'}
                              </span>
                              <span className="text-slate-400 font-mono text-[11px]">
                                ({patient.usia || 50} Th / {patient.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'})
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-600 mt-0.5">
                              <span className="font-mono text-slate-500">ID: {patient.id || targetUid}</span>
                              <span>•</span>
                              <span>No. RM: <strong className="text-slate-700 font-mono">{patient.no_rm || 'RM-994021'}</strong></span>
                            </div>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5 font-mono">
                              <span className="truncate max-w-[220px]" title={targetUid}>
                                UID: {targetUid}
                              </span>
                              <span>•</span>
                              <span className="text-slate-600 font-sans">{patient.modalitas || 'CT Kepala Non-Kontras'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Kolom 3: Skor AI (skor_studi) */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-slate-900">
                              {(typeof patient.skor_studi === 'number' ? patient.skor_studi : 0).toFixed(2)}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                              patient.skor_studi >= 0.85
                                ? 'bg-red-100 text-red-700'
                                : patient.skor_studi >= 0.50
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {patient.tingkat_keparahan || (patient.skor_studi >= 0.50 ? 'Tinggi' : 'Normal')}
                            </span>
                          </div>

                          {/* Bilah Progres */}
                          <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isRed
                                  ? 'bg-gradient-to-r from-orange-500 to-red-600'
                                  : 'bg-slate-400'
                              }`}
                              style={{ width: `${Math.max(5, (patient.skor_studi || 0) * 100)}%` }}
                            ></div>
                          </div>

                          {/* Subtipe Dominan */}
                          <div className="text-[11px] text-slate-600 flex items-center justify-between">
                            <span>Subtipe:</span>
                            <span className={`font-medium ${
                              isRed ? 'text-red-700 font-bold' : 'text-slate-500'
                            }`}>
                              {patient.subtipe_dominan && patient.subtipe_dominan !== '-' ? patient.subtipe_dominan : 'Non-Hemoragik'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Kolom 4: Waktu Tunggu */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex items-center space-x-1.5 font-medium text-slate-800">
                          <Clock className={`w-3.5 h-3.5 ${
                            isRed ? 'text-red-500' : 'text-slate-400'
                          }`} />
                          <span className={isRed && patient.waktu_tunggu_menit > 10 ? 'font-bold text-red-700' : ''}>
                            {patient.waktu_tunggu_menit ? `${patient.waktu_tunggu_menit} Menit` : patient.waktu_tunggu || '10 Menit'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Kedatangan: {patient.tanggal ? patient.tanggal.split(',')[1] || '10:14 WIB' : '10:14 WIB'}
                        </div>
                      </td>

                      {/* Kolom 5: Status Pemeriksaan */}
                      <td className="py-3.5 px-4 align-middle">
                        {isDone ? (
                          <div className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>SELESAI_ACC</span>
                          </div>
                        ) : isRejected ? (
                          <div className="inline-flex items-center space-x-1 bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-md text-[11px] font-semibold">
                            <span>DITOLAK_MANUAL</span>
                          </div>
                        ) : patient.status_pemeriksaan === 'SEDANG_DIPERIKSA' || patient.status === 'Sedang Diperiksa' ? (
                          <div className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-md text-[11px] font-semibold">
                            <Activity className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                            <span>SEDANG_DIPERIKSA</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md text-[11px] font-medium">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>MENUNGGU_VALIDASI</span>
                          </div>
                        )}
                      </td>

                      {/* Kolom 6: Aksi (Tombol Periksa Kasus membawa parameter study_uid ke Layar 2) */}
                      <td className="py-3.5 px-4 align-middle text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onSelectPatient(targetUid)}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95 ${
                              isRed
                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'
                                : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }`}
                          >
                            <span>Periksa Kasus</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>

                          {onViewAudit && (
                            <button
                              onClick={() => onViewAudit(targetUid)}
                              title="Lihat Log Audit & Pemetaan FHIR SATUSEHAT"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Banner Informasi Bawah: Teks Prinsip Smart Triaging */}
        <div className="bg-slate-900 text-slate-300 px-4 py-3 flex items-center justify-between border-t border-slate-800 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center border border-cyan-800/60 flex-shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <span className="text-slate-200 leading-relaxed font-medium">
                Prinsip Smart Triaging: AI hanya menaikkan prioritas antrean untuk kasus terduga kritis dan tidak pernah menurunkan antrean pasien.
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center space-x-3 text-[11px] text-slate-400 font-mono flex-shrink-0">
            <span>Standar Keselamatan Pasien: ISO/TS 5798 & Permenkes No 24/2022</span>
          </div>
        </div>
      </div>
    </div>
  );
}
