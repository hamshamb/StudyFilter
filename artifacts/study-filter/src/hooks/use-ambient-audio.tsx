import { useCallback, useEffect, useRef, useState } from "react";

export type AmbientSoundId =
  | "rain"
  | "brown_noise"
  | "white_noise"
  | "pink_noise"
  | "ocean";

export const AMBIENT_SOUNDS: { id: AmbientSoundId; label: string }[] = [
  { id: "rain", label: "Rain" },
  { id: "brown_noise", label: "Brown noise" },
  { id: "white_noise", label: "White noise" },
  { id: "pink_noise", label: "Pink noise" },
  { id: "ocean", label: "Ocean" },
];

const PREFS_KEY = "sf_ambient_prefs";

interface AmbientPrefs {
  layers: AmbientSoundId[];
  volume: number;
  muted: boolean;
}

function loadPrefs(): AmbientPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as AmbientPrefs;
      if (Array.isArray(p.layers) && typeof p.volume === "number") {
        return { layers: p.layers.slice(0, 2), volume: p.volume, muted: !!p.muted };
      }
    }
  } catch {
    /* ignore */
  }
  return { layers: [], volume: 0.5, muted: false };
}

function makeNoiseBuffer(ctx: AudioContext, kind: "white" | "pink" | "brown"): AudioBuffer {
  const seconds = 4;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  if (kind === "white") {
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  } else if (kind === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buffer;
}

interface LayerNodes {
  source: AudioBufferSourceNode;
  gain: GainNode;
  extras: AudioNode[];
  lfo?: OscillatorNode;
}

function buildLayer(ctx: AudioContext, id: AmbientSoundId, master: GainNode): LayerNodes {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(master);
  const extras: AudioNode[] = [];
  let kind: "white" | "pink" | "brown" = "white";
  let lfo: OscillatorNode | undefined;

  if (id === "white_noise") kind = "white";
  else if (id === "pink_noise") kind = "pink";
  else kind = "brown";

  const source = ctx.createBufferSource();
  source.buffer = makeNoiseBuffer(ctx, id === "rain" ? "pink" : kind);
  source.loop = true;

  let head: AudioNode = source;

  if (id === "rain") {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 400;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 7000;
    head.connect(hp);
    hp.connect(lp);
    head = lp;
    extras.push(hp, lp);
  } else if (id === "ocean") {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    head.connect(lp);
    head = lp;
    extras.push(lp);
    // slow swell
    lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
    extras.push(lfoGain);
  }

  head.connect(gain);
  source.start();
  return { source, gain, extras, lfo };
}

export function useAmbientAudio() {
  const [prefs, setPrefs] = useState<AmbientPrefs>(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const layersRef = useRef<Map<AmbientSoundId, LayerNodes>>(new Map());
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = prefs.muted ? 0 : prefs.volume;
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }
    if (ctxRef.current.state === "suspended") {
      void ctxRef.current.resume();
    }
    return { ctx: ctxRef.current, master: masterRef.current! };
  }, [prefs.muted, prefs.volume]);

  const syncLayers = useCallback(
    (layers: AmbientSoundId[]) => {
      const { ctx, master } = ensureContext();
      const map = layersRef.current;
      for (const [id, nodes] of map) {
        if (!layers.includes(id)) {
          nodes.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
          const s = nodes.source;
          const l = nodes.lfo;
          setTimeout(() => {
            try {
              s.stop();
              l?.stop();
            } catch {
              /* already stopped */
            }
          }, 700);
          map.delete(id);
        }
      }
      for (const id of layers) {
        if (!map.has(id)) {
          const nodes = buildLayer(ctx, id, master);
          const target = id === "ocean" ? 0.5 : 0.8;
          nodes.gain.gain.linearRampToValueAtTime(target, ctx.currentTime + 1.2);
          map.set(id, nodes);
        }
      }
      setPlaying(layers.length > 0);
    },
    [ensureContext],
  );

  const toggleLayer = useCallback(
    (id: AmbientSoundId) => {
      const p = prefsRef.current;
      const has = p.layers.includes(id);
      const layers = has
        ? p.layers.filter((l) => l !== id)
        : [...p.layers.slice(-1), id];
      syncLayers(layers);
      setPrefs({ ...p, layers });
    },
    [syncLayers],
  );

  const stopAll = useCallback(() => {
    syncLayers([]);
    setPrefs({ ...prefsRef.current, layers: [] });
  }, [syncLayers]);

  const setVolume = useCallback((volume: number) => {
    const p = prefsRef.current;
    if (!p.muted && masterRef.current && ctxRef.current) {
      masterRef.current.gain.linearRampToValueAtTime(
        volume,
        ctxRef.current.currentTime + 0.1,
      );
    }
    setPrefs({ ...p, volume });
  }, []);

  const toggleMute = useCallback(() => {
    const p = prefsRef.current;
    const muted = !p.muted;
    if (masterRef.current && ctxRef.current) {
      masterRef.current.gain.linearRampToValueAtTime(
        muted ? 0 : p.volume,
        ctxRef.current.currentTime + 0.1,
      );
    }
    setPrefs({ ...p, muted });
  }, []);

  useEffect(
    () => () => {
      for (const nodes of layersRef.current.values()) {
        try {
          nodes.source.stop();
          nodes.lfo?.stop();
        } catch {
          /* ignore */
        }
      }
      layersRef.current.clear();
      void ctxRef.current?.close();
      ctxRef.current = null;
    },
    [],
  );

  return {
    layers: prefs.layers,
    volume: prefs.volume,
    muted: prefs.muted,
    playing,
    toggleLayer,
    stopAll,
    setVolume,
    toggleMute,
  };
}
