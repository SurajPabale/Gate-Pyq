(() => {
  const display = document.getElementById("quiz-timer");
  if (!display) return;
  const durationSeconds = Number(display.dataset.duration) || 3 * 60 * 60;
  const storageKey = "gateprep-active-test";
  let endAt;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    endAt = saved && saved.endAt > Date.now() ? saved.endAt : Date.now() + durationSeconds * 1000;
    localStorage.setItem(storageKey, JSON.stringify({ endAt }));
  } catch (error) {
    console.error("Unable to restore the test timer.", error);
    endAt = Date.now() + durationSeconds * 1000;
  }

  const render = () => {
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    const hours = String(Math.floor(left / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((left % 3600) / 60)).padStart(2, "0");
    const seconds = String(left % 60).padStart(2, "0");
    display.textContent = `${hours}:${minutes}:${seconds}`;
    if (left === 0) {
      window.clearInterval(interval);
      document.dispatchEvent(new CustomEvent("gateprep:timeup"));
    }
  };
  render();
  const interval = window.setInterval(render, 1000);
})();
