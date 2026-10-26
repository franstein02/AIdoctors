from datetime import datetime, timezone
from sqlalchemy import (
    Column, 
    String, 
    Float, 
    Integer, 
    Boolean,
    Text, 
    DateTime, 
    JSON, 
    ForeignKey
)
from sqlalchemy.orm import relationship
from app.core.database import Base

class RadiologyStudy(Base):
    """
    Model Tabel Pemeriksaan Radiologi CT Kepala (RadiologyStudy):
    Menyimpan seluruh atribut Baku Kontrak Data AI dan status operasional triase SIM RS.
    """
    __tablename__ = "radiology_studies"

    # Kontrak Data AI Mutlak
    study_uid = Column(String(128), primary_key=True, index=True, doc="DICOM Study Instance UID unik")
    skor_studi = Column(Float, nullable=False, doc="Probabilitas kumulatif perdarahan intrakranial [0.0 - 1.0]")
    skor_subtipe = Column(JSON, nullable=False, doc="Distribusi skor 5 subtipe: epidural, intraparenkim, intraventrikel, subaraknoid, subdural")
    tier = Column(String(16), nullable=False, index=True, doc="Klasifikasi triase: 'MERAH' atau 'NORMAL'")
    irisan_kunci = Column(JSON, nullable=False, doc="Daftar nomor irisan aksial dengan lesi dominan, misal [16, 18, 19]")
    heatmap_url = Column(String(255), nullable=True, doc="URL citra overlay Grad-CAM untuk ditampilkan di viewer")
    draf_laporan = Column(Text, nullable=False, doc="Draf laporan radiologi otomatis hasil telaah AI")
    versi_model = Column(String(64), nullable=False, default="EfficientNet-B0 v1.0", doc="Identitas model machine learning")
    ambang = Column(Float, nullable=False, default=0.50, doc="Ambang batas probabilitas untuk eskalasi triase")
    waktu_inferensi = Column(Float, nullable=False, default=1.42, doc="Durasi komputasi inferensi dalam detik")

    # Kolom Status Operasional SIM RS
    patient_name = Column(String(128), nullable=False, doc="Nama lengkap pasien")
    waktu_masuk = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), doc="Stempel waktu kedatangan pasien / intake DICOM")
    waktu_tunggu_menit = Column(Integer, nullable=False, default=0, doc="Durasi waktu tunggu antrean dalam menit")
    status_pemeriksaan = Column(
        String(32), 
        nullable=False, 
        default="MENUNGGU_VALIDASI",
        doc="Status kerja klinis: 'MENUNGGU_VALIDASI', 'SEDANG_DIPERIKSA', 'SELESAI_ACC', 'DITOLAK_MENUNGGU_MANUAL'"
    )
    laporan_final_dokter = Column(Text, nullable=True, doc="Laporan hasil validasi akhir atau suntingan dokter spesialis radiologi")
    status_fhir = Column(
        String(32), 
        nullable=False, 
        default="BELUM_DIKIRIM",
        doc="Status transmisi interoperabilitas SATUSEHAT: 'BELUM_DIKIRIM', 'TERKIRIM', 'GAGAL'"
    )

    # Metadata Tambahan SIM RS
    no_rm = Column(String(32), nullable=True, default="RM-000000", doc="Nomor Rekam Medis")
    usia = Column(Integer, nullable=True, default=50, doc="Usia pasien")
    jenis_kelamin = Column(String(16), nullable=True, default="Laki-laki", doc="Jenis kelamin")
    modalitas = Column(String(64), nullable=False, default="CT Kepala Non-Kontras", doc="Modalitas radiologi")
    total_slices = Column(Integer, nullable=False, default=32, doc="Jumlah irisan aksial dalam seri CT")

    # Relasi ke Jejak Audit
    audit_logs = relationship("AuditLog", back_populates="study", cascade="all, delete-orphan", order_by="AuditLog.timestamp.desc()")

    def to_dict(self):
        """Konversi model SQLAlchemy ke format dictionary / JSON kontrak data"""
        return {
            "study_uid": self.study_uid,
            "patient_name": self.patient_name,
            "no_rm": self.no_rm,
            "usia": self.usia,
            "jenis_kelamin": self.jenis_kelamin,
            "modalitas": self.modalitas,
            "waktu_masuk": self.waktu_masuk.isoformat() if self.waktu_masuk else None,
            "waktu_tunggu_menit": self.waktu_tunggu_menit,
            "status_pemeriksaan": self.status_pemeriksaan,
            "laporan_final_dokter": self.laporan_final_dokter,
            "status_fhir": self.status_fhir,
            "skor_studi": self.skor_studi,
            "skor_subtipe": self.skor_subtipe,
            "tier": self.tier,
            "irisan_kunci": self.irisan_kunci,
            "heatmap_url": self.heatmap_url,
            "draf_laporan": self.draf_laporan,
            "versi_model": self.versi_model,
            "ambang": self.ambang,
            "waktu_inferensi": self.waktu_inferensi,
            "total_slices": self.total_slices,
            "audit_logs": [log.to_dict() for log in self.audit_logs] if self.audit_logs else []
        }

class AuditLog(Base):
    """
    Model Tabel Jejak Audit (AuditLog):
    Merekam setiap stempel waktu, jenis aktivitas, aktor pengguna, dan keterangan sistem/klinis.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    study_uid = Column(String(128), ForeignKey("radiology_studies.study_uid", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), doc="Stempel waktu aktivitas")
    event_type = Column(String(64), nullable=False, doc="Jenis peristiwa: TRIAGE_ASSIGNED, DOCTOR_APPROVAL, DOCTOR_EDIT, DOCTOR_REJECTION, STATUS_CHANGE")
    user = Column(String(128), nullable=False, default="System / AI Engine", doc="Nama dokter atau identitas sistem pengubah")
    keterangan = Column(Text, nullable=False, doc="Deskripsi naratif aktivitas")

    # Relasi balik ke studi
    study = relationship("RadiologyStudy", back_populates="audit_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "study_uid": self.study_uid,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "event_type": self.event_type,
            "user": self.user,
            "keterangan": self.keterangan
        }

class FhirTransmissionLog(Base):
    """
    Model Tabel Log Transmisi SATUSEHAT:
    Merekam riwayat pengiriman, status HTTP, idempoten key, retry count, dan timestamp.
    """
    __tablename__ = "fhir_transmission_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    study_uid = Column(String(128), ForeignKey("radiology_studies.study_uid", ondelete="CASCADE"), nullable=False, index=True)
    bundle_id = Column(String(128), nullable=False)
    idempotency_key = Column(String(128), nullable=False, index=True)
    http_status = Column(String(64), nullable=False, default="HTTP 200 OK (Idempoten)")
    status_code = Column(Integer, nullable=False, default=200)
    is_idempotent = Column(Boolean, nullable=False, default=True)
    retry_count = Column(Integer, nullable=False, default=0)
    endpoint_target = Column(String(255), nullable=False)
    response_summary = Column(Text, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "study_uid": self.study_uid,
            "bundle_id": self.bundle_id,
            "idempotency_key": self.idempotency_key,
            "http_status": self.http_status,
            "status_code": self.status_code,
            "is_idempotent": self.is_idempotent,
            "retry_count": self.retry_count,
            "endpoint_target": self.endpoint_target,
            "response_summary": self.response_summary,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }
