// Icon pixel math ported from tools/make-icons.js, parameterized by color.
// drawIconRGBA is pure (Node + browser). iconImageData is browser-only.

export function hexToRgb(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex).trim());
  const n = m ? parseInt(m[1], 16) : 0x16a34a;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function drawIconRGBA(size, color) {
  const { r, g, b } = hexToRgb(color);
  const rgba = new Uint8ClampedArray(size * size * 4); // transparent
  const c = (size - 1) / 2;
  const R = size * 0.46;
  const ringOuter = size * 0.42;
  const ringInner = size * 0.30;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const i = (y * size + x) * 4;
      if (d <= R) {
        rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
      }
      if (d >= ringInner && d <= ringOuter) {
        rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255; rgba[i + 3] = 255;
      }
    }
  }
  return rgba;
}

export function iconImageData(size, color) {
  return new ImageData(drawIconRGBA(size, color), size, size);
}
