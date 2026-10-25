(() => {
  const historyContainer = document.getElementById("result-history");
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem("gateprep-results") || "[]");
    if (!Array.isArray(history)) throw new TypeError("Saved test history has an invalid format.");
  } catch (error) {
    console.error("Unable to read saved test results.", error);
    historyContainer.textContent = "Saved results could not be loaded in this browser.";
    return;
  }

  const questionsAnswered = history.reduce((total, result) => total + (Number(result.answered) || 0), 0);
  const totalCorrect = history.reduce((total, result) => total + (Number(result.correct) || 0), 0);
  document.getElementById("result-tests").textContent = String(history.length);
  document.getElementById("result-answered").textContent = String(questionsAnswered);
  document.getElementById("result-accuracy").textContent = questionsAnswered
    ? String(Math.round((totalCorrect / questionsAnswered) * 100))
    : "—";
  document.getElementById("result-score").textContent = history.length ? String(history[0].score ?? "—") : "—";

  if (!history.length) return;
  historyContainer.replaceChildren(...history.map((result) => {
    const card = document.createElement("article");
    card.className = "history-card";
    const heading = document.createElement("div");
    heading.className = "history-heading";
    const title = document.createElement("strong");
    title.textContent = result.title || "Practice test";
    const date = document.createElement("span");
    date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(result.date));
    heading.append(title, date);

    const breakdown = document.createElement("p");
    breakdown.textContent = `${result.correct || 0} correct · ${result.answered || 0} answered · ${result.total || 0} questions`;
    card.append(heading, breakdown);
    if (Array.isArray(result.questions)) {
      result.questions.forEach((question, index) => {
        const detail = document.createElement("details");
        detail.className = "explanation-item";
        const summary = document.createElement("summary");
        summary.textContent = `Q${index + 1} · ${question.isCorrect ? "Correct" : "Review"} · ${question.type}`;
        const explanation = document.createElement("p");
        explanation.textContent = `${question.explanation} Correct answer: ${question.answer.join(", ")}.`;
        detail.append(summary, explanation);
        card.append(detail);
      });
    }
    return card;
  }));
})();
