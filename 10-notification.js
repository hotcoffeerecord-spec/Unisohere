// ============================================================
// PAGE NOTIFICATIONS - notification.html
// Plan + Fin = lus dans profiles (premium_plan / premium_expire_at)
// Début = date du dernier abonnement, sinon date de création du profil
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  await ProtegerPage("etudiant");
  const p = window.PROFIL_ACTUEL;
  const u = await getUser();
  if (!u) return;
  
  // ---------- 1. ON RÉCUPÈRE LES ABONNEMENTS POUR LE DÉBUT + LES TRANSACTIONS ----------
  const { data: abos } = await supabaseClient
    .from("abonnements")
    .select("*")
    .eq("user_id", u.id)
    .order("created_at", { ascending: false });
  
  const dernierAbo = (abos || [])[0] || null;
  
  // ---------- 2. PLAN / DÉBUT / FIN / JOURS / BARRE ----------
  // Plan : depuis profiles (maintenant que la colonne existe)
  let planBrut = p.premium_plan || dernierAbo?.plan || "-";
  // On met une majuscule : trimestriel -> Trimestriel
  let planAffiche = planBrut === "-" ? "-" : planBrut.charAt(0).toUpperCase() + planBrut.slice(1);
  
  // Fin : on prend premium_expire_at, sinon premium_expire_le, sinon on calcule
  let finDate = null;
  if (p.premium_expire_at) finDate = new Date(p.premium_expire_at);
  else if (p.premium_expire_le) finDate = new Date(p.premium_expire_le);
  
  // Si toujours pas de fin mais qu'on a un abo, on calcule Fin = Début + durée
  let debutDate = dernierAbo ? new Date(dernierAbo.created_at) : (p.created_at ? new Date(p.created_at) : null);
  if (!finDate && debutDate && planBrut !== "-") {
    let duree = 90;
    if (planBrut === "mensuel") duree = 30;
    else if (planBrut === "trimestriel") duree = 90;
    else if (planBrut === "annuel") duree = 365;
    finDate = new Date(debutDate);
    finDate.setDate(finDate.getDate() + duree);
  }
  
  let debutAffiche = debutDate ? debutDate.toLocaleDateString("fr-FR") : "-";
  let finAffiche = finDate ? finDate.toLocaleDateString("fr-FR") : "-";
  
  let joursRestants = 0;
  let pourcentage = 0;
  if (finDate) {
    const aujourdhui = new Date();
    joursRestants = Math.max(0, Math.ceil((finDate - aujourdhui) / (1000 * 60 * 60 * 24)));
    let dureeTotale = 90;
    if (planBrut === "mensuel") dureeTotale = 30;
    else if (planBrut === "trimestriel") dureeTotale = 90;
    else if (planBrut === "annuel") dureeTotale = 365;
    pourcentage = Math.max(0, Math.min(100, Math.round((joursRestants / dureeTotale) * 100)));
  }
  
  // ---------- 3. CARTE PREMIUM ----------
  if (p.premium) {
    document.getElementById("titrePremium").textContent = "Premium actif";
    document.getElementById("sousTitrePremium").textContent = "Profite de tous les cours";
    document.getElementById("planPremium").textContent = planAffiche;
    document.getElementById("finPremium").textContent = finAffiche;
    document.getElementById("debutPremium").textContent = debutAffiche;
    document.getElementById("joursRestants").innerHTML = joursRestants + "<span> jours</span>";
    document.getElementById("barrePremium").style.width = pourcentage + "%";
    document.getElementById("premiumCard").classList.add("actif");
    const btn = document.getElementById("btnPremium");
    btn.textContent = "Premium actif 👑";
    btn.classList.remove("btn-rouge");
    btn.classList.add("btn-vert");
    btn.onclick = () => go('profile.html');
  } else {
    // Pas Premium : on affiche quand même ce qu'on a
    document.getElementById("planPremium").textContent = planAffiche;
    document.getElementById("debutPremium").textContent = debutAffiche;
    document.getElementById("finPremium").textContent = finAffiche;
    document.getElementById("joursRestants").innerHTML = "0<span> jours</span>";
    document.getElementById("barrePremium").style.width = "0%";
  }
  
  // ---------- 4. TOTAL COURS = FAVORIS ----------
  const { data: favs } = await supabaseClient.from("favoris").select("id").eq("user_id", u.id);
  document.getElementById("totalCours").textContent = favs?.length || 0;
  
  // ---------- 5. NOTIFICATIONS ----------
  const { data: notifs } = await supabaseClient.from("notifications").select("*").eq("user_id", u.id).order("created_at", { ascending: false });
  const nonLues = (notifs || []).filter(n => !n.lu).length;
  document.getElementById("badgeNb").textContent = nonLues;
  document.getElementById("listeNotifs").innerHTML = (notifs || []).length ?
    (notifs || []).map(n => `<div class="notif ${n.lu ? "" : "non-lue"}"><div class="notif-icon vert">U</div><div class="notif-content"><b>${n.titre || "Notification"}</b><p>${n.message || ""}</p></div><span class="notif-time">${new Date(n.created_at).toLocaleDateString("fr-FR")}</span>${n.lu ? "" : "<span class='dot'></span>"}</div>`).join("") :
    `<div class="empty">Aucune notification.</div>`;
  
  // ---------- 6. TRANSACTIONS = ABONNEMENTS + ACHATS FASCICULES ----------
  const { data: achats } = await supabaseClient.from("achats_fascicules").select("*, modules:module_id(titre)").eq("user_id", u.id).order("created_at", { ascending: false });
  let transacs = [];
  (abos || []).forEach(a => transacs.push({ titre: "Abonnement " + (a.plan || ""), desc: a.type + " • " + a.prix + " FCFA", statut: a.statut, date: a.created_at }));
  (achats || []).forEach(a => transacs.push({ titre: a.modules?.titre || "Fascicule", desc: "Achat fascicule • " + a.prix_payé + " FCFA", statut: a.statut, date: a.created_at }));
  transacs.sort((a, b) => new Date(b.date) - new Date(a.date));
  document.getElementById("listeTransacs").innerHTML = transacs.length ?
    transacs.map(t => `<div class="transac"><div class="transac-icon">F</div><div class="transac-info"><b>${t.titre}</b><p>${t.desc} • ${new Date(t.date).toLocaleDateString("fr-FR")}</p></div><span class="transac-statut">${t.statut}</span></div>`).join("") :
    `<div class="empty">Aucune transaction.</div>`;
});

// ---------- 7. TOUT MARQUER COMME LU ----------
async function toutLire() {
  const u = await getUser();
  await supabaseClient.from("notifications").update({ lu: true }).eq("user_id", u.id).eq("lu", false);
  location.reload();
}