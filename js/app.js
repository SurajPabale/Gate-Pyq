(() => {
  const byId = (id) => document.getElementById(id);
  const timer = byId("study-timer");
  const todayTime = byId("today-time");
  const goalTimeLabel = byId("goal-time-label");
  const goalProgressFill = byId("goal-progress-fill");
  const goalRing = document.querySelector(".goal-ring");
  const goalPercent = document.querySelector(".goal-ring-inner strong");
  const startedAt = Date.now();
  const localDate = new Date();
  const storageKey = `gateprep-study-seconds-${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;

  function updateDate() {
    const date = byId("current-date");
    if (!date) return;
    date.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date()).toUpperCase();
  }

  function updateStudyTime() {
    const sessionSeconds = Math.floor((Date.now() - startedAt) / 1000);
    const previousSeconds = Number(localStorage.getItem(storageKey)) || 0;
    const totalSeconds = previousSeconds + sessionSeconds;
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    if (timer) timer.textContent = `${hours}:${minutes}:${seconds}`;

    const todayMinutes = Math.floor(totalSeconds / 60);
    if (todayTime) todayTime.innerHTML = `${todayMinutes}<span>m</span>`;
    if (goalTimeLabel) goalTimeLabel.textContent = `${Math.min(todayMinutes, 120)} / 120 min`;
    const percentage = Math.min(Math.round((todayMinutes / 120) * 100), 100);
    if (goalProgressFill) goalProgressFill.style.width = `${percentage}%`;
    if (goalRing) goalRing.style.background = `conic-gradient(#a78bfa ${percentage * 3.6}deg,#282b36 ${percentage * 3.6}deg 360deg)`;
    if (goalPercent) goalPercent.innerHTML = `${percentage}<span>%</span>`;
  }

  function setupNavigation() {
    const sidebar = byId("sidebar");
    const toggle = byId("menu-toggle");
    const overlay = byId("mobile-overlay");
    if (!sidebar || !toggle || !overlay) return;

    const closeMenu = () => {
      sidebar.classList.remove("is-open");
      overlay.classList.remove("visible");
      toggle.setAttribute("aria-expanded", "false");
    };
    toggle.addEventListener("click", () => {
      const isOpen = sidebar.classList.toggle("is-open");
      overlay.classList.toggle("visible", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
    overlay.addEventListener("click", closeMenu);
    sidebar.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }

  async function loadTopics() {
    const container = byId("topic-chips");
    try {
      const [syllabusResponse, questionResponse] = await Promise.all([
        fetch("data/syllabus.json"),
        fetch("data/questions.json"),
      ]);
      if (!syllabusResponse.ok) throw new Error(`Unable to load syllabus (${syllabusResponse.status})`);
      if (!questionResponse.ok) throw new Error(`Unable to load question bank (${questionResponse.status})`);
      const syllabus = await syllabusResponse.json();
      const questionBank = await questionResponse.json();
      const topics = [
        ...syllabus.XL.sections.flatMap((section) => section.topics.map((topic) => ({ topic, course: "XL" }))),
        ...syllabus.BT.sections.flatMap((section) => section.topics.map((topic) => ({ topic, course: "BT" }))),
      ];

      if (container) {
        container.replaceChildren(...topics.slice(0, 8).map(({ topic, course }) => {
          const link = document.createElement("a");
          link.className = "topic-chip";
          link.href = `topic-test.html?course=${course}&topic=${encodeURIComponent(topic)}`;
          const name = document.createTextNode(topic);
          const badge = document.createElement("em");
          badge.textContent = course;
          link.append(name, badge);
          return link;
        }));
      }

      const sectionsContainer = byId("syllabus-sections");
      if (sectionsContainer) {
        const requestedCourse = new URLSearchParams(window.location.search).get("course");
        const courses = requestedCourse && syllabus[requestedCourse] ? [requestedCourse] : ["XL", "BT"];
        sectionsContainer.replaceChildren(...courses.flatMap((course) => syllabus[course].sections.map((section) => {
          const article = document.createElement("article");
          article.className = "syllabus-section";
          const heading = document.createElement("div");
          heading.className = "syllabus-heading";
          const title = document.createElement("h3");
          title.textContent = section.name;
          const code = document.createElement("span");
          code.textContent = `${course} · syllabus outline`;
          heading.append(title, code);
          article.append(heading);
          section.topics.forEach((topic) => {
            const link = document.createElement("a");
            link.className = "topic-chip";
            link.href = `topic-test.html?course=${course}&topic=${encodeURIComponent(topic)}`;
            link.textContent = topic;
            article.append(link);
          });
          return article;
        })));
      }

      const practiceTopic = byId("practice-topic");
      const practiceCount = byId("practice-count");
      const practiceForm = byId("practice-form");
      const bankWarning = byId("bank-warning");
      if (practiceTopic && practiceCount && practiceForm && bankWarning) {
        const availableTopics = [...new Set(questionBank.questions.flatMap((question) => [question.topic, question.subtopic].filter(Boolean)))];
        practiceTopic.replaceChildren(...availableTopics.map((topic) => {
          const option = document.createElement("option");
          option.value = topic;
          option.textContent = topic;
          return option;
        }));
        const selectedTopic = new URLSearchParams(window.location.search).get("topic");
        if (availableTopics.includes(selectedTopic)) practiceTopic.value = selectedTopic;
        const updateCountOptions = () => {
          const count = questionBank.questions.filter((question) => question.topic === practiceTopic.value || question.subtopic === practiceTopic.value).length;
          practiceCount.replaceChildren(...Array.from({ length: count }, (_, index) => {
            const option = document.createElement("option");
            option.value = String(index + 1);
            option.textContent = `${index + 1} ${index === 0 ? "question" : "questions"}`;
            return option;
          }));
        };
        practiceTopic.addEventListener("change", updateCountOptions);
        updateCountOptions();
        bankWarning.textContent = `${questionBank.bankStatus}: ${questionBank.notice} The current bank has ${questionBank.questions.length} sample questions and cannot supply a full-length mock.`;
        practiceForm.addEventListener("submit", (event) => {
          event.preventDefault();
          const types = [...practiceForm.querySelectorAll('input[name="practice-type"]:checked')].map((input) => input.value);
          if (!types.length) {
            bankWarning.textContent = "Select at least one question format.";
            return;
          }
          const params = new URLSearchParams({
            mode: "topic",
            topic: practiceTopic.value,
            count: practiceCount.value,
            duration: practiceForm.querySelector("#practice-duration").value,
            types: types.join(","),
            attempt: crypto.randomUUID(),
          });
          window.location.href = `daily-mock.html?${params}`;
        });
      }
    } catch (error) {
      if (container) container.textContent = "Syllabus topics are unavailable right now.";
      const sectionsContainer = byId("syllabus-sections");
      if (sectionsContainer) sectionsContainer.textContent = "Syllabus topics are unavailable right now.";
      console.error(error);
    }
  }

  function updatePracticeSummary() {
    try {
      const savedResults = JSON.parse(localStorage.getItem("gateprep-results") || "[]");
      if (!Array.isArray(savedResults)) throw new TypeError("Saved test history has an invalid format.");
      const answered = savedResults.reduce((sum, result) => sum + (Number(result.answered) || 0), 0);
      const correct = savedResults.reduce((sum, result) => sum + (Number(result.correct) || 0), 0);
      const questionCount = byId("questions-count");
      const accuracy = byId("accuracy-value");
      if (questionCount) questionCount.textContent = String(answered);
      if (accuracy) accuracy.textContent = answered ? String(Math.round((correct / answered) * 100)) : "—";
    } catch (error) {
      console.error("Unable to load your practice summary.", error);
    }
  }

  function syncDateOnResume() {
    window.addEventListener("pageshow", () => {
      const date = byId("current-date");
      if (date) updateDate();
      updateStudyTime();
    });
  }

  updateDate();
  updateStudyTime();
  window.setInterval(updateStudyTime, 1000);
  window.addEventListener("pagehide", () => {
    const previousSeconds = Number(localStorage.getItem(storageKey)) || 0;
    localStorage.setItem(storageKey, String(previousSeconds + Math.floor((Date.now() - startedAt) / 1000)));
  }, { once: true });
  setupNavigation();
  updatePracticeSummary();
  syncDateOnResume();
  loadTopics();
})();
