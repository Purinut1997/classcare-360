import jsQR from 'jsqr';
import type { UnifiedOmrGeometry, OmrPoint } from './omrGeometry';
import type { ScannedAnswerDetail } from '../types/omr';

export interface QuadDetectionResult {
  detected: boolean;
  corners: [OmrPoint, OmrPoint, OmrPoint, OmrPoint] | null; // ordered CW around centroid
  concentricCount: number;
  areaRatio: number;
  qualityScore: number; // 0..1
}

export interface DecodedQrResult {
  raw: string;
  parsed: Record<string, unknown> | null;
}

export interface PerspectiveWarpOutput {
  warpedCanvas: HTMLCanvasElement;
  perspectiveCorrected: boolean;
  detectedOrientation: 0 | 90 | 180 | 270;
  quadDetection: QuadDetectionResult;
}

/**
 * 8-DOF Planar Homography Matrix mapping destination (u, v) -> source (x, y).
 * Computed by solving A * h = b via Gaussian elimination with partial pivoting.
 */
export function computeHomography(
  dstPts: [OmrPoint, OmrPoint, OmrPoint, OmrPoint],
  srcPts: [OmrPoint, OmrPoint, OmrPoint, OmrPoint]
): number[] | null {
  // We solve 8 unknowns [h0, h1, h2, h3, h4, h5, h6, h7] with h8 = 1
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const u = dstPts[i].x;
    const v = dstPts[i].y;
    const x = srcPts[i].x;
    const y = srcPts[i].y;

    a.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);

    a.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(a[col][col]);
    for (let r = col + 1; r < n; r++) {
      const val = Math.abs(a[r][col]);
      if (val > maxVal) {
        maxVal = val;
        pivotRow = r;
      }
    }

    if (maxVal < 1e-9) return null;

    if (pivotRow !== col) {
      [a[col], a[pivotRow]] = [a[pivotRow], a[col]];
      [b[col], b[pivotRow]] = [b[pivotRow], b[col]];
    }

    const pivot = a[col][col];
    for (let j = col; j < n; j++) a[col][j] /= pivot;
    b[col] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j < n; j++) a[r][j] -= factor * a[col][j];
      b[r] -= factor * b[col];
    }
  }

  return [...b, 1];
}

export function applyHomography(h: number[], u: number, v: number): OmrPoint {
  const denom = h[6] * u + h[7] * v + h[8];
  if (Math.abs(denom) < 1e-8) return { x: 0, y: 0 };
  return {
    x: (h[0] * u + h[1] * v + h[2]) / denom,
    y: (h[3] * u + h[4] * v + h[5]) / denom,
  };
}

interface DarkComponent {
  id: number;
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
  isConcentric: boolean;
  score: number;
}

function buildGrayscaleBuffer(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
  }
  return gray;
}

function buildIntegralImage(gray: Uint8Array, width: number, height: number): Int32Array {
  const w1 = width + 1;
  const integral = new Int32Array(w1 * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const grayOffset = y * width;
    const prevOffset = y * w1;
    const curOffset = (y + 1) * w1;
    for (let x = 0; x < width; x++) {
      rowSum += gray[grayOffset + x];
      integral[curOffset + x + 1] = integral[prevOffset + x + 1] + rowSum;
    }
  }
  return integral;
}

function adaptiveBinarize(
  gray: Uint8Array,
  integral: Int32Array,
  width: number,
  height: number
): Uint8Array {
  const binary = new Uint8Array(width * height);
  const w1 = width + 1;
  const halfWin = Math.max(10, Math.round(Math.min(width, height) * 0.04));

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - halfWin);
    const y1 = Math.min(height - 1, y + halfWin);
    const r0 = y0 * w1;
    const r1 = (y1 + 1) * w1;
    const yOff = y * width;

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - halfWin);
      const x1 = Math.min(width - 1, x + halfWin);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[r1 + x1 + 1] - integral[r0 + x1 + 1] - integral[r1 + x0] + integral[r0 + x0];
      const localMean = sum / count;
      const lum = gray[yOff + x];
      if (lum < localMean * 0.86 && lum < 210) {
        binary[yOff + x] = 1;
      }
    }
  }
  return binary;
}

function cross(o: OmrPoint, a: OmrPoint, b: OmrPoint): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function isConvexQuad(pts: [OmrPoint, OmrPoint, OmrPoint, OmrPoint]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const c = cross(pts[i], pts[(i + 1) % 4], pts[(i + 2) % 4]);
    if (Math.abs(c) < 1e-4) return false;
    const s = c > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function quadArea(pts: [OmrPoint, OmrPoint, OmrPoint, OmrPoint]): number {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    s += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(s) * 0.5;
}

function orderClockwise(pts: [OmrPoint, OmrPoint, OmrPoint, OmrPoint]): [OmrPoint, OmrPoint, OmrPoint, OmrPoint] {
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
  const sorted = [...pts].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
  );
  return [sorted[0], sorted[1], sorted[2], sorted[3]];
}

function dist(a: OmrPoint, b: OmrPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Detects the 4 concentric fiducial corner targets of an OMR sheet even when tilted,
 * skewed in 3D perspective, rotated 0..360 deg, or unevenly illuminated.
 */
export function detectFiducialCorners(
  sourceCanvas: HTMLCanvasElement
): QuadDetectionResult {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  if (srcW < 40 || srcH < 40) {
    return { detected: false, corners: null, concentricCount: 0, areaRatio: 0, qualityScore: 0 };
  }

  // Downsample to max ~680px for fast <12ms adaptive thresholding & CCL
  const maxDim = 680;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(40, Math.round(srcW * scale));
  const h = Math.max(40, Math.round(srcH * scale));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = w;
  workCanvas.height = h;
  const wCtx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!wCtx) {
    return { detected: false, corners: null, concentricCount: 0, areaRatio: 0, qualityScore: 0 };
  }
  wCtx.drawImage(sourceCanvas, 0, 0, w, h);

  const imgData = wCtx.getImageData(0, 0, w, h);
  const gray = buildGrayscaleBuffer(imgData);
  const integral = buildIntegralImage(gray, w, h);
  const binary = adaptiveBinarize(gray, integral, w, h);

  // Iterative 4-connected CCL
  const labels = new Int32Array(w * h);
  const queue = new Int32Array(w * h);
  const components: DarkComponent[] = [];
  let nextLabel = 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const startIdx = y * w + x;
      if (binary[startIdx] !== 1 || labels[startIdx] !== 0) continue;

      const label = nextLabel++;
      labels[startIdx] = label;
      let qHead = 0;
      let qTail = 0;
      queue[qTail++] = startIdx;

      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let sumX = 0;
      let sumY = 0;

      while (qHead < qTail) {
        const idx = queue[qHead++];
        const py = (idx / w) | 0;
        const px = idx - py * w;
        area++;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        sumX += px;
        sumY += py;

        if (px > 0 && binary[idx - 1] === 1 && labels[idx - 1] === 0) {
          labels[idx - 1] = label;
          queue[qTail++] = idx - 1;
        }
        if (px + 1 < w && binary[idx + 1] === 1 && labels[idx + 1] === 0) {
          labels[idx + 1] = label;
          queue[qTail++] = idx + 1;
        }
        if (py > 0 && binary[idx - w] === 1 && labels[idx - w] === 0) {
          labels[idx - w] = label;
          queue[qTail++] = idx - w;
        }
        if (py + 1 < h && binary[idx + w] === 1 && labels[idx + w] === 0) {
          labels[idx + w] = label;
          queue[qTail++] = idx + w;
        }
      }

      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const minSide = Math.min(w, h);
      if (area >= 4 && bw <= w * 0.14 && bh <= h * 0.14 && bw >= 3 && bh >= 3) {
        components.push({
          id: label,
          area,
          minX,
          maxX,
          minY,
          maxY,
          cx: sumX / area,
          cy: sumY / area,
          width: bw,
          height: bh,
          isConcentric: false,
          score: 0,
        });
      }
    }
  }

  // Filter potential outer fiducial targets & check concentric inner-dot matches
  const minTargetSize = Math.max(6, Math.min(w, h) * 0.014);
  const maxTargetSize = Math.min(w, h) * 0.10;
  const candidates: DarkComponent[] = [];

  for (const outer of components) {
    if (outer.width < minTargetSize || outer.height < minTargetSize) continue;
    if (outer.width > maxTargetSize || outer.height > maxTargetSize) continue;
    const aspect = outer.width / outer.height;
    if (aspect < 0.55 || aspect > 1.85) continue;

    // Look for an inner dark dot nested strictly inside outer's bounding box around same centroid
    let hasInnerDot = false;
    const tol = Math.max(2.5, outer.width * 0.22);
    for (const inner of components) {
      if (inner.id === outer.id) continue;
      if (
        inner.minX > outer.minX &&
        inner.maxX < outer.maxX &&
        inner.minY > outer.minY &&
        inner.maxY < outer.maxY &&
        inner.area < outer.area * 0.65
      ) {
        const dCenter = Math.hypot(inner.cx - outer.cx, inner.cy - outer.cy);
        if (dCenter <= tol) {
          hasInnerDot = true;
          break;
        }
      }
    }

    // Ring check also verifies centroid dark pixel & brighter annulus around r ~ 0.6*halfW
    const cxInt = Math.min(w - 1, Math.max(0, Math.round(outer.cx)));
    const cyInt = Math.min(h - 1, Math.max(0, Math.round(outer.cy)));
    const cLum = gray[cyInt * w + cxInt];
    const rMid = Math.max(2, Math.round(outer.width * 0.30));
    const rx0 = Math.max(0, cxInt - rMid);
    const rx1 = Math.min(w - 1, cxInt + rMid);
    const ry0 = Math.max(0, cyInt - rMid);
    const ry1 = Math.min(h - 1, cyInt + rMid);
    const ringAvg =
      (gray[cyInt * w + rx0] +
        gray[cyInt * w + rx1] +
        gray[ry0 * w + cxInt] +
        gray[ry1 * w + cxInt]) /
      4;

    const ringContrast = ringAvg - cLum;
    const isConcentric = hasInnerDot || (ringContrast > 28 && outer.area < outer.width * outer.height * 0.72);

    // Compute compactness for solid-square fallback compatibility
    const fillRatio = outer.area / (outer.width * outer.height);
    const isSolidCornerFallback = !isConcentric && fillRatio > 0.52 && outer.width >= minTargetSize * 1.1;

    if (isConcentric || isSolidCornerFallback) {
      outer.isConcentric = isConcentric;
      outer.score = (isConcentric ? 3.5 : 1.0) * (1 - Math.abs(1 - aspect) * 0.4);
      candidates.push(outer);
    }
  }

  // Deduplicate concentric pairs whose centroids coincide (keep the outer ring)
  const deduped: DarkComponent[] = [];
  candidates
    .sort((a, b) => b.area - a.area)
    .forEach((cand) => {
      const duplicate = deduped.find((d) => Math.hypot(d.cx - cand.cx, d.cy - cand.cy) < Math.max(d.width, cand.width) * 0.65);
      if (!duplicate) {
        deduped.push(cand);
      } else if (cand.isConcentric && !duplicate.isConcentric) {
        duplicate.isConcentric = true;
        duplicate.score = Math.max(duplicate.score, cand.score);
      }
    });

  // Collect extreme-corner pool of up to 14 best candidates across diagonal & cardinal directions
  const poolSet = new Map<number, DarkComponent>();
  const concentricList = deduped.filter((c) => c.isConcentric);

  concentricList.slice(0, 12).forEach((c) => poolSet.set(c.id, c));

  // If fewer than 4 concentric marks detected (e.g. slight motion blur on 1 corner), add directional extremes
  if (poolSet.size < 8) {
    const dirs: Array<(c: DarkComponent) => number> = [
      (c) => -c.cx - c.cy, // Top-Left extreme
      (c) => c.cx - c.cy,  // Top-Right extreme
      (c) => c.cx + c.cy,  // Bottom-Right extreme
      (c) => -c.cx + c.cy, // Bottom-Left extreme
      (c) => -c.cx,
      (c) => c.cx,
      (c) => -c.cy,
      (c) => c.cy,
    ];
    for (const proj of dirs) {
      let bestC: DarkComponent | null = null;
      let bestMetric = -Infinity;
      for (const c of deduped) {
        const metric = proj(c) + (c.isConcentric ? Math.min(w, h) * 0.25 : 0);
        if (metric > bestMetric) {
          bestMetric = metric;
          bestC = c;
        }
      }
      if (bestC) poolSet.set(bestC.id, bestC);
    }
  }

  const pool = Array.from(poolSet.values()).slice(0, 14);
  if (pool.length < 4) {
    return { detected: false, corners: null, concentricCount: concentricList.length, areaRatio: 0, qualityScore: 0 };
  }

  // Evaluate 4-tuples to select the largest valid convex sheet quad favoring concentric targets
  const frameArea = w * h;
  let bestQuad: [OmrPoint, OmrPoint, OmrPoint, OmrPoint] | null = null;
  let bestObjective = -Infinity;
  let bestAreaRatio = 0;
  let bestConcentricCount = 0;

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        for (let m = k + 1; m < pool.length; m++) {
          const pts: [OmrPoint, OmrPoint, OmrPoint, OmrPoint] = orderClockwise([
            { x: pool[i].cx, y: pool[i].cy },
            { x: pool[j].cx, y: pool[j].cy },
            { x: pool[k].cx, y: pool[k].cy },
            { x: pool[m].cx, y: pool[m].cy },
          ]);

          if (!isConvexQuad(pts)) continue;

          const area = quadArea(pts);
          const ratio = area / frameArea;
          if (ratio < 0.14) continue; // Ignore small QR boxes or noisy clusters

          const e0 = dist(pts[0], pts[1]);
          const e1 = dist(pts[1], pts[2]);
          const e2 = dist(pts[2], pts[3]);
          const e3 = dist(pts[3], pts[0]);
          const minE = Math.min(e0, e1, e2, e3);
          const maxE = Math.max(e0, e1, e2, e3);
          if (minE < Math.min(w, h) * 0.18 || maxE / minE > 3.2) continue;

          // Opposite edges should be reasonably matched even under 35deg perspective tilt
          const oppRatio1 = Math.max(e0, e2) / Math.max(1, Math.min(e0, e2));
          const oppRatio2 = Math.max(e1, e3) / Math.max(1, Math.min(e1, e3));
          if (oppRatio1 > 1.85 || oppRatio2 > 1.85) continue;

          const concCount =
            (pool[i].isConcentric ? 1 : 0) +
            (pool[j].isConcentric ? 1 : 0) +
            (pool[k].isConcentric ? 1 : 0) +
            (pool[m].isConcentric ? 1 : 0);

          // Must have at least 2 true concentric fiducials (or all 4 solid marks if synthetic legacy)
          if (concentricList.length >= 2 && concCount < 2) continue;

          const concBonus = 0.35 + (concCount / 4) * 1.65;
          const oppPenalty = 1 / (1 + Math.abs(oppRatio1 - 1) * 0.5 + Math.abs(oppRatio2 - 1) * 0.5);
          const objective = ratio * concBonus * oppPenalty;

          if (objective > bestObjective) {
            bestObjective = objective;
            bestAreaRatio = ratio;
            bestConcentricCount = concCount;
            // Scale coordinates back up to original sourceCanvas resolution
            bestQuad = [
              { x: pts[0].x / scale, y: pts[0].y / scale },
              { x: pts[1].x / scale, y: pts[1].y / scale },
              { x: pts[2].x / scale, y: pts[2].y / scale },
              { x: pts[3].x / scale, y: pts[3].y / scale },
            ];
          }
        }
      }
    }
  }

  if (!bestQuad) {
    return {
      detected: false,
      corners: null,
      concentricCount: concentricList.length,
      areaRatio: 0,
      qualityScore: 0,
    };
  }

  const qualityScore = Math.min(1, bestConcentricCount * 0.2 + Math.min(1, bestAreaRatio / 0.55) * 0.2);

  return {
    detected: true,
    corners: bestQuad,
    concentricCount: bestConcentricCount,
    areaRatio: Math.round(bestAreaRatio * 1000) / 1000,
    qualityScore,
  };
}

function sampleSrcMeanLuminance(
  srcData: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  hMat: number[],
  uCenter: number,
  vCenter: number,
  radius: number
): number {
  let sum = 0;
  let count = 0;
  const r2 = radius * radius;
  const rCeil = Math.ceil(radius);

  for (let dv = -rCeil; dv <= rCeil; dv += 1) {
    for (let du = -rCeil; du <= rCeil; du += 1) {
      if (du * du + dv * dv > r2) continue;
      const srcPt = applyHomography(hMat, uCenter + du, vCenter + dv);
      const sx = Math.round(srcPt.x);
      const sy = Math.round(srcPt.y);
      if (sx < 0 || sx >= srcW || sy < 0 || sy >= srcH) continue;
      const idx = (sy * srcW + sx) * 4;
      sum += 0.299 * srcData[idx] + 0.587 * srcData[idx + 1] + 0.114 * srcData[idx + 2];
      count++;
    }
  }

  return count > 0 ? sum / count : 255;
}

/**
 * Given detected CW quad corners and canonical OMR geometry, resolves the exact
 * 0/90/180/270 orientation deterministically using the asymmetric Top-Left anchor
 * and warps the sheet onto a crisp canonical canvas using bilinear resampling.
 */
export function warpPerspectiveToCanvas(
  sourceCanvas: HTMLCanvasElement,
  geometry: UnifiedOmrGeometry
): PerspectiveWarpOutput {
  const quad = detectFiducialCorners(sourceCanvas);
  const { width: dstW, height: dstH, fiducials, anchorProbes, orientationAnchor } = geometry;

  if (!quad.detected || !quad.corners) {
    // Fallback canvas without perspective quad (exact proportional aspect crop/fit)
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = dstW;
    fallbackCanvas.height = dstH;
    const fCtx = fallbackCanvas.getContext('2d', { willReadFrequently: true });
    if (fCtx) {
      fCtx.fillStyle = '#ffffff';
      fCtx.fillRect(0, 0, dstW, dstH);
      fCtx.drawImage(sourceCanvas, 0, 0, dstW, dstH);
    }
    return {
      warpedCanvas: fallbackCanvas,
      perspectiveCorrected: false,
      detectedOrientation: 0,
      quadDetection: quad,
    };
  }

  const sCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sCtx) {
    const empty = document.createElement('canvas');
    empty.width = dstW;
    empty.height = dstH;
    return {
      warpedCanvas: empty,
      perspectiveCorrected: false,
      detectedOrientation: 0,
      quadDetection: quad,
    };
  }

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const srcImg = sCtx.getImageData(0, 0, srcW, srcH).data;
  const canonicalCorners: [OmrPoint, OmrPoint, OmrPoint, OmrPoint] = [
    { x: fiducials.tl.cx, y: fiducials.tl.cy },
    { x: fiducials.tr.cx, y: fiducials.tr.cy },
    { x: fiducials.br.cx, y: fiducials.br.cy },
    { x: fiducials.bl.cx, y: fiducials.bl.cy },
  ];
  const canonAspect = (fiducials.tr.cx - fiducials.tl.cx) / (fiducials.bl.cy - fiducials.tl.cy);
  const cwCorners = quad.corners;

  // Test all 4 cyclic corner mappings: pick the one aligning physical TL anchor to anchorProbes.tl
  let bestShift = 0;
  let bestH: number[] | null = null;
  let bestScore = -Infinity;

  for (let shift = 0; shift < 4; shift++) {
    const mappedSrc: [OmrPoint, OmrPoint, OmrPoint, OmrPoint] = [
      cwCorners[shift % 4],
      cwCorners[(shift + 1) % 4],
      cwCorners[(shift + 2) % 4],
      cwCorners[(shift + 3) % 4],
    ];

    const hMat = computeHomography(canonicalCorners, mappedSrc);
    if (!hMat) continue;

    // Aspect consistency check (edge pairs horizontally vs vertically)
    const topW = dist(mappedSrc[0], mappedSrc[1]);
    const botW = dist(mappedSrc[3], mappedSrc[2]);
    const leftH = dist(mappedSrc[0], mappedSrc[3]);
    const rightH = dist(mappedSrc[1], mappedSrc[2]);
    const obsAspect = ((topW + botW) * 0.5) / Math.max(1, (leftH + rightH) * 0.5);
    const aspectErr = Math.abs(Math.log(obsAspect / canonAspect));

    // Sample asymmetric orientation anchor probe at TL vs symmetric blank spots at TR/BR/BL
    const probeR = Math.max(4, orientationAnchor.r * 0.65);
    const lumTl = sampleSrcMeanLuminance(srcImg, srcW, srcH, hMat, anchorProbes.tl.x, anchorProbes.tl.y, probeR);
    const lumTr = sampleSrcMeanLuminance(srcImg, srcW, srcH, hMat, anchorProbes.tr.x, anchorProbes.tr.y, probeR);
    const lumBr = sampleSrcMeanLuminance(srcImg, srcW, srcH, hMat, anchorProbes.br.x, anchorProbes.br.y, probeR);
    const lumBl = sampleSrcMeanLuminance(srcImg, srcW, srcH, hMat, anchorProbes.bl.x, anchorProbes.bl.y, probeR);

    const anchorContrast = (lumTr + lumBr + lumBl) / 3 - lumTl;
    // Also require aspect ratio to be within reasonable range unless perspective is extreme
    const score = anchorContrast - aspectErr * 120;

    if (score > bestScore) {
      bestScore = score;
      bestShift = shift;
      bestH = hMat;
    }
  }

  if (!bestH) {
    bestH = computeHomography(canonicalCorners, cwCorners);
  }

  const warpedCanvas = document.createElement('canvas');
  warpedCanvas.width = dstW;
  warpedCanvas.height = dstH;
  const dCtx = warpedCanvas.getContext('2d', { willReadFrequently: true });
  if (!dCtx || !bestH) {
    return {
      warpedCanvas,
      perspectiveCorrected: false,
      detectedOrientation: 0,
      quadDetection: quad,
    };
  }

  // Bilinear perspective warp from sourceCanvas -> canonical (dstW x dstH)
  const dstImg = dCtx.createImageData(dstW, dstH);
  const dstData = dstImg.data;
  const h0 = bestH[0], h1 = bestH[1], h2 = bestH[2];
  const h3 = bestH[3], h4 = bestH[4], h5 = bestH[5];
  const h6 = bestH[6], h7 = bestH[7], h8 = bestH[8];

  for (let v = 0; v < dstH; v++) {
    const rowBaseX = h1 * v + h2;
    const rowBaseY = h4 * v + h5;
    const rowBaseD = h7 * v + h8;
    const dstRowOffset = v * dstW * 4;

    for (let u = 0; u < dstW; u++) {
      const denom = h6 * u + rowBaseD;
      const sx = (h0 * u + rowBaseX) / denom;
      const sy = (h3 * u + rowBaseY) / denom;
      const outIdx = dstRowOffset + u * 4;

      if (sx < 0 || sx >= srcW - 1 || sy < 0 || sy >= srcH - 1) {
        dstData[outIdx] = 255;
        dstData[outIdx + 1] = 255;
        dstData[outIdx + 2] = 255;
        dstData[outIdx + 3] = 255;
        continue;
      }

      const x0 = sx | 0;
      const y0 = sy | 0;
      const fx = sx - x0;
      const fy = sy - y0;
      const fx1 = 1 - fx;
      const fy1 = 1 - fy;

      const w00 = fx1 * fy1;
      const w10 = fx * fy1;
      const w01 = fx1 * fy;
      const w11 = fx * fy;

      const p00 = (y0 * srcW + x0) * 4;
      const p10 = p00 + 4;
      const p01 = p00 + srcW * 4;
      const p11 = p01 + 4;

      dstData[outIdx] = (srcImg[p00] * w00 + srcImg[p10] * w10 + srcImg[p01] * w01 + srcImg[p11] * w11) | 0;
      dstData[outIdx + 1] = (srcImg[p00 + 1] * w00 + srcImg[p10 + 1] * w10 + srcImg[p01 + 1] * w01 + srcImg[p11 + 1] * w11) | 0;
      dstData[outIdx + 2] = (srcImg[p00 + 2] * w00 + srcImg[p10 + 2] * w10 + srcImg[p01 + 2] * w01 + srcImg[p11 + 2] * w11) | 0;
      dstData[outIdx + 3] = 255;
    }
  }

  dCtx.putImageData(dstImg, 0, 0);

  // Estimate dominant camera rotation from which CW corner mapped to canonical TL
  const tlCorner = cwCorners[bestShift % 4];
  const trCorner = cwCorners[(bestShift + 1) % 4];
  const angleDeg = ((Math.atan2(trCorner.y - tlCorner.y, trCorner.x - tlCorner.x) * 180) / Math.PI + 360) % 360;
  let detectedOrientation: 0 | 90 | 180 | 270 = 0;
  if (angleDeg >= 45 && angleDeg < 135) detectedOrientation = 90;
  else if (angleDeg >= 135 && angleDeg < 225) detectedOrientation = 180;
  else if (angleDeg >= 225 && angleDeg < 315) detectedOrientation = 270;
  else detectedOrientation = 0;

  return {
    warpedCanvas,
    perspectiveCorrected: true,
    detectedOrientation,
    quadDetection: quad,
  };
}

/**
 * Decodes QR Code payload from the sheet QR box (plus full-image fallback).
 */
export function decodeSheetQr(
  warpedCanvas: HTMLCanvasElement,
  geometry: UnifiedOmrGeometry,
  sourceCanvasFallback?: HTMLCanvasElement
): DecodedQrResult | null {
  const tryDecodeRegion = (canvas: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number): DecodedQrResult | null => {
    const padX = Math.max(0, Math.round(sx));
    const padY = Math.max(0, Math.round(sy));
    const w = Math.min(canvas.width - padX, Math.round(sw));
    const h = Math.min(canvas.height - padY, Math.round(sh));
    if (w < 24 || h < 24) return null;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const imgData = ctx.getImageData(padX, padY, w, h);
    const decoded = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
    if (!decoded?.data) return null;

    let parsed: Record<string, unknown> | null = null;
    try {
      const candidate = JSON.parse(decoded.data);
      if (candidate && typeof candidate === 'object') {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      parsed = null;
    }
    return { raw: decoded.data, parsed };
  };

  const { qrBox } = geometry;
  const margin = 22;
  const fromCrop = tryDecodeRegion(
    warpedCanvas,
    qrBox.x - margin,
    qrBox.y - margin,
    qrBox.width + margin * 2,
    qrBox.height + margin * 2
  );
  if (fromCrop) return fromCrop;

  // Try warped full canvas or source fallback downscaled to <= 900px
  const fallbackTargets = [warpedCanvas, ...(sourceCanvasFallback ? [sourceCanvasFallback] : [])];
  for (const target of fallbackTargets) {
    const scale = Math.min(1, 900 / Math.max(target.width, target.height));
    const rw = Math.round(target.width * scale);
    const rh = Math.round(target.height * scale);
    if (rw < 40 || rh < 40) continue;
    const temp = document.createElement('canvas');
    temp.width = rw;
    temp.height = rh;
    const tCtx = temp.getContext('2d', { willReadFrequently: true });
    if (!tCtx) continue;
    tCtx.drawImage(target, 0, 0, rw, rh);
    const res = tryDecodeRegion(temp, 0, 0, rw, rh);
    if (res) return res;
  }

  return null;
}

/**
 * Samples a single circular bubble using local surrounding paper reference (85th percentile ring)
 * to eliminate uneven lighting, desk shadows, and faded print contrast.
 */
export function sampleBubbleLocalContrast(
  imgData: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  r: number
): number {
  const coreR = Math.max(2, r * 0.72);
  const coreR2 = coreR * coreR;
  const ringInnerR2 = (r * 1.32) * (r * 1.32);
  const ringOuterR = Math.ceil(r * 2.15);
  const ringOuterR2 = ringOuterR * ringOuterR;

  const x0 = Math.max(0, Math.floor(cx - ringOuterR));
  const x1 = Math.min(width - 1, Math.ceil(cx + ringOuterR));
  const y0 = Math.max(0, Math.floor(cy - ringOuterR));
  const y1 = Math.min(height - 1, Math.ceil(cy + ringOuterR));

  const ringLums: number[] = [];
  const coreLums: number[] = [];

  for (let py = y0; py <= y1; py++) {
    const dy = py - cy;
    const dy2 = dy * dy;
    const rowOff = py * width;
    for (let px = x0; px <= x1; px++) {
      const dx = px - cx;
      const d2 = dx * dx + dy2;
      if (d2 <= coreR2) {
        const idx = (rowOff + px) * 4;
        coreLums.push(0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2]);
      } else if (d2 >= ringInnerR2 && d2 <= ringOuterR2) {
        const idx = (rowOff + px) * 4;
        ringLums.push(0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2]);
      }
    }
  }

  if (coreLums.length === 0) return 0;

  let localPaperLum = 245;
  if (ringLums.length > 4) {
    ringLums.sort((a, b) => a - b);
    localPaperLum = ringLums[Math.min(ringLums.length - 1, Math.floor(ringLums.length * 0.85))];
  }

  const effectivePaper = Math.max(100, localPaperLum);
  const darkCutoff = effectivePaper * 0.77;
  let darkCount = 0;
  let dropSum = 0;

  for (let i = 0; i < coreLums.length; i++) {
    const lum = coreLums[i];
    if (lum < darkCutoff) darkCount++;
    dropSum += Math.max(0, (effectivePaper - lum) / effectivePaper);
  }

  const darkFrac = darkCount / coreLums.length;
  const meanDrop = dropSum / coreLums.length;
  const fillScore = Math.min(1, 0.52 * Math.min(1, meanDrop * 2.15) + 0.48 * darkFrac);

  return Math.round(fillScore * 1000) / 1000;
}

/**
 * Generates an annotated visual verification image overlaying colored grading rings
 * onto the warped canonical sheet so teachers can inspect every bubble at a glance.
 */
export function renderAnnotatedOverlay(
  warpedCanvas: HTMLCanvasElement,
  geometry: UnifiedOmrGeometry,
  answersDetail: ScannedAnswerDetail[],
  options?: {
    choiceKeys?: string[];
    detectedIdBubbles?: Array<{ cx: number; cy: number; r: number }>;
    detectedSetBubble?: { cx: number; cy: number; r: number } | null;
  }
): string {
  const maxWidth = 760;
  const scale = Math.min(1, maxWidth / warpedCanvas.width);
  const outCanvas = document.createElement('canvas');
  outCanvas.width = Math.round(warpedCanvas.width * scale);
  outCanvas.height = Math.round(warpedCanvas.height * scale);
  const ctx = outCanvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(warpedCanvas, 0, 0, outCanvas.width, outCanvas.height);
  ctx.save();
  ctx.scale(scale, scale);

  const choiceKeys = options?.choiceKeys || ['A', 'B', 'C', 'D', 'E'];

  // Highlight detected Student ID bubbles & exam set in cyan
  if (options?.detectedIdBubbles) {
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.4;
    options.detectedIdBubbles.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, b.r + 2.5, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  if (options?.detectedSetBubble) {
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(options.detectedSetBubble.cx, options.detectedSetBubble.cy, options.detectedSetBubble.r + 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Highlight answer choices per question
  const detailMap = new Map(answersDetail.map((d) => [d.questionNumber, d]));
  for (const row of geometry.answerRows) {
    const detail = detailMap.get(row.questionNumber);
    if (!detail) continue;

    const acceptedSet = new Set(
      detail.acceptedChoices && detail.acceptedChoices.length > 0
        ? detail.acceptedChoices
        : [detail.correctChoice]
    );

    if (detail.isBonus) {
      row.bubbles.forEach((b) => {
        const key = choiceKeys[b.choiceIndex];
        if (detail.detectedChoice === key) {
          ctx.strokeStyle = '#0ea5e9';
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.arc(b.cx, b.cy, b.r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      continue;
    }

    for (const b of row.bubbles) {
      const key = choiceKeys[b.choiceIndex];
      const isDetected = detail.detectedChoice === key;
      const isAcceptedKey = acceptedSet.has(key);

      if (isDetected && detail.isCorrect) {
        ctx.strokeStyle = '#10b981'; // Green ring: correct!
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.cx, b.cy, b.r + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (isDetected && !detail.isCorrect) {
        ctx.strokeStyle = '#ef4444'; // Red ring: student wrong choice
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.cx, b.cy, b.r + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (!detail.isCorrect && isAcceptedKey) {
        ctx.save();
        ctx.strokeStyle = detail.detectedChoice === 'MULTIPLE' || !detail.detectedChoice ? '#f59e0b' : '#10b981';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(b.cx, b.cy, b.r + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  ctx.restore();
  return outCanvas.toDataURL('image/jpeg', 0.82);
}

/**
 * Generates an optionally perspective-skewed & unevenly lit canvas from an upright synthetic sheet
 * to verify homography warp, orientation lock, and adaptive local thresholding accuracy.
 */
export function distortCanvasPerspective(
  srcCanvas: HTMLCanvasElement,
  options?: {
    tiltDeg?: number;
    perspectiveSkew?: number;
    rotation?: 0 | 90 | 180 | 270;
    shadowGradient?: boolean;
  }
): HTMLCanvasElement {
  const baseCanvas = document.createElement('canvas');
  const rot = options?.rotation ?? 0;
  if (rot === 90 || rot === 270) {
    baseCanvas.width = srcCanvas.height;
    baseCanvas.height = srcCanvas.width;
  } else {
    baseCanvas.width = srcCanvas.width;
    baseCanvas.height = srcCanvas.height;
  }

  const bCtx = baseCanvas.getContext('2d');
  if (!bCtx) return srcCanvas;
  bCtx.fillStyle = '#e2e8f0';
  bCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);

  // Add subtle margin around sheet to emulate camera capture on a desk
  const pad = 120;
  const outW = baseCanvas.width + pad * 2;
  const outH = baseCanvas.height + pad * 2;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const oCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!oCtx) return srcCanvas;

  // Desk texture backdrop
  oCtx.fillStyle = '#cbd5e1';
  oCtx.fillRect(0, 0, outW, outH);

  // Rotate base first
  bCtx.save();
  bCtx.translate(baseCanvas.width / 2, baseCanvas.height / 2);
  bCtx.rotate((rot * Math.PI) / 180);
  bCtx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);
  bCtx.restore();

  const bImg = bCtx.getImageData(0, 0, baseCanvas.width, baseCanvas.height).data;
  const bw = baseCanvas.width;
  const bh = baseCanvas.height;

  // Project 4 corners of baseCanvas with tilt + perspective pinch onto outCanvas
  const rad = ((options?.tiltDeg ?? 0) * Math.PI) / 180;
  const skew = options?.perspectiveSkew ?? 0; // 0..0.18 pinch on top edge
  const cx = outW / 2;
  const cy = outH / 2;
  const halfW = bw * 0.48;
  const halfH = bh * 0.48;

  const rawPts: OmrPoint[] = [
    { x: -halfW * (1 - skew), y: -halfH * (1 - skew * 0.4) },
    { x: halfW * (1 - skew), y: -halfH * (1 - skew * 0.4) },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ];

  const dstCorners: [OmrPoint, OmrPoint, OmrPoint, OmrPoint] = rawPts.map((p) => ({
    x: cx + p.x * Math.cos(rad) - p.y * Math.sin(rad),
    y: cy + p.x * Math.sin(rad) + p.y * Math.cos(rad),
  })) as [OmrPoint, OmrPoint, OmrPoint, OmrPoint];

  const srcCorners: [OmrPoint, OmrPoint, OmrPoint, OmrPoint] = [
    { x: 0, y: 0 },
    { x: bw, y: 0 },
    { x: bw, y: bh },
    { x: 0, y: bh },
  ];

  // Forward map = dstCorners -> srcCorners so every output pixel looks up source pixel
  const invH = computeHomography(dstCorners, srcCorners);
  if (!invH) return baseCanvas;

  const outImg = oCtx.getImageData(0, 0, outW, outH);
  const oData = outImg.data;
  const shadowEnabled = options?.shadowGradient !== false;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const sp = applyHomography(invH, x, y);
      const sx = Math.round(sp.x);
      const sy = Math.round(sp.y);
      if (sx < 0 || sx >= bw || sy < 0 || sy >= bh) continue;

      const sIdx = (sy * bw + sx) * 4;
      const dIdx = (y * outW + x) * 4;
      const shade = shadowEnabled ? 1 - ((x / outW) * 0.16 + (y / outH) * 0.12) : 1;
      oData[dIdx] = Math.round(bImg[sIdx] * shade);
      oData[dIdx + 1] = Math.round(bImg[sIdx + 1] * shade);
      oData[dIdx + 2] = Math.round(bImg[sIdx + 2] * shade);
      oData[dIdx + 3] = 255;
    }
  }

  oCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}
