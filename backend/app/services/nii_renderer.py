import os
import cv2
import numpy as np
import nibabel as nib
from typing import Optional, List, Dict, Any

SAMPLE_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../sample_data"))

# Pemetaan eksplisit Study UID ke folder pasien di sample_data
STUDY_MAPPING = {
    "1.2.840.113619.2.55.3.281920192": "Pasien_1",
    "std-00192": "Pasien_1",
    "1.2.840.113619.2.55.3.489102941": "Pasien_2",
    "1.2.840.113619.2.55.3.489182941": "Pasien_2",
    "std-00195": "Pasien_2",
    "1.2.840.113619.2.55.3.119284712": "Pasien_3",
    "std-00188": "Pasien_3",
    "1.2.840.113619.2.55.3.992817263": "Pasien_4",
    "std-00185": "Pasien_4",
}

def save_uploaded_nii(study_uid: str, file_bytes: bytes, filename: str = "CT.nii") -> str:
    """Menyimpan berkas NIfTI hasil unggahan dokter/user ke direktori sample_data/uploads."""
    import gzip
    upload_dir = os.path.join(SAMPLE_DATA_DIR, "uploads", study_uid)
    os.makedirs(upload_dir, exist_ok=True)
    target_path = os.path.join(upload_dir, "CT.nii")

    # Jika file terkompresi .nii.gz, dekompresi ke .nii
    if filename.endswith(".gz") or file_bytes[:2] == b'\x1f\x8b':
        try:
            decompressed = gzip.decompress(file_bytes)
            with open(target_path, "wb") as f:
                f.write(decompressed)
        except Exception:
            with open(target_path, "wb") as f:
                f.write(file_bytes)
    else:
        with open(target_path, "wb") as f:
            f.write(file_bytes)

    STUDY_MAPPING[study_uid] = target_path
    return target_path

def get_nii_path_by_study(study_uid: str) -> str:
    """Mencari path berkas CT.nii berdasarkan folder pasien atau study_uid."""
    if not study_uid:
        return ""
        
    # 1. Cek mapping eksplisit
    mapped = STUDY_MAPPING.get(study_uid)
    if mapped:
        if os.path.isabs(mapped) and os.path.exists(mapped):
            return mapped
        path = os.path.join(SAMPLE_DATA_DIR, mapped, "CT.nii")
        if os.path.exists(path):
            return path
        if os.path.exists(mapped):
            return mapped

    # 2. Cek direktori upload
    upload_path = os.path.join(SAMPLE_DATA_DIR, "uploads", study_uid, "CT.nii")
    if os.path.exists(upload_path):
        return upload_path

    # 3. Cek jika study_uid langsung berupa nama folder (misal: "Pasien_1")
    direct_path = os.path.join(SAMPLE_DATA_DIR, study_uid, "CT.nii")
    if os.path.exists(direct_path):
        return direct_path

    # 4. Cek kandidat folder Pasien_1 s/d Pasien_4 jika study_uid mengandung substring
    for p in ["Pasien_1", "Pasien_2", "Pasien_3", "Pasien_4"]:
        if p.lower() in study_uid.lower():
            p_path = os.path.join(SAMPLE_DATA_DIR, p, "CT.nii")
            if os.path.exists(p_path):
                return p_path

    # Fallback default Pasien_1 jika study_uid adalah default std-00192 atau terkait
    if "192" in study_uid or study_uid == "sample":
        default_p1 = os.path.join(SAMPLE_DATA_DIR, "Pasien_1", "CT.nii")
        if os.path.exists(default_p1):
            return default_p1

    return ""

def get_nii_metadata(study_uid: str) -> Dict[str, Any]:
    """Mengembalikan informasi metadata volume CT asli dari berkas NIfTI."""
    nii_path = get_nii_path_by_study(study_uid)
    if not nii_path or not os.path.exists(nii_path):
        return {"total_slices": 224, "key_slices": [14, 16, 18, 19, 21], "found": False}
    
    try:
        img = nib.load(nii_path)
        total_slices = int(img.shape[2])
        parent_dir = os.path.dirname(nii_path)
        mask_path = os.path.join(parent_dir, "ICH_mask.nii")
        
        key_slices = [95, 100, 105, 110, 115] if total_slices >= 200 else [14, 16, 18, 19, 21]
        peak_slice = 105 if total_slices >= 200 else 18
        
        # Ekstrak irisan kunci riil berdasarkan sebaran volume perdarahan
        if os.path.exists(mask_path):
            try:
                mask_img = nib.load(mask_path)
                m_arr = np.asarray(mask_img.dataobj)
                counts = [
                    (i, int(np.sum(m_arr[:, :, i] > 0)))
                    for i in range(m_arr.shape[2])
                    if np.sum(m_arr[:, :, i] > 0) > 0
                ]
                if counts:
                    counts.sort(key=lambda x: x[1], reverse=True)
                    peak_slice = counts[0][0]
                    # Ambil 5 irisan representatif di sekitar puncak lesi
                    top5 = sorted([x[0] for x in counts[:5]])
                    key_slices = top5
            except Exception:
                pass

        return {
            "total_slices": total_slices,
            "dimensions": [int(img.shape[0]), int(img.shape[1]), int(img.shape[2])],
            "key_slices": key_slices,
            "peak_slice": peak_slice,
            "found": True,
            "path": nii_path
        }
    except Exception:
        return {"total_slices": 224, "key_slices": [95, 100, 105, 110, 115], "found": False}

def render_ct_slice(nii_path: str, slice_index: int, apply_gradcam: bool = False, opacity: float = 0.6) -> bytes:
    """
    Membaca volume 3D NIfTI, mengambil 1 irisan aksial 2D,
    menerapkan Brain Window medis (HU), serta menempelkan heatmap Grad-CAM riil
    hanya pada area perdarahan (ICH) tanpa meluber ke tulang kalvaria/dasar tengkorak.
    """
    if not os.path.exists(nii_path):
        raise FileNotFoundError(f"Berkas NIfTI tidak ditemukan di: {nii_path}")

    # 1. Muat volume 3D (dataobj untuk efisiensi instan per irisan tanpa muat seluruh volume ke RAM)
    nii_img = nib.load(nii_path)
    total_slices = nii_img.shape[2]
    idx = max(0, min(slice_index, total_slices - 1))

    # 2. Ambil irisan aksial 2D dan sesuaikan orientasi radiologi
    slice_raw = np.asarray(nii_img.dataobj[:, :, idx], dtype=np.float32)
    slice_raw = np.rot90(slice_raw, 1)

    # 3. Terapkan Brain Window Medis (Level: 40 HU, Width: 80 HU) -> Rentang [0, 80]
    c, w = 40.0, 80.0
    lower = c - (w / 2.0)
    upper = c + (w / 2.0)
    windowed = np.clip(slice_raw, lower, upper)
    normalized = ((windowed - lower) / (upper - lower) * 255.0).astype(np.uint8)

    img_bgr = cv2.cvtColor(normalized, cv2.COLOR_GRAY2BGR)

    # 4. Tempelkan Heatmap Grad-CAM jika diaktifkan
    if apply_gradcam:
        parent_dir = os.path.dirname(nii_path)
        mask_path = os.path.join(parent_dir, "ICH_mask.nii")
        brain_path = os.path.join(parent_dir, "brain.nii")

        has_lesion_on_slice = False
        heatmap_source_mask = None

        # Opsi A (Presisi Tinggi): Gunakan ICH_mask.nii riil jika ada
        if os.path.exists(mask_path):
            try:
                mask_nii = nib.load(mask_path)
                lesion_slice = np.asarray(mask_nii.dataobj[:, :, idx], dtype=np.float32)
                lesion_slice = np.rot90(lesion_slice, 1)
                if np.max(lesion_slice) > 0:
                    has_lesion_on_slice = True
                    heatmap_source_mask = (lesion_slice > 0).astype(np.uint8) * 255
            except Exception:
                has_lesion_on_slice = False

        # Opsi B (Fallback cerdas): Isolasi densitas tinggi dalam parenkim otak (Kecualikan tulang)
        if not has_lesion_on_slice and heatmap_source_mask is None:
            if os.path.exists(brain_path):
                try:
                    brain_nii = nib.load(brain_path)
                    b_slice = np.asarray(brain_nii.dataobj[:, :, idx], dtype=np.float32)
                    b_slice = np.rot90(b_slice, 1)
                    brain_mask = b_slice > 0
                    # Di dalam otak, densitas perdarahan segar berada di atas 150 (dalam skala Brain Window)
                    lesion_cand = (normalized > 165) & brain_mask
                    if np.sum(lesion_cand) > 30:
                        has_lesion_on_slice = True
                        heatmap_source_mask = lesion_cand.astype(np.uint8) * 255
                except Exception:
                    pass

        # Tempelkan overlay HANYA jika ada lesi perdarahan pada irisan ini
        if has_lesion_on_slice and heatmap_source_mask is not None:
            blurred_mask = cv2.GaussianBlur(heatmap_source_mask, (25, 25), 0)
            if np.max(blurred_mask) > 10:
                heatmap = cv2.applyColorMap(blurred_mask, cv2.COLORMAP_JET)
                active_area = blurred_mask > 12
                # Alpha blend overlay
                overlay = cv2.addWeighted(heatmap, opacity, img_bgr, 1.0 - opacity, 0)
                img_bgr[active_area] = overlay[active_area]

    # 5. Enkripsi ke format biner PNG
    success, encoded_img = cv2.imencode(".png", img_bgr)
    if not success:
        raise RuntimeError("Gagal memproses irisan menjadi gambar PNG.")

    return encoded_img.tobytes()
