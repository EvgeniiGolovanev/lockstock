from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FRAME_DIR = ROOT / "design" / ".lockstock-demo-render-frames"
WIDTH = 1920
HEIGHT = 1080
FPS = 30
SECONDS_PER_SCENE = 6


SCENES_EN = [
    ("Inventory dashboard", "00-inventory.png"),
    ("Material catalog", "01-materials.png"),
    ("Create material", "08-material-form.png"),
    ("Location management", "02-locations.png"),
    ("Stock movement history", "03-stock-movements.png"),
    ("Move material", "09-stock-movement-form.png"),
    ("Vendor management", "04-vendors.png"),
    ("Purchase order tracking", "05-purchase-orders.png"),
    ("Create purchase order", "10-purchase-order-form.png"),
    ("Receive stock", "11-receive-stock-form.png"),
    ("Members, roles, invitations", "06-members.png"),
    ("Workflow guides", "07-workflows.png"),
]

SCENES_FR = [
    ("Tableau de bord inventaire", "00-inventory.png"),
    ("Catalogue des materiaux", "01-materials.png"),
    ("Creer un materiel", "08-material-form.png"),
    ("Gestion des emplacements", "02-locations.png"),
    ("Historique des mouvements", "03-stock-movements.png"),
    ("Deplacer du materiel", "09-stock-movement-form.png"),
    ("Gestion des fournisseurs", "04-vendors.png"),
    ("Suivi des commandes d'achat", "05-purchase-orders.png"),
    ("Creer une commande d'achat", "10-purchase-order-form.png"),
    ("Receptionner le stock", "11-receive-stock-form.png"),
    ("Membres, roles, invitations", "06-members.png"),
    ("Guides de flux de travail", "07-workflows.png"),
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = ["seguisb.ttf" if bold else "segoeui.ttf", "arialbd.ttf" if bold else "arial.ttf"]
    for name in candidates:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


TITLE_FONT = font(30, True)
SMALL_FONT = font(18)


def ease_in_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def load_capture(filename: str) -> Image.Image:
    path = capture_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Missing capture: {path}")
    image = Image.open(path).convert("RGB")
    if image.size != (WIDTH, HEIGHT):
        return image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    return image


def apply_camera(image: Image.Image, progress: float, scene_index: int) -> Image.Image:
    return image.copy()


def draw_label(image: Image.Image, title: str, scene_index: int, progress: float) -> Image.Image:
    scene_count = len(scenes())
    frame = image.convert("RGBA")
    overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    x0, y0, x1, y1 = 320, 948, 1600, 1020
    draw.rounded_rectangle((x0, y0, x1, y1), radius=8, fill=(255, 255, 255, 224), outline=(24, 24, 24, 200), width=2)
    draw.text((x0 + 28, y0 + 18), title, fill=(17, 24, 39, 255), font=TITLE_FONT)
    draw.text((x1 - 170, y0 + 25), f"{scene_index + 1:02d}/{scene_count:02d}", fill=(95, 109, 130, 255), font=SMALL_FONT)
    progress_x = x0 + 28
    progress_y = y1 - 13
    progress_w = int((x1 - x0 - 56) * ((scene_index + progress) / scene_count))
    draw.rounded_rectangle((progress_x, progress_y, x1 - 28, progress_y + 4), radius=2, fill=(225, 231, 240, 255))
    draw.rounded_rectangle((progress_x, progress_y, progress_x + progress_w, progress_y + 4), radius=2, fill=(37, 99, 235, 255))
    return Image.alpha_composite(frame, overlay).convert("RGB")


def selected_locale() -> str:
    if "--fr" in sys.argv or "--lang=fr" in sys.argv:
        return "fr"
    return "en"


def scenes() -> list[tuple[str, str]]:
    return SCENES_FR if selected_locale() == "fr" else SCENES_EN


def capture_dir() -> Path:
    suffix = "-fr" if selected_locale() == "fr" else ""
    return ROOT / "design" / f"demo-captures{suffix}"


def out_file() -> Path:
    suffix = "-fr" if selected_locale() == "fr" else ""
    return ROOT / "public" / f"lockstock-demo{suffix}.mp4"


def make_frames() -> None:
    if FRAME_DIR.exists():
        shutil.rmtree(FRAME_DIR)
    FRAME_DIR.mkdir(parents=True)

    frames_per_scene = FPS * SECONDS_PER_SCENE
    total = 0
    scene_list = scenes()
    captures = [load_capture(filename) for _, filename in scene_list]

    for scene_index, ((title, _filename), capture) in enumerate(zip(scene_list, captures)):
        for scene_frame in range(frames_per_scene):
            progress = scene_frame / max(1, frames_per_scene - 1)
            frame = apply_camera(capture, progress, scene_index)
            frame = draw_label(frame, title, scene_index, progress)

            if scene_frame < FPS // 2 and scene_index > 0:
                fade = scene_frame / (FPS // 2)
                previous = apply_camera(captures[scene_index - 1], 1.0, scene_index - 1)
                previous = draw_label(previous, scene_list[scene_index - 1][0], scene_index - 1, 1.0)
                frame = Image.blend(previous, frame, fade)

            frame.save(FRAME_DIR / f"frame_{total:05d}.jpg", quality=96, subsampling=0)
            total += 1


def render_video() -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        str(FPS),
        "-i",
        str(FRAME_DIR / "frame_%05d.jpg"),
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "10",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(out_file()),
    ]
    subprocess.run(cmd, check=True)



def main() -> None:
    make_frames()
    render_video()
    shutil.rmtree(FRAME_DIR)
    print(f"Wrote {out_file()}")


if __name__ == "__main__":
    main()
