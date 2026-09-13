/* Injected into the Aether page by the iOS or Android shell. Public Heart Rate GATT only. */
(function () {
  if (window.AetherNativeShell) return;
  window.AetherNativeShell = true;

  const pending = new Map();
  let seq = 1;
  const chars = new Map();
  const devices = new Map();
  const discListeners = new Set();
  let connected = false;
  let currentDevice = null;

  function post(method, payload) {
    return new Promise((resolve, reject) => {
      const id = String(seq++);
      pending.set(id, { resolve, reject });
      const body = { id: id, method: method, payload: payload || {} };
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.aetherBle) {
        window.webkit.messageHandlers.aetherBle.postMessage(body);
        return;
      }
      if (window.AetherAndroid && window.AetherAndroid.postMessage) {
        window.AetherAndroid.postMessage(JSON.stringify(body));
        return;
      }
      pending.delete(id);
      reject(namedError("NotFoundError", "Native Bluetooth bridge is missing."));
    });
  }

  function namedError(name, message) {
    const err = new Error(message);
    err.name = name;
    return err;
  }

  function b64ToView(b64) {
    const bin = atob(b64 || "");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new DataView(bytes.buffer);
  }

  window.__aetherBleReply = function (id, ok, value, errorName, errorMessage) {
    const wait = pending.get(String(id));
    if (!wait) return;
    pending.delete(String(id));
    if (ok) wait.resolve(value);
    else wait.reject(namedError(errorName || "NetworkError", errorMessage || "Bluetooth failed."));
  };

  function emitChar(uuid, data, at) {
    const key = String(uuid || "").toLowerCase();
    const stamped = at != null && isFinite(Number(at)) ? Number(at) : Date.now();
    chars.forEach(function (char) {
      if (char._keys.indexOf(key) === -1) return;
      char.value = b64ToView(data);
      char._aetherAt = stamped;
      const ev = new Event("characteristicvaluechanged");
      Object.defineProperty(ev, "target", { value: char });
      char._listeners.forEach(function (fn) {
        try {
          fn(ev);
        } catch (e) {
          /* page handler */
        }
      });
    });
  }

  window.__aetherBleEvent = function (type, detail) {
    detail = detail || {};
    if (type === "notify") {
      emitChar(detail.uuid, detail.data, detail.t);
      return;
    }
    if (type === "disconnected") {
      connected = false;
      if (currentDevice) currentDevice.gatt.connected = false;
      discListeners.forEach(function (fn) {
        try {
          fn();
        } catch (e) {
          /* page handler */
        }
      });
    }
  };

  window.__aetherBleFlush = function (packets) {
    (packets || []).forEach(function (packet) {
      emitChar(packet.uuid, packet.data, packet.t);
    });
  };

  const ALIASES = {
    heart_rate: ["heart_rate", "180d", "0000180d-0000-1000-8000-00805f9b34fb"],
    heart_rate_measurement: [
      "heart_rate_measurement",
      "2a37",
      "00002a37-0000-1000-8000-00805f9b34fb",
    ],
    battery_service: ["battery_service", "180f", "0000180f-0000-1000-8000-00805f9b34fb"],
    battery_level: ["battery_level", "2a19", "00002a19-0000-1000-8000-00805f9b34fb"],
    pulse_oximeter: ["pulse_oximeter", "1822", "00001822-0000-1000-8000-00805f9b34fb"],
    plx_continuous_measurement: [
      "plx_continuous_measurement",
      "2a5f",
      "00002a5f-0000-1000-8000-00805f9b34fb",
    ],
    plx_spot_check_measurement: [
      "plx_spot_check_measurement",
      "2a5e",
      "00002a5e-0000-1000-8000-00805f9b34fb",
    ],
    health_thermometer: [
      "health_thermometer",
      "1809",
      "00001809-0000-1000-8000-00805f9b34fb",
    ],
    temperature_measurement: [
      "temperature_measurement",
      "2a1c",
      "00002a1c-0000-1000-8000-00805f9b34fb",
    ],
    intermediate_temperature: [
      "intermediate_temperature",
      "2a1e",
      "00002a1e-0000-1000-8000-00805f9b34fb",
    ],
  };

  function keysFor(name) {
    const n = String(name || "").toLowerCase();
    return ALIASES[n] || [n];
  }

  class NativeCharacteristic {
    constructor(uuid) {
      this.uuid = uuid;
      this.value = undefined;
      this._listeners = [];
      this._keys = keysFor(uuid).map(function (k) {
        return k.toLowerCase();
      });
    }
    addEventListener(type, fn) {
      if (type === "characteristicvaluechanged") this._listeners.push(fn);
    }
    removeEventListener(type, fn) {
      this._listeners = this._listeners.filter(function (x) {
        return x !== fn;
      });
    }
    startNotifications() {
      return post("startNotifications", { uuid: this.uuid }).then(() => this);
    }
    stopNotifications() {
      return post("stopNotifications", { uuid: this.uuid }).then(() => this);
    }
    readValue() {
      return post("readValue", { uuid: this.uuid }).then((b64) => {
        this.value = b64ToView(b64);
        return this.value;
      });
    }
  }

  class NativeService {
    constructor(uuid) {
      this.uuid = uuid;
    }
    getCharacteristic(uuid) {
      return post("getCharacteristic", { service: this.uuid, uuid: uuid }).then(() => {
        const key = String(uuid).toLowerCase();
        if (!chars.has(key)) chars.set(key, new NativeCharacteristic(uuid));
        return chars.get(key);
      });
    }
  }

  class NativeGatt {
    constructor(deviceId) {
      this.deviceId = deviceId;
      this.connected = false;
    }
    connect() {
      return post("connect", { deviceId: this.deviceId }).then(() => {
        this.connected = true;
        connected = true;
        return this;
      });
    }
    disconnect() {
      connected = false;
      this.connected = false;
      void post("disconnect", {});
    }
    getPrimaryService(uuid) {
      return post("getPrimaryService", { uuid: uuid }).then(() => new NativeService(uuid));
    }
  }

  function makeDevice(info) {
    const id = info.id;
    if (devices.has(id)) {
      const existing = devices.get(id);
      existing.name = info.name || existing.name;
      return existing;
    }
    const gatt = new NativeGatt(id);
    const device = {
      id: id,
      name: info.name || "HR strap",
      gatt: gatt,
      watchAdvertisements: function () {
        return post("watchAdvertisements", {}).then(function () {});
      },
      addEventListener: function (type, fn) {
        if (type === "gattserverdisconnected") discListeners.add(fn);
      },
      removeEventListener: function (type, fn) {
        if (type === "gattserverdisconnected") discListeners.delete(fn);
      },
    };
    devices.set(id, device);
    return device;
  }

  const bluetooth = {
    getAvailability: function () {
      return Promise.resolve(true);
    },
    getDevices: function () {
      return post("getDevices", {}).then(function (list) {
        return (list || []).map(makeDevice);
      });
    },
    requestDevice: function (options) {
      return post("requestDevice", options || {}).then(function (info) {
        currentDevice = makeDevice(info);
        return currentDevice;
      });
    },
  };

  try {
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      enumerable: true,
      value: bluetooth,
    });
  } catch (e) {
    navigator.bluetooth = bluetooth;
  }

  void post("bridgeReady", {});
})();
