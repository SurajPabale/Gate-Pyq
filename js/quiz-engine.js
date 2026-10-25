(() => {
  const root = document.getElementById("quiz-root");
  if (!root) return;

  const attemptId = new URLSearchParams(window.location.search).get("attempt") || "demo";
  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get("mode") || "demo";
  const requestedTopic = params.get("topic");
  const requestedTypes = (params.get("types") || "MCQ,MSQ,NAT").split(",").filter((type) => ["MCQ", "MSQ", "NAT"].includes(type));
  const requestedCount = Math.max(1, Number.parseInt(params.get("count") || "5", 10) || 5);
  const durationMinutes = Math.max(1, Math.min(90, Number.parseInt(params.get("duration") || "15", 10) || 15));
  const storageKey = `gateprep-test-${attemptId}`;
  const elements = {
    title: document.getElementById("question-title"),
    subtopic: document.getElementById("question-subtopic"),
    options: document.getElementById("question-options"),
    number: document.getElementById("question-number"),
    total: document.getElementById("question-total"),
    type: document.getElementById("question-type"),
    summary: document.getElementById("answer-summary"),
    palette: document.getElementById("question-palette"),
    warning: document.getElementById("test-warning"),
    submit: document.getElementById("submit-test"),
    previous: document.getElementById("previous-question"),
    next: document.getElementById("next-question"),
  };
  let bank;
  let questions = [];
  let session;
  let isSubmitted = false;

  function showFailure(message, error) {
    elements.warning.textContent = message;
    root.hidden = true;
    elements.palette.textContent = "";
    console.error(error);
  }

  function saveSession() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(session));
    } catch (error) {
      elements.warning.textContent = "Progress could not be saved in this browser. Keep this tab open until you submit.";
      console.error("Unable to save your test progress.", error);
    }
  }

  function currentQuestion() {
    return questions[session.current];
  }

  function answerState(question) {
    return session.answers[question.id] || { status: "not-visited", value: [] };
  }

  function updateAnswer(question, values) {
    const previous = answerState(question);
    session.answers[question.id] = {
      status: previous.status === "marked" ? "marked" : values.length ? "answered" : "visited",
      value: values,
    };
    saveSession();
    renderPalette();
  }

  function renderPalette() {
    elements.palette.replaceChildren(...questions.map((question, index) => {
      const answer = answerState(question);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `palette-question ${answer.status}`;
      button.textContent = String(index + 1);
      button.setAttribute("aria-label", `Question ${index + 1}: ${answer.status.replaceAll("-", " ")}`);
      button.setAttribute("aria-current", index === session.current ? "true" : "false");
      button.addEventListener("click", () => {
        session.current = index;
        saveSession();
        renderQuestion();
      });
      return button;
    }));
    const answered = questions.filter((question) => answerState(question).value.length).length;
    const marked = questions.filter((question) => answerState(question).status === "marked").length;
    elements.summary.textContent = `${answered} answered · ${marked} marked`;
    elements.previous.disabled = session.current === 0;
    elements.next.textContent = session.current === questions.length - 1 ? "Save response" : "Save & next →";
  }

  function renderQuestion() {
    const question = currentQuestion();
    if (!question) return;
    const state = answerState(question);
    if (state.status === "not-visited") state.status = "visited";
    session.answers[question.id] = state;
    elements.number.textContent = String(session.current + 1);
    elements.total.textContent = String(questions.length);
    elements.title.textContent = question.text;
    elements.subtopic.textContent = `${question.topic}${question.subtopic ? ` · ${question.subtopic}` : ""} · ${question.marks} mark${question.marks === 1 ? "" : "s"}`;
    elements.type.textContent = question.type;
    elements.options.replaceChildren();

    if (question.type === "NAT") {
      const input = document.createElement("input");
      input.className = "nat-input";
      input.type = "number";
      input.step = "any";
      input.placeholder = "Enter your numerical answer";
      input.value = state.value[0] || "";
      input.setAttribute("aria-label", "Numerical answer");
      input.addEventListener("input", () => updateAnswer(question, input.value.trim() ? [input.value.trim()] : []));
      elements.options.append(input);
    } else {
      question.options.forEach((option) => {
        const label = document.createElement("label");
        label.className = "quiz-option";
        const input = document.createElement("input");
        input.type = question.type === "MSQ" ? "checkbox" : "radio";
        input.name = `question-${question.id}`;
        input.value = option;
        input.checked = state.value.includes(option);
        input.addEventListener("change", () => {
          const selected = question.type === "MSQ"
            ? [...elements.options.querySelectorAll("input:checked")].map((checked) => checked.value)
            : [option];
          updateAnswer(question, selected);
        });
        const text = document.createElement("span");
        text.className = "option-marker";
        text.textContent = option;
        label.append(input, text);
        elements.options.append(label);
      });
    }
    saveSession();
    renderPalette();
  }

  function isCorrect(question, selected) {
    if (question.type === "NAT") {
      const value = Number(selected[0]);
      const expected = Number(question.answer[0]);
      return selected.length === 1 && Number.isFinite(value) && Number.isFinite(expected)
        && Math.abs(value - expected) <= (Number(question.natTolerance) || 0);
    }
    return selected.length === question.answer.length && selected.every((answer) => question.answer.includes(answer));
  }

  function submitTest() {
    if (isSubmitted) return;
    isSubmitted = true;
    const outcomes = questions.map((question) => {
      const selected = answerState(question).value;
      const correct = selected.length > 0 && isCorrect(question, selected);
      const marks = correct ? Number(question.marks) : question.type === "MCQ" && selected.length ? -Number(question.marks) / 3 : 0;
      return {
        id: question.id,
        type: question.type,
        topic: question.topic,
        text: question.text,
        selected,
        answer: question.answer,
        explanation: question.explanation,
        correct,
        marksAwarded: marks,
        verificationStatus: question.verificationStatus || "NEEDS REVIEW",
        sourceReferences: question.sourceReferences || [],
        syllabusCode: question.syllabusCode || null,
      };
    });
    const answered = outcomes.filter((item) => item.selected.length);
    const result = {
      date: new Date().toISOString(),
      title: requestedMode === "topic" ? `${requestedTopic || "Topic"} practice` : "Practice session",
      mode: requestedMode,
      topic: requestedTopic || null,
      total: questions.length,
      answered: answered.length,
      correct: answered.filter((item) => item.correct).length,
      score: Number(outcomes.reduce((sum, item) => sum + item.marksAwarded, 0).toFixed(2)),
      maxScore: questions.reduce((sum, question) => sum + Number(question.marks), 0),
      scorePolicy: "Local practice simulation: exact-set MSQ, exact NAT tolerance from question bank, and one-third negative marking for incorrect MCQ. Not verified as official GATE scoring.",
      bankStatus: bank.bankStatus,
      durationMinutes,
      questions: outcomes,
    };

    try {
      const history = JSON.parse(localStorage.getItem("gateprep-results") || "[]");
      if (!Array.isArray(history)) throw new TypeError("Saved result history has an invalid format.");
      history.unshift(result);
      localStorage.setItem("gateprep-results", JSON.stringify(history));
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`gateprep-timer-${attemptId}`);
      window.location.href = "result.html";
    } catch (error) {
      isSubmitted = false;
      elements.warning.textContent = "Your result could not be saved. Check browser storage, then try submitting again.";
      console.error("Unable to save your test result.", error);
    }
  }

  function moveNext() {
    if (session.current < questions.length - 1) session.current += 1;
    saveSession();
    renderQuestion();
  }

  function initialize(data) {
    bank = data;
    const filtered = data.questions.filter((question) =>
      (!requestedTopic || question.topic.toLocaleLowerCase() === requestedTopic.toLocaleLowerCase()
        || (question.subtopic && question.subtopic.toLocaleLowerCase() === requestedTopic.toLocaleLowerCase()))
      && requestedTypes.includes(question.type));
    if (!filtered.length) {
      showFailure("No questions match this topic and format selection. Return to topic practice and choose another set.", new Error("No matching practice questions."));
      return;
    }

    let restored = null;
    try {
      restored = JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch (error) {
      console.error("Unable to restore saved test progress.", error);
    }
    const restoredQuestions = restored && Array.isArray(restored.questionIds)
      ? restored.questionIds.map((id) => filtered.find((question) => question.id === id)).filter(Boolean)
      : [];
    if (restoredQuestions.length && restoredQuestions.length === restored.questionIds.length) {
      questions = restoredQuestions;
      session = restored;
    } else {
      questions = filtered.slice(0, requestedCount);
      session = {
        attemptId,
        questionIds: questions.map((question) => question.id),
        current: 0,
        answers: {},
      };
    }
    session.current = Math.max(0, Math.min(session.current, questions.length - 1));
    elements.submit.disabled = false;
    elements.previous.disabled = false;
    elements.next.disabled = false;
    document.getElementById("mark-review").disabled = false;
    document.getElementById("clear-response").disabled = false;

    document.getElementById("test-mode-label").textContent = requestedMode === "topic" ? "TOPIC PRACTICE" : "DEMO PRACTICE";
    const testTitle = document.getElementById("test-title");
    testTitle.replaceChildren(
      document.createTextNode(requestedMode === "topic" ? `${requestedTopic || "Topic"} ` : "Practice "),
      Object.assign(document.createElement("span"), {
        textContent: requestedMode === "topic" ? "practice" : "session",
      }),
    );
    document.getElementById("test-subtitle").textContent = `${questions.length} available sample questions · ${durationMinutes} minute timer · MCQ, MSQ and NAT`;
    const bankWarning = `${data.bankStatus}: ${data.notice} This is not a full-length GATE mock.`;
    elements.warning.textContent = bankWarning;
    if (!session.endAt) session.endAt = Date.now() + durationMinutes * 60 * 1000;
    saveSession();
    window.dispatchEvent(new CustomEvent("gateprep:timer-start", { detail: { attemptId, endAt: session.endAt } }));
    renderQuestion();
  }

  document.getElementById("next-question").addEventListener("click", moveNext);
  document.getElementById("previous-question").addEventListener("click", () => {
    session.current = Math.max(0, session.current - 1);
    saveSession();
    renderQuestion();
  });
  document.getElementById("clear-response").addEventListener("click", () => {
    const question = currentQuestion();
    session.answers[question.id] = {
      status: "visited",
      value: [],
    };
    saveSession();
    renderQuestion();
  });
  document.getElementById("mark-review").addEventListener("click", () => {
    const question = currentQuestion();
    const state = answerState(question);
    state.status = state.status === "marked" ? (state.value.length ? "answered" : "visited") : "marked";
    session.answers[question.id] = state;
    moveNext();
  });
  document.getElementById("submit-test").addEventListener("click", () => {
    if (session && window.confirm("Submit this practice session and view your result?")) submitTest();
  });
  document.addEventListener("gateprep:timeup", submitTest);

  fetch("data/questions.json")
    .then((response) => {
      if (!response.ok) throw new Error(`Unable to load question bank (${response.status})`);
      return response.json();
    })
    .then(initialize)
    .catch((error) => showFailure("Could not load the practice questions. Run this app from a local web server, then reload.", error));
})();
