let CODE_GENERE = "";

document.addEventListener("DOMContentLoaded", async () => {
  // Charger les programmes dans le select
  const sel = document.getElementById("programmeInput");
  if (sel) {
    let programmes = [];
    try {
      const { data } = await supabaseClient.from("programmes").select("*").eq("actif", true).order("nom");
      programmes = data || [];
    } catch (e) {}
    if (!programmes.length && typeof PROGRAMMES_DEFAUT !== "undefined") {
      programmes = PROGRAMMES_DEFAUT.map(n => ({ nom: n }));
    }
    if (!programmes.length) {
      programmes = [{ nom: "Génie Informatique" }, { nom: "Médecine" }, { nom: "Droit" }, { nom: "Économie" }, { nom: "Sciences" }];
    }
    sel.innerHTML = `<option value="">-- Choisis ton programme --</option>` + programmes.map(p => `<option value="${p.nom}">${p.nom}</option>`).join("");
  }
  
  $("#btnAction")?.addEventListener("click", async () => {
    const nom = $("#nomInput").value.trim(),
      email = $("#emailInput").value.trim(),
      mdp = $("#passwordInput").value,
      programme = $("#programmeInput")?.value || "";
    
    if (!nom || !email || mdp.length < 6) {
      $("#errorMsg").style.display = "block";
      $("#errorMsg").textContent = "Remplis tout, mot de passe 6 caractères minimum.";
      return;
    }
    if (!programme) {
      $("#errorMsg").style.display = "block";
      $("#errorMsg").textContent = "Choisis ton programme pour voir les bons cours.";
      return;
    }
    
    CODE_GENERE = typeof CODE_DEMO !== "undefined" ? CODE_DEMO : "123456";
    $("#screenForm").classList.add("hidden");
    $("#screenCode").classList.remove("hidden");
    $("#emailShow").textContent = email;
    $("#programmeShow").textContent = programme;
    $("#codeShow").textContent = CODE_GENERE;
  });
  
  $("#btnVerify")?.addEventListener("click", async () => {
    const code = $("#codeInput").value.trim();
    if (code !== CODE_GENERE) {
      $("#errorCode").style.display = "block";
      $("#errorCode").textContent = "Mauvais code. En démo : 123456";
      return;
    }
    
    const nom = $("#nomInput").value.trim(),
      email = $("#emailInput").value.trim(),
      mdp = $("#passwordInput").value,
      programme = $("#programmeInput")?.value || "";
    
    // 1. Créer dans Auth
    const { data, error } = await supabaseClient.auth.signUp({ email, password: mdp });
    if (error) {
      $("#errorCode").style.display = "block";
      $("#errorCode").textContent = error.message;
      return;
    }
    
    // 2. Se connecter pour avoir le droit d'insérer dans profiles
    let userId = data.user?.id;
    if (userId) {
      const { data: login } = await supabaseClient.auth.signInWithPassword({ email, password: mdp });
      if (login?.user) userId = login.user.id;
    }
    
    // 3. Insérer dans profiles AVEC LE PROGRAMME
    const { error: profileError } = await supabaseClient.from("profiles").insert({
      id: userId,
      full_name: nom,
      nom: nom,
      email: email,
      role: "etudiant",
      programme: programme
    });
    
    if (profileError) {
      $("#errorCode").style.display = "block";
      $("#errorCode").textContent = "Erreur profiles : " + profileError.message;
      console.log(profileError);
      return;
    }
    
    // Sauvegarde locale aussi pour aller vite
    try { localStorage.setItem("mon_programme", programme); } catch (e) {}
    
    window.location.href = "acceuil.html";
  });
  
  $("#btnResend")?.addEventListener("click", () => {
    $("#codeShow").textContent = CODE_GENERE;
    alert("Nouveau code : " + CODE_GENERE);
  });
});

function backToForm() {
  $("#screenCode").classList.add("hidden");
  $("#screenForm").classList.remove("hidden");
}