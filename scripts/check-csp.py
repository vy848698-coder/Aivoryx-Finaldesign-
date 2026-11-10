"""Fails if an inline <script> in any page is not allowed by the CSP hashes in
.htaccess and vercel.json — i.e. someone edited an inline script and forgot to
update the policy. Run: python scripts/check-csp.py   (no dependencies)"""
import base64, glob, hashlib, json, re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
pages = sorted(root.glob("*.html"))
need = {}
for p in pages:
    html = p.read_text(encoding="utf-8")
    for m in re.finditer(r"<script(?![^>]*\bsrc=)(?![^>]*application/ld\+json)[^>]*>(.*?)</script>", html, re.S):
        h = "'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode() + "'"
        need.setdefault(h, []).append(p.name)

def policy_from_htaccess():
    m = re.search(r'Content-Security-Policy(?:-Report-Only)?\s+"([^"]+)"', (root / ".htaccess").read_text(encoding="utf-8"))
    return m.group(1) if m else ""

def policy_from_vercel():
    cfg = json.loads((root / "vercel.json").read_text(encoding="utf-8"))
    for block in cfg.get("headers", []):
        for hd in block["headers"]:
            if hd["key"].startswith("Content-Security-Policy"):
                return hd["value"]
    return ""

bad = False
for name, pol in (("htaccess", policy_from_htaccess()), ("vercel.json", policy_from_vercel())):
    if not pol:
        print(f"FAIL {name}: no Content-Security-Policy found"); bad = True; continue
    for h, where in need.items():
        if h not in pol:
            print(f"FAIL {name}: inline script in {', '.join(where)} not allowed — add {h}"); bad = True
    for must in ("frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"):
        if must not in pol:
            print(f"FAIL {name}: policy lost {must}"); bad = True
print("CSP check:", "FAILED" if bad else f"ok ({len(need)} inline scripts, {len(pages)} pages)")
sys.exit(1 if bad else 0)
