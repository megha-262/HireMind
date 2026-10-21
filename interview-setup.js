
const form = document.querySelector("#setupForm");
const typeOptions = [...document.querySelectorAll(".type-option")];
const topicInputs = [...document.querySelectorAll('input[name="topics"]')];
const topicSection = document.querySelector("#topicsSection");
const topicHint = document.querySelector("#topicHint");
const formError = document.querySelector("#formError");

function selectedType() {
  return document.querySelector('input[name="interviewType"]:checked').value;
}

function updateTypeCards() {
  typeOptions.forEach(card => {
    const input = card.querySelector('input[name="interviewType"]');
    card.classList.toggle("selected", input.checked);
  });

  const type = selectedType();
  const isHR = type === "HR";

  topicSection.classList.toggle("hidden", isHR);

  if (isHR) {
    topicHint.textContent = "Focus areas are optional for HR interviews.";
  } else if (type === "Mixed") {
    topicHint.textContent = "Choose technical topics for the technical portion of your interview.";
  } else {
    topicHint.textContent = "Select at least one focus area for a technical interview.";
  }

  updateSummary();
}

function updateSummary() {
  document.querySelector("#summaryType").textContent = selectedType();
  document.querySelector("#summaryRole").textContent =
    document.querySelector("#jobRole").value;
  document.querySelector("#summaryDifficulty").textContent =
    document.querySelector("#difficulty").value;
  document.querySelector("#summaryDuration").textContent =
    `${document.querySelector("#duration").value} minutes`;
  document.querySelector("#summaryQuestions").textContent =
    document.querySelector("#questionCount").value;
}

function showError(message) {
  formError.textContent = message;
  formError.classList.remove("hidden");
  formError.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearError() {
  formError.textContent = "";
  formError.classList.add("hidden");
}

typeOptions.forEach(card => {
  card.querySelector('input[name="interviewType"]')
    .addEventListener("change", updateTypeCards);
});

["#jobRole", "#difficulty", "#duration", "#questionCount"].forEach(selector => {
  document.querySelector(selector).addEventListener("change", updateSummary);
});

topicInputs.forEach(input => {
  input.addEventListener("change", clearError);
});

form.addEventListener("change", clearError);

form.addEventListener("submit", event => {
  event.preventDefault();
  clearError();

  const type = selectedType();
  const topics = topicInputs.filter(input => input.checked).map(input => input.value);

  if (type !== "HR" && topics.length === 0) {
    showError("Please select at least one focus area for this interview.");
    return;
  }

  const configuration = {
    interviewType: type,
    jobRole: document.querySelector("#jobRole").value,
    difficulty: document.querySelector("#difficulty").value,
    duration: Number(document.querySelector("#duration").value),
    questionCount: Number(document.querySelector("#questionCount").value),
    topics: type === "HR" ? [] : topics,
    followUps: document.querySelector("#followUps").checked
  };

  try {
    sessionStorage.setItem("hireMindInterviewSetup", JSON.stringify(configuration));
    window.location.href = "interview-room.html";
  } catch (error) {
    showError("Your browser could not save the demo setup. Please check your browser settings and try again.");
  }
});

const initialType = new URLSearchParams(window.location.search).get("type");

if (["Technical", "HR", "Mixed"].includes(initialType)) {
  const radio = document.querySelector(
    `input[name="interviewType"][value="${initialType}"]`
  );
  if (radio) radio.checked = true;
}

updateTypeCards();
