import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Headphones,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { PIX_PAYMENT_CONFIG } from '../constants/pixData';

interface WavMetadata {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSeconds: number;
  fileSizeBytes: number;
  peakDbfs: number;
  rmsDbfs: number;
}

interface AudioApiResponse {
  ready: boolean;
  hasApiKey?: boolean;
  filename?: string;
  url?: string;
  script?: string;
  metadata?: WavMetadata;
  waveform?: number[];
  voiceName?: 'Kore' | 'Zephyr';
  model?: 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts';
  generatedAt?: string;
  error?: string;
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const wholeSeconds = Math.floor(seconds);
  const mins = Math.floor(wholeSeconds / 60);
  const secs = wholeSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export function AudioGuidePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoTriggeredRef = useRef(false);

  const [audioUrl, setAudioUrl] = useState<string>(PIX_PAYMENT_CONFIG.audioSrc);
  const [hasAudioSource, setHasAudioSource] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [metadata, setMetadata] = useState<WavMetadata | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [voiceName, setVoiceName] = useState<'Kore' | 'Zephyr'>('Kore');
  const [model, setModel] = useState<'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts'>(
    'gemini-3.8-flash-lite-tts'
  );
  const [showStudioPanel, setShowStudioPanel] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Verificando arquivo de locução em áudio WAV...'
  );

  const applyReadyPayload = useCallback((data: AudioApiResponse) => {
    setHasAudioSource(true);
    setErrorMessage(null);
    if (data.url) {
      setAudioUrl(data.url);
    }
    if (data.metadata) {
      setMetadata(data.metadata);
      if (data.metadata.durationSeconds > 0) {
        setDuration(data.metadata.durationSeconds);
      }
    }
    if (Array.isArray(data.waveform) && data.waveform.length > 0) {
      setWaveform(data.waveform);
    }
    if (data.voiceName === 'Kore' || data.voiceName === 'Zephyr') {
      setVoiceName(data.voiceName);
    }
    if (data.model === 'gemini-3.8-flash-lite-tts' || data.model === 'gemini-3.8-flash-tts') {
      setModel(data.model);
    }
    setStatusMessage('Locução pronta. Toque em Reproduzir para ouvir ou baixe o arquivo WAV.');
  }, []);

  const generateAudio = useCallback(
    async (options: { force?: boolean; selectedVoice?: 'Kore' | 'Zephyr'; selectedModel?: 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts' } = {}) => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        audio.pause();
      }

      setIsGenerating(true);
      setErrorMessage(null);
      setStatusMessage('Gerando locução feminina em português brasileiro (WAV 24 kHz)...');

      try {
        const res = await fetch('/api/audio/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceName: options.selectedVoice ?? voiceName,
            model: options.selectedModel ?? model,
            force: Boolean(options.force),
          }),
        });

        const data = (await res.json()) as AudioApiResponse;
        if (!res.ok || !data.ready) {
          throw new Error(data.error || 'Não foi possível gerar o áudio WAV.');
        }

        applyReadyPayload(data);
        setCurrentTime(0);

        if (audioRef.current) {
          audioRef.current.src = data.url || PIX_PAYMENT_CONFIG.audioSrc;
          audioRef.current.load();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao gerar a locução em WAV.';
        setErrorMessage(message);
        setStatusMessage('Não foi possível gerar o áudio automaticamente.');
      } finally {
        setIsGenerating(false);
        setIsCheckingStatus(false);
      }
    },
    [applyReadyPayload, model, voiceName]
  );

  useEffect(() => {
    let active = true;

    async function checkInitialStatus() {
      setIsCheckingStatus(true);
      try {
        const res = await fetch('/api/audio/status');
        const data = (await res.json()) as AudioApiResponse;
        if (!active) return;

        if (data.ready) {
          applyReadyPayload(data);
          setIsCheckingStatus(false);
          return;
        }

        if (data.hasApiKey && !autoTriggeredRef.current) {
          autoTriggeredRef.current = true;
          await generateAudio({ force: false });
          return;
        }

        setHasAudioSource(false);
        setIsCheckingStatus(false);
        setStatusMessage(
          'Clique em Gerar locução WAV para sintetizar a voz feminina em português brasileiro.'
        );
      } catch {
        if (!active) return;
        setIsCheckingStatus(false);
        setErrorMessage('Falha ao consultar o servidor de áudio.');
      }
    }

    checkInitialStatus();

    return () => {
      active = false;
    };
  }, [applyReadyPayload, generateAudio]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => {
      if (hasAudioSource) {
        setIsBuffering(true);
      }
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handleLoadedMetadata = () => {
      setIsBuffering(false);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handlePlay = () => {
      setIsBuffering(false);
      setIsPlaying(true);
      setStatusMessage('Reproduzindo locução de orientação Pix...');
    };

    const handlePlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      if (!audio.ended && hasAudioSource) {
        setStatusMessage('Reprodução pausada.');
      }
    };

    const handleEnded = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setStatusMessage('Locução finalizada. Você pode reproduzir novamente ou baixar o arquivo WAV.');
    };

    const handleError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [hasAudioSource]);

  const startPlayback = useCallback(
    (restartFromZero: boolean) => {
      const audio = audioRef.current;
      if (!audio || !hasAudioSource) return;

      setIsBuffering(true);

      if (restartFromZero) {
        try {
          audio.currentTime = 0;
          setCurrentTime(0);
        } catch {
          // Ignore seek errors before metadata is loaded on Safari
        }
      }

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          setIsBuffering(false);
          setIsPlaying(false);
          setErrorMessage('Não foi possível iniciar a reprodução neste navegador.');
        });
      }
    },
    [hasAudioSource]
  );

  const handlePlay = () => {
    startPlayback(false);
  };

  const handlePause = () => {
    audioRef.current?.pause();
  };

  const handleRestart = () => {
    startPlayback(true);
  };

  const handleSeek = (nextTime: number) => {
    const audio = audioRef.current;
    setCurrentTime(nextTime);
    if (audio && Number.isFinite(nextTime)) {
      audio.currentTime = nextTime;
    }
  };

  const progressPercentage =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const isBusy = isCheckingStatus || isGenerating;

  return (
    <section
      id="audio-explicativo"
      aria-labelledby="audio-heading"
      className="rounded-3xl bg-gradient-to-b from-[#0A2047] to-[#06142E] border border-[#1B3B73] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.5)] p-6 sm:p-8 text-white"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-2xl bg-[#FFE600] text-[#040E21] flex items-center justify-center shrink-0 shadow-[0_8px_20px_-6px_rgba(255,230,0,0.45)]">
            {isBusy || isBuffering ? (
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            ) : (
              <Headphones className="w-6 h-6" aria-hidden="true" />
            )}
          </span>
          <div>
            <p className="text-xs font-semibold text-[#FFE600]">
              Locução profissional · Português brasileiro · Voz feminina
            </p>
            <h2
              id="audio-heading"
              className="mt-0.5 font-display text-lg sm:text-xl font-bold tracking-tight text-white"
            >
              Orientações de pagamento em áudio
            </h2>
          </div>
        </div>

        {/* Equalizer bars active only during audio playback */}
        <div
          className="flex items-end gap-1 h-7 px-2.5 py-1.5 rounded-xl bg-[#041024]/80 border border-white/10 shrink-0"
          aria-hidden="true"
        >
          <span
            className={`w-1 rounded-full bg-[#009EE3] transition-all duration-150 ${
              isPlaying ? 'h-4 audio-eq-bar' : 'h-1.5 opacity-45'
            }`}
          />
          <span
            className={`w-1 rounded-full bg-[#FFE600] transition-all duration-150 ${
              isPlaying ? 'h-4 audio-eq-bar audio-eq-bar-delay-1' : 'h-2.5 opacity-45'
            }`}
          />
          <span
            className={`w-1 rounded-full bg-[#009EE3] transition-all duration-150 ${
              isPlaying ? 'h-4 audio-eq-bar audio-eq-bar-delay-2' : 'h-2 opacity-45'
            }`}
          />
          <span
            className={`w-1 rounded-full bg-[#FFE600] transition-all duration-150 ${
              isPlaying ? 'h-4 audio-eq-bar audio-eq-bar-delay-3' : 'h-1.5 opacity-45'
            }`}
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-200 leading-relaxed">
        Locução suave, clara e acolhedora confirmando o recebedor{' '}
        <strong className="font-semibold text-white">{PIX_PAYMENT_CONFIG.recipientName}</strong> e o
        banco <strong className="font-semibold text-white">{PIX_PAYMENT_CONFIG.bankName}</strong>,
        sem música de fundo ou efeitos sonoros.
      </p>

      {/* Native HTML5 audio element */}
      <audio
        ref={audioRef}
        src={hasAudioSource ? audioUrl : undefined}
        preload="metadata"
        playsInline
        aria-label="Locução de orientação para pagamento via Pix"
      />

      {/* Real PCM Waveform & Scrubber */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs font-mono tabular-nums text-sky-200 mb-2.5">
          <span>{formatAudioTime(currentTime)}</span>
          {metadata ? (
            <span className="text-[11px] text-slate-300 hidden sm:inline">
              WAV · {(metadata.sampleRate / 1000).toFixed(0)} kHz · {metadata.bitsPerSample}-bit · Mono ·{' '}
              {formatFileSize(metadata.fileSizeBytes)}
            </span>
          ) : null}
          <span>{duration > 0 ? formatAudioTime(duration) : '--:--'}</span>
        </div>

        {waveform.length > 0 && (
          <div
            role="presentation"
            onClick={(e) => {
              if (!hasAudioSource || duration <= 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              handleSeek(ratio * duration);
            }}
            className="mb-3 h-12 flex items-center gap-[3px] px-2 rounded-xl bg-[#041024]/75 border border-white/10 cursor-pointer"
          >
            {waveform.map((peak, index) => {
              const barPct = ((index + 0.5) / waveform.length) * 100;
              const isPassed = barPct <= progressPercentage;
              const heightPct = Math.max(14, Math.round(peak * 100));
              return (
                <span
                  key={index}
                  style={{ height: `${heightPct}%` }}
                  className={`flex-1 rounded-full transition-colors duration-100 ${
                    isPassed ? 'bg-[#FFE600]' : 'bg-[#009EE3]/45'
                  }`}
                />
              );
            })}
          </div>
        )}

        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 100}
          step={0.1}
          value={duration > 0 ? currentTime : 0}
          onChange={(e) => handleSeek(Number(e.target.value))}
          disabled={!hasAudioSource || duration <= 0}
          aria-label="Progresso da locução em áudio"
          style={{
            background: `linear-gradient(to right, #FFE600 ${progressPercentage}%, rgba(255,255,255,0.16) ${progressPercentage}%)`,
          }}
          className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed accent-[#FFE600] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE600] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081A3B]"
        />
      </div>

      {/* Primary Audio Controls + WAV Download */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {hasAudioSource ? (
          <button
            type="button"
            onClick={handlePlay}
            disabled={isPlaying || isBusy}
            className="col-span-2 sm:col-span-1 min-h-[46px] px-4 py-2.5 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer bg-gradient-to-r from-[#005EB8] to-[#009EE3] hover:brightness-110 text-white shadow-[0_10px_24px_-8px_rgba(0,158,227,0.55)] disabled:from-white/10 disabled:to-white/10 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009EE3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081A3B]"
          >
            {isBusy || isBuffering ? (
              <>
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />
                <span>{isGenerating ? 'Gerando' : 'Carregando'}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Reproduzir</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => generateAudio({ force: true })}
            disabled={isBusy}
            className="col-span-2 sm:col-span-1 min-h-[46px] px-4 py-2.5 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer bg-[#FFE600] hover:bg-[#FFD900] text-[#040E21] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE600] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081A3B]"
          >
            {isBusy ? (
              <>
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />
                <span>Gerando WAV</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Gerar WAV</span>
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={handlePause}
          disabled={!isPlaying || !hasAudioSource}
          className="min-h-[46px] px-4 py-2.5 rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer border border-white/20 bg-white/10 hover:bg-white/15 text-white disabled:bg-white/5 disabled:text-slate-400 disabled:border-white/10 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE600] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081A3B]"
        >
          <Pause className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Pausar</span>
        </button>

        <button
          type="button"
          onClick={handleRestart}
          disabled={!hasAudioSource || isBusy}
          className="min-h-[46px] px-4 py-2.5 rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer border border-white/20 bg-white/10 hover:bg-white/15 text-white disabled:bg-white/5 disabled:text-slate-400 disabled:border-white/10 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE600] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081A3B]"
        >
          <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Reiniciar</span>
        </button>

        {hasAudioSource ? (
          <a
            href="/api/audio/download"
            download="locucao-pix-carlos-henrique.wav"
            className="col-span-2 sm:col-span-1 min-h-[46px] px-4 py-2.5 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 bg-[#FFE600] hover:bg-[#FFD900] text-[#040E21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE600] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081A3B]"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Baixar WAV</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="col-span-2 sm:col-span-1 min-h-[46px] px-4 py-2.5 rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 border border-white/10 bg-white/5 text-slate-400 cursor-not-allowed"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Baixar WAV</span>
          </button>
        )}
      </div>

      {/* Status, Error, and Collapsible Script / Voice Options */}
      <div className="mt-6 pt-5 border-t border-white/10 space-y-4" aria-live="polite">
        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-2xl bg-amber-950/60 border border-amber-400/35 px-4 py-3.5 text-xs sm:text-sm text-amber-100"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#FFE600] shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => generateAudio({ force: true })}
              disabled={isBusy}
              className="px-3 py-1.5 rounded-lg bg-[#FFE600] text-[#040E21] font-display font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer hover:bg-[#FFD900]"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-sky-100/90 leading-relaxed">{statusMessage}</p>

            <button
              type="button"
              onClick={() => setShowStudioPanel((prev) => !prev)}
              aria-expanded={showStudioPanel}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FFE600] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
            >
              <span>Texto da locução e ajustes de voz</span>
              {showStudioPanel ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        )}

        {showStudioPanel && (
          <div className="pt-4 border-t border-white/10 space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-sky-200">
                  Texto exato gravado no arquivo locucao-pix-carlos-henrique.wav
                </p>
                {metadata && (
                  <p className="text-xs font-mono tabular-nums text-slate-300">
                    RMS {metadata.rmsDbfs} dBFS · Pico {metadata.peakDbfs} dBFS
                  </p>
                )}
              </div>
              <blockquote className="rounded-2xl bg-[#041024]/80 border border-white/10 p-4 text-sm text-slate-100 leading-relaxed whitespace-pre-line">
                {PIX_PAYMENT_CONFIG.voiceoverScript}
              </blockquote>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <label className="block">
                <span className="block text-xs font-semibold text-sky-200 mb-1.5">
                  Timbre feminino (pt-BR)
                </span>
                <select
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value as 'Kore' | 'Zephyr')}
                  disabled={isBusy}
                  className="w-full min-h-[44px] rounded-xl bg-[#041024] border border-white/20 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE600]"
                >
                  <option value="Kore">Kore — Suave e acolhedora</option>
                  <option value="Zephyr">Zephyr — Clara e expressiva</option>
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-sky-200 mb-1.5">
                  Motor de síntese
                </span>
                <select
                  value={model}
                  onChange={(e) =>
                    setModel(
                      e.target.value as 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts'
                    )
                  }
                  disabled={isBusy}
                  className="w-full min-h-[44px] rounded-xl bg-[#041024] border border-white/20 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE600]"
                >
                  <option value="gemini-3.8-flash-lite-tts">Flash Lite TTS (Locução clara)</option>
                  <option value="gemini-3.8-flash-tts">Flash TTS (Design de voz)</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() =>
                  generateAudio({
                    force: true,
                    selectedVoice: voiceName,
                    selectedModel: model,
                  })
                }
                disabled={isBusy}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#FFE600]/50 bg-[#FFE600]/10 hover:bg-[#FFE600]/20 text-[#FFE600] font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                    <span>Regenerando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Regenerar WAV</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
