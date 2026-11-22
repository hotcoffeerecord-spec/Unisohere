let EST_PREMIUM = false;

document.addEventListener("DOMContentLoaded", async () => {
  await ProtegerPage("etudiant");
  
  const profil = await getProfil();
  EST_PREMIUM = !!profil?.premium;
  
  const lock = document.getElementById("premiumLock");
  const zone = document.getElementById("zoneAssistant");
  const saisie = document.getElementById("saisie");
  
  if (!EST_PREMIUM) {
    // PAS PREMIUM : on montre l'abonnement Premium, on cache le chat + la saisie
    if (lock) lock.classList.add("show");
    if (zone) zone.style.display = "none";
    if (saisie) saisie.style.display = "none";
    return;
  }
  
  // PREMIUM : on montre le chat, on cache le bloc Premium
  if (lock) lock.classList.remove("show");
  if (zone) zone.style.display = "flex";
  if (saisie) saisie.style.display = "flex";
});

function ajouterMsg(texte, qui) {
  const chat = document.getElementById("chat");
  const d = document.createElement("div");
  d.className = "msg " + (qui === "moi" ? "msg-user" : "msg-bot");
  d.textContent = texte;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}

function reponseAssistant(q) {
  const t = q.toLowerCase();
  if (t.includes("photosynthese")) return "La photosynthese : les plantes transforment la lumiere + eau + CO2 en glucose + oxygene. Formule : 6CO2 + 6H2O + lumiere -> C6H12O6 + 6O2. Elle se passe dans les chloroplastes, grace a la chlorophylle.";
  if (t.includes("fonction") || t.includes("maths")) return "Une fonction, c'est une regle qui a chaque x associe un seul y. Ex : f(x) = 2x + 3. Pour x=2, f(2)=7. Trace-la, repere l'image et l'antecedent.";
  if (t.includes("colonisation")) return "La colonisation : a partir du 19e siecle, les puissances europeennes occupent l'Afrique et l'Asie pour les matieres premieres, les marches et le prestige. Au Congo : conference de Berlin 1884-1885, puis AEF.";
  if (t.includes("exercice")) return "Dis-moi la matiere et l'exercice exact, je te guide etape par etape. Ex : 'Exercice Semiologie : pouls' ou 'Exercice maths : equation'.";
  return "Bonne question ! Dis-moi ta matiere (Semiologie, Physiologie...) et ce que tu n'as pas compris, je t'explique simplement avec un exemple.";
}

function envoyerQuestion() {
  if (!EST_PREMIUM) {
    document.getElementById("premiumLock")?.classList.add("show");
    return;
  }
  const inp = document.getElementById("inputQuestion");
  const q = inp.value.trim();
  if (!q) return;
  ajouterMsg(q, "moi");
  inp.value = "";
  setTimeout(() => ajouterMsg(reponseAssistant(q), "bot"), 400);
}

function envoyerSuggestion(txt) {
  if (!EST_PREMIUM) {
    document.getElementById("premiumLock")?.classList.add("show");
    return;
  }
  document.getElementById("inputQuestion").value = txt;
  envoyerQuestion();
}