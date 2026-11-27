#!/usr/bin/env python3
"""Replace a conservatively matched subset of catalog-derived thumbnails with
actual product pictures shown on nippon-chokuhan.jp.

Never guess across sizes, colors, flavors, boxed quantity or multiple candidates.
Unmatched items keep their current catalog-derived WebP.
"""
import io
import json
import re
import time
import unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

import requests
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/product-thumbnails"
OFFICIAL = ROOT / "scripts/official-site-inspection.json"
MANIFEST = ROOT / "scripts/product-thumbnails-manifest.json"
REPORT = ROOT / "scripts/official-thumbnail-match-report.json"

def normalize(text):
    text = unicodedata.normalize("NFKC", text).casefold()
    text = re.sub(r"[\s\(\)（）・,，、。／/|｜【】\[\]「」『』®™ー\-]", "", text)
    return text

def candidates():
    results = {}
    for page in json.loads(OFFICIAL.read_text(encoding="utf-8")):
        for record in page.get("links", []):
            href = record["href"].rstrip("/")
            if not re.search(r"/\d+$", href):
                continue
            if not record.get("images"):
                continue
            label = record["label"]
            existing = results.get(href)
            if existing is None or len(label) < len(existing["label"]):
                results[href] = record
    return list(results.values())

def safe_match(product, links):
    name = product["name"]
    normalized = normalize(name)
    # Packaging variations frequently have different product photos.
    excluded = ["ケース", "箱 ", "ボトル5", "5個", "5本", "6個", "ダブル", "シングル",
                "グレー", "ベージュ", "ココア味", "レモン味", "version1", "version2",
                "version3", "version4", "色", "サイズ"]
    if any(e in name.casefold() for e in excluded):
        return None, "variation_needs_review"
    found = []
    for link in links:
        label = normalize(link["label"])
        if label == normalized:
            found.append((link, "exact"))
        elif normalized.startswith(label) and len(label) >= 7:
            extra = normalized[len(label):]
            # Suffixes should be only simple counted units, not new models.
            if re.fullmatch(r"(?:\d{1,4}(?:粒|包|錠|g|ml|カプセル))?", extra):
                found.append((link, "unit_variant"))
        elif label.startswith(normalized) and len(normalized) >= 7:
            suffix = label[len(normalized):]
            # Official label may add an English transliteration, but not another
            # Japanese product variant such as a larger package.
            if suffix and re.fullmatch(r"[a-z0-9\s]+", suffix):
                found.append((link, "official_english_suffix"))
    unique = {x[0]["href"].rstrip("/"): x for x in found}
    if len(unique) == 1:
        return next(iter(unique.values())), None
    return None, "ambiguous" if unique else "no_confident_match"

def source_is_safe(url):
    p = urlparse(url)
    return (p.scheme == "https"
            and p.hostname in ("www.nippon-chokuhan.jp", "nippon-chokuhan.jp")
            and p.path.startswith("/wordpress/wp-content/uploads/")
            and re.search(r"\.(?:jpg|jpeg|png|webp)$", p.path, re.I))

def save_webp(data, path):
    im = Image.open(io.BytesIO(data))
    if im.width < 120 or im.height < 120:
        raise ValueError("official photo too small")
    im = ImageOps.exif_transpose(im).convert("RGBA")
    im.thumbnail((548,548), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (600,600), "white")
    if im.mode == "RGBA":
        canvas.paste(im, ((600-im.width)//2,(600-im.height)//2), im)
    else:
        canvas.paste(im, ((600-im.width)//2,(600-im.height)//2))
    buf = io.BytesIO()
    canvas.save(buf, "WEBP", quality=78, method=5)
    path.write_bytes(buf.getvalue())

def main():
    products = json.loads(MANIFEST.read_text(encoding="utf-8"))
    links = candidates()
    report = []
    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (compatible; MyCare product image review)"
    for product in products:
        p_id = product["id"]
        found, reason = safe_match(product, links)
        record = {"id":p_id, "name":product["name"], "status":"unchanged"}
        if found is None:
            record["reason"] = reason
            report.append(record)
            continue
        link, confidence = found
        image_url = link["images"][0]
        if not source_is_safe(image_url):
            record["reason"] = "unsupported_official_image_url"
            report.append(record)
            continue
        try:
            response = session.get(image_url, timeout=(10,35))
            response.raise_for_status()
            if len(response.content)>8*1024*1024:
                raise ValueError("image exceeds 8MB")
            if not response.headers.get("content-type","").lower().startswith("image/"):
                raise ValueError("not an image")
            save_webp(response.content, OUT/f"{p_id}.webp")
            record.update(status="official_image",source_page=link["href"],
                          source_image=image_url, confidence=confidence)
        except Exception as ex:
            record["reason"] = "download_failed"
            record["error"] = str(ex)[:150]
        report.append(record)
        time.sleep(0.15)
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    counts = dict(Counter(row["status"] for row in report))
    print(json.dumps({"catalog":len(products),"official_pages":len(links),**counts},ensure_ascii=False))
    assert len(report)==len(products)
if __name__ == "__main__":
    main()
