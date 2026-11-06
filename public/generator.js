const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

const api = (url, opts = {}) => fetch(url, {
  credentials: "same-origin",
  headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  ...opts
}).then(async r => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "Something went wrong. Please try again."), { status: r.status });
  return d;
});

const md = source => {
  const lines = String(source ?? "").split(/\r?\n/);
  const out = [];
  let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = esc(raw.trim());
    if (!line) { close(); if (out.at(-1) !== "<br>") out.push("<br>"); continue; }
    if (/^### /.test(line)) { close(); out.push(`<h3>${line.slice(4)}</h3>`); continue; }
    if (/^## /.test(line)) { close(); out.push(`<h2>${line.slice(3)}</h2>`); continue; }
    if (/^# /.test(line)) { close(); out.push(`<h1>${line.slice(2)}</h1>`); continue; }
    const om = line.match(/^\d+\.\s+(.*)$/);
    if (om) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${om[1]}</li>`); continue; }
    const bm = line.match(/^-\s+(.*)$/);
    if (bm) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${bm[1]}</li>`); continue; }
    close(); out.push(`<p>${line}</p>`);
  }
  close();
  return out.join("").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
};

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

function validateGeneratorForm() {
  const checks = [
    [$("lessonDate"), "Date"],
    [$("classLevel"), "Class"],
    [$("term"), "Term"],
    [$("subject"), "Subject"],
    [$("week"), "Week"],
    [$("topic"), "Lagos State scheme topic"],
    [$("duration"), "Duration"]
  ];
  let ok = true;
  const selectedWeek = $("week").selectedOptions[0];
  let selectedEntry = null;
  if (selectedWeek?.dataset.entry) {
    try { selectedEntry = JSON.parse(selectedWeek.dataset.entry); } catch {}
  }
  if (selectedEntry?.isBreak) {
    showFieldError($("week"), "This week is a school break. Please select a teaching week.");
    $("status").textContent = "Please select a teaching week.";
    return false;
  }
  checks.forEach(([input, label]) => {
    clearFieldError(input);
    if (!String(input?.value ?? "").trim()) { showFieldError(input, `${label} is required.`); ok = false; }
  });
  clearFieldError($("objectives"));
  const hasExplicitSchemeObjectives = Array.isArray(state.scheme?.objectives) && state.scheme.objectives.length > 0;
  const canGenerateObjectivesFromUploadedTopic = Boolean(state.scheme && !state.scheme.isBreak && !hasExplicitSchemeObjectives);
  if (!String($("objectives")?.value ?? "").trim() && !canGenerateObjectivesFromUploadedTopic) {
    showFieldError($("objectives"), "Scheme-based learning objectives are required.");
    ok = false;
  }
  if (!ok) {
    $("status").textContent = "Please complete the highlighted fields.";
    document.querySelector(".input-error")?.focus();
  }
  return ok;
}

function attachGeneratorValidation() {
  ["lessonDate", "classLevel", "term", "subject", "week", "topic", "duration", "objectives"].forEach(id => {
    const input = $(id);
    input?.addEventListener("input", () => clearFieldError(input));
    input?.addEventListener("change", () => clearFieldError(input));
    input?.addEventListener("blur", () => {
      if (!String(input.value ?? "").trim()) {
        const label = input.closest("label")?.childNodes?.[0]?.textContent?.trim() || "This field";
        showFieldError(input, `${label} is required.`);
      }
    });
  });
}

let state = { note: "", meta: null, scheme: null };
let schemeRequest = null;
let schemeRequestId = 0;

function setWeekOptions(entries = []) {
  const select = $("week");
  const variantWrap = $("schemeVariantWrap");
  const variant = $("schemeVariant");
  select.innerHTML = '<option value="">Select week</option>';
  if (variant) variant.innerHTML = '';
  if (variantWrap) variantWrap.hidden = true;
  const grouped = new Map();
  (Array.isArray(entries) ? entries : []).forEach(e => {
    const w = Number(e.week);
    if (!grouped.has(w)) grouped.set(w, []);
    grouped.get(w).push(e);
  });
  for (let i = 1; i <= 12; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    const group = grouped.get(i) || [];
    const first = group[0];
    opt.textContent = first?.isBreak ? `Week ${i} — ${first.topic || "School test/break"}` : `Week ${i}${first?.topic ? ` — ${first.topic}` : ""}${group.length > 1 ? ` (+${group.length - 1} other scheme entr${group.length - 1 === 1 ? "y" : "ies"})` : ""}`;
    if (group.length) opt.dataset.entries = JSON.stringify(group);
    select.appendChild(opt);
  }
}

function resetSchemeFields() {
  state.scheme = null;
  $("topic").value = "";
  $("topic").readOnly = false;
  $("objectives").readOnly = false;
  $("objectives").value = "";
  $("topic").placeholder = "Enter the Lagos State scheme topic for this week";
  $("objectives").placeholder = "Enter the learning objectives from the Lagos State scheme for this week";
  clearFieldError($("week"));
  clearFieldError($("topic"));
  clearFieldError($("objectives"));
  if ($("schemeVariantWrap")) $("schemeVariantWrap").hidden = true;
  if ($("schemeVariant")) $("schemeVariant").innerHTML = "";
  if ($("generate")) $("generate").disabled = false;
}

function applySelectedScheme(index = 0) {
  const opt = $("week").selectedOptions[0];
  resetSchemeFields();
  const variantWrap = $("schemeVariantWrap");
  const variant = $("schemeVariant");
  let entries = [];
  try { entries = opt?.dataset.entries ? JSON.parse(opt.dataset.entries) : []; } catch {}
  if (!entries.length) return;

  if (variant && entries.length > 1) {
    variant.innerHTML = entries.map((e, i) => `<option value="${i}">${esc(e.sourceSubject || e.subject)} — ${esc(e.topic || "No topic")}</option>`).join("");
    variant.value = String(Math.min(index, entries.length - 1));
    variantWrap.hidden = false;
    variant.onchange = () => applySelectedScheme(Number(variant.value));
  } else if (variantWrap) {
    variantWrap.hidden = true;
  }

  const e = entries[Math.min(index, entries.length - 1)];
  state.scheme = e;
  $("topic").value = e.topic || "";
  $("topic").readOnly = Boolean(e.topic && e.source);
  $("objectives").value = (Array.isArray(e.objectives) ? e.objectives : []).map((x, i) => `${i + 1}. ${x}`).join("\n");
  $("topic").placeholder = "Uploaded First Term scheme topic";
  $("topic").title = "This topic is taken from the uploaded school scheme.";
  $("objectives").placeholder = e.objectives?.length ? "Objectives from the selected scheme entry" : "The uploaded PDF does not list objectives; AI will create suitable objectives from the exact topic";
  $("objectives").title = e.objectives?.length ? "Objectives supplied by the selected scheme entry." : "Objectives will be created by the AI from the exact uploaded topic.";
  clearFieldError($("week"));
  clearFieldError($("topic"));
  clearFieldError($("objectives"));
  $("generate").disabled = Boolean(e.isBreak);
  if (e.isBreak) {
    $("status").textContent = "This selected week is a test/break week. Choose another week.";
  }
}

async function loadScheme() {
  const requestId = ++schemeRequestId;
  schemeRequest?.abort();
  schemeRequest = new AbortController();

  const classLevel = $("classLevel").value;
  const term = $("term").value;
  const subject = $("subject").value;
  const status = $("schemeStatus");

  resetSchemeFields();
  setWeekOptions();

  if (!classLevel || !term || !subject) {
    status.innerHTML = "<strong>Lagos State Scheme of Work</strong><p>Select class, term and subject to load Week 1–12.</p>";
    return;
  }

  status.innerHTML = "<strong>Lagos State Scheme of Work</strong><p>Loading Week 1–12…</p>";

  try {
    const d = await api(`./api/scheme?classLevel=${encodeURIComponent(classLevel)}&term=${encodeURIComponent(term)}&subject=${encodeURIComponent(subject)}`, { signal: schemeRequest.signal });
    if (requestId !== schemeRequestId) return;

    const entries = Array.isArray(d.entries) ? d.entries : [];
    setWeekOptions(entries);
    $("week").value = "1";
    applySelectedScheme();

    const breakCount = entries.filter(e => e.isBreak).length;
    const teachingCount = entries.length - breakCount;
    status.innerHTML = `<strong>${d.authoritativeSchoolUpload ? "Uploaded First Term School Scheme" : "Lagos State Scheme of Work"}</strong><p>Weeks 1–12 are available. ${teachingCount} teaching week${teachingCount === 1 ? "" : "s"} have scheme data loaded for this class, term and subject${breakCount ? `, plus ${breakCount} test/break week${breakCount === 1 ? "" : "s"}` : ""}. ${d.authoritativeSchoolUpload ? "The topic is taken directly from the uploaded PDF. The PDF does not list explicit objectives, so the AI will create suitable objectives from the selected topic." : "For a week without catalog data, enter the school's verified scheme topic and objectives manually."}</p>`;
  } catch (e) {
    if (e.name === "AbortError" || requestId !== schemeRequestId) return;
    setWeekOptions();
    $("week").value = "1";
    resetSchemeFields();
    status.innerHTML = "<strong>Lagos State Scheme of Work</strong><p>Weeks 1–12 are available. The scheme catalog could not be loaded, so enter the school's verified scheme topic and objectives manually.</p>";
  }
}

function initDafsMenu(user) {
  const btn = $("menuBtn"), drawer = $("menuDrawer"), backdrop = $("menuBackdrop"), close = $("drawerClose"), logout = $("logoutBtn"), name = $("drawerUserName"), role = $("drawerUserRole"), avatar = $("drawerAvatar"), adminLink = $("drawerAdminLink");
  if (!btn || !drawer) return;
  if (name) name.textContent = user?.name || "Teacher";
  if (role) role.textContent = user?.role === "admin" ? "Principal / Administrator" : "Teacher";
  if (avatar) avatar.textContent = (user?.name || "T").trim().charAt(0).toUpperCase();
  if (adminLink && user?.role === "admin") adminLink.classList.remove("hidden");
  const open = () => { document.body.classList.add("menu-open"); drawer.setAttribute("aria-hidden", "false"); btn.setAttribute("aria-expanded", "true"); };
  const shut = () => { document.body.classList.remove("menu-open"); drawer.setAttribute("aria-hidden", "true"); btn.setAttribute("aria-expanded", "false"); };
  btn.setAttribute("aria-expanded", "false");
  btn.onclick = open;
  backdrop?.addEventListener("click", shut);
  close?.addEventListener("click", shut);
  drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", shut));
  logout?.addEventListener("click", async () => {
    logout.disabled = true;
    try { await api("./api/auth/logout", { method: "POST" }); } catch {}
    finally { location.href = "./login.html"; }
  });
}

(async () => {
  try {
    const m = await api("./api/me");
    if (!m.authenticated || !m.user?.role) return location.href = "./login.html";
    if (m.user.role === "admin") return location.href = "./admin.html";

    $("userBadge").textContent = `${m.user.name || "Teacher"} • Teacher`;
    $("teacherName").value = m.user.name || "";
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    $("lessonDate").value = localNow.toISOString().slice(0, 10);

    const c = await api("./api/curriculum");
    $("classLevel").innerHTML = c.classes.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
    $("term").innerHTML = c.terms.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
    const refreshSubjects = () => {
      const classLevel = $("classLevel").value;
      const term = $("term").value;
      const classSubjects = term === "First Term" ? (c.firstTermSubjectsByClass?.[classLevel] || []) : c.subjects;
      $("subject").innerHTML = classSubjects.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
      const coverage = $("subjectCoverage");
      if (coverage) {
        coverage.textContent = term === "First Term"
          ? `${classSubjects.length} subject${classSubjects.length === 1 ? "" : "s"} available from the uploaded First Term school scheme for ${classLevel}.`
          : `${classSubjects.length} subjects available in the curriculum catalogue.`;
      }
      if (!classSubjects.length) {
        $("subject").innerHTML = `<option value="">No subjects supplied for this class</option>`;
        $("status").textContent = "No First Term scheme subjects for this class were found in the uploaded school scheme. No subject has been invented.";
      }
      loadScheme();
    };

    attachGeneratorValidation();
    $("classLevel").addEventListener("change", refreshSubjects);
    $("term").addEventListener("change", refreshSubjects);
    $("subject").addEventListener("change", loadScheme);
    $("week").addEventListener("change", applySelectedScheme);

    refreshSubjects();
    initDafsMenu(m.user);
  } catch (e) {
    if (e.status === 401) return location.href = "./login.html";
    $("status").textContent = e.message || "The lesson generator could not be loaded. Please refresh and try again.";
    $("generate").disabled = true;
  }
})();



let generationTimer = null;
let generationMessageTimer = null;
let generationLocked = false;

function setGenerationLoading(loading, message = "") {
  const panel = $("generationPanel");
  const button = $("generate");
  if (!panel || !button) return;
  panel.hidden = !loading;
  panel.setAttribute("aria-busy", loading ? "true" : "false");
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  button.innerHTML = loading
    ? '<span class="button-spinner" aria-hidden="true"></span><span>Generating Full Lesson Note…</span>'
    : '✦ Generate Full Lesson Note';
  if (!loading) {
    clearInterval(generationMessageTimer);
    generationMessageTimer = null;
    clearTimeout(generationTimer);
    generationTimer = null;
    $("generationBar")?.style.removeProperty("width");
    return;
  }
  $("generationTitle").textContent = "Generating your full lesson note…";
  $("generationMessage").textContent = message || "Preparing the lesson content. This can take a little while.";
  $("generationBar").style.width = "8%";
  const steps = [
    "Checking the selected class, term, subject and week…",
    "Using your Lagos State scheme topic and learning objectives…",
    "Building the lesson content, presentation and activities…",
    "Preparing evaluation, conclusion and assignment…",
    "Finishing and formatting your complete lesson note…"
  ];
  let i = 0;
  generationMessageTimer = setInterval(() => {
    i = Math.min(i + 1, steps.length - 1);
    $("generationMessage").textContent = steps[i];
    $("generationBar").style.width = `${Math.min(18 + i * 18, 88)}%`;
  }, 6500);
  generationTimer = setTimeout(() => {
    $("generationMessage").textContent = "The AI service is taking longer than usual. We are still waiting for the result…";
    $("generationBar").style.width = "92%";
  }, 30000);
}

function setFormBusy(busy) {
  document.querySelectorAll(".grid input, .grid select, .grid textarea").forEach(el => {
    if (el.id === "teacherName") return;
    el.disabled = busy;
    el.setAttribute("aria-disabled", busy ? "true" : "false");
  });
  ["copyBtn", "printBtn", "saveBtn"].forEach(id => {
    const el = $(id);
    if (el) el.disabled = busy || (id === "saveBtn" && !state.note);
  });
}

async function generateLessonNote() {
  if (generationLocked) return;
  if (!validateGeneratorForm()) return;
  generationLocked = true;
  const previousSaveEnabled = Boolean(state.note);
  const controller = new AbortController();
  const requestTimeout = setTimeout(() => controller.abort(), 135000);
  const p = {
    teacherName: $("teacherName").value.trim(),
    date: $("lessonDate").value,
    classLevel: $("classLevel").value,
    term: $("term").value,
    subject: $("subject").value,
    topic: $("topic").value.trim(),
    week: $("week").value.trim(),
    duration: $("duration").value.trim(),
    learningArea: $("learningArea").value.trim(),
    objectives: $("objectives").value.trim(),
    teachingAids: $("teachingAids").value.trim(),
    references: $("references").value.trim(),
    assessmentType: $("assessmentType").value,
    schemeSourcePage: state.scheme?.sourcePage || "",
    schemeSourceTableId: state.scheme?.sourceTableId || "",
    schemeSourceVolume: state.scheme?.sourceVolume || "",
    schemeSourceSubject: state.scheme?.sourceSubject || ""
  };
  setFormBusy(true);
  setGenerationLoading(true);
  $("status").textContent = "Generating lesson note…";
  $("output").innerHTML = '<div class="generation-result-placeholder"><div class="mini-spinner" aria-hidden="true"></div><strong>Your full lesson note is being prepared</strong><span>Please keep this page open. The note will appear here automatically.</span></div>';
  try {
    const d = await api("./api/generate", { method: "POST", body: JSON.stringify(p), signal: controller.signal });
    state.note = String(d.note || "").trim();
    state.meta = {
      ...p,
      schemeTopic: state.scheme?.topic || "",
      schemeObjectives: state.scheme?.objectives || [],
      schemeSource: state.scheme?.source || "",
      schemeSourceUrl: state.scheme?.sourceUrl || "",
      schemeEntryLoaded: Boolean(state.scheme)
    };
    if (!state.note) throw new Error("The lesson generator returned an empty result. Please try again.");
    $("output").innerHTML = md(state.note);
    if (d.mode === "ai" || d.mode === "ai-fallback") {
      $("status").textContent = "Lesson note generated with AI";
    } else {
      $("status").textContent = "Lesson note generated successfully";
    }
    $("saveBtn").disabled = false;
    if (d.message) $("generationMessage").textContent = d.message;
    requestAnimationFrame(() => $("output").scrollIntoView({ behavior: "smooth", block: "start" }));
  } catch (e) {
    state.note = "";
    state.meta = null;
    const message = e?.name === "AbortError"
      ? "The generation request took too long. Please try again. If this keeps happening, check the Gemini API configuration in Render."
      : (e?.message || "Lesson generation could not be completed. Please try again.");
    $("output").innerHTML = `<div class="generation-error"><strong>We could not generate the lesson note.</strong><span>${esc(message)}</span><button type="button" class="secondary" id="retryGenerate">Try Again</button></div>`;
    $("status").textContent = "Generation failed";
    $("retryGenerate")?.addEventListener("click", generateLessonNote);
    if (previousSaveEnabled) $("saveBtn").disabled = true;
  } finally {
    clearTimeout(requestTimeout);
    setGenerationLoading(false);
    setFormBusy(false);
    $("saveBtn").disabled = !state.note;
    generationLocked = false;
  }
}

$("generate").onclick = generateLessonNote;

$("saveBtn").onclick = async () => {
  if (!state.note || !state.meta) return;
  const button = $("saveBtn");
  button.disabled = true;
  try {
    await api("./api/notes", {
      method: "POST",
      body: JSON.stringify({
        title: `${state.meta.subject} — ${state.meta.topic}`,
        meta: state.meta,
        content: state.note
      })
    });
    $("status").textContent = "Saved to My Notes";
  } catch (e) {
    $("status").textContent = e.message || "The lesson note could not be saved.";
  } finally {
    button.disabled = false;
  }
};

$("copyBtn").onclick = async () => {
  if (!state.note) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(state.note);
    } else {
      const area = document.createElement("textarea");
      area.value = state.note;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    $("status").textContent = "Copied to clipboard";
  } catch {
    $("status").textContent = "Copy is unavailable in this browser.";
  }
};

$("printBtn").onclick = () => {
  if (!state.note) {
    $("status").textContent = "Generate a lesson note before printing.";
    return;
  }
  window.print();
};
