#!/usr/bin/env python3
"""Batch watermark remover. Local LaMa inpainting via IOPaint. No cloud, no per-image cost.

Setup (once):
    pip install iopaint easyocr opencv-python-headless
    iopaint download --model lama --model-dir ~/.iopaint

Usage:
    # auto-detect the watermark text in each image (watermark moves between images)
    python3 watermark_remover.py --input ./in --output ./out

    # fixed watermark in the same place in every image: supply your own mask
    # (white = remove, black = keep, same pixel size as the images)
    python3 watermark_remover.py --input ./in --output ./out --mask ./mask.png

Fails fast and loudly: a missing model, a missing input folder, an unreadable
image, a mask that does not match, or an image with no watermark found aborts
the run with exit code 1. Nothing is silently skipped or passed through.
"""

import argparse
import os
import sys
import time

import cv2
import numpy as np

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff")


def die(msg):
    """Loud, immediate stop. Every failure path in this script ends here."""
    print(f"\nFATAL: {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


def find_lama_checkpoint(model_dir):
    """Locate big-lama.pt, or die telling the user exactly how to get it.

    IOPaint resolves weights through XDG_CACHE_HOME/torch/hub/checkpoints, so we
    return the cache root that has to be exported, not just the file, and only
    accept locations IOPaint itself can load from. Finding the file somewhere
    IOPaint cannot see would let this check pass and fail confusingly later.
    """
    roots = [model_dir, os.path.expanduser("~/.cache")]
    tried = []
    for root in roots:
        path = os.path.join(root, "torch", "hub", "checkpoints", "big-lama.pt")
        tried.append(path)
        if os.path.isfile(path):
            return path, root
    die(
        "LaMa model weights not found. Looked in:\n  "
        + "\n  ".join(tried)
        + "\n\nDownload them first (one time, ~200 MB):\n"
        f"    iopaint download --model lama --model-dir {model_dir}"
    )


def check_ocr_checkpoints():
    """Verify the EasyOCR detector + recogniser weights exist, or die with the fix."""
    model_dir = os.path.expanduser("~/.EasyOCR/model")
    needed = ["craft_mlt_25k.pth", "english_g2.pth"]
    missing = [n for n in needed if not os.path.isfile(os.path.join(model_dir, n))]
    if missing:
        die(
            f"text-detector weights missing from {model_dir}: {', '.join(missing)}\n\n"
            "Download them first (one time, ~100 MB):\n"
            "    python3 -c \"import easyocr; easyocr.Reader(['en'], gpu=False)\""
        )


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


def read_image(path):
    """Decode or die. cv2 returns None instead of raising, so check explicitly."""
    data = cv2.imread(path, cv2.IMREAD_COLOR)
    if data is None:
        die(f"unreadable or corrupt image: {path}")
    if data.ndim != 3 or data.shape[2] != 3:
        die(f"unexpected image shape {data.shape} in {path}")
    return data


def read_mask(path):
    mask = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if mask is None:
        die(f"unreadable or corrupt mask: {path}")
    binary = (mask > 127).astype(np.uint8) * 255
    if binary.max() == 0:
        die(f"mask is entirely black, nothing would be removed: {path}")
    return binary


def detect_watermark_mask(reader, image, dilate_px, min_height_frac, flat_min, conf_min):
    """Find overlaid text and return it as a white-on-black mask.

    Three filters keep photo content out of the mask, which matters because the
    detector also finds real text in the scene — bike decals, building signs.
    A box is only treated as a watermark if it is:
      1. tall enough  — watermarks are big, stamped-on decals are small;
      2. flat black or flat white — what a rendered overlay looks like, and what
         photographed text, lit and textured, almost never looks like;
      3. read with high confidence — overlay text is crisp, so OCR is sure of
         it, while a warped decal scores near zero.
    """
    height, width = image.shape[:2]
    mask = np.zeros((height, width), dtype=np.uint8)
    hits = []
    for box, text, confidence in reader.readtext(
        image, text_threshold=0.6, low_text=0.35, link_threshold=0.4
    ):
        points = np.array(box, dtype=np.int32)
        x0, x1 = max(0, int(points[:, 0].min())), min(width, int(points[:, 0].max()))
        y0, y1 = max(0, int(points[:, 1].min())), min(height, int(points[:, 1].max()))
        if x1 <= x0 or y1 <= y0:
            continue
        if (y1 - y0) < min_height_frac * height:
            continue
        if confidence < conf_min:
            continue
        roi = image[y0:y1, x0:x1].reshape(-1, 3).astype(np.int16)
        high = roi.max(axis=1)
        low = roi.min(axis=1)
        chroma = high - low
        flat_black = float(((high < 60) & (chroma < 30)).mean())
        flat_white = float(((low > 200) & (chroma < 30)).mean())
        if max(flat_black, flat_white) < flat_min:
            continue
        cv2.rectangle(mask, (x0, y0), (x1, y1), 255, -1)
        hits.append(text.strip())
    if not hits:
        return None, []
    if dilate_px > 0:
        k = 2 * dilate_px + 1
        mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    return mask, hits


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
    ap.add_argument("--model-dir", default=os.path.expanduser("~/.iopaint"),
                    help="where LaMa weights live (default: ~/.iopaint)")
    ap.add_argument("--device", default="cpu", choices=["cpu", "cuda", "mps"])
    ap.add_argument("--dilate", type=int, default=6,
                    help="grow the mask by N px so watermark edges go too (default: 6)")
    ap.add_argument("--min-height-frac", type=float, default=0.012,
                    help="auto-detect: ignore text shorter than this fraction of image height")
    ap.add_argument("--flat-frac", type=float, default=0.10,
                    help="auto-detect: min fraction of flat black/white pixels in a text box")
    ap.add_argument("--min-conf", type=float, default=0.30,
                    help="auto-detect: min OCR confidence for a box to count as a watermark")
    ap.add_argument("--save-masks", metavar="DIR",
                    help="also write the mask used for each image, for inspection")
    args = ap.parse_args()

    print("=== batch watermark remover (LaMa / IOPaint, local) ===", flush=True)

    # --- preflight: every check that can fail happens before any image is written ---
    images = list_images(args.input)
    checkpoint, cache_root = find_lama_checkpoint(args.model_dir)
    print(f"model      : {checkpoint}", flush=True)

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
        fixed_mask = read_mask(args.mask)
        print(f"mask       : {args.mask} (fixed, {fixed_mask.shape[1]}x{fixed_mask.shape[0]})", flush=True)
    else:
        print("mask       : auto-detect per image", flush=True)

    # Decode everything up front so a corrupt file at #90 of 100 fails in second 1.
    print("checking all images are readable...", flush=True)
    for path in images:
        read_image(path)

    # Point IOPaint at the cache root that actually holds the weights we found.
    # Set, not setdefault: an inherited value would silently ignore --model-dir.
    os.environ["XDG_CACHE_HOME"] = cache_root
    import torch
    from iopaint.model_manager import ModelManager
    from iopaint.schema import HDStrategy, InpaintRequest

    reader = None
    if fixed_mask is None:
        check_ocr_checkpoints()
        import easyocr
        reader = easyocr.Reader(["en"], gpu=(args.device == "cuda"), verbose=False)

    print(f"loading LaMa on {args.device}...", flush=True)
    model = ModelManager(name="lama", device=torch.device(args.device))
    config = InpaintRequest(
        hd_strategy=HDStrategy.CROP,
        hd_strategy_crop_trigger_size=1024,
        hd_strategy_crop_margin=196,
        hd_strategy_resize_limit=2048,
    )

    done = 0
    failed = 0
    started = time.time()
    for index, path in enumerate(images, 1):
        name = os.path.basename(path)
        print(f"[{index}/{len(images)}] {name} ... ", end="", flush=True)
        image = read_image(path)
        height, width = image.shape[:2]
        # IOPaint and EasyOCR both take RGB; cv2 gives us BGR. Getting this
        # wrong silently swaps red and blue in every output image.
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        if fixed_mask is not None:
            if fixed_mask.shape[:2] != (height, width):
                failed += 1
                print("MASK MISMATCH", flush=True)
                print(f"summary: {done} done, {failed} failed", flush=True)
                die(
                    f"mask is {fixed_mask.shape[1]}x{fixed_mask.shape[0]} but {name} is "
                    f"{width}x{height}. A fixed mask only works on identically sized "
                    f"images — resize the mask, or drop --mask to auto-detect."
                )
            mask = fixed_mask
            where = "fixed mask"
        else:
            mask, hits = detect_watermark_mask(
                reader, image_rgb, args.dilate, args.min_height_frac,
                args.flat_frac, args.min_conf,
            )
            if mask is None:
                failed += 1
                print("NO WATERMARK FOUND", flush=True)
                print(f"summary: {done} done, {failed} failed", flush=True)
                die(
                    f"no watermark detected in {name}. Not writing a silent copy.\n"
                    f"Either the watermark is not flat black/white text, or it is smaller "
                    f"than --min-height-frac {args.min_height_frac}. Lower "
                    f"--min-height-frac / --flat-frac / --min-conf, or supply --mask."
                )
            where = "removed: " + " | ".join(hits)

        result_bgr = model(image_rgb, mask, config)  # RGB in, BGR out
        result_bgr = np.clip(result_bgr, 0, 255).astype(np.uint8)

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
        print(f"cleaned [{where}] -> {out_path}", flush=True)

    print(
        f"\nsummary: {done} done, {failed} failed "
        f"({time.time() - started:.1f}s, {len(images)} images)",
        flush=True,
    )


if __name__ == "__main__":
    main()
