"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Bluetooth, BluetoothOff } from "lucide-react";
import {
  BATTERY_LEVEL,
  BATTERY_SERVICE,
  HEART_RATE_MEASUREMENT,
  HEART_RATE_SERVICE,
  WHOOP_NO_PUBLIC_HR,
  WHOOP_PUBLIC_HR,
  explainBleError,
  heartRateRequestOptions,
  isPlausibleHr,
  isWhoopBandName,
  parseHeartRateMeasurement,
} from "@/lib/ble-hr";
import {
  loadBlePair,
  pickGrantedDevice,
  reconnectDelayMs,
  saveBlePair,
  setBleKeepAlive,
} from "@/lib/ble-pair";
import {
  loadBandLive,
  physiologyFromRr,
  saveBandLive,
  sessionRestHr,
} from "@/lib/band-live";
import {
  attachStandardVitals,
  detachVitalSubscriptions,
  type VitalSubscription,
} from "@/lib/ble-vitals";
import {
  appendNightPoint,
  loadNightLog,
  mergeOvernight,
  overnightProgress,
  saveNightLog,
  summarizeOvernight,
  type OvernightProgress,
  type OvernightSummary,
} from "@/lib/overnight";
import { formatHours } from "@/lib/format";
import { estimateBpmFromPpg, fingerLikelyOnLens, type PpgSample } from "@/lib/camera-hr";
import { describeHrSupport, readDevice, whoopGuideHref } from "@/lib/device";
import { aetherPageUrl, BLUEFY_APP_STORE, bluefyOpenHref } from "@/lib/ios-ble";
import { PUBLIC_SITE } from "@/lib/site";
import { useDevice } from "./DeviceChrome";

export type HrStatus = "off" | "connecting" | "live" | "camera" | "practice" | "error";

type HrValue = {
  bpm: number | null;
  rmssd: number | null;
  sdnn: number | null;
  restHr: number | null;
  batteryPct: number | null;
  rrCount: number;
  spo2: number | null;
  skinTempC: number | null;
  overnight: OvernightSummary | null;
  nightProgress: OvernightProgress | null;
  fromBand: boolean;
  status: HrStatus;
  message: string | null;
  deviceName: string | null;
  connect: (opts?: { scanAll?: boolean }) => Promise<void>;
  startCamera: () => Promise<void>;
  startPractice: () => void;
  disconnect: () => void;
};

const HrContext = createContext<HrValue | null>(null);

const LIVE_COPY =
  "Live Bluetooth on this phone. Public Heart Rate service: bpm, R-R/HRV when sent, battery if exposed. Standard pulse-ox and thermometer if this strap exposes them. Leave the page open overnight for Aether sleep from that stream.";

export function HeartRateProvider({ children }: { children: React.ReactNode }) {
  const [bpm, setBpm] = useState<number | null>(null);
  const [rmssd, setRmssd] = useState<number | null>(null);
  const [sdnn, setSdnn] = useState<number | null>(null);
  const [restHr, setRestHr] = useState<number | null>(null);
  const [batteryPct, setBatteryPct] = useState<number | null>(null);
  const [rrCount, setRrCount] = useState(0);
  const [spo2, setSpo2] = useState<number | null>(null);
  const [skinTempC, setSkinTempC] = useState<number | null>(null);
  const [overnight, setOvernight] = useState<OvernightSummary | null>(null);
  const [nightProgress, setNightProgress] = useState<OvernightProgress | null>(null);
  const [status, setStatus] = useState<HrStatus>("off");
  const [message, setMessage] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const onValueRef = useRef<((event: Event) => void) | null>(null);
  const simRef = useRef<number | null>(null);
  const wantLiveRef = useRef(false);
  const onDiscRef = useRef<(() => void) | null>(null);
  const onAdvRef = useRef<(() => void) | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const attachingRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const subscribeRef = useRef<(device: BluetoothDevice) => Promise<void>>(
    async () => {},
  );
  const bindRef = useRef<(device?: BluetoothDevice | null) => Promise<boolean>>(
    async () => false,
  );
  const rrWindowRef = useRef<number[]>([]);
  const bpmHistoryRef = useRef<number[]>([]);
  const restRef = useRef<number | null>(null);
  const lastSaveRef = useRef(0);
  const batteryRef = useRef<number | null>(null);
  const spo2Ref = useRef<number | null>(null);
  const skinTempRef = useRef<number | null>(null);
  const overnightRef = useRef<OvernightSummary | null>(null);
  const rmssdRef = useRef<number | null>(null);
  const extraSubsRef = useRef<VitalSubscription[]>([]);
  const cameraRef = useRef<{
    stream: MediaStream | null;
    raf: number | null;
    video: HTMLVideoElement | null;
  }>({ stream: null, raf: null, video: null });

  const stopPractice = useCallback(() => {
    if (simRef.current != null) {
      window.clearInterval(simRef.current);
      simRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    const cam = cameraRef.current;
    if (cam.raf != null) {
      window.cancelAnimationFrame(cam.raf);
      cam.raf = null;
    }
    cam.stream?.getTracks().forEach((track) => track.stop());
    cam.stream = null;
    if (cam.video) {
      cam.video.srcObject = null;
      cam.video.remove();
      cam.video = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const detachDevice = useCallback(() => {
    detachVitalSubscriptions(extraSubsRef.current);
    extraSubsRef.current = [];
    const characteristic = charRef.current;
    if (characteristic && onValueRef.current) {
      characteristic.removeEventListener(
        "characteristicvaluechanged",
        onValueRef.current,
      );
      try {
        void characteristic.stopNotifications();
      } catch {
        /* already gone */
      }
    }
    charRef.current = null;
    onValueRef.current = null;
    const device = deviceRef.current;
    if (device && onDiscRef.current) {
      device.removeEventListener("gattserverdisconnected", onDiscRef.current);
    }
    if (device && onAdvRef.current) {
      device.removeEventListener("advertisementreceived", onAdvRef.current);
    }
    onDiscRef.current = null;
    onAdvRef.current = null;
    try {
      device?.gatt?.disconnect();
    } catch {
      /* already gone */
    }
  }, []);

  const resetLiveStats = useCallback(() => {
    rrWindowRef.current = [];
    bpmHistoryRef.current = [];
    restRef.current = null;
  }, []);

  const persistSnapshot = useCallback(
    (patch: {
      bpm?: number | null;
      restHr?: number | null;
      rmssd?: number | null;
      sdnn?: number | null;
      rrCount?: number;
      batteryPct?: number | null;
      deviceName?: string | null;
      spo2?: number | null;
      skinTempC?: number | null;
      overnight?: OvernightSummary | null;
    }) => {
      const now = Date.now();
      if (now - lastSaveRef.current < 1200 && patch.overnight == null) return;
      lastSaveRef.current = now;
      const current = loadBandLive();
      saveBandLive({
        rmssd: patch.rmssd ?? current?.rmssd ?? null,
        sdnn: patch.sdnn ?? current?.sdnn ?? null,
        restHr: patch.restHr ?? current?.restHr ?? null,
        bpm: patch.bpm ?? current?.bpm ?? null,
        batteryPct: patch.batteryPct ?? batteryRef.current ?? current?.batteryPct ?? null,
        rrCount: patch.rrCount ?? current?.rrCount ?? 0,
        deviceName: patch.deviceName ?? deviceRef.current?.name ?? current?.deviceName ?? null,
        spo2: patch.spo2 ?? spo2Ref.current ?? current?.spo2 ?? null,
        skinTempC: patch.skinTempC ?? skinTempRef.current ?? current?.skinTempC ?? null,
        overnight: patch.overnight ?? overnightRef.current ?? current?.overnight ?? null,
        at: now,
      });
    },
    [],
  );

  const applyMeasurement = useCallback((data: DataView | undefined, at = Date.now()) => {
    if (!data) return;
    const sample = parseHeartRateMeasurement(data);
    if (!sample || !isPlausibleHr(sample.bpm)) return;
    setBpm(sample.bpm);
    bpmHistoryRef.current = [...bpmHistoryRef.current, sample.bpm].slice(-300);
    const quiet = sessionRestHr(bpmHistoryRef.current);
    if (quiet != null) {
      restRef.current = quiet;
      setRestHr(quiet);
    } else if (sample.bpm >= 38 && sample.bpm <= 90) {
      restRef.current =
        restRef.current == null ? sample.bpm : Math.min(restRef.current, sample.bpm);
      setRestHr(restRef.current);
    }
    if (sample.rrMs.length) {
      const next = [...rrWindowRef.current, ...sample.rrMs].slice(-96);
      rrWindowRef.current = next;
      const phys = physiologyFromRr(next);
      setRrCount(phys.rrCount);
      if (phys.rmssd != null) {
        rmssdRef.current = phys.rmssd;
        setRmssd(phys.rmssd);
      }
      if (phys.sdnn != null) setSdnn(phys.sdnn);
      persistSnapshot({
        bpm: sample.bpm,
        restHr: restRef.current,
        rmssd: phys.rmssd,
        sdnn: phys.sdnn,
        rrCount: phys.rrCount,
      });
    } else {
      persistSnapshot({ bpm: sample.bpm, restHr: restRef.current });
    }
    const logged = loadNightLog();
    const points = appendNightPoint(logged, {
      t: at,
      bpm: sample.bpm,
      rmssd: rmssdRef.current,
    });
    if (points !== logged) saveNightLog(points);
    const progress = overnightProgress(points);
    setNightProgress(progress.pointCount ? progress : null);
    const nextOvernight = mergeOvernight(
      overnightRef.current ?? loadBandLive()?.overnight ?? null,
      summarizeOvernight(points, at),
    );
    if (nextOvernight !== overnightRef.current) {
      overnightRef.current = nextOvernight;
      setOvernight(nextOvernight);
      persistSnapshot({ overnight: nextOvernight });
    }
  }, [persistSnapshot]);

  const subscribe = useCallback(
    async (device: BluetoothDevice) => {
      if (!device.gatt) throw new Error("No GATT on this device.");
      const server = await device.gatt.connect();
      let service;
      try {
        service = await server.getPrimaryService(HEART_RATE_SERVICE);
      } catch (err) {
        if (isWhoopBandName(device.name)) {
          throw new Error(WHOOP_NO_PUBLIC_HR);
        }
        throw err;
      }
      const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);
      const onValue = (event: Event) => {
        const target = event.target as unknown as BluetoothRemoteGATTCharacteristic & {
          _aetherAt?: number;
        };
        const at =
          typeof target._aetherAt === "number" && Number.isFinite(target._aetherAt)
            ? target._aetherAt
            : Date.now();
        applyMeasurement(target.value, at);
      };
      if (charRef.current && onValueRef.current) {
        charRef.current.removeEventListener(
          "characteristicvaluechanged",
          onValueRef.current,
        );
      }
      charRef.current = characteristic;
      onValueRef.current = onValue;
      characteristic.addEventListener("characteristicvaluechanged", onValue);
      await characteristic.startNotifications();
      try {
        applyMeasurement(await characteristic.readValue());
      } catch {
        /* notify-only straps */
      }
      try {
        const battery = await server.getPrimaryService(BATTERY_SERVICE);
        const level = await battery.getCharacteristic(BATTERY_LEVEL);
        const view = await level.readValue();
        const pct = view.getUint8(0);
        if (pct <= 100) {
          batteryRef.current = pct;
          setBatteryPct(pct);
        }
      } catch {
        /* battery is optional on the public profile */
      }
      detachVitalSubscriptions(extraSubsRef.current);
      extraSubsRef.current = await attachStandardVitals(server, {
        onSpo2: (value) => {
          spo2Ref.current = value;
          setSpo2(value);
          persistSnapshot({ spo2: value });
        },
        onSkinTempC: (value) => {
          skinTempRef.current = value;
          setSkinTempC(value);
          persistSnapshot({ skinTempC: value });
        },
      });
    },
    [applyMeasurement, persistSnapshot],
  );

  subscribeRef.current = subscribe;

  const liveCopyFor = useCallback((device: BluetoothDevice | null) => {
    return isWhoopBandName(device?.name) ? WHOOP_PUBLIC_HR : LIVE_COPY;
  }, []);

  const scheduleReconnect = useCallback((reason: string) => {
    if (!wantLiveRef.current) return;
    clearReconnectTimer();
    const delay = reconnectDelayMs(retriesRef.current);
    retriesRef.current += 1;
    setStatus("connecting");
    const label = deviceRef.current?.name || loadBlePair()?.name || "WHOOP";
    setMessage(`${reason} Keeping ${label} connected…`);
    reconnectTimerRef.current = window.setTimeout(() => {
      void bindRef.current(deviceRef.current);
    }, delay);
  }, [clearReconnectTimer]);

  const bindDevice = useCallback(
    async (incoming?: BluetoothDevice | null): Promise<boolean> => {
      if (!wantLiveRef.current || attachingRef.current) return false;
      attachingRef.current = true;
      try {
        let device = incoming ?? deviceRef.current;
        const nav = navigator as Navigator & { bluetooth?: Bluetooth };
        if (!device && nav.bluetooth?.getDevices) {
          const granted = await nav.bluetooth.getDevices();
          device = pickGrantedDevice(granted, loadBlePair());
        }
        if (!device) {
          if (!nav.bluetooth?.getDevices) {
            setStatus("connecting");
            setMessage(
              "Tap Connect WHOOP over Bluetooth once more to resume the saved band. After that, Aether keeps it linked.",
            );
            return false;
          }
          scheduleReconnect("Band not in range yet.");
          return false;
        }
        if (deviceRef.current && deviceRef.current.id !== device.id) {
          detachDevice();
          resetLiveStats();
        }
        deviceRef.current = device;
        setDeviceName(device.name || "HR strap");
        saveBlePair({
          id: device.id,
          name: device.name || null,
          keepAlive: true,
        });
        if (onDiscRef.current) {
          device.removeEventListener("gattserverdisconnected", onDiscRef.current);
        }
        const onDisc = () => {
          if (!wantLiveRef.current) return;
          scheduleReconnect("Link dropped.");
        };
        onDiscRef.current = onDisc;
        device.addEventListener("gattserverdisconnected", onDisc);
        if (device.watchAdvertisements) {
          const onAdv = () => {
            if (!wantLiveRef.current) return;
            if (device.gatt?.connected) return;
            void bindRef.current(device);
          };
          if (onAdvRef.current) {
            device.removeEventListener("advertisementreceived", onAdvRef.current);
          }
          onAdvRef.current = onAdv;
          device.addEventListener("advertisementreceived", onAdv);
          try {
            await device.watchAdvertisements();
          } catch {
            /* optional keep-alive signal */
          }
        }
        await subscribeRef.current(device);
        retriesRef.current = 0;
        clearReconnectTimer();
        setStatus("live");
        setMessage(
          `${liveCopyFor(device)} Aether keeps this band connected until you tap Disconnect.`,
        );
        return true;
      } catch {
        scheduleReconnect("Band not in range yet.");
        return false;
      } finally {
        attachingRef.current = false;
      }
    },
    [clearReconnectTimer, detachDevice, liveCopyFor, resetLiveStats, scheduleReconnect],
  );

  bindRef.current = bindDevice;

  const disconnect = useCallback(() => {
    wantLiveRef.current = false;
    retriesRef.current = 0;
    attachingRef.current = false;
    clearReconnectTimer();
    setBleKeepAlive(false);
    stopPractice();
    stopCamera();
    detachDevice();
    deviceRef.current = null;
    resetLiveStats();
    setBpm(null);
    setStatus("off");
    setMessage(
      "Live stream paused. HRV and resting HR from the band stay on this phone until you erase data.",
    );
  }, [clearReconnectTimer, detachDevice, resetLiveStats, stopCamera, stopPractice]);

  const connect = useCallback(
    async (opts?: { scanAll?: boolean; silent?: boolean }) => {
      const nav = navigator as Navigator & { bluetooth?: Bluetooth };
      if (!nav.bluetooth) {
        setStatus("error");
        setMessage(describeHrSupport(readDevice()));
        return;
      }
      stopPractice();
      stopCamera();
      wantLiveRef.current = true;
      setStatus("connecting");
      if (!opts?.scanAll && !opts?.silent) {
        const granted = nav.bluetooth.getDevices
          ? await nav.bluetooth.getDevices().catch(() => [])
          : [];
        const remembered = pickGrantedDevice(granted, loadBlePair());
        if (remembered) {
          setMessage(`Reconnecting ${remembered.name || "your band"}…`);
          const ok = await bindDevice(remembered);
          if (ok) return;
        }
      }
      if (opts?.silent) {
        await bindDevice(deviceRef.current);
        return;
      }
      setMessage("Pick your heart-rate strap in the Bluetooth list…");
      try {
        const device = await nav.bluetooth.requestDevice(
          heartRateRequestOptions(Boolean(opts?.scanAll)),
        );
        retriesRef.current = 0;
        await bindDevice(device);
      } catch (err) {
        if (loadBlePair()?.keepAlive) {
          scheduleReconnect("Picker closed. Still keeping the last band.");
          return;
        }
        wantLiveRef.current = false;
        setStatus("error");
        setMessage(explainBleError(err, true));
      }
    },
    [bindDevice, scheduleReconnect, stopCamera, stopPractice],
  );

  useEffect(() => {
    const savedPhys = loadBandLive();
    if (savedPhys) {
      if (savedPhys.rmssd != null) setRmssd(savedPhys.rmssd);
      if (savedPhys.sdnn != null) setSdnn(savedPhys.sdnn);
      if (savedPhys.restHr != null) setRestHr(savedPhys.restHr);
      if (savedPhys.batteryPct != null) {
        batteryRef.current = savedPhys.batteryPct;
        setBatteryPct(savedPhys.batteryPct);
      }
      if (savedPhys.rrCount) setRrCount(savedPhys.rrCount);
      if (savedPhys.deviceName) setDeviceName(savedPhys.deviceName);
      if (savedPhys.spo2 != null) {
        spo2Ref.current = savedPhys.spo2;
        setSpo2(savedPhys.spo2);
      }
      if (savedPhys.skinTempC != null) {
        skinTempRef.current = savedPhys.skinTempC;
        setSkinTempC(savedPhys.skinTempC);
      }
      if (savedPhys.overnight) {
        overnightRef.current = savedPhys.overnight;
        setOvernight(savedPhys.overnight);
      }
      if (savedPhys.rmssd != null) rmssdRef.current = savedPhys.rmssd;
    }
    const progress = overnightProgress(loadNightLog());
    if (progress.pointCount) setNightProgress(progress);
    const saved = loadBlePair();
    if (saved?.keepAlive) {
      wantLiveRef.current = true;
      setDeviceName(saved.name || "HR strap");
      setStatus("connecting");
      setMessage(`Reconnecting ${saved.name || "your WHOOP"}…`);
      void bindRef.current(null);
    }
    const resume = () => {
      if (!loadBlePair()?.keepAlive) return;
      wantLiveRef.current = true;
      void bindRef.current(deviceRef.current);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") resume();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      clearReconnectTimer();
    };
  }, [clearReconnectTimer]);

  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    if (status !== "live" && status !== "connecting") {
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
      return;
    }
    if (!nav.wakeLock) return;
    const lock = () => {
      if (document.visibilityState !== "visible") return;
      void nav.wakeLock
        ?.request("screen")
        .then((sentinel) => {
          wakeLockRef.current = sentinel;
        })
        .catch(() => undefined);
    };
    lock();
    document.addEventListener("visibilitychange", lock);
    return () => {
      document.removeEventListener("visibilitychange", lock);
    };
  }, [status]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setMessage("This browser cannot use the camera. Open Aether in Bluefy to pair the WHOOP instead.");
      return;
    }
    wantLiveRef.current = false;
    setBleKeepAlive(false);
    clearReconnectTimer();
    detachDevice();
    stopPractice();
    stopCamera();
    resetLiveStats();
    setDeviceName(null);
    setStatus("connecting");
    setMessage("Allow the camera, then cover the back lens with a fingertip.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 320 },
          height: { ideal: 240 },
        },
      });
      const track = stream.getVideoTracks()[0];
      try {
        await track.applyConstraints({
          advanced: [{ torch: true } as MediaTrackConstraintSet],
        });
      } catch {
        /* iPhone has no torch constraint; finger PPG still works */
      }
      const video = document.createElement("video");
      video.setAttribute("playsinline", "true");
      video.muted = true;
      video.autoplay = true;
      video.srcObject = stream;
      await video.play();
      cameraRef.current = { stream, raf: null, video };
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("No canvas");
      const samples: PpgSample[] = [];
      setStatus("camera");
      setMessage("Hold still with a fingertip over the back camera. This is optical pulse, not the WHOOP.");
      const loop = () => {
        if (!cameraRef.current.stream) return;
        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(video, 0, 0, 32, 32);
        const pix = ctx.getImageData(0, 0, 32, 32).data;
        let red = 0;
        let n = 0;
        for (let i = 0; i < pix.length; i += 4) {
          red += pix[i];
          n += 1;
        }
        const meanRed = red / n;
        const t = performance.now();
        if (fingerLikelyOnLens(meanRed)) {
          samples.push({ t, v: meanRed });
          while (samples[0] && t - samples[0].t > 8000) samples.shift();
          const next = estimateBpmFromPpg(samples, t);
          if (next != null) setBpm(next);
        }
        cameraRef.current.raf = window.requestAnimationFrame(loop);
      };
      cameraRef.current.raf = window.requestAnimationFrame(loop);
    } catch (err) {
      stopCamera();
      setStatus("error");
      const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
      if (name === "NotAllowedError") {
        setMessage("Camera permission was denied. Enable it in Settings, or open Aether in Bluefy to pair the WHOOP.");
        return;
      }
      setMessage("Could not start the camera. Open Aether in Bluefy to pair the WHOOP on this iPhone.");
    }
  }, [clearReconnectTimer, detachDevice, resetLiveStats, stopCamera, stopPractice]);

  const startPractice = useCallback(() => {
    wantLiveRef.current = false;
    setBleKeepAlive(false);
    clearReconnectTimer();
    detachDevice();
    stopCamera();
    stopPractice();
    resetLiveStats();
    setDeviceName(null);
    const origin = Date.now();
    const tick = () => {
      const t = (Date.now() - origin) / 1000;
      setBpm(Math.round(138 + 18 * Math.sin(t / 9) + 4 * Math.sin(t / 3)));
    };
    setStatus("practice");
    setMessage("Demo pulse — not your WHOOP and not the camera. Use Bluefy on iPhone to pair the band.");
    tick();
    simRef.current = window.setInterval(tick, 250);
  }, [clearReconnectTimer, detachDevice, resetLiveStats, stopCamera, stopPractice]);

  const value = useMemo(
    () => ({
      bpm,
      rmssd,
      sdnn,
      restHr,
      batteryPct,
      rrCount,
      spo2,
      skinTempC,
      overnight,
      nightProgress,
      fromBand: rmssd != null || restHr != null || spo2 != null || overnight != null,
      status,
      message,
      deviceName,
      connect,
      startCamera,
      startPractice,
      disconnect,
    }),
    [
      batteryPct,
      bpm,
      connect,
      deviceName,
      disconnect,
      message,
      nightProgress,
      overnight,
      restHr,
      rmssd,
      rrCount,
      sdnn,
      skinTempC,
      spo2,
      startCamera,
      startPractice,
      status,
    ],
  );

  return <HrContext.Provider value={value}>{children}</HrContext.Provider>;
}

export function useLiveHeartRate(): HrValue {
  const ctx = useContext(HrContext);
  if (!ctx) throw new Error("useLiveHeartRate must be used inside HeartRateProvider");
  return ctx;
}

export function LiveHeartRateButton() {
  const { bpm, status, connect } = useLiveHeartRate();
  const live = status === "live" || status === "camera";
  return (
    <button
      type="button"
      onClick={() => void connect()}
      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-paper"
    >
      {live ? <Bluetooth size={14} /> : <BluetoothOff size={14} />}
      {live
        ? `${bpm ?? "--"} bpm live`
        : status === "connecting"
          ? "Pairing…"
          : "Connect BT"}
    </button>
  );
}

function LiveStats({ hr }: { hr: HrValue }) {
  if (hr.status !== "live" && hr.status !== "camera" && !hr.fromBand) return null;
  return (
    <div className="mt-4">
      {(hr.status === "live" || hr.status === "camera") && (
        <p className="font-display text-5xl leading-none tracking-tight text-lime">
          {hr.bpm ?? "—"}
          <span className="ml-2 text-lg text-paper">
            bpm {hr.status === "camera" ? "camera" : "live"}
          </span>
        </p>
      )}
      {hr.deviceName && (
        <p className="mt-2 text-sm text-muted">{hr.deviceName}</p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <p className="rounded-2xl bg-black/20 px-3 py-2">
          <span className="block text-[10px] uppercase tracking-widest text-muted">HRV RMSSD</span>
          {hr.rmssd != null ? `${hr.rmssd} ms` : hr.status === "live" ? "Listening for R-R…" : "—"}
        </p>
        <p className="rounded-2xl bg-black/20 px-3 py-2">
          <span className="block text-[10px] uppercase tracking-widest text-muted">Resting HR</span>
          {hr.restHr != null ? `${hr.restHr} bpm` : hr.status === "live" ? "Sit still ~15s" : "—"}
        </p>
        <p className="rounded-2xl bg-black/20 px-3 py-2">
          <span className="block text-[10px] uppercase tracking-widest text-muted">HRV SDNN</span>
          {hr.sdnn != null ? `${hr.sdnn} ms` : "—"}
        </p>
        <p className="rounded-2xl bg-black/20 px-3 py-2">
          <span className="block text-[10px] uppercase tracking-widest text-muted">Battery</span>
          {hr.batteryPct != null ? `${hr.batteryPct}%` : "—"}
        </p>
        <p className="rounded-2xl bg-black/20 px-3 py-2">
          <span className="block text-[10px] uppercase tracking-widest text-muted">SpO2</span>
          {hr.spo2 != null ? `${hr.spo2.toFixed(1)}%` : "—"}
        </p>
        <p className="rounded-2xl bg-black/20 px-3 py-2">
          <span className="block text-[10px] uppercase tracking-widest text-muted">Skin temp</span>
          {hr.skinTempC != null ? `${hr.skinTempC.toFixed(1)}°C` : "—"}
        </p>
      </div>
      {hr.overnight ? (
        <p className="mt-3 text-sm text-paper/80">
          Aether sleep {formatHours(hr.overnight.restMs)}
          {hr.overnight.staged
            ? ` · deep ${formatHours(hr.overnight.deepMs)} · active ${formatHours(hr.overnight.activeMs)}`
            : ""}{" "}
          · Aether {hr.overnight.recovery}
          <span className="block text-xs text-muted">
            {hr.overnight.staged
              ? "Aether sleep from public heart rate and HRV. Not WHOOP REM / deep."
              : "Quiet vs active heart rate so far. Leave Aether connected for a full night to score Aether sleep."}
          </span>
        </p>
      ) : hr.nightProgress && hr.nightProgress.pointCount >= 8 ? (
        <p className="mt-3 text-sm text-paper/80">
          Logging night · {formatHours(hr.nightProgress.restMs)} quiet HR so far. Leave Aether open.
        </p>
      ) : null}
    </div>
  );
}

function IosWhoopPath() {
  const [href, setHref] = useState(PUBLIC_SITE);
  useEffect(() => {
    setHref(aetherPageUrl());
  }, []);
  return (
    <div className="mt-4 grid gap-2">
      <Link
        href="/download#ios-native"
        className="rounded-full bg-lime px-4 py-3 text-center text-sm font-medium text-ink"
      >
        Install Aether iPhone app — Bluetooth without Safari
      </Link>
      <a
        href={BLUEFY_APP_STORE}
        className="rounded-full border border-white/15 px-4 py-3 text-center text-sm"
      >
        No Mac? Use Bluefy (free) instead
      </a>
      <a
        href={bluefyOpenHref(href)}
        className="rounded-full border border-white/15 px-4 py-3 text-center text-sm"
      >
        Open this page in Bluefy
      </a>
      <p className="text-xs text-muted">
        Apple blocks Bluetooth in Safari and Chrome. There is no Safari
        loophole. The Aether iPhone app is our own wrapper: Core Bluetooth
        talks to the band, then loads this site. Bluefy is the fallback if you
        cannot install Xcode.
      </p>
    </div>
  );
}

export function BluetoothPanel({ compact = false }: { compact?: boolean }) {
  const hr = useLiveHeartRate();
  const device = useDevice();
  const live = hr.status === "live";
  const canBle = device.bluetooth;

  const actions = (
    <div className="mt-4 grid gap-2">
      {canBle ? (
        <>
          <button
            type="button"
            onClick={() => void hr.connect()}
            className="min-h-12 rounded-full bg-lime px-4 py-3 text-sm font-medium text-ink"
          >
            {live
              ? `${hr.bpm ?? "--"} bpm · stays connected`
              : hr.status === "connecting"
                ? "Keeping WHOOP connected…"
                : "Connect WHOOP over Bluetooth"}
          </button>
          <button
            type="button"
            onClick={() => void hr.connect({ scanAll: true })}
            className="min-h-12 rounded-full border border-white/15 px-4 py-3 text-sm"
          >
            Scan all devices
          </button>
        </>
      ) : (
        <IosWhoopPath />
      )}
      <button
        type="button"
        onClick={() => void hr.startCamera()}
        className="min-h-12 rounded-full border border-white/15 px-4 py-3 text-sm"
      >
        {hr.status === "camera" ? `${hr.bpm ?? "--"} bpm camera` : "Camera pulse"}
      </button>
      <button
        type="button"
        onClick={() => hr.startPractice()}
        className="min-h-12 rounded-full border border-white/15 px-4 py-3 text-sm"
      >
        {hr.status === "practice" ? `${hr.bpm ?? "--"} demo pulse` : "Demo pulse"}
      </button>
      {(live ||
        hr.status === "connecting" ||
        hr.status === "practice" ||
        hr.status === "camera") && (
        <button
          type="button"
          onClick={() => hr.disconnect()}
          className="min-h-12 rounded-full border border-white/15 px-4 py-3 text-sm"
        >
          Disconnect
        </button>
      )}
    </div>
  );

  if (compact) {
    return (
      <section
        id="whoop-connect"
        className="rounded-[28px] border border-lime/30 bg-lime/10 p-5"
      >
        <p className="text-xs uppercase tracking-widest text-lime">WHOOP</p>
        <h2 className="font-display mt-1 text-xl text-paper">Connect your band</h2>
        <p className="mt-2 text-sm text-paper/80">
          {device.nativeShell
            ? "This is the Aether iPhone app. Tap Connect — iOS Core Bluetooth talks to the band. Safari is not in the path. Leave the app open overnight to log Aether sleep from public heart rate."
            : canBle
            ? "Tap Connect once. Aether remembers the band and keeps it connected — including after you switch tabs or reopen the app. Leave this page open overnight for Aether sleep from public heart rate. SpO2 and skin temp appear only if the band exposes those standard Bluetooth services. If they stay blank, tap Connect once more so the browser can grant them."
            : "Safari cannot pair the band. Install the Aether iPhone app (Xcode on a Mac) so Bluetooth runs in our app. Bluefy is the no-Mac fallback. Camera pulse is optical bpm from this phone, not the WHOOP."}
        </p>
        <LiveStats hr={hr} />
        {hr.message && <p className="mt-3 text-xs text-muted">{hr.message}</p>}
        {actions}
        {!canBle && (
          <Link href={whoopGuideHref(device)} className="mt-3 block text-xs text-lime">
            iPhone WHOOP steps →
          </Link>
        )}
      </section>
    );
  }

  return (
    <section
      id="bluetooth"
      className="rounded-[28px] border border-white/8 bg-panel p-5"
    >
      <p className="text-xs uppercase tracking-widest text-muted">Connection</p>
      <h2 className="font-display mt-1 text-xl text-paper">Connect over Bluetooth</h2>
      <p className="mt-2 text-sm text-paper/80">
        Aether reads the public Bluetooth Heart Rate service: live bpm, R-R/HRV
        when the band sends it, and battery. It also asks for the standard
        pulse-oximeter and thermometer services. Polar, Garmin, and Wahoo
        straps use those profiles; WHOOP firmware usually does not. Leave this
        page connected overnight and Aether scores its own sleep from quiet vs
        active HR and HRV — wake, quiet, deep rest, active rest. Not WHOOP
        REM/deep. WHOOP’s own recovery score, official stages, and private
        SpO2/temp stay on their radio — this website cannot copy those packets.
      </p>
      <LiveStats hr={hr} />
      <ol className="mt-4 list-decimal space-y-1.5 pl-4 text-sm text-muted">
        {canBle ? (
          <>
            <li>Wear the WHOOP. Wake it. Phone Bluetooth on. Disconnect the official WHOOP app first — the band talks to one phone at a time.</li>
            <li>Tap Connect WHOOP over Bluetooth, pick WHOOP. Aether keeps that band connected until you tap Disconnect. Leave the page open overnight for Aether sleep.</li>
            <li>If the strap is missing, tap Scan all devices.</li>
          </>
        ) : (
          <>
            <li>On a Mac, open native/ios/AetherBand in Xcode, plug in this iPhone, press Run. That installs our Bluetooth app.</li>
            <li>Or install Bluefy and open Aether there — Safari and Chrome cannot pair.</li>
            <li>Disconnect the official WHOOP app, then Connect WHOOP over Bluetooth.</li>
          </>
        )}
      </ol>
      {hr.message && <p className="mt-3 text-xs text-muted">{hr.message}</p>}
      {actions}
    </section>
  );
}
