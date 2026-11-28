#!/usr/bin/env python3
"""Build catalog-derived WebP previews for every product in the manifest.

If a product photo can be extracted from the source PDF, use it. Otherwise
render the source page, not an invented product photo. Products without any
source PDF get a clearly labelled text placeholder. Never overwrite a custom
image URL managed in the product database.
"""
from __future__ import annotations
import io
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import fitz
import requests
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "scripts" / "product-thumbnails-manifest.json"
OUT = ROOT / "public" / "product-thumbnails"
FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
SIZE = (600, 600)
EXPECTED_HOST = "utbueabvlkrbmuinnxtd.supabase.co"

def square_image(image: Image.Image) -> Image.Image:
    image = image.convert("RGB")
    image.thumbnail((548, 548), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", SIZE, "#ffffff")
    canvas.paste(image, ((600-image.width)//2, (600-image.height)//2))
    return canvas

def fallback(name: str) -> Image.Image:
    canvas = Image.new("RGB", SIZE, "#f8fafc")
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((20, 20, 580, 580), radius=20, outline="#e2e8f0", width=3, fill="#ffffff")
    try:
        font = ImageFont.truetype(FONT, size=34)
        small = ImageFont.truetype(FONT, size=20)
    except OSError:
        font = ImageFont.load_default()
        small = font
    chars = list(name)
    lines = []
    while chars and len(lines) < 5:
        line = ""
        while chars and draw.textbbox((0, 0), line + chars[0], font=font)[2] < 480:
            line += chars.pop(0)
        lines.append(line)
    if chars: lines[-1] += "…"
    y = 250 - (len(lines) - 1) * 22
    for line in lines:
        bbox = draw.textbbox((0,0), line, font=font)
        draw.text(((600-(bbox[2]-bbox[0]))//2, y), line, font=font, fill="#475569")
        y += 48
    draw.text((175, 532), "商品画像準備中", font=small, fill="#94a3b8")
    return canvas

def from_pdf(data: bytes) -> Image.Image:
    doc = fitz.open(stream=data, filetype="pdf")
    if len(doc) == 0:
        raise ValueError("empty PDF")
    page = doc[0]
    images = []
    for entry in page.get_images(full=True):
        xref = entry[0]
        try:
            img_data = doc.extract_image(xref)["image"]
            image = Image.open(io.BytesIO(img_data))
            w, h = image.size
            if w < 180 or h < 180 or max(w/h,h/w) > 4:
                continue
            # Avoid decorative logos / small icons, prefer the dominant photo.
            images.append((w*h, image.copy()))
        except Exception:
            pass
    if images:
        images.sort(key=lambda i: i[0], reverse=True)
        return square_image(images[0][1])
    # Preserve the actual catalog page if no photograph is extractable.
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    return square_image(Image.frombytes("RGB", (pix.width,pix.height), pix.samples))

def write_image(image: Image.Image, path: Path):
    for quality in (78, 68, 55, 42):
        buf = io.BytesIO()
        image.save(buf, "WEBP", quality=quality, method=5)
        if buf.tell() <= 120000 or quality == 42:
            path.write_bytes(buf.getvalue())
            return

def process_one(item: dict):
    pid, name, url = item["id"], item["name"], item.get("pdf_url")
    if not re.fullmatch(r"[0-9a-f-]{36}", pid):
        raise ValueError("invalid product ID")
    output = OUT / f"{pid}.webp"
    if output.exists() and output.stat().st_size > 0:
        return pid, "existing", None
    image = None
    error = None
    if url:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname != EXPECTED_HOST or not parsed.path.startswith("/storage/v1/object/public/product-documents/"):
            raise ValueError("unexpected PDF source URL")
        try:
            response = requests.get(url, timeout=(12, 45))
            response.raise_for_status()
            if not response.content.startswith(b"%PDF"):
                raise ValueError("source is not a PDF")
            image = from_pdf(response.content)
        except Exception as exc:
            error = str(exc)[:180]
    if image is None:
        image = fallback(name)
    write_image(image, output)
    return pid, ("missing" if not url else "failed" if error else "converted"), error

def main():
    products = json.loads(MANIFEST.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    missing, failed = [], []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(process_one, item): item for item in products}
        for completed, future in enumerate(as_completed(futures), 1):
            item = futures[future]
            pid, state, error = future.result()
            if state == "missing":
                missing.append(pid)
            elif state == "failed":
                failed.append({"id": pid, "name": item["name"], "error": error})
            if completed % 25 == 0:
                print(f"Processed {completed}/{len(products)}", flush=True)
    all_webp = list(OUT.glob("*.webp"))
    summary = {"products": len(products), "webp_files": len(all_webp),
               "missing_pdf": sorted(missing), "source_failures": failed}
    (ROOT / "scripts" / "product-thumbnails-result.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"products":len(products),"webp_files":len(all_webp),
                      "missing_pdf_count":len(missing),"failed_downloads":len(failed)},
                     ensure_ascii=False),flush=True)
    if failed:
        sys.exit(2)

if __name__ == "__main__":
    main()
