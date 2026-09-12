"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bluetooth, BluetoothOff } from "lucide-react";
import {
  HEART_RATE_MEASUREMENT,
  HEART_RATE_SERVICE,
  WHOOP_BAND_REFUSAL,
  explainBleError,
  heartRateRequestOptions,
  isPlausibleHr,
  isWhoopBandName,
  parseHeartRate,
} from "@/lib/ble-hr";
import { describeHrSupport, readDevice } from "@/lib/device";
import { useDevice } from "./DeviceChrome";

export type HrStatus = "off" | "connecting" | "live" | "practice" | "error";

type HrValue = {
  bpm: number | null;
  status: HrStatus;
  message: string | null;
  deviceName: string | null;
  connect: (opts?: { scanAll?: boolean }) => Promise<void>;
  startPractice: () => void;
  disconnect: () => void;
};

const HrContext = createContext<HrValue | null>(null);

const LIVE_COPY = "Live Bluetooth on this phone. Aether does not use the WHOOP cloud.";

export function HeartRateProvider({ children }: { children: React.ReactNode }) {
  const [bpm, setBpm] = useState<number | null>(null);
  const [status, setStatus] = useState<HrStatus>("off");
  const [message, setMessage] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const onValueRef = useRef<((event: Event) => void) | null>(null);
  const simRef = useRef<number | null>(null);
  const wantLiveRef = useRef(false);
  const onDiscRef = useRef<(() => void) | null>(null);
  const retriesRef = useRef(0);

  const applySample = useCallback((data: DataView | undefined) => {
    if (!data) return;
    const next = parseHeartRate(data);
    if (next != null && isPlausibleHr(next)) setBpm(next);
  }, []);

  const stopPractice = useCallback(() => {
    if (simRef.current != null) {
      window.clearInterval(simRef.current);
      simRef.current = null;
    }
  }, []);

  const detachDevice = useCallback(() => {
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
    onDiscRef.current = null;
    try {
      device?.gatt?.disconnect();
    } catch {
      /* already gone */
    }
    deviceRef.current = null;
  }, []);

  const subscribe = useCallback(
    async (device: BluetoothDevice) => {
      if (!device.gatt) throw new Error("No GATT on this device.");
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(HEART_RATE_SERVICE);
      const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);
      const onValue = (event: Event) => {
        const target = event.target as unknown as BluetoothRemoteGATTCharacteristic;
        applySample(target.value);
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
        applySample(await characteristic.readValue());
      } catch {
        /* notify-only straps */
      }
    },
    [applySample],
  );

  const disconnect = useCallback(() => {
    wantLiveRef.current = false;
    retriesRef.current = 0;
    stopPractice();
    detachDevice();
    setBpm(null);
    setDeviceName(null);
    setStatus("off");
    setMessage(null);
  }, [detachDevice, stopPractice]);

  const connect = useCallback(
    async (opts?: { scanAll?: boolean }) => {
      const nav = navigator as Navigator & { bluetooth?: Bluetooth };
      if (!nav.bluetooth) {
        setStatus("error");
        setMessage(describeHrSupport(readDevice()));
        return;
      }
      stopPractice();
      wantLiveRef.current = true;
      setStatus("connecting");
      setMessage("Pick your heart-rate strap in the Bluetooth list…");
      try {
        const device = await nav.bluetooth.requestDevice(
          heartRateRequestOptions(Boolean(opts?.scanAll)),
        );
        if (isWhoopBandName(device.name)) {
          wantLiveRef.current = false;
          detachDevice();
          try {
            device.gatt?.disconnect();
          } catch {
            /* never subscribed */
          }
          setStatus("error");
          setMessage(WHOOP_BAND_REFUSAL);
          return;
        }
        detachDevice();
        deviceRef.current = device;
        setDeviceName(device.name || "HR strap");
        retriesRef.current = 0;
        const onDisc = () => {
          if (!wantLiveRef.current) return;
          setStatus("connecting");
          setMessage("Strap dropped — reconnecting live…");
          window.setTimeout(() => {
            if (!wantLiveRef.current || !deviceRef.current) return;
            retriesRef.current += 1;
            if (retriesRef.current > 6) {
              setStatus("error");
              setMessage("Strap disconnected. Pair again.");
              return;
            }
            void subscribe(deviceRef.current)
              .then(() => {
                setStatus("live");
                setMessage(LIVE_COPY);
              })
              .catch((err) => {
                setStatus("error");
                setMessage(explainBleError(err, true));
              });
          }, 700);
        };
        onDiscRef.current = onDisc;
        device.addEventListener("gattserverdisconnected", onDisc);
        await subscribe(device);
        setStatus("live");
        setMessage(LIVE_COPY);
      } catch (err) {
        wantLiveRef.current = false;
        setStatus("error");
        setMessage(explainBleError(err, true));
      }
    },
    [detachDevice, stopPractice, subscribe],
  );

  const startPractice = useCallback(() => {
    wantLiveRef.current = false;
    detachDevice();
    stopPractice();
    setDeviceName(null);
    const origin = Date.now();
    const tick = () => {
      const t = (Date.now() - origin) / 1000;
      setBpm(Math.round(138 + 18 * Math.sin(t / 9) + 4 * Math.sin(t / 3)));
    };
    setStatus("practice");
    setMessage("Practice pulse — not Bluetooth. Use this on iPhone, where Safari has no live HR.");
    tick();
    simRef.current = window.setInterval(tick, 250);
  }, [detachDevice, stopPractice]);

  const value = useMemo(
    () => ({
      bpm,
      status,
      message,
      deviceName,
      connect,
      startPractice,
      disconnect,
    }),
    [bpm, status, message, deviceName, connect, startPractice, disconnect],
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
  const live = status === "live";
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

export function BluetoothPanel() {
  const hr = useLiveHeartRate();
  const device = useDevice();
  const live = hr.status === "live";

  return (
    <section
      id="bluetooth"
      className="rounded-[28px] border border-white/8 bg-panel p-5"
    >
      <p className="text-xs uppercase tracking-widest text-muted">Connection</p>
      <h2 className="font-display mt-1 text-xl text-paper">Connect over Bluetooth</h2>
      <p className="mt-2 text-sm text-paper/80">
        This is the only way Aether connects. No WHOOP login, no WHOOP cloud.
        Live bpm is a standard Bluetooth heart-rate strap (Polar, Garmin, Wahoo)
        on this device. The WHOOP band cannot stream here.
      </p>
      {live && (
        <p className="font-display mt-4 text-5xl leading-none tracking-tight text-lime">
          {hr.bpm ?? "—"}
          <span className="ml-2 text-lg text-paper">bpm live</span>
        </p>
      )}
      {hr.deviceName && live && (
        <p className="mt-2 text-sm text-muted">{hr.deviceName}</p>
      )}
      <ol className="mt-4 list-decimal space-y-1.5 pl-4 text-sm text-muted">
        <li>Install Aether on the phone (home-screen icon), then open that icon.</li>
        <li>Put on a Polar / Garmin / Wahoo strap. Wake it. Turn phone Bluetooth on.</li>
        <li>Tap Connect over Bluetooth, pick the strap, keep this screen open.</li>
        {device.ios ? (
          <li>iPhone Safari cannot pair Bluetooth HR. Use Android Chrome, or Practice pulse here.</li>
        ) : (
          <li>If the strap is missing from the list, tap Scan all devices.</li>
        )}
      </ol>
      {hr.message && <p className="mt-3 text-xs text-muted">{hr.message}</p>}
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={() => void hr.connect()}
          className="rounded-full bg-lime px-4 py-3 text-sm font-medium text-ink"
        >
          {live
            ? `${hr.bpm ?? "--"} bpm · tap to re-pair`
            : hr.status === "connecting"
              ? "Look at the Bluetooth picker…"
              : "Connect over Bluetooth"}
        </button>
        {!device.ios && (
          <button
            type="button"
            onClick={() => void hr.connect({ scanAll: true })}
            className="rounded-full border border-white/15 px-4 py-3 text-sm"
          >
            Scan all devices
          </button>
        )}
        <button
          type="button"
          onClick={() => hr.startPractice()}
          className="rounded-full border border-white/15 px-4 py-3 text-sm"
        >
          {hr.status === "practice" ? `${hr.bpm ?? "--"} practice` : "Practice pulse"}
        </button>
        {(live || hr.status === "practice") && (
          <button
            type="button"
            onClick={() => hr.disconnect()}
            className="rounded-full border border-white/15 px-4 py-3 text-sm"
          >
            Disconnect
          </button>
        )}
      </div>
    </section>
  );
}
