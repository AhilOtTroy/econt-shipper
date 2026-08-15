#!/usr/bin/env python3
"""Local web UI for the batch watermark remover. Same engine as the CLI.

Windows:  double-click start_watermark.bat and nothing else. It downloads its
          own private Python into the folder, so no Python needs to be
          installed and no installed Python can interfere.

Elsewhere, with your own Python 3.10-3.13:
          pip install --no-deps iopaint==1.6.0
          pip install -r requirements-watermark.txt
          python watermark_web.py

The --no-deps is deliberate: IOPaint pins Pillow==9.5.0, which cannot build on
Python 3.12+. See requirements-watermark.txt.

Model weights (~300 MB) download themselves on first run and the browser
opens on its own. There is no separate setup command to get wrong.

Paste images with Ctrl+V (paste as many times as you like), drop them on the
page, or pick files. Hit Clean all, then download them one by one or as a zip.

Runs on 127.0.0.1 only: the images never leave the machine. Model failures
still stop the server at startup rather than being discovered per request; a
per-image failure is shown on that image's card and counted, never hidden.
"""

import argparse
import io
import os
import socket
import sys
import threading
import time
import webbrowser
import zipfile

import cv2

from watermark_core import (
    DEFAULT_DILATE,
    DEFAULT_ICON_PAD,
    DEFAULT_FLAT_FRAC,
    DEFAULT_MIN_CONF,
    DEFAULT_EDGE_MARGIN,
    DEFAULT_MIN_HEIGHT_FRAC,
    DEFAULT_MODEL_DIR,
    Engine,
    WatermarkError,
    decode_image,
)

from flask import Flask, Response, jsonify, request, send_file

app = Flask(__name__)
ENGINE = None
ENGINE_LOCK = threading.Lock()  # one LaMa forward pass at a time
RESULTS = {}                    # session id -> {filename: cleaned bytes}
RESULTS_LOCK = threading.Lock()

UI_VERSION = "2026-08-04.3"
HERE = os.path.dirname(os.path.abspath(__file__))
UI_FILE = os.path.join(HERE, "watermark_ui.html")


@app.get("/")
def index():
    if not os.path.isfile(UI_FILE):
        return Response(f"missing UI file: {UI_FILE}", status=500, mimetype="text/plain")
    with open(UI_FILE, "r", encoding="utf-8") as handle:
        response = Response(handle.read(), mimetype="text/html")
    # Never let the browser reuse an old copy of this page. The page and the
    # server ship together and are updated together; a cached page from a
    # previous version can be missing controls the current one expects, which
    # surfaces as the page appearing not to reach the server at all.
    response.headers["Cache-Control"] = "no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    return response


@app.get("/api/ping")
def ping():
    """Cheap liveness check so the page can say plainly whether it can reach
    the program, instead of every failure looking like a network error."""
    return jsonify(ok=True, version=UI_VERSION)


@app.get("/favicon.ico")
def favicon():
    return Response(status=204)


@app.post("/api/clean")
def clean():
    """Clean one image. The browser calls this once per image so it can show
    real progress and keep going when a single image fails."""
    upload = request.files.get("image")
    if upload is None:
        return jsonify(ok=False, error="no image in request"), 400

    session = request.form.get("session", "").strip() or "default"
    name = os.path.basename(upload.filename or "pasted.png")

    def number(field, fallback, cast=float):
        raw = request.form.get(field)
        if raw in (None, ""):
            return fallback
        try:
            return cast(raw)
        except ValueError:
            raise WatermarkError(f"bad value for {field}: {raw!r}")

    started = time.time()
    try:
        options = dict(
            dilate=number("dilate", DEFAULT_DILATE, int),
            min_height_frac=number("min_height_frac", DEFAULT_MIN_HEIGHT_FRAC),
            flat_frac=number("flat_frac", DEFAULT_FLAT_FRAC),
            min_conf=number("min_conf", DEFAULT_MIN_CONF),
            edge_margin=number("edge_margin", DEFAULT_EDGE_MARGIN),
            words=[w.strip() for w in (request.form.get("words") or "").split(",")
                   if w.strip()],
            icon_pad=number("icon_pad", DEFAULT_ICON_PAD),
        )
        image = decode_image(upload.read())
        with ENGINE_LOCK:
            result_bgr, hits, _ = ENGINE.clean(image, **options)
    except WatermarkError as exc:
        return jsonify(ok=False, name=name, error=str(exc)), 200
    except Exception as exc:  # unexpected: still report it, never swallow it
        app.logger.exception("clean failed for %s", name)
        return jsonify(ok=False, name=name, error=f"{type(exc).__name__}: {exc}"), 200

    stem, ext = os.path.splitext(name)
    ext = ext if ext.lower() in (".png", ".jpg", ".jpeg", ".webp") else ".png"
    out_name = f"{stem}_clean{ext}"
    ok, buffer = cv2.imencode(ext, result_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
    if not ok:
        return jsonify(ok=False, name=name, error=f"could not encode result as {ext}"), 200
    data = buffer.tobytes()

    with RESULTS_LOCK:
        RESULTS.setdefault(session, {})[out_name] = data

    return jsonify(
        ok=True,
        name=name,
        out_name=out_name,
        removed=hits,
        seconds=round(time.time() - started, 1),
        width=result_bgr.shape[1],
        height=result_bgr.shape[0],
        url=f"/api/result/{session}/{out_name}",
    )


@app.get("/api/result/<session>/<path:name>")
def result(session, name):
    with RESULTS_LOCK:
        data = RESULTS.get(session, {}).get(name)
    if data is None:
        return Response("no such result", status=404, mimetype="text/plain")
    mime = "image/jpeg" if name.lower().endswith((".jpg", ".jpeg")) else "image/png"
    return send_file(io.BytesIO(data), mimetype=mime,
                     as_attachment=False, download_name=name)


@app.get("/api/zip/<session>")
def zip_results(session):
    with RESULTS_LOCK:
        files = dict(RESULTS.get(session, {}))
    if not files:
        return Response("nothing cleaned yet", status=404, mimetype="text/plain")
    memory = io.BytesIO()
    with zipfile.ZipFile(memory, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    memory.seek(0)
    return send_file(memory, mimetype="application/zip",
                     as_attachment=True, download_name="cleaned.zip")


@app.post("/api/reset/<session>")
def reset(session):
    with RESULTS_LOCK:
        RESULTS.pop(session, None)
    return jsonify(ok=True)


def main():
    ap = argparse.ArgumentParser(description="Local web UI for the batch watermark remover.")
    ap.add_argument("--host", default="127.0.0.1", help="bind address (default: localhost only)")
    # Not 5000: Hyper-V, WSL2 and Docker Desktop reserve blocks of low ports on
    # Windows, and a clash there surfaces as WinError 10013, which reads like a
    # firewall problem and would strike only after the long first-run install.
    ap.add_argument("--port", type=int, default=5057)
    ap.add_argument("--model-dir", default=DEFAULT_MODEL_DIR)
    ap.add_argument("--device", default="cpu", choices=["cpu", "cuda", "mps"])
    ap.add_argument("--no-browser", action="store_true", help="do not open a browser window")
    args = ap.parse_args()

    global ENGINE
    print("starting up — the first run downloads ~300 MB of model weights,", flush=True)
    print("after that it takes a few seconds.\n", flush=True)
    try:
        ENGINE = Engine(model_dir=args.model_dir, device=args.device, with_detector=True)
    except WatermarkError as exc:
        print(f"\nFATAL: {exc}", file=sys.stderr, flush=True)
        sys.exit(1)
    print(f"model      : {ENGINE.checkpoint}", flush=True)

    # Claim the port before announcing it. Binding can fail for reasons the
    # user cannot act on (another copy already running, or Windows reserving
    # the range), and failing after a long install with a bare traceback would
    # be a miserable place to stop.
    port = None
    for candidate in range(args.port, args.port + 20):
        probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            probe.bind((args.host, candidate))
        except OSError:
            probe.close()
            continue
        probe.close()
        port = candidate
        break
    if port is None:
        print(f"\nFATAL: no free port between {args.port} and {args.port + 19} on "
              f"{args.host}. Another copy may already be running — check your "
              f"browser tabs.", file=sys.stderr, flush=True)
        sys.exit(1)
    if port != args.port:
        print(f"port {args.port} was busy, using {port}", flush=True)

    url = f"http://{args.host}:{port}"
    print(f"\n  ready — {url}\n", flush=True)
    if not args.no_browser:
        # Poll until the server actually answers before opening the browser.
        # A fixed delay was a guess: on a slow machine the page could load
        # before Flask was listening, which looks exactly like "the UI cannot
        # reach the server" and only a manual reload fixed it.
        def open_when_ready():
            import urllib.request
            for _ in range(60):
                try:
                    with urllib.request.urlopen(url + "/api/ping", timeout=1):
                        break
                except Exception:
                    time.sleep(0.5)
            webbrowser.open(url)
        threading.Thread(target=open_when_ready, daemon=True).start()
    app.run(host=args.host, port=port, threaded=True, debug=False)


if __name__ == "__main__":
    main()
