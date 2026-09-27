# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=10"]
# ///
"""PWA のアイコン（濃紺地に白の「講」、錆色の短い線）を docs/icons/ に作る。一度だけ実行すればよい。"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "docs" / "icons"
FONT = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"


def icon(size: int) -> Image.Image:
    im = Image.new("RGB", (size, size), "#101721")
    d = ImageDraw.Draw(im)
    font = ImageFont.truetype(FONT, int(size * 0.5), index=0)  # index 0 = JP
    box = d.textbbox((0, 0), "講", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], size * 0.43 - h / 2 - box[1]), "講", font=font, fill="#ffffff")
    y = int(size * 0.76)
    d.rectangle([int(size * 0.34), y, int(size * 0.66), y + max(2, size // 48)], fill="#bf420f")
    return im


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for s in (180, 192, 512):
        icon(s).save(OUT / f"icon-{s}.png")
    print("icons written to", OUT)
