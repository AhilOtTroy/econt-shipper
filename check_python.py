"""Exit 0 if this interpreter can install the watermark remover without compiling.

Used by start_watermark.bat to choose an interpreter. It lives in its own file
rather than as an inline `python -c` in the .bat because cmd's parser breaks on
the parentheses a version comparison needs inside a FOR block.

    python check_python.py          -> exit 0 if usable, 1 if not
    python check_python.py --why    -> also print the reason
"""

import struct
import sys

# torch and scipy publish prebuilt Windows wheels for a range of Python
# versions. Outside it, pip falls back to building from source, which fails on
# a normal Windows box with no compiler. 3.14 is excluded as the upper bound.
MIN = (3, 9)
MAX_EXCLUSIVE = (3, 14)

version = sys.version_info[:2]
bits = struct.calcsize("P") * 8

problems = []
if version < MIN:
    problems.append(
        f"Python {version[0]}.{version[1]} is too old (need {MIN[0]}.{MIN[1]} or newer)"
    )
if version >= MAX_EXCLUSIVE:
    problems.append(
        f"Python {version[0]}.{version[1]} is too new — PyTorch and SciPy have no "
        f"prebuilt Windows files for it, so pip would try to compile them"
    )
if bits != 64:
    problems.append(f"this Python is {bits}-bit — PyTorch is 64-bit only")

if "--why" in sys.argv:
    if problems:
        print("; ".join(problems))
    else:
        print(f"Python {version[0]}.{version[1]} {bits}-bit is fine")

sys.exit(1 if problems else 0)
