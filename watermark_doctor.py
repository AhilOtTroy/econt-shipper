#!/usr/bin/env python3
"""One-shot diagnostic for a failing watermark-remover install.

Stdlib only, so it runs on a bare Python with nothing installed yet. Plain
ASCII only, no colour: Windows cp1252 consoles raise UnicodeEncodeError on box
drawing and emoji, and a diagnostic that crashes is worse than useless. Every
probe is wrapped, so this prints a report rather than a traceback.

    python watermark_doctor.py        py -3.12 watermark_doctor.py
"""

import os
import platform
import shutil
import struct
import sys
import textwrap
import warnings

PACKAGES = [
    ("torch", "torch"), ("torchvision", "torchvision"), ("scipy", "scipy"),
    ("skimage", "scikit-image"), ("cv2", "opencv-python-headless"),
    ("numpy", "numpy"), ("PIL", "Pillow"), ("easyocr", "easyocr"),
    ("iopaint", "iopaint"), ("flask", "flask"), ("diffusers", "diffusers"),
    ("transformers", "transformers"),
    # python-bidi is a Rust extension easyocr calls at runtime, so it is a real
    # wheel-availability risk on a too-new Python, same class as torch.
    ("bidi", "python-bidi"),
]

PY = sys.version_info[:2]
BITS = struct.calcsize("P") * 8
HOME = os.path.expanduser("~")


def head(title):
    print("")
    print("=" * 68)
    print(title)
    print("=" * 68)


def short(exc):
    text = str(exc).replace("\n", " ").strip() or exc.__class__.__name__
    return text[:150]


def wrap(text, indent, hang=None):
    # Windows consoles are 80 columns by default and hard-wrap mid-word.
    return textwrap.fill(text, 78, initial_indent=" " * indent,
                         subsequent_indent=" " * (indent if hang is None else hang),
                         break_on_hyphens=False, break_long_words=False)


def module_version(mod, pip_name):
    # The module attribute wins over pip metadata: it is the code that will
    # really run, and it keeps build tags that matter (torch 2.13.0+cu130). If
    # the two disagree, two distributions are installed and the one importing
    # is not the one pip last wrote, so report that instead of either alone.
    try:
        attr = getattr(mod, "__version__", "")
        attr = attr if isinstance(attr, str) else ""
    except Exception:
        attr = ""
    try:
        from importlib.metadata import version
        meta = version(pip_name)
    except Exception:
        meta = ""
    if attr and meta and not attr.startswith(meta) and not meta.startswith(attr):
        return attr, ("WARNING: pip metadata says %s. Two distributions are installed and "
                      "the one importing is not the one pip last wrote." % meta)
    return attr or meta or "installed (version unknown)", ""


def probe(module, pip_name):
    """Return (installed, status, detail); absent and broken need different fixes.

    Only a ModuleNotFoundError naming this module means not installed. Anything
    else means it is present but will not load - on Windows usually ImportError
    'DLL load failed', a 32/64-bit mismatch. Calling that NOT INSTALLED would
    send the user off to reinstall, which never fixes it.
    """
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            mod = __import__(module)
        except ModuleNotFoundError as exc:
            if getattr(exc, "name", None) == module:
                return False, "NOT INSTALLED", ""
            return False, "BROKEN", "imports fine but needs %s: %s" % (exc.name, short(exc))
        except Exception as exc:
            return False, "BROKEN", "%s: %s" % (exc.__class__.__name__, short(exc))
        installed, note = module_version(mod, pip_name)
        return True, "ok    %s" % installed, note


def report_file(path):
    try:
        if os.path.isfile(path):
            mb = os.path.getsize(path) / (1024.0 * 1024.0)
            print("  FOUND    %s  (%.1f MB)" % (path, mb))
            return True
        print("  missing  %s" % path)
    except Exception as exc:
        print("  ERROR    %s  (%s)" % (path, short(exc)))
    return False


def verdict():
    """Return (tag, explanation, needs_new_python)."""
    if BITS != 64:
        return ("FATAL", "This Python is %d-bit. No 32-bit torch wheel exists for any "
                "version on any OS, so pip will always try to compile it and fail." % BITS, True)
    if PY < (3, 9):
        return ("FATAL", "Python %d.%d is too old; the wheels we need start at 3.9." % PY, True)
    if PY >= (3, 14):
        return ("RISKY", "Python %d.%d is newer than the wheels. torch, scipy and "
                "scikit-image often have no prebuilt file yet, so pip falls back to "
                "building from source, which needs a C++ compiler." % PY, True)
    if PY == (3, 13):
        return ("USUALLY FINE", "Python 3.13 has wheels for most of the stack, but new "
                "releases land here last. If an install fails, 3.12 is the safe fallback.", False)
    return ("GOOD", "Python %d.%d 64-bit is the sweet spot; every heavy package here "
            "ships a prebuilt Windows wheel." % PY, False)


def main():
    print("watermark_doctor - install diagnostic (stdlib only)")

    head("1. INTERPRETER")
    try:
        plat = "%s %s (%s)" % (platform.system(), platform.release(), platform.machine())
    except Exception as exc:
        plat = "unavailable (%s)" % short(exc)
    for label, value in (("version", "%d.%d.%d" % sys.version_info[:3]),
                         ("full version", sys.version.replace("\n", " ")),
                         ("pointer size", "%d-bit" % BITS),
                         ("executable", sys.executable), ("platform", plat)):
        print("  %-14s %s" % (label, value))

    head("2. VERDICT")
    tag, why, need_new_python = verdict()
    print("  VERDICT: %s - binary wheels for torch/scipy/scikit-image" % tag)
    print(wrap(why, 2))

    head("3. PACKAGES")
    missing = []
    for module, pip_name in PACKAGES:
        ok, status, detail = probe(module, pip_name)
        print("  %-14s %s" % (module, status))
        if detail:
            print(wrap(detail, 17))
        if not ok:
            missing.append(pip_name)

    head("4. MODEL WEIGHTS")
    print("  LaMa is looked up in several cache roots; any one hit is enough.")
    # "models" beside this file is where the self-contained Windows launcher
    # puts them; the others are the defaults when run from a normal install.
    here = os.path.dirname(os.path.abspath(__file__))
    roots = [r for r in (os.environ.get("XDG_CACHE_HOME"), os.path.join(here, "models"),
                         os.path.join(HOME, ".iopaint"), os.path.join(HOME, ".cache")) if r]
    have_lama = False
    for root in roots:
        if report_file(os.path.join(root, "torch", "hub", "checkpoints", "big-lama.pt")):
            have_lama = True
    ocr = os.path.join(
        os.environ.get("EASYOCR_MODULE_PATH")
        or os.environ.get("MODULE_PATH")
        or os.path.join(HOME, ".EasyOCR"),
        "model",
    )
    have_ocr = all([report_file(os.path.join(ocr, name))
                    for name in ("craft_mlt_25k.pth", "english_g2.pth")])
    if not (have_lama and have_ocr):
        print("  Missing weights download themselves on first run (~500 MB total).")

    head("5. DISK SPACE")
    free_gb = None
    try:
        usage = shutil.disk_usage(HOME)
        free_gb = usage.free / (1024.0 ** 3)
        print("  home           %s" % HOME)
        print("  total / free   %.1f GB / %.1f GB free" % (usage.total / (1024.0 ** 3), free_gb))
    except Exception as exc:
        print("  disk check failed: %s" % short(exc))

    head("6. WHAT TO DO")
    # Never tell anyone to run pip by hand against a Python on this PC. Doing
    # exactly that is what caused every failure this project has had: the
    # Microsoft Store Python has no prebuilt packages for itself, pip tries to
    # compile them, and it dies. start_watermark.bat downloads its own Python
    # and is the only supported way in. Everything here points back at it.
    todo = []
    if missing or need_new_python:
        todo.append(("Run start_watermark.bat again. It installs everything into "
                     "its own private Python and picks up where it stopped. Do not "
                     "run pip yourself - a Python installed on this PC cannot "
                     "install these packages, which is what the earlier errors were.",
                     ["double-click  start_watermark.bat"]))
    if free_gb is not None and free_gb < 8:
        todo.append(("Free up disk space: %.1f GB left, the full install needs about 8 GB."
                     % free_gb, []))
    if not todo:
        todo.append(("Nothing to fix. Start it by double-clicking:",
                     ["start_watermark.bat"]))
    todo.append(("If it still fails, send watermark-log.txt from this folder - "
                 "it has the whole story in one file.", []))
    for number, (text, commands) in enumerate(todo, 1):
        print(wrap("%d. %s" % (number, text), 2, 5))
        for command in commands:
            print("       %s" % command)
    print("")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # a diagnostic must never traceback
        print("watermark_doctor hit an unexpected error: %s: %s"
              % (exc.__class__.__name__, short(exc)))
