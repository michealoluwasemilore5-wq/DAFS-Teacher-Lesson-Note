const api = (url, opts = {}) => fetch(url, {
  credentials: "same-origin",
  headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  ...opts
}).then(async r => {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const message = data.error || (r.status === 401 ? "Your email or password could not be verified." : r.status === 403 ? "This page is not available for your account." : "Something went wrong. Please try again.");
    throw new Error(message);
  }
  return data;
});

function err(msg) {
  const x = document.getElementById("authError");
  if (!x) return;
  x.textContent = msg || "";
  x.classList.toggle("show", !!msg);
}

const params = new URLSearchParams(location.search);
if (params.get("adminRequired") === "1") {
  err("Principal/Admin access is required for that page. Please sign in with the school's Principal account.");
}

function setupPasswordVisibility() {
  document.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.passwordToggleReady === "true") return;
    input.dataset.passwordToggleReady = "true";
    const wrap = document.createElement("div");
    wrap.className = "password-field-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "password-toggle";
    button.setAttribute("aria-label", "Show password");
    button.setAttribute("aria-pressed", "false");
    button.textContent = "Show";
    button.addEventListener("click", () => {
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Show" : "Hide";
      button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      button.setAttribute("aria-pressed", String(!showing));
    });
    wrap.appendChild(button);
  });
}

function clearFieldError(input) {
  if (!input) return;
  input.classList.remove("input-error");
  const old = input.parentElement?.querySelector(".field-error");
  if (old) old.remove();
}

function showFieldError(input, message) {
  if (!input) return;
  clearFieldError(input);
  input.classList.add("input-error");
  const error = document.createElement("div");
  error.className = "field-error";
  error.setAttribute("role", "alert");
  error.textContent = message;
  input.insertAdjacentElement("afterend", error);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateLoginForm() {
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  let ok = true;
  clearFieldError(email);
  clearFieldError(password);

  const emailValue = email.value.trim();
  const passwordValue = password.value;

  if (!emailValue) {
    showFieldError(email, "Email address is required.");
    ok = false;
  } else if (!validEmail(emailValue)) {
    showFieldError(email, "Enter a valid email address.");
    ok = false;
  }

  if (!passwordValue) {
    showFieldError(password, "Password is required.");
    ok = false;
  }

  if (!ok) err("Please correct the highlighted field(s) before signing in.");
  else err("");
  return ok;
}

function validateSignupForm() {
  const name = document.getElementById("name");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  let ok = true;
  clearFieldError(name);
  clearFieldError(email);
  clearFieldError(password);

  const nameValue = name.value.trim();
  const emailValue = email.value.trim();
  const passwordValue = password.value;

  if (!nameValue) {
    showFieldError(name, "Full name is required.");
    ok = false;
  } else if (nameValue.length < 2) {
    showFieldError(name, "Enter your full name.");
    ok = false;
  }

  if (!emailValue) {
    showFieldError(email, "Email address is required.");
    ok = false;
  } else if (!validEmail(emailValue)) {
    showFieldError(email, "Enter a valid email address.");
    ok = false;
  }

  if (!passwordValue) {
    showFieldError(password, "Password is required.");
    ok = false;
  } else if (passwordValue.length < 8) {
    showFieldError(password, "Password must be at least 8 characters.");
    ok = false;
  }

  if (!ok) err("Please correct the highlighted field(s) before creating your account.");
  else err("");
  return ok;
}

function attachLiveValidation(form, fields) {
  fields.forEach(input => {
    if (!input) return;
    input.addEventListener("input", () => {
      clearFieldError(input);
      const hasAny = form.querySelector(".field-error");
      if (!hasAny) err("");
    });
    input.addEventListener("blur", () => {
      if (!input.value.trim()) {
        const label = input.closest(".field")?.querySelector("label")?.childNodes?.[0]?.textContent?.trim() || "This field";
        showFieldError(input, `${label} is required.`);
      }
    });
  });
}

async function redirectIfLoggedIn() {
  // When an authenticated teacher was redirected here from /admin.html, keep
  // the login form visible so the Principal can sign in without being bounced
  // back to the teacher dashboard.
  if (params.get("adminRequired") === "1") return;
  try {
    const m = await api("./api/me");
    if (m.authenticated && m.user?.role) location.href = m.user.role === "admin" ? "./admin.html" : "./teacher.html";
  } catch {}
}

setupPasswordVisibility();

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  attachLiveValidation(loginForm, [email, password]);
  loginForm.onsubmit = async e => {
    e.preventDefault();
    if (!validateLoginForm()) return;
    try {
      const loginResult = await api("./api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.value.trim(), password: password.value })
      });
      const user = loginResult?.user;
      if (!user?.role) throw new Error("We could not complete your sign-in. Please try again.");
      location.href = user.role === "admin" ? "./admin.html" : "./teacher.html";
    } catch (x) { err(x?.message || "Something went wrong. Please try again."); }
  };
}

const googleBtn = document.getElementById("googleSignIn");
if (googleBtn) {
  const googleDivider = document.getElementById("googleDivider");
  api("./api/config").then(c => {
    googleBtn.hidden = !c.googleSignIn;
    if (googleDivider) googleDivider.hidden = !c.googleSignIn;
  }).catch(() => {
    googleBtn.hidden = true;
    if (googleDivider) googleDivider.hidden = true;
  });
}

const signupForm = document.getElementById("signupForm");
if (signupForm) {
  const name = document.getElementById("name");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  attachLiveValidation(signupForm, [name, email, password]);
  signupForm.onsubmit = async e => {
    e.preventDefault();
    if (!validateSignupForm()) return;
    try {
      await api("./api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: name.value.trim(),
          email: email.value.trim(),
          password: password.value
        })
      });
      location.href = "./teacher.html";
    } catch (x) { err(x?.message || "Something went wrong. Please try again."); }
  };
}

redirectIfLoggedIn();
