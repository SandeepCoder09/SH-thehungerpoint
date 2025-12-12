// Select the form and fields
  const form = document.querySelector("form");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const emailInput = document.getElementById("email");

  // Helper to show messages
  function showMessage(message, type = "error") {
    // Remove any existing message
    const oldMsg = document.querySelector(".form-message");
    if (oldMsg) oldMsg.remove();

    const div = document.createElement("div");
    div.className = "form-message";
    div.textContent = message;

    div.style.marginTop = "10px";
    div.style.fontSize = "0.85rem";
    div.style.textAlign = "center";
    div.style.padding = "8px 10px";
    div.style.borderRadius = "8px";
    if (type === "error") {
      div.style.background = "#fef2f2";
      div.style.color = "#b91c1c";
      div.style.border = "1px solid #fecaca";
    } else {
      div.style.background = "#ecfdf5";
      div.style.color = "#166534";
      div.style.border = "1px solid #bbf7d0";
    }

    form.appendChild(div);
  }

  // Basic email check
  function isValidEmail(email) {
    return /^[^s@]+@[^s@]+.[^s@]+$/.test(email);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault(); // Stop real submission for demo

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Clear old message
    const oldMsg = document.querySelector(".form-message");
    if (oldMsg) oldMsg.remove();

    // Validation
    if (!isValidEmail(email)) {
      showMessage("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      showMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Passwords do not match. Please try again.");
      return;
    }

    // Simulate successful registration
    showMessage("Sign up successful! Welcome aboard.", "success");

    // Optionally clear the form after success
    form.reset();
  });