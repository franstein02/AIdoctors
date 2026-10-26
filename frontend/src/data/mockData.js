// Data Kontrak & Data Sintetis Pasien AIdoctors Middleware (FastAPI / PostgreSQL / SATUSEHAT)

export const INITIAL_PATIENTS = [
  {
    id: "std-00192",
    study_uid: "1.2.840.113619.2.55.3.281920192",
    nama_pasien: "Tn. Budi Santoso",
    usia: 54,
    jenis_kelamin: "Laki-laki",
    no_rm: "RM-994021",
    modalitas: "CT Kepala Non-Kontras",
    tanggal: "15 Okt 2026, 10:14 WIB",
    tier: "MERAH", // MERAH (Kritis) atau NORMAL
    tier_label: "Darurat",
    skor_studi: 0.94,
    tingkat_keparahan: "Sangat Tinggi",
    subtipe_dominan: "Subdural",
    skor_subtipe: {
      subdural: 0.91,
      epidural: 0.18,
      intraparenkim: 0.42,
      subaraknoid: 0.29,
      intraventrikel: 0.05
    },
    waktu_tunggu: "12 Menit",
    waktu_tunggu_menit: 12,
    status: "Belum Dibaca", // "Belum Dibaca", "Sedang Diperiksa", "Selesai - FHIR Terkirim"
    total_slices: 32,
    current_slice: 18,
    irisan_kunci: [
      { slice: 14, score: 0.82, note: "Penebalan ekstra-aksial fokal" },
      { slice: 16, score: 0.89, note: "Hiperdensitas kresentik awal" },
      { slice: 18, score: 0.94, isPeak: true, note: "Ketebalan puncak ~14mm" },
      { slice: 19, score: 0.88, note: "Kompresi sulkus parietalis" },
      { slice: 21, score: 0.65, note: "Perluasan parietal superior" }
    ],
    lesion_type: "subdural",
    draf_laporan: {
      temuan: "Tampak area hiperdens berbentuk bulan sabit (crescent-shaped) pada regio frontoparietal hemisfer dekstra (lihat irisan kunci #16, #18, #19) berukuran ketebalan maksimal ~14 mm yang mengindikasikan akumulasi hematoma ekstra-aksial. Sulkus kortikalis lokal tampak mendatar disertai penekanan ringan pada ventrikel lateral dekstra (midline shift < 2 mm). Diferensiasi substansia grisea-alba intraparenkim relatif terpelihara. Tidak tampak garis fraktur pada tulang kalvaria.",
      kesan: "Mengarah pada dugaan perdarahan intrakranial subtipe Subdural Hemorrhage (SDH) fase akut pada regio hemisfer dekstra. Efek desak massa minimal.",
      catatan_wajib: "Perlu konfirmasi dan validasi dokter spesialis radiologi."
    },
    fhir_ids: {
      patient: "pat-ss-99201",
      encounter: "enc-ss-88102",
      serviceRequest: "sr-ss-77310",
      imagingStudy: "img-ss-66421",
      observation: "obs-ss-55019",
      diagnosticReport: "dr-ss-44912"
    },
    audit_metrics: {
      waktu_inferensi: "14.2 Detik",
      target_latensi: "< 60 Detik",
      status_target: "Memenuhi Target (< 60 Detik)",
      versi_model: "EfficientNet-B0 v1.2",
      ambang_triase: 0.50,
      arsitektur: "CNN Multi-label 6-Class + Grad-CAM",
      status_konektor: "Terkirim ke Environment Uji",
      http_status: "HTTP 200 OK (Idempoten)"
    },
    audit_logs: [
      { time: "10:14:02", text: "DICOM diterima oleh Orthanc PACS (study_uid: std-00192, 32 seri instans CT)." },
      { time: "10:14:16", text: "Inferensi PyTorch selesai (waktu_inferensi: 14.2s). Tier: MERAH (skor_studi: 0.94). Subtipe: Subdural (0.91). Status Observation: preliminary." },
      { time: "10:14:17", text: "Smart Triaging: Kasus dinaikkan ke urutan teratas antrean dokter SIM RS." }
    ]
  },
  {
    id: "std-00195",
    study_uid: "1.2.840.113619.2.55.3.489102941",
    nama_pasien: "Ny. Sari Wijaya",
    usia: 61,
    jenis_kelamin: "Perempuan",
    no_rm: "RM-994025",
    modalitas: "CT Kepala Non-Kontras",
    tanggal: "15 Okt 2026, 10:22 WIB",
    tier: "MERAH",
    tier_label: "Darurat",
    skor_studi: 0.86,
    tingkat_keparahan: "Tinggi",
    subtipe_dominan: "Intraparenkim",
    skor_subtipe: {
      subdural: 0.12,
      epidural: 0.08,
      intraparenkim: 0.86,
      subaraknoid: 0.35,
      intraventrikel: 0.22
    },
    waktu_tunggu: "04 Menit",
    waktu_tunggu_menit: 4,
    status: "Belum Dibaca",
    total_slices: 32,
    current_slice: 15,
    irisan_kunci: [
      { slice: 13, score: 0.72, note: "Edema perifer ganglia basalis" },
      { slice: 15, score: 0.86, isPeak: true, note: "Hematoma putamen dekstra" },
      { slice: 17, score: 0.80, note: "Pendorongan kapsula interna" }
    ],
    lesion_type: "intraparenchymal",
    draf_laporan: {
      temuan: "Tampak lesi hiperdensitas intraparenkimal berbatas tegas pada ganglia basalis (regio putamen) dekstra berukuran ~2.8 x 2.1 x 3.0 cm disertai halo edema perifokal hipodens di sekelilingnya (lihat irisan kunci #13, #15, #17). Tidak tampak ekstensi intraventrikular aktif.",
      kesan: "Mengarah pada dugaan perdarahan intraserebral / intraparenkimal (ICH) akut pada ganglia basalis dekstra ec suspek hipertensif.",
      catatan_wajib: "Perlu konfirmasi dan validasi dokter spesialis radiologi."
    },
    fhir_ids: {
      patient: "pat-ss-99205",
      encounter: "enc-ss-88106",
      serviceRequest: "sr-ss-77314",
      imagingStudy: "img-ss-66425",
      observation: "obs-ss-55023",
      diagnosticReport: "dr-ss-44916"
    },
    audit_metrics: {
      waktu_inferensi: "13.8 Detik",
      target_latensi: "< 60 Detik",
      status_target: "Memenuhi Target (< 60 Detik)",
      versi_model: "EfficientNet-B0 v1.2",
      ambang_triase: 0.50,
      arsitektur: "CNN Multi-label 6-Class + Grad-CAM",
      status_konektor: "Terkirim ke Environment Uji",
      http_status: "HTTP 200 OK (Idempoten)"
    },
    audit_logs: [
      { time: "10:22:01", text: "DICOM diterima oleh Orthanc PACS (study_uid: std-00195, 32 seri instans CT)." },
      { time: "10:22:15", text: "Inferensi PyTorch selesai (waktu_inferensi: 13.8s). Tier: MERAH (skor_studi: 0.86). Subtipe: Intraparenkim (0.86). Status Observation: preliminary." },
      { time: "10:22:16", text: "Smart Triaging: Kasus ditempatkan pada kluster darurat teratas." }
    ]
  },
  {
    id: "std-00188",
    study_uid: "1.2.840.113619.2.55.3.119284712",
    nama_pasien: "Tn. Andi Pratama",
    usia: 42,
    jenis_kelamin: "Laki-laki",
    no_rm: "RM-994018",
    modalitas: "CT Kepala Non-Kontras",
    tanggal: "15 Okt 2026, 09:41 WIB",
    tier: "NORMAL",
    tier_label: "Normal",
    skor_studi: 0.12,
    tingkat_keparahan: "Rendah",
    subtipe_dominan: "-",
    skor_subtipe: {
      subdural: 0.05,
      epidural: 0.02,
      intraparenkim: 0.12,
      subaraknoid: 0.08,
      intraventrikel: 0.01
    },
    waktu_tunggu: "45 Menit",
    waktu_tunggu_menit: 45,
    status: "Belum Dibaca",
    total_slices: 30,
    current_slice: 16,
    irisan_kunci: [
      { slice: 16, score: 0.12, isPeak: true, note: "Parenkim serebral normal" }
    ],
    lesion_type: "normal",
    draf_laporan: {
      temuan: "Struktur parenkim serebri dan serebeli dalam batas normal. Diferensiasi substansia grisea-alba tegas. Sistem ventrikel dan sisterna basalis simetris, tidak melebar atau kolaps. Tidak tampak tanda perdarahan intra maupun ekstra-aksial. Tulang kalvaria intak.",
      kesan: "Tidak tampak tanda perdarahan intrakranial akut atau efek massa patologis pada pemeriksaan CT kepala non-kontras saat ini.",
      catatan_wajib: "Perlu konfirmasi dan validasi dokter spesialis radiologi."
    },
    fhir_ids: {
      patient: "pat-ss-99198",
      encounter: "enc-ss-88099",
      serviceRequest: "sr-ss-77307",
      imagingStudy: "img-ss-66418",
      observation: "obs-ss-55015",
      diagnosticReport: "dr-ss-44908"
    },
    audit_metrics: {
      waktu_inferensi: "12.4 Detik",
      target_latensi: "< 60 Detik",
      status_target: "Memenuhi Target (< 60 Detik)",
      versi_model: "EfficientNet-B0 v1.2",
      ambang_triase: 0.50,
      arsitektur: "CNN Multi-label 6-Class + Grad-CAM",
      status_konektor: "Terkirim ke Environment Uji",
      http_status: "HTTP 200 OK (Idempoten)"
    },
    audit_logs: [
      { time: "09:41:10", text: "DICOM diterima oleh Orthanc PACS (study_uid: std-00188)." },
      { time: "09:41:23", text: "Inferensi PyTorch selesai (waktu_inferensi: 12.4s). Skor di bawah ambang (0.12 < 0.50). Tier: NORMAL." },
      { time: "09:41:24", text: "Smart Triaging: Kasus ditempatkan pada antrean normal sesuai waktu kedatangan." }
    ]
  },
  {
    id: "std-00190",
    study_uid: "1.2.840.113619.2.55.3.901847291",
    nama_pasien: "Nn. Rina Kartika",
    usia: 28,
    jenis_kelamin: "Perempuan",
    no_rm: "RM-994020",
    modalitas: "CT Kepala Non-Kontras",
    tanggal: "15 Okt 2026, 09:56 WIB",
    tier: "NORMAL",
    tier_label: "Normal",
    skor_studi: 0.08,
    tingkat_keparahan: "Rendah",
    subtipe_dominan: "-",
    skor_subtipe: {
      subdural: 0.02,
      epidural: 0.01,
      intraparenkim: 0.08,
      subaraknoid: 0.04,
      intraventrikel: 0.01
    },
    waktu_tunggu: "30 Menit",
    waktu_tunggu_menit: 30,
    status: "Selesai - FHIR Terkirim",
    total_slices: 28,
    current_slice: 14,
    irisan_kunci: [
      { slice: 14, score: 0.08, isPeak: true, note: "Parenkim serebral normal" }
    ],
    lesion_type: "normal",
    draf_laporan: {
      temuan: "Pemeriksaan CT Scan kepala non-kontras menunjukkan diferensiasi substansia grisea-alba intak. Tidak tampak hiperdensitas abnormal yang mencurigakan perdarahan intra/ekstra aksial. Struktur midline di tengah.",
      kesan: "Tidak ditemukan tanda perdarahan intrakranial aktif pada CT Kepala non-kontras.",
      catatan_wajib: "Perlu konfirmasi dan validasi dokter spesialis radiologi."
    },
    fhir_ids: {
      patient: "pat-ss-99200",
      encounter: "enc-ss-88101",
      serviceRequest: "sr-ss-77309",
      imagingStudy: "img-ss-66420",
      observation: "obs-ss-55018",
      diagnosticReport: "dr-ss-44911"
    },
    audit_metrics: {
      waktu_inferensi: "11.9 Detik",
      target_latensi: "< 60 Detik",
      status_target: "Memenuhi Target (< 60 Detik)",
      versi_model: "EfficientNet-B0 v1.2",
      ambang_triase: 0.50,
      arsitektur: "CNN Multi-label 6-Class + Grad-CAM",
      status_konektor: "Terkirim ke Environment Uji",
      http_status: "HTTP 200 OK (Idempoten)"
    },
    audit_logs: [
      { time: "09:56:05", text: "DICOM diterima oleh Orthanc PACS (study_uid: std-00190)." },
      { time: "09:56:17", text: "Inferensi PyTorch selesai (11.9s). Skor 0.08. Tier: NORMAL." },
      { time: "10:05:30", text: "Dokter (Dr. A, Sp.Rad) menyetujui laporan normal." },
      { time: "10:05:32", text: "Bundle HL7 FHIR R4 divalidasi lokal dan sukses terkirim ke SATUSEHAT (HTTP 200 OK)." }
    ]
  },
  {
    id: "std-00184",
    study_uid: "1.2.840.113619.2.55.3.662910481",
    nama_pasien: "Tn. Hendra Gunawan",
    usia: 37,
    jenis_kelamin: "Laki-laki",
    no_rm: "RM-994014",
    modalitas: "CT Kepala Non-Kontras",
    tanggal: "15 Okt 2026, 09:20 WIB",
    tier: "NORMAL",
    tier_label: "Normal",
    skor_studi: 0.04,
    tingkat_keparahan: "Sangat Rendah",
    subtipe_dominan: "-",
    skor_subtipe: {
      subdural: 0.01,
      epidural: 0.01,
      intraparenkim: 0.04,
      subaraknoid: 0.03,
      intraventrikel: 0.01
    },
    waktu_tunggu: "65 Menit",
    waktu_tunggu_menit: 65,
    status: "Belum Dibaca",
    total_slices: 32,
    current_slice: 16,
    irisan_kunci: [
      { slice: 16, score: 0.04, isPeak: true, note: "Parenkim serebral normal" }
    ],
    lesion_type: "normal",
    draf_laporan: {
      temuan: "Tidak tampak area hiperdensitas abnormal. Ventrikel dan sisterna simetris. Tulang kranium intak.",
      kesan: "CT Scan kepala non-kontras dalam batas normal.",
      catatan_wajib: "Perlu konfirmasi dan validasi dokter spesialis radiologi."
    },
    fhir_ids: {
      patient: "pat-ss-99194",
      encounter: "enc-ss-88095",
      serviceRequest: "sr-ss-77303",
      imagingStudy: "img-ss-66414",
      observation: "obs-ss-55011",
      diagnosticReport: "dr-ss-44904"
    },
    audit_metrics: {
      waktu_inferensi: "13.1 Detik",
      target_latensi: "< 60 Detik",
      status_target: "Memenuhi Target (< 60 Detik)",
      versi_model: "EfficientNet-B0 v1.2",
      ambang_triase: 0.50,
      arsitektur: "CNN Multi-label 6-Class + Grad-CAM",
      status_konektor: "Terkirim ke Environment Uji",
      http_status: "HTTP 200 OK (Idempoten)"
    },
    audit_logs: [
      { time: "09:20:00", text: "DICOM diterima oleh Orthanc PACS (study_uid: std-00184)." },
      { time: "09:20:13", text: "Inferensi PyTorch selesai (13.1s). Skor 0.04. Tier: NORMAL." }
    ]
  }
];

// Presets untuk simulasi upload DICOM baru
export const SIMULATED_UPLOAD_PRESETS = [
  {
    label: "Kasus Trauma Akut - Suspek Epidural Hemorrhage (EDH)",
    nama: "Tn. Dimas Aditya",
    usia: 31,
    gender: "Laki-laki",
    tier: "MERAH",
    skor_studi: 0.92,
    subtipe: "Epidural",
    skor_subtipe: {
      epidural: 0.92,
      subdural: 0.15,
      intraparenkim: 0.22,
      subaraknoid: 0.10,
      intraventrikel: 0.02
    },
    lesion_type: "epidural",
    temuan: "Tampak lesi hiperdens berbentuk bikonveks (lens-shaped) pada regio temporoparietal sinistra berukuran ketebalan ~16 mm yang berbatas tegas dengan sutura kranialis. Disertai fraktur linier os temporalis sinistra.",
    kesan: "Mengarah pada gambaran perdarahan intrakranial subtipe Epidural Hemorrhage (EDH) akut regio temporoparietal sinistra disertai fraktur tulang temporal.",
    irisan_kunci: [
      { slice: 15, score: 0.85, note: "Bikonveks hiperdensitas awal" },
      { slice: 17, score: 0.92, isPeak: true, note: "Puncak ketebalan hematoma lentikular" }
    ]
  },
  {
    label: "Kasus CVA Perdarahan - Suspek Subaraknoid Hemorrhage (SAH)",
    nama: "Ny. Ratna Dewi",
    usia: 58,
    gender: "Perempuan",
    tier: "MERAH",
    skor_studi: 0.88,
    subtipe: "Subaraknoid",
    skor_subtipe: {
      epidural: 0.05,
      subdural: 0.18,
      intraparenkim: 0.25,
      subaraknoid: 0.88,
      intraventrikel: 0.30
    },
    lesion_type: "subarachnoid",
    temuan: "Tampak densitas tinggi (hiperdens) mengisi fisura Sylvii bilateral dan sisterna basalis serta sulkus serebri regio parietal posterior.",
    kesan: "Mengarah pada kecurigaan Subarachnoid Hemorrhage (SAH) akut difus ec suspek rupture aneurisma serebri.",
    irisan_kunci: [
      { slice: 12, score: 0.81, note: "Hiperdensitas sisterna basalis" },
      { slice: 14, score: 0.88, isPeak: true, note: "Fisura Sylvii bilateral hiperdens" }
    ]
  },
  {
    label: "Kasus Skrining Sakit Kepala - Normal / Tanpa Perdarahan",
    nama: "Tn. Joko Susilo",
    usia: 46,
    gender: "Laki-laki",
    tier: "NORMAL",
    skor_studi: 0.07,
    subtipe: "-",
    skor_subtipe: {
      epidural: 0.01,
      subdural: 0.03,
      intraparenkim: 0.07,
      subaraknoid: 0.02,
      intraventrikel: 0.01
    },
    lesion_type: "normal",
    temuan: "Tidak tampak hiperdensitas abnormal pada parenkim maupun rongga intrakranial. Ventrikel normal.",
    kesan: "CT Scan kepala non-kontras dalam batas normal.",
    irisan_kunci: [
      { slice: 16, score: 0.07, isPeak: true, note: "Parenkim normal" }
    ]
  }
];

// Template FHIR R4 Bundle Generator
export const generateFhirBundleJson = (patient, isApproved = false) => {
  const observationStatus = isApproved ? "final" : "preliminary";
  const diagnosticReportStatus = isApproved ? "final" : "registered";
  const approvedTimestamp = isApproved ? "2026-10-15T10:16:40+07:00" : "2026-10-15T10:14:16+07:00";
  
  return {
    resourceType: "Bundle",
    id: `bundle-aidoctors-${patient.id}`,
    identifier: {
      system: "https://fhir.kemkes.go.id/id/bundle",
      value: `BND-SS-${patient.id.toUpperCase()}-20261015`
    },
    type: "transaction",
    timestamp: approvedTimestamp,
    meta: {
      profile: [
        "https://fhir.kemkes.go.id/r4/StructureDefinition/SATUSEHAT-Radiology-Bundle"
      ],
      tag: [
        {
          system: "http://terminology.kemkes.go.id/CodeSystem/radiology-triage",
          code: patient.tier,
          display: `Prioritas Triase ${patient.tier}`
        }
      ]
    },
    entry: [
      {
        fullUrl: `urn:uuid:${patient.fhir_ids.patient}`,
        resource: {
          resourceType: "Patient",
          id: patient.fhir_ids.patient,
          identifier: [
            {
              system: "https://fhir.kemkes.go.id/id/nik",
              value: "3171025409890001"
            },
            {
              system: "https://fhir.kemkes.go.id/id/ihs-number",
              value: "P109823901"
            }
          ],
          name: [
            {
              use: "official",
              text: patient.nama_pasien
            }
          ],
          gender: patient.jenis_kelamin === "Laki-laki" ? "male" : "female",
          birthDate: "1972-04-18"
        },
        request: {
          method: "POST",
          url: "Patient"
        }
      },
      {
        fullUrl: `urn:uuid:${patient.fhir_ids.encounter}`,
        resource: {
          resourceType: "Encounter",
          id: patient.fhir_ids.encounter,
          status: "in-progress",
          class: {
            system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            code: "EMER",
            display: "emergency"
          },
          subject: {
            reference: `Patient/${patient.fhir_ids.patient}`,
            display: patient.nama_pasien
          }
        },
        request: {
          method: "POST",
          url: "Encounter"
        }
      },
      {
        fullUrl: `urn:uuid:${patient.fhir_ids.serviceRequest}`,
        resource: {
          resourceType: "ServiceRequest",
          id: patient.fhir_ids.serviceRequest,
          status: "active",
          intent: "order",
          category: [
            {
              coding: [
                {
                  system: "http://snomed.info/sct",
                  code: "363679005",
                  display: "Imaging (procedure)"
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "24725-4",
                display: "CT Head without IV contrast"
              }
            ],
            text: "CT Kepala Non-Kontras Evaluasi CVA/Trauma"
          },
          subject: {
            reference: `Patient/${patient.fhir_ids.patient}`
          }
        },
        request: {
          method: "POST",
          url: "ServiceRequest"
        }
      },
      {
        fullUrl: `urn:uuid:${patient.fhir_ids.imagingStudy}`,
        resource: {
          resourceType: "ImagingStudy",
          id: patient.fhir_ids.imagingStudy,
          status: "available",
          modality: [
            {
              system: "http://dicom.nema.org/resources/ontology/DCM",
              code: "CT",
              display: "Computed Tomography"
            }
          ],
          subject: {
            reference: `Patient/${patient.fhir_ids.patient}`
          },
          identifier: [
            {
              system: "urn:dicom:uid",
              value: `urn:oid:${patient.study_uid}`
            }
          ],
          numberOfSeries: 1,
          numberOfInstances: patient.total_slices,
          description: "Head CT Non-Contrast Axial Series (Orthanc Mini-PACS)"
        },
        request: {
          method: "POST",
          url: "ImagingStudy"
        }
      },
      {
        fullUrl: `urn:uuid:${patient.fhir_ids.observation}`,
        resource: {
          resourceType: "Observation",
          id: patient.fhir_ids.observation,
          status: observationStatus,
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/observation-category",
                  code: "imaging",
                  display: "Imaging"
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "11526-1",
                display: "Pathology study"
              }
            ],
            text: "AI Detection Intracranial Hemorrhage Risk"
          },
          subject: {
            reference: `Patient/${patient.fhir_ids.patient}`
          },
          derivedFrom: [
            {
              reference: `ImagingStudy/${patient.fhir_ids.imagingStudy}`
            }
          ],
          valueQuantity: {
            value: patient.skor_studi,
            unit: "probability",
            system: "http://unitsofmeasure.org",
            code: "1"
          },
          interpretation: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                  code: patient.tier === "MERAH" ? "A" : "N",
                  display: patient.tier === "MERAH" ? "Abnormal Alert" : "Normal"
                }
              ]
            }
          ],
          component: [
            {
              code: { text: "Subdural Probability" },
              valueQuantity: { value: patient.skor_subtipe.subdural }
            },
            {
              code: { text: "Intraparenchymal Probability" },
              valueQuantity: { value: patient.skor_subtipe.intraparenkim }
            },
            {
              code: { text: "Epidural Probability" },
              valueQuantity: { value: patient.skor_subtipe.epidural }
            },
            {
              code: { text: "Subarachnoid Probability" },
              valueQuantity: { value: patient.skor_subtipe.subaraknoid }
            },
            {
              code: { text: "Intraventricular Probability" },
              valueQuantity: { value: patient.skor_subtipe.intraventrikel }
            }
          ],
          note: [
            {
              authorString: "AIdoctors Middleware (PyTorch EfficientNet-B0 v1.2)",
              text: `Inferensi selesai dalam ${patient.audit_metrics.waktu_inferensi}. Status klinis: ${observationStatus.toUpperCase()}.`
            }
          ]
        },
        request: {
          method: "POST",
          url: "Observation"
        }
      },
      {
        fullUrl: `urn:uuid:${patient.fhir_ids.diagnosticReport}`,
        resource: {
          resourceType: "DiagnosticReport",
          id: patient.fhir_ids.diagnosticReport,
          basedOn: [
            {
              reference: `ServiceRequest/${patient.fhir_ids.serviceRequest}`
            }
          ],
          status: diagnosticReportStatus,
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v2-0074",
                  code: "RAD",
                  display: "Radiology"
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "24725-4",
                display: "CT Head without IV contrast Report"
              }
            ],
            text: "Laporan Radiologi CT Kepala Non-Kontras"
          },
          subject: {
            reference: `Patient/${patient.fhir_ids.patient}`
          },
          imagingStudy: [
            {
              reference: `ImagingStudy/${patient.fhir_ids.imagingStudy}`
            }
          ],
          result: [
            {
              reference: `Observation/${patient.fhir_ids.observation}`
            }
          ],
          conclusion: patient.draf_laporan.kesan,
          presentedForm: [
            {
              contentType: "text/plain",
              language: "id-ID",
              data: btoa(patient.draf_laporan.temuan + "\n\nKesan: " + patient.draf_laporan.kesan)
            }
          ],
          performer: [
            {
              display: "Dr. Ahmad Fauzi, Sp.Rad (SIP: 446/SIP/DS/2022)"
            }
          ]
        },
        request: {
          method: "POST",
          url: "DiagnosticReport"
        }
      }
    ]
  };
};
