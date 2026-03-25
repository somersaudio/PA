/**
 * Simple BPM detection using peak interval analysis.
 * Works client-side with an AudioBuffer.
 */
export function detectBPM(audioBuffer: AudioBuffer): number | null {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // Low-pass filter: average over small windows to get energy envelope
  const windowSize = Math.floor(sampleRate * 0.02); // 20ms windows
  const envelope: number[] = [];
  for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += channelData[i + j] * channelData[i + j];
    }
    envelope.push(sum / windowSize);
  }

  // Find peaks (onsets) in the energy envelope
  const threshold = envelope.reduce((a, b) => a + b, 0) / envelope.length * 1.5;
  const peaks: number[] = [];
  let lastPeak = -10;

  for (let i = 1; i < envelope.length - 1; i++) {
    if (
      envelope[i] > threshold &&
      envelope[i] > envelope[i - 1] &&
      envelope[i] > envelope[i + 1] &&
      i - lastPeak > 5 // minimum gap between peaks
    ) {
      peaks.push(i);
      lastPeak = i;
    }
  }

  if (peaks.length < 4) return null;

  // Calculate intervals between peaks
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  // Convert intervals to BPM and cluster them
  const windowDuration = windowSize / sampleRate; // seconds per envelope sample
  const bpmCounts: Record<number, number> = {};

  for (const interval of intervals) {
    const seconds = interval * windowDuration;
    const bpm = 60 / seconds;

    // Only consider reasonable BPM range
    if (bpm >= 60 && bpm <= 200) {
      const rounded = Math.round(bpm);
      bpmCounts[rounded] = (bpmCounts[rounded] || 0) + 1;
    }
  }

  // Find the most common BPM (with tolerance of ±2)
  let bestBPM = 0;
  let bestCount = 0;

  for (const [bpmStr, count] of Object.entries(bpmCounts)) {
    const bpm = Number(bpmStr);
    // Sum nearby BPMs for tolerance
    let total = count;
    for (let offset = -2; offset <= 2; offset++) {
      if (offset !== 0) {
        total += bpmCounts[bpm + offset] || 0;
      }
    }
    if (total > bestCount) {
      bestCount = total;
      bestBPM = bpm;
    }
  }

  return bestBPM > 0 ? bestBPM : null;
}
