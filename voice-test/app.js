const speakButton = document.querySelector("#speakButton");
const status = document.querySelector("#status");
const voiceName = document.querySelector("#voiceName");
const firstPhrase = "はい。";
const secondPhrase = "どうしましたか。";

function getJapaneseVoice() {
  const voices = window.speechSynthesis.getVoices();
  const japaneseVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("ja"));
  const maleVoice = japaneseVoices.find((voice) => /otoya|\bmale\b|男性|男/i.test(voice.name));
  return maleVoice || japaneseVoices[0] || null;
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

function createUtterance(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getJapaneseVoice();
  utterance.lang = "ja-JP";
  utterance.rate = 1.04;
  utterance.pitch = voice && /otoya|\bmale\b|男性|男/i.test(voice.name) ? 0.96 : 0.82;
  utterance.volume = 1;
  if (voice) utterance.voice = voice;
  return utterance;
}

function speak() {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;

  const firstUtterance = createUtterance(firstPhrase);
  const secondUtterance = createUtterance(secondPhrase);

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

speakButton.addEventListener("click", speak);
window.speechSynthesis?.addEventListener("voiceschanged", updateVoiceName);
updateVoiceName();
