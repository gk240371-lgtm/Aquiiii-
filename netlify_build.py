from pathlib import Path
import os, json
site = Path("netlify/site")
url = os.environ.get("BACKEND_URL", "").strip().rstrip("/")
(site / "config.js").write_text("window.__BACKEND_URL__ = " + json.dumps(url) + ";\n", encoding="utf-8")
