// ============================================================
// PAGE ABONNEMENT PREMIUM - abonnementpremium.html
// Vert = Gratuit | Rouge = Premium
// 06 = MTN MoMo | 05 / 04 = Airtel Money
// Après paiement -> notification.html
// ============================================================

// ---------- 1. VARIABLES GLOBALES - PLAN PAR DÉFAUT ----------
let PLAN_CHOISI = "trimestriel";
let PRIX_CHOISI = 2500;
let METHODE_CHOISIE = "MTN MoMo";

// ---------- 2. CHOISIR UN PLAN - Mensuel / Trimestriel / Annuel ----------
function choisirPlan(plan, prix, el) {
  PLAN_CHOISI = plan;
  PRIX_CHOISI = prix;
  // On enlève la sélection sur tous les plans
  document.querySelectorAll(".plan").forEach(p => p.classList.remove("selected"));
  // On sélectionne le plan cliqué
  if (el) el.classList.add("selected");
  // On met à jour le texte du bouton Payer
  document.getElementById("btnPayerPremium").textContent = "Payer " + prix.toLocaleString("fr-FR") + " FCFA";
}

// ---------- 3. CHOISIR UNE MÉTHODE - MTN / Airtel ----------
function choisirMethode(methode, el) {
  // Si la méthode est verrouillée par le numéro, on bloque le clic
  if (el && el.classList.contains("locked")) return;
  METHODE_CHOISIE = methode;
  document.querySelectorAll(".pay-method").forEach(p => p.classList.remove("selected"));
  if (el) el.classList.add("selected");
}

// ---------- 4. VERROUILLE LA MÉTHODE SELON LE DÉBUT DU NUMÉRO ----------
// 06 -> MTN MoMo obligatoire, Airtel grisé
// 05 / 04 -> Airtel Money obligatoire, MTN grisé
function appliquerMethodeParNumero(numero) {
  const methods = document.querySelectorAll(".pay-method");
  
  // On déverrouille tout d'abord
  methods.forEach(m => {
    m.classList.remove("locked");
    m.style.opacity = "1";
    m.style.pointerEvents = "auto";
  });
  
  // Pas encore assez de chiffres pour savoir -> on laisse choisir
  if (numero.length < 2) return;
  
  const prefix = numero.substring(0, 2);
  
  if (prefix === "06") {
    METHODE_CHOISIE = "MTN MoMo";
    methods.forEach(m => {
      const isMTN = m.textContent.toLowerCase().includes("mtn");
      m.classList.toggle("selected", isMTN);
      if (!isMTN) {
        m.classList.add("locked");
        m.style.opacity = "0.35";
        m.style.pointerEvents = "none";
      }
    });
  } else if (prefix === "05" || prefix === "04") {
    METHODE_CHOISIE = "Airtel Money";
    methods.forEach(m => {
      const isAirtel = m.textContent.toLowerCase().includes("airtel");
      m.classList.toggle("selected", isAirtel);
      if (!isAirtel) {
        m.classList.add("locked");
        m.style.opacity = "0.35";
        m.style.pointerEvents = "none";
      }
    });
  }
}

// ---------- 5. PAYER PREMIUM - C'EST ICI QUE LE COMPTE DEVIENT VRAIMENT PREMIUM ----------
async function payerPremium() {
  const inputNumero = document.getElementById("numeroPaiement");
  const numero = inputNumero.value.trim();
  const info = document.getElementById("infoNumero");
  const btn = document.getElementById("btnPayerPremium");
  
  // --- 5A. Validation numéro : 9 chiffres, commence par 06 / 05 / 04 uniquement ---
  if (!/^(06|05|04)\d{7}$/.test(numero)) {
    info.textContent = "Numéro invalide : 9 chiffres, commence par 06, 05 ou 04.";
    info.style.color = "#ff3b30";
    return;
  }
  
  // --- 5B. Vérifie que la méthode correspond au numéro ---
  if (numero.startsWith("06") && METHODE_CHOISIE !== "MTN MoMo") {
    info.textContent = "06 = MTN MoMo obligatoire.";
    info.style.color = "#ff3b30";
    return;
  }
  if ((numero.startsWith("05") || numero.startsWith("04")) && METHODE_CHOISIE !== "Airtel Money") {
    info.textContent = "05 / 04 = Airtel Money obligatoire.";
    info.style.color = "#ff3b30";
    return;
  }
  
  // --- 5C. Vérifie que l'utilisateur est connecté ---
  const u = await getUser();
  if (!u) { go("connexion.html"); return; }
  
  // --- 5D. On bloque le bouton pendant le traitement ---
  btn.disabled = true;
  btn.textContent = "Traitement...";
  info.textContent = "Envoi en cours...";
  info.style.color = "#888";
  
  // --- 5E. Étape 1 : On crée l'abonnement dans la table abonnements ---
  const { error: errAbo } = await supabaseClient.from("abonnements").insert({
    user_id: u.id,
    type: "premium_etudiant",
    plan: PLAN_CHOISI,
    prix: PRIX_CHOISI,
    numero_paiement: numero,
    methode: METHODE_CHOISIE,
    statut: "valide"
  });
  
  if (errAbo) {
    toast(errAbo.message);
    btn.disabled = false;
    btn.textContent = "Payer " + PRIX_CHOISI.toLocaleString("fr-FR") + " FCFA";
    return;
  }
  
  // --- 5F. Étape 2 : On passe le profil en VRAIMENT Premium ---
  // On ne met à jour QUE la colonne "premium" qui existe vraiment dans Supabase
  // Ne pas rajouter premium_plan / premium_expire_at ici, sinon ça plante
  const { error: errProfil } = await supabaseClient.from("profiles").update({
    premium: true
  }).eq("id", u.id);
  
  if (errProfil) {
    toast("Abonnement créé mais profil non mis à jour : " + errProfil.message);
    btn.disabled = false;
    btn.textContent = "Payer " + PRIX_CHOISI.toLocaleString("fr-FR") + " FCFA";
    return;
  }
  
  // --- 5G. Étape 3 : Succès -> on va vers les NOTIFICATIONS ---
  document.getElementById("successBox").style.display = "block";
  info.textContent = "Premium activé 👑";
  info.style.color = "#2A9D00";
  toast("Bienvenue en Premium 👑");
  setTimeout(() => go("notifications.html"), 2000);
}

// ---------- 6. AU CHARGEMENT DE LA PAGE ----------
document.addEventListener("DOMContentLoaded", async () => {
  await ProtegerPage("etudiant");
  
  // --- 6A. Champ numéro : max 9 chiffres, chiffres uniquement ---
  const inputNumero = document.getElementById("numeroPaiement");
  if (inputNumero) {
    inputNumero.setAttribute("maxlength", "9");
    inputNumero.setAttribute("inputmode", "numeric");
    
    inputNumero.addEventListener("input", () => {
      // On enlève tout ce qui n'est pas un chiffre, et on coupe à 9
      inputNumero.value = inputNumero.value.replace(/\D/g, "").slice(0, 9);
      appliquerMethodeParNumero(inputNumero.value);
      
      // Message d'aide en direct sous le champ
      const info = document.getElementById("infoNumero");
      const v = inputNumero.value;
      if (v.length > 0 && v.length < 2) {
        info.textContent = "Commence par 06, 05 ou 04.";
        info.style.color = "#888";
      } else if (v.length >= 2 && !["06", "05", "04"].includes(v.substring(0, 2))) {
        info.textContent = "Seuls 06, 05 et 04 sont acceptés.";
        info.style.color = "#ff3b30";
      } else if (v.startsWith("06")) {
        info.textContent = "06 détecté → MTN MoMo";
        info.style.color = "#2A9D00";
      } else if (v.startsWith("05") || v.startsWith("04")) {
        info.textContent = v.substring(0, 2) + " détecté → Airtel Money";
        info.style.color = "#2A9D00";
      } else {
        info.textContent = "";
      }
    });
  }
});