import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List
from app.core.config import settings

def build_fhir_r4_bundle(study: Dict[str, Any], is_final: bool = False) -> Dict[str, Any]:
    """
    Menyusun Bundle HL7 FHIR Release 4 yang valid untuk SATUSEHAT Kemenkes RI.
    Prinsip Human-in-the-Loop:
    - Jika is_final=False: status Observation & DiagnosticReport adalah 'preliminary'.
    - Jika is_final=True: status Observation & DiagnosticReport bermutasi menjadi 'final' setelah dokter menekan Setujui.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    
    fhir_ids = study.get("fhir_ids", {})
    pat_id = fhir_ids.get("patient", f"pat-ss-{uuid.uuid4().hex[:6]}")
    enc_id = fhir_ids.get("encounter", f"enc-ss-{uuid.uuid4().hex[:6]}")
    sr_id = fhir_ids.get("serviceRequest", f"sr-ss-{uuid.uuid4().hex[:6]}")
    img_id = fhir_ids.get("imagingStudy", f"img-ss-{uuid.uuid4().hex[:6]}")
    obs_id = fhir_ids.get("observation", f"obs-ss-{uuid.uuid4().hex[:6]}")
    dr_id = fhir_ids.get("diagnosticReport", f"dr-ss-{uuid.uuid4().hex[:6]}")
    
    study_uid = study.get("study_uid", "1.2.840.113619.2.55.3.default")
    skor_studi = study.get("skor_studi", 0.0)
    ambang = study.get("ambang", settings.DEFAULT_AMBANG)
    tier = study.get("tier", "NORMAL")
    nama_pasien = study.get("nama_pasien", "Pasien Anonim")
    no_rm = study.get("no_rm", "RM-000000")
    jenis_kelamin = "male" if study.get("jenis_kelamin") == "Laki-laki" else "female"
    draf_laporan = study.get("draf_laporan", {})
    temuan = draf_laporan.get("temuan", "Pemeriksaan CT Scan Kepala")
    kesan = draf_laporan.get("kesan", "Dalam batas normal")
    
    # Mutasi status Human-in-the-Loop
    clinical_status = "final" if is_final else "preliminary"
    
    bundle_id = f"bnd-ss-{uuid.uuid4().hex[:10]}"
    
    entries = [
        # 1. Resource Patient
        {
            "fullUrl": f"urn:uuid:{pat_id}",
            "resource": {
                "resourceType": "Patient",
                "id": pat_id,
                "meta": {
                    "profile": ["https://fhir.kemkes.go.id/r4/StructureDefinition/Patient"]
                },
                "identifier": [
                    {
                        "use": "official",
                        "system": "https://fhir.kemkes.go.id/id/nik",
                        "value": "3171010000000001"
                    },
                    {
                        "use": "usual",
                        "system": "http://simrs.hospital.id/id/mrn",
                        "value": no_rm
                    }
                ],
                "active": True,
                "name": [{"use": "official", "text": nama_pasien}],
                "gender": jenis_kelamin
            }
        },
        # 2. Resource Encounter
        {
            "fullUrl": f"urn:uuid:{enc_id}",
            "resource": {
                "resourceType": "Encounter",
                "id": enc_id,
                "meta": {
                    "profile": ["https://fhir.kemkes.go.id/r4/StructureDefinition/Encounter"]
                },
                "status": "in-progress" if not is_final else "finished",
                "class": {
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    "code": "EMER",
                    "display": "Emergency"
                },
                "subject": {"reference": f"Patient/{pat_id}", "display": nama_pasien}
            }
        },
        # 3. Resource ServiceRequest (Order SIM RS)
        {
            "fullUrl": f"urn:uuid:{sr_id}",
            "resource": {
                "resourceType": "ServiceRequest",
                "id": sr_id,
                "meta": {
                    "profile": ["https://fhir.kemkes.go.id/r4/StructureDefinition/ServiceRequest"]
                },
                "status": "completed" if is_final else "active",
                "intent": "order",
                "code": {
                    "coding": [
                        {
                            "system": "http://loinc.org",
                            "code": "24725-4",
                            "display": "CT Head non-contrast"
                        }
                    ]
                },
                "subject": {"reference": f"Patient/{pat_id}"},
                "encounter": {"reference": f"Encounter/{enc_id}"}
            }
        },
        # 4. Resource ImagingStudy
        {
            "fullUrl": f"urn:uuid:{img_id}",
            "resource": {
                "resourceType": "ImagingStudy",
                "id": img_id,
                "meta": {
                    "profile": ["https://fhir.kemkes.go.id/r4/StructureDefinition/ImagingStudy"]
                },
                "status": "available",
                "modality": [
                    {
                        "system": "http://dicom.nema.org/resources/ontology/DCM",
                        "code": "CT",
                        "display": "Computed Tomography"
                    }
                ],
                "subject": {"reference": f"Patient/{pat_id}"},
                "encounter": {"reference": f"Encounter/{enc_id}"},
                "basedOn": [{"reference": f"ServiceRequest/{sr_id}"}],
                "series": [
                    {
                        "uid": study_uid,
                        "modality": {"system": "http://dicom.nema.org/resources/ontology/DCM", "code": "CT"},
                        "numberOfInstances": study.get("total_slices", 32),
                        "description": "Non-contrast Brain CT axial series"
                    }
                ]
            }
        },
        # 5. Resource Observation (Temuan AI Smart Triaging)
        {
            "fullUrl": f"urn:uuid:{obs_id}",
            "resource": {
                "resourceType": "Observation",
                "id": obs_id,
                "meta": {
                    "profile": ["https://fhir.kemkes.go.id/r4/StructureDefinition/Observation"]
                },
                "status": clinical_status,  # preliminary -> final
                "category": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                "code": "imaging",
                                "display": "Imaging"
                            }
                        ]
                    }
                ],
                "code": {
                    "coding": [
                        {
                            "system": "http://loinc.org",
                            "code": "80709-9",
                            "display": "Intracranial hemorrhage finding in Head by CT"
                        }
                    ]
                },
                "subject": {"reference": f"Patient/{pat_id}"},
                "partOf": [{"reference": f"ImagingStudy/{img_id}"}],
                "valueQuantity": {
                    "value": round(skor_studi * 100, 1),
                    "unit": "%",
                    "system": "http://unitsofmeasure.org",
                    "code": "%"
                },
                "interpretation": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                                "code": "A" if tier == "MERAH" else "N",
                                "display": "Abnormal (High Priority Triage)" if tier == "MERAH" else "Normal"
                            }
                        ]
                    }
                ],
                "note": [
                    {
                        "text": f"Dugaan inferensi AI ({study.get('versi_model', 'EfficientNet-B0')}). Status: {clinical_status.upper()}."
                    }
                ]
            }
        },
        # 6. Resource DiagnosticReport (Laporan Akhir Radiologi)
        {
            "fullUrl": f"urn:uuid:{dr_id}",
            "resource": {
                "resourceType": "DiagnosticReport",
                "id": dr_id,
                "meta": {
                    "profile": ["https://fhir.kemkes.go.id/r4/StructureDefinition/DiagnosticReport"]
                },
                "status": clinical_status,  # preliminary -> final
                "category": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                                "code": "RAD",
                                "display": "Radiology"
                            }
                        ]
                    }
                ],
                "code": {
                    "coding": [
                        {
                            "system": "http://loinc.org",
                            "code": "24725-4",
                            "display": "CT Head non-contrast report"
                        }
                    ]
                },
                "subject": {"reference": f"Patient/{pat_id}"},
                "encounter": {"reference": f"Encounter/{enc_id}"},
                "basedOn": [{"reference": f"ServiceRequest/{sr_id}"}],
                "imagingStudy": [{"reference": f"ImagingStudy/{img_id}"}],
                "result": [{"reference": f"Observation/{obs_id}"}],
                "conclusion": kesan,
                "conclusionCode": [
                    {
                        "coding": [
                            {
                                "system": "http://snomed.info/sct",
                                "code": "1386000" if tier == "MERAH" else "17621005",
                                "display": "Intracranial hemorrhage" if tier == "MERAH" else "Normal finding"
                            }
                        ]
                    }
                ]
            }
        }
    ]
    
    return {
        "resourceType": "Bundle",
        "id": bundle_id,
        "type": "collection",
        "timestamp": timestamp,
        "entry": entries
    }
