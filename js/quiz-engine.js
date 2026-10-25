(() => {
  const root = document.getElementById("quiz-root");
  if (!root) return;

  const questions = [
    { type: "MCQ", text: "Which bond primarily stabilizes the α-helix structure in a protein?", options: ["Hydrogen bond", "Disulfide bond", "Peptide bond", "Ionic bond"], answer: ["Hydrogen bond"], explanation: "The α-helix is stabilized by hydrogen bonds between backbone carbonyl and amide groups." },
    { type: "MSQ", text: "Which of the following are pyrimidine bases found in nucleic acids?", options: ["Cytosine", "Adenine", "Thymine", "Guanine"], answer: ["Cytosine", "Thymine"], explanation: "Cytosine and thymine are pyrimidines; adenine and guanine are purines." },
    { type: "NAT", text: "A solution contains 0.5 mol of solute in 2 L. What is its concentration in mol L⁻¹?", answer: ["0.25"], explanation: "Molarity is moles of solute divided by solution volume: 0.5 / 2 = 0.25 mol L⁻¹." },
    { type: "MCQ", text: "Which enzyme synthesizes RNA using a DNA template during transcription?", options: ["DNA ligase", "RNA polymerase", "Reverse transcriptase", "DNA primase"], answer: ["RNA polymerase"], explanation: "RNA polymerase reads the DNA template strand and catalyzes RNA synthesis." },
    { type: "MCQ", text: "In Michaelis–Menten kinetics, Km is the substrate concentration at which the reaction velocity is:", options: ["Vmax", "Vmax / 2", "2Vmax", "Zero"], answer: ["Vmax / 2"], explanation: "Km is defined as the substrate concentration at which velocity reaches half of Vmax." },
  ];
  const totalQuestions = 65;
  const palette = document.getElementById("question-palette");
  const title = document.getElementById("question-title");
  const optionsContainer = document.getElementById("question-options");
  const numberLabel = document.getElementById("question-number");
  const totalLabel = document.getElementById("question-total");
  const typeLabel = document.getElementById("question-type");
  const summary = document.getElementById("answer-summary");
  const state = Array.from({ length: totalQuestions }, (_, index) => ({
    status: "not-visited",
    answers: [],
    questionIndex: index % questions.length,
  }));
  let current = 0;

  function renderPalette() {
    palette.replaceChildren(...state.map((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `palette-question ${item.status}`;
      button.textContent = String(index + 1);
      button.setAttribute("aria-label", `Question ${index + 1}: ${item.status.replace("-", " ")}`);
      button.setAttribute("aria-current", index === current ? "true" : "false");
      button.addEventListener("click", () => { current = index; renderQuestion(); });
      return button;
    }));
    const answered = state.filter((item) => item.answers.length).length;
    summary.textContent = `${answered} answered · ${state.filter((item) => item.status === "marked").length} marked`;
  }

  function updateAnswerStatus(item) {
    if (item.status === "marked") return;
    item.status = item.answers.length ? "answered" : "visited";
  }

  function renderQuestion() {
    const item = state[current];
    const question = questions[item.questionIndex];
    item.status = item.status === "not-visited" ? "visited" : item.status;
    numberLabel.textContent = String(current + 1);
    totalLabel.textContent = String(totalQuestions);
    title.textContent = question.text;
    typeLabel.textContent = question.type;
    optionsContainer.replaceChildren();

    if (question.type === "NAT") {
      const input = document.createElement("input");
      input.className = "nat-input";
      input.type = "number";
      input.step = "any";
      input.placeholder = "Enter your numerical answer";
      input.value = item.answers[0] || "";
      input.setAttribute("aria-label", "Numerical answer");
      input.addEventListener("input", () => {
        item.answers = input.value ? [input.value] : [];
        updateAnswerStatus(item);
        renderPalette();
      });
      optionsContainer.append(input);
    } else {
      const isMulti = question.type === "MSQ";
      question.options.forEach((option) => {
        const label = document.createElement("label");
        label.className = "quiz-option";
        const input = document.createElement("input");
        input.type = isMulti ? "checkbox" : "radio";
        input.name = `question-${current}`;
        input.value = option;
        input.checked = item.answers.includes(option);
        input.addEventListener("change", () => {
          item.answers = isMulti
            ? [...optionsContainer.querySelectorAll("input:checked")].map((checked) => checked.value)
            : [option];
          updateAnswerStatus(item);
          renderPalette();
        });
        const marker = document.createElement("span");
        marker.className = "option-marker";
        marker.textContent = option;
        label.append(input, marker);
        optionsContainer.append(label);
      });
    }
    renderPalette();
  }

  function saveAndNext() {
    if (state[current].answers.length && state[current].status !== "marked") state[current].status = "answered";
    current = Math.min(current + 1, totalQuestions - 1);
    renderQuestion();
  }

  function submitTest() {
    const answered = state.filter((item) => item.answers.length);
    const correct = answered.filter((item) => {
      const expected = questions[item.questionIndex].answer;
      return item.answers.length === expected.length && item.answers.every((answer) => expected.includes(answer));
    });
    const result = {
      date: new Date().toISOString(),
      title: "Daily mock test",
      total: totalQuestions,
      answered: answered.length,
      correct: correct.length,
      score: correct.length,
      questions: state.map((item) => ({
        type: questions[item.questionIndex].type,
        text: questions[item.questionIndex].text,
        selected: item.answers,
        answer: questions[item.questionIndex].answer,
        explanation: questions[item.questionIndex].explanation,
        isCorrect: item.answers.length === questions[item.questionIndex].answer.length
          && item.answers.every((answer) => questions[item.questionIndex].answer.includes(answer)),
      })),
    };
    try {
      const history = JSON.parse(localStorage.getItem("gateprep-results") || "[]");
      history.unshift(result);
      localStorage.setItem("gateprep-results", JSON.stringify(history));
      localStorage.removeItem("gateprep-active-test");
      window.location.href = "result.html";
    } catch (error) {
      console.error("Unable to save your test result.", error);
      window.alert("Your result could not be saved in this browser. Please check your storage settings and try again.");
    }
  }

  document.getElementById("next-question").addEventListener("click", saveAndNext);
  document.getElementById("previous-question").addEventListener("click", () => {
    current = Math.max(current - 1, 0);
    renderQuestion();
  });
  document.getElementById("mark-review").addEventListener("click", () => {
    if (state[current].status === "marked") {
      state[current].status = state[current].answers.length ? "answered" : "visited";
    } else {
      state[current].status = "marked";
    }
    saveAndNext();
  });
  document.getElementById("submit-test").addEventListener("click", () => {
    if (window.confirm("Submit this test and view your result?")) submitTest();
  });
  document.addEventListener("gateprep:timeup", submitTest);
  renderQuestion();
})();
