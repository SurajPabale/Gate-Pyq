(() => {
  const display = document.getElementById("quiz-timer");
  if (!display) return;
  let interval;
  let activeKey;
  let hasExpired = false;

  function startTimer(attemptId, endAt) {
    window.clearInterval(interval);
    activeKey = `gateprep-timer-${attemptId}`;
    let deadline = endAt;
    try {
      const saved = JSON.parse(localStorage.getItem(activeKey) || "null");
      if (saved && Number.isFinite(saved.endAt)) deadline = saved.endAt;
      localStorage.setItem(activeKey, JSON.stringify({ endAt: deadline }));
    } catch (error) {
      console.error("Unable to persist the test timer.", error);
    }

    hasExpired = false;
    const render = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      const hours = String(Math.floor(left / 3600)).padStart(2, "0");
      const minutes = String(Math.floor((left % 3600) / 60)).padStart(2, "0");
      const seconds = String(left % 60).padStart(2, "0");
      display.textContent = `${hours}:${minutes}:${seconds}`;
      if (left === 0 && !hasExpired) {
        hasExpired = true;
        window.clearInterval(interval);
        document.dispatchEvent(new CustomEvent("gateprep:timeup"));
      }
    };
    render();
    interval = window.setInterval(render, 1000);
  }

  window.addEventListener("gateprep:timer-start", (event) => {
    startTimer(event.detail.attemptId, event.detail.endAt);
  });
})();
