"""Shared watermark-removal core: LaMa inpainting + overlay-text detection.

Used by both entry points — watermark_remover.py (CLI) and watermark_web.py
(local web UI). Everything here raises WatermarkError instead of exiting, so
each front end decides what a failure looks like.
"""

import os

import cv2
import numpy as np

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff")

DEFAULT_MODEL_DIR = os.path.expanduser("~/.iopaint")
DEFAULT_DILATE = 6
DEFAULT_MIN_HEIGHT_FRAC = 0.012
DEFAULT_FLAT_FRAC = 0.10
DEFAULT_MIN_CONF = 0.30


class WatermarkError(Exception):
    """Anything that should stop work on an image, with a message worth showing."""


def find_lama_checkpoint(model_dir):
    """Locate big-lama.pt and the cache root that has to be exported for it.

    IOPaint resolves weights through XDG_CACHE_HOME/torch/hub/checkpoints, so we
    only accept locations IOPaint itself can load from. Finding the file
    somewhere IOPaint cannot see would let this check pass and fail later.
    Returns (checkpoint_path, cache_root) or (None, paths_tried).
    """
    tried = []
    for root in [model_dir, os.path.expanduser("~/.cache")]:
        path = os.path.join(root, "torch", "hub", "checkpoints", "big-lama.pt")
        tried.append(path)
        if os.path.isfile(path):
            return path, root
    return None, tried


def ensure_lama(model_dir, auto_download=True):
    """Return (checkpoint, cache_root), fetching the weights if they are absent.

    Downloading here rather than making the user run a separate `iopaint`
    command keeps setup to one step and works the same on Windows, macOS and
    Linux — there is no console script to be missing from PATH.
    """
    checkpoint, found = find_lama_checkpoint(model_dir)
    if checkpoint:
        return checkpoint, found

    tried = found
    if not auto_download:
        raise WatermarkError(
            "LaMa model weights not found. Looked in:\n  " + "\n  ".join(tried)
            + "\n\nRe-run without --no-download to fetch them automatically."
        )

    os.makedirs(model_dir, exist_ok=True)
    # Must be set before importing the model registry: it decides where the
    # download lands and where IOPaint later looks for it.
    os.environ["XDG_CACHE_HOME"] = model_dir
    print(f"downloading LaMa weights (~200 MB, one time) to {model_dir} ...", flush=True)
    try:
        from iopaint.model import models
        models["lama"].download()
    except Exception as exc:
        raise WatermarkError(
            f"could not download the LaMa weights: {type(exc).__name__}: {exc}\n"
            "Check the internet connection and that this folder is writable:\n"
            f"    {model_dir}"
        )

    checkpoint, found = find_lama_checkpoint(model_dir)
    if not checkpoint:
        raise WatermarkError(
            "the LaMa download reported success but the file is not where "
            "IOPaint looks for it. Expected:\n  " + "\n  ".join(tried)
        )
    print("LaMa weights ready.", flush=True)
    return checkpoint, found


def ensure_ocr(gpu=False):
    """Build the EasyOCR reader, downloading its weights on first use."""
    model_dir = os.path.expanduser("~/.EasyOCR/model")
    needed = ["craft_mlt_25k.pth", "english_g2.pth"]
    if any(not os.path.isfile(os.path.join(model_dir, n)) for n in needed):
        print("downloading text-detector weights (~100 MB, one time) ...", flush=True)
    import easyocr
    try:
        return easyocr.Reader(["en"], gpu=gpu, verbose=False, download_enabled=True)
    except Exception as exc:
        raise WatermarkError(
            f"could not prepare the text detector: {type(exc).__name__}: {exc}\n"
            "Check the internet connection, then try again."
        )


def decode_image(data):
    """Decode raw bytes to a BGR array, or raise. cv2 returns None, never raises."""
    array = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if array is None:
        raise WatermarkError("unreadable or corrupt image data")
    if array.ndim != 3 or array.shape[2] != 3:
        raise WatermarkError(f"unexpected image shape {array.shape}")
    return array


def read_image(path):
    array = cv2.imread(path, cv2.IMREAD_COLOR)
    if array is None:
        raise WatermarkError(f"unreadable or corrupt image: {path}")
    if array.ndim != 3 or array.shape[2] != 3:
        raise WatermarkError(f"unexpected image shape {array.shape} in {path}")
    return array


def read_mask(path):
    mask = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if mask is None:
        raise WatermarkError(f"unreadable or corrupt mask: {path}")
    binary = (mask > 127).astype(np.uint8) * 255
    if binary.max() == 0:
        raise WatermarkError(f"mask is entirely black, nothing would be removed: {path}")
    return binary


class Engine:
    """Holds the loaded models. Build once, clean many images."""

    def __init__(self, model_dir=DEFAULT_MODEL_DIR, device="cpu", with_detector=True,
                 auto_download=True):
        self.checkpoint, cache_root = ensure_lama(model_dir, auto_download=auto_download)

        # Point IOPaint at the cache root that actually holds the weights we
        # found. Set, not setdefault: an inherited value would ignore model_dir.
        os.environ["XDG_CACHE_HOME"] = cache_root
        import torch
        from iopaint.model_manager import ModelManager
        from iopaint.schema import HDStrategy, InpaintRequest

        self.device = device
        self.model = ModelManager(name="lama", device=torch.device(device))
        self.config = InpaintRequest(
            hd_strategy=HDStrategy.CROP,
            hd_strategy_crop_trigger_size=1024,
            hd_strategy_crop_margin=196,
            hd_strategy_resize_limit=2048,
        )
        self.reader = ensure_ocr(gpu=(device == "cuda")) if with_detector else None

    def detect(self, image_rgb, dilate=DEFAULT_DILATE,
               min_height_frac=DEFAULT_MIN_HEIGHT_FRAC,
               flat_frac=DEFAULT_FLAT_FRAC, min_conf=DEFAULT_MIN_CONF):
        """Find overlaid text and return (mask, texts), or (None, []) if none.

        Three filters keep photo content out of the mask, which matters because
        the detector also finds real text in the scene — bike decals, signage.
        A box counts as a watermark only if it is:
          1. tall enough — watermarks are big, stamped-on decals are small;
          2. flat black or flat white — what a rendered overlay looks like, and
             what photographed text, lit and textured, almost never looks like;
          3. read with high confidence — overlay text is crisp so OCR is sure of
             it, while a warped decal scores near zero.
        """
        if self.reader is None:
            raise WatermarkError("this engine was built without the text detector")
        height, width = image_rgb.shape[:2]
        mask = np.zeros((height, width), dtype=np.uint8)
        hits = []
        for box, text, confidence in self.reader.readtext(
            image_rgb, text_threshold=0.6, low_text=0.35, link_threshold=0.4
        ):
            points = np.array(box, dtype=np.int32)
            x0, x1 = max(0, int(points[:, 0].min())), min(width, int(points[:, 0].max()))
            y0, y1 = max(0, int(points[:, 1].min())), min(height, int(points[:, 1].max()))
            if x1 <= x0 or y1 <= y0:
                continue
            if (y1 - y0) < min_height_frac * height:
                continue
            if confidence < min_conf:
                continue
            roi = image_rgb[y0:y1, x0:x1].reshape(-1, 3).astype(np.int16)
            high = roi.max(axis=1)
            low = roi.min(axis=1)
            chroma = high - low
            flat_black = float(((high < 60) & (chroma < 30)).mean())
            flat_white = float(((low > 200) & (chroma < 30)).mean())
            if max(flat_black, flat_white) < flat_frac:
                continue
            cv2.rectangle(mask, (x0, y0), (x1, y1), 255, -1)
            hits.append(text.strip())
        if not hits:
            return None, []
        if dilate > 0:
            k = 2 * dilate + 1
            mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        return mask, hits

    def inpaint(self, image_bgr, mask):
        """Erase the masked area. Returns BGR, ready for cv2.imwrite/imencode."""
        # IOPaint takes RGB and returns BGR; cv2 gives us BGR. Getting this
        # wrong silently swaps red and blue in every output image.
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        result = self.model(image_rgb, mask, self.config)
        return np.clip(result, 0, 255).astype(np.uint8)

    def clean(self, image_bgr, fixed_mask=None, **detect_kwargs):
        """Detect (or use the given mask) and inpaint.

        Returns (result_bgr, texts, mask). The mask comes back so callers can
        show or save what was actually erased.
        """
        height, width = image_bgr.shape[:2]
        if fixed_mask is not None:
            if fixed_mask.shape[:2] != (height, width):
                raise WatermarkError(
                    f"mask is {fixed_mask.shape[1]}x{fixed_mask.shape[0]} but the image "
                    f"is {width}x{height}. A fixed mask only works on identically sized "
                    f"images — resize the mask, or auto-detect instead."
                )
            return self.inpaint(image_bgr, fixed_mask), ["fixed mask"], fixed_mask

        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        mask, hits = self.detect(image_rgb, **detect_kwargs)
        if mask is None:
            raise WatermarkError(
                "no watermark detected. Not writing a silent copy. Either the "
                "watermark is not flat black/white text, or it is too small — "
                "lower the size/confidence thresholds, or supply a mask."
            )
        return self.inpaint(image_bgr, mask), hits, mask
