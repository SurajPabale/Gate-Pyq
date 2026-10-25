(() => {
  const frame = document.getElementById("app-frame");
  const summary = document.getElementById("summary");
  const resultList = document.getElementById("test-results");
  const tests = [];

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function currentPath() {
    return frame.contentWindow.location.pathname;
  }

  function equal(actual, expected, message) {
    assert(Object.is(actual, expected), `${message} (expected ${expected}; got ${actual})`);
  }

  function waitFor(predicate, message, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = window.setInterval(() => {
        try {
          if (predicate()) {
            window.clearInterval(interval);
            resolve();
          } else if (Date.now() - start > timeout) {
            window.clearInterval(interval);
            reject(new Error(`Timed out waiting for ${message}`));
          }
        } catch (error) {
          window.clearInterval(interval);
          reject(error);
        }
      }, 50);
    });
  }

  async function navigate(path, ready) {
    const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
    frame.src = path;
    await loaded;
    await waitFor(() => ready(frame.contentDocument), `page ready: ${path}`);
    frame.contentWindow.confirm = () => true;
    return frame.contentDocument;
  }

  async function beginTopicTest({ topic = "Biochemistry", count = 5, types = ["MCQ", "MSQ", "NAT"], duration = 15, expired = false } = {}) {
    const attempt = `browser-test-${crypto.randomUUID()}`;
    if (expired) localStorage.setItem(`gateprep-timer-${attempt}`, JSON.stringify({ endAt: Date.now() - 1000 }));
    const query = new URLSearchParams({
      mode: "topic",
      topic,
      count: String(count),
      duration: String(duration),
      types: types.join(","),
      attempt,
    });
    const doc = await navigate(`../daily-mock.html?${query}`, (page) =>
      page.querySelector("#question-total")?.textContent === String(count)
      && !page.querySelector("#submit-test")?.disabled);
    return { attempt, doc, win: frame.contentWindow };
  }

  async function selectOption(doc, option, checked = true) {
    const input = [...doc.querySelectorAll("#question-options input")].find((item) => item.value === option);
    assert(input, `option exists: ${option}`);
    input.checked = checked;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function goToPaletteQuestion(doc, number) {
    const button = doc.querySelectorAll(".palette-question")[number - 1];
    assert(button, `palette question ${number} exists`);
    button.click();
    await waitFor(() => doc.querySelector("#question-number")?.textContent === String(number), `question ${number}`);
  }

  function timerSeconds(doc) {
    return doc.querySelector("#quiz-timer").textContent.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  }

  async function submitAndReadResult(doc) {
    doc.querySelector("#submit-test").click();
    await waitFor(() => currentPath().endsWith("/result.html"), "result navigation");
    const resultDoc = frame.contentDocument;
    await waitFor(() => resultDoc.querySelectorAll(".history-card").length > 0, "result rendering");
    return resultDoc;
  }

  function addTest(name, run) {
    tests.push({ name, run });
  }

  addTest("Question bank count and unverified status", async () => {
    const bank = await (await fetch("../data/questions.json")).json();
    equal(bank.questions.length, 5, "Question bank contains five sample questions");
    equal(bank.bankStatus, "DEMO_UNVERIFIED", "Question bank remains explicitly unverified");
    assert(bank.questions.every((question) => question.verificationStatus === "NEEDS REVIEW"), "Each sample question needs review");
    return "5 illustrative questions; no question claims verification.";
  });

  addTest("Topic filtering and configurable topic practice", async () => {
    const doc = await navigate("../topic-test.html", (page) => page.querySelector("#practice-topic option[value='Protein structure']"));
    const topic = doc.querySelector("#practice-topic");
    const count = doc.querySelector("#practice-count");
    topic.value = "Protein structure";
    topic.dispatchEvent(new Event("change", { bubbles: true }));
    equal(count.options.length, 1, "Topic question count reflects filtered bank");
    doc.querySelector("#practice-form").requestSubmit();
    await waitFor(() => currentPath().endsWith("/daily-mock.html"), "topic practice start");
    const quiz = frame.contentDocument;
    await waitFor(() => quiz.querySelector("#question-total")?.textContent === "1", "filtered quiz question");
    assert(quiz.querySelector("#question-subtopic").textContent.includes("Protein structure"), "The selected subtopic is active");
    return "Protein structure resolves to its single matching sample.";
  });

  addTest("MCQ, exact-set MSQ, NAT, scoring, and negative marking", async () => {
    const { doc, attempt } = await beginTopicTest();
    equal(doc.querySelector("#question-type").textContent, "MCQ", "Question one is MCQ");
    await selectOption(doc, "Disulfide bond");
    doc.querySelector("#next-question").click();
    equal(doc.querySelector("#question-type").textContent, "MSQ", "Question two is MSQ");
    await selectOption(doc, "Cytosine");
    await selectOption(doc, "Thymine");
    doc.querySelector("#mark-review").click();
    equal(JSON.parse(localStorage.getItem(`gateprep-test-${attempt}`)).answers["demo-bio-002"].status, "marked", "Marked answer remains marked");
    await goToPaletteQuestion(doc, 3);
    equal(doc.querySelector("#question-type").textContent, "NAT", "Question three is NAT");
    const nat = doc.querySelector("#question-options input");
    nat.value = "0.25";
    nat.dispatchEvent(new Event("input", { bubbles: true }));
    doc.querySelector("#next-question").click();
    await selectOption(doc, "RNA polymerase");
    doc.querySelector("#next-question").click();
    await selectOption(doc, "Vmax");

    const result = await submitAndReadResult(doc);
    const saved = JSON.parse(localStorage.getItem("gateprep-results"))[0];
    equal(saved.answered, 5, "All five responses are recorded");
    equal(saved.correct, 3, "Correct MCQ/MSQ/NAT responses are counted");
    equal(saved.questions[0].marksAwarded, -1 / 3, "Incorrect MCQ receives one-third penalty");
    equal(saved.questions[1].marksAwarded, 1, "Exact-set MSQ receives full credit");
    equal(saved.questions[2].marksAwarded, 1, "Exact NAT answer receives full credit");
    equal(saved.questions[4].marksAwarded, -1 / 3, "Second incorrect MCQ receives one-third penalty");
    equal(saved.score, 2.33, "Total marks are rounded and recorded");
    assert([...result.querySelectorAll(".explanation-item")].some((item) => item.textContent.includes("Your response: Disulfide bond") && item.textContent.includes("Correct answer: Hydrogen bond")), "Result explanation shows response and answer");
    assert([...result.querySelectorAll(".explanation-item")].every((item) => item.textContent.includes("Verification: NEEDS REVIEW")), "Results disclose review status");
    return "3/5 correct; exact-set MSQ/NAT credit; negative marking; response explanations rendered.";
  });

  addTest("MSQ subset is not credited", async () => {
    const { doc } = await beginTopicTest({ topic: "Nucleic acids", count: 1, types: ["MSQ"] });
    await selectOption(doc, "Cytosine");
    const result = await submitAndReadResult(doc);
    const saved = JSON.parse(localStorage.getItem("gateprep-results"))[0];
    equal(saved.correct, 0, "Incomplete MSQ set is incorrect");
    equal(saved.score, 0, "Incorrect MSQ receives no credit or penalty");
    assert(result.querySelector(".explanation-item").textContent.includes("Correct answer: Cytosine, Thymine"), "MSQ result reveals the complete correct set");
    return "Incomplete selection receives zero, with no negative mark.";
  });

  addTest("Incorrect NAT response receives no credit", async () => {
    const { doc } = await beginTopicTest({ topic: "Concentration calculations", count: 1, types: ["NAT"] });
    const input = doc.querySelector("#question-options input");
    input.value = "0.251";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await submitAndReadResult(doc);
    const saved = JSON.parse(localStorage.getItem("gateprep-results"))[0];
    equal(saved.correct, 0, "Incorrect NAT value is not accepted");
    equal(saved.score, 0, "Incorrect NAT receives no credit");
    return "NAT tolerance is applied from the bank; this sample uses exact matching.";
  });

  addTest("Clear response resets answer and palette status", async () => {
    const { doc, attempt } = await beginTopicTest({ count: 1, types: ["MCQ"] });
    await selectOption(doc, "Disulfide bond");
    doc.querySelector("#clear-response").click();
    const saved = JSON.parse(localStorage.getItem(`gateprep-test-${attempt}`));
    equal(saved.answers["demo-bio-001"].status, "visited", "Clear response leaves the question visited");
    equal(saved.answers["demo-bio-001"].value.length, 0, "Clear response removes selected values");
    equal(doc.querySelector(".palette-question").className, "palette-question visited", "Palette reflects cleared response");
    return "Response is cleared and status is not marked answered.";
  });

  addTest("Refresh restores answers, position, palette, and timer deadline", async () => {
    const { doc, attempt } = await beginTopicTest();
    await selectOption(doc, "Hydrogen bond");
    await goToPaletteQuestion(doc, 2);
    const before = JSON.parse(localStorage.getItem(`gateprep-test-${attempt}`));
    const deadline = JSON.parse(localStorage.getItem(`gateprep-timer-${attempt}`)).endAt;
    const url = frame.src;
    const beforeSeconds = timerSeconds(doc);
    await navigate(url, (page) => page.querySelector("#question-total")?.textContent === "5");
    const restored = frame.contentDocument;
    equal(restored.querySelector("#question-number").textContent, "2", "Current question is restored");
    equal(restored.querySelector(".palette-question").className, "palette-question answered", "Answered palette state is restored");
    await goToPaletteQuestion(restored, 1);
    assert([...restored.querySelectorAll("#question-options input")].some((input) => input.checked), "Previous answer selection is restored");
    equal(JSON.parse(localStorage.getItem(`gateprep-test-${attempt}`)).endAt, before.endAt, "Attempt deadline remains unchanged");
    equal(JSON.parse(localStorage.getItem(`gateprep-timer-${attempt}`)).endAt, deadline, "Timer deadline remains unchanged");
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    assert(timerSeconds(restored) < beforeSeconds, "Restored countdown continues decreasing");
    return "Refresh preserves answer, position, palette, and deadline; countdown resumes.";
  });

  addTest("Expired timer submits the attempt automatically", async () => {
    const attempt = `browser-test-${crypto.randomUUID()}`;
    localStorage.setItem(`gateprep-timer-${attempt}`, JSON.stringify({ endAt: Date.now() - 1000 }));
    const query = new URLSearchParams({
      mode: "topic",
      topic: "Biochemistry",
      count: "1",
      duration: "15",
      types: "MCQ",
      attempt,
    });
    frame.src = `../daily-mock.html?${query}`;
    await waitFor(() => currentPath().endsWith("/result.html"), "automatic submission on expiry", 4000);
    const saved = JSON.parse(localStorage.getItem("gateprep-results"))[0];
    equal(saved.answered, 0, "Timed-out empty attempt is recorded with no answered questions");
    assert(!localStorage.getItem(`gateprep-test-${attempt}`), "Submitted timed-out session is cleared");
    return "A stored expired deadline triggers automatic submission.";
  });

  addTest("Mobile quiz layout has no horizontal page overflow", async () => {
    const { doc } = await beginTopicTest({ count: 5 });
    equal(doc.documentElement.scrollWidth, doc.documentElement.clientWidth, "Quiz document fits the mobile viewport");
    return `${doc.documentElement.clientWidth}px viewport; no horizontal overflow.`;
  });

  window.runBrowserTests = async () => {
    const originalStorage = new Map();
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key.startsWith("gateprep-")) originalStorage.set(key, localStorage.getItem(key));
    }
    const existingGateprepKeys = new Set(originalStorage.keys());
    for (const key of existingGateprepKeys) localStorage.removeItem(key);

    resultList.replaceChildren();
    summary.textContent = "Running…";
    let passed = 0;
    try {
      for (const test of tests) {
        const item = document.createElement("li");
        try {
          const detail = await test.run();
          passed += 1;
          item.className = "pass";
          item.textContent = `PASS: ${test.name} - ${detail}`;
        } catch (error) {
          item.className = "fail";
          item.textContent = `FAIL: ${test.name} - ${error.message}`;
        }
        resultList.append(item);
      }
    } finally {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key.startsWith("gateprep-")) localStorage.removeItem(key);
      }
      for (const [key, value] of originalStorage) localStorage.setItem(key, value);
      frame.removeAttribute("src");
    }
    const failed = tests.length - passed;
    summary.textContent = `${passed}/${tests.length} passed${failed ? `; ${failed} failed` : ""}. Existing GATEprep browser storage restored.`;
    return { passed, failed, results: [...resultList.children].map((item) => item.textContent) };
  };

  document.getElementById("run-tests").addEventListener("click", () => window.runBrowserTests());
})();
