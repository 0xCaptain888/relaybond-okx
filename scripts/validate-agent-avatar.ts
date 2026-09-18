import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

const svgPath = "web/relaybond-avatar.svg";
const pngPath = "web/relaybond-avatar-440.png";
const svg = await readFile(svgPath, "utf8");
const png = await readFile(pngPath);

assert(/<svg[^>]*\bwidth="440"[^>]*\bheight="440"/.test(svg), "avatar_svg_must_be_440_by_440");
assert(/<rect[^>]*\bwidth="1024"[^>]*\bheight="1024"[^>]*\bfill="#080a09"/.test(svg), "avatar_svg_full_bleed_background_missing");
assert(!/\brx=|\bry=/.test(svg), "avatar_svg_must_not_have_rounded_corners");

assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "avatar_png_signature_invalid");
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
const bitDepth = png[24];
const colorType = png[25];
const interlace = png[28];
assert(width === 440 && height === 440, "avatar_png_must_be_440_by_440");
assert(bitDepth === 8 && colorType === 2, "avatar_png_must_be_8_bit_rgb_without_alpha");
assert(interlace === 0, "avatar_png_must_be_non_interlaced");

const idat: Buffer[] = [];
let offset = 8;
while (offset < png.length) {
  const length = png.readUInt32BE(offset);
  const type = png.toString("ascii", offset + 4, offset + 8);
  if (type === "IDAT") idat.push(png.subarray(offset + 8, offset + 8 + length));
  offset += 12 + length;
  if (type === "IEND") break;
}
assert(idat.length > 0, "avatar_png_idat_missing");

const bytesPerPixel = 3;
const rowBytes = width * bytesPerPixel;
const raw = inflateSync(Buffer.concat(idat));
assert(raw.length === height * (rowBytes + 1), "avatar_png_scanline_length_invalid");
const pixels = Buffer.alloc(width * height * bytesPerPixel);

for (let y = 0; y < height; y += 1) {
  const filter = raw[y * (rowBytes + 1)];
  const sourceOffset = y * (rowBytes + 1) + 1;
  const targetOffset = y * rowBytes;
  for (let x = 0; x < rowBytes; x += 1) {
    const encoded = raw[sourceOffset + x];
    const left = x >= bytesPerPixel ? pixels[targetOffset + x - bytesPerPixel] : 0;
    const up = y > 0 ? pixels[targetOffset - rowBytes + x] : 0;
    const upLeft = y > 0 && x >= bytesPerPixel ? pixels[targetOffset - rowBytes + x - bytesPerPixel] : 0;
    const predictor = filter === 0 ? 0
      : filter === 1 ? left
        : filter === 2 ? up
          : filter === 3 ? Math.floor((left + up) / 2)
            : filter === 4 ? paeth(left, up, upLeft)
              : -1;
    assert(predictor >= 0, `avatar_png_filter_unsupported:${filter}`);
    pixels[targetOffset + x] = (encoded + predictor) & 0xff;
  }
}

const expectedCorner = [8, 10, 9];
for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
  const index = (y * width + x) * bytesPerPixel;
  const pixel = [...pixels.subarray(index, index + bytesPerPixel)];
  assert(pixel.every((value, channel) => value === expectedCorner[channel]), `avatar_corner_not_square:${x},${y}:${pixel.join(",")}`);
}

console.log(JSON.stringify({
  status: "AGENT_AVATAR_COMPLIANT",
  file: pngPath,
  width,
  height,
  format: "PNG",
  color: "8-bit RGB",
  alpha: false,
  roundedCorners: false,
  cornerColor: "#080a09",
  sha256: createHash("sha256").update(png).digest("hex")
}, null, 2));
