#!/usr/bin/env python3
"""Check health of SpamInThai affiliate ad config.

Reads assets/affiliate.js, extracts AD_CONFIG, and reports per-slot status.
Exits 0 regardless of placeholder counts (placeholders are an allowed state);
prints a clear report. Intended for CI (GitHub Actions) and local use.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "affiliate.js"
HTML_FILES = [ROOT / "index.html", ROOT / "check.html"]

problems = 0

# 1. Slots referenced in HTML must exist in config (and vice versa).
html_slots = []
for hf in HTML_FILES:
    if hf.exists():
        html_slots += re.findall(r'data-slot="([^"]*)"', hf.read_text(encoding="utf-8"))
html_slots = sorted(set(html_slots))

src = SRC.read_text(encoding="utf-8")
m = re.search(r"const AD_CONFIG\s*=\s*\[(.*?)\];", src, re.S)
if not m:
    print("FAIL: ไม่พบ AD_CONFIG ใน assets/affiliate.js")
    sys.exit(1)

block = m.group(1)
slots = re.findall(r"slot:\s*'([^']*)'", block)
hrefs = re.findall(r"href:\s*'([^']*)'", block)
enabled = re.findall(r"enabled:\s*(true|false)", block)

print(f"จำนวนรายการโฆษณาใน config: {len(slots)}")
for i, s in enumerate(slots):
    st = enabled[i] if i < len(enabled) else "true"
    h = hrefs[i] if i < len(hrefs) else ""
    if st == "true" and not h.strip():
        problems += 1
        print(f"  [WARN] slot '{s}' → ยังเป็น PLACEHOLDER (href ว่าง) — ต้องใส่ลิงก์ก่อนเปิดใช้งานจริง")
    elif st == "true":
        print(f"  [OK]   slot '{s}' → ลิงก์พร้อม: {h.strip()[:50]}")
    else:
        print(f"  [OFF]  slot '{s}' → ปิดใช้งาน (enabled=false)")

# 2. Config slot vs HTML slot cross-check.
config_slots = set(slots)
missing_in_html = config_slots - set(html_slots)
missing_in_config = set(html_slots) - config_slots
if missing_in_html:
    problems += 1
    print(f"  [WARN] slot ใน config แต่ไม่มี div ใน HTML: {sorted(missing_in_html)}")
if missing_in_config:
    problems += 1
    print(f"  [WARN] div.data-slot ใน HTML แต่ไม่มีใน config: {sorted(missing_in_config)}")

print(f"\ntotal_slots={len(slots)} html_slots={len(html_slots)} warnings={problems}")
# Placeholders ไม่ใช่ความล้มเหลว → CI ผ่านเสมอ เพื่อให้ deploy ไม่ถูกบล็อก
sys.exit(0)
