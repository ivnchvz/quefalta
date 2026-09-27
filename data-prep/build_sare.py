"""Extract the SCIAN codes of the SARE low-risk catalog (Municipio de Chihuahua).

Source: "Manual de Procedimientos para la operación del SARE", section VI.2
"Catálogo de Giros de Bajo Riesgo 2022". Requires `pdftotext` (poppler).
Output: web/src/data/sare_codes.json
"""

import json
import os
import re
import subprocess
import urllib.request

URL = ("https://www.municipiochihuahua.gob.mx/Descargas/Adicional%20Gacetas/"
       "Manual%20de%20Procedimientos%20para%20la%20operaci%C3%B3n%20del%20SARE.pdf")
HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, "raw", "sare_manual.pdf")
OUT = os.path.join(HERE, "..", "web", "src", "data", "sare_codes.json")


def main():
    if not os.path.exists(PDF):
        os.makedirs(os.path.dirname(PDF), exist_ok=True)
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as r, open(PDF, "wb") as f:
            f.write(r.read())
    text = subprocess.run(["pdftotext", "-layout", PDF, "-"], capture_output=True, text=True, check=True).stdout

    # Catalog rows look like: "  12   461110   Comercio al por menor ..."
    codes = sorted({m.group(2) for m in re.finditer(r"^\s{0,6}(\d{1,3})\s+(\d{6})\b", text, re.M)})
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"source": URL, "catalog": "Catálogo de Giros de Bajo Riesgo SARE 2022", "codes": codes},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(codes)} SCIAN codes -> {OUT}")


if __name__ == "__main__":
    main()
