const elements = {
  batteryFill: document.querySelector("#batteryFill"),
  batteryPercent: document.querySelector("#batteryPercent"),
  chargingText: document.querySelector("#chargingText"),
  status: document.querySelector("#status"),
  refreshButton: document.querySelector("#refreshButton"),
};

let batteryManager = null;

elements.refreshButton.addEventListener("click", loadPhoneBattery);
loadPhoneBattery();

async function loadPhoneBattery() {
  if (typeof navigator.getBattery !== "function") {
    elements.status.textContent = "BluefyはiPhone本体の残量取得を公開していません";
    elements.chargingText.textContent = "取得不可";
    elements.refreshButton.disabled = true;
    return;
  }

  elements.status.textContent = "残量を確認しています";
  try {
    if (!batteryManager) {
      batteryManager = await navigator.getBattery();
      batteryManager.addEventListener("levelchange", updateBatteryDisplay);
      batteryManager.addEventListener("chargingchange", updateBatteryDisplay);
    }
    updateBatteryDisplay();
  } catch {
    elements.status.textContent = "iPhone本体の残量を取得できませんでした";
    elements.chargingText.textContent = "取得不可";
  }
}

function updateBatteryDisplay() {
  if (!batteryManager) return;

  const percent = Math.round(batteryManager.level * 100);
  elements.batteryPercent.textContent = `${percent}%`;
  elements.batteryFill.style.width = `${percent}%`;
  elements.batteryFill.style.backgroundColor = percent <= 20 ? "#df4b4b" : percent <= 45 ? "#d69018" : "#16834b";
  elements.chargingText.textContent = batteryManager.charging ? "充電中" : "バッテリー使用中";
  elements.status.textContent = "iPhone本体の残量を取得できました";
}
