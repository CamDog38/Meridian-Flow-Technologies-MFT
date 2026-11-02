// Contact form: posts the enquiry to /api/contact and shows the result inline.
(function () {
  "use strict";

  var form = document.querySelector(".enquiry-form");
  if (!form) return;

  var status = form.querySelector(".enquiry-form__status");
  var button = form.querySelector(".enquiry-form__submit");

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("is-error", !!isError);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;

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
      });
  });
})();
