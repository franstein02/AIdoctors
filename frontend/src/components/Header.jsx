import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Server, 
  UserCheck, 
  Layers, 
  CheckCircle2, 
  Database,
  Wifi,
  WifiOff,
  ChevronDown
} from 'lucide-react';
import { checkServerHealth } from '../services/apiClient';

export default function Header({ 
  currentScreen, 
  setCurrentScreen, 
  activePatient, 
  stats,
  patients,
  onSelectPatient,
  serverStatus: propServerStatus
}) {
  const [isServerOnline, setIsServerOnline] = useState(true);

  // Check health status periodically
  useEffect(() => {
    let isMounted = true;
    const testConnection = async () => {
      const res = await checkServerHealth();
      if (isMounted) {
        setIsServerOnline(res.connected);
      }
    };
    testConnection();
    const interval = setInterval(testConnection, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const serverConnected = propServerStatus !== undefined ? propServerStatus : isServerOnline;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      {/* Baris 1: Header Title & Navigasi 3 Layar Utama */}
      <div className="px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between border-b border-slate-100 gap-3">
        {/* Identitas Brand & Title Utama */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 via-rose-600 to-red-500 flex items-center justify-center text-white shadow-md shadow-red-500/20 flex-shrink-0">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight m-0 leading-tight">
                SIM RS - Instalasi Radiologi (Powered by AIdoctors)
              </h1>
            </div>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              Sistem Triase Cerdas CT Kepala Non-Kontras & Middleware Interoperabilitas SATUSEHAT (HL7 FHIR R4)
            </p>
          </div>
        </div>

        {/* Tab Navigasi 3 Layar */}
        <nav className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 flex-shrink-0" aria-label="Navigasi Layar Utama">
          {/* Layar 1 */}
          <button
            onClick={() => setCurrentScreen('triage')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              currentScreen === 'triage'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Layar 1: Dasbor Antrean Triase</span>
            {stats.redCount > 0 && (
              <span className="ml-1 bg-red-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
                {stats.redCount}
              </span>
            )}
          </button>

          {/* Layar 2 */}
          <button
            onClick={() => setCurrentScreen('viewer')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              currentScreen === 'viewer'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Layar 2: Detail Kasus & DICOM</span>
            {activePatient && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                activePatient.tier === 'MERAH' ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-200'
              }`}>
                {activePatient.id}
              </span>
            )}
          </button>

          {/* Layar 3 */}
          <button
            onClick={() => setCurrentScreen('satusehat')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              currentScreen === 'satusehat'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>Layar 3: Interoperabilitas SATUSEHAT</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-bold">
              FHIR R4
            </span>
          </button>
        </nav>
      </div>

      {/* Baris 2: Sub-Bar Status Server Backend, Profil Dokter, & Pemilih Kasus */}
      <div className="px-4 lg:px-6 py-2 bg-slate-50/90 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Koneksi Server Backend FastAPI */}
          <div 
            title={serverConnected ? "Terhubung ke Backend Middleware FastAPI (Port 8000)" : "Backend offline, berjalan dalam mode simulasi interaktif"}
            className={`flex items-center px-2.5 py-1 rounded-lg border font-medium shadow-sm transition-colors ${
              serverConnected 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <span className="relative flex h-2 w-2 mr-2">
              {serverConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              )}
            </span>
            <span className="flex items-center space-x-1">
              <span>Status Server:</span>
              <strong className={serverConnected ? 'text-emerald-700' : 'text-amber-700'}>
                {serverConnected ? 'Terhubung (Online - Port 8000)' : 'Mode Mandiri (Siaga)'}
              </strong>
            </span>
          </div>

          {/* Status PACS Orthanc */}
          <div className="hidden sm:flex items-center bg-white text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 font-medium shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-500 mr-2"></span>
            <span>PACS: <strong className="text-slate-900">Orthanc DICOM</strong> (Port 8042)</span>
          </div>

          {/* Profil Dokter Radiologi */}
          <div className="flex items-center bg-white text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
            <UserCheck className="w-3.5 h-3.5 text-blue-600 mr-1.5" />
            <span className="font-semibold text-slate-900">Dr. Ahmad Fauzi, Sp.Rad</span>
            <span className="ml-1.5 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-medium border border-blue-100">
              Dokter Radiologi
            </span>
          </div>

          {/* Pemilih Kasus Cepat (Tampil di Layar 2 & Layar 3) */}
          {currentScreen !== 'triage' && (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-300 animate-fadeIn">
              <span className="text-slate-500 font-medium text-[11px]">Kasus Aktif:</span>
              <select
                value={activePatient?.id || activePatient?.study_uid || ''}
                onChange={(e) => onSelectPatient(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg text-xs font-medium px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
              >
                {patients.map(p => (
                  <option key={p.id || p.study_uid} value={p.id || p.study_uid}>
                    [{p.tier}] {p.id || p.study_uid} - {p.nama_pasien || p.patient_name} ({p.subtipe_dominan || 'Non-Hemoragik'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Informasi Status Kanan */}
        <div className="hidden md:flex items-center space-x-3 text-xs text-slate-500">
          <span className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mr-1.5"></span>
            Modalitas: <strong className="text-slate-700 ml-1">CT Kepala Non-Kontras</strong>
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" />
            SATUSEHAT: <strong className="ml-1 font-mono">HL7 FHIR R4</strong>
          </span>
        </div>
      </div>
    </header>
  );
}
