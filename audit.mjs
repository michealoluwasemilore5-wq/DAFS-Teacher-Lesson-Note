import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const errors = [];

for (const file of ["server.js", ...fs.readdirSync(publicDir).filter(f => f.endsWith(".js")).map(f => path.join("public", f))]) {
  const full = path.join(root, file);
  try { execFileSync(process.execPath, ["--check", full], { stdio: "pipe" }); }
  catch { errors.push(`JavaScript syntax error: ${file}`); }
}

for (const file of ["data/curriculum.json", "data/lagos_scheme.json"]) {
  try { JSON.parse(fs.readFileSync(path.join(root, file), "utf8")); }
  catch (e) { errors.push(`Invalid JSON: ${file}`); }
}

const curriculum = JSON.parse(fs.readFileSync(path.join(root, "data/curriculum.json"), "utf8"));
const scheme = JSON.parse(fs.readFileSync(path.join(root, "data/lagos_scheme.json"), "utf8"));
const seen = new Set();
for (const [index, entry] of scheme.entries.entries()) {
  const week = Number(entry.week);
  const key = `${entry.classLevel}|${entry.term}|${entry.subject}|${week}`;
  if (seen.has(key)) errors.push(`Duplicate scheme entry: ${key}`);
  seen.add(key);
  if (!Number.isInteger(week) || week < 1 || week > 12) errors.push(`Invalid scheme week at entry ${index}`);
  if (!entry.classLevel || !entry.term || !entry.subject || !entry.topic || !entry.source) errors.push(`Incomplete scheme entry ${index}`);
  if (!entry.isBreak && (!Array.isArray(entry.objectives) || entry.objectives.length === 0)) errors.push(`Missing objectives at scheme entry ${index}`);
  // Legacy Lagos catalog may contain older Basic-class entries; First Term school scheme is authoritative.
  // Only validate legacy entries that still belong to an active class.
  if (curriculum.classes.includes(entry.classLevel) && (!curriculum.terms.includes(entry.term) || !curriculum.subjects.includes(entry.subject))) errors.push(`Scheme entry outside curriculum: ${key}`);
}

for (const file of fs.readdirSync(publicDir).filter(f => f.endsWith(".html"))) {
  const full = path.join(publicDir, file);
  const html = fs.readFileSync(full, "utf8");
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  for (const id of new Set(ids)) if (ids.filter(x => x === id).length > 1) errors.push(`Duplicate HTML id ${id} in public/${file}`);
  for (const ref of [...html.matchAll(/(?:src|href)="(\.[^"?#]+)/g)].map(m => m[1])) {
    if (ref === "./auth/google") continue;
    if (!fs.existsSync(path.join(publicDir, ref.slice(2)))) errors.push(`Missing local asset ${ref} in public/${file}`);
  }
}

const serverText = fs.readFileSync(path.join(root, "server.js"), "utf8");
if (serverText.includes("function fallbackLesson") || serverText.includes("fallbackLesson(payload)")) errors.push("Generic fallback lesson writer is still present; generation must not return generic filler.");

for (const requiredWriterRule of [
  "WRITE THE ACTUAL LESSON NOTE",
  "actual topic-specific knowledge",
  "NEVER fill Lesson Content with generic sentences",
  "Evaluation and assignment must be answerable",
  "Do not write \"The teacher will explain",
  "SEPARATION RULE: Do not put Teacher's Activities or Pupils' Activities inside LESSON CONTENT",
  "ADDITIONAL LENGTH RULE",
]) {
  if (!serverText.includes(requiredWriterRule)) errors.push(`Lesson-writer quality rule missing: ${requiredWriterRule}`);
}

for (const needle of ["Week 1 — not loaded", "Select a week with a loaded Lagos State scheme entry", "ADMIN_EMAIL belongs to a teacher account"]) {
  const files = ["server.js", "README.md", ...fs.readdirSync(publicDir).map(f => path.join("public", f))];
  for (const file of files) {
    const full = path.join(root, file);
    if (fs.statSync(full).isFile() && fs.readFileSync(full, "utf8").includes(needle)) errors.push(`Old error text remains: ${needle}`);
  }
}

const requiredFiles = ["server.js","package.json","render.yaml",".env.example","public/exam.html","public/exam.js","public/generator.html","public/generator.js","public/notes.html","public/notes.js","public/admin.html","public/admin.js","public/teacher.html","public/teacher.js","public/login.html","public/signup.html","public/auth.js","public/styles.css","public/logo.png","data/curriculum.json","data/lagos_scheme.json","data/first_term_uploaded_scheme.json"];
for (const file of requiredFiles) if (!fs.existsSync(path.join(root, file))) errors.push(`Missing required project file: ${file}`);

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (!packageJson.dependencies?.docx) errors.push("DOCX dependency is missing from package.json.");
if (!serverText.includes('|| "gemini-3.8-flash"')) errors.push("Server default Gemini model is not gemini-3.8-flash.");
if (!serverText.includes('|| "gemini-3.5-flash-lite"')) errors.push("Server fallback Gemini model is not gemini-3.5-flash-lite.");
const examHtml = fs.readFileSync(path.join(publicDir, "exam.html"), "utf8");
if (!/id="mcqCount"[^>]*value="20"/.test(examHtml)) errors.push("Examination objective default is not 20.");
if (!/id="theoryCount"[^>]*value="4"/.test(examHtml)) errors.push("Examination theory default is not 4.");
if (!serverText.includes("noteIds.length > 500")) errors.push("Examination note selection limit is unexpectedly low.");
if (!serverText.includes("const maxChars = 120000")) errors.push("Examination source-note limit is missing.");
if (!serverText.includes("Generate each subject independently")) errors.push("Examination generation is not protected against multi-subject source truncation.");
if (!serverText.includes("uploadedFirstTermScheme")) errors.push("Uploaded First Term school scheme is not wired into the server.");
const generatorHtml = fs.readFileSync(path.join(publicDir, "generator.html"), "utf8");
if (/id="topic"[^>]*\brequired\b/.test(generatorHtml) || /id="objectives"[^>]*\brequired\b/.test(generatorHtml)) errors.push("Generator still relies on native required validation for scheme fields; use the JavaScript validation flow.");
const generatorJs = fs.readFileSync(path.join(publicDir, "generator.js"), "utf8");
if (!generatorJs.includes("canGenerateObjectivesFromUploadedTopic")) errors.push("First Term uploaded-scheme objective auto-generation validation is missing.");
if (!generatorJs.includes("schemeSourceTableId")) errors.push("Exact uploaded scheme source identity is not submitted by the generator.");
if (!serverText.includes("requestedSourceTableId")) errors.push("Server does not verify the exact uploaded scheme source identity.");
if (!serverText.includes("/api/admin/notes/:id")) errors.push("Admin lazy note-detail endpoint is missing.");
if (!serverText.includes("activeExamGenerations")) errors.push("Concurrent examination generation protection is missing.");
if (!serverText.includes("Content-Security-Policy")) errors.push("Content Security Policy header is missing.");

const firstTerm = JSON.parse(fs.readFileSync(path.join(root, "data", "first_term_uploaded_scheme.json"), "utf8"));
for (const cls of ["KG 1","KG 2","Nursery 1","Nursery 2","Primary 1","Primary 2","Primary 3","Primary 4","Primary 5"]) {
  if (!firstTerm.classes.includes(cls)) errors.push(`Uploaded First Term scheme is missing ${cls}.`);
  const clsEntries = firstTerm.entries.filter(e => e.classLevel === cls && e.term === "First Term");
  if (!clsEntries.length) errors.push(`Uploaded First Term scheme has no entries for ${cls}.`);
}
if (firstTerm.entries.length < 500) errors.push("Uploaded First Term scheme appears incomplete.");
if (!serverText.includes('term === "First Term" && uploadedFirstTermScheme.classes.includes(classLevel)')) errors.push("First Term scheme selection rule is missing.");
for (const cls of ["KG 1","KG 2","Nursery 1","Nursery 2","Primary 1","Primary 2","Primary 3","Primary 4","Primary 5"]) {
  if (!curriculum.classes.includes(cls)) errors.push(`Required class is missing: ${cls}`);
}



if (errors.length) {
  console.error(`DAFS AUDIT FAILED (${errors.length})`);
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
}

const expectedClasses = ["KG 1","KG 2","Nursery 1","Nursery 2","Primary 1","Primary 2","Primary 3","Primary 4","Primary 5"];
if (JSON.stringify(curriculum.classes) !== JSON.stringify(expectedClasses)) throw new Error(`Class list mismatch: ${JSON.stringify(curriculum.classes)}`);
const uploaded = JSON.parse(fs.readFileSync(path.join(root,"data","first_term_uploaded_scheme.json"),"utf8"));
if (JSON.stringify(uploaded.classes) !== JSON.stringify(["KG 1","KG 2","Nursery 1","Nursery 2","Primary 1","Primary 2","Primary 3","Primary 4","Primary 5"])) throw new Error("Uploaded First Term scheme class list is incorrect.");
const volumeMap = {"KG 1":"Volume 1","KG 2":"Volume 2","Nursery 1":"Volume 3","Nursery 2":"Volume 4"};
for (const [cls, volume] of Object.entries(volumeMap)) { if (!uploaded.entries.some(e=>e.classLevel===cls && e.sourceVolume===volume)) throw new Error(`${cls} is not mapped to ${volume}.`); }
const uploadedSubjects = new Set(uploaded.entries.map(e=>e.subject));
const curriculumSubjects = new Set(curriculum.subjects);
for (const subject of uploadedSubjects) if (!curriculumSubjects.has(subject)) throw new Error(`Uploaded scheme subject missing from curriculum: ${subject}`);
for (const htmlFile of ["public/teacher.html","public/generator.html"]) { const html=fs.readFileSync(path.join(root,htmlFile),"utf8"); if (/Basic 1[– -]6|Basic 1[– -]Basic 5/.test(html)) throw new Error(`Stale Basic-class wording remains in ${htmlFile}`); }

console.log("DAFS AUDIT PASSED: JavaScript, JSON, HTML assets/IDs, scheme integrity and known error strings checked.");
