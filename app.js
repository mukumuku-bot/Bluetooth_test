const elements = {
  supportStatus: document.querySelector("#supportStatus"),
  bluetoothApiStatus: document.querySelector("#bluetoothApiStatus"),
  webbleApiStatus: document.querySelector("#webbleApiStatus"),
  speechApiStatus: document.querySelector("#speechApiStatus"),
  micApiStatus: document.querySelector("#micApiStatus"),
  checkMicButton: document.querySelector("#checkMicButton"),
  speechButton: document.querySelector("#speechButton"),
  speechText: document.querySelector("#speechText"),
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
  recognition: null,
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

elements.connectButton.addEventListener("click", connectBluetooth);
elements.disconnectButton.addEventListener("click", disconnectBluetooth);
elements.checkMicButton.addEventListener("click", checkMic);
elements.speechButton.addEventListener("click", startSpeechCheck);
elements.commandButtons.forEach((button) => {
  button.addEventListener("click", () => sendCommand(button.dataset.command));
});
elements.customCommandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendCommand(elements.customCommand.value.trim());
});

checkSupport();

function checkSupport() {
  const hasBluetooth = Boolean(navigator.bluetooth?.requestDevice);
  const hasWebble = Boolean(navigator.webble);
  const hasSpeech = Boolean(SpeechRecognition);

  elements.bluetoothApiStatus.textContent = hasBluetooth ? "あり" : "なし";
  elements.webbleApiStatus.textContent = hasWebble ? "あり" : "なし";
  elements.speechApiStatus.textContent = hasSpeech ? "あり" : "なし";

  log(`UserAgent: ${navigator.userAgent}`);
  log(`navigator.bluetooth: ${hasBluetooth ? "あり" : "なし"}`);
  log(`navigator.webble: ${hasWebble ? "あり" : "なし"}`);
  log(`SpeechRecognition: ${hasSpeech ? "あり" : "なし"}`);

  if (hasBluetooth) {
    setStatus("Web Bluetooth APIを使えます。接続を試してください。", "ok");
    elements.connectButton.disabled = false;
    return;
  }

  if (hasWebble) {
    setStatus("navigator.webble は見えています。API形式確認が必要です。ログを確認してください。", "warn");
    elements.connectButton.disabled = true;
    log(`navigator.webble keys: ${safeKeys(navigator.webble).join(", ") || "取得なし"}`);
    return;
  }

  setStatus("Bluetooth APIが見えません。Safari拡張が有効か確認してください。", "bad");
  elements.connectButton.disabled = true;
}

async function checkMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((track) => track.stop());
    elements.micApiStatus.textContent = "使用できます";
    log("マイク: OK");
  } catch (error) {
    elements.micApiStatus.textContent = "失敗";
    log(`マイク失敗: ${error.message || error}`);
  }
}

function startSpeechCheck() {
  if (!SpeechRecognition) {
    elements.speechApiStatus.textContent = "APIなし";
    log("文字起こしAPIがありません");
    return;
  }

  if (state.recognition) {
    state.recognition.stop();
    state.recognition = null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.addEventListener("start", () => {
    elements.speechApiStatus.textContent = "聞き取り中";
    elements.speechText.value = "";
    log("文字起こし開始");
  });

  recognition.addEventListener("result", (event) => {
    let text = "";
    for (let index = 0; index < event.results.length; index += 1) {
      text += event.results[index][0]?.transcript || "";
    }
    elements.speechText.value = text.trim();
  });

  recognition.addEventListener("error", (event) => {
    elements.speechApiStatus.textContent = `失敗: ${event.error}`;
    log(`文字起こしエラー: ${event.error}`);
  });

  recognition.addEventListener("end", () => {
    if (elements.speechApiStatus.textContent === "聞き取り中") {
      elements.speechApiStatus.textContent = "完了";
    }
    log("文字起こし終了");
  });

  state.recognition = recognition;
  try {
    recognition.start();
  } catch (error) {
    elements.speechApiStatus.textContent = "開始失敗";
    log(`文字起こし開始失敗: ${error.message || error}`);
  }
}

async function connectBluetooth() {
  if (!navigator.bluetooth?.requestDevice) {
    setStatus("navigator.bluetooth.requestDevice が使えません。", "bad");
    return;
  }

  try {
    const serviceUuid = elements.serviceUuid.value.trim();
    const characteristicUuid = elements.characteristicUuid.value.trim();
    const namePrefix = elements.deviceName.value.trim();
    const filters = namePrefix ? [{ namePrefix }] : [{ services: [serviceUuid] }];

    log(`デバイス検索: ${namePrefix || serviceUuid}`);
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
  elements.connectButton.disabled = connected || !navigator.bluetooth?.requestDevice;
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

function safeKeys(value) {
  try {
    return Object.keys(value || {});
  } catch {
    return [];
  }
}
