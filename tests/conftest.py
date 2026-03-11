# Root conftest — adds python/ to sys.path so tests can import game modules.
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent / "python"))
