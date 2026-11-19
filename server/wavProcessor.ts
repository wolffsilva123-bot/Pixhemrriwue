export interface WavMetadata {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSeconds: number;
  fileSizeBytes: number;
  peakDbfs: number;
  rmsDbfs: number;
}

export interface ProcessedWavResult {
  buffer: Buffer;
  metadata: WavMetadata;
  waveform: number[];
}

interface ParsedWav {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  pcmData: Buffer;
}

function parseWavBuffer(buffer: Buffer): ParsedWav {
  if (buffer.length < 44) {
    throw new Error('Arquivo WAV inválido: tamanho menor que o cabeçalho RIFF mínimo.');
  }

  const riffHeader = buffer.toString('ascii', 0, 4);
  const waveHeader = buffer.toString('ascii', 8, 12);
  if (riffHeader !== 'RIFF' || waveHeader !== 'WAVE') {
    throw new Error('Formato inválido: o arquivo retornado não possui cabeçalho RIFF/WAVE.');
  }

  let offset = 12;
  let sampleRate = 24000;
  let channels = 1;
  let bitsPerSample = 16;
  let audioFormat = 1;
  let foundFmt = false;
  let pcmData: Buffer | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = Math.min(buffer.length, chunkDataStart + chunkSize);

    if (chunkId === 'fmt ' && chunkSize >= 16 && chunkDataStart + 16 <= buffer.length) {
      audioFormat = buffer.readUInt16LE(chunkDataStart);
      channels = buffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
      foundFmt = true;
    } else if (chunkId === 'data') {
      pcmData = buffer.subarray(chunkDataStart, chunkDataEnd);
      break;
    }

    // RIFF chunks are word-aligned (even byte boundaries)
    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (!foundFmt || !pcmData) {
    throw new Error('Estrutura WAV incompleta: chunks fmt ou data não encontrados.');
  }

  if (audioFormat !== 1 || bitsPerSample !== 16) {
    throw new Error(
      `Formato PCM não suportado (${audioFormat}, ${bitsPerSample}-bit). Esperado PCM 16-bit.`
    );
  }

  return {
    sampleRate,
    channels,
    bitsPerSample,
    pcmData,
  };
}

function encodeWavPcm16(samples: Int16Array, sampleRate: number, channels: number): Buffer {
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = samples.length * 2;
  const out = Buffer.allocUnsafe(44 + dataSize);

  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(36 + dataSize, 4);
  out.write('WAVE', 8, 'ascii');
  out.write('fmt ', 12, 'ascii');
  out.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  out.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  out.writeUInt16LE(channels, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(byteRate, 28);
  out.writeUInt16LE(blockAlign, 32);
  out.writeUInt16LE(bitsPerSample, 34);
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i += 1) {
    out.writeInt16LE(samples[i], 44 + i * 2);
  }

  return out;
}

function computeWaveformBars(samples: Int16Array, barCount = 64): number[] {
  if (samples.length === 0) {
    return Array.from({ length: barCount }, () => 0.1);
  }

  const bars: number[] = [];
  const step = Math.max(1, Math.floor(samples.length / barCount));

  for (let b = 0; b < barCount; b += 1) {
    const start = b * step;
    const end = b === barCount - 1 ? samples.length : Math.min(samples.length, start + step);
    let peak = 0;
    for (let i = start; i < end; i += 1) {
      const abs = Math.abs(samples[i]) / 32768;
      if (abs > peak) peak = abs;
    }
    bars.push(Number(Math.min(1, Math.max(0.04, peak)).toFixed(3)));
  }

  return bars;
}

function computeAudioStats(
  samples: Int16Array,
  sampleRate: number,
  channels: number,
  fileSizeBytes: number
): WavMetadata {
  let maxAbs = 0;
  let sumSq = 0;

  for (let i = 0; i < samples.length; i += 1) {
    const normalized = samples[i] / 32768;
    const abs = Math.abs(normalized);
    if (abs > maxAbs) maxAbs = abs;
    sumSq += normalized * normalized;
  }

  const rms = samples.length > 0 ? Math.sqrt(sumSq / samples.length) : 0;
  const peakDbfs = maxAbs > 0 ? Number((20 * Math.log10(maxAbs)).toFixed(1)) : -96;
  const rmsDbfs = rms > 0 ? Number((20 * Math.log10(rms)).toFixed(1)) : -96;
  const frameCount = samples.length / Math.max(1, channels);
  const durationSeconds = Number((frameCount / Math.max(1, sampleRate)).toFixed(2));

  return {
    sampleRate,
    channels,
    bitsPerSample: 16,
    durationSeconds,
    fileSizeBytes,
    peakDbfs,
    rmsDbfs,
  };
}

/**
 * Balances speech loudness without clipping and guarantees clean leading/trailing
 * silence padding so the first and last syllables are never cut off.
 */
export function processWavBuffer(rawWavBuffer: Buffer): ProcessedWavResult {
  const parsed = parseWavBuffer(rawWavBuffer);
  const sampleCount = Math.floor(parsed.pcmData.length / 2);
  const rawSamples = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i += 1) {
    rawSamples[i] = parsed.pcmData.readInt16LE(i * 2);
  }

  // Detect active speech boundaries conservatively (-48 dBFS threshold ≈ 130/32768)
  const silenceThreshold = 130;
  let firstActiveFrame = 0;
  let lastActiveFrame = Math.floor(sampleCount / parsed.channels) - 1;

  for (let f = 0; f < Math.floor(sampleCount / parsed.channels); f += 1) {
    let frameMax = 0;
    for (let c = 0; c < parsed.channels; c += 1) {
      const v = Math.abs(rawSamples[f * parsed.channels + c]);
      if (v > frameMax) frameMax = v;
    }
    if (frameMax > silenceThreshold) {
      firstActiveFrame = f;
      break;
    }
  }

  for (let f = Math.floor(sampleCount / parsed.channels) - 1; f >= firstActiveFrame; f -= 1) {
    let frameMax = 0;
    for (let c = 0; c < parsed.channels; c += 1) {
      const v = Math.abs(rawSamples[f * parsed.channels + c]);
      if (v > frameMax) frameMax = v;
    }
    if (frameMax > silenceThreshold) {
      lastActiveFrame = f;
      break;
    }
  }

  // Preserve a 60ms natural breath margin around detected speech boundaries
  const breathMarginFrames = Math.round(parsed.sampleRate * 0.06);
  const sliceStartFrame = Math.max(0, firstActiveFrame - breathMarginFrames);
  const totalFrames = Math.floor(sampleCount / parsed.channels);
  const sliceEndFrame = Math.min(totalFrames - 1, lastActiveFrame + breathMarginFrames);
  const speechFrameCount = Math.max(1, sliceEndFrame - sliceStartFrame + 1);

  // Measure active speech RMS and peak for balanced volume
  let maxAbs = 0;
  let activeSumSq = 0;
  let activeSamplesCount = 0;

  for (let f = sliceStartFrame; f <= sliceEndFrame; f += 1) {
    for (let c = 0; c < parsed.channels; c += 1) {
      const s = rawSamples[f * parsed.channels + c] / 32768;
      const abs = Math.abs(s);
      if (abs > maxAbs) maxAbs = abs;
      if (abs > 0.006) {
        activeSumSq += s * s;
        activeSamplesCount += 1;
      }
    }
  }

  const activeRms = activeSamplesCount > 0 ? Math.sqrt(activeSumSq / activeSamplesCount) : 0.1;
  // Target balanced spoken-voice RMS at -16.5 dBFS (0.1496) while capping peak at -1.5 dBFS (0.841)
  const targetRms = 0.1496;
  const maxAllowedPeak = 0.841;
  let gain = activeRms > 0 ? targetRms / activeRms : 1;
  if (maxAbs * gain > maxAllowedPeak && maxAbs > 0) {
    gain = maxAllowedPeak / maxAbs;
  }
  gain = Math.min(2.8, Math.max(0.5, gain));

  // Add clean 250ms leading silence and 420ms trailing silence so nothing clips on any player
  const leadPadFrames = Math.round(parsed.sampleRate * 0.25);
  const trailPadFrames = Math.round(parsed.sampleRate * 0.42);
  const outFrames = leadPadFrames + speechFrameCount + trailPadFrames;
  const outSamples = new Int16Array(outFrames * parsed.channels);

  const fadeFrames = Math.min(Math.round(parsed.sampleRate * 0.012), Math.floor(speechFrameCount / 4));

  for (let f = 0; f < speechFrameCount; f += 1) {
    const srcFrame = sliceStartFrame + f;
    const dstFrame = leadPadFrames + f;

    let fadeMultiplier = 1;
    if (fadeFrames > 0) {
      if (f < fadeFrames) {
        fadeMultiplier = f / fadeFrames;
      } else if (f >= speechFrameCount - fadeFrames) {
        fadeMultiplier = (speechFrameCount - 1 - f) / fadeFrames;
      }
    }

    for (let c = 0; c < parsed.channels; c += 1) {
      const rawVal = rawSamples[srcFrame * parsed.channels + c];
      const scaled = Math.round(rawVal * gain * fadeMultiplier);
      outSamples[dstFrame * parsed.channels + c] = Math.max(-32767, Math.min(32767, scaled));
    }
  }

  const finalBuffer = encodeWavPcm16(outSamples, parsed.sampleRate, parsed.channels);
  const metadata = computeAudioStats(outSamples, parsed.sampleRate, parsed.channels, finalBuffer.length);
  const waveform = computeWaveformBars(outSamples, 64);

  return {
    buffer: finalBuffer,
    metadata,
    waveform,
  };
}

export function inspectWavBuffer(wavBuffer: Buffer): { metadata: WavMetadata; waveform: number[] } {
  const parsed = parseWavBuffer(wavBuffer);
  const sampleCount = Math.floor(parsed.pcmData.length / 2);
  const samples = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i += 1) {
    samples[i] = parsed.pcmData.readInt16LE(i * 2);
  }

  return {
    metadata: computeAudioStats(samples, parsed.sampleRate, parsed.channels, wavBuffer.length),
    waveform: computeWaveformBars(samples, 64),
  };
}
