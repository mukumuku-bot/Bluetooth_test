const elements = {
  deviceName: document.querySelector("#deviceName"),
  batteryFill: document.querySelector("#batteryFill"),
  batteryPercent: document.querySelector("#batteryPercent"),
  status: document.querySelector("#status"),
  connectButton: document.querySelector("#connectButton"),
  refreshButton: document.querySelector("#refreshButton"),
};

const state = {
  device: null,
  characteristic: null,
};

const BATTERY_SERVICE = "battery_service";
const BATTERY_LEVEL = "battery_level";

elements.connectButton.addEventListener("click", connectBatteryService);
elements.refreshButton.addEventListener("click", readBatteryLevel);

if (!navigator.bluetooth) {
  elements.status.textContent = "このブラウザではBluetoothを利用できません";
  elements.connectButton.disabled = true;
}

async function connectBatteryService() {
  elements.connectButton.disabled = true;
  elements.status.textContent = "Bluetooth機器を選択してください";

  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [BATTERY_SERVICE],
    });
    state.device = device;
    device.addEventListener("gattserverdisconnected", handleDisconnect);
    elements.deviceName.textContent = device.name || "名前のないBluetooth機器";
    elements.status.textContent = "Battery Serviceに接続しています";

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(BATTERY_SERVICE);
    state.characteristic = await service.getCharacteristic(BATTERY_LEVEL);
    state.characteristic.addEventListener("characteristicvaluechanged", handleBatteryNotification);
    await state.characteristic.startNotifications().catch(() => {});
    elements.refreshButton.disabled = false;
    await readBatteryLevel();
  } catch (error) {
    state.characteristic = null;
    elements.refreshButton.disabled = true;
    elements.status.textContent = getBluetoothErrorMessage(error);
  } finally {
    elements.connectButton.disabled = false;
  }
}

async function readBatteryLevel() {
  if (!state.characteristic) return;

  elements.status.textContent = "残量を取得しています";
  try {
    const value = await state.characteristic.readValue();
    updateBatteryLevel(value.getUint8(0));
  } catch {
    elements.status.textContent = "残量を取得できませんでした";
  }
}

function handleBatteryNotification(event) {
  updateBatteryLevel(event.target.value.getUint8(0));
}

function updateBatteryLevel(level) {
  const percent = Math.max(0, Math.min(100, Number(level) || 0));
  elements.batteryPercent.textContent = `${percent}%`;
  elements.batteryFill.style.width = `${percent}%`;
  elements.batteryFill.style.backgroundColor = percent <= 20 ? "#df4b4b" : percent <= 45 ? "#d69018" : "#16834b";
  elements.status.textContent = "残量を取得できました";
}

function handleDisconnect() {
  state.characteristic = null;
  elements.refreshButton.disabled = true;
  elements.status.textContent = "Bluetooth接続が切れました";
}

function getBluetoothErrorMessage(error) {
  if (error?.name === "NotFoundError") {
    return state.device ? "この機器はBattery Serviceを公開していません" : "Bluetooth機器が選択されませんでした";
  }
  if (error?.name === "NotSupportedError") return "この機器はBattery Serviceに対応していません";
  return "Battery Serviceに接続できませんでした";
}
