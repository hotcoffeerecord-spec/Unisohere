let CACHE_MODULES = null, CACHE_PROGRAMMES = null, CACHE_QUIZ = null, CACHE_MATIERES = null;
let DERNIERE_VUE = {};
let USER_IS_PREMIUM = false;
let FASCICULE_EN_COURS = null;
let MON_PROGRAMME = null;
let FILTRE_MATIERE = "Tout";
let FILTRE_TYPE = "Tout";
let RECHERCHE_ACTIVE = "";

const $ = s => document.querySelector(s);
const go = p => window.location.href = p;

function toast(msg) {
  const t = $("#toast");
  if (!t) { alert(msg); return; }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
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
function carteQuiz(q) {
  return `<div class="card" onclick="ouvrirQuiz('${q.id}')" style="cursor:pointer;border-left:4px solid #ff7a1a;">
    <div class="card-info">
      <h3>🧩 ${q.titre || q.question || "Quiz"}</h3>
      <p>${tronquer50(q.description || q.question || "")}</p>
      <div class="badge-ligne" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
        <span class="pill" style="background:#ff7a1a;color:#fff">Quiz</span>
        ${q.matiere ? `<span class="pill" style="background:#222;color:#fff">${q.matiere}</span>` : ""}
        ${q.programme ? `<span class="pill" style="background:#222;color:#fff">${q.programme}</span>` : ""}
      </div>
    </div>
    <div class="card-actions">
      <button class="btn-small btn-voir" onclick="event.stopPropagation();ouvrirQuiz('${q.id}')">Jouer</button>
    </div>
  </div>`;
}
function ouvrirQuiz(id) { go("quiz.html?id=" + id); }
function renderCategories(list, elId = "listeCategories") {
  const el = document.getElementById(elId);
  if (!el) return;
  const couleurs = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"];
  const btnTout = `<div class="cat actif" onclick="filtrerTout(this)"><div class="cat-letter">★</div>Tout</div>`;
  const btnMatieres = list.map((p, i) => `<div class="cat ${couleurs[i % 7]}" onclick="filtrerParMatiere('${p.nom}',this)"><div class="cat-letter">${(p.nom || "?")[0]}</div>${p.nom}</div>`).join("");
  el.innerHTML = btnTout + btnMatieres;
}
function appliquerFiltres() {
  if (RECHERCHE_ACTIVE) { appliquerRechercheSurFil(RECHERCHE_ACTIVE); return; }
  const el = $("#listeCours");
  if (!el || !CACHE_MODULES) return;
  let list = [...CACHE_MODULES];
  if (FILTRE_MATIERE !== "Tout") list = list.filter(m => norm(m.matiere) === norm(FILTRE_MATIERE));
  if (FILTRE_TYPE === "Cours") list = list.filter(m => m.type === "cours");
  if (FILTRE_TYPE === "Fiches") list = list.filter(m => m.type === "fiche");
  if (FILTRE_TYPE === "Fascicules") list = list.filter(m => m.type === "fascicule");
  const t = $("#titreFil");
  if (t) {
    if (FILTRE_MATIERE !== "Tout" && FILTRE_TYPE !== "Tout") t.textContent = "Fil d'actualité - " + FILTRE_MATIERE + " - " + FILTRE_TYPE;
    else if (FILTRE_MATIERE !== "Tout") t.textContent = "Fil d'actualité - " + FILTRE_MATIERE;
    else if (FILTRE_TYPE !== "Tout") t.textContent = "Fil d'actualité - " + FILTRE_TYPE;
    else t.textContent = "Fil d'actualité - Tout";
  }
  el.innerHTML = list.length ? list.map(carteModule).join("") : `<div class="empty">Rien en ${FILTRE_MATIERE} - ${FILTRE_TYPE} pour l'instant.</div>`;
}
function filtrerTout(btn) {
  RECHERCHE_ACTIVE = "";
  FILTRE_MATIERE = "Tout";
  document.querySelectorAll(".cat").forEach(c => c.classList.remove("actif"));
  if (btn) btn.classList.add("actif");
  appliquerFiltres();
}
function filtrerParMatiere(nom, btn) {
  RECHERCHE_ACTIVE = "";
  FILTRE_MATIERE = nom;
  document.querySelectorAll(".cat").forEach(c => c.classList.remove("actif"));
  if (btn) btn.classList.add("actif");
  appliquerFiltres();
}
function carteModule(m) {
  const isFasc = m.type === "fascicule";
  const isFiche = m.type === "fiche";
  const isPremium = !!m.is_premium;
  const estDejaDebloque = isPremium && USER_IS_PREMIUM;
  const gratuit = estGratuit(m);
  let badge;
  if (isFasc) {
    badge = `<span class="pill" style="background:#7b5cff;color:#fff">Fascicule</span>`;
  } else if (isPremium) {
    badge = estDejaDebloque ? `<span class="pill pill-premium" style="background:#00c853">Premium ✓</span>` : `<span class="pill pill-premium">Premium</span>`;
  } else {
    badge = `<span class="pill pill-dispo">Gratuit</span>`;
  }
  const prix = isFasc ? (gratuit ? `<span class="pill" style="background:#7CFC00;color:#000">Gratuit</span>` : `<span class="pill" style="background:#7b5cff;color:#fff">${m.prix || 0} FCFA</span>`) : "";
  const auteur = m.profiles?.full_name ? `<p style="color:#666;font-weight:600;margin:4px 0">Par ${m.profiles.full_name}</p>` : "";
  const programme = m.programme ? `<span class="pill" style="background:#222;color:#fff">${m.programme}</span>` : "";
  const matiere = m.matiere ? `<span class="pill" style="background:#222;color:#fff">${m.matiere}</span>` : "";
  let typeLabel = "Cours"; let typeStyle = "background:#333;color:#fff";
  if (isFasc) { typeLabel = "Fascicule"; typeStyle = "background:#7b5cff;color:#fff"; }
  if (isFiche) { typeLabel = "Fiche de révision"; typeStyle = "background:#00c9a7;color:#fff"; }
  const typeBadge = `<span class="pill" style="${typeStyle}">${typeLabel}</span>`;
  const lectures = `<span class="pill" style="background:#000;color:#fff">${m.nbLectures || 0} lectures</span>`;
  const desc = tronquer50(m.description);
  const styleBordure = (isPremium && !estDejaDebloque && !isFasc) ? "cursor:pointer;border-right:4px solid #ff0000;" : "cursor:pointer;";
  let texteBouton = "Voir";
  let classeBouton = "btn-voir";
  let actionBouton = `ouvrirModule('${m.id}')`;
  if (isFiche) { texteBouton = "Réviser"; }
  if (isFasc) {
    if (gratuit) {
      texteBouton = "Ouvrir"; classeBouton = "btn-voir"; actionBouton = `ouvrirModule('${m.id}')`;
    } else {
      texteBouton = "Acheter"; classeBouton = "btn-acheter"; actionBouton = `ouvrirPaiementFascicule('${m.id}', ${m.prix || 0}, '${(m.titre||'').replace(/'/g,"")}')`;
    }
  } else {
    if (isPremium && !estDejaDebloque) { texteBouton = "Débloquer >"; classeBouton = "btn-premium"; }
    if (isPremium && estDejaDebloque) { texteBouton = "Voir"; classeBouton = "btn-voir"; }
  }
  return `<div class="card" data-module-id="${m.id}" onclick="ouvrirModule('${m.id}')" style="${styleBordure}">
    <div class="card-info">
      <h3>${isFiche ? "📝 " : ""}${m.titre}</h3>
      ${auteur}
      <p>${desc}</p>
      <div class="badge-ligne" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${badge}${prix}${typeBadge}${programme}${matiere}${lectures}</div>
    </div>
    <div class="card-actions">
      <button class="btn-small ${classeBouton}" onclick="event.stopPropagation();${actionBouton}">${texteBouton}</button>
      <button class="btn-small" style="background:#f2f2f2;color:#000" onclick="event.stopPropagation();partagerModule('${m.id}','${(m.titre||'').replace(/'/g,"")}')">↗ Partager</button>
      <button class="btn-mescours" onclick="event.stopPropagation();toggleFavori('${m.id}',this)">+ Mes Cours</button>
    </div>
  </div>`;
}
async function chargerAccueil() {
  CACHE_MODULES = null; MON_PROGRAMME = null; CACHE_QUIZ = null; CACHE_MATIERES = null;
  FILTRE_MATIERE = "Tout"; FILTRE_TYPE = "Tout"; RECHERCHE_ACTIVE = "";
  await demanderProgrammeSiManquant();
  await chargerStatutPremium();
  const [mods, matieres] = await Promise.all([getModules(true), getMatieres()]);
  const monProg = await getMonProgramme();
  renderCategories(matieres);
  const el = $("#listeCours");
  if (el) {
    if (monProg && !mods.length) {
      el.innerHTML = `<div class="empty">Aucun cours pour <b>${monProg}</b> pour l'instant.<br>Les profs vont bientôt publier.</div>`;
    } else {
      const idCoursCible = new URLSearchParams(window.location.search).get("cours");
      let listeAffichee = [...mods];
      if (idCoursCible) {
        const idx = listeAffichee.findIndex(m => String(m.id) === String(idCoursCible));
        if (idx > 0) {
          const [cible] = listeAffichee.splice(idx, 1);
          listeAffichee.unshift(cible);
        }
      }
      el.innerHTML = listeAffichee.length ? listeAffichee.slice(0, 20).map(carteModule).join("") : `<div class="empty">Aucun cours pour l'instant.</div>`;
    }
  }
  const titre = $("#titreFil");
  if (titre) titre.textContent = "Fil d'actualité - Tout";
  const paramsCours = new URLSearchParams(window.location.search).get("cours");
  if (paramsCours) {
    setTimeout(() => {
      const carte = document.querySelector(`[data-module-id="${paramsCours}"]`);
      if (carte) {
        carte.scrollIntoView({ behavior: "smooth", block: "center" });
        carte.style.outline = "2px solid #000";
        carte.style.outlineOffset = "2px";
        setTimeout(() => { carte.style.outline = ""; carte.style.outlineOffset = ""; }, 3000);
      }
    }, 400);
  }
}
async function choisirTypeAccueil(type, btn) {
  document.querySelectorAll("#filtresAccueil .filter").forEach(b => b.classList.remove("actif"));
  if (btn) btn.classList.add("actif");
  const el = $("#listeCours");
  if (!el) return;
  if (type === "Quiz") {
    RECHERCHE_ACTIVE = "";
    const quizs = await getQuiz();
    let list = quizs;
    if (FILTRE_MATIERE !== "Tout") list = list.filter(q => norm(q.matiere) === norm(FILTRE_MATIERE));
    const t = $("#titreFil");
    if (t) t.textContent = FILTRE_MATIERE !== "Tout" ? "Fil d'actualité - " + FILTRE_MATIERE + " - Quiz" : "Fil d'actualité - Quiz";
    el.innerHTML = list.length ? list.map(carteQuiz).join("") : `<div class="empty">Aucun quiz en ${FILTRE_MATIERE} pour l'instant.</div>`;
    return;
  }
  FILTRE_TYPE = type;
  appliquerFiltres();
}
function ouvrirModule(id) {
  window.location.href = "lecteur.html?id=" + id;
}
async function partagerModule(id, titre) {
  const lien = window.location.origin + "/lecteur.html?id=" + id;
  const nom = titre || "Cours";
  if (navigator.share) {
    try { await navigator.share({ title: nom, text: "Regarde ce cours sur Unisphere : " + nom, url: lien }); return; } catch(e) {}
  }
  try { await navigator.clipboard.writeText(lien); toast("Lien copié ! Envoie-le à tes amis"); }
  catch(e) { prompt("Copie ce lien :", lien); }
}
async function toggleFavori(module_id, btn) {
  const u = await getUser();
  if (!u) { go("connexion.html?next=" + encodeURIComponent("acceuil.html")); return; }
  const { data: ex } = await supabaseClient.from("favoris").select("id").eq("user_id", u.id).eq("module_id", module_id).maybeSingle();
  if (ex) {
    await supabaseClient.from("favoris").delete().eq("id", ex.id);
    if (btn) btn.textContent = "+ Mes Cours";
    toast("Retiré de Mes Cours");
  } else {
    const { error } = await supabaseClient.from("favoris").insert({ user_id: u.id, module_id: module_id });
    if (error) { toast("Impossible d'ajouter"); return; }
    if (btn) btn.textContent = "✓ Dans Mes Cours";
    toast("Ajouté à Mes Cours ♥");
  }
}
async function chargerMesCours(elId = "listeCours") {
  const u = await getUser();
  if (!u) { go("connexion.html?next=" + encodeURIComponent("acceuil.html")); return; }
  await chargerStatutPremium();
  const el = document.getElementById(elId);
  if (!el) return;
  const { data: favs } = await supabaseClient.from("favoris").select("module_id").eq("user_id", u.id).order("created_at", { ascending: false });
  if (!favs || !favs.length) {
    el.innerHTML = `<div class="empty">Tu n'as pas encore de cours en favoris.<br>Appuie sur <b>+ Mes Cours</b> sur un cours pour l'ajouter ici.</div>`;
    return;
  }
  const ids = favs.map(f => f.module_id);
  const mods = await getModules();
  const mesMods = mods.filter(m => ids.includes(m.id));
  mesMods.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  el.innerHTML = mesMods.length ? mesMods.map(carteModule).join("") : `<div class="empty">Aucun cours trouvé.</div>`;
  document.querySelectorAll(".btn-mescours").forEach(b => b.textContent = "✓ Dans Mes Cours");
}
async function retirerDeMesCours(module_id, btn) {
  await toggleFavori(module_id, btn);
  chargerMesCours();
}
async function deconnecter() {
  CACHE_MODULES = null; MON_PROGRAMME = null; CACHE_QUIZ = null; CACHE_MATIERES = null;
  try { localStorage.removeItem("mon_programme"); } catch(e) {}
  await supabaseClient.auth.signOut();
  go("groupe.html");
}
function ouvrirRecherche() { $("#searchOverlay")?.classList.add("ouvert"); }
function fermerRecherche() { $("#searchOverlay")?.classList.remove("ouvert"); }
function effacerRecherche() {
  const i = $("#inputRecherche"); if (i) i.value = "";
  const b = $("#searchResults"); if (b) b.innerHTML = "";
}
function normaliserTexte(s) {
  return (s || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim();
}
function distanceLevenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}
function ressemblanceMot(motRecherche, motCible) {
  if (!motRecherche || !motCible) return 0;
  if (motCible === motRecherche) return 1;
  if (motCible.startsWith(motRecherche) || motRecherche.startsWith(motCible)) return 0.9;
  if (motCible.includes(motRecherche) || motRecherche.includes(motCible)) return 0.75;
  const dist = distanceLevenshtein(motRecherche, motCible);
  const maxLen = Math.max(motRecherche.length, motCible.length);
  return 1 - dist / maxLen;
}
function scoreRecherche(m, motsRecherche, requeteNorm) {
  const titre = normaliserTexte(m.titre);
  const matiere = normaliserTexte(m.matiere);
  const desc = normaliserTexte(m.description);
  const prog = normaliserTexte(m.programme);
  const auteur = normaliserTexte(m.profiles?.full_name);
  const type = normaliserTexte(m.type);
  let score = 0;
  if (titre.includes(requeteNorm)) score += 100;
  if (matiere === requeteNorm) score += 120;
  if (matiere.includes(requeteNorm)) score += 90;
  if (desc.includes(requeteNorm)) score += 40;
  if (type === requeteNorm) score += 70;
  if (type.includes(requeteNorm)) score += 50;
  const motsTitre = titre.split(" ").filter(Boolean);
  const motsMatiere = matiere.split(" ").filter(Boolean);
  const motsDesc = desc.split(" ").filter(Boolean);
  for (const mot of motsRecherche) {
    if (mot.length < 2) continue;
    let meilleur = 0;
    for (const w of motsMatiere) meilleur = Math.max(meilleur, ressemblanceMot(mot, w));
    if (meilleur >= 0.7) score += meilleur * 60;
    meilleur = 0;
    for (const w of motsTitre) meilleur = Math.max(meilleur, ressemblanceMot(mot, w));
    if (meilleur >= 0.7) score += meilleur * 50;
    meilleur = 0;
    for (const w of motsDesc) meilleur = Math.max(meilleur, ressemblanceMot(mot, w));
    if (meilleur >= 0.8) score += meilleur * 20;
    if (auteur.includes(mot)) score += 15;
    if (prog.includes(mot)) score += 10;
  }
  const toutTexte = titre + " " + matiere + " " + desc;
  const tousTrouves = motsRecherche.every(mot => {
    if (mot.length < 2) return true;
    return toutTexte.split(" ").some(w => ressemblanceMot(mot, w) >= 0.7);
  });
  if (tousTrouves && motsRecherche.length > 1) score += 40;
  return score;
}
async function lancerRecherche(q) {
  const box = $("#searchResults");
  if (!box) return;
  const requeteNorm = normaliserTexte(q);
  if (!requeteNorm) { box.innerHTML = ""; return; }
  const motsRecherche = requeteNorm.split(" ").filter(Boolean);
  const mods = await getModulesPourRecherche();
  const coursScored = mods.map(m => ({ m, score: scoreRecherche(m, motsRecherche, requeteNorm) }))
    .filter(x => x.score >= 35)
    .sort((a, b) => b.score - a.score);
  if (!coursScored.length) {
    box.innerHTML = `<div class="search-empty">Aucun résultat pour "${q}" dans ton programme<br><small style="color:#888">Appuie sur ✓ pour voir tout le fil quand même</small></div>`;
    return;
  }
  let html = `<div style="font-size:12px;font-weight:800;color:var(--muted);padding:4px 4px 8px">${coursScored.length} trouvé(s) - appuie sur ✓ pour voir dans le fil</div>`;
  html += coursScored.slice(0, 8).map(({ m }) => {
    const labelType = m.type === "fascicule" ? "📚 Fascicule" : m.type === "fiche" ? "📝 Fiche" : "📖 Cours";
    return `<div class="suggestion" onclick="ouvrirModule('${m.id}')">
      <span style="flex:1;min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.titre}</b><small style="color:var(--muted)">${labelType} • ${m.matiere || ""}</small></span>
      <span style="font-size:18px">→</span>
    </div>`;
  }).join("");
  box.innerHTML = html;
}
async function validerRecherche() {
  const input = $("#inputRecherche");
  const q = (input ? input.value.trim() : "") || RECHERCHE_ACTIVE;
  if (!q) { toast("Tape quelque chose à rechercher"); return; }
  RECHERCHE_ACTIVE = q;
  fermerRecherche();
  await appliquerRechercheSurFil(q);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function appliquerRechercheSurFil(q) {
  const el = $("#listeCours");
  if (!el) return;
  const requeteNorm = normaliserTexte(q);
  const motsRecherche = requeteNorm.split(" ").filter(Boolean);
  const mods = await getModulesPourRecherche();
  const scored = mods.map(m => ({ m, score: scoreRecherche(m, motsRecherche, requeteNorm) }))
    .sort((a, b) => b.score - a.score);
  const matiereExacte = scored.find(x => normaliserTexte(x.m.matiere) === requeteNorm)?.m?.matiere || null;
  const t = $("#titreFil");
  if (t) t.textContent = `Résultats pour "${q}"`;
  let html = "";
  if (matiereExacte) {
    const groupeMatiere = scored.filter(x => norm(x.m.matiere) === norm(matiereExacte));
    const reste = scored.filter(x => norm(x.m.matiere) !== norm(matiereExacte));
    html += `<div class="titre-groupe-recherche">📚 ${matiereExacte} — ${groupeMatiere.length} cours</div>`;
    html += groupeMatiere.map(({ m }) => carteModule(m)).join("");
    if (reste.length) {
      html += `<div class="titre-groupe-recherche">Autres cours de ton programme</div>`;
      html += reste.map(({ m }) => carteModule(m)).join("");
    }
  } else {
    const proches = scored.filter(x => x.score >= 35);
    const idsProches = new Set(proches.map(x => x.m.id));
    const matiereDuTop = proches.length ? proches[0].m.matiere : null;
    const memeMatiere = matiereDuTop ? scored.filter(x => !idsProches.has(x.m.id) && norm(x.m.matiere) === norm(matiereDuTop)) : [];
    const idsMeme = new Set(memeMatiere.map(x => x.m.id));
    const reste = scored.filter(x => !idsProches.has(x.m.id) && !idsMeme.has(x.m.id));
    if (proches.length) {
      html += `<div class="titre-groupe-recherche">🎯 Les plus proches de "${q}" — ${proches.length}</div>`;
      html += proches.map(({ m }) => carteModule(m)).join("");
    }
    if (memeMatiere.length) {
      html += `<div class="titre-groupe-recherche">📚 Même matière : ${matiereDuTop} — ${memeMatiere.length}</div>`;
      html += memeMatiere.map(({ m }) => carteModule(m)).join("");
    }
    if (reste.length) {
      html += `<div class="titre-groupe-recherche">Autres cours de ton programme</div>`;
      html += reste.map(({ m }) => carteModule(m)).join("");
    }
    if (!proches.length && !memeMatiere.length && !reste.length) {
      html = `<div class="empty">Aucun cours pour "${q}" dans ton programme</div>`;
    }
  }
  el.innerHTML = html;
}
function retourFilNormal() {
  RECHERCHE_ACTIVE = "";
  const input = $("#inputRecherche");
  if (input) input.value = "";
  const box = $("#searchResults");
  if (box) box.innerHTML = "";
  fermerRecherche();
  FILTRE_MATIERE = "Tout"; FILTRE_TYPE = "Tout";
  document.querySelectorAll(".cat").forEach(c => c.classList.remove("actif"));
  document.querySelectorAll(".cat").forEach(c => { if (c.textContent.trim() === "Tout") c.classList.add("actif"); });
  document.querySelectorAll("#filtresAccueil .filter").forEach(b => b.classList.remove("actif"));
  const btnTout = document.querySelector("#filtresAccueil .filter");
  if (btnTout) btnTout.classList.add("actif");
  const t = $("#titreFil");
  if (t) t.textContent = "Fil d'actualité - Tout";
  const el = $("#listeCours");
  if (el && CACHE_MODULES) {
    el.innerHTML = CACHE_MODULES.slice(0, 20).map(carteModule).join("") || `<div class="empty">Aucun cours pour l'instant.</div>`;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
let TIMER_RECHERCHE = null;
document.addEventListener("input", async e => {
  if (e.target.id !== "inputRecherche") return;
  const q = e.target.value.trim();
  const box = $("#searchResults");
  if (!box) return;
  if (!q) { box.innerHTML = ""; return; }
  clearTimeout(TIMER_RECHERCHE);
  TIMER_RECHERCHE = setTimeout(() => lancerRecherche(q), 180);
});
document.addEventListener("click", e => {
  const link = e.target.closest("[data-link]");
  if (link) go(link.getAttribute("data-link"));
});
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
function onInputNumeroPaiement(input) {
  if (!input) return;
  const propre = nettoyerNumeroPaiement(input.value);
  if (input.value !== propre) input.value = propre;
  const numero = propre;
  const validation = validerNumeroPaiement(numero);
  const msg = document.getElementById("msgNumero");
  const compteur = document.getElementById("compteurNumero");
  const wrap = document.getElementById("wrapNumero");
  const btn = document.getElementById("btnPayerFasc");
  const boxOp = document.getElementById("operateurDetecte");
  const iconeOp = document.getElementById("operateurIcone");
  const texteOp = document.getElementById("operateurTexte");
  if (compteur) compteur.textContent = numero.length + "/9";
  if (msg) {
    if (!numero) { msg.textContent = "9 chiffres, commence par 06, 05 ou 04"; msg.className = "msg-numero"; }
    else if (validation.ok) { msg.textContent = "Numéro valide ✓"; msg.className = "msg-numero ok"; }
    else { msg.textContent = validation.erreur; msg.className = "msg-numero erreur"; }
  }
  if (wrap) {
    wrap.classList.remove("valide", "erreur");
    if (numero.length === 9 && validation.ok) wrap.classList.add("valide");
    if (numero.length >= 2 && !detecterOperateur(numero)) wrap.classList.add("erreur");
  }
  if (boxOp && iconeOp && texteOp) {
    boxOp.className = "operateur-detecte";
    if (validation.operateur === "MTN MoMo") {
      iconeOp.textContent = "🟡"; texteOp.textContent = "MTN MoMo détecté";
      boxOp.classList.add("mtn");
    } else if (validation.operateur === "Airtel Money") {
      iconeOp.textContent = "🔴"; texteOp.textContent = "Airtel Money détecté";
      boxOp.classList.add("airtel");
    } else if (numero.length >= 2) {
      iconeOp.textContent = "⚠️"; texteOp.textContent = "Préfixe inconnu — 06, 05 ou 04 uniquement";
      boxOp.classList.add("inconnu");
    } else {
      iconeOp.textContent = "📱"; texteOp.textContent = "Tape ton numéro, l'opérateur sera détecté";
    }
  }
  if (btn) btn.disabled = !validation.ok;
}
function ouvrirPaiementFascicule(id, prix, titre) {
  if (!prix || Number(prix) === 0) { ouvrirModule(id); return; }
  FASCICULE_EN_COURS = { id, prix, titre };
  const modal = document.getElementById("modalPaiement");
  if (!modal) { alert("Ajoute le modal de paiement dans la page"); return; }
  document.getElementById("paiementTitre").textContent = titre || "Fascicule";
  document.getElementById("paiementPrix").textContent = prix + " FCFA";
  const input = document.getElementById("inputNumeroPaiement");
  if (input) input.value = "";
  onInputNumeroPaiement(input);
  modal.classList.add("ouvert");
  setTimeout(() => { if (input) input.focus(); }, 100);
}
function fermerPaiement() { document.getElementById("modalPaiement")?.classList.remove("ouvert"); }
async function payerFascicule() {
  const input = document.getElementById("inputNumeroPaiement");
  const numero = nettoyerNumeroPaiement(input ? input.value : "");
  if (input) input.value = numero;
  const validation = validerNumeroPaiement(numero);
  if (!validation.ok) { toast(validation.erreur); onInputNumeroPaiement(input); return; }
  const operateur = validation.operateur;
  const u = await getUser();
  if (!u) { go("connexion.html?next=" + encodeURIComponent("acceuil.html")); return; }
  const btn = document.getElementById("btnPayerFasc");
  if (btn) { btn.disabled = true; btn.textContent = "Envoi en cours..."; }
  toast("Envoi de la demande " + operateur + " à +242 " + numero + "...");
  const { error } = await supabaseClient.from("mes_cours").insert({ user_id: u.id, module_id: FASCICULE_EN_COURS.id, numero_paiement: "+242" + numero, operateur: operateur, statut: "en_attente" });
  if (error) {
    toast("Valide le paiement sur ton téléphone, puis réessaie");
    if (btn) { btn.disabled = false; btn.textContent = "Payer maintenant →"; }
    return;
  }
  toast("Vérifie ton téléphone et valide le paiement !");
  setTimeout(() => { fermerPaiement(); ouvrirModule(FASCICULE_EN_COURS.id); }, 1500);
}
let SLIDE_ACTUEL = 0;
let SLIDER_TIMER = null;
function allerSlide(n) {
  SLIDE_ACTUEL = n;
  const track = document.getElementById("heroTrack");
  if (!track) return;
  track.style.transform = `translateX(-${n * 50}%)`;
  document.querySelectorAll(".dot-hero").forEach((d, i) => d.classList.toggle("actif", i === n));
}
function demarrerSliderHero() {
  if (SLIDER_TIMER) clearInterval(SLIDER_TIMER);
  SLIDER_TIMER = setInterval(() => { allerSlide(SLIDE_ACTUEL === 0 ? 1 : 0); }, 4000);
}