from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.services.triage import (
    get_sorted_queue,
    get_case_by_uid,
    execute_doctor_action,
    seed_initial_studies_if_empty
)

router = APIRouter(tags=["Antrean Radiologi & Manajemen Kasus"])

# Skema Request untuk Aksi Dokter
class DoctorActionRequest(BaseModel):
    action: Literal["SETUJUI", "EDIT", "TOLAK"] = Field(
        ..., 
        description="Pilihan aksi klinis dokter: 'SETUJUI', 'EDIT', atau 'TOLAK'"
    )
    laporan_baru: Optional[str] = Field(
        None, 
        description="Teks laporan yang telah disunting oleh dokter (wajib diisi jika action='EDIT')"
    )
    alasan: Optional[str] = Field(
        None, 
        description="Alasan penolakan draf AI (digunakan jika action='TOLAK')"
    )
    user: Optional[str] = Field(
        "Dr. Ahmad Fauzi, Sp.Rad", 
        description="Identitas dokter spesialis radiologi yang mengeksekusi aksi"
    )
    doctor_notes: Optional[str] = Field(
        None,
        description="Catatan klinis dokter radiologi (alternatif laporan_baru)"
    )
    report_text: Optional[str] = Field(
        None,
        description="Teks laporan draf/final dari dokter (alias laporan_baru)"
    )

@router.get("/queue", response_model=List[Dict[str, Any]])
def get_triage_queue_endpoint(db: Session = Depends(get_db)):
    """
    Mengembalikan daftar antrean pasien radiologi yang telah diurutkan sesuai aturan Smart Triaging:
    1. Kasus [ MERAH ] (Darurat) selalu berada di urutan teratas:
       - Diurutkan berdasarkan skor_studi tertinggi (DESC).
       - Lalu waktu_tunggu_menit terlama (DESC).
    2. Kasus [ NORMAL ] (Rutin) diletakkan setelah seluruh baris Merah:
       - Diurutkan murni berdasarkan waktu kedatangan / FIFO (waktu_tunggu_menit DESC).
    """
    seed_initial_studies_if_empty(db)
    studies = get_sorted_queue(db)
    return [s.to_dict() for s in studies]

@router.get("/cases/{study_uid}", response_model=Dict[str, Any])
def get_case_detail_endpoint(study_uid: str, db: Session = Depends(get_db)):
    """
    Mengembalikan rincian lengkap satu kasus pemeriksaan radiologi:
    - Metadata pasien & status operasional
    - Irisan kunci, heatmap Grad-CAM, dan skor subtipe perdarahan
    - Draf laporan radiologi dan jejak audit kronologis
    """
    seed_initial_studies_if_empty(db)
    study = get_case_by_uid(db, study_uid)
    if not study:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kasus pemeriksaan radiologi dengan Study UID '{study_uid}' tidak ditemukan."
        )
    data = study.to_dict()
    from app.services.nii_renderer import get_nii_path_by_study
    from app.services.ai_engine import ai_engine_service
    import os

    nii_path = get_nii_path_by_study(study_uid)
    if nii_path and os.path.exists(nii_path):
        analysis = ai_engine_service.analyze_nii_volume(nii_path)
        if study.status_pemeriksaan == "MENUNGGU_VALIDASI":
            study.skor_studi = analysis["skor_studi"]
            study.skor_subtipe = analysis["skor_subtipe"]
            study.tier = analysis["tier"]
            study.irisan_kunci = analysis["irisan_kunci"]
            study.draf_laporan = analysis["draf_laporan"]
            study.total_slices = analysis["total_slices"]
            study.heatmap_url = f"/api/v1/cases/{study_uid}/slices/{analysis['top_slice_idx']}?gradcam=true"
            db.commit()
            data = study.to_dict()
            data["draf_laporan"] = analysis["draf_laporan"]
            data["skor_subtipe"] = analysis["skor_subtipe"]
            data["skor_studi"] = analysis["skor_studi"]
            data["tier"] = analysis["tier"]

        data["total_slices"] = analysis["total_slices"]
        data["current_slice"] = analysis["top_slice_idx"]
        data["top_slice_idx"] = analysis["top_slice_idx"]
        data["irisan_kunci"] = analysis["irisan_kunci"]
        data["heatmap_url"] = f"/api/v1/cases/{study_uid}/slices/{analysis['top_slice_idx']}?gradcam=true"
    return data

@router.post("/cases/{study_uid}/action", response_model=Dict[str, Any])
def perform_doctor_action_endpoint(
    study_uid: str,
    payload: DoctorActionRequest,
    db: Session = Depends(get_db)
):
    """
    Menerima dan memproses keputusan dokter spesialis radiologi:
    - action = 'SETUJUI':
        Simpan draf_laporan sebagai laporan final, ubah status kasus menjadi SELESAI_ACC,
        dan picu pengiriman FHIR SATUSEHAT (status_fhir = 'TERKIRIM').
    - action = 'EDIT':
        Menerima teks laporan baru dari dokter, simpan sebagai laporan final,
        ubah status menjadi SELESAI_ACC, dan picu pengiriman FHIR (status_fhir = 'TERKIRIM').
    - action = 'TOLAK':
        Kosongkan draf templat AI, ubah status kasus menjadi DITOLAK_MENUNGGU_MANUAL,
        catat alasan penolakan di AuditLog, dan jangan picu pengiriman FHIR (status_fhir = 'BELUM_DIKIRIM').
    """
    seed_initial_studies_if_empty(db)
    try:
        updated_study = execute_doctor_action(
            db=db,
            study_uid=study_uid,
            action=payload.action,
            laporan_baru=payload.report_text or payload.laporan_baru or payload.doctor_notes,
            alasan=payload.alasan or payload.doctor_notes,
            user=payload.user or "Dr. Ahmad Fauzi, Sp.Rad"
        )
        return {
            "success": True,
            "message": f"Aksi '{payload.action}' berhasil diproses untuk studi {study_uid}.",
            "data": updated_study.to_dict()
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terjadi kesalahan saat memproses keputusan dokter: {str(e)}"
        )

@router.get("/cases/{study_uid}/slice")
def get_slice_image_endpoint(
    study_uid: str,
    index: int = 16,
    gradcam: bool = False,
    opacity: float = 0.6
):
    """
    Menghasilkan citra PNG irisan CT scan kepala secara langsung dari volume NIfTI riil (CT.nii).
    """
    from fastapi.responses import Response
    from app.services.nii_renderer import get_nii_path_by_study, render_ct_slice

    nii_path = get_nii_path_by_study(study_uid)
    if not nii_path:
        raise HTTPException(status_code=404, detail="Berkas CT.nii kasus ini tidak ditemukan.")

    try:
        image_bytes = render_ct_slice(nii_path, index, apply_gradcam=gradcam, opacity=opacity)
        return Response(content=image_bytes, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/cases/{study_uid}/metadata")
def get_case_metadata_endpoint(study_uid: str):
    """
    Mengembalikan metadata volume NIfTI kasus (total irisan asli, dsb).
    """
    from app.services.nii_renderer import get_nii_metadata
    return get_nii_metadata(study_uid)

