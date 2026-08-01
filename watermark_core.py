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
# Measured across both sample sets: real watermarks are 0.040 to 0.090 of the
# image height (Avito 0.040, Kufar 0.090, the hand-added ones 0.053 to 0.081),
# while the things that must survive are 0.010 to 0.020 (a product name, the
# small print on a box, a price sticker). 0.03 sits in the gap. Erring high is
# deliberate: a missed watermark is obvious and one slider away, whereas
# quietly erasing the printing on the item may not be noticed until it is sold.
DEFAULT_MIN_HEIGHT_FRAC = 0.03
# Off by default. Overlay text is not reliably flat: marketplace watermarks are
# semi-transparent grey and score ~0.00 here, so this filter would reject them.
# The edge restriction below is what keeps photo content safe instead.
DEFAULT_FLAT_FRAC = 0.0
DEFAULT_MIN_CONF = 0.30
# Only treat text as a watermark if it sits in the outer quarter of the frame.
# Watermarks are stamped into a corner or along an edge; the things we must not
# touch — a product name, a label, printing on a box — sit in the middle. Set
# to 1.0 to consider the whole frame.
DEFAULT_EDGE_MARGIN = 0.25
# How far to grow a matched text box sideways, in multiples of its own height,
# so the logo glyph that sits beside the wordmark is erased with it. Measured
# on Avito (dots icon, ~0.9 heights wide plus a gap) and Kufar (hexagon,
# ~1.2 heights): 1.5 covers both with margin to spare.
DEFAULT_ICON_PAD = 1.5


class WatermarkError(Exception):
    """Anything that should stop work on an image, with a message worth showing."""


def _norm(text):
    return "".join(c for c in text.lower() if c.isalnum())


def _distance(a, b):
    """Levenshtein distance, for matching OCR output against a known word."""
    if len(a) < len(b):
        a, b = b, a
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        current = [i]
        for j, cb in enumerate(b, 1):
            current.append(min(previous[j] + 1,
                               current[j - 1] + 1,
                               previous[j - 1] + (ca != cb)))
        previous = current
    return previous[-1]


def matches_word(text, words):
    """True if OCR text looks like one of the given watermark words.

    The logo glyph runs into the first letter, so the same Avito mark comes back
    as "Avito", "SAvito", "8Avito", "BAvitto" and "SAvite" across a batch. Exact
    matching would catch about half of them, hence substring plus a small edit
    distance.
    """
    got = _norm(text)
    if not got:
        return False
    for word in words:
        want = _norm(word)
        if not want:
            continue
        if want in got or _distance(got, want) <= 2:
            return True
    return False


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


def easyocr_model_dir():
    """Where EasyOCR keeps its weights, honouring its own env vars.

    The Windows launcher sets EASYOCR_MODULE_PATH to a folder beside the app so
    the whole install stays self-contained.
    """
    root = (os.environ.get("EASYOCR_MODULE_PATH")
            or os.environ.get("MODULE_PATH")
            or os.path.expanduser("~/.EasyOCR"))
    return os.path.join(root, "model")


def ensure_ocr(gpu=False):
    """Build the EasyOCR reader, downloading its weights on first use."""
    model_dir = easyocr_model_dir()
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
        if device == "cpu":
            # PyTorch defaults to a conservative thread count in some builds;
            # LaMa is compute-bound, so use every core.
            try:
                torch.set_num_threads(os.cpu_count() or 1)
            except Exception:
                pass
        self.model = ModelManager(name="lama", device=torch.device(device))
        self.config = InpaintRequest(
            hd_strategy=HDStrategy.CROP,
            # Crop-around-the-mask for anything bigger than 512px, not 1024.
            # A watermark corner is a small part of the frame, and inpainting
            # only that region with 196px of context is what IOPaint's own HD
            # path does for large images — extending it to phone-sized photos
            # measured 2-4x faster with the same visual result.
            hd_strategy_crop_trigger_size=512,
            hd_strategy_crop_margin=196,
            hd_strategy_resize_limit=2048,
        )
        self.reader = ensure_ocr(gpu=(device == "cuda")) if with_detector else None

    # Detection runs on an image no larger than this on its long side. OCR cost
    # scales with area, and a watermark that passes the 3%-of-height floor is
    # still comfortably readable at this size. Boxes are mapped back to full
    # resolution, so the mask and the inpainting stay full-quality.
    DETECT_MAX_SIDE = 1024

    def _read_boxes(self, image_rgb):
        """Run OCR, downscaling first when the image is large. Returns
        (box_points, text, confidence) tuples in FULL-resolution coordinates."""
        height, width = image_rgb.shape[:2]
        scale = 1.0
        detect_img = image_rgb
        long_side = max(height, width)
        if long_side > self.DETECT_MAX_SIDE:
            scale = self.DETECT_MAX_SIDE / long_side
            detect_img = cv2.resize(
                image_rgb, (int(width * scale), int(height * scale)),
                interpolation=cv2.INTER_AREA,
            )
        results = []
        for box, text, confidence in self.reader.readtext(
            detect_img, text_threshold=0.6, low_text=0.35, link_threshold=0.4
        ):
            points = np.array(box, dtype=np.float64) / scale
            results.append((points.astype(np.int32), text, confidence))
        return results

    def _read_boxes_filtered(self, image_rgb, min_height_frac, edge_margin):
        """Detect text everywhere, but only pay for recognition where a
        watermark could legally be.

        Measured on a real listing photo: the detector finds ~76 text regions
        (all the printing on the product box), recognising them all costs
        3.6s, and recognising the one region that survives the geometry
        filters costs 0.01s. So the size and edge-band filters run BEFORE
        recognition, on the detector's raw boxes, with a little slack; the
        exact filters run again afterwards on the recognised results.
        """
        from easyocr.utils import reformat_input

        height, width = image_rgb.shape[:2]
        scale = 1.0
        detect_img = image_rgb
        long_side = max(height, width)
        if long_side > self.DETECT_MAX_SIDE:
            scale = self.DETECT_MAX_SIDE / long_side
            detect_img = cv2.resize(
                image_rgb, (int(width * scale), int(height * scale)),
                interpolation=cv2.INTER_AREA,
            )
        det_h, det_w = detect_img.shape[:2]
        image, grey = reformat_input(detect_img)
        h_lists, f_lists = self.reader.detect(
            image, text_threshold=0.6, low_text=0.35, link_threshold=0.4
        )
        h_list, f_list = h_lists[0], f_lists[0]

        def plausible(x0, x1, y0, y1):
            # Slightly loose versions of the real filters, so nothing that
            # could pass them is dropped before recognition.
            if (y1 - y0) < 0.85 * min_height_frac * det_h:
                return False
            if edge_margin >= 1.0:
                return True
            band = min(1.0, edge_margin * 1.15)
            return (y1 <= band * det_h or y0 >= (1.0 - band) * det_h
                    or x1 <= band * det_w or x0 >= (1.0 - band) * det_w)

        h_keep = [b for b in h_list if plausible(b[0], b[1], b[2], b[3])]
        f_keep = []
        for quad in f_list:
            pts = np.array(quad)
            if plausible(pts[:, 0].min(), pts[:, 0].max(),
                         pts[:, 1].min(), pts[:, 1].max()):
                f_keep.append(quad)
        if not h_keep and not f_keep:
            return []

        results = []
        for box, text, confidence in self.reader.recognize(grey, h_keep, f_keep):
            points = np.array(box, dtype=np.float64) / scale
            results.append((points.astype(np.int32), text, confidence))
        return results

    def _read_corners(self, image_rgb, edge_margin):
        """Second-chance pass: OCR each corner region at 2x magnification.

        A small or low-contrast watermark that the full-frame pass misses is
        usually still there — just under the detector's resolution. Corners are
        a fraction of the image, so magnifying them is cheap, and boxes come
        back in full-image coordinates ready for the same filters.
        """
        height, width = image_rgb.shape[:2]
        band_h = max(1, int(edge_margin * height * 1.4))
        band_w = max(1, int(edge_margin * width * 1.4))
        regions = [
            (0, 0), (width - band_w, 0),
            (0, height - band_h), (width - band_w, height - band_h),
        ]
        results = []
        for ox, oy in regions:
            crop = image_rgb[oy:oy + band_h, ox:ox + band_w]
            if crop.size == 0:
                continue
            # Magnify small corners fully, but cap the working size: the point
            # is rescuing marks below the detector's resolution, and a corner
            # of a large photo is already at a readable scale. Without the cap
            # a clean 1080x1920 image paid 14s just to confirm it was clean.
            factor = min(2.0, max(1.0, 900.0 / max(crop.shape[:2])))
            zoomed = crop if factor == 1.0 else cv2.resize(
                crop, (int(crop.shape[1] * factor), int(crop.shape[0] * factor)),
                interpolation=cv2.INTER_CUBIC)
            for box, text, confidence in self.reader.readtext(
                zoomed, text_threshold=0.5, low_text=0.3, link_threshold=0.4
            ):
                points = np.array(box, dtype=np.float64) / factor
                points[:, 0] += ox
                points[:, 1] += oy
                results.append((points.astype(np.int32), text, confidence))
        return results

    def detect(self, image_rgb, dilate=DEFAULT_DILATE,
               min_height_frac=DEFAULT_MIN_HEIGHT_FRAC,
               flat_frac=DEFAULT_FLAT_FRAC, min_conf=DEFAULT_MIN_CONF,
               edge_margin=DEFAULT_EDGE_MARGIN, words=None,
               icon_pad=DEFAULT_ICON_PAD, thorough=True, region=None):
        """Find overlaid text and return (mask, texts), or (None, []) if none.

        Several filters keep photo content out of the mask, which matters
        because the detector also finds real text in the scene — a bike decal,
        signage, the printing on a product box. A box counts as a watermark
        only if it is:
          1. inside the outer edge band — this is the one that does the heavy
             lifting. Watermarks are stamped into a corner; a product name and
             the small print on packaging are in the middle of the frame. On a
             photo of a boxed product, dropping this filter erases the box's
             own printing, which is far worse than missing a watermark;
          2. tall enough — watermarks are big, stamped-on decals are small;
          3. read with high confidence — overlay text is crisp so OCR is sure
             of it, while a warped decal scores near zero;
          4. optionally flat black or white, off by default, since a
             semi-transparent grey watermark fails it;
          5. optionally one of a given list of words. Geometry alone cannot
             always win — on a photo of a boxed product, "Pencil Pro" printed
             near the right edge is the same size and position as a corner
             watermark. Naming the watermark makes it exact.
        """
        if self.reader is None:
            raise WatermarkError("this engine was built without the text detector")
        height, width = image_rgb.shape[:2]

        def accept(candidates):
            mask = np.zeros((height, width), dtype=np.uint8)
            found = []
            for points, text, confidence in candidates:
                x0, x1 = max(0, int(points[:, 0].min())), min(width, int(points[:, 0].max()))
                y0, y1 = max(0, int(points[:, 1].min())), min(height, int(points[:, 1].max()))
                if x1 <= x0 or y1 <= y0:
                    continue
                if (y1 - y0) < min_height_frac * height:
                    continue
                if confidence < min_conf:
                    continue
                if words and not matches_word(text, words):
                    continue
                if edge_margin < 1.0:
                    # The box must lie wholly within one of the four outer bands.
                    near = (y1 <= edge_margin * height              # top
                            or y0 >= (1.0 - edge_margin) * height   # bottom
                            or x1 <= edge_margin * width            # left
                            or x0 >= (1.0 - edge_margin) * width)   # right
                    if not near:
                        continue
                roi = image_rgb[y0:y1, x0:x1].reshape(-1, 3).astype(np.int16)
                high = roi.max(axis=1)
                low = roi.min(axis=1)
                chroma = high - low
                flat_black = float(((high < 60) & (chroma < 30)).mean())
                flat_white = float(((low > 200) & (chroma < 30)).mean())
                if max(flat_black, flat_white) < flat_frac:
                    continue
                # Watermarks are rarely text alone: a logo glyph sits beside the
                # word (OCR boxes only the letters, so the icon would survive
                # and betray the removal). Grow the box sideways by icon_pad
                # text-heights and a little vertically. The growth is bounded
                # by the text's own height, so it stays a local patch — and at
                # a corner most of it just falls off the edge of the frame.
                grow_x = int(icon_pad * (y1 - y0))
                grow_y = int(0.4 * (y1 - y0))
                x0g, x1g = max(0, x0 - grow_x), min(width, x1 + grow_x)
                y0g, y1g = max(0, y0 - grow_y), min(height, y1 + grow_y)
                cv2.rectangle(mask, (x0g, y0g), (x1g, y1g), 255, -1)
                found.append(text.strip())
            return (mask, found) if found else (None, [])

        if region is not None:
            # OCR only this window (full-image coordinates). Used by the verify
            # pass, which only needs to look where something was just erased —
            # a fraction of the frame, so a fraction of the cost. Boxes are
            # offset back so every filter still runs in full-image terms.
            rx0, ry0, rx1, ry1 = region
            rx0, ry0 = max(0, rx0), max(0, ry0)
            rx1, ry1 = min(width, rx1), min(height, ry1)
            if rx1 <= rx0 or ry1 <= ry0:
                return None, []
            offset_boxes = []
            for points, text, confidence in self._read_boxes(image_rgb[ry0:ry1, rx0:rx1]):
                shifted = points.copy()
                shifted[:, 0] += rx0
                shifted[:, 1] += ry0
                offset_boxes.append((shifted, text, confidence))
            mask, hits = accept(offset_boxes)
        else:
            mask, hits = accept(self._read_boxes_filtered(
                image_rgb, min_height_frac, edge_margin))
            if mask is None and thorough and edge_margin < 1.0:
                # Nothing found at native resolution: magnify the corners and
                # look again. This is what catches the small or washed-out
                # marks the first pass slides over. Skipped when
                # thorough=False, since running four magnified OCR crops just
                # to confirm a clean result would double the cost of every
                # image.
                mask, hits = accept(self._read_corners(image_rgb, edge_margin))
        if mask is None:
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
            words = detect_kwargs.get("words")
            hint = (f"No text matched {', '.join(words)}. " if words else
                    "Nothing looked like a watermark. ")
            raise WatermarkError(
                "no watermark detected — this image is left alone rather than "
                "written out unchanged. " + hint
                + "Either the photo is already clean, or the mark is smaller "
                "than the minimum text height, or it sits away from the edges. "
                "Adjust those under Detection settings."
            )
        result = self.inpaint(image_bgr, mask)

        # Verify pass: look at the result the way a buyer would. If the
        # detector can still read the watermark in the cleaned image — a
        # semi-transparent remnant, or a second line the first mask clipped —
        # erase that too. Only the neighbourhood of what was just erased is
        # re-checked, so on a clean result this costs one small OCR call.
        ys, xs = np.where(mask > 0)
        pad_x = max(48, (xs.max() - xs.min()) // 2)
        pad_y = max(48, (ys.max() - ys.min()) // 2)
        neighbourhood = (int(xs.min()) - pad_x, int(ys.min()) - pad_y,
                         int(xs.max()) + pad_x, int(ys.max()) + pad_y)
        result_rgb = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)
        mask2, hits2 = self.detect(result_rgb, region=neighbourhood, **detect_kwargs)
        if mask2 is not None:
            result = self.inpaint(result, mask2)
            mask = cv2.bitwise_or(mask, mask2)
            hits = hits + [f"{t} (2nd pass)" for t in hits2]

        return result, hits, mask
