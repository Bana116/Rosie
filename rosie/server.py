#!/usr/bin/env python3
"""
Rosie's local server.

Serves the app, gives Rosie her ElevenLabs voice, and stores family voice notes
(in the notes/ folder next to this file).
The API key stays on this Mac: it is typed once (hidden) when you start
the server, kept only in memory, and never sent to the iPad or saved
in the app.

Run:   python3 server.py
Stop:  Ctrl+C
"""
import getpass
import hashlib
import json
import os
import re
import socket
import ssl
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("PORT", "3001"))
HERE = Path(__file__).resolve().parent
CACHE = HERE / "voice-cache"          # spoken lines are saved here, so repeats cost no credits
NOTES = HERE / "notes"                # family voice notes, one file per person
NOTE_TYPES = {"audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/mpeg": "mp3", "audio/mp3": "mp3",
              "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/aac": "m4a",
              "audio/webm": "webm", "audio/ogg": "ogg"}
MAX_NOTE = 25 * 1024 * 1024
VOICES = {
    "Sarah": "EXAVITQu4vr4xnSDxMaL",
    "Rachel": "21m00Tcm4TlvDq8ikWAM",
    "George": "JBFqnCBsd6RMkjVDRZzb",
}
DEFAULT_VOICE = "Sarah"
MODEL = "eleven_turbo_v2_5"
SETTINGS = {"stability": 0.55, "similarity_boost": 0.75, "style": 0.25, "use_speaker_boost": True}

KEY = os.environ.get("ELEVENLABS_API_KEY") or getpass.getpass(
    "Paste your ElevenLabs API key (it stays hidden), then press Return\n(or just press Return to skip; Rosie will use the built-in voice): ").strip()


def _ssl_context():
    try:
        import certifi  # present on many Macs; fixes missing certificates for python.org installs
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


CTX = _ssl_context()


def note_slug(name):
    return re.sub(r"[^a-z0-9-]", "", name.lower())[:32]


def note_files():
    if not NOTES.exists():
        return {}
    return {f.stem: f"/notes/{f.name}?v={int(f.stat().st_mtime)}" for f in NOTES.iterdir()
            if f.is_file() and f.suffix[1:] in set(NOTE_TYPES.values())}


def speak(text, voice):
    vid = VOICES.get(voice, VOICES[DEFAULT_VOICE])
    name = hashlib.sha1(f"{vid}|{MODEL}|{text}".encode()).hexdigest() + ".mp3"
    cached = CACHE / name
    if cached.exists():
        return cached.read_bytes()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_128",
        data=json.dumps({"text": text, "model_id": MODEL, "voice_settings": SETTINGS}).encode(),
        headers={"xi-api-key": KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    with urllib.request.urlopen(req, context=CTX, timeout=30) as r:
        audio = r.read()
    CACHE.mkdir(exist_ok=True)
    cached.write_bytes(audio)
    return audio


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(HERE), **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/tts-status":
            return self._json(200, {"ok": True, "tts": bool(KEY), "notes": True, "default": DEFAULT_VOICE})
        if path == "/notes-list":
            return self._json(200, note_files())
        if path == "/photos-list":
            pics = HERE / "photos"
            files = sorted(p for p in pics.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".heic", ".gif")) if pics.exists() else []
            return self._json(200, [f"/photos/{p.name}?v={int(p.stat().st_mtime)}" for p in files])
        if path.endswith(".py") or path.startswith("/voice-cache"):
            return self.send_error(404)
        return super().do_GET()

    def do_DELETE(self):
        path = self.path.split("?")[0]
        if not path.startswith("/notes/"):
            return self.send_error(404)
        slug = note_slug(path[len("/notes/"):])
        for f in NOTES.glob(f"{slug}.*") if NOTES.exists() else []:
            f.unlink()
        return self._json(200, {"ok": True})

    def _save_note(self, path):
        slug = note_slug(path[len("/notes/"):])
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        ext = NOTE_TYPES.get(ctype)
        n = int(self.headers.get("Content-Length", 0))
        if not slug or not ext:
            return self._json(400, {"error": f"unsupported audio type {ctype or '?'}"})
        if n <= 0 or n > MAX_NOTE:
            return self._json(413, {"error": "note is empty or too long"})
        data = self.rfile.read(n)
        NOTES.mkdir(exist_ok=True)
        for old in NOTES.glob(f"{slug}.*"):
            old.unlink()
        out = NOTES / f"{slug}.{ext}"
        out.write_bytes(data)
        print(f"  Saved a voice note for {slug} ({len(data)//1024} KB)")
        return self._json(200, {"ok": True, "url": f"/notes/{out.name}?v={int(out.stat().st_mtime)}"})

    def do_POST(self):
        path = self.path.split("?")[0]
        if path.startswith("/notes/"):
            return self._save_note(path)
        if path != "/tts":
            return self.send_error(404)
        if not KEY:
            return self._json(503, {"error": "no key"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n) or b"{}")
            text = str(data.get("text", "")).strip()[:600]
            if not text:
                return self._json(400, {"error": "empty text"})
            audio = speak(text, data.get("voice") or DEFAULT_VOICE)
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf8", "ignore")[:200]
            print(f"  ElevenLabs said {e.code}: {msg}")
            return self._json(e.code, {"error": f"{e.code} {msg}"})
        except Exception as e:
            if "CERTIFICATE_VERIFY_FAILED" in str(e):
                print("  Python can't verify ElevenLabs' certificate. Fix: pip3 install certifi  (then restart)")
            else:
                print("  Voice failed:", e)
            return self._json(502, {"error": str(e)[:200]})
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)

    def log_message(self, fmt, *args):
        pass  # keep the terminal quiet


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # no packet is sent; just picks the Wi-Fi address
        return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()


if __name__ == "__main__":
    ip = lan_ip()
    print("\nRosie is running" + (", with Sarah's voice." if KEY else " (built-in voice, no ElevenLabs key)."))
    print(f"  On this Mac:            http://localhost:{PORT}")
    if ip:
        print(f"  On the iPad (same Wi-Fi): http://{ip}:{PORT}")
    print("Press Ctrl+C to stop.\n")
    try:
        ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
    except OSError as e:
        sys.exit(f"Port {PORT} is busy ({e}). Stop the other server first (Ctrl+C in its window).")
    except KeyboardInterrupt:
        print("\nBye from Rosie.")
