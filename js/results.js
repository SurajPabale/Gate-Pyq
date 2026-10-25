(() => {
  const historyContainer = document.getElementById("result-history");
  const formatMarks = (value) => Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(2);
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
  document.getElementById("result-score").textContent = history.length && history[0].scorePolicy
    ? String(history[0].score ?? "—")
    : "—";

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
    breakdown.textContent = result.scorePolicy
      ? `${result.correct || 0} correct · ${result.answered || 0} answered · ${result.total || 0} questions · ${result.score ?? 0} / ${result.maxScore ?? result.total ?? 0} marks`
      : `${result.correct || 0} correct · ${result.answered || 0} answered · ${result.total || 0} questions · legacy score (mark total unavailable)`;
    card.append(heading, breakdown);
    if (result.scorePolicy) {
      const policy = document.createElement("p");
      policy.className = "score-policy";
      policy.textContent = result.scorePolicy;
      card.append(policy);
    }
    if (Array.isArray(result.questions)) {
      result.questions.forEach((question, index) => {
        const detail = document.createElement("details");
        detail.className = "explanation-item";
        const summary = document.createElement("summary");
        const correct = question.correct ?? question.isCorrect ?? false;
        summary.textContent = `Q${index + 1} · ${correct ? "Correct" : "Review"} · ${question.type}${question.marksAwarded == null ? "" : ` · ${formatMarks(question.marksAwarded)} marks`}`;
        const explanation = document.createElement("p");
        const selected = question.selected.length ? question.selected.join(", ") : "Not answered";
        const source = Array.isArray(question.sourceReferences) && question.sourceReferences.length
          ? ` Sources: ${question.sourceReferences.join("; ")}.`
          : " No source references are recorded.";
        explanation.textContent = `${question.explanation} Your response: ${selected}. Correct answer: ${question.answer.join(", ")}. Verification: ${question.verificationStatus || "NEEDS REVIEW"}.${source}`;
        detail.append(summary, explanation);
        card.append(detail);
      });
    }
    return card;
  }));
})();
