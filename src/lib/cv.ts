// Client-side computer-vision helpers: perceptual hash (pHash) + SSIM.
// All work runs on a hidden <canvas>; no network calls.

export type CVMetrics = {
  phashA: string; // 64-bit hex
  phashB: string;
  hammingDistance: number; // 0..64
  phashSimilarity: number; // 0..100 (100 = identical)
  ssim: number; // -1..1, typically 0..1 for natural images
  ssimSimilarity: number; // 0..100
  combined: number; // 0..100 weighted blend
};

const PHASH_SIZE = 32; // DCT input
const PHASH_LOW = 8; // low-frequency block

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawGray(img: HTMLImageElement, size: number): Float64Array {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const out = new Float64Array(size * size);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    // Rec. 601 luma
    out[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}

// Naive 2D DCT-II (O(N^4)) — fine for N=32.
function dct2(input: Float64Array, n: number): Float64Array {
  const out = new Float64Array(n * n);
  const cosTable = new Float64Array(n * n);
  for (let k = 0; k < n; k++) {
    for (let x = 0; x < n; x++) {
      cosTable[k * n + x] = Math.cos(((2 * x + 1) * k * Math.PI) / (2 * n));
    }
  }
  // Row pass
  const tmp = new Float64Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let k = 0; k < n; k++) {
      let s = 0;
      for (let x = 0; x < n; x++) s += input[y * n + x] * cosTable[k * n + x];
      tmp[y * n + k] = s;
    }
  }
  // Column pass
  for (let k = 0; k < n; k++) {
    for (let l = 0; l < n; l++) {
      let s = 0;
      for (let y = 0; y < n; y++) s += tmp[y * n + k] * cosTable[l * n + y];
      out[l * n + k] = s;
    }
  }
  return out;
}

function pHash(img: HTMLImageElement): string {
  const gray = drawGray(img, PHASH_SIZE);
  const dct = dct2(gray, PHASH_SIZE);
  // Take top-left 8x8 excluding DC, compute median, then bits.
  const block: number[] = [];
  for (let y = 0; y < PHASH_LOW; y++) {
    for (let x = 0; x < PHASH_LOW; x++) {
      block.push(dct[y * PHASH_SIZE + x]);
    }
  }
  const sorted = [...block].slice(1).sort((a, b) => a - b); // exclude DC
  const median = sorted[Math.floor(sorted.length / 2)];
  let hex = "";
  for (let i = 0; i < block.length; i += 4) {
    let nib = 0;
    for (let b = 0; b < 4; b++) nib = (nib << 1) | (block[i + b] > median ? 1 : 0);
    hex += nib.toString(16);
  }
  return hex;
}

function hamming(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  let d = 0;
  for (let i = 0; i < len; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

// Single-window SSIM on grayscale, common constants for 8-bit dynamic range.
function ssim(imgA: HTMLImageElement, imgB: HTMLImageElement, size = 256): number {
  const a = drawGray(imgA, size);
  const b = drawGray(imgB, size);
  const n = a.length;
  let muA = 0;
  let muB = 0;
  for (let i = 0; i < n; i++) {
    muA += a[i];
    muB += b[i];
  }
  muA /= n;
  muB /= n;
  let varA = 0;
  let varB = 0;
  let cov = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - muA;
    const db = b[i] - muB;
    varA += da * da;
    varB += db * db;
    cov += da * db;
  }
  varA /= n - 1;
  varB /= n - 1;
  cov /= n - 1;
  const L = 255;
  const c1 = (0.01 * L) ** 2;
  const c2 = (0.03 * L) ** 2;
  return ((2 * muA * muB + c1) * (2 * cov + c2)) / ((muA * muA + muB * muB + c1) * (varA + varB + c2));
}

export async function computeCVMetrics(srcA: string, srcB: string): Promise<CVMetrics> {
  const [a, b] = await Promise.all([loadImage(srcA), loadImage(srcB)]);
  const phashA = pHash(a);
  const phashB = pHash(b);
  const hammingDistance = hamming(phashA, phashB);
  const phashSimilarity = Math.max(0, Math.min(100, 100 * (1 - hammingDistance / 64)));
  const ssimRaw = ssim(a, b);
  const ssimSimilarity = Math.max(0, Math.min(100, ssimRaw * 100));
  const combined = phashSimilarity * 0.5 + ssimSimilarity * 0.5;
  return {
    phashA,
    phashB,
    hammingDistance,
    phashSimilarity,
    ssim: ssimRaw,
    ssimSimilarity,
    combined,
  };
}
