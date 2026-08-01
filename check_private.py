"""Confirm the running interpreter is the app's private one, not the PC's.

The launcher calls this before installing anything:

    python.exe check_private.py <expected_python_dir>

Exit 0 means private and usable, 1 means refuse. Getting this wrong is what
every earlier failure came down to: pip ran against a system Python that had
no prebuilt packages for its version, and tried to compile them.

A plain "is python.exe under our folder" test is not enough. A virtualenv
created over a system Python lives inside the folder but still *is* the system
interpreter, and that is precisely the setup that produced the original
"failed to build scipy". sys.base_prefix is what gives it away.
"""

import os
import struct
import sys

EXPECTED_VERSION = (3, 12)


def resolved(path):
    return os.path.normcase(os.path.realpath(path))


def main():
    if len(sys.argv) < 2:
        print("[WM] check_private.py needs the expected python folder")
        return 1

    expected = resolved(sys.argv[1])
    exe = resolved(sys.executable)
    prefix = resolved(sys.prefix)
    base = resolved(sys.base_prefix)
    bits = struct.calcsize("P") * 8
    version = sys.version_info[:2]

    print(f"[WM] python {sys.executable}")
    print(f"[WM] {sys.version.split()[0]} {bits}-bit", end="")

    problems = []
    if os.path.dirname(exe) != expected:
        problems.append(f"it lives in {os.path.dirname(exe)}, not {expected}")
    if base != expected:
        # A venv over a system Python: prefix is local, base_prefix is not.
        problems.append(f"its base install is {base}, outside the app folder")
    if prefix != base:
        problems.append("it is a virtual environment, not the private Python")
    if version != EXPECTED_VERSION:
        problems.append(
            f"it is Python {version[0]}.{version[1]}, expected "
            f"{EXPECTED_VERSION[0]}.{EXPECTED_VERSION[1]}"
        )
    if bits != 64:
        problems.append(f"it is {bits}-bit, and PyTorch is 64-bit only")

    if problems:
        print("  SYSTEM - REFUSING")
        print()
        for problem in problems:
            print(f"       {problem}")
        return 1

    print("  PRIVATE OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
