"""
Process the supplied LUCIAN WORKSPACE logo into the assets the app needs.

Inputs
  /home/z/my-project/upload/pasted_image_1787343311132.png  (1254 x 1254, full wordmark on dark bg)

Outputs (all under /home/z/my-project/public/branding/):
  lucian-workspace-logo.png     — full wordmark, transparent bg, sensible aspect
  lucian-workspace-icon.png     — square cropped EMBLEM only (rising-column + arc, no wordmark)
  lucian-workspace-favicon.png  — 256×256 favicon-grade emblem
  apple-touch-icon.png          — 180×180 app icon (emblem on dark tile for iOS)
  icon-32.png                  — 32×32 browser tab icon
  lucian-workspace-logo-sm.png — small compact wordmark for inline use

Background handling:
  The original is on near-black (~RGB 10-15) but the gold text is bright (gold RGB ~150-220).
  We treat anything with max(R,G,B) <= 30 as background and convert it to alpha=0.
"""
from pathlib import Path
from PIL import Image

SRC = Path("/home/z/my-project/upload/pasted_image_1787343311132.png")
OUT_DIR = Path("/home/z/my-project/public/branding")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Threshold: any pixel whose max channel value > THIS is content.
# Original dark bg peaks at ~15; gold text peaks at ~220. Safe split at 30.
CONTENT_THRESHOLD = 30


def trim_to_content(im: Image.Image, threshold: int = CONTENT_THRESHOLD) -> Image.Image:
    """Convert near-black pixels to transparent, then auto-crop to content bbox."""
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    mask_px = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if max(r, g, b) > threshold:
                mask_px[x, y] = 255
    out = im.copy()
    out.putalpha(mask)
    bbox = mask.getbbox()
    if bbox:
        # Add a small breathing margin
        margin = 4
        x0 = max(0, bbox[0] - margin)
        y0 = max(0, bbox[1] - margin)
        x1 = min(w, bbox[2] + margin)
        y1 = min(h, bbox[3] + margin)
        out = out.crop((x0, y0, x1, y1))
    return out


def pad_to_square(im: Image.Image, target_size: int, padding_ratio: float = 0.86) -> Image.Image:
    """Center im (preserving aspect) on a transparent square of target_size."""
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    w, h = im.size
    fit = int(target_size * padding_ratio)
    if w >= h:
        new_w = fit
        new_h = max(1, int(round(h * (fit / w))))
    else:
        new_h = fit
        new_w = max(1, int(round(w * (fit / h))))
    im = im.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    off_x = (target_size - new_w) // 2
    off_y = (target_size - new_h) // 2
    canvas.alpha_composite(im, (off_x, off_y))
    return canvas


def pad_to_canvas(im: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Center an image on a transparent canvas of target_w × target_h."""
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    off_x = (target_w - im.width) // 2
    off_y = (target_h - im.height) // 2
    canvas.alpha_composite(im, (off_x, off_y))
    return canvas


def main() -> None:
    print(f"Opening {SRC}")
    full = Image.open(SRC).convert("RGBA")
    W, H = full.size
    print(f"  source size: {W}x{H}")

    # --- 1. EMBLEM ONLY (left portion of original) -------------------------
    # From the content scan we know:
    #   - vertical content spans roughly y=350..820 (i.e. middle of the 1254-tall image)
    #   - the emblem (left) ends around x=470
    # Crop a generous left rectangle then trim.
    emblem_crop_box = (0, 0, int(W * 0.40), H)  # left 40% = 0..501
    emblem_raw = full.crop(emblem_crop_box)
    emblem = trim_to_content(emblem_raw, threshold=CONTENT_THRESHOLD)
    print(f"  emblem trimmed size: {emblem.size}")

    # Save emblem as a square padded to 512 (master icon)
    emblem_square_512 = pad_to_square(emblem, 512, padding_ratio=0.84)
    emblem_square_512.save(OUT_DIR / "lucian-workspace-icon.png", "PNG")
    print("  wrote lucian-workspace-icon.png (512x512)")

    # Favicon (256)
    favicon_256 = emblem_square_512.resize((256, 256), Image.LANCZOS)
    favicon_256.save(OUT_DIR / "lucian-workspace-favicon.png", "PNG")
    print("  wrote lucian-workspace-favicon.png (256x256)")

    # 32px browser tab icon
    icon_32 = emblem_square_512.resize((32, 32), Image.LANCZOS)
    icon_32.save(OUT_DIR / "icon-32.png", "PNG")
    print("  wrote icon-32.png (32x32)")

    # Apple touch icon (180) — emblem on dark tile
    apple_tile = Image.new("RGBA", (180, 180), (15, 17, 22, 255))
    emblem_180 = emblem_square_512.resize((140, 140), Image.LANCZOS)
    apple_tile.alpha_composite(emblem_180, ((180 - 140) // 2, (180 - 140) // 2))
    apple_tile.convert("RGB").save(OUT_DIR / "apple-touch-icon.png", "PNG")
    print("  wrote apple-touch-icon.png (180x180)")

    # --- 2. FULL WORDMARK --------------------------------------------------
    wordmark = trim_to_content(full, threshold=CONTENT_THRESHOLD)
    print(f"  wordmark trimmed size: {wordmark.size}")

    # Cap longest side at 1000px to keep file size reasonable
    longest = max(wordmark.size)
    if longest > 1000:
        scale = 1000 / longest
        wordmark = wordmark.resize(
            (int(wordmark.width * scale), int(wordmark.height * scale)),
            Image.LANCZOS,
        )
    # Pad to a clean 3:1 horizontal canvas (matches typical wordmark aspect)
    target_w = max(wordmark.width, 900)
    target_h = max(wordmark.height, int(target_w / 3))
    # If wordmark aspect is wider than 3:1, grow height to keep it centered
    if wordmark.width / wordmark.height > 3:
        target_h = wordmark.height + 40
        target_w = max(wordmark.width, target_h * 3)
    wordmark_padded = pad_to_canvas(wordmark, target_w, target_h)
    wordmark_padded.save(OUT_DIR / "lucian-workspace-logo.png", "PNG")
    print(f"  wrote lucian-workspace-logo.png ({target_w}x{target_h})")

    # Compact small wordmark for inline use (breadcrumb etc.)
    sm_w = max(int(target_w * 0.30), 280)
    sm_h = max(int(target_h * 0.30), int(sm_w / 3))
    compact = wordmark_padded.resize((sm_w, sm_h), Image.LANCZOS)
    compact.save(OUT_DIR / "lucian-workspace-logo-sm.png", "PNG")
    print(f"  wrote lucian-workspace-logo-sm.png ({sm_w}x{sm_h})")

    print()
    print("All brand assets written to /home/z/my-project/public/branding/:")
    for f in sorted(OUT_DIR.glob("*.png")):
        st = f.stat()
        print(f"  {f.name}  ({st.st_size:,} bytes)")


if __name__ == "__main__":
    main()
