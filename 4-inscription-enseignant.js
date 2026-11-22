// ===== SECURITE SANS RE-DECLARER =====
if (typeof CODE_DEMO === "undefined") window.CODE_DEMO = "123456";
if (typeof PRIX === "undefined") window.PRIX = { prof_an: 15000 };
if (typeof PROGRAMMES_DEFAUT === "undefined") window.PROGRAMMES_DEFAUT = ["Medecine", "Pharmacie", "Infirmier"];

let CODE_PROF = "";
let OPERATEUR_CHOISI = "MoMo";

// ===== STYLE ERREUR + SHAKE INJECTE EN JS =====
(function injecterStyleErreur(){
  if (document.getElementById("style-erreur-js")) return;
  const s = document.createElement("style");
  s.id = "style-erreur-js";
  s.textContent = `
    @keyframes shakeX { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-7px)} 40%,80%{transform:translateX(7px)} }
    .champ-erreur{ border:2px solid #FF3B30 !important; background:#FFF0F0 !important; box-shadow:0 0 0 3px rgba(255,59,48,.15) !important; animation:shakeX .4s ease; }
    .champ-erreur::placeholder{ color:#FF3B30 !important; }
    .msg-erreur-style{ background:#FF3B30; color:#fff; font-weight:700; font-size:13px; padding:10px 12px; border-radius:12px; margin:10px 0; display:flex; align-items:center; gap:8px; text-align:left; animation:shakeX .4s ease; box-shadow:0 4px 14px rgba(255,59,48,.35); }
    .msg-erreur-style:empty{ display:none; padding:0; box-shadow:none; background:transparent; }
    .msg-succes-style{ background:#1DB954; color:#fff; font-weight:700; font-size:13px; padding:10px 12px; border-radius:12px; margin:10px 0; text-align:center; }
    .code-erreur{ border:2px solid #FF3B30 !important; background:#FFF0F0 !important; animation:shakeX .4s ease; }
  `;
  document.head.appendChild(s);
})();

function marquerErreur(el){
  if(!el) return;
  el.classList.remove("champ-erreur");
  void el.offsetWidth;
  el.classList.add("champ-erreur");
  el.focus();
  setTimeout(()=> el.classList.remove("champ-erreur"), 600);
}
function afficherErreur(idMsg, texte){
  const el = document.getElementById(idMsg);
  if(!el) return;
  el.className = "msg-erreur-style";
  el.textContent = "! " + texte;
}
function effacerErreur(idMsg){
  const el = document.getElementById(idMsg);
  if(!el) return;
  el.textContent = "";
  el.className = "";
}
function afficherSucces(idMsg, texte){
  const el = document.getElementById(idMsg);
  if(!el) return;
  el.className = "msg-succes-style";
  el.textContent = "OK - " + texte;
}
function securiserChamp(id, idMsg, test, message){
  const el = document.getElementById(id);
  if(!el) return true;
  const valeur = el.value.trim();
  const ok = test ? test(valeur) : valeur !== "";
  if(!ok){ marquerErreur(el); afficherErreur(idMsg, message); return false; }
  el.classList.remove("champ-erreur");
  return true;
}
function estEmailValide(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function sansEspace(v){ return v !== "" && !/\s/.test(v); }

// ===== AUCUN ESPACE SAUF ETABLISSEMENT =====
function interdireEspaces(){
  const idsSansEspace = ["nom","prenom","email","password","numero_paiement","c1","c2","c3","c4","c5","c6"];
  idsSansEspace.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener("input", () => {
      if(/\s/.test(el.value)){ el.value = el.value.replace(/\s+/g, ""); marquerErreur(el); }
    });
    el.addEventListener("keydown", (e) => {
      if(e.key === " "){ e.preventDefault(); marquerErreur(el); }
    });
    el.addEventListener("paste", () => { setTimeout(()=>{ el.value = el.value.replace(/\s+/g, ""); }, 0); });
  });
}

// ===== SUPPRIMER ORANGE (au cas ou il reste dans le HTML) =====
function supprimerOrange(){
  document.getElementById("card-Orange")?.remove();
  const sel = document.getElementById("methode_paiement");
  if(sel){
    [...sel.options].forEach(opt => { if(opt.value === "Orange Money" || opt.text.includes("Orange")) opt.remove(); });
    if(sel.value === "Orange Money") sel.value = "MoMo";
  }
  if(OPERATEUR_CHOISI === "Orange Money") OPERATEUR_CHOISI = "MoMo";
}

async function chargerProgrammesSelect() {
  const sel = document.getElementById("programme_id");
  if (!sel) return;
  try {
    const { data } = await supabaseClient.from("programmes").select("*").eq("actif", true).order("nom");
    const list = data?.length ? data : PROGRAMMES_DEFAUT.map(n => ({ nom: n }));
    sel.innerHTML = `<option value="">-- Choisis ton programme --</option>` + list.map(p => `<option value="${p.nom}">${p.nom}</option>`).join("");
  } catch(e) {
    sel.innerHTML = `<option value="">-- Choisis ton programme --</option>` + PROGRAMMES_DEFAUT.map(n => `<option value="${n}">${n}</option>`).join("");
  }
}

document.addEventListener("DOMContentLoaded", () => { chargerProgrammesSelect(); initCodeInputs(); interdireEspaces(); supprimerOrange(); });

function choisirOperateur(nom) {
  if(nom === "Orange Money") nom = "MoMo";
  OPERATEUR_CHOISI = nom;
  const select = document.getElementById("methode_paiement");
  if (select) select.value = nom;
  document.querySelectorAll(".op-card").forEach(c => c.classList.remove("active"));
  const id = nom === "MoMo" ? "card-MoMo" : "card-Airtel";
  document.getElementById(id)?.classList.add("active");
}

function detecterOperateur() {
  const input = document.getElementById("numero_paiement");
  const msg = document.getElementById("msg2");
  if (!input) return;
  input.value = input.value.replace(/[^0-9]/g, "").slice(0, 9);
  const num = input.value;
  if (msg) { msg.textContent = ""; msg.className = ""; }
  document.querySelectorAll(".op-card").forEach(c => c.classList.remove("disabled"));
  if (num.length < 2) return;
  const prefixe = num.slice(0, 2);
  if (prefixe === "06") { choisirOperateur("MoMo"); document.getElementById("card-Airtel")?.classList.add("disabled"); }
  else if (prefixe === "05" || prefixe === "04") { choisirOperateur("Airtel Money"); document.getElementById("card-MoMo")?.classList.add("disabled"); }
  else { afficherErreur("msg2", "Le numero doit commencer par 06, 05 ou 04"); marquerErreur(input); }
}

function validerNumeroCongo(num) { return /^(06|05|04)[0-9]{7}$/.test(num); }

function initCodeInputs() {
  const inputs = ["c1","c2","c3","c4","c5","c6"].map(id => document.getElementById(id));
  inputs.forEach((input, i) => {
    if (!input) return;
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^0-9]/g, "").slice(0, 1);
      if (input.value && i < 5) inputs[i + 1].focus();
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !input.value && i > 0) inputs[i - 1].focus(); });
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const texte = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g, "");
      texte.split("").forEach((chiffre, j) => { if (inputs[i + j]) inputs[i + j].value = chiffre; });
      const dernier = Math.min(i + texte.length, 5);
      if (inputs[dernier]) inputs[dernier].focus();
    });
  });
}

function allerEtape2() {
  effacerErreur("msg1");
  let ok = true;
  if(!securiserChamp("nom", "msg1", v => v.length >= 2 && sansEspace(v), "Nom : sans espace, 2 lettres minimum. Ex : Mbemba")) ok = false;
  else if(!securiserChamp("prenom", "msg1", v => v.length >= 2 && sansEspace(v), "Prenom : sans espace. Ex : Jean")) ok = false;
  else if(!securiserChamp("email", "msg1", v => estEmailValide(v) && sansEspace(v), "Email invalide ou avec espace. Ex : jean@gmail.com")) ok = false;
  else if(!securiserChamp("password", "msg1", v => v.length >= 6 && sansEspace(v), "Mot de passe : 6 caracteres minimum, sans espace.")) ok = false;
  else if(!securiserChamp("programme_id", "msg1", v => v !== "", "Choisis ton programme.")) ok = false;
  if(!ok) return;
  afficherSucces("msg1", "Parfait, on passe au paiement !");
  setTimeout(()=>{
    document.getElementById("etape1").classList.add("hidden");
    document.getElementById("etape2").classList.remove("hidden");
    document.getElementById("bar2")?.classList.add("active");
  }, 300);
}

async function payerFrais() {
  effacerErreur("msg2");
  const numeroEl = document.getElementById("numero_paiement");
  const numero = numeroEl.value.trim();
  if(!numero){ marquerErreur(numeroEl); afficherErreur("msg2", "Mets ton numero MoMo / Airtel, ex : 061234567"); return; }
  if(!validerNumeroCongo(numero)){ marquerErreur(numeroEl); afficherErreur("msg2", "Numero invalide. 9 chiffres, commence par 06 (MoMo) ou 05 / 04 (Airtel)."); return; }
  CODE_PROF = CODE_DEMO;
  document.getElementById("etape2").classList.add("hidden");
  document.getElementById("etape3").classList.remove("hidden");
  document.getElementById("bar3")?.classList.add("active");
  document.getElementById("emailAffiche").textContent = document.getElementById("email").value;
  setTimeout(() => document.getElementById("c1")?.focus(), 100);
}

function retourEtape1() { document.getElementById("etape2").classList.add("hidden"); document.getElementById("etape1").classList.remove("hidden"); }
function renvoyerCode() { afficherSucces("msg3", "Code renvoye. En demo : 123456"); }

async function verifierCode() {
  effacerErreur("msg3");
  const ids = ["c1","c2","c3","c4","c5","c6"];
  const code = ids.map(id => document.getElementById(id)?.value || "").join("");
  let manque = false;
  ids.forEach(id => {
    const el = document.getElementById(id);
    if(!el || !el.value){ el?.classList.add("code-erreur"); setTimeout(()=> el?.classList.remove("code-erreur"), 600); manque = true; }
  });
  if(manque){ afficherErreur("msg3", "Remplis les 6 chiffres du code."); document.getElementById("c1")?.focus(); return; }
  if (code !== CODE_PROF) {
    ids.forEach(id => { const el = document.getElementById(id); el?.classList.add("code-erreur"); setTimeout(()=> el?.classList.remove("code-erreur"), 600); });
    afficherErreur("msg3", "Mauvais code. En demo : 123456");
    return;
  }
  const nom = document.getElementById("nom").value.trim();
  const prenom = document.getElementById("prenom").value.trim();
  const email = document.getElementById("email").value.trim();
  const mdp = document.getElementById("password").value;
  const prog = document.getElementById("programme_id").value;
  const numero = document.getElementById("numero_paiement").value.trim();
  const methode = document.getElementById("methode_paiement")?.value || OPERATEUR_CHOISI;
  afficherSucces("msg3", "Code correct, creation du compte...");
  const { data, error } = await supabaseClient.auth.signUp({ email, password: mdp });
  if (error) { afficherErreur("msg3", error.message); return; }
  if (data.user) {
    await supabaseClient.from("profiles").insert({ id: data.user.id, nom, prenom, full_name: prenom + " " + nom, email, role: "enseignant", programme: prog, statut_enseignant: "valide" });
    await supabaseClient.from("abonnements").insert({ user_id: data.user.id, type: "abonnement_prof", plan: "annuel", prix: PRIX.prof_an, numero_paiement: numero, methode: methode, statut: "actif" });
    const msgFinal = document.getElementById("msg");
    msgFinal.className = "msg-succes-style";
    msgFinal.textContent = "Compte cree et active. Bienvenue !";
    setTimeout(() => window.location.href = "administration.html", 1500);
  }
}