const speakButton = document.querySelector("#speakButton");
const status = document.querySelector("#status");
const voiceName = document.querySelector("#voiceName");
const phrase = "はい、どうしましたか。";

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

function speak() {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;

  const utterance = new SpeechSynthesisUtterance(phrase);
  const voice = getJapaneseVoice();
  utterance.lang = "ja-JP";
  utterance.rate = 0.88;
  utterance.pitch = voice && /otoya|\bmale\b|男性|男/i.test(voice.name) ? 0.92 : 0.72;
  utterance.volume = 1;
  if (voice) utterance.voice = voice;

  utterance.addEventListener("start", () => {
    status.textContent = "読み上げ中です";
  });
  utterance.addEventListener("end", () => {
    status.textContent = "読み上げが終わりました";
  });
  utterance.addEventListener("error", () => {
    status.textContent = "読み上げを開始できませんでした";
  });

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

speakButton.addEventListener("click", speak);
window.speechSynthesis?.addEventListener("voiceschanged", updateVoiceName);
updateVoiceName();
