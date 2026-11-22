// ============================================================
// PAGE PROFIL - profile.html
// Premium -> Voir mon abonnement
// Gratuit -> S'abonner
// Déconnexion AVEC confirmation | Supprimer compte VRAIMENT via RPC | Modifier nom
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) {
      window.location.href = "connexion.html";
      return;
    }
    supabaseClient.auth.onAuthStateChange((_event, newSession) => {
      if (!newSession?.user) window.location.href = "connexion.html";
    });
    const u = session.user;
    let { data: p } = await supabaseClient.from("profiles").select("*").eq("id", u.id).single();
    if (!p) {
      const { data: created } = await supabaseClient.from("profiles").insert({
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || u.email,
        role: "etudiant",
        premium: false
      }).select().single();
      p = created;
    }
    if (!p) {
      document.getElementById("userName").textContent = "Profil introuvable";
      return;
    }
    window.PROFIL_ACTUEL = p;
    document.getElementById("userName").textContent = p.full_name || p.email || "Etudiant";
    document.getElementById("avatarLettre").textContent = (p.full_name || "U")[0].toUpperCase();
    document.getElementById("membreDepuis").textContent = "Membre depuis " + new Date(p.created_at).toLocaleDateString("fr-FR");
    const badge = document.getElementById("badgeStatut");
    const box = document.getElementById("premiumBox");
    if (p.premium) {
      badge.textContent = "COMPTE PREMIUM 👑";
      badge.className = "badge-premium";
      if (box) {
        box.classList.add("premium-actif");
        document.getElementById("premiumBoxTitre").textContent = "Premium actif";
        document.getElementById("premiumBoxSousTitre").textContent = "Profite de tous les cours";
        document.getElementById("premiumBoxBtn").textContent = "Voir mon abonnement";
      }
    } else {
      badge.textContent = "COMPTE GRATUIT";
      badge.className = "badge-gratuit";
      if (box) {
        box.classList.remove("premium-actif");
        document.getElementById("premiumBoxTitre").textContent = "Passe en Premium";
        document.getElementById("premiumBoxSousTitre").textContent = "Debloque tous les cours";
        document.getElementById("premiumBoxBtn").textContent = "S'abonner";
      }
    }
  } catch (e) {
    console.log("Erreur profil:", e);
    document.getElementById("userName").textContent = "Erreur de chargement";
  }
});

function allerAbonnement() {
  const p = window.PROFIL_ACTUEL;
  if (p && p.premium) {
    window.location.href = "notifications.html";
  } else {
    window.location.href = "abonnementpremium.html";
  }
}

// ---------- DÉCONNEXION : AVEC CONFIRMATION ----------
function ouvrirDeconnexion() {
  document.getElementById("popupDeconnexion").style.display = "flex";
}
function fermerDeconnexion() {
  document.getElementById("popupDeconnexion").style.display = "none";
}
async function confirmerDeconnexion() {
  await supabaseClient.auth.signOut();
  window.location.href = "connexion.html";
}
// Garde deconnecter() pour compatibilité si un autre fichier l'appelle
async function deconnecter() {
  ouvrirDeconnexion();
}

// ---------- MODIFIER NOM ----------
function ouvrirModifierNom() {
  const p = window.PROFIL_ACTUEL;
  document.getElementById("editNomBox").style.display = "block";
  document.getElementById("inputNouveauNom").value = p?.full_name || "";
  document.getElementById("msgNom").textContent = "";
  document.getElementById("inputNouveauNom").focus();
}
function fermerModifierNom() {
  document.getElementById("editNomBox").style.display = "none";
}
async function enregistrerNom() {
  const nouveauNom = document.getElementById("inputNouveauNom").value.trim();
  const msg = document.getElementById("msgNom");
  if (nouveauNom.length < 2) {
    msg.textContent = "Écris un nom d'au moins 2 lettres.";
    msg.style.color = "#ff3b30";
    return;
  }
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session?.user) return;
  const { error } = await supabaseClient.from("profiles").update({ full_name: nouveauNom }).eq("id", session.user.id);
  if (error) {
    msg.textContent = "Erreur : " + error.message;
    msg.style.color = "#ff3b30";
    return;
  }
  await supabaseClient.auth.updateUser({ data: { full_name: nouveauNom } });
  window.PROFIL_ACTUEL.full_name = nouveauNom;
  document.getElementById("userName").textContent = nouveauNom;
  document.getElementById("avatarLettre").textContent = nouveauNom[0].toUpperCase();
  msg.textContent = "Nom modifié ✅";
  msg.style.color = "#2A9D00";
  setTimeout(() => fermerModifierNom(), 800);
}

// ---------- SUPPRIMER COMPTE ----------
function ouvrirSupprimerCompte() {
  document.getElementById("popupSupprimer").style.display = "flex";
  document.getElementById("inputConfirmSupprimer").value = "";
  document.getElementById("msgSupprimer").textContent = "";
}
function fermerSupprimerCompte() {
  document.getElementById("popupSupprimer").style.display = "none";
}
async function supprimerCompte() {
  const confirmation = document.getElementById("inputConfirmSupprimer").value.trim();
  const msg = document.getElementById("msgSupprimer");
  if (confirmation !== "SUPPRIMER") {
    msg.textContent = "Écris exactement SUPPRIMER en majuscules pour confirmer.";
    msg.style.color = "#ff3b30";
    return;
  }
  msg.textContent = "Suppression en cours...";
  msg.style.color = "#888";
  const { error } = await supabaseClient.rpc("delete_my_account");
  if (error) {
    msg.textContent = "Erreur : " + error.message;
    msg.style.color = "#ff3b30";
    console.log("Erreur suppression:", error);
    return;
  }
  await supabaseClient.auth.signOut();
  alert("Ton compte a été supprimé. On espère te revoir bientôt sur Unisphere.");
  window.location.href = "connexion.html";
}