import { describe, expect, it } from "vitest";
import {
  parsePlxSpo2,
  parseThermometerCelsius,
  readIeee11073Float,
  readIeee11073Sfloat,
} from "./ble-vitals";

function view(bytes: number[]): DataView {
  return new DataView(Uint8Array.from(bytes).buffer);
}

function sfloatBytes(value: number, exponent = -1): number[] {
  const mantissa = Math.round(value * 10 ** -exponent);
  const expNibble = exponent < 0 ? (16 + exponent) & 0x0f : exponent & 0x0f;
  const raw = (expNibble << 12) | (mantissa & 0x0fff);
  return [raw & 0xff, (raw >> 8) & 0xff];
}

function floatBytes(value: number, exponent = -1): number[] {
  const mantissa = Math.round(value * 10 ** -exponent);
  return [mantissa & 0xff, (mantissa >> 8) & 0xff, (mantissa >> 16) & 0xff, exponent & 0xff];
}

describe("IEEE 11073 numbers used by SIG pulse-ox and thermometer", () => {
  it("reads SFLOAT 98.5", () => {
    expect(readIeee11073Sfloat(view(sfloatBytes(98.5)), 0)).toBeCloseTo(98.5, 5);
  });

  it("reads FLOAT 33.4", () => {
    expect(readIeee11073Float(view(floatBytes(33.4)), 0)).toBeCloseTo(33.4, 5);
  });

  it("parses PLX SpO2 from flags + SFLOAT + pulse rate", () => {
    const bytes = [0x00, ...sfloatBytes(97.2), ...sfloatBytes(58)];
    expect(parsePlxSpo2(view(bytes))).toBeCloseTo(97.2, 1);
  });

  it("rejects truncated or out-of-range SpO2", () => {
    expect(parsePlxSpo2(view([0x00, 0x01]))).toBeNull();
    expect(parsePlxSpo2(view([0x00, ...sfloatBytes(40), ...sfloatBytes(60)]))).toBeNull();
  });

  it("parses thermometer Celsius and Fahrenheit", () => {
    expect(parseThermometerCelsius(view([0x00, ...floatBytes(32.8)]))).toBeCloseTo(32.8, 1);
    const f = 91.4; // 33.0 C
    expect(parseThermometerCelsius(view([0x01, ...floatBytes(f)]))).toBeCloseTo(33, 1);
  });
});
