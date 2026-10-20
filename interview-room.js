
const $ = (selector) => document.querySelector(selector);

const setupKey = "hireMindInterviewSetup";
let setup = {};

try {
  setup = JSON.parse(sessionStorage.getItem(setupKey) || "{}") || {};
} catch {
  setup = {};
}

const validTypes = ["Technical", "HR", "Mixed"];

setup.interviewType = validTypes.includes(setup.interviewType)
  ? setup.interviewType
  : "Technical";

setup.jobRole = setup.jobRole || "Software Developer";
setup.difficulty = setup.difficulty || "Intermediate";

const requestedDuration = Number(setup.duration);
const durationMinutes =
  Number.isFinite(requestedDuration) &&
  requestedDuration >= 1 &&
  requestedDuration <= 180
    ? requestedDuration
    : 30;

const requestedCount = Number(setup.questionCount);
const questionCount =
  Number.isFinite(requestedCount) &&
  requestedCount >= 1 &&
  requestedCount <= 30
    ? Math.floor(requestedCount)
    : 5;

const questionBank = [
  {
    type: "Technical",
    title: "Explain the difference between an array and a linked list.",
    description:
      "Discuss how they store data, their access patterns, and situations where you would use each one."
  },
  {
    type: "Technical",
    title: "What is the time complexity of binary search?",
    description:
      "Explain why binary search is efficient and what condition the input must satisfy."
  },
  {
    type: "Technical",
    title: "Explain the four pillars of Object-Oriented Programming.",
    description:
      "Describe encapsulation, abstraction, inheritance, and polymorphism with simple examples."
  },
  {
    type: "Technical",
    title: "How would you find duplicate elements in an array?",
    description:
      "Explain your approach, its time complexity, and any trade-offs."
  },
  {
    type: "Technical",
    title: "What is the difference between a process and a thread?",
    description:
      "Discuss execution, memory, and how they relate to operating systems."
  },
  {
    type: "HR",
    title: "Tell me about yourself.",
    description:
      "Give a concise introduction covering your education, skills, interests, and goals."
  },
  {
    type: "HR",
    title: "What is one challenge you faced and how did you handle it?",
    description:
      "Explain the situation, the action you took, and what you learned from it."
  },
  {
    type: "HR",
    title: "Why are you interested in this role?",
    description:
      "Connect your skills, interests, and learning goals to the role you selected."
  },
  {
    type: "HR",
    title: "How do you handle feedback?",
    description:
      "Describe how you use feedback to improve your work or learn something new."
  },
  {
    type: "HR",
    title: "Describe a time you worked with a team.",
    description:
      "Explain your contribution, how you collaborated, and what the outcome was."
  }
];

function makeQuestions() {
  const type = setup.interviewType;
  let pool;

  if (type === "Mixed") {
    const technical = questionBank.filter(q => q.type === "Technical");
    const hr = questionBank.filter(q => q.type === "HR");
    pool = [];

    while (pool.length < questionCount &&
           (technical.length || hr.length)) {
      if (technical.length && pool.length < questionCount) {
        pool.push(technical.shift());
      }

      if (hr.length && pool.length < questionCount) {
        pool.push(hr.shift());
      }
    }
  } else {
    pool = questionBank.filter(q => q.type === type);
  }

  const selected = pool.slice(0, questionCount);

  // Repeat demo questions if more questions were requested
  // than the sample question bank contains.
  while (selected.length < questionCount && pool.length) {
    selected.push(pool[selected.length % pool.length]);
  }

  return selected;
}

const questions = makeQuestions();
const answers = questions.map(() => "");

let currentIndex = 0;
let remainingSeconds = durationMinutes * 60;
let timerInterval = null;
let interviewEnded = false;
let startedAt = Date.now();
let elapsedAtEnd = 0;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function elapsedSeconds() {
  return Math.min(
    durationMinutes * 60,
    Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  );
}

function renderTimer() {
  $("#timer").textContent = formatTime(remainingSeconds);

  const timerCard = $(".timer-card");
  timerCard.classList.toggle(
    "warning",
    remainingSeconds <= 5 * 60 && remainingSeconds > 60
  );
  timerCard.classList.toggle("urgent", remainingSeconds <= 60);

  if (remainingSeconds <= 60) {
    $("#timerMessage").textContent = "Less than one minute remaining";
  } else if (remainingSeconds <= 5 * 60) {
    $("#timerMessage").textContent = "Five minutes or less";
  } else {
    $("#timerMessage").textContent = "Manage your time wisely";
  }
}

function countWords(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function isAnswered(index) {
  return answers[index].trim().length > 0;
}

function renderQuestionList() {
  const list = $("#questionList");
  list.innerHTML = "";

  questions.forEach((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-nav";
    button.classList.toggle("active", index === currentIndex);
    button.classList.toggle("answered", isAnswered(index));
    button.setAttribute(
      "aria-current",
      index === currentIndex ? "step" : "false"
    );

    const number = document.createElement("span");
    number.className = "question-index";
    number.textContent = isAnswered(index) ? "✓" : String(index + 1);

    const label = document.createElement("span");
    label.className = "question-nav-label";

    const title = document.createElement("strong");
    title.textContent = `Question ${index + 1}`;

    const status = document.createElement("small");
    status.textContent = isAnswered(index) ? "Answered" : question.type;

    label.append(title, status);
    button.append(number, label);

    button.addEventListener("click", () => {
      saveCurrentAnswer();
      currentIndex = index;
      renderQuestion();
    });

    list.append(button);
  });

  const answered = answers.filter(a => a.trim()).length;
  $("#progressBar").style.width =
    `${(answered / questions.length) * 100}%`;

  $("#questionCount").textContent =
    `${currentIndex + 1} / ${questions.length}`;
}

function renderQuestion() {
  const question = questions[currentIndex];

  $("#questionCategory").textContent = question.type;
  $("#questionNumber").textContent =
    `Question ${currentIndex + 1} of ${questions.length}`;
  $("#questionTitle").textContent = question.title;
  $("#questionDescription").textContent = question.description;
  $("#answerInput").value = answers[currentIndex];

  $("#previousBtn").disabled = currentIndex === 0;
  $("#nextBtn").textContent =
    currentIndex === questions.length - 1
      ? "Review / Finish →"
      : "Next Question →";

  updateAnswerStatus();
  renderQuestionList();
}

function updateAnswerStatus() {
  const text = $("#answerInput").value;
  const words = countWords(text);

  $("#wordCount").textContent = `${words} ${words === 1 ? "word" : "words"}`;
  $("#savedStatus").textContent = text.trim()
    ? "Answer kept in this session"
    : "Answer not entered";
}

function saveCurrentAnswer() {
  answers[currentIndex] = $("#answerInput").value;
}

function goNext() {
  saveCurrentAnswer();

  if (currentIndex < questions.length - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    renderQuestionList();
    openFinishModal(
      "Review your answers",
      "You are on the last question. You can finish now or continue reviewing your answers."
    );
  }
}

function goPrevious() {
  saveCurrentAnswer();

  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
}

function openFinishModal(title, message) {
  $("#modalTitle").textContent = title;
  $("#modalMessage").textContent = message;
  $("#confirmModal").classList.remove("hidden");
  $("#confirmFinishBtn").focus();
}

function closeFinishModal() {
  $("#confirmModal").classList.add("hidden");
}

function finishInterview() {
  if (interviewEnded) return;

  saveCurrentAnswer();
  interviewEnded = true;
  elapsedAtEnd = elapsedSeconds();

  clearInterval(timerInterval);

  const answered = answers.filter(a => a.trim()).length;
  const unanswered = questions.length - answered;
  const minutesUsed = Math.ceil(elapsedAtEnd / 60);

  $("#answeredResult").textContent = answered;
  $("#unansweredResult").textContent = unanswered;
  $("#durationResult").textContent = `${minutesUsed} min`;

  $("#resultMessage").textContent =
    unanswered === 0
      ? "You entered an answer for every question. Review your responses to reflect on your performance."
      : `You answered ${answered} of ${questions.length} questions. You can review the responses you entered during this demo.`;

  closeFinishModal();
  $("#resultModal").classList.remove("hidden");
  $("#dashboardBtn").focus();
}

function startTimer() {
  renderTimer();

  timerInterval = setInterval(() => {
    if (interviewEnded) {
      clearInterval(timerInterval);
      return;
    }

    remainingSeconds = Math.max(0, remainingSeconds - 1);
    renderTimer();

    if (remainingSeconds <= 0) {
      finishInterview();
    }
  }, 1000);
}

function setupSessionDetails() {
  $("#sessionType").textContent = setup.interviewType;
  $("#sessionRole").textContent = setup.jobRole;
  $("#sessionDifficulty").textContent = setup.difficulty;
  $("#sessionDuration").textContent = `${durationMinutes} minutes`;
}

$("#answerInput").addEventListener("input", () => {
  answers[currentIndex] = $("#answerInput").value;
  updateAnswerStatus();
  renderQuestionList();
});

$("#previousBtn").addEventListener("click", goPrevious);
$("#nextBtn").addEventListener("click", goNext);
$("#finishBtn").addEventListener("click", () => {
  saveCurrentAnswer();
  openFinishModal(
    "Finish this interview?",
    "Your demo session will end. Your answers will remain available for review until you leave or refresh this page."
  );
});

$("#exitBtn").addEventListener("click", () => {
  openFinishModal(
    "Exit this interview?",
    "Exiting will end this demo session. Do you want to finish and see your summary?"
  );
});

$("#cancelModalBtn").addEventListener("click", closeFinishModal);
$("#confirmFinishBtn").addEventListener("click", finishInterview);

$("#dashboardBtn").addEventListener("click", () => {
  window.location.href = "student-dashboard.html";
});

$("#reviewAnswersBtn").addEventListener("click", () => {
  $("#resultModal").classList.add("hidden");
  interviewEnded = false;
  $("#finishBtn").textContent = "End Review";
  $("#finishBtn").onclick = () => {
    saveCurrentAnswer();
    $("#resultModal").classList.remove("hidden");
  };

  // The timer remains stopped while reviewing completed answers.
  renderQuestion();
  $("#answerInput").focus();
});

$("#confirmModal").addEventListener("click", (event) => {
  if (event.target === $("#confirmModal")) {
    closeFinishModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeFinishModal();
  }
});

setupSessionDetails();
renderQuestion();
startTimer();
