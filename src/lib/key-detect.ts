/**
 * Musical key detection using chromagram analysis.
 * Compares the pitch class profile against known major/minor key profiles.
 */

// Krumhansl-Kessler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function correlate(x: number[], y: number[]): number {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function rotateArray(arr: number[], n: number): number[] {
  const len = arr.length;
  const shift = ((n % len) + len) % len;
  return [...arr.slice(shift), ...arr.slice(0, shift)];
}

export function detectKey(audioBuffer: AudioBuffer): string | null {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // Use a subset of the audio for speed (middle 30 seconds)
  const startSample = Math.max(0, Math.floor((audioBuffer.duration / 2 - 15) * sampleRate));
  const endSample = Math.min(channelData.length, startSample + 30 * sampleRate);
  const segment = channelData.slice(startSample, endSample);

  // FFT size
  const fftSize = 8192;
  const chroma = new Float64Array(12);

  // Process in overlapping windows
  const hopSize = fftSize / 2;
  const windowCount = Math.floor((segment.length - fftSize) / hopSize);

  if (windowCount < 1) return null;

  for (let w = 0; w < windowCount; w++) {
    const offset = w * hopSize;

    // Apply Hanning window and compute DFT magnitudes for chroma bins
    const real = new Float64Array(fftSize);
    const imag = new Float64Array(fftSize);

    for (let i = 0; i < fftSize; i++) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
      real[i] = (segment[offset + i] || 0) * window;
    }

    // Simple DFT for just the frequency bins we care about (musical notes)
    // Instead of full FFT, compute magnitude at each chroma frequency
    for (let note = 0; note < 12; note++) {
      let energy = 0;

      // Check octaves 2-7 for this pitch class
      for (let octave = 2; octave <= 7; octave++) {
        const freq = 440 * Math.pow(2, (note - 9 + (octave - 4) * 12) / 12);
        const bin = Math.round(freq * fftSize / sampleRate);

        if (bin > 0 && bin < fftSize / 2) {
          // Goertzel-like: compute magnitude at this specific frequency
          let sumR = 0;
          let sumI = 0;
          const k = (2 * Math.PI * bin) / fftSize;
          for (let i = 0; i < fftSize; i++) {
            sumR += real[i] * Math.cos(k * i);
            sumI += real[i] * Math.sin(k * i);
          }
          energy += Math.sqrt(sumR * sumR + sumI * sumI);
        }
      }

      chroma[note] += energy;
    }
  }

  // Normalize chroma
  const maxChroma = Math.max(...Array.from(chroma));
  if (maxChroma === 0) return null;

  const chromaArray = Array.from(chroma).map((v) => v / maxChroma);

  // Correlate with all 24 key profiles (12 major + 12 minor)
  let bestKey = "";
  let bestCorr = -Infinity;

  for (let i = 0; i < 12; i++) {
    const majorCorr = correlate(chromaArray, rotateArray(MAJOR_PROFILE, i));
    const minorCorr = correlate(chromaArray, rotateArray(MINOR_PROFILE, i));

    if (majorCorr > bestCorr) {
      bestCorr = majorCorr;
      bestKey = `${NOTE_NAMES[i]} Major`;
    }
    if (minorCorr > bestCorr) {
      bestCorr = minorCorr;
      bestKey = `${NOTE_NAMES[i]} Minor`;
    }
  }

  return bestKey || null;
}
