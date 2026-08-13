import React from "react";

const STORAGE_KEY = "sf_reading_mode";
type Preference = "auto" | "on" | "off";

function isNightHour(): boolean {
  const h = new Date().getHours();
  return h >= 21 || h < 6; // 9 PM – 6 AM local time
}

function loadPref(): Preference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "on" || v === "off" || v === "auto") return v;
  } catch {}
  return "auto";
}

function savePref(p: Preference) {
  try {
    localStorage.setItem(STORAGE_KEY, p);
  } catch {}
}

interface ReadingModeCtx {
  /** Whether the warm overlay is currently visible. */
  isActive: boolean;
  /** Current preference: "auto" | "on" | "off" */
  preference: Preference;
  /** True when auto-mode is active due to detected night-time. */
  isAutoNight: boolean;
  toggle: () => void;
}

const Ctx = React.createContext<ReadingModeCtx>({
  isActive: false,
  preference: "auto",
  isAutoNight: false,
  toggle: () => {},
});

export function ReadingModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pref, setPref] = React.useState<Preference>(loadPref);
  const [night, setNight] = React.useState(isNightHour);

  React.useEffect(() => {
    const tick = () => {
      const nowNight = isNightHour();
      setNight(nowNight);
      // Auto-reset "off" override once daytime begins so auto re-engages next night.
      if (!nowNight) {
        setPref((p) => {
          if (p === "off") {
            savePref("auto");
            return "auto";
          }
          return p;
        });
      }
    };

    // Align the first tick to the top of the next minute.
    const msUntilNextMinute =
      (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
    const firstTimeout = setTimeout(() => {
      tick();
      const id = setInterval(tick, 60_000);
      return () => clearInterval(id);
    }, msUntilNextMinute);

    return () => clearTimeout(firstTimeout);
  }, []);

  const isAutoNight = pref === "auto" && night;
  const isActive = pref === "on" || isAutoNight;

  const toggle = React.useCallback(() => {
    setPref((p) => {
      const next: Preference = isActive ? "off" : "on";
      savePref(next);
      return next;
    });
  }, [isActive]);

  const value = React.useMemo(
    () => ({ isActive, preference: pref, isAutoNight, toggle }),
    [isActive, pref, isAutoNight, toggle],
  );

  return React.createElement(Ctx.Provider, { value }, children);
}

export function useReadingMode(): ReadingModeCtx {
  return React.useContext(Ctx);
}
