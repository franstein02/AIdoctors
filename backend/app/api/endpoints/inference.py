from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request, Depends
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.ai_engine import engine
from app.core.config import settings
from app.core.database import get_db
from app.models.database import RadiologyStudy

router = APIRouter(prefix="/inference", tags=["Pipeline Inferensi AI CT Kepala"])

class SubtypeScoresResponse(BaseModel):
    epidural: float = Field(..., description="Probabilitas perdarahan epidural (EDH)")
    intraparenkim: float = Field(..., description="Probabilitas perdarahan intraparenkim (IPH)")
    intraventrikel: float = Field(..., description="Probabilitas perdarahan intraventrikel (IVH)")
    subaraknoid: float = Field(..., description="Probabilitas perdarahan subaraknoid (SAH)")
    subdural: float = Field(..., description="Probabilitas perdarahan subdural (SDH)")

class InferenceResponse(BaseModel):
    study_uid: str = Field(..., description="DICOM Study Instance UID")
    skor_studi: float = Field(..., description="Probabilitas kumulatif perdarahan intrakranial [0.0 - 1.0]")
    skor_subtipe: SubtypeScoresResponse = Field(..., description="Probabilitas 5 subtipe perdarahan intrakranial")
    tier: str = Field(..., description="Klasifikasi prioritas triase ('MERAH' atau 'NORMAL')")
    irisan_kunci: List[int] = Field(..., description="Daftar nomor irisan aksial dengan temuan paling signifikan")
    heatmap_url: str = Field(..., description="URL statis citra overlay Grad-CAM untuk ditampilkan di viewer")
    draf_laporan: str = Field(..., description="Draf laporan radiologi terstruktur berbasis templat klinis")
    versi_model: str = Field(..., description="Versi model EfficientNet-B0")
    ambang: float = Field(..., description="Ambang batas probabilitas untuk eskalasi triase")
    waktu_inferensi: float = Field(..., description="Durasi proses inferensi dalam detik")

@router.post("/analyze", response_model=InferenceResponse)
async def analyze_ct_study(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Endpoint Inferensi CT Kepala:
    - Menerima JSON body maupun unggahan multipart/form-data (.dcm atau .nii / .nii.gz)
    - Menjalankan pra-proses 3-windowing Hounsfield Unit (HU)
    - Menjalankan inferensi EfficientNet-B0
    - Menghasilkan heatmap Grad-CAM pada lapisan konvolusi terakhir (model.features[-1])
    - Menghasilkan Draf Laporan Radiologi terstruktur (TEMUAN, KESAN, CATATAN SISTEM)
    - Menyimpan/memperbarui studi ke dalam basis data SIM RS
    - Mengembalikan respons JSON sesuai Kontrak Data Baku 10 variabel.
    """
    try:
        content_type = request.headers.get("content-type", "").lower()
        file_content = None
        filename = ""
        study_uid = None
        ambang = settings.DEFAULT_AMBANG
        simulate_case = None

        if "multipart/form-data" in content_type:
            form = await request.form()
            file = form.get("file")
            if file and hasattr(file, "read"):
                file_content = await file.read()
                filename = getattr(file, "filename", "") or ""
            study_uid = form.get("study_uid")
            if form.get("ambang"):
                ambang = float(form.get("ambang"))
            simulate_case = form.get("simulate_case")
        else:
            try:
                body = await request.json()
                study_uid = body.get("study_uid")
                if "ambang" in body:
                    ambang = float(body.get("ambang"))
                simulate_case = body.get("simulate_case")
            except Exception:
                pass

        # Eksekusi pipeline analisis AI
        result = engine.analyze(
            file_content=file_content,
            filename=filename,
            study_uid=study_uid,
            ambang=ambang,
            simulate_case=simulate_case
        )

        eff_uid = result["study_uid"]
        patient_name = "Pasien Baru"
        import time
        no_rm = f"RM-{int(time.time())%1000000:06d}"
        usia = 50
        jenis_kelamin = "Laki-laki"

        if "multipart/form-data" in content_type and 'form' in locals():
            patient_name = form.get("patient_name") or form.get("nama_pasien") or patient_name
            no_rm = form.get("no_rm") or no_rm
            if form.get("usia"):
                try:
                    usia = int(form.get("usia"))
                except Exception:
                    pass
            jenis_kelamin = form.get("jenis_kelamin") or jenis_kelamin
        elif 'body' in locals() and isinstance(body, dict):
            patient_name = body.get("patient_name") or body.get("nama_pasien") or patient_name
            no_rm = body.get("no_rm") or no_rm
            if body.get("usia"):
                try:
                    usia = int(body.get("usia"))
                except Exception:
                    pass
            jenis_kelamin = body.get("jenis_kelamin") or jenis_kelamin

        if "test" in eff_uid:
            patient_name = "Tn. Budi (Uji Klinis)"

        existing = db.query(RadiologyStudy).filter(RadiologyStudy.study_uid == eff_uid).first()
        from app.models.database import AuditLog

        if not existing:
            new_study = RadiologyStudy(
                study_uid=eff_uid,
                patient_name=patient_name,
                no_rm=no_rm,
                usia=usia,
                jenis_kelamin=jenis_kelamin,
                modalitas="CT Kepala Non-Kontras",
                waktu_tunggu_menit=1,
                status_pemeriksaan="MENUNGGU_VALIDASI",
                status_fhir="BELUM_DIKIRIM",
                skor_studi=result["skor_studi"],
                skor_subtipe=result["skor_subtipe"],
                tier=result["tier"],
                irisan_kunci=result["irisan_kunci"],
                heatmap_url=result["heatmap_url"],
                draf_laporan=result["draf_laporan"],
                versi_model=result["versi_model"],
                ambang=result["ambang"],
                waktu_inferensi=result["waktu_inferensi"],
                total_slices=result.get("total_slices", 32)
            )
            db.add(new_study)
            
            # Catat jejak audit awal
            log_item = AuditLog(
                study_uid=eff_uid,
                event_type="TRIAGE_ASSIGNED",
                user="AI Smart Triaging",
                keterangan=f"Inferensi real-time selesai ({result['waktu_inferensi']}s). Tier: {result['tier']}, Skor: {result['skor_studi']}."
            )
            db.add(log_item)
            db.commit()
        else:
            existing.skor_studi = result["skor_studi"]
            existing.skor_subtipe = result["skor_subtipe"]
            existing.tier = result["tier"]
            existing.irisan_kunci = result["irisan_kunci"]
            existing.draf_laporan = result["draf_laporan"]
            existing.total_slices = result.get("total_slices", existing.total_slices)
            existing.heatmap_url = result["heatmap_url"]
            db.commit()

        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan saat memproses inferensi citra CT: {str(e)}"
        )
