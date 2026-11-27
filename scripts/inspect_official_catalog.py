#!/usr/bin/env python3
"""Inspect Japanese official catalog product links and image positions."""
import json
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
URLS = [
    "https://www.nippon-chokuhan.jp/item_ichiran",
    "https://www.nippon-chokuhan.jp/item_supplement",
    "https://www.nippon-chokuhan.jp/item_exercise",
    "https://www.nippon-chokuhan.jp/item_night",
    "https://www.nippon-chokuhan.jp/item_kurei",
]
out = []
for url in URLS:
    try:
        r=requests.get(url,timeout=25,headers={"User-Agent":"Mozilla/5.0 (compatible; MyCare catalog quality-check/1.0)"})
        r.raise_for_status()
        r.encoding=r.apparent_encoding or r.encoding
        soup=BeautifulSoup(r.text,"html.parser")
        a_list=[]
        for a in soup.find_all("a",href=True):
            href=urljoin(r.url,a["href"])
            if urlparse(href).hostname not in ("www.nippon-chokuhan.jp","nippon-chokuhan.jp"):
                continue
            name=a.get_text(" ",strip=True)
            img=a.find("img")
            if not name and img:
                name=img.get("alt","")
            if not name or not href.startswith("https://"):
                continue
            imgs=[]
            for node in (a,a.parent,a.parent.parent if a.parent else None):
                if not node:continue
                for i in node.find_all("img",limit=5):
                    src=i.get("data-src") or i.get("src") or ""
                    if src and src not in imgs:imgs.append(src)
            a_list.append({"label":name[:120],"href":href,"images":imgs[:3]})
        out.append({"url":url,"resolved":r.url,"status":r.status_code,"title":soup.title.get_text(" ",strip=True) if soup.title else "","links":a_list[:65],"og_image":(soup.find("meta",property="og:image") or {}).get("content")})
    except Exception as e:
        out.append({"url":url,"error":str(e)[:300]})
from pathlib import Path
Path("scripts/official-site-inspection.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
print(json.dumps([{"url":x["url"],"status":x.get("status"),"links":len(x.get("links",[])),"error":x.get("error")} for x in out],ensure_ascii=False))
