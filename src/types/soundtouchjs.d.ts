declare module "soundtouchjs" {
  export class PitchShifter {
    constructor(ctx: AudioContext, buffer: AudioBuffer, bufferSize: number);
    pitch: number;
    tempo: number;
    percentagePlayed: number;
    on(event: string, callback: (detail: { percentagePlayed: number }) => void): void;
    connect(destination: AudioNode): void;
    disconnect(): void;
  }
}
