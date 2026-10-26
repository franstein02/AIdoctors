from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict, Any

from app.core.database import get_db
from app.models.database import RadiologyStudy, FhirTransmissionLog
from app.services.fhir_builder import build_fhir_bundle, transmit_fhir_bundle_to_satusehat
from app.services.triage import get_case_by_uid, seed_initial_studies_if_empty

router = APIRouter(prefix="/satusehat", tags=["Konektor & Interoperabilitas HL7 FHIR SATUSEHAT"])

@router.get("/logs", response_model=List[Dict[str, Any]])
def get_satusehat_transmission_logs(db: Session = Depends(get_db)):
    """
    Menampilkan seluruh riwayat pengiriman Bundle HL7 FHIR R4 ke SATUSEHAT:
    - Status transmisi (HTTP 200 OK Idempoten / Gagal)
    - Kunci idempotensi (X-Idempotency-Key)
    - Jumlah percobaan (retry count)
    - Stempel waktu pengiriman
    """
    seed_initial_studies_if_empty(db)
    logs = db.query(FhirTransmissionLog).order_by(desc(FhirTransmissionLog.timestamp)).all()
    return [log.to_dict() for log in logs]

@router.get("/preview/{study_uid}", response_model=Dict[str, Any])
@router.get("/bundle/{study_uid}", response_model=Dict[str, Any])
def preview_fhir_bundle_endpoint(study_uid: str, db: Session = Depends(get_db)):
    """
    Menampilkan pratinjau (preview) struktur JSON Bundle HL7 FHIR Release 4
    yang disusun secara terstandar untuk demonstrasi teknis dan audit kepatuhan:
    - Resource Patient & Encounter (IHS Number simulasi)
    - Resource ServiceRequest (Kode LOINC: 30799-1)
    - Resource ImagingStudy (Metadata DICOM)
    - Resource Observation (Status: final, temuan disetujui dokter, tanpa nilai numerik publik)
    - Resource DiagnosticReport (Status: final, kesimpulan lengkap)
    """
    seed_initial_studies_if_empty(db)
    study = get_case_by_uid(db, study_uid)
    if not study:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Studi radiologi dengan Study UID '{study_uid}' tidak ditemukan."
        )

    # Susun Bundle HL7 FHIR R4 Transaction
    bundle = build_fhir_bundle(study)
    return bundle

@router.post("/send/{study_uid}", response_model=Dict[str, Any])
def send_fhir_bundle_endpoint(study_uid: str, db: Session = Depends(get_db)):
    """
    Endpoint pemicu pengiriman Bundle FHIR ke gateway SATUSEHAT secara idempoten:
    - Memverifikasi otorisasi persetujuan dokter (status_pemeriksaan == 'SELESAI_ACC')
    - Mengirim dengan header X-Idempotency-Key
    - Mekanisme retry hingga 3x jika koneksi gagal
    """
    seed_initial_studies_if_empty(db)
    study = get_case_by_uid(db, study_uid)
    if not study:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Studi radiologi dengan Study UID '{study_uid}' tidak ditemukan."
        )

    # Guard Human-in-the-Loop: hanya studi yang telah disetujui/SELESAI_ACC yang boleh dikirim
    if study.status_pemeriksaan not in ["SELESAI_ACC"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Prinsip Human-in-the-Loop dilanggar: Studi '{study_uid}' berstatus '{study.status_pemeriksaan}'. "
                "Hanya kasus berstatus 'SELESAI_ACC' (telah disetujui dokter) yang dapat ditransmisikan ke SATUSEHAT."
            )
        )

    success, response_data, trans_log = transmit_fhir_bundle_to_satusehat(db, study)
    return {
        "success": success,
        "transmission_log": trans_log.to_dict(),
        "satusehat_response": response_data,
        "duplicate_prevented": True
    }
