function changerTab(tab, btn) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("actif"));
  if (btn) btn.classList.add("actif");
  document.querySelectorAll(".section").forEach(s => s.classList.remove("actif"));
  const map = { "cours": "tab-cours", "fiches": "tab-fiches", "fascicules": "tab-fascicules" };
  document.getElementById(map[tab])?.classList.add("actif");
}

function estGratuitEspace(m) { return !m.prix || Number(m.prix) === 0; }

// ===== NOUVEAU SYSTEME LECTEUR =====
// Plus de window.open, on va sur lecteur.html
// C'est lecteur.html qui vérifie Premium / Fascicule / Lectures et qui affiche le PDF
function ouvrirModule(id) {
  window.location.href = "lecteur.html?id=" + id;
}

function carteModuleRetirer(m) {
  const isFasc = m.type === "fascicule";
  const isFiche = m.type === "fiche";
  const isPremium = !!m.is_premium;
  const gratuit = estGratuitEspace(m);
  const estDejaDebloque = isPremium && USER_IS_PREMIUM;

  const badge = isPremium ?
    (estDejaDebloque ? `<span class="pill pill-premium" style="background:#00c853">Premium ✓</span>` : `<span class="pill pill-premium">Premium</span>`) :
    `<span class="pill pill-dispo">Gratuit</span>`;

  const prix = isFasc ?
    (gratuit ? `<span class="pill" style="background:#7CFC00;color:#000">Gratuit</span>` : `<span class="pill" style="background:#7b5cff;color:#fff">${m.prix || 0} FCFA</span>`) :
    "";

  const auteur = m.profiles?.full_name ?
    `<p style="color:#666;font-weight:600;margin:4px 0">Par ${m.profiles.full_name}</p>` :
    "";

  const programme = m.programme ?
    `<span class="pill" style="background:#222;color:#fff">${m.programme}</span>` :
    "";

  const matiere = m.matiere ?
    `<span class="pill" style="background:#222;color:#fff">${m.matiere}</span>` :
    "";

  let typeLabel = "Cours";
  let typeStyle = "background:#333;color:#fff";
  if (isFasc) { typeLabel = "Fascicule"; typeStyle = "background:#7b5cff;color:#fff"; }
  if (isFiche) { typeLabel = "Fiche de révision"; typeStyle = "background:#00c9a7;color:#fff"; }
  const typeBadge = `<span class="pill" style="${typeStyle}">${typeLabel}</span>`;

  const lectures = `<span class="pill" style="background:#000;color:#fff">${m.nbLectures || 0} lectures</span>`;
  const desc = tronquer50(m.description);

  let texteBouton = "Voir";
  let actionBouton = `ouvrirModule('${m.id}')`;
  let classeBouton = "btn-voir";
  if (isFiche) texteBouton = "Réviser";

  if (isFasc) {
    if (gratuit) {
      texteBouton = "Ouvrir";
      actionBouton = `ouvrirModule('${m.id}')`;
    } else {
      texteBouton = "Acheter";
      actionBouton = `ouvrirPaiementFascicule('${m.id}', ${m.prix || 0}, '${(m.titre||'').replace(/'/g,"")}')`;
    }
  } else {
    if (isPremium && !estDejaDebloque) {
      texteBouton = "Débloquer >";
      actionBouton = `ouvrirModule('${m.id}')`;
      classeBouton = "btn-premium";
    }
    if (isPremium && estDejaDebloque) {
      texteBouton = "Voir";
      actionBouton = `ouvrirModule('${m.id}')`;
      classeBouton = "btn-voir";
    }
  }

  const styleBordure = (isPremium && !estDejaDebloque && !isFasc) ? "border-right:4px solid #ff0000;" : "";

  return `<div class="card" onclick="ouvrirModule('${m.id}')" style="${styleBordure}">
    <div class="card-info">
      <h3>${isFiche ? "📝 " : ""}${m.titre}</h3>
      ${auteur}
      <p>${desc}</p>
      <div class="badge-ligne" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
        ${badge}${prix}${typeBadge}${programme}${matiere}${lectures}
      </div>
    </div>
    <div class="card-actions">
      <button class="btn-small ${classeBouton}" onclick="event.stopPropagation();${actionBouton}">${texteBouton}</button>
      <button class="btn-mescours" style="background:#ff3b30;color:#fff;border-color:#ff3b30" onclick="event.stopPropagation();retirerIci('${m.id}',this)">✕ Retirer</button>
    </div>
  </div>`;
}

async function retirerIci(module_id, btn) {
  const u = await getUser();
  if (!u) { go("connexion.html"); return; }
  const { error } = await supabaseClient.from("favoris").delete().eq("user_id", u.id).eq("module_id", module_id);
  if (error) { toast("Impossible de retirer"); return; }
  const card = btn.closest(".card");
  if (card) card.remove();
  toast("Retiré de Mes Cours");
  ["listeMesCours", "listeFiches", "listeFascicules"].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.querySelectorAll(".card").length === 0) {
      el.innerHTML = `<div class="empty">Aucun élément ici.<br>Ajoute avec + Mes Cours depuis l'accueil.</div>`;
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await ProtegerPage("etudiant");
  const u = await getUser();
  if (!u) return;

  await chargerStatutPremium();
  const profil = await getProfil();
  if (profil?.premium) USER_IS_PREMIUM = true;

  const { data: favs } = await supabaseClient.from("favoris").select("module_id").eq("user_id", u.id);
  const ids = (favs || []).map(f => f.module_id);
  const mods = await getModules();
  const mes = mods.filter(m => ids.includes(m.id));
  const parType = t => mes.filter(m => m.type === t);

  document.getElementById("listeMesCours").innerHTML = parType("cours").length ? parType("cours").map(carteModuleRetirer).join("") : `<div class="empty">Aucun cours dans Mes Cours.<br>Ajoute avec + Mes Cours depuis l'accueil.</div>`;
  document.getElementById("listeFiches").innerHTML = parType("fiche").length ? parType("fiche").map(carteModuleRetirer).join("") : `<div class="empty">Aucune fiche.</div>`;
  document.getElementById("listeFascicules").innerHTML = parType("fascicule").length ? parType("fascicule").map(carteModuleRetirer).join("") : `<div class="empty">Aucun fascicule.</div>`;

  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  if (tab) changerTab(tab, document.querySelector(`.tab-btn[onclick*="'${tab}'"]`));
});