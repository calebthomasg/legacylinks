"""Build cropped RGB565 + alpha layers for the Petopia card folder."""
from pathlib import Path
import argparse
import struct

from PIL import Image

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("destination", type=Path, help="output folder for the card's trailhead/petopia directory")
out = parser.parse_args().destination
out.mkdir(parents=True, exist_ok=True)
for source in sorted((root / "artwork/layers").glob("*.png")):
    layer = Image.open(source).convert("RGBA")
    assert layer.size == (240, 240)
    bounds = layer.getchannel("A").getbbox()
    crop = layer.crop(bounds)
    data = bytearray(struct.pack("<4s4H", b"PET1", *bounds[:2], *crop.size))
    for red, green, blue, alpha in crop.getdata():
        color = ((red >> 3) << 11) | ((green >> 2) << 5) | (blue >> 3)
        data.extend(struct.pack("<HB", color, alpha))
    (out / (source.stem + ".pet")).write_bytes(data)
