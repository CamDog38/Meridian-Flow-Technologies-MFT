// Contact form: loads a human check question, posts the enquiry to /api/contact,
// and shows the result inline.
(function () {
  "use strict";

  var form = document.querySelector(".enquiry-form");
  if (!form) return;

  var status = form.querySelector(".enquiry-form__status");
  var button = form.querySelector(".enquiry-form__submit");
  var questionEl = document.getElementById("challenge-question");
  var tokenInput = form.querySelector('input[name="challengeToken"]');
  var answerInput = document.getElementById("challenge-answer");

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("is-error", !!isError);
  }

  // Fetch a new question and signed token. Called on load and after each submission.
  function loadChallenge() {
    tokenInput.value = "";
    answerInput.value = "";
    questionEl.textContent = "Loading check question...";
    return fetch("/api/challenge", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("challenge unavailable");
        return response.json();
      })
      .then(function (data) {
        questionEl.textContent = data.question;
        tokenInput.value = data.token;
      })
      .catch(function () {
        questionEl.textContent = "The check question could not be loaded. Please refresh the page.";
      });
  }

  loadChallenge();

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!tokenInput.value) {
      setStatus("The check question is still loading. Please try again in a moment.", true);
      return;
    }

    var data = {};
    new FormData(form).forEach(function (value, key) {
      data[key] = value;
    });

    button.disabled = true;
    setStatus("Sending...", false);

    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (response) {
        return response.json().catch(function () {
          return { ok: false, error: "Unexpected response from the server." };
        });
      })
      .then(function (result) {
        if (result.ok) {
          form.reset();
          setStatus("Thank you. Your enquiry has been sent.", false);
        } else {
          setStatus(result.error || "The enquiry could not be sent.", true);
        }
      })
      .catch(function () {
        setStatus("The enquiry could not be sent. Please check your connection and try again.", true);
      })
      .then(function () {
        button.disabled = false;
        return loadChallenge();
      });
  });
})();
