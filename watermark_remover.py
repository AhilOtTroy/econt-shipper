#!/usr/bin/env python3
"""Batch watermark remover. Local LaMa inpainting via IOPaint. No cloud, no per-image cost.

Setup (once):
    pip install --no-deps iopaint==1.6.0
    pip install -r requirements-watermark.txt
    # --no-deps is deliberate: IOPaint pins Pillow==9.5.0, which cannot build
    # on Python 3.12+. See requirements-watermark.txt.
    # Model weights download themselves on first run, no extra command.

Usage:
    # auto-detect the watermark text in each image (watermark moves between images)
    python3 watermark_remover.py --input ./in --output ./out

    # fixed watermark in the same place in every image: supply your own mask
    # (white = remove, black = keep, same pixel size as the images)
    python3 watermark_remover.py --input ./in --output ./out --mask ./mask.png

Prefer clicking to typing? python3 watermark_web.py opens the same thing as a
local web page you can paste images into.

Fails fast and loudly: a missing model, a missing input folder, an unreadable
image, a mask that does not match, or an image with no watermark found aborts
the run with exit code 1. Nothing is silently skipped or passed through.
"""

import argparse
import os
import sys
import time

import cv2

from watermark_core import (
    DEFAULT_DILATE,
    DEFAULT_FLAT_FRAC,
    DEFAULT_MIN_CONF,
    DEFAULT_MIN_HEIGHT_FRAC,
    DEFAULT_MODEL_DIR,
    IMAGE_EXTS,
    Engine,
    WatermarkError,
    read_image,
    read_mask,
)


def die(msg):
    """Loud, immediate stop. Every failure path in this script ends here."""
    print(f"\nFATAL: {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


def list_images(input_dir):
    if not os.path.isdir(input_dir):
        die(f"input folder does not exist or is not a directory: {input_dir}")
    names = sorted(
        n for n in os.listdir(input_dir)
        if n.lower().endswith(IMAGE_EXTS) and os.path.isfile(os.path.join(input_dir, n))
    )
    if not names:
        die(f"no images ({', '.join(IMAGE_EXTS)}) in input folder: {input_dir}")
    return [os.path.join(input_dir, n) for n in names]


def main():
    ap = argparse.ArgumentParser(
        description="Remove watermarks from a folder of images with local LaMa inpainting."
    )
    ap.add_argument("--input", required=True, help="folder of watermarked images")
    ap.add_argument("--output", required=True, help="folder for cleaned images (created if absent)")
    ap.add_argument(
        "--mask",
        help="fixed-watermark mask: white = remove, black = keep, must match image size. "
        "Omit to auto-detect the watermark in every image.",
    )
    ap.add_argument("--model-dir", default=DEFAULT_MODEL_DIR,
                    help="where LaMa weights live (default: ~/.iopaint)")
    ap.add_argument("--device", default="cpu", choices=["cpu", "cuda", "mps"])
    ap.add_argument("--dilate", type=int, default=DEFAULT_DILATE,
                    help="grow the mask by N px so watermark edges go too (default: 6)")
    ap.add_argument("--min-height-frac", type=float, default=DEFAULT_MIN_HEIGHT_FRAC,
                    help="auto-detect: ignore text shorter than this fraction of image height")
    ap.add_argument("--flat-frac", type=float, default=DEFAULT_FLAT_FRAC,
                    help="auto-detect: min fraction of flat black/white pixels in a text box")
    ap.add_argument("--min-conf", type=float, default=DEFAULT_MIN_CONF,
                    help="auto-detect: min OCR confidence for a box to count as a watermark")
    ap.add_argument("--save-masks", metavar="DIR",
                    help="also write the mask used for each image, for inspection")
    ap.add_argument("--no-download", action="store_true",
                    help="fail instead of fetching missing model weights")
    args = ap.parse_args()

    print("=== batch watermark remover (LaMa / IOPaint, local) ===", flush=True)

    # --- preflight: every check that can fail happens before any image is written ---
    images = list_images(args.input)

    try:
        os.makedirs(args.output, exist_ok=True)
    except OSError as exc:
        die(f"cannot create output folder {args.output}: {exc}")
    if not os.access(args.output, os.W_OK):
        die(f"output folder is not writable: {args.output}")
    if args.save_masks:
        try:
            os.makedirs(args.save_masks, exist_ok=True)
        except OSError as exc:
            die(f"cannot create mask folder {args.save_masks}: {exc}")

    print(f"input      : {args.input} ({len(images)} images)", flush=True)
    print(f"output     : {args.output}", flush=True)

    fixed_mask = None
    if args.mask:
        if not os.path.isfile(args.mask):
            die(f"mask file does not exist: {args.mask}")
        try:
            fixed_mask = read_mask(args.mask)
        except WatermarkError as exc:
            die(str(exc))
        print(f"mask       : {args.mask} (fixed, {fixed_mask.shape[1]}x{fixed_mask.shape[0]})",
              flush=True)
    else:
        print("mask       : auto-detect per image", flush=True)

    # Decode everything up front so a corrupt file at #90 of 100 fails in second 1.
    print("checking all images are readable...", flush=True)
    for path in images:
        try:
            read_image(path)
        except WatermarkError as exc:
            die(str(exc))

    print(f"loading LaMa on {args.device}...", flush=True)
    try:
        engine = Engine(
            model_dir=args.model_dir,
            device=args.device,
            with_detector=(fixed_mask is None),
            auto_download=not args.no_download,
        )
    except WatermarkError as exc:
        die(str(exc))
    print(f"model      : {engine.checkpoint}", flush=True)

    done = 0
    failed = 0
    started = time.time()
    for index, path in enumerate(images, 1):
        name = os.path.basename(path)
        print(f"[{index}/{len(images)}] {name} ... ", end="", flush=True)
        try:
            image = read_image(path)
            result_bgr, hits, mask = engine.clean(
                image,
                fixed_mask=fixed_mask,
                dilate=args.dilate,
                min_height_frac=args.min_height_frac,
                flat_frac=args.flat_frac,
                min_conf=args.min_conf,
            )
        except WatermarkError as exc:
            failed += 1
            print("FAILED", flush=True)
            print(f"summary: {done} done, {failed} failed", flush=True)
            die(f"{name}: {exc}")

        out_path = os.path.join(args.output, name)
        # Keep JPEG re-encoding loss low; ignored for PNG and the other formats.
        if not cv2.imwrite(out_path, result_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95]):
            failed += 1
            print("WRITE FAILED", flush=True)
            print(f"summary: {done} done, {failed} failed", flush=True)
            die(f"could not write {out_path}")

        if args.save_masks:
            cv2.imwrite(os.path.join(args.save_masks, name + ".mask.png"), mask)

        done += 1
        print(f"cleaned [removed: {' | '.join(hits)}] -> {out_path}", flush=True)

    print(
        f"\nsummary: {done} done, {failed} failed "
        f"({time.time() - started:.1f}s, {len(images)} images)",
        flush=True,
    )


if __name__ == "__main__":
    main()
