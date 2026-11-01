/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RecordingState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'RECORDING'
  | 'PAUSED'
  | 'FINALIZING'
  | 'TRANSCRIBING'
  | 'COMPLETED'
  | 'ERROR';

export interface AudioChunkMeta {
  index: number;
  blob: Blob;
  size: number;
  timestamp: number;
}

export interface AudioRecorderEvents {
  onStateChange: (state: RecordingState) => void;
  onTimeUpdate: (elapsedSeconds: number) => void;
  onAudioLevel: (level: number, frequencyData: Uint8Array) => void;
  onError: (message: string) => void;
  onInterimSpeech?: (text: string) => void;
}

/**
 * Dynamically detects supported recording MIME type across modern browsers
 */
export function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return '';
  }
  const candidateTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];
  for (const type of candidateTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

/**
 * Robust continuous audio recording engine:
 * - Silence for 5s, 30s, 5m, 15m, 30m does NOT stop recording
 * - AudioContext + AnalyserNode provides real audio levels
 * - Chunks audio progressively
 * - Supports clean pause, resume, cancel, and finalize
 */
export class ContinuousAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;

  private state: RecordingState = 'IDLE';
  private mimeType: string = '';
  private chunks: AudioChunkMeta[] = [];
  private chunkIndexCounter: number = 0;
  private sessionId: string = '';

  private elapsedSeconds: number = 0;
  private activeStartTime: number = 0;
  private accumulatedElapsedMs: number = 0;

  // Web Speech API for visual interim feedback only (NEVER terminates recording)
  private speechRecognition: any = null;

  constructor(private events: AudioRecorderEvents) {}

  public getState(): RecordingState {
    return this.state;
  }

  public getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  public getMimeType(): string {
    return this.mimeType;
  }

  public async start(): Promise<void> {
    if (this.state === 'RECORDING' || this.state === 'PAUSED') {
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      this.transitionState('ERROR');
      this.events.onError('Voice recording is not supported in this browser.');
      return;
    }

    this.transitionState('REQUESTING_PERMISSION');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      this.transitionState('ERROR');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.events.onError('Microphone permission denied. Allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        this.events.onError('Microphone unavailable. Check your device and try again.');
      } else {
        this.events.onError('Microphone access was interrupted. Reconnect it to continue recording.');
      }
      return;
    }

    this.mimeType = getSupportedAudioMimeType();
    this.sessionId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.chunks = [];
    this.chunkIndexCounter = 0;
    this.accumulatedElapsedMs = 0;
    this.elapsedSeconds = 0;
    this.events.onTimeUpdate(0);

    try {
      const options: MediaRecorderOptions = this.mimeType ? { mimeType: this.mimeType } : {};
      this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
    } catch (recorderErr) {
      try {
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
      } catch (fallbackErr) {
        this.cleanup();
        this.transitionState('ERROR');
        this.events.onError('This audio format is not supported. Please try again.');
        return;
      }
    }

    this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push({
          index: this.chunkIndexCounter++,
          blob: e.data,
          size: e.data.size,
          timestamp: Date.now(),
        });
      }
    };

    this.mediaRecorder.onerror = (e: Event) => {
      console.warn('MediaRecorder error event:', e);
      this.events.onError('Recording was interrupted. Your previously saved audio is being preserved where possible.');
    };

    // Set up Web Audio Analyser for real microphone volume
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioContext = new AudioCtxClass();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 64;
        this.analyserNode.smoothingTimeConstant = 0.8;
        source.connect(this.analyserNode);

        const freqData = new Uint8Array(this.analyserNode.frequencyBinCount);
        const updateAudioLevel = () => {
          if (this.state === 'RECORDING' && this.analyserNode) {
            this.analyserNode.getByteFrequencyData(freqData);
            let sum = 0;
            for (let i = 0; i < freqData.length; i++) {
              sum += freqData[i];
            }
            const average = sum / freqData.length;
            const normalizedLevel = Math.min(1, Math.max(0, average / 128));
            this.events.onAudioLevel(normalizedLevel, freqData);
          }
          this.animationFrameId = requestAnimationFrame(updateAudioLevel);
        };
        this.animationFrameId = requestAnimationFrame(updateAudioLevel);
      }
    } catch (acErr) {
      console.warn('AudioContext visualization setup notice:', acErr);
    }

    // Optional browser speech recognition for live interim transcription feedback
    this.initSpeechRecognition();

    // Start recording with 2000ms timeslices for smooth progressive chunking
    this.mediaRecorder.start(2000);
    this.activeStartTime = performance.now();
    this.startTimer();
    this.transitionState('RECORDING');
  }

  public pause(): void {
    if (this.state !== 'RECORDING') return;

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        this.mediaRecorder.pause();
      } catch (e) {
        console.warn('Pause notice:', e);
      }
    }

    // Accumulate elapsed time up to pause
    this.accumulatedElapsedMs += performance.now() - this.activeStartTime;
    this.stopTimer();

    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch {}
    }

    this.transitionState('PAUSED');
  }

  public resume(): void {
    if (this.state !== 'PAUSED') return;

    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      try {
        this.mediaRecorder.resume();
      } catch (e) {
        console.warn('Resume notice:', e);
      }
    }

    this.activeStartTime = performance.now();
    this.startTimer();
    this.initSpeechRecognition();
    this.transitionState('RECORDING');
  }

  public cancel(): void {
    this.cleanup();
    this.chunks = [];
    this.transitionState('IDLE');
  }

  public async finish(): Promise<Blob | null> {
    if (this.state === 'IDLE' || this.state === 'FINALIZING') {
      return null;
    }

    this.transitionState('FINALIZING');
    this.stopTimer();

    return new Promise<Blob | null>((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        const combined = this.assembleBlob();
        this.cleanup();
        this.transitionState('COMPLETED');
        resolve(combined);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const combined = this.assembleBlob();
        this.cleanup();
        this.transitionState('COMPLETED');
        resolve(combined);
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        const combined = this.assembleBlob();
        this.cleanup();
        this.transitionState('COMPLETED');
        resolve(combined);
      }
    });
  }

  private assembleBlob(): Blob | null {
    if (this.chunks.length === 0) {
      return null;
    }
    const blobParts = this.chunks.sort((a, b) => a.index - b.index).map((c) => c.blob);
    const chosenType = this.mimeType || this.chunks[0].blob.type || 'audio/webm';
    return new Blob(blobParts, { type: chosenType });
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerIntervalId = setInterval(() => {
      const currentSpanMs = performance.now() - this.activeStartTime;
      const totalSeconds = Math.floor((this.accumulatedElapsedMs + currentSpanMs) / 1000);
      if (totalSeconds !== this.elapsedSeconds) {
        this.elapsedSeconds = totalSeconds;
        this.events.onTimeUpdate(totalSeconds);
      }
    }, 250);
  }

  private stopTimer(): void {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  private initSpeechRecognition(): void {
    try {
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        this.speechRecognition = new SpeechRecognitionClass();
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = 'en-US';

        this.speechRecognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            interim += event.results[i][0].transcript;
          }
          if (interim && this.events.onInterimSpeech) {
            this.events.onInterimSpeech(interim);
          }
        };

        this.speechRecognition.onerror = () => {
          // Ignore speech recognition errors; MediaRecorder audio remains authoritative!
        };

        this.speechRecognition.onend = () => {
          // If still recording, restart speech recognition without ending audio capture
          if (this.state === 'RECORDING') {
            try {
              this.speechRecognition.start();
            } catch {}
          }
        };

        this.speechRecognition.start();
      }
    } catch {}
  }

  private cleanup(): void {
    this.stopTimer();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch {}
      this.speechRecognition = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.mediaRecorder = null;
    this.analyserNode = null;
  }

  private transitionState(newState: RecordingState): void {
    this.state = newState;
    this.events.onStateChange(newState);
  }
}
