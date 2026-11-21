"""Build a streamable Petopia asset pack and its hosted test catalog."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile

FORMAT = 1
SCENE_SIZE = 480 * 480 * 2
TOOLS = Path(__file__).resolve().parent


def build(archive: Path, output: Path, revision: int, minimum_firmware: str):
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        subprocess.run([sys.executable, str(TOOLS / "pack_petopia.py"), str(root)], check=True)
        subprocess.run([sys.executable, str(TOOLS / "pack_petopia_scenes.py"), str(archive), str(root)], check=True)
        files = sorted(path for path in root.iterdir() if path.suffix in {".pet", ".rgb565"})
        assert len(files) == 45
        offset = 12 + 48 * len(files)
        index = bytearray(struct.pack("<4sII", b"PTPK", FORMAT, len(files)))
        payload = bytearray()
        for file in files:
            name = file.name.encode("ascii")
            data = file.read_bytes()
            assert len(name) < 40 and data
            if file.suffix == ".rgb565":
                assert len(data) == SCENE_SIZE
            else:
                magic, x, y, w, h = struct.unpack_from("<4s4H", data)
                assert magic == b"PET1" and x + w <= 240 and y + h <= 240
                assert len(data) == 12 + w * h * 3
            index.extend(struct.pack("<40sII", name, offset, len(data)))
            payload.extend(data)
            offset += len(data)
    pack = index + payload
    assert len(pack) <= 8 * 1024 * 1024
    release_name = f"petopia-{revision}.pack"
    release = {
        "schema": FORMAT,
        "revision": revision,
        "minimum_firmware": minimum_firmware,
        "size": len(pack),
        "sha256": hashlib.sha256(pack).hexdigest(),
    }
    releases = output / "releases"
    releases.mkdir(parents=True, exist_ok=True)
    target = releases / release_name
    if target.exists() and target.read_bytes() != pack:
        raise ValueError("Artwork revision already exists with different bytes")
    target.write_bytes(pack)
    (output / "test.json").write_text(json.dumps(release, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(release))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--revision", type=int, default=1)
    parser.add_argument("--minimum-firmware", default="0.1.22")
    args = parser.parse_args()
    if not 1 <= args.revision <= 2147483647:
        parser.error("invalid artwork revision")
    build(args.archive, args.output, args.revision, args.minimum_firmware)
