// Web Worker for waveform, BPM, and key detection
// Can receive either raw channelData or a src URL to fetch

self.onmessage = async function(e) {
  const { id } = e.data;
  let channelData = e.data.channelData;
  let sampleRate = e.data.sampleRate;
  let duration = e.data.duration;

  // If src provided instead of channelData, fetch and decode
  if (!channelData && e.data.src) {
    try {
      // Worker needs absolute URL
      var srcUrl = e.data.src;
      if (srcUrl.startsWith("/")) {
        srcUrl = self.location.origin + srcUrl;
      }
      const res = await fetch(srcUrl);
      const arrayBuffer = await res.arrayBuffer();
      const ctx = new OfflineAudioContext(2, 44100 * 600, 44100);
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      channelData = audioBuffer.getChannelData(0);
      sampleRate = audioBuffer.sampleRate;
      duration = audioBuffer.duration;
    } catch (err) {
      self.postMessage({ id, waveform: null, duration: 0, bpm: null, musicalKey: null });
      return;
    }
  }

  if (!channelData) {
    self.postMessage({ id, waveform: null, duration: 0, bpm: null, musicalKey: null });
    return;
  }

  // === Waveform ===
  var bars = 200;
  var blockSize = Math.floor(channelData.length / bars);
  var peaks = [];
  for (var w = 0; w < bars; w++) {
    var sum = 0;
    var start = w * blockSize;
    for (var j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[start + j] || 0);
    }
    peaks.push(sum / blockSize);
  }
  var maxPeak = Math.max(...peaks, 0.01);
  var waveform = peaks.map(function(p) { return p / maxPeak; });

  let bpm = null;
  let musicalKey = null;

  // === BPM Detection ===
  try {
    const windowSize = Math.floor(sampleRate * 0.02);
    const envelope = [];
    for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += channelData[i + j] * channelData[i + j];
      }
      envelope.push(sum / windowSize);
    }

    const threshold = envelope.reduce((a, b) => a + b, 0) / envelope.length * 1.5;
    const peaks = [];
    let lastPeak = -10;
    for (let i = 1; i < envelope.length - 1; i++) {
      if (envelope[i] > threshold && envelope[i] > envelope[i - 1] && envelope[i] > envelope[i + 1] && i - lastPeak > 5) {
        peaks.push(i);
        lastPeak = i;
      }
    }

    if (peaks.length >= 4) {
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i - 1]);
      }

      const windowDuration = windowSize / sampleRate;
      const bpmCounts = {};
      for (const interval of intervals) {
        const seconds = interval * windowDuration;
        const b = 60 / seconds;
        if (b >= 60 && b <= 200) {
          const rounded = Math.round(b);
          bpmCounts[rounded] = (bpmCounts[rounded] || 0) + 1;
        }
      }

      let bestBPM = 0;
      let bestCount = 0;
      for (const [bpmStr, count] of Object.entries(bpmCounts)) {
        const b = Number(bpmStr);
        let total = count;
        for (let offset = -2; offset <= 2; offset++) {
          if (offset !== 0) total += (bpmCounts[b + offset] || 0);
        }
        if (total > bestCount) {
          bestCount = total;
          bestBPM = b;
        }
      }
      if (bestBPM > 0) bpm = bestBPM;
    }
  } catch (e) {}

  // === Key Detection ===
  try {
    const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    function correlate(x, y) {
      const n = x.length;
      const meanX = x.reduce((a, b) => a + b, 0) / n;
      const meanY = y.reduce((a, b) => a + b, 0) / n;
      let num = 0, denX = 0, denY = 0;
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

    function rotateArray(arr, n) {
      const len = arr.length;
      const shift = ((n % len) + len) % len;
      return [...arr.slice(shift), ...arr.slice(0, shift)];
    }

    const startSample = Math.max(0, Math.floor((duration / 2 - 15) * sampleRate));
    const endSample = Math.min(channelData.length, startSample + 30 * sampleRate);
    const segment = channelData.slice(startSample, endSample);

    const fftSize = 4096;
    const chroma = new Float64Array(12);
    const hopSize = fftSize / 2;
    const windowCount = Math.min(20, Math.floor((segment.length - fftSize) / hopSize));

    if (windowCount >= 1) {
      for (let w = 0; w < windowCount; w++) {
        const offset = w * hopSize;
        const real = new Float64Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
          const win = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
          real[i] = (segment[offset + i] || 0) * win;
        }

        for (let note = 0; note < 12; note++) {
          let energy = 0;
          for (let octave = 3; octave <= 6; octave++) {
            const freq = 440 * Math.pow(2, (note - 9 + (octave - 4) * 12) / 12);
            const bin = Math.round(freq * fftSize / sampleRate);
            if (bin > 0 && bin < fftSize / 2) {
              let sumR = 0, sumI = 0;
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

      const maxChroma = Math.max(...Array.from(chroma));
      if (maxChroma > 0) {
        const chromaArray = Array.from(chroma).map(v => v / maxChroma);
        let bestKey = "";
        let bestCorr = -Infinity;

        for (let i = 0; i < 12; i++) {
          const majorCorr = correlate(chromaArray, rotateArray(MAJOR_PROFILE, i));
          const minorCorr = correlate(chromaArray, rotateArray(MINOR_PROFILE, i));
          if (majorCorr > bestCorr) { bestCorr = majorCorr; bestKey = NOTE_NAMES[i] + " Major"; }
          if (minorCorr > bestCorr) { bestCorr = minorCorr; bestKey = NOTE_NAMES[i] + " Minor"; }
        }
        if (bestKey) musicalKey = bestKey;
      }
    }
  } catch (e) {}

  self.postMessage({ id, waveform, duration, bpm, musicalKey });
};
