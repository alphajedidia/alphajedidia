// The one shared AudioContext of the app (player + keypad preview), created lazily.
// Mobile browsers start it "suspended" (or iOS "interrupted"): it must be resumed from a
// user gesture, which is why resumeAudio() calls resume() synchronously.

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

const RESUME_TIMEOUT_MS = 1500;

let shared: AudioContext | null = null;
let unlocked = false;

function getCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** True when the browser has the Web Audio API. */
export function isAudioSupported(): boolean {
  return getCtor() !== null;
}

/** The shared AudioContext (created on first call). Throws if Web Audio is missing. */
export function getAudioContext(): AudioContext {
  if (shared && shared.state !== 'closed') return shared;
  const Ctor = getCtor();
  if (!Ctor) throw new Error('Web Audio API is not available in this browser');
  try {
    shared = new Ctor({ latencyHint: 'interactive' });
  } catch {
    // Very old WebKit constructors take no options.
    shared = new Ctor();
  }
  unlocked = false;
  return shared;
}

/** iOS 16.4+: play even when the ring/silent switch is on (the user pressed Play). */
function preferPlaybackSession(): void {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as unknown as { audioSession?: { type: string } };
  if (!nav.audioSession || nav.audioSession.type === 'playback') return;
  try {
    nav.audioSession.type = 'playback';
  } catch {
    // Not settable on this browser: ignore.
  }
}

/** Old iOS only starts audio after a buffer was played inside a user gesture. */
function playSilentBuffer(ctx: AudioContext): void {
  if (unlocked) return;
  unlocked = true;
  try {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    src.connect(ctx.destination);
    src.start(0);
    src.onended = () => src.disconnect();
  } catch {
    // Harmless: resume() alone is enough on current browsers.
  }
}

/**
 * Make sure the context runs. Call it from a user gesture (tap/click): resume() is invoked
 * synchronously so the gesture still counts. Never rejects; gives up waiting after 1.5 s
 * (playback then starts as soon as the browser lets the context run).
 */
export function resumeAudio(ctx: AudioContext = getAudioContext()): Promise<void> {
  preferPlaybackSession();
  playSilentBuffer(ctx);
  if (ctx.state === 'running') return Promise.resolve();
  const resumed = ctx.resume().then(
    () => undefined,
    () => undefined,
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, RESUME_TIMEOUT_MS));
  return Promise.race([resumed, timeout]);
}

/** Warm up audio from any user gesture (e.g. the first tap in the app). Safe to call often. */
export function unlockAudio(): Promise<void> {
  if (!isAudioSupported()) return Promise.resolve();
  return resumeAudio(getAudioContext());
}
