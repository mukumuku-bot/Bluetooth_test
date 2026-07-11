const speakButton = document.querySelector("#speakButton");
const status = document.querySelector("#status");
const voiceName = document.querySelector("#voiceName");
const voiceSelect = document.querySelector("#voiceSelect");
const otoyaButton = document.querySelector("#otoyaButton");
const firstPhrase = "はい。";
const secondPhrase = "どうしましたか。";

function getJapaneseVoices() {
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith("ja"));
}

function getJapaneseVoice() {
  const japaneseVoices = getJapaneseVoices();
  const selectedVoice = japaneseVoices.find((voice) => voice.voiceURI === voiceSelect.value);
  if (selectedVoice) return selectedVoice;
  const maleVoice = japaneseVoices.find((voice) => /otoya|\bmale\b|男性|男/i.test(voice.name));
  return maleVoice || japaneseVoices[0] || null;
}

function getOtoyaVoice() {
  return getJapaneseVoices().find((voice) => voice.name.toLowerCase().includes("otoya")) || null;
}

function populateVoiceOptions() {
  const voices = getJapaneseVoices();
  const currentValue = voiceSelect.value;
  voiceSelect.replaceChildren();

  if (!voices.length) {
    const option = new Option("日本語音声が見つかりません", "");
    voiceSelect.add(option);
    voiceSelect.disabled = true;
    updateVoiceName();
    return;
  }

  voices.forEach((voice) => {
    const option = new Option(`${voice.name} (${voice.lang})`, voice.voiceURI);
    voiceSelect.add(option);
  });

  const defaultVoice = voices.find((voice) => /otoya|\bmale\b|男性|男/i.test(voice.name)) || voices[0];
  voiceSelect.value = voices.some((voice) => voice.voiceURI === currentValue) ? currentValue : defaultVoice.voiceURI;
  voiceSelect.disabled = false;
  updateVoiceName();
}

function updateVoiceName() {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    voiceName.textContent = "このブラウザは読み上げに対応していません";
    speakButton.disabled = true;
    return;
  }

  const voice = getJapaneseVoice();
  voiceName.textContent = voice ? `使用する音声: ${voice.name}` : "日本語音声が見つかりません";
}

function createUtterance(text, voice = getJapaneseVoice()) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 1.04;
  utterance.pitch = voice && /otoya|\bmale\b|男性|男/i.test(voice.name) ? 0.96 : 0.82;
  utterance.volume = 1;
  if (voice) utterance.voice = voice;
  return utterance;
}

function speak(voice = getJapaneseVoice()) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;

  const firstUtterance = createUtterance(firstPhrase, voice);
  const secondUtterance = createUtterance(secondPhrase, voice);

  firstUtterance.addEventListener("start", () => {
    status.textContent = "読み上げ中です";
  });
  firstUtterance.addEventListener("end", () => {
    window.setTimeout(() => window.speechSynthesis.speak(secondUtterance), 320);
  });
  secondUtterance.addEventListener("end", () => {
    status.textContent = "読み上げが終わりました";
  });
  secondUtterance.addEventListener("error", () => {
    status.textContent = "読み上げを開始できませんでした";
  });

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(firstUtterance);
}

async function tryOtoya() {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;

  otoyaButton.disabled = true;
  status.textContent = "Otoyaを確認中です";
  let otoyaVoice = getOtoyaVoice();

  for (let attempt = 0; !otoyaVoice && attempt < 8; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    otoyaVoice = getOtoyaVoice();
  }

  otoyaButton.disabled = false;
  if (!otoyaVoice) {
    status.textContent = "BluefyからOtoyaを使用できません。現在はKyokoのみです。";
    return;
  }

  voiceSelect.value = otoyaVoice.voiceURI;
  updateVoiceName();
  speak(otoyaVoice);
}

speakButton.addEventListener("click", speak);
otoyaButton.addEventListener("click", tryOtoya);
voiceSelect.addEventListener("change", updateVoiceName);
window.speechSynthesis?.addEventListener("voiceschanged", populateVoiceOptions);
populateVoiceOptions();
