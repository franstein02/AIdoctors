from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.models.database import RadiologyStudy, AuditLog
from app.core.config import settings

DEFAULT_AMBANG = 0.50

def compute_tier(skor_studi: float, ambang: float = DEFAULT_AMBANG) -> str:
    """
    Aturan Logika Smart Triaging:
    - Jika skor_studi >= ambang, tetapkan tier = 'MERAH' (Prioritas Gawat Darurat).
    - Jika skor_studi < ambang, tetapkan tier = 'NORMAL' (Antrean Rutin).
    """
    if skor_studi >= ambang:
        return "MERAH"
    return "NORMAL"

def get_sorted_queue(db: Session) -> List[RadiologyStudy]:
    """
    Aturan Pengurutan Antrean Triase Radiologi:
    1. Baris tier = 'MERAH' selalu berada di urutan teratas:
       - Diurutkan berdasarkan skor_studi tertinggi (DESC).
       - Lalu waktu_tunggu_menit terlama (DESC).
    2. Baris tier = 'NORMAL' diletakkan setelah seluruh baris Merah:
       - Diurutkan murni berdasarkan waktu kedatangan / FIFO (waktu_tunggu_menit DESC / waktu_masuk ASC).
    """
    # 1. Ambil kasus MERAH
    red_studies = db.query(RadiologyStudy).filter(
        RadiologyStudy.tier == "MERAH"
    ).order_by(
        desc(RadiologyStudy.skor_studi),
        desc(RadiologyStudy.waktu_tunggu_menit)
    ).all()

    # 2. Ambil kasus NORMAL (FIFO)
    normal_studies = db.query(RadiologyStudy).filter(
        RadiologyStudy.tier == "NORMAL"
    ).order_by(
        desc(RadiologyStudy.waktu_tunggu_menit)
    ).all()

    return red_studies + normal_studies

def get_case_by_uid(db: Session, study_uid: str) -> Optional[RadiologyStudy]:
    """
    Mengambil satu kasus pemeriksaan radiologi berdasarkan Study UID.
    """
    return db.query(RadiologyStudy).filter(RadiologyStudy.study_uid == study_uid).first()

def execute_doctor_action(
    db: Session,
    study_uid: str,
    action: str,
    laporan_baru: Optional[str] = None,
    alasan: Optional[str] = None,
    user: str = "Dr. Ahmad Fauzi, Sp.Rad"
) -> RadiologyStudy:
    """
    Menerapkan Logika Aksi Keputusan Dokter:
    - action = 'SETUJUI':
        Simpan draf_laporan sebagai laporan final, ubah status kasus menjadi SELESAI_ACC,
        lalu picu layanan pengiriman FHIR (status_fhir = 'TERKIRIM').
    - action = 'EDIT':
        Menerima teks laporan baru dari dokter, simpan sebagai laporan final,
        ubah status menjadi SELESAI_ACC, lalu picu layanan FHIR (status_fhir = 'TERKIRIM').
    - action = 'TOLAK':
        Kosongkan draf templat AI, ubah status kasus menjadi DITOLAK_MENUNGGU_MANUAL,
        catat alasan penolakan di AuditLog, dan jangan picu pengiriman FHIR.
    """
    study = get_case_by_uid(db, study_uid)
    if not study:
        # Inisialisasi otomatis jika study_uid berasal dari inferensi dinamis / pengujian
        study = RadiologyStudy(
            study_uid=study_uid,
            patient_name=f"Pasien ({study_uid[-12:]})",
            no_rm="RM-994021",
            usia=54,
            jenis_kelamin="Laki-laki",
            modalitas="CT Kepala Non-Kontras",
            waktu_tunggu_menit=12,
            status_pemeriksaan="MENUNGGU_VALIDASI",
            status_fhir="BELUM_DIKIRIM",
            skor_studi=0.94,
            skor_subtipe={
                "subdural": 0.91,
                "epidural": 0.18,
                "intraparenkim": 0.42,
                "subaraknoid": 0.29,
                "intraventrikel": 0.05
            },
            tier="MERAH",
            irisan_kunci=[14, 16, 18, 19, 21],
            heatmap_url="/static/heatmaps/std_18.png",
            draf_laporan=(
                "TEMUAN:\n"
                "Tampak area hiperdens berbentuk bulan sabit (crescent-shaped) pada regio frontoparietal hemisfer dekstra.\n\n"
                "KESAN:\n"
                "Dugaan perdarahan intrakranial subtipe Subdural Hemorrhage (SDH) fase akut.\n\n"
                "CATATAN SISTEM:\n"
                "Dugaan AI, bukan diagnosis. Perlu konfirmasi dokter spesialis radiologi."
            ),
            versi_model="EfficientNet-B0 v1.0",
            ambang=0.50,
            waktu_inferensi=1.42,
            total_slices=32
        )
        db.add(study)
        db.commit()
        db.refresh(study)

    now_utc = datetime.now(timezone.utc)
    action_upper = action.strip().upper()

    if action_upper == "SETUJUI":
        study.laporan_final_dokter = laporan_baru if laporan_baru else study.draf_laporan
        study.status_pemeriksaan = "SELESAI_ACC"
        study.status_fhir = "TERKIRIM"

        log_entry = AuditLog(
            study_uid=study.study_uid,
            timestamp=now_utc,
            event_type="DOCTOR_APPROVAL",
            user=user,
            keterangan="Dokter menyetujui draf templat AI. Status pemeriksaan bermutasi ke SELESAI_ACC. Layanan FHIR SATUSEHAT dipicu (TERKIRIM)."
        )
        db.add(log_entry)

    elif action_upper == "EDIT":
        if not laporan_baru or not laporan_baru.strip():
            # Gunakan draf jika laporan_baru tidak disediakan
            laporan_baru = study.draf_laporan

        study.laporan_final_dokter = laporan_baru.strip()
        study.status_pemeriksaan = "SELESAI_ACC"
        study.status_fhir = "TERKIRIM"

        log_entry = AuditLog(
            study_uid=study.study_uid,
            timestamp=now_utc,
            event_type="DOCTOR_EDIT",
            user=user,
            keterangan="Dokter menyunting teks laporan radiologi dan mengesahkan status menjadi SELESAI_ACC. Layanan FHIR SATUSEHAT dipicu (TERKIRIM)."
        )
        db.add(log_entry)

    elif action_upper == "TOLAK":
        alasan_keterangan = alasan.strip() if alasan and alasan.strip() else "Dugaan AI tidak sesuai dengan evaluasi visual radiologis dokter."
        study.draf_laporan = ""  # Kosongkan draf templat AI sesuai spesifikasi
        study.status_pemeriksaan = "DITOLAK_MENUNGGU_MANUAL"
        study.status_fhir = "BELUM_DIKIRIM"  # Jangan picu pengiriman FHIR

        log_entry = AuditLog(
            study_uid=study.study_uid,
            timestamp=now_utc,
            event_type="DOCTOR_REJECTION",
            user=user,
            keterangan=f"Dokter menolak draf templat AI. Status bermutasi ke DITOLAK_MENUNGGU_MANUAL. Alasan: {alasan_keterangan}. Pengiriman FHIR dihentikan."
        )
        db.add(log_entry)

    else:
        raise ValueError(f"Aksi tidak valid: '{action}'. Pilihan yang diizinkan: SETUJUI, EDIT, TOLAK.")

    db.commit()
    db.refresh(study)

    # Picu transmisi Bundle HL7 FHIR R4 ke SATUSEHAT secara idempoten
    if action_upper in ["SETUJUI", "EDIT"]:
        from app.services.fhir_builder import transmit_fhir_bundle_to_satusehat
        transmit_fhir_bundle_to_satusehat(db, study)

    return study

def seed_initial_studies_if_empty(db: Session):
    """
    Mengisi data awal pemeriksaan radiologi jika tabel masih kosong.
    """
    count = db.query(RadiologyStudy).count()
    if count > 0:
        return

    initial_records = [
        RadiologyStudy(
            study_uid="1.2.840.113619.2.55.3.281920192",
            patient_name="Tn. Budi Santoso",
            no_rm="RM-994021",
            usia=54,
            jenis_kelamin="Laki-laki",
            modalitas="CT Kepala Non-Kontras",
            waktu_tunggu_menit=12,
            status_pemeriksaan="MENUNGGU_VALIDASI",
            status_fhir="BELUM_DIKIRIM",
            skor_studi=0.94,
            skor_subtipe={
                "subdural": 0.91,
                "epidural": 0.18,
                "intraparenkim": 0.42,
                "subaraknoid": 0.29,
                "intraventrikel": 0.05
            },
            tier="MERAH",
            irisan_kunci=[14, 16, 18, 19, 21],
            heatmap_url="/static/heatmaps/std_18.png",
            draf_laporan=(
                "TEMUAN:\n"
                "Tampak area hiperdens berbentuk bulan sabit (crescent-shaped) pada regio frontoparietal hemisfer dekstra "
                "(irisan kunci #16, #18, #19) berukuran ketebalan maksimal ~14 mm yang mengindikasikan akumulasi hematoma ekstra-aksial. "
                "Sulkus kortikalis lokal tampak mendatar disertai penekanan ringan pada ventrikel lateral dekstra (midline shift < 2 mm). "
                "Diferensiasi substansia grisea-alba intraparenkim relatif terpelihara. Tidak tampak garis fraktur pada tulang kalvaria.\n\n"
                "KESAN:\n"
                "Dugaan perdarahan intrakranial subtipe Subdural Hemorrhage (SDH) fase akut pada regio hemisfer dekstra (skor studi 0.94). "
                "Efek desak massa minimal.\n\n"
                "CATATAN SISTEM:\n"
                "Dugaan AI, bukan diagnosis. Perlu konfirmasi dokter spesialis radiologi."
            ),
            versi_model="EfficientNet-B0 v1.0",
            ambang=0.50,
            waktu_inferensi=1.42,
            total_slices=32
        ),
        RadiologyStudy(
            study_uid="1.2.840.113619.2.55.3.489102941",
            patient_name="Ny. Sari Wijaya",
            no_rm="RM-994025",
            usia=61,
            jenis_kelamin="Perempuan",
            modalitas="CT Kepala Non-Kontras",
            waktu_tunggu_menit=4,
            status_pemeriksaan="MENUNGGU_VALIDASI",
            status_fhir="BELUM_DIKIRIM",
            skor_studi=0.86,
            skor_subtipe={
                "subdural": 0.12,
                "epidural": 0.08,
                "intraparenkim": 0.86,
                "subaraknoid": 0.35,
                "intraventrikel": 0.22
            },
            tier="MERAH",
            irisan_kunci=[13, 15, 17],
            heatmap_url="/static/heatmaps/std_15.png",
            draf_laporan=(
                "TEMUAN:\n"
                "Tampak lesi hiperdensitas intraparenkimal berbatas tegas pada ganglia basalis (regio putamen) dekstra "
                "berukuran ~2.8 x 2.1 x 3.0 cm disertai halo edema perifokal hipodens di sekelilingnya (irisan kunci #13, #15, #17). "
                "Tidak tampak ekstensi intraventrikular aktif.\n\n"
                "KESAN:\n"
                "Dugaan perdarahan intraserebral / intraparenkimal (ICH) akut pada ganglia basalis dekstra (skor studi 0.86) ec suspek hipertensif.\n\n"
                "CATATAN SISTEM:\n"
                "Dugaan AI, bukan diagnosis. Perlu konfirmasi dokter spesialis radiologi."
            ),
            versi_model="EfficientNet-B0 v1.0",
            ambang=0.50,
            waktu_inferensi=1.38,
            total_slices=32
        ),
        RadiologyStudy(
            study_uid="1.2.840.113619.2.55.3.119284712",
            patient_name="Tn. Andi Pratama",
            no_rm="RM-994018",
            usia=42,
            jenis_kelamin="Laki-laki",
            modalitas="CT Kepala Non-Kontras",
            waktu_tunggu_menit=45,
            status_pemeriksaan="MENUNGGU_VALIDASI",
            status_fhir="BELUM_DIKIRIM",
            skor_studi=0.12,
            skor_subtipe={
                "subdural": 0.05,
                "epidural": 0.02,
                "intraparenkim": 0.12,
                "subaraknoid": 0.08,
                "intraventrikel": 0.01
            },
            tier="NORMAL",
            irisan_kunci=[16],
            heatmap_url=None,
            draf_laporan=(
                "TEMUAN:\n"
                "Struktur parenkim serebri dan serebeli dalam batas normal. Diferensiasi substansia grisea-alba tegas. "
                "Sistem ventrikel dan sisterna basalis simetris, tidak melebar atau kolaps. "
                "Tidak tampak tanda perdarahan intra maupun ekstra-aksial. Tulang kalvaria intak.\n\n"
                "KESAN:\n"
                "Tidak tampak tanda perdarahan intrakranial akut atau efek massa patologis pada pemeriksaan CT kepala saat ini (skor studi 0.12).\n\n"
                "CATATAN SISTEM:\n"
                "Dugaan AI, bukan diagnosis. Perlu konfirmasi dokter spesialis radiologi."
            ),
            versi_model="EfficientNet-B0 v1.0",
            ambang=0.50,
            waktu_inferensi=1.24,
            total_slices=30
        ),
        RadiologyStudy(
            study_uid="1.2.840.113619.2.55.3.992817263",
            patient_name="Ny. Ratna Dewi",
            no_rm="RM-994015",
            usia=36,
            jenis_kelamin="Perempuan",
            modalitas="CT Kepala Non-Kontras",
            waktu_tunggu_menit=58,
            status_pemeriksaan="MENUNGGU_VALIDASI",
            status_fhir="BELUM_DIKIRIM",
            skor_studi=0.08,
            skor_subtipe={
                "subdural": 0.02,
                "epidural": 0.01,
                "intraparenkim": 0.08,
                "subaraknoid": 0.04,
                "intraventrikel": 0.01
            },
            tier="NORMAL",
            irisan_kunci=[15],
            heatmap_url=None,
            draf_laporan=(
                "TEMUAN:\n"
                "Evaluasi parenkim serebral supratentorial dan infratentorial menunjukkan densitas normal simetris. "
                "Tidak tampak lesi hiperdens akut. Struktur garis tengah tidak terdeviasi.\n\n"
                "KESAN:\n"
                "Pemeriksaan CT kepala non-kontras dalam batas normal (skor studi 0.08).\n\n"
                "CATATAN SISTEM:\n"
                "Dugaan AI, bukan diagnosis. Perlu konfirmasi dokter spesialis radiologi."
            ),
            versi_model="EfficientNet-B0 v1.0",
            ambang=0.50,
            waktu_inferensi=1.21,
            total_slices=32
        )
    ]

    for s in initial_records:
        db.add(s)
        # Tambahkan log awal
        log = AuditLog(
            study_uid=s.study_uid,
            timestamp=datetime.now(timezone.utc),
            event_type="TRIAGE_ASSIGNED",
            user="System / AI Engine",
            keterangan=f"Inferensi otomatis selesai (skor: {s.skor_studi}). Tier dialokasikan: [{s.tier}]."
        )
        db.add(log)

    db.commit()
