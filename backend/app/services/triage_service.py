from typing import List, Dict, Any
from app.core.config import settings
from app.core.state import state

def evaluate_tier(skor_studi: float, ambang: float = None) -> str:
    """
    Prinsip Triase Aman:
    AI hanya memiliki wewenang menaikkan prioritas antrean (tier = MERAH) jika skor_studi >= ambang.
    AI dilarang menurunkan prioritas pasien (tier = NORMAL tetap mempertahankan posisi FIFO).
    """
    threshold = ambang if ambang is not None else settings.DEFAULT_AMBANG
    if skor_studi >= threshold:
        return "MERAH"
    return "NORMAL"

def get_sorted_triage_queue() -> List[Dict[str, Any]]:
    """
    Mengurutkan antrean triase SIM RS Radiologi:
    1. Pasien Darurat (tier = MERAH) diprioritaskan di posisi teratas, diurutkan berdasarkan skor_studi tertinggi.
    2. Pasien Rutin (tier = NORMAL) mempertahankan urutan murni kedatangan (FIFO - waktu_tunggu_menit tertinggi lebih dulu).
    """
    all_studies = state.get_all()
    
    red_tier = [s for s in all_studies if s.get("tier") == "MERAH"]
    normal_tier = [s for s in all_studies if s.get("tier") != "MERAH"]
    
    # Urutkan tier MERAH berdasarkan skor studi tertinggi (urgensi klinis tertinggi di baris teratas)
    red_tier.sort(key=lambda x: x.get("skor_studi", 0.0), reverse=True)
    
    # Urutkan tier NORMAL murni berdasarkan waktu tunggu FIFO (tidak boleh di-demote oleh AI)
    normal_tier.sort(key=lambda x: x.get("waktu_tunggu_menit", 0), reverse=True)
    
    return red_tier + normal_tier
