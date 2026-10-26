import copy
from typing import List, Optional, Dict, Any
from app.models.triage import TriageStudy, SubtypeScores, KeySlice, DraftReport

INITIAL_STUDIES_DATA = [
    {
        "id": "std-00192",
        "study_uid": "1.2.840.113619.2.55.3.281920192",
        "nama_pasien": "Tn. Budi Santoso",
        "usia": 54,
        "jenis_kelamin": "Laki-laki",
        "no_rm": "RM-994021",
        "modalitas": "CT Kepala Non-Kontras",
        "tanggal": "15 Okt 2026, 10:14 WIB",
        "waktu_tunggu_menit": 12,
        "status": "Belum Dibaca",
        "total_slices": 32,
        "current_slice": 18,
        "skor_studi": 0.94,
        "skor_subtipe": {
            "subdural": 0.91,
            "epidural": 0.18,
            "intraparenkim": 0.42,
            "subaraknoid": 0.29,
            "intraventrikel": 0.05
        },
        "tier": "MERAH",
        "irisan_kunci": [
            {"slice": 14, "score": 0.82, "isPeak": False, "note": "Penebalan ekstra-aksial fokal"},
            {"slice": 16, "score": 0.89, "isPeak": False, "note": "Hiperdensitas kresentik awal"},
            {"slice": 18, "score": 0.94, "isPeak": True, "note": "Ketebalan puncak ~14mm"},
            {"slice": 19, "score": 0.88, "isPeak": False, "note": "Kompresi sulkus parietalis"},
            {"slice": 21, "score": 0.65, "isPeak": False, "note": "Perluasan parietal superior"}
        ],
        "heatmap": {"overlay_type": "grad_cam", "focus_slice": 18, "intensity": 0.94},
        "draf_laporan": {
            "temuan": "Tampak area hiperdens berbentuk bulan sabit (crescent-shaped) pada regio frontoparietal hemisfer dekstra (lihat irisan kunci #16, #18, #19) berukuran ketebalan maksimal ~14 mm yang mengindikasikan akumulasi hematoma ekstra-aksial. Sulkus kortikalis lokal tampak mendatar disertai penekanan ringan pada ventrikel lateral dekstra (midline shift < 2 mm). Diferensiasi substansia grisea-alba intraparenkim relatif terpelihara. Tidak tampak garis fraktur pada tulang kalvaria.",
            "kesan": "Mengarah pada dugaan perdarahan intrakranial subtipe Subdural Hemorrhage (SDH) fase akut pada regio hemisfer dekstra. Efek desak massa minimal.",
            "catatan_wajib": "Perlu konfirmasi dan validasi dokter spesialis radiologi."
        },
        "versi_model": "EfficientNet-B0 v1.2",
        "ambang": 0.50,
        "waktu_inferensi": "14.2 Detik",
        "fhir_ids": {
            "patient": "pat-ss-99201",
            "encounter": "enc-ss-88102",
            "serviceRequest": "sr-ss-77310",
            "imagingStudy": "img-ss-66421",
            "observation": "obs-ss-55019",
            "diagnosticReport": "dr-ss-44912"
        },
        "audit_metrics": {
            "waktu_inferensi": "14.2 Detik",
            "target_latensi": "< 60 Detik",
            "status_target": "Memenuhi Target (< 60 Detik)",
            "versi_model": "EfficientNet-B0 v1.2",
            "ambang_triase": 0.50,
            "arsitektur": "CNN Multi-label 6-Class + Grad-CAM",
            "status_konektor": "Terkirim ke Environment Uji",
            "http_status": "HTTP 200 OK (Idempoten)"
        },
        "audit_logs": [
            {"time": "10:14:02", "text": "DICOM diterima oleh Orthanc PACS (study_uid: 1.2.840.113619.2.55.3.281920192, 32 seri instans CT)."},
            {"time": "10:14:16", "text": "Inferensi PyTorch selesai (waktu_inferensi: 14.2s). Tier: MERAH (skor_studi: 0.94). Subtipe: Subdural (0.91). Status Observation: preliminary."},
            {"time": "10:14:17", "text": "Smart Triaging: Kasus dinaikkan ke urutan teratas antrean dokter SIM RS."}
        ]
    },
    {
        "id": "std-00195",
        "study_uid": "1.2.840.113619.2.55.3.489102941",
        "nama_pasien": "Ny. Sari Wijaya",
        "usia": 61,
        "jenis_kelamin": "Perempuan",
        "no_rm": "RM-994025",
        "modalitas": "CT Kepala Non-Kontras",
        "tanggal": "15 Okt 2026, 10:22 WIB",
        "waktu_tunggu_menit": 4,
        "status": "Belum Dibaca",
        "total_slices": 32,
        "current_slice": 15,
        "skor_studi": 0.86,
        "skor_subtipe": {
            "subdural": 0.12,
            "epidural": 0.08,
            "intraparenkim": 0.86,
            "subaraknoid": 0.35,
            "intraventrikel": 0.22
        },
        "tier": "MERAH",
        "irisan_kunci": [
            {"slice": 13, "score": 0.72, "isPeak": False, "note": "Edema perifer ganglia basalis"},
            {"slice": 15, "score": 0.86, "isPeak": True, "note": "Hematoma putamen dekstra"},
            {"slice": 17, "score": 0.80, "isPeak": False, "note": "Pendorongan kapsula interna"}
        ],
        "heatmap": {"overlay_type": "grad_cam", "focus_slice": 15, "intensity": 0.86},
        "draf_laporan": {
            "temuan": "Tampak lesi hiperdensitas intraparenkimal berbatas tegas pada ganglia basalis (regio putamen) dekstra berukuran ~2.8 x 2.1 x 3.0 cm disertai halo edema perifokal hipodens di sekelilingnya (lihat irisan kunci #13, #15, #17). Tidak tampak ekstensi intraventrikular aktif.",
            "kesan": "Mengarah pada dugaan perdarahan intraserebral / intraparenkimal (ICH) akut pada ganglia basalis dekstra ec suspek hipertensif.",
            "catatan_wajib": "Perlu konfirmasi dan validasi dokter spesialis radiologi."
        },
        "versi_model": "EfficientNet-B0 v1.2",
        "ambang": 0.50,
        "waktu_inferensi": "13.8 Detik",
        "fhir_ids": {
            "patient": "pat-ss-99205",
            "encounter": "enc-ss-88106",
            "serviceRequest": "sr-ss-77314",
            "imagingStudy": "img-ss-66425",
            "observation": "obs-ss-55023",
            "diagnosticReport": "dr-ss-44916"
        },
        "audit_metrics": {
            "waktu_inferensi": "13.8 Detik",
            "target_latensi": "< 60 Detik",
            "status_target": "Memenuhi Target (< 60 Detik)",
            "versi_model": "EfficientNet-B0 v1.2",
            "ambang_triase": 0.50,
            "arsitektur": "CNN Multi-label 6-Class + Grad-CAM",
            "status_konektor": "Terkirim ke Environment Uji",
            "http_status": "HTTP 200 OK (Idempoten)"
        },
        "audit_logs": [
            {"time": "10:22:01", "text": "DICOM diterima oleh Orthanc PACS (study_uid: 1.2.840.113619.2.55.3.489102941, 32 seri instans CT)."},
            {"time": "10:22:15", "text": "Inferensi PyTorch selesai (waktu_inferensi: 13.8s). Tier: MERAH (skor_studi: 0.86). Subtipe: Intraparenkim (0.86). Status Observation: preliminary."},
            {"time": "10:22:16", "text": "Smart Triaging: Kasus ditempatkan pada kluster darurat teratas."}
        ]
    },
    {
        "id": "std-00188",
        "study_uid": "1.2.840.113619.2.55.3.119284712",
        "nama_pasien": "Tn. Andi Pratama",
        "usia": 42,
        "jenis_kelamin": "Laki-laki",
        "no_rm": "RM-994018",
        "modalitas": "CT Kepala Non-Kontras",
        "tanggal": "15 Okt 2026, 09:41 WIB",
        "waktu_tunggu_menit": 45,
        "status": "Belum Dibaca",
        "total_slices": 30,
        "current_slice": 16,
        "skor_studi": 0.12,
        "skor_subtipe": {
            "subdural": 0.05,
            "epidural": 0.02,
            "intraparenkim": 0.12,
            "subaraknoid": 0.08,
            "intraventrikel": 0.01
        },
        "tier": "NORMAL",
        "irisan_kunci": [
            {"slice": 16, "score": 0.12, "isPeak": True, "note": "Parenkim serebral normal"}
        ],
        "heatmap": None,
        "draf_laporan": {
            "temuan": "Struktur parenkim serebri dan serebeli dalam batas normal. Diferensiasi substansia grisea-alba tegas. Sistem ventrikel dan sisterna basalis simetris, tidak melebar atau kolaps. Tidak tampak tanda perdarahan intra maupun ekstra-aksial. Tulang kalvaria intak.",
            "kesan": "Tidak tampak tanda perdarahan intrakranial akut atau efek massa patologis pada pemeriksaan CT kepala non-kontras saat ini.",
            "catatan_wajib": "Perlu konfirmasi dan validasi dokter spesialis radiologi."
        },
        "versi_model": "EfficientNet-B0 v1.2",
        "ambang": 0.50,
        "waktu_inferensi": "12.4 Detik",
        "fhir_ids": {
            "patient": "pat-ss-99198",
            "encounter": "enc-ss-88099",
            "serviceRequest": "sr-ss-77307",
            "imagingStudy": "img-ss-66418",
            "observation": "obs-ss-55015",
            "diagnosticReport": "dr-ss-44908"
        },
        "audit_metrics": {
            "waktu_inferensi": "12.4 Detik",
            "target_latensi": "< 60 Detik",
            "status_target": "Memenuhi Target (< 60 Detik)",
            "versi_model": "EfficientNet-B0 v1.2",
            "ambang_triase": 0.50,
            "arsitektur": "CNN Multi-label 6-Class + Grad-CAM",
            "status_konektor": "Terkirim ke Environment Uji",
            "http_status": "HTTP 200 OK (Idempoten)"
        },
        "audit_logs": [
            {"time": "09:41:00", "text": "DICOM diterima oleh Orthanc PACS (study_uid: 1.2.840.113619.2.55.3.119284712, 30 seri instans CT)."},
            {"time": "09:41:12", "text": "Inferensi PyTorch selesai (waktu_inferensi: 12.4s). Tier: NORMAL (skor_studi: 0.12). Status Observation: preliminary."},
            {"time": "09:41:13", "text": "Smart Triaging: Kasus normal mempertahankan posisi antrean standar (FIFO)."}
        ]
    }
]

class InMemoryState:
    def __init__(self):
        self._studies: Dict[str, Dict[str, Any]] = {}
        for s in INITIAL_STUDIES_DATA:
            self._studies[s["study_uid"]] = copy.deepcopy(s)
            self._studies[s["id"]] = self._studies[s["study_uid"]]

    def get_all(self) -> List[Dict[str, Any]]:
        # Return unique studies
        seen = set()
        result = []
        for s in self._studies.values():
            if s["study_uid"] not in seen:
                seen.add(s["study_uid"])
                result.append(copy.deepcopy(s))
        return result

    def get_by_uid(self, identifier: str) -> Optional[Dict[str, Any]]:
        if identifier in self._studies:
            return copy.deepcopy(self._studies[identifier])
        return None

    def save(self, study_data: Dict[str, Any]):
        uid = study_data["study_uid"]
        sid = study_data.get("id", uid)
        self._studies[uid] = study_data
        self._studies[sid] = study_data

state = InMemoryState()
