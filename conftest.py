# Root conftest.py — adds python/ to sys.path for all test modules.
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent / "python"))
