"""Resize the supplied cat artwork for the two sites; preserve the original pixels and background."""
from pathlib import Path
from shutil import copyfile
import sys
from PIL import Image

source = Path(sys.argv[1])
convert = Path(__file__).resolve().parents[1]
image = Image.open(source).convert('RGB')
for public in (convert / 'public',):
    copyfile(source, public / 'brand-cat-original.png')
    for filename, size in [('favicon.png', 64), ('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512)]:
        image.resize((size, size), Image.Resampling.LANCZOS).save(public / filename, optimize=True)
    image.resize((256, 256), Image.Resampling.LANCZOS).save(public / 'brand-cat.webp', lossless=True)
image.resize((256, 256), Image.Resampling.LANCZOS).save(convert / 'public' / 'app-icon.webp', lossless=True)
main_apps = convert.parent / 'Main' / 'public' / 'apps'
copyfile(source, main_apps / 'convert-cat-original.png')
image.resize((512, 512), Image.Resampling.LANCZOS).save(main_apps / 'convert-cat.webp', lossless=True)
