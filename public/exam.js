const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const api=(url,opts={})=>fetch(url,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(opts.headers||{})},...opts}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.error||"Something went wrong. Please try again."),{status:r.status});return d});
let currentUser=null, sourceNotes=[], currentExam=null, busy=false;
function showError(m){const b=$("examError");b.textContent=m||"Something went wrong.";b.classList.add("show");}
function clearError(){const b=$("examError");b.textContent="";b.classList.remove("show");}
function initMenu(user){const btn=$("menuBtn"),drawer=$("menuDrawer"),back=$("menuBackdrop"),close=$("drawerClose"),logout=$("logoutBtn"),name=$("drawerUserName"),role=$("drawerUserRole"),avatar=$("drawerAvatar"),admin=$("drawerAdminLink");name.textContent=user.name||"Teacher";role.textContent=user.role==="admin"?"Principal / Administrator":"Teacher";avatar.textContent=(user.name||"T").trim().charAt(0).toUpperCase();if(user.role==="admin")admin.classList.remove("hidden");const shut=()=>{document.body.classList.remove("menu-open");drawer.setAttribute("aria-hidden","true");btn.setAttribute("aria-expanded","false")};btn.onclick=()=>{document.body.classList.add("menu-open");drawer.setAttribute("aria-hidden","false");btn.setAttribute("aria-expanded","true")};back.onclick=shut;close.onclick=shut;drawer.querySelectorAll("a").forEach(a=>a.onclick=shut);logout.onclick=async()=>{logout.disabled=true;try{await api("./api/auth/logout",{method:"POST"})}catch{}finally{location.href="./login.html"}}}
function setExamLoading(on,msg=""){const p=$("examGenerationPanel"),b=$("generateExam");p.hidden=!on;b.disabled=on;b.classList.toggle("is-loading",on);if(on){$("examGenerationMessage").textContent=msg;$("examGenerationBar").style.width="10%"}else $("examGenerationBar").style.width="0%"}
function selectedSubjects(){return [...$("subjects").selectedOptions].map(o=>o.value)}
function selectedNoteIds(){return [...document.querySelectorAll("input[name=examNote]:checked")].map(x=>x.value)}
function renderSources(){const box=$("sourceNotes");if(!sourceNotes.length){box.innerHTML='<div class="empty">No saved lesson notes match this class, term and subject. Generate and save lesson notes first.</div>';$('sourceSummary').textContent="No matching saved lesson notes.";return}box.innerHTML=sourceNotes.map(n=>`<label class="exam-note-row"><input type="checkbox" name="examNote" value="${esc(n.id)}" checked><span><b>${esc(n.title)}</b><small>${esc(n.meta?.subject||"")} • Week ${esc(n.meta?.week||"")} • ${esc(n.meta?.classLevel||"")} • ${esc(n.meta?.term||"")}${n.teacherName?` • By ${esc(n.teacherName)}`:""}</small></span></label>`).join("");$('sourceSummary').textContent=`${sourceNotes.length} saved lesson note${sourceNotes.length===1?'':'s'} found. All matching weeks are selected by default.`}
async function loadSources(){clearError();const c=$("classLevel").value,t=$("term").value,subs=selectedSubjects();if(!c||!t||!subs.length){sourceNotes=[];renderSources();return}$("examStatus").textContent="Loading notes…";try{const q=new URLSearchParams({classLevel:c,term:t});subs.forEach(s=>q.append("subject",s));const d=await api(`./api/exam/source-notes?${q}`);sourceNotes=d.notes||[];renderSources();$("examStatus").textContent="Ready"}catch(e){sourceNotes=[];renderSources();$("examStatus").textContent="Error";showError(e.message||"Saved lesson notes could not be loaded.")}}
function fillOptions(c){
  $("classLevel").innerHTML=c.classes.map(x=>`<option>${esc(x)}</option>`).join("");
  $("term").innerHTML=c.terms.map(x=>`<option>${esc(x)}</option>`).join("");
  const refreshSubjects=()=>{
    const cls=$("classLevel").value,term=$("term").value;
    const subjects=term==="First Term"?(c.firstTermSubjectsByClass?.[cls]||[]):c.subjects;
    $("subjects").innerHTML=subjects.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
    $("subjectCount").textContent = `${subjects.length} subject${subjects.length===1?"":"s"} available for ${cls} in ${term}.`;
    $("selectAllSubjects").disabled = !subjects.length;
    $("clearSubjects").disabled = !subjects.length;
    const defaults=new Set(["English Studies","English Language","Mathematics"]);
    let picked=0;[...$("subjects").options].forEach(o=>{if(defaults.has(o.value)){o.selected=true;picked++}});
    if(!picked&&$("subjects").options[0])$("subjects").options[0].selected=true;
    loadSources();
  };
  $("classLevel").onchange=refreshSubjects;
  $("term").onchange=refreshSubjects;
  refreshSubjects();
}
function renderExam(exam){currentExam=exam;$("previewHeading").textContent=exam.title||"Generated Examination";$("downloadDocx").disabled=false;$("printExam").disabled=false;let no=1;let html=`<div class="exam-header"><img src="./logo.png" alt="DAFS logo"><div><h1>DESTINY ACHIEVERS FOUNDATION SCHOOL</h1><h2>${esc(exam.title||"EXAMINATION")}</h2><h3>${esc(exam.subjectLine||"")}</h3></div></div><div class="exam-details"><span>Name: ______________________________</span><span>Date: ${esc(exam.date||"")}</span></div>${exam.duration?`<div class="exam-duration">Duration: ${esc(exam.duration)}</div>`:""}`;for(const section of exam.sections||[]){html+=`<section class="exam-section"><h2>${esc(section.subject||"")}</h2><p class="exam-instruction"><b>Instruction:</b> Choose the correct answer.</p>`;for(const q of section.mcq||[]){html+=`<div class="exam-question"><b>${no++}.</b> ${esc(q.question)} <span class="options">A. ${esc(q.options?.A)} &nbsp;&nbsp; B. ${esc(q.options?.B)} &nbsp;&nbsp; C. ${esc(q.options?.C)} &nbsp;&nbsp; D. ${esc(q.options?.D)}</span></div>`}}html+=`<section class="exam-theory"><h2>THEORY</h2><p class="exam-instruction"><b>Instruction:</b> Answer all the questions.</p>`;let tn=1;for(const section of exam.sections||[]){if((section.theory||[]).length){html+=`<h3>${esc(section.subject)}</h3>`;for(const q of section.theory){html+=`<div class="theory-question"><b>${tn++}.</b> ${esc(q.question)} ${q.marks?`<span class="marks">(${esc(q.marks)} marks)</span>`:""}<div class="answer-lines">______________________________________________<br>______________________________________________<br>______________________________________________</div></div>`}}}html+=`</section>`;$("examPreview").innerHTML=html}
async function generateExam(){
  if(busy)return;
  clearError();
  const subjects=selectedSubjects(),noteIds=selectedNoteIds();
  if(!subjects.length)return showError("Please select at least one subject.");
  if(!noteIds.length)return showError("Please select at least one saved lesson note. The examination must be based on saved lesson notes.");
  const mcq=Number($("mcqCount").value),theory=Number($("theoryCount").value);
  if(!Number.isInteger(mcq)||mcq<5||mcq>50)return showError("Objective questions per subject must be between 5 and 50.");
  if(!Number.isInteger(theory)||theory<2||theory>15)return showError("Theory questions per subject must be between 2 and 15.");
  busy=true;
  setExamLoading(true,"Reading every selected weekly lesson note and building the examination subject by subject…");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),300000);
  try{
    const d=await api("./api/exam/generate",{method:"POST",body:JSON.stringify({classLevel:$("classLevel").value,term:$("term").value,subjects,noteIds,title:$("examTitle").value.trim()||"EXAMINATION",date:$("examDate").value,duration:$("duration").value.trim(),mcqCount:mcq,theoryCount:theory}),signal:controller.signal});
    renderExam(d.exam);$("examStatus").textContent="Examination ready";setExamLoading(false);
  }catch(e){
    setExamLoading(false);$("examStatus").textContent="Error";
    showError(e?.name==="AbortError"?"The examination is taking longer than expected. Please try again or select fewer subjects at once.":(e.message||"The examination could not be generated."));
  }finally{clearTimeout(timeout);busy=false}
}
$("selectAllNotes").onclick=()=>document.querySelectorAll('input[name="examNote"]').forEach(x=>x.checked=true);
$("selectAllSubjects").onclick=()=>{[...$("subjects").options].forEach(o=>o.selected=true);loadSources();};
$("clearSubjects").onclick=()=>{[...$("subjects").options].forEach(o=>o.selected=false);loadSources();};
$("generateExam").onclick=generateExam;
$("printExam").onclick=()=>window.print();
$("downloadDocx").onclick=async()=>{if(!currentExam)return;const b=$("downloadDocx");b.disabled=true;b.textContent="Preparing DOCX…";try{const r=await fetch("./api/exam/docx",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({exam:currentExam})});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"The DOCX file could not be created.")}const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=(currentExam.title||"DAFS_Examination").replace(/[^a-z0-9_-]+/gi,"_")+".docx";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}catch(e){showError(e.message)}finally{b.disabled=false;b.textContent="Download DOCX"}};
$("subjects").onchange=loadSources;
(async()=>{try{const m=await api("./api/me");if(!m.authenticated||!m.user?.role)return location.href="./login.html";currentUser=m.user;$("userBadge").textContent=`${m.user.name||"Teacher"} • ${m.user.role==="admin"?"Principal":"Teacher"}`;$("sideRole").textContent=m.user.role==="admin"?"Principal / Administrator":"Teacher";initMenu(m.user);const now=new Date(),local=new Date(now.getTime()-now.getTimezoneOffset()*60000);$("examDate").value=local.toISOString().slice(0,10);const c=await api("./api/curriculum");fillOptions(c)}catch(e){if(e.status===401)return location.href="./login.html";showError(e.message||"The examination generator could not be loaded.")}})();
