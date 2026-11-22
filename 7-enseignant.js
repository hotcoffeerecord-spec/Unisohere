// ===== 7-enseignant.js - REGENERE - UPLOAD PDF CORRIGE =====
let CACHE_MODULES = null, CACHE_PROGRAMMES = null, CACHE_QUIZ = null, CACHE_MATIERES = null;
let DERNIERE_VUE = {};
let USER_IS_PREMIUM = false;
let FASCICULE_EN_COURS = null;
let MON_PROGRAMME = null;
let FILTRE_MATIERE = "Tout";
let FILTRE_TYPE = "Tout";
let RECHERCHE_ACTIVE = "";
let MODIF_ID = null;
let MODIF_TYPE = null;

const $ = s => document.querySelector(s);
const go = p => window.location.href = p;

function toast(msg) {
  const t = $("#toast") || document.getElementById("msgProf");
  if (!t) { alert(msg); return; }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
function tronquer50(txt) {
  if (!txt) return "";
  txt = String(txt).trim();
  if (txt.length <= 50) return txt;
  return txt.slice(0, 50) + "...";
}
function norm(s) { return (s || "").toString().trim().toLowerCase(); }
function estGratuit(m) { return !m.prix || Number(m.prix) === 0; }

async function getUser() {
  const { data } = await supabaseClient.auth.getUser();
  return data.user;
}
async function getProfil() {
  const u = await getUser();
  if (!u) return null;
  const { data } = await supabaseClient.from("profiles").select("*").eq("id", u.id).maybeSingle();
  return data;
}
async function getMonProgramme() {
  if (MON_PROGRAMME) return MON_PROGRAMME;
  const p = await getProfil();
  MON_PROGRAMME = p?.programme || null;
  if (!MON_PROGRAMME) {
    try { MON_PROGRAMME = localStorage.getItem("mon_programme") || null; } catch(e) {}
  }
  return MON_PROGRAMME;
}
async function demanderProgrammeSiManquant() {
  const profil = await getProfil();
  if (!profil) return;
  if (profil.role === "enseignant" || profil.role === "prof") return;
  if (profil.programme) return;
  const progs = await getProgrammes();
  const choix = progs.map(p => p.nom).join("\n");
  const programmeChoisi = prompt("Choisis ton programme pour voir uniquement tes cours :\n\n" + choix + "\n\nÉcris exactement le nom (ex: Médecine)");
  if (!programmeChoisi) return;
  const { error } = await supabaseClient.from("profiles").update({ programme: programmeChoisi.trim() }).eq("id", profil.id);
  if (!error) {
    MON_PROGRAMME = programmeChoisi.trim();
    try { localStorage.setItem("mon_programme", MON_PROGRAMME); } catch(e) {}
    CACHE_MODULES = null;
    alert("Programme enregistré : " + MON_PROGRAMME);
    window.location.reload();
  }
}
async function chargerStatutPremium() {
  const p = await getProfil();
  USER_IS_PREMIUM = !!p?.premium;
  return USER_IS_PREMIUM;
}
async function getMatieres() {
  if (CACHE_MATIERES) return CACHE_MATIERES;
  const monProg = await getMonProgramme();
  let noms = [];
  try {
    const { data } = await supabaseClient.from("matieres").select("nom").eq("actif", true).eq("programme", monProg).order("nom");
    noms = (data || []).map(x => x.nom);
  } catch(e) {}
  if (!noms.length && window.MATIERES_PAR_PROGRAMME && MATIERES_PAR_PROGRAMME[monProg]) {
    noms = MATIERES_PAR_PROGRAMME[monProg];
  }
  if (!noms.length) noms = monProg === "Droit" ? ["Droit fiscal", "Droit juridique"] : ["Semiologie", "Physiologie", "Anatomie"];
  CACHE_MATIERES = [...new Set(noms)].map(n => ({ nom: n }));
  return CACHE_MATIERES;
}
async function getModules(force = false) {
  if (CACHE_MODULES && !force) return CACHE_MODULES;
  const { data, error } = await supabaseClient.from("modules").select("*, profiles:enseignant_id(full_name)").order("created_at", { ascending: false });
  if (error) console.log("Erreur modules:", error.message);
  let mods = data || [];
  const { data: lectures } = await supabaseClient.from("lectures").select("module_id");
  const compteur = {};
  (lectures || []).forEach(l => { compteur[l.module_id] = (compteur[l.module_id] || 0) + 1; });
  mods = mods.map(m => ({ ...m, nbLectures: compteur[m.id] || 0 }));
  const monProg = await getMonProgramme();
  const profil = await getProfil();
  const isEnseignant = profil?.role === "enseignant" || profil?.role === "prof";
  if (monProg && !isEnseignant) {
    mods = mods.filter(m => norm(m.programme) === norm(monProg));
  }
  CACHE_MODULES = mods;
  return CACHE_MODULES;
}
async function getModulesPourRecherche() {
  let mods = await getModules();
  const monProg = await getMonProgramme();
  const profil = await getProfil();
  const isEnseignant = profil?.role === "enseignant" || profil?.role === "prof";
  if (monProg && !isEnseignant) {
    mods = mods.filter(m => norm(m.programme) === norm(monProg));
  }
  return mods;
}
async function getProgrammes() {
  if (CACHE_PROGRAMMES) return CACHE_PROGRAMMES;
  const { data } = await supabaseClient.from("programmes").select("*").eq("actif", true).order("nom");
  CACHE_PROGRAMMES = data?.length ? data : PROGRAMMES_DEFAUT.map(n => ({ nom: n }));
  return CACHE_PROGRAMMES;
}
async function getQuiz() {
  if (CACHE_QUIZ) return CACHE_QUIZ;
  const { data } = await supabaseClient.from("quiz").select("*").order("created_at", { ascending: false });
  let quizs = data || [];
  const monProg = await getMonProgramme();
  const profil = await getProfil();
  if (monProg && profil?.role !== "enseignant") {
    quizs = quizs.filter(q => norm(q.programme) === norm(monProg));
  }
  CACHE_QUIZ = quizs;
  return CACHE_QUIZ;
}

// ===== MODAL / TABS PROF =====
function ouvrirModal(id){ document.getElementById(id)?.classList.remove("hidden"); }
function fermerModal(id){ document.getElementById(id)?.classList.add("hidden"); }
function afficherNomFichier(inputId, labelId){
  const f = document.getElementById(inputId)?.files[0];
  const l = document.getElementById(labelId);
  if(f && l) l.textContent = f.name + " (" + (f.size/1024/1024).toFixed(1) + " Mo)";
}
function changerTabProf(tab, btn){
  ["cours","quiz","vf","fiche","fascicule"].forEach(t=>{
    const el = document.getElementById("tab-"+t+"-prof");
    if(el) el.style.display = t===tab ? "block" : "none";
  });
  document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
  if(btn) btn.classList.add("active");
  if(tab==="cours") chargerMesCoursProf();
  if(tab==="quiz") chargerMesQuizProf();
  if(tab==="vf") chargerMesVFProf();
  if(tab==="fiche") chargerMesFichesProf();
  if(tab==="fascicule") chargerMesFasciculesProf();
}
function calculerGainFascicule(){
  const prix = Number(document.getElementById("fasc-prix")?.value || 0);
  const g = document.getElementById("gain-fasc");
  if(g) g.textContent = Math.round(prix*0.8) + " FCFA";
}
function togglePrixFascicule(){
  const chk = document.getElementById("fasc-gratuit");
  const prix = document.getElementById("fasc-prix");
  if(chk?.checked){ prix.value = 0; prix.disabled = true; }
  else { prix.disabled = false; }
  calculerGainFascicule();
}

// ===== UPLOAD PDF - C'EST ICI QUE LE BUG ETAIT =====
async function uploaderPDF(file, bucket){
  const nomUnique = Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9.-]/g,"_");
  const { error } = await supabaseClient.storage.from(bucket).upload(nomUnique, file);
  if(error) throw error;
  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(nomUnique);
  return data.publicUrl;
}

// ===== SAUVEGARDER COURS =====
async function sauvegarderCours(){
  const titre = document.getElementById("cours-titre").value.trim();
  const matiere = document.getElementById("cours-matiere").value;
  const desc = document.getElementById("cours-desc").value.trim();
  const fichier = document.getElementById("cours-fichier").files[0];
  const premium = document.querySelector('input[name="cours-premium"]:checked')?.value === "premium";
  if(!titre || !matiere || !desc) return toast("Remplis titre, matière et description");
  if(!fichier) return toast("Choisis ton PDF");
  if(fichier.size > 20*1024*1024) return toast("PDF trop lourd, max 20 Mo");
  toast("Upload du PDF en cours...");
  try{
    const url = await uploaderPDF(fichier, "cours");
    const u = await getUser();
    const profil = await getProfil();
    const { error } = await supabaseClient.from("modules").insert({
      titre, matiere, description: desc,
      type: "cours",
      programme: profil?.programme,
      enseignant_id: u.id,
      is_premium: premium,
      fichier_url: url,
      pdf_url: url,
      file_url: url
    });
    if(error) throw error;
    toast("Cours publié !");
    fermerModal('modal-cours');
    CACHE_MODULES = null;
    chargerMesCoursProf();
    chargerStatsProf();
  }catch(e){ toast("Erreur : " + e.message); }
}

// ===== SAUVEGARDER FICHE =====
async function sauvegarderFiche(){
  const titre = document.getElementById("fiche-titre").value.trim();
  const matiere = document.getElementById("fiche-matiere").value;
  const contenu = document.getElementById("fiche-contenu").value.trim();
  const resume = document.getElementById("fiche-resume").value.trim();
  const fichier = document.getElementById("fiche-fichier").files[0];
  const premium = document.querySelector('input[name="fiche-premium"]:checked')?.value === "premium";
  if(!titre || !matiere || !contenu) return toast("Remplis titre, matière et points clés");
  try{
    let url = null;
    if(fichier){
      toast("Upload du PDF...");
      url = await uploaderPDF(fichier, "fiches-pdf");
    }
    const u = await getUser();
    const profil = await getProfil();
    const { error } = await supabaseClient.from("modules").insert({
      titre, matiere, description: contenu + "\n\nA retenir : " + resume,
      type: "fiche",
      programme: profil?.programme,
      enseignant_id: u.id,
      is_premium: premium,
      fichier_url: url,
      pdf_url: url,
      file_url: url
    });
    if(error) throw error;
    toast("Fiche publiée !");
    fermerModal('modal-fiche');
    CACHE_MODULES = null;
    chargerMesFichesProf();
    chargerStatsProf();
  }catch(e){ toast("Erreur : " + e.message); }
}

// ===== SAUVEGARDER FASCICULE =====
async function sauvegarderFascicule(){
  const titre = document.getElementById("fasc-titre").value.trim();
  const matiere = document.getElementById("fasc-matiere").value;
  const desc = document.getElementById("fasc-desc").value.trim();
  const pages = document.getElementById("fasc-pages").value;
  const prix = Number(document.getElementById("fasc-prix").value || 0);
  const fichier = document.getElementById("fasc-fichier").files[0];
  const gratuit = document.getElementById("fasc-gratuit")?.checked;
  if(!titre || !matiere || !desc || !pages) return toast("Remplis tout");
  if(!fichier) return toast("Choisis le PDF du fascicule");
  if(fichier.size > 50*1024*1024) return toast("PDF trop lourd, max 50 Mo");
  if(!gratuit && (prix < 500 || prix > 50000)) return toast("Prix entre 500 et 50000 FCFA");
  toast("Upload du fascicule...");
  try{
    const url = await uploaderPDF(fichier, "fascicules-pdf");
    const u = await getUser();
    const profil = await getProfil();
    const { error } = await supabaseClient.from("modules").insert({
      titre, matiere, description: desc + " | Pages : " + pages,
      type: "fascicule",
      programme: profil?.programme,
      enseignant_id: u.id,
      prix: gratuit ? 0 : prix,
      fichier_url: url,
      pdf_url: url,
      file_url: url
    });
    if(error) throw error;
    toast("Fascicule publié !");
    fermerModal('modal-fascicule');
    CACHE_MODULES = null;
    chargerMesFasciculesProf();
    chargerStatsProf();
  }catch(e){ toast("Erreur : " + e.message); }
}

// ===== QUIZ / VRAI-FAUX =====
function ajouterQuestionQuiz(){
  const zone = document.getElementById("zone-questions-quiz");
  const n = zone.children.length + 1;
  if(n > 50) return toast("Max 50 questions");
  zone.insertAdjacentHTML("beforeend", `<div class="q-bloc" style="background:#111;padding:12px;border-radius:12px;margin:10px 0">
    <b>Question ${n}</b><input class="q-question" placeholder="Question ${n}">
    <input class="q-r1" placeholder="Réponse 1"><input class="q-r2" placeholder="Réponse 2">
    <input class="q-r3" placeholder="Réponse 3"><input class="q-r4" placeholder="Réponse 4">
    <input class="q-bonne" placeholder="Bonne réponse (recopie exactement)">
  </div>`);
  document.getElementById("compteur-quiz").textContent = zone.children.length;
}
function ajouterQuestionVF(){
  const zone = document.getElementById("zone-questions-vf");
  const n = zone.children.length + 1;
  if(n > 50) return toast("Max 50 affirmations");
  zone.insertAdjacentHTML("beforeend", `<div class="q-bloc" style="background:#111;padding:12px;border-radius:12px;margin:10px 0">
    <b>Affirmation ${n}</b><input class="q-question" placeholder="Affirmation ${n}">
    <select class="q-bonne"><option value="Vrai">Vrai</option><option value="Faux">Faux</option></select>
  </div>`);
  document.getElementById("compteur-vf").textContent = zone.children.length;
}
async function sauvegarderQuiz(){
  const titre = document.getElementById("quiz-titre").value.trim();
  const matiere = document.getElementById("quiz-matiere").value;
  const type = document.getElementById("quiz-type").value;
  const blocs = [...document.querySelectorAll("#zone-questions-quiz .q-bloc")];
  if(!titre || !matiere) return toast("Titre + matière obligatoires");
  if(blocs.length < 10) return toast("Minimum 10 questions");
  const u = await getUser(); const profil = await getProfil();
  for(const b of blocs){
    const q = b.querySelector(".q-question").value.trim();
    const r1 = b.querySelector(".q-r1").value.trim();
    const r2 = b.querySelector(".q-r2").value.trim();
    const r3 = b.querySelector(".q-r3").value.trim();
    const r4 = b.querySelector(".q-r4").value.trim();
    const bonne = b.querySelector(".q-bonne").value.trim();
    if(!q || !bonne) continue;
    await supabaseClient.from("quiz").insert({ titre, question: q, reponse1: r1, reponse2: r2, reponse3: r3, reponse4: r4, bonne_reponse: bonne, programme: profil?.programme, matiere, type, enseignant_id: u.id });
  }
  toast("Quiz publié !"); fermerModal('modal-quiz'); CACHE_QUIZ = null; chargerMesQuizProf();
}
async function sauvegarderVF(){
  const titre = document.getElementById("vf-titre").value.trim();
  const matiere = document.getElementById("vf-matiere").value;
  const blocs = [...document.querySelectorAll("#zone-questions-vf .q-bloc")];
  if(!titre || !matiere) return toast("Titre + matière obligatoires");
  if(blocs.length < 10) return toast("Minimum 10 affirmations");
  const u = await getUser(); const profil = await getProfil();
  for(const b of blocs){
    const q = b.querySelector(".q-question").value.trim();
    const bonne = b.querySelector(".q-bonne").value;
    if(!q) continue;
    await supabaseClient.from("quiz").insert({ titre, question: q, reponse1: "Vrai", reponse2: "Faux", reponse3: "", reponse4: "", bonne_reponse: bonne, programme: profil?.programme, matiere, type: "vrai_faux", enseignant_id: u.id });
  }
  toast("Vrai / Faux publié !"); fermerModal('modal-vf'); CACHE_QUIZ = null; chargerMesVFProf();
}

// ===== LISTES PROF =====
function carteProf(m, typeLabel){
  const hasFichier = !!(m.fichier_url || m.pdf_url || m.file_url);
  return `<div class="card">
    <h3>${m.titre}</h3><p>${tronquer50(m.description)}</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
      <span class="pill">${typeLabel}</span><span class="pill">${m.matiere||""}</span>
      <span class="pill">${m.nbLectures||0} lectures</span>
      <span class="pill" style="background:${hasFichier?"#1DB954":"#ff3b30"};color:#fff">${hasFichier?"PDF OK ✓":"SANS FICHIER ✗"}</span>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn-small btn-voir" onclick="ouvrirModule('${m.id}')">Voir</button>
      <button class="btn-small" onclick="ouvrirModifier('${m.id}','${m.type}')">Modifier</button>
      <button class="btn-small" style="background:#ff3b30;color:#fff" onclick="supprimerModule('${m.id}')">Supprimer</button>
    </div>
  </div>`;
}
async function chargerMesCoursProf(){
  const u = await getUser(); if(!u) return;
  const { data } = await supabaseClient.from("modules").select("*").eq("enseignant_id", u.id).eq("type","cours").order("created_at",{ascending:false});
  const el = document.getElementById("listeMesCours");
  if(el) el.innerHTML = data?.length ? data.map(m=>carteProf(m,"Cours")).join("") : `<div class="empty">Aucun cours pour l'instant.</div>`;
}
async function chargerMesFichesProf(){
  const u = await getUser(); if(!u) return;
  const { data } = await supabaseClient.from("modules").select("*").eq("enseignant_id", u.id).eq("type","fiche").order("created_at",{ascending:false});
  const el = document.getElementById("listeMesFiches");
  if(el) el.innerHTML = data?.length ? data.map(m=>carteProf(m,"Fiche")).join("") : `<div class="empty">Aucune fiche pour l'instant.</div>`;
}
async function chargerMesFasciculesProf(){
  const u = await getUser(); if(!u) return;
  const { data } = await supabaseClient.from("modules").select("*").eq("enseignant_id", u.id).eq("type","fascicule").order("created_at",{ascending:false});
  const el = document.getElementById("listeMesFascicules");
  if(el) el.innerHTML = data?.length ? data.map(m=>carteProf(m,"Fascicule")).join("") : `<div class="empty">Aucun fascicule pour l'instant.</div>`;
}
async function chargerMesQuizProf(){
  const u = await getUser(); if(!u) return;
  const { data } = await supabaseClient.from("quiz").select("*").eq("enseignant_id", u.id).eq("type","quiz").order("created_at",{ascending:false});
  const el = document.getElementById("listeMesQuiz");
  if(el) el.innerHTML = data?.length ? [...new Set(data.map(q=>q.titre))].map(t=>`<div class="card"><h3>${t}</h3><button class="btn-small" style="background:#ff3b30;color:#fff" onclick="supprimerQuizTitre('${t.replace(/'/g,"")}')">Supprimer</button></div>`).join("") : `<div class="empty">Aucun quiz.</div>`;
}
async function chargerMesVFProf(){
  const u = await getUser(); if(!u) return;
  const { data } = await supabaseClient.from("quiz").select("*").eq("enseignant_id", u.id).eq("type","vrai_faux").order("created_at",{ascending:false});
  const el = document.getElementById("listeMesVF");
  if(el) el.innerHTML = data?.length ? [...new Set(data.map(q=>q.titre))].map(t=>`<div class="card"><h3>${t}</h3><button class="btn-small" style="background:#ff3b30;color:#fff" onclick="supprimerQuizTitre('${t.replace(/'/g,"")}')">Supprimer</button></div>`).join("") : `<div class="empty">Aucun Vrai/Faux.</div>`;
}
async function chargerStatsProf(){
  const u = await getUser(); if(!u) return;
  const profil = await getProfil();
  const { data: mods } = await supabaseClient.from("modules").select("id,type").eq("enseignant_id", u.id);
  const ids = (mods||[]).map(m=>m.id);
  const { data: lectures } = await supabaseClient.from("lectures").select("module_id,created_at").in("module_id", ids.length?ids:["00000000-0000-0000-0000-000000000000"]);
  const total = lectures?.length || 0;
  // Lectures payantes = lectures avant abonnement_prof_expire_le
  const expire = profil?.abonnement_prof_expire_le ? new Date(profil.abonnement_prof_expire_le).getTime() : 0;
  const payantes = (lectures||[]).filter(l=> new Date(l.created_at).getTime() <= expire).length;
  const nbCoursEl = document.getElementById("nbCours"); if(nbCoursEl) nbCoursEl.textContent = (mods||[]).filter(m=>m.type==="cours").length;
  const nbVuesEl = document.getElementById("nbVues"); if(nbVuesEl) nbVuesEl.textContent = total;
  const nbPayEl = document.getElementById("nbVuesPayantes"); if(nbPayEl) nbPayEl.textContent = payantes;
  const gainEl = document.getElementById("gainTotal"); if(gainEl) gainEl.textContent = (payantes*0) + " FCFA"; // à calculer selon ton tarif par lecture
  const { data: quiz } = await supabaseClient.from("quiz").select("titre").eq("enseignant_id", u.id);
  const nbQuizEl = document.getElementById("nbQuiz"); if(nbQuizEl) nbQuizEl.textContent = new Set((quiz||[]).map(q=>q.titre)).size;
  const nomEl = document.getElementById("nomProf"); if(nomEl) nomEl.textContent = profil?.full_name || "Enseignant";
  const statutEl = document.getElementById("statutProf");
  if(statutEl) statutEl.textContent = "Statut : " + (profil?.statut_prof || profil?.role || "-") + " • Abonnement jusqu'au : " + (profil?.abonnement_prof_expire_le ? new Date(profil.abonnement_prof_expire_le).toLocaleDateString("fr-FR") : "-");
  const progEl = document.getElementById("programmeFixeHeader"); if(progEl) progEl.textContent = profil?.programme || "-";
  ["prog-cours","prog-quiz","prog-vf","prog-fiche","prog-fasc"].forEach(id=>{ const e=document.getElementById(id); if(e) e.textContent = profil?.programme || "-"; });
  const mats = await getMatieres();
  ["cours-matiere","quiz-matiere","vf-matiere","fiche-matiere","fasc-matiere","modif-matiere"].forEach(id=>{
    const sel = document.getElementById(id); if(sel) sel.innerHTML = `<option value="">-- Choisis la matière --</option>` + mats.map(m=>`<option value="${m.nom}">${m.nom}</option>`).join("");
  });
}
async function supprimerModule(id){
  if(!confirm("Supprimer ce contenu ?")) return;
  await supabaseClient.from("modules").delete().eq("id", id);
  CACHE_MODULES = null; chargerMesCoursProf(); chargerMesFichesProf(); chargerMesFasciculesProf(); chargerStatsProf();
}
async function supprimerQuizTitre(titre){
  if(!confirm("Supprimer le quiz : " + titre + " ?")) return;
  const u = await getUser();
  await supabaseClient.from("quiz").delete().eq("enseignant_id", u.id).eq("titre", titre);
  chargerMesQuizProf(); chargerMesVFProf();
}
function ouvrirModifier(id, type){
  MODIF_ID = id; MODIF_TYPE = type;
  const m = (CACHE_MODULES||[]).find(x=>x.id===id);
  document.getElementById("modif-titre-label").textContent = "Modifier " + type;
  document.getElementById("modif-titre").value = m?.titre || "";
  document.getElementById("modif-desc").value = m?.description || "";
  document.getElementById("bloc-modif-premium").style.display = type==="fascicule" ? "none" : "block";
  ouvrirModal('modal-modifier');
}
async function sauvegarderModification(){
  const titre = document.getElementById("modif-titre").value.trim();
  const matiere = document.getElementById("modif-matiere").value;
  const desc = document.getElementById("modif-desc").value.trim();
  const premium = document.querySelector('input[name="modif-premium"]:checked')?.value === "premium";
  const upd = { titre, matiere, description: desc };
  if(MODIF_TYPE!=="fascicule") upd.is_premium = premium;
  await supabaseClient.from("modules").update(upd).eq("id", MODIF_ID);
  toast("Modifié !"); fermerModal('modal-modifier'); CACHE_MODULES=null;
  chargerMesCoursProf(); chargerMesFichesProf(); chargerMesFasciculesProf();
}

// ===== OUVERTURE FICHIER - CORRIGE =====
function ouvrirFichierDirect(m) {
  const url = m.fichier_url || m.pdf_url || m.file_url || m.lien || m.url;
  if (!url) { toast("Aucun fichier pour ce cours - le prof n'a pas uploadé de PDF"); return; }
  window.open(url, "_blank");
}
async function ouvrirModule(id) {
  const u = await getUser();
  if (!u) { go("connexion.html"); return; }
  let m = (CACHE_MODULES || []).find(x => x.id === id);
  if (!m) {
    const { data } = await supabaseClient.from("modules").select("*, profiles:enseignant_id(full_name)").eq("id", id).maybeSingle();
    m = data;
  }
  if (!m) { toast("Cours introuvable"); return; }
  if (m?.type === "fascicule") {
    if (!estGratuit(m)) {
      const { data: achat } = await supabaseClient.from("mes_cours").select("id").eq("user_id", u.id).eq("module_id", id).maybeSingle();
      if (!achat) { ouvrirPaiementFascicule(id, m.prix || 0, m.titre); return; }
    }
  } else {
    if (m?.is_premium && !USER_IS_PREMIUM) {
      const p = await getProfil();
      if (!p?.premium) { toast("Cours Premium - Passe en Premium"); setTimeout(() => go("abonnementpremium.html"), 800); return; }
      else { USER_IS_PREMIUM = true; }
    }
  }
  const maintenant = Date.now();
  const derniereVueLocale = DERNIERE_VUE[id] || 0;
  let compterVue = (maintenant - derniereVueLocale) >= 10000;
  if (compterVue) {
    const { data: derniereEnBDD } = await supabaseClient.from("lectures").select("created_at").eq("user_id", u.id).eq("module_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (derniereEnBDD && (maintenant - new Date(derniereEnBDD.created_at).getTime()) < 10000) compterVue = false;
  }
  if (compterVue) {
    DERNIERE_VUE[id] = maintenant;
    const { error } = await supabaseClient.from("lectures").insert({ user_id: u.id, module_id: id });
    if (!error) m.nbLectures = (m.nbLectures || 0) + 1;
  } else { DERNIERE_VUE[id] = maintenant; }
  try { localStorage.setItem("dernier_cours_id", id); } catch(e) {}
  ouvrirFichierDirect(m);
}

// ===== INIT PAGE ENSEIGNANT =====
document.addEventListener("DOMContentLoaded", async ()=>{
  const u = await getUser();
  if(!u) { go("connexion.html"); return; }
  const profil = await getProfil();
  if(profil?.role!=="enseignant" && profil?.role!=="prof"){
    // Si étudiant arrive ici, on le renvoie à l'accueil
    // go("accueil.html"); return;
  }
  // Init 10 questions quiz + VF par défaut
  const zq = document.getElementById("zone-questions-quiz");
  if(zq && zq.children.length===0){ for(let i=0;i<10;i++) ajouterQuestionQuiz(); }
  const zv = document.getElementById("zone-questions-vf");
  if(zv && zv.children.length===0){ for(let i=0;i<10;i++) ajouterQuestionVF(); }
  await chargerStatsProf();
  await chargerMesCoursProf();
  await chargerMesQuizProf();
  await chargerMesVFProf();
  await chargerMesFichesProf();
  await chargerMesFasciculesProf();
});

// ===== FONCTIONS COMMUNES (accueil / recherche / paiement) GARDÉES =====
function carteQuiz(q) {
  return `<div class="card" onclick="ouvrirQuiz('${q.id}')" style="cursor:pointer;border-left:4px solid #ff7a1a;">
    <div class="card-info"><h3>🧩 ${q.titre || q.question || "Quiz"}</h3><p>${tronquer50(q.description || q.question || "")}</p></div>
    <div class="card-actions"><button class="btn-small btn-voir" onclick="event.stopPropagation();ouvrirQuiz('${q.id}')">Jouer</button></div>
  </div>`;
}
function ouvrirQuiz(id) { go("quiz.html?id=" + id); }
function carteModule(m) {
  const isFasc = m.type === "fascicule";
  const isFiche = m.type === "fiche";
  const isPremium = !!m.is_premium;
  const estDejaDebloque = isPremium && USER_IS_PREMIUM;
  const gratuit = estGratuit(m);
  let badge;
  if (isFasc) badge = `<span class="pill" style="background:#7b5cff;color:#fff">Fascicule</span>`;
  else if (isPremium) badge = estDejaDebloque ? `<span class="pill pill-premium" style="background:#00c853">Premium ✓</span>` : `<span class="pill pill-premium">Premium</span>`;
  else badge = `<span class="pill pill-dispo">Gratuit</span>`;
  const prix = isFasc ? (gratuit ? `<span class="pill" style="background:#7CFC00;color:#000">Gratuit</span>` : `<span class="pill" style="background:#7b5cff;color:#fff">${m.prix || 0} FCFA</span>`) : "";
  const auteur = m.profiles?.full_name ? `<p style="color:#666;font-weight:600;margin:4px 0">Par ${m.profiles.full_name}</p>` : "";
  return `<div class="card" onclick="ouvrirModule('${m.id}')" style="cursor:pointer;">
    <div class="card-info"><h3>${isFiche ? "📝 " : ""}${m.titre}</h3>${auteur}<p>${tronquer50(m.description)}</p>
    <div class="badge-ligne" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${badge}${prix}<span class="pill">${m.nbLectures||0} lectures</span></div></div>
    <div class="card-actions"><button class="btn-small btn-voir" onclick="event.stopPropagation();ouvrirModule('${m.id}')">Voir</button></div>
  </div>`;
}
async function toggleFavori(module_id, btn) {
  const u = await getUser();
  if (!u) { go("connexion.html"); return; }
  const { data: ex } = await supabaseClient.from("favoris").select("id").eq("user_id", u.id).eq("module_id", module_id).maybeSingle();
  if (ex) { await supabaseClient.from("favoris").delete().eq("id", ex.id); if (btn) btn.textContent = "+ Mes Cours"; toast("Retiré de Mes Cours"); }
  else { const { error } = await supabaseClient.from("favoris").insert({ user_id: u.id, module_id: module_id }); if (error) { toast("Impossible d'ajouter"); return; } if (btn) btn.textContent = "✓ Dans Mes Cours"; toast("Ajouté à Mes Cours ♥"); }
}
async function deconnecter() {
  CACHE_MODULES = null; MON_PROGRAMME = null; CACHE_QUIZ = null; CACHE_MATIERES = null;
  try { localStorage.removeItem("mon_programme"); } catch(e) {}
  await supabaseClient.auth.signOut();
  go("groupe.html");
}
function detecterOperateur(numero) {
  if (!numero) return null;
  if (numero.startsWith("06")) return "MTN MoMo";
  if (numero.startsWith("05") || numero.startsWith("04")) return "Airtel Money";
  return null;
}
function nettoyerNumeroPaiement(val) {
  let n = String(val || "").replace(/\D/g, "");
  if (n.startsWith("242")) n = n.slice(3);
  if (n.startsWith("00242")) n = n.slice(5);
  return n.slice(0, 9);
}
function validerNumeroPaiement(numero) {
  if (!numero) return { ok: false, erreur: "Entre ton numéro", operateur: null };
  if (!/^[0-9]+$/.test(numero)) return { ok: false, erreur: "Que des chiffres", operateur: null };
  if (numero.length < 9) return { ok: false, erreur: "Il manque " + (9 - numero.length) + " chiffre(s)", operateur: detecterOperateur(numero) };
  if (numero.length > 9) return { ok: false, erreur: "9 chiffres maximum", operateur: detecterOperateur(numero) };
  const op = detecterOperateur(numero);
  if (!op) return { ok: false, erreur: "Le numéro doit commencer par 06, 05 ou 04", operateur: null };
  return { ok: true, erreur: "", operateur: op };
}
function ouvrirPaiementFascicule(id, prix, titre) {
  if (!prix || Number(prix) === 0) { ouvrirModule(id); return; }
  FASCICULE_EN_COURS = { id, prix, titre };
  const modal = document.getElementById("modalPaiement");
  if (!modal) { alert("Ajoute le modal de paiement dans la page"); return; }
  document.getElementById("paiementTitre").textContent = titre || "Fascicule";
  document.getElementById("paiementPrix").textContent = prix + " FCFA";
  modal.classList.add("ouvert");
}
function fermerPaiement() { document.getElementById("modalPaiement")?.classList.remove("ouvert"); }
async function payerFascicule() {
  const input = document.getElementById("inputNumeroPaiement");
  const numero = nettoyerNumeroPaiement(input ? input.value : "");
  if (input) input.value = numero;
  const validation = validerNumeroPaiement(numero);
  if (!validation.ok) { toast(validation.erreur); return; }
  const u = await getUser();
  if (!u) { go("connexion.html"); return; }
  const { error } = await supabaseClient.from("mes_cours").insert({ user_id: u.id, module_id: FASCICULE_EN_COURS.id, numero_paiement: "+242" + numero, operateur: validation.operateur, statut: "en_attente" });
  if (error) { toast("Valide le paiement sur ton téléphone, puis réessaie"); return; }
  toast("Vérifie ton téléphone et valide le paiement !");
  setTimeout(() => { fermerPaiement(); ouvrirModule(FASCICULE_EN_COURS.id); }, 1500);
}