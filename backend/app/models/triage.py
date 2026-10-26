from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

class SubtypeScores(BaseModel):
    epidural: float = Field(..., ge=0.0, le=1.0, description="Probabilitas perdarahan epidural (EDH)")
    intraparenkim: float = Field(..., ge=0.0, le=1.0, description="Probabilitas perdarahan intraparenkim (IPH)")
    intraventrikel: float = Field(..., ge=0.0, le=1.0, description="Probabilitas perdarahan intraventrikel (IVH)")
    subaraknoid: float = Field(..., ge=0.0, le=1.0, description="Probabilitas perdarahan subaraknoid (SAH)")
    subdural: float = Field(..., ge=0.0, le=1.0, description="Probabilitas perdarahan subdural (SDH)")

class KeySlice(BaseModel):
    slice: int = Field(..., description="Nomor irisan aksial CT scan")
    score: float = Field(..., ge=0.0, le=1.0, description="Skor probabilitas perdarahan pada irisan ini")
    isPeak: Optional[bool] = Field(False, description="Penanda irisan dengan konsentrasi/ketebalan lesi puncak")
    note: Optional[str] = Field(None, description="Anotasi klinis otomatis pada irisan")

class DraftReport(BaseModel):
    temuan: str = Field(..., description="Deskripsi temuan objektif radiologi")
    kesan: str = Field(..., description="Kesan/kesimpulan radiologi")
    catatan_wajib: str = Field(
        "Perlu konfirmasi dan validasi dokter spesialis radiologi.", 
        description="Disclaimer medikolegal wajib Human-in-the-Loop"
    )

class TriageStudy(BaseModel):
    id: str = Field(..., description="ID internal sistem")
    study_uid: str = Field(..., description="DICOM Study Instance UID unik")
    nama_pasien: str = Field(..., description="Nama lengkap pasien")
    usia: int = Field(..., description="Usia pasien dalam tahun")
    jenis_kelamin: str = Field(..., description="Jenis kelamin pasien")
    no_rm: str = Field(..., description="Nomor Rekam Medis SIM RS")
    modalitas: str = Field("CT Kepala Non-Kontras", description="Jenis pemeriksaan modalitas")
    tanggal: str = Field(..., description="Stempel waktu akuisisi pemeriksaan")
    waktu_tunggu_menit: int = Field(0, description="Lama waktu antrean sejak kedatangan dalam menit")
    status: Literal["Belum Dibaca", "Sedang Diperiksa", "Selesai - FHIR Terkirim"] = Field("Belum Dibaca")
    total_slices: int = Field(32, description="Total irisan aksial dalam seri CT")
    current_slice: int = Field(1, description="Irisan aktif awal")
    
    # Baku Kontrak Data Mutlak
    skor_studi: float = Field(..., ge=0.0, le=1.0, description="Skor kecurigaan perdarahan kumulatif studi CT")
    skor_subtipe: SubtypeScores = Field(..., description="Rincian probabilitas 5 subtipe perdarahan intrakranial")
    tier: Literal["MERAH", "NORMAL"] = Field(..., description="Klasifikasi prioritas antrean triase (MERAH=Darurat, NORMAL=Rutin)")
    irisan_kunci: List[KeySlice] = Field(default_factory=list, description="Daftar irisan signifikan temuan lesi")
    heatmap: Optional[Any] = Field(None, description="Metadata matriks Grad-CAM heatmap atau representasi spasial")
    draf_laporan: DraftReport = Field(..., description="Draf laporan radiologi otomatis hasil telaah AI")
    versi_model: str = Field("EfficientNet-B0 v1.2", description="Versi model machine learning yang digunakan")
    ambang: float = Field(0.50, description="Ambang batas probabilitas untuk eskalasi triase ke tier MERAH")
    waktu_inferensi: str = Field("14.2 Detik", description="Durasi proses inferensi komputasi AI")
    
    # Metadata Interoperabilitas SATUSEHAT & Audit
    fhir_ids: Dict[str, str] = Field(default_factory=dict, description="Pemetaan ID resource HL7 FHIR R4")
    audit_metrics: Dict[str, Any] = Field(default_factory=dict, description="Metrik SLA dan latensi audit")
    audit_logs: List[Dict[str, str]] = Field(default_factory=list, description="Jejak audit kronologis sistem")

class ApprovalRequest(BaseModel):
    study_uid: str = Field(..., description="DICOM Study Instance UID yang disetujui")
    temuan: str = Field(..., description="Teks temuan yang telah divalidasi/disunting dokter")
    kesan: str = Field(..., description="Teks kesan akhir dokter spesialis radiologi")
    catatan_wajib: Optional[str] = Field("Telah divalidasi dan disetujui oleh Dokter Spesialis Radiologi.")

class ApprovalResponse(BaseModel):
    success: bool
    study_uid: str
    status: str
    bundle_id: str
    http_status: str
    observation_status: str = "final"
    diagnostic_report_status: str = "final"
    message: str
