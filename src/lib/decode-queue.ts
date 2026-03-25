// Sequential audio decode queue — prevents multiple simultaneous decodes from freezing the UI

type DecodeJob = {
  src: string;
  resolve: (data: { channelData: Float32Array; sampleRate: number; duration: number }) => void;
  reject: (err: unknown) => void;
};

const queue: DecodeJob[] = [];
let processing = false;

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const job = queue.shift()!;
    try {
      const res = await fetch(job.src);
      const arrayBuffer = await res.arrayBuffer();
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      ctx.close();
      job.resolve({
        channelData: buffer.getChannelData(0),
        sampleRate: buffer.sampleRate,
        duration: buffer.duration,
      });
    } catch (err) {
      job.reject(err);
    }
    // Small yield between decodes so UI stays responsive
    await new Promise((r) => setTimeout(r, 50));
  }

  processing = false;
}

export function queueDecode(src: string): Promise<{ channelData: Float32Array; sampleRate: number; duration: number }> {
  return new Promise((resolve, reject) => {
    queue.push({ src, resolve, reject });
    processQueue();
  });
}
