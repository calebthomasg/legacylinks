"""Pack the supplied Petopia ZIP's first-visit artwork for the 480 px display."""
import argparse
from io import BytesIO
from pathlib import Path
import struct
from zipfile import ZipFile

from PIL import Image

ROUND = "Petopia/Pet Shop/Round Display/"
SCENES = {
    "title": ROUND + "petopia_open_screen.png",
    "shop": ROUND + "Pet-Shop-Circle.png",
    "overview": ROUND + "Pet-Pick copy.png",
    "carousel": ROUND + "Singled-Out-Pet copy.png",
    "home": "Petopia/Petopia Home/Petopia-Home copy.png",
}
SIZE = (480, 480)


def pack(archive, destination):
    with ZipFile(archive) as assets:
        images = {}
        for name, source in SCENES.items():
            png = Image.open(BytesIO(assets.read(source))).convert("RGBA")
            frame = Image.new("RGBA", SIZE, "#0f1d3a")
            frame.alpha_composite(png.resize(SIZE, Image.Resampling.LANCZOS))
            pixels = [((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
                      for r, g, b in frame.convert("RGB").getdata()]
            images[name] = struct.pack(f"<{len(pixels)}H", *pixels)
    destination.mkdir(parents=True, exist_ok=True)
    for name, data in images.items():
        (destination / f"{name}.rgb565").write_bytes(data)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="supplied Petopia artwork ZIP")
    parser.add_argument("destination", type=Path, help="card's trailhead/petopia/scenes folder")
    args = parser.parse_args()
    pack(args.archive, args.destination)
