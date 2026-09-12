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
import { describeHrSupport, readDevice } from "@/lib/device";

function parseHeartRate(data: DataView): number | null {
  if (data.byteLength < 2) return null;
  const flags = data.getUint8(0);
  if (flags & 0x1) {
    if (data.byteLength < 3) return null;
    return data.getUint16(1, true);
  }
  return data.getUint8(1);
}

export type HrStatus = "off" | "live" | "practice" | "error";

type HrValue = {
  bpm: number | null;
  status: HrStatus;
  message: string | null;
  connect: () => Promise<void>;
  startPractice: () => void;
  disconnect: () => void;
};

const HrContext = createContext<HrValue | null>(null);

export function HeartRateProvider({ children }: { children: React.ReactNode }) {
  const [bpm, setBpm] = useState<number | null>(null);
  const [status, setStatus] = useState<HrStatus>("off");
  const [message, setMessage] = useState<string | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const simRef = useRef<number | null>(null);
  const wantLiveRef = useRef(false);
  const onDiscRef = useRef<(() => void) | null>(null);

  const stopPractice = useCallback(() => {
    if (simRef.current != null) {
      window.clearInterval(simRef.current);
      simRef.current = null;
    }
  }, []);

  const detachDevice = useCallback(() => {
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

  const subscribe = useCallback(async (device: BluetoothDevice) => {
    const server = await device.gatt?.connect();
    const service = await server?.getPrimaryService("heart_rate");
    const characteristic = await service?.getCharacteristic("heart_rate_measurement");
    await characteristic?.startNotifications();
    characteristic?.addEventListener("characteristicvaluechanged", (event) => {
      const target = event.target as unknown as BluetoothRemoteGATTCharacteristic;
      if (!target.value) return;
      const next = parseHeartRate(target.value);
      if (next != null && next > 20 && next < 240) setBpm(next);
    });
  }, []);

  const disconnect = useCallback(() => {
    wantLiveRef.current = false;
    stopPractice();
    detachDevice();
    setBpm(null);
    setStatus("off");
    setMessage(null);
  }, [detachDevice, stopPractice]);

  const connect = useCallback(async () => {
    const nav = navigator as Navigator & { bluetooth?: Bluetooth };
    if (!nav.bluetooth) {
      setStatus("error");
      setMessage(describeHrSupport(readDevice()));
      return;
    }
    stopPractice();
    wantLiveRef.current = true;
    try {
      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: ["heart_rate"] }],
      });
      detachDevice();
      deviceRef.current = device;
      const onDisc = () => {
        if (!wantLiveRef.current) return;
        setMessage("Strap dropped — reconnecting…");
        window.setTimeout(() => {
          if (!wantLiveRef.current || !deviceRef.current) return;
          void subscribe(deviceRef.current)
            .then(() => {
              setStatus("live");
              setMessage("Standard HR strap (GATT Heart Rate). WHOOP band is not this profile.");
            })
            .catch(() => {
              setStatus("error");
              setMessage("Strap disconnected. Pair again.");
            });
        }, 800);
      };
      onDiscRef.current = onDisc;
      device.addEventListener("gattserverdisconnected", onDisc);
      await subscribe(device);
      setStatus("live");
      setMessage("Standard HR strap (GATT Heart Rate). WHOOP band is not this profile.");
    } catch {
      wantLiveRef.current = false;
      setStatus("error");
      setMessage("Pairing cancelled or the strap is not in range.");
    }
  }, [detachDevice, stopPractice, subscribe]);

  const startPractice = useCallback(() => {
    wantLiveRef.current = false;
    detachDevice();
    stopPractice();
    const origin = Date.now();
    const tick = () => {
      const t = (Date.now() - origin) / 1000;
      setBpm(Math.round(138 + 18 * Math.sin(t / 9) + 4 * Math.sin(t / 3)));
    };
    setStatus("practice");
    setMessage("Practice pulse — not a strap. For rehearsal when Bluetooth is unavailable.");
    tick();
    simRef.current = window.setInterval(tick, 250);
  }, [detachDevice, stopPractice]);

  const value = useMemo(
    () => ({ bpm, status, message, connect, startPractice, disconnect }),
    [bpm, status, message, connect, startPractice, disconnect],
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
  return (
    <button
      type="button"
      onClick={() => void connect()}
      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-paper"
    >
      {status === "live" ? <Bluetooth size={14} /> : <BluetoothOff size={14} />}
      {status === "live" ? `${bpm ?? "--"} bpm` : "Pair HR strap"}
    </button>
  );
}
