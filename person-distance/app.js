const elements = {
  video: document.querySelector("#video"),
  overlay: document.querySelector("#overlay"),
  cameraMessage: document.querySelector("#cameraMessage"),
  readout: document.querySelector("#readout"),
  distanceText: document.querySelector("#distanceText"),
  methodText: document.querySelector("#methodText"),
  startButton: document.querySelector("#startButton"),
  stopButton: document.querySelector("#stopButton"),
};

const state = {
  stream: null,
  personModel: null,
  faceDetector: null,
  running: false,
  detecting: false,
  rafId: null,
  inTargetRange: false,
  signalAudioContext: null,
};

const TARGET_FACE_HEIGHT_MIN_RATIO = 0.12;
const TARGET_FACE_HEIGHT_MAX_RATIO = 0.24;
const TARGET_FACE_HEIGHT_EXIT_MIN_RATIO = 0.1;
const TARGET_FACE_HEIGHT_EXIT_MAX_RATIO = 0.26;
const ctx = elements.overlay.getContext("2d");

elements.startButton.addEventListener("click", startCamera);
elements.stopButton.addEventListener("click", stopCamera);
window.addEventListener("resize", resizeOverlay);

async function startCamera() {
  elements.startButton.disabled = true;
  elements.cameraMessage.textContent = "カメラと検出モデルを準備しています";
  elements.cameraMessage.classList.remove("is-hidden");
  primeSignalSound();

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    elements.video.srcObject = state.stream;
    await elements.video.play();
    await loadModels();
    state.running = true;
    elements.stopButton.disabled = false;
    elements.cameraMessage.classList.add("is-hidden");
    resizeOverlay();
    detectLoop();
  } catch (error) {
    elements.cameraMessage.textContent = getCameraErrorMessage(error);
    elements.startButton.disabled = false;
  }
}

function stopCamera() {
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  elements.video.srcObject = null;
  elements.startButton.disabled = false;
  elements.stopButton.disabled = true;
  setTargetRangeState(false, false);
  elements.distanceText.textContent = "顔を探しています";
  elements.methodText.textContent = "顔の大きさで近さを判定します";
  elements.cameraMessage.textContent = "カメラを開始してください";
  elements.cameraMessage.classList.remove("is-hidden");
  ctx.clearRect(0, 0, elements.overlay.width, elements.overlay.height);
}

async function loadModels() {
  if (!state.personModel) {
    state.personModel = await window.cocoSsd.load({ base: "lite_mobilenet_v2" });
  }

  if (!state.faceDetector && window.faceDetection) {
    try {
      const model = window.faceDetection.SupportedModels.MediaPipeFaceDetector;
      state.faceDetector = await window.faceDetection.createDetector(model, {
        runtime: "tfjs",
        maxFaces: 6,
      });
    } catch {
      state.faceDetector = null;
    }
  }
}

async function detectLoop() {
  if (!state.running || state.detecting) return;
  state.detecting = true;

  try {
    const predictions = await state.personModel.detect(elements.video);
    const faces = state.faceDetector
      ? await state.faceDetector.estimateFaces(elements.video, { flipHorizontal: false })
      : [];
    renderDetection(predictions, faces);
  } catch {
    elements.methodText.textContent = "検出中にエラーが発生しました";
  } finally {
    state.detecting = false;
    if (state.running) state.rafId = requestAnimationFrame(detectLoop);
  }
}

function renderDetection(predictions, faces) {
  resizeOverlay();
  const frameWidth = elements.video.videoWidth;
  const frameHeight = elements.video.videoHeight;
  const people = predictions
    .filter((item) => item.class === "person" && item.score >= 0.45)
    .sort((a, b) => b.bbox[2] * b.bbox[3] - a.bbox[2] * a.bbox[3]);
  const mainPerson = people[0] || null;
  const faceBboxes = faces.map(getFaceBbox).filter((bbox) => bbox[2] > 0 && bbox[3] > 0);
  const mainFace = mainPerson ? findFaceInPerson(mainPerson.bbox, faceBboxes) : largestBox(faceBboxes);
  clearOverlay();
  if (!frameWidth || !frameHeight || !mainFace) {
    setTargetRangeState(false, false);
    elements.distanceText.textContent = mainPerson ? "顔を向けてください" : "人物を探しています";
    elements.methodText.textContent = mainPerson ? "顔を検出すると近さを判定します" : "カメラに人物を映してください";
    if (mainPerson) drawBox(mainPerson.bbox, "人物");
    return;
  }

  const faceHeightRatio = mainFace[3] / frameHeight;
  setTargetRangeState(isInTargetRange(faceHeightRatio), true);
  drawBox(mainFace, "顔");
  elements.distanceText.textContent = state.inTargetRange
    ? "適正距離"
    : faceHeightRatio < TARGET_FACE_HEIGHT_MIN_RATIO
      ? "遠い"
      : "近い";
  elements.methodText.textContent = `顔の大きさ: ${Math.round(faceHeightRatio * 100)}% / 適正範囲: ${Math.round(TARGET_FACE_HEIGHT_MIN_RATIO * 100)}〜${Math.round(TARGET_FACE_HEIGHT_MAX_RATIO * 100)}%`;
}

function getFaceBbox(face) {
  const box = face.box || {};
  const x = box.xMin ?? box.x ?? 0;
  const y = box.yMin ?? box.y ?? 0;
  const width = box.width ?? Math.max(0, (box.xMax ?? 0) - x);
  const height = box.height ?? Math.max(0, (box.yMax ?? 0) - y);
  return [x, y, width, height];
}

function findFaceInPerson(personBbox, faces) {
  const [personX, personY, personWidth, personHeight] = personBbox;
  return faces
    .filter(([x, y, width, height]) => {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      return centerX >= personX
        && centerX <= personX + personWidth
        && centerY >= personY
        && centerY <= personY + personHeight;
    })
    .sort((a, b) => b[2] * b[3] - a[2] * a[3])[0] || null;
}

function largestBox(boxes) {
  return [...boxes].sort((a, b) => b[2] * b[3] - a[2] * a[3])[0] || null;
}

function isInTargetRange(faceHeightRatio) {
  if (state.inTargetRange) {
    return faceHeightRatio >= TARGET_FACE_HEIGHT_EXIT_MIN_RATIO
      && faceHeightRatio <= TARGET_FACE_HEIGHT_EXIT_MAX_RATIO;
  }
  return faceHeightRatio >= TARGET_FACE_HEIGHT_MIN_RATIO
    && faceHeightRatio <= TARGET_FACE_HEIGHT_MAX_RATIO;
}

function setTargetRangeState(isInRange, playSignal) {
  const enteredRange = isInRange && !state.inTargetRange;
  state.inTargetRange = isInRange;
  elements.readout.classList.toggle("is-in-range", isInRange);
  if (enteredRange && playSignal) playRangeSignal();
}

function primeSignalSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  state.signalAudioContext ||= new AudioContext();
  if (state.signalAudioContext.state === "suspended") {
    state.signalAudioContext.resume().catch(() => {});
  }
}

function playRangeSignal() {
  primeSignalSound();
  const audioContext = state.signalAudioContext;
  if (!audioContext) return;

  const now = audioContext.currentTime;
  [0, 0.15].forEach((offset, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(index ? 880 : 660, now + offset);
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.15, now + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.11);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.12);
  });
}

function resizeOverlay() {
  const width = elements.video.clientWidth || 1;
  const height = elements.video.clientHeight || 1;
  const scale = window.devicePixelRatio || 1;
  elements.overlay.width = Math.round(width * scale);
  elements.overlay.height = Math.round(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function clearOverlay() {
  ctx.clearRect(0, 0, elements.overlay.clientWidth, elements.overlay.clientHeight);
}

function drawBox(bbox, label) {
  const scaleX = elements.overlay.clientWidth / elements.video.videoWidth;
  const scaleY = elements.overlay.clientHeight / elements.video.videoHeight;
  const [x, y, width, height] = bbox;
  ctx.strokeStyle = "#61b4ff";
  ctx.fillStyle = "#61b4ff";
  ctx.lineWidth = 3;
  ctx.strokeRect(x * scaleX, y * scaleY, width * scaleX, height * scaleY);
  ctx.font = "700 15px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(label, x * scaleX + 6, Math.max(20, y * scaleY - 8));
}

function getCameraErrorMessage(error) {
  if (error?.name === "NotAllowedError") return "カメラの使用を許可してください";
  if (error?.name === "NotFoundError") return "カメラが見つかりません";
  return "カメラを開始できませんでした";
}
