#!/usr/bin/env python3
"""Local web UI for the batch watermark remover. Same engine as the CLI.

    pip install iopaint easyocr opencv-python-headless flask
    iopaint download --model lama --model-dir ~/.iopaint
    python3 watermark_web.py            # then open http://127.0.0.1:5000

Paste images with Ctrl+V (paste as many times as you like), drop them on the
page, or pick files. Hit Clean all, then download them one by one or as a zip.

Runs on 127.0.0.1 only: the images never leave the machine. Model failures
still stop the server at startup rather than being discovered per request; a
per-image failure is shown on that image's card and counted, never hidden.
"""

import argparse
import io
import os
import sys
import threading
import time
import zipfile

import cv2

from watermark_core import (
    DEFAULT_DILATE,
    DEFAULT_FLAT_FRAC,
    DEFAULT_MIN_CONF,
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

HERE = os.path.dirname(os.path.abspath(__file__))
UI_FILE = os.path.join(HERE, "watermark_ui.html")


@app.get("/")
def index():
    if not os.path.isfile(UI_FILE):
        return Response(f"missing UI file: {UI_FILE}", status=500, mimetype="text/plain")
    with open(UI_FILE, "r", encoding="utf-8") as handle:
        return Response(handle.read(), mimetype="text/html")


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
    ap.add_argument("--port", type=int, default=5000)
    ap.add_argument("--model-dir", default=DEFAULT_MODEL_DIR)
    ap.add_argument("--device", default="cpu", choices=["cpu", "cuda", "mps"])
    args = ap.parse_args()

    global ENGINE
    print(f"loading LaMa on {args.device} (once, takes a few seconds)...", flush=True)
    try:
        ENGINE = Engine(model_dir=args.model_dir, device=args.device, with_detector=True)
    except WatermarkError as exc:
        print(f"\nFATAL: {exc}", file=sys.stderr, flush=True)
        sys.exit(1)
    print(f"model      : {ENGINE.checkpoint}", flush=True)
    print(f"\n  open http://{args.host}:{args.port}\n", flush=True)
    app.run(host=args.host, port=args.port, threaded=True, debug=False)


if __name__ == "__main__":
    main()
