const elements = {
  supportStatus: document.querySelector("#supportStatus"),
  bluetoothApiStatus: document.querySelector("#bluetoothApiStatus"),
  webbleApiStatus: document.querySelector("#webbleApiStatus"),
  speechApiStatus: document.querySelector("#speechApiStatus"),
  micApiStatus: document.querySelector("#micApiStatus"),
  checkMicButton: document.querySelector("#checkMicButton"),
  speechButton: document.querySelector("#speechButton"),
  stopSpeechButton: document.querySelector("#stopSpeechButton"),
  speechMode: document.querySelector("#speechMode"),
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
  serverTranscribeUrl: document.querySelector("#serverTranscribeUrl"),
  dogName: document.querySelector("#dogName"),
  chunkSeconds: document.querySelector("#chunkSeconds"),
  serverListenButton: document.querySelector("#serverListenButton"),
  stopServerListenButton: document.querySelector("#stopServerListenButton"),
  serverTranscriptText: document.querySelector("#serverTranscriptText"),
  log: document.querySelector("#log"),
};

const state = {
  device: null,
  server: null,
  characteristic: null,
  recognition: null,
  serverListening: false,
  serverListenStream: null,
  serverListenTimer: null,
  serverChunkSending: false,
  lastCommandKey: "",
  lastCommandAt: 0,
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

elements.connectButton.addEventListener("click", connectBluetooth);
elements.disconnectButton.addEventListener("click", disconnectBluetooth);
elements.checkMicButton.addEventListener("click", checkMic);
elements.speechButton.addEventListener("click", startSpeechCheck);
elements.stopSpeechButton.addEventListener("click", stopSpeechCheck);
elements.serverListenButton.addEventListener("click", startServerListening);
elements.stopServerListenButton.addEventListener("click", stopServerListening);
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
    setStatus("navigator.webble は見えています。API形式確認が必要です。", "warn");
    elements.connectButton.disabled = true;
    log(`navigator.webble keys: ${safeKeys(navigator.webble).join(", ") || "取得なし"}`);
    return;
  }

  setStatus("Bluetooth APIが見えません。BluefyまたはSafari拡張で開いてください。", "bad");
  elements.connectButton.disabled = true;
}

async function checkMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((track) => track.stop());
    elements.micApiStatus.textContent = "使用できます";
    log("マイク: OK");
    return true;
  } catch (error) {
    elements.micApiStatus.textContent = "失敗";
    log(`マイク失敗: ${error.name || "error"} ${error.message || ""}`);
    return false;
  }
}

async function getMicStreamForServer() {
  if (state.serverListenStream?.getAudioTracks().some((track) => track.readyState === "live")) {
    return state.serverListenStream;
  }

  state.serverListenStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  });
  return state.serverListenStream;
}

async function startServerListening() {
  const url = elements.serverTranscribeUrl.value.trim();
  if (!url) {
    log("サーバーURLを入力してください");
    return;
  }

  try {
    await getMicStreamForServer();
    state.serverListening = true;
    elements.serverListenButton.disabled = true;
    elements.stopServerListenButton.disabled = false;
    log("サーバー聞き取り開始");
    runServerListenLoop();
  } catch (error) {
    log(`サーバー聞き取り開始失敗: ${error.name || "error"} ${error.message || ""}`);
  }
}

function stopServerListening() {
  state.serverListening = false;
  if (state.serverListenTimer) {
    window.clearTimeout(state.serverListenTimer);
    state.serverListenTimer = null;
  }
  state.serverListenStream?.getTracks().forEach((track) => track.stop());
  state.serverListenStream = null;
  elements.serverListenButton.disabled = false;
  elements.stopServerListenButton.disabled = true;
  log("サーバー聞き取り停止");
}

async function runServerListenLoop() {
  if (!state.serverListening || state.serverChunkSending) return;
  state.serverChunkSending = true;

  try {
    const stream = await getMicStreamForServer();
    const durationMs = Number(elements.chunkSeconds.value) * 1000;
    const blob = await recordAudioChunk(stream, durationMs);
    if (state.serverListening) {
      await sendChunkToTranscriptionServer(blob);
    }
  } catch (error) {
    log(`サーバー聞き取りエラー: ${error.name || "error"} ${error.message || ""}`);
  } finally {
    state.serverChunkSending = false;
    if (state.serverListening) {
      state.serverListenTimer = window.setTimeout(runServerListenLoop, 120);
    }
  }
}

function recordAudioChunk(stream, durationMs) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
    let recorder;

    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (error) {
      reject(error);
      return;
    }

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });

    recorder.addEventListener("error", (event) => reject(event.error || event));
    recorder.addEventListener("stop", () => {
      resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    });

    recorder.start();
    window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, durationMs);
  });
}

async function sendChunkToTranscriptionServer(blob) {
  if (!blob.size) return;

  const formData = new FormData();
  formData.append("audio", blob, "chunk.webm");
  formData.append("language", "ja");

  const startedAt = performance.now();
  const response = await fetch(elements.serverTranscribeUrl.value.trim(), {
    method: "POST",
    body: formData,
  });
  const elapsed = Math.round(performance.now() - startedAt);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    log(`サーバー文字起こし失敗: ${response.status} ${body.slice(0, 160)}`);
    return;
  }

  const data = await response.json();
  const text = String(data.text || "").trim();
  if (!text) {
    log(`文字起こし結果なし (${elapsed}ms)`);
    return;
  }

  elements.serverTranscriptText.value = `${elements.serverTranscriptText.value}\n${text}`.trim();
  log(`サーバー文字起こし (${elapsed}ms): ${text}`);
  await handleServerVoiceCommand(text);
}

async function handleServerVoiceCommand(text) {
  const dogName = normalizeText(elements.dogName.value || "ポチ");
  const spoken = normalizeText(text);
  if (!dogName || !spoken.includes(dogName)) return;

  const isCome = spoken.includes("おいで") || spoken.includes("来て") || spoken.includes("こっち");
  const command = isCome ? "COME" : "BARK";
  const key = `${command}:${spoken}`;
  const now = Date.now();

  if (state.lastCommandKey === key && now - state.lastCommandAt < 3500) {
    return;
  }

  state.lastCommandKey = key;
  state.lastCommandAt = now;
  log(`音声コマンド判定: ${command}`);

  if (!state.characteristic) {
    log("Bluetooth未接続のため送信をスキップ");
    return;
  }

  if (command === "COME") {
    await sendCommand("BARK");
    await wait(220);
    await sendCommand("BARK");
    await wait(120);
    await sendCommand("COME");
  } else {
    await sendCommand("BARK");
  }
}

async function startSpeechCheck() {
  if (!SpeechRecognition) {
    elements.speechApiStatus.textContent = "APIなし";
    log("文字起こしAPIがありません");
    return;
  }

  stopSpeechCheck();

  const mode = elements.speechMode.value;
  if (mode === "afterMic") {
    const micReady = await checkMic();
    if (!micReady) return;
    await wait(300);
  }

  const recognition = new SpeechRecognition();
  recognition.lang = mode === "english" ? "en-US" : "ja-JP";
  recognition.continuous = mode === "continuous";
  recognition.interimResults = mode !== "finalOnly";
  recognition.maxAlternatives = 3;

  attachSpeechDebugEvents(recognition);
  state.recognition = recognition;

  try {
    elements.speechText.value = "";
    elements.speechApiStatus.textContent = "開始要求中";
    elements.speechButton.disabled = true;
    elements.stopSpeechButton.disabled = false;
    log(`文字起こし start(): mode=${mode}, lang=${recognition.lang}, continuous=${recognition.continuous}, interim=${recognition.interimResults}`);
    recognition.start();
  } catch (error) {
    elements.speechApiStatus.textContent = "開始失敗";
    elements.speechButton.disabled = false;
    elements.stopSpeechButton.disabled = true;
    log(`文字起こし開始失敗: ${error.name || "error"} ${error.message || ""}`);
  }
}

function stopSpeechCheck() {
  if (!state.recognition) return;
  try {
    state.recognition.stop();
  } catch {
    // Already stopped.
  }
  state.recognition = null;
  elements.speechButton.disabled = false;
  elements.stopSpeechButton.disabled = true;
}

function attachSpeechDebugEvents(recognition) {
  const eventNames = [
    "audiostart",
    "soundstart",
    "speechstart",
    "speechend",
    "soundend",
    "audioend",
    "nomatch",
    "end",
  ];

  eventNames.forEach((name) => {
    recognition.addEventListener(name, () => {
      log(`音声認識イベント: ${name}`);
      if (name === "end") {
        if (elements.speechApiStatus.textContent === "聞き取り中") {
          elements.speechApiStatus.textContent = elements.speechText.value ? "完了" : "結果なし";
        }
        elements.speechButton.disabled = false;
        elements.stopSpeechButton.disabled = true;
        state.recognition = null;
      }
    });
  });

  recognition.addEventListener("start", () => {
    elements.speechApiStatus.textContent = "聞き取り中";
    log("文字起こし開始成功。今話してください。");
  });

  recognition.addEventListener("result", (event) => {
    let text = "";
    const pieces = [];
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const best = result[0];
      const transcript = best?.transcript || "";
      text += transcript;
      pieces.push(`${result.isFinal ? "final" : "interim"}:${transcript}:${Math.round((best?.confidence || 0) * 100)}%`);
    }
    elements.speechText.value = `${elements.speechText.value}${text}`.trim();
    log(`認識結果: ${pieces.join(" / ")}`);
  });

  recognition.addEventListener("error", (event) => {
    elements.speechApiStatus.textContent = `失敗: ${event.error}`;
    elements.speechButton.disabled = false;
    elements.stopSpeechButton.disabled = true;
    log(`文字起こしエラー: ${event.error}${event.message ? ` / ${event.message}` : ""}`);
  });
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

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[、。,.!?！？「」『』"']/g, "");
}
