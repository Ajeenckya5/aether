/** Bluetooth SIG Pulse Oximeter (0x1822) and Health Thermometer (0x1809). */

export const PULSE_OXIMETER_SERVICE = "pulse_oximeter";
export const PLX_CONTINUOUS_MEASUREMENT = "plx_continuous_measurement";
export const PLX_SPOT_CHECK_MEASUREMENT = "plx_spot_check_measurement";
export const HEALTH_THERMOMETER_SERVICE = "health_thermometer";
export const TEMPERATURE_MEASUREMENT = "temperature_measurement";
export const INTERMEDIATE_TEMPERATURE = "intermediate_temperature";

export const STANDARD_VITAL_SERVICES = [
  PULSE_OXIMETER_SERVICE,
  HEALTH_THERMOMETER_SERVICE,
] as const;

export const STANDARD_VITAL_CHARACTERISTICS = [
  PLX_CONTINUOUS_MEASUREMENT,
  PLX_SPOT_CHECK_MEASUREMENT,
  TEMPERATURE_MEASUREMENT,
  INTERMEDIATE_TEMPERATURE,
] as const;

export type VitalHandler = {
  onSpo2: (value: number) => void;
  onSkinTempC: (value: number) => void;
};

export type VitalSubscription = {
  char: BluetoothRemoteGATTCharacteristic;
  onValue: (event: Event) => void;
};

/** IEEE 11073-20601 16-bit SFLOAT (exponent 4 + mantissa 12), little-endian. */
export function readIeee11073Sfloat(view: DataView, offset: number): number | null {
  if (offset + 2 > view.byteLength) return null;
  const raw = view.getUint16(offset, true);
  let mantissa = raw & 0x0fff;
  if (mantissa & 0x0800) mantissa -= 0x1000;
  let exponent = (raw >> 12) & 0x0f;
  if (exponent & 0x08) exponent -= 0x10;
  if (
    mantissa === 2047 ||
    mantissa === -2048 ||
    mantissa === 2046 ||
    mantissa === -2046 ||
    mantissa === -2047
  ) {
    return null;
  }
  const value = mantissa * 10 ** exponent;
  return Number.isFinite(value) ? value : null;
}

/** IEEE 11073-20601 32-bit FLOAT (exponent 8 + mantissa 24), little-endian. */
export function readIeee11073Float(view: DataView, offset: number): number | null {
  if (offset + 4 > view.byteLength) return null;
  const b0 = view.getUint8(offset);
  const b1 = view.getUint8(offset + 1);
  const b2 = view.getUint8(offset + 2);
  const exponent = view.getInt8(offset + 3);
  let mantissa = b0 | (b1 << 8) | (b2 << 16);
  if (mantissa & 0x800000) mantissa -= 0x1000000;
  if (
    mantissa === 0x7fffff ||
    mantissa === -0x800000 ||
    mantissa === 0x7ffffe ||
    mantissa === -0x7ffffe ||
    mantissa === -0x7fffff
  ) {
    return null;
  }
  const value = mantissa * 10 ** exponent;
  return Number.isFinite(value) ? value : null;
}

export function isPlausibleSpo2(value: number): boolean {
  return value >= 70 && value <= 100;
}

export function isPlausibleSkinTempC(value: number): boolean {
  return value >= 20 && value <= 45;
}

/** PLX Spot-check / Continuous Measurement: flags + SpO2 SFLOAT + pulse-rate SFLOAT. */
export function parsePlxSpo2(view: DataView): number | null {
  if (view.byteLength < 5) return null;
  const spo2 = readIeee11073Sfloat(view, 1);
  if (spo2 == null || !isPlausibleSpo2(spo2)) return null;
  return Math.round(spo2 * 10) / 10;
}

/** Health Thermometer Temperature Measurement / Intermediate Temperature. */
export function parseThermometerCelsius(view: DataView): number | null {
  if (view.byteLength < 5) return null;
  const flags = view.getUint8(0);
  const raw = readIeee11073Float(view, 1);
  if (raw == null) return null;
  const celsius = flags & 0x01 ? ((raw - 32) * 5) / 9 : raw;
  if (!isPlausibleSkinTempC(celsius)) return null;
  return Math.round(celsius * 10) / 10;
}

export function parseStandardVital(
  characteristic: string,
  view: DataView,
): { spo2?: number; skinTempC?: number } | null {
  if (
    characteristic === PLX_CONTINUOUS_MEASUREMENT ||
    characteristic === PLX_SPOT_CHECK_MEASUREMENT
  ) {
    const spo2 = parsePlxSpo2(view);
    return spo2 == null ? null : { spo2 };
  }
  if (
    characteristic === TEMPERATURE_MEASUREMENT ||
    characteristic === INTERMEDIATE_TEMPERATURE
  ) {
    const skinTempC = parseThermometerCelsius(view);
    return skinTempC == null ? null : { skinTempC };
  }
  return null;
}

const VITAL_PAIRS: Array<{ service: string; chars: readonly string[] }> = [
  {
    service: PULSE_OXIMETER_SERVICE,
    chars: [PLX_CONTINUOUS_MEASUREMENT, PLX_SPOT_CHECK_MEASUREMENT],
  },
  {
    service: HEALTH_THERMOMETER_SERVICE,
    chars: [TEMPERATURE_MEASUREMENT, INTERMEDIATE_TEMPERATURE],
  },
];

/**
 * Subscribe to Bluetooth SIG pulse-ox and thermometer if this firmware exposes them.
 * WHOOP typically does not — failures are expected and ignored.
 */
export async function attachStandardVitals(
  server: BluetoothRemoteGATTServer,
  handlers: VitalHandler,
): Promise<VitalSubscription[]> {
  const subs: VitalSubscription[] = [];
  for (const pair of VITAL_PAIRS) {
    let service: BluetoothRemoteGATTService;
    try {
      service = await server.getPrimaryService(pair.service);
    } catch {
      continue;
    }
    for (const uuid of pair.chars) {
      try {
        const char = await service.getCharacteristic(uuid);
        const onValue = (event: Event) => {
          const target = event.target as unknown as BluetoothRemoteGATTCharacteristic;
          if (!target.value) return;
          const parsed = parseStandardVital(uuid, target.value);
          if (parsed?.spo2 != null) handlers.onSpo2(parsed.spo2);
          if (parsed?.skinTempC != null) handlers.onSkinTempC(parsed.skinTempC);
        };
        char.addEventListener("characteristicvaluechanged", onValue);
        subs.push({ char, onValue });
        try {
          await char.startNotifications();
        } catch {
          /* some stacks are read-only */
        }
        try {
          const view = await char.readValue();
          const parsed = parseStandardVital(uuid, view);
          if (parsed?.spo2 != null) handlers.onSpo2(parsed.spo2);
          if (parsed?.skinTempC != null) handlers.onSkinTempC(parsed.skinTempC);
        } catch {
          /* notify-only */
        }
      } catch {
        /* characteristic missing on this firmware */
      }
    }
  }
  return subs;
}

export function detachVitalSubscriptions(subs: VitalSubscription[]) {
  for (const sub of subs) {
    sub.char.removeEventListener("characteristicvaluechanged", sub.onValue);
    try {
      void sub.char.stopNotifications();
    } catch {
      /* already gone */
    }
  }
}
