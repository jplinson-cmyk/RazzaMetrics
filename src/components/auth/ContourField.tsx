import React, { useEffect, useRef } from "react";

/** Deterministic value noise: the same field on every load, so the page never shifts between visits. */
function noise2(seed: number) {
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = smooth(x - xi), v = smooth(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Height at a point: three octaves of noise, scaled to the panel so the hills keep their size. */
export function terrain(seed = 7) {
  const n = noise2(seed);
  return (x: number, y: number) =>
    n(x / 260, y / 260) * 0.62 + n(x / 120 + 11, y / 120 + 5) * 0.28 + n(x / 55 + 3, y / 55 + 17) * 0.1;
}

/**
 * Marching squares: line segments where the field crosses `level`, sampled on a `step` grid.
 * Returns flat [x1, y1, x2, y2, ...] so drawing is one loop.
 */
export function contourSegments(field: (x: number, y: number) => number, w: number, h: number, step: number, level: number) {
  const cols = Math.ceil(w / step) + 1, rows = Math.ceil(h / step) + 1;
  const v = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) v[j * cols + i] = field(i * step, j * step);
  const out: number[] = [];
  const lerp = (a: number, b: number) => (level - a) / (b - a || 1e-9);
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const tl = v[j * cols + i], tr = v[j * cols + i + 1], br = v[(j + 1) * cols + i + 1], bl = v[(j + 1) * cols + i];
      const c = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const x = i * step, y = j * step;
      const top = [x + lerp(tl, tr) * step, y], right = [x + step, y + lerp(tr, br) * step];
      const bottom = [x + lerp(bl, br) * step, y + step], left = [x, y + lerp(tl, bl) * step];
      const pairs: number[][][] = {
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]], 5: [[left, top], [bottom, right]],
        6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]], 9: [[top, bottom]], 10: [[left, bottom], [top, right]],
        11: [[top, right]], 12: [[left, right]], 13: [[bottom, right]], 14: [[left, bottom]],
      }[c]!;
      for (const [p, q] of pairs) out.push(p[0], p[1], q[0], q[1]);
    }
  }
  return out;
}

/** A survey-style contour field drawn behind the sign-in story. Decorative; the panel reads the same without it. */
/** `className` picks the variant: the dark sign-in panel, or the light dashboard backdrop. Colours come from its CSS tokens. */
export const ContourField: React.FC<{ className?: string }> = ({ className = "contour-field" }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const css = getComputedStyle(canvas);
      const minor = css.getPropertyValue("--contour-minor").trim();
      const major = css.getPropertyValue("--contour-major").trim();
      const field = terrain();
      for (let k = 1; k < 30; k++) {
        const isMajor = k % 5 === 0;
        const seg = contourSegments(field, width, height, 8, k / 30);
        if (!seg.length) continue;
        ctx.beginPath();
        for (let s = 0; s < seg.length; s += 4) {
          ctx.moveTo(seg[s], seg[s + 1]);
          ctx.lineTo(seg[s + 2], seg[s + 3]);
        }
        ctx.strokeStyle = isMajor ? major : minor;
        ctx.lineWidth = isMajor ? 1.25 : 0.75;
        ctx.stroke();
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
};
