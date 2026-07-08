const elements = {
  supportStatus: document.querySelector("#supportStatus"),
  deviceName: document.querySelector("#deviceName"),
  serviceUuid: document.querySelector("#serviceUuid"),
  characteristicUuid: document.querySelector("#characteristicUuid"),
  connectButton: document.querySelector("#connectButton"),
  disconnectButton: document.querySelector("#disconnectButton"),
  commandButtons: document.querySelectorAll("[data-command]"),
  customCommandForm: document.querySelector("#customCommandForm"),
  customCommand: document.querySelector("#customCommand"),
  sendCustomButton: document.querySelector("#sendCustomButton"),
  log: document.querySelector("#log"),
};

const state = {
  device: null,
  server: null,
  characteristic: null,
};

elements.connectButton.addEventListener("click", connectBluetooth);
elements.disconnectButton.addEventListener("click", disconnectBluetooth);
elements.commandButtons.forEach((button) => {
  button.addEventListener("click", () => sendCommand(button.dataset.command));
});
elements.customCommandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendCommand(elements.customCommand.value.trim());
});

checkSupport();

function checkSupport() {
  if (!navigator.bluetooth) {
    setStatus("このブラウザはWeb Bluetoothに対応していません。Android ChromeかPC Chrome/Edgeで試してください。", "bad");
    elements.connectButton.disabled = true;
    return;
  }

  setStatus("Web Bluetoothに対応しています。接続ボタンを押してください。", "ok");
}

async function connectBluetooth() {
  try {
    const serviceUuid = elements.serviceUuid.value.trim();
    const characteristicUuid = elements.characteristicUuid.value.trim();
    const namePrefix = elements.deviceName.value.trim();
    const filters = namePrefix ? [{ namePrefix }] : [{ services: [serviceUuid] }];

    log(`デバイスを検索: ${namePrefix || serviceUuid}`);
    const device = await navigator.bluetooth.requestDevice({
      filters,
      optionalServices: [serviceUuid],
    });

    state.device = device;
    state.device.addEventListener("gattserverdisconnected", onDisconnected);

    log(`接続中: ${device.name || "名前なし"}`);
    state.server = await device.gatt.connect();
    const service = await state.server.getPrimaryService(serviceUuid);
    state.characteristic = await service.getCharacteristic(characteristicUuid);

    setConnected(true);
    setStatus(`接続しました: ${device.name || "名前なし"}`, "ok");
    log("接続完了");
  } catch (error) {
    setStatus(`接続できません: ${error.message}`, "bad");
    log(`ERROR: ${error.message}`);
    setConnected(false);
  }
}

function disconnectBluetooth() {
  if (state.device?.gatt?.connected) {
    state.device.gatt.disconnect();
  }
  onDisconnected();
}

function onDisconnected() {
  state.server = null;
  state.characteristic = null;
  setConnected(false);
  setStatus("切断しました", "warn");
  log("切断");
}

async function sendCommand(command) {
  if (!command || !state.characteristic) return;

  const payload = new TextEncoder().encode(`${command}\n`);
  try {
    await state.characteristic.writeValue(payload);
    log(`送信: ${command}`);
  } catch (error) {
    setStatus(`送信できません: ${error.message}`, "bad");
    log(`SEND ERROR: ${error.message}`);
  }
}

function setConnected(connected) {
  elements.connectButton.disabled = connected || !navigator.bluetooth;
  elements.disconnectButton.disabled = !connected;
  elements.sendCustomButton.disabled = !connected;
  elements.commandButtons.forEach((button) => {
    button.disabled = !connected;
  });
}

function setStatus(message, type) {
  elements.supportStatus.textContent = message;
  elements.supportStatus.className = `status ${type}`;
}

function log(message) {
  const time = new Date().toLocaleTimeString();
  elements.log.textContent += `[${time}] ${message}\n`;
  elements.log.scrollTop = elements.log.scrollHeight;
}
