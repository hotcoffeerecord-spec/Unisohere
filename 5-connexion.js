// ===== STYLE ERREUR + SHAKE - MEME SYSTEME QUE PAGE ENSEIGNANT =====
(function(){
  if(document.getElementById("style-erreur-connexion")) return;
  const s=document.createElement("style"); s.id="style-erreur-connexion";
  s.textContent=`@keyframes shakeX{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}} .champ-erreur{border:2px solid #FF3B30!important;background:#FFF0F0!important;animation:shakeX .4s ease} .msg-erreur-style{background:#FF3B30;color:#fff;font-weight:700;font-size:13px;padding:10px 12px;border-radius:12px;margin:10px 0;text-align:center} .msg-succes-style{background:#1DB954;color:#fff;font-weight:700;font-size:13px;padding:10px 12px;border-radius:12px;margin:10px 0;text-align:center}`;
  document.head.appendChild(s);
})();

function marquerErreur(el){
  if(!el) return;
  el.classList.remove("champ-erreur");
  void el.offsetWidth;
  el.classList.add("champ-erreur");
  setTimeout(()=>el.classList.remove("champ-erreur"),600);
}
function afficherErreur(id,txt){
  const e=document.getElementById(id);
  if(!e) return;
  e.className="msg-erreur-style";
  e.textContent="! "+txt;
}
function afficherSucces(id,txt){
  const e=document.getElementById(id);
  if(!e) return;
  e.className="msg-succes-style";
  e.textContent="OK - "+txt;
}
function effacerErreur(id){
  const e=document.getElementById(id);
  if(!e) return;
  e.textContent="";
  e.className="";
}
function champOK(id,idMsg,test,msg){
  const el=document.getElementById(id);
  const v=el?el.value.trim():"";
  if(!test(v)){ marquerErreur(el); afficherErreur(idMsg,msg); return false; }
  if(el) el.classList.remove("champ-erreur");
  return true;
}

// ===== VOIR / CACHER MOT DE PASSE =====
function togglePassword(){
  const input=document.getElementById("passwordInput");
  if(!input) return;
  input.type = input.type==="password" ? "text" : "password";
}

// ===== MOT DE PASSE OUBLIE =====
async function motDePasseOublie(){
  const email=document.getElementById("emailInput")?.value.trim();
  if(!email || !email.includes("@")){
    marquerErreur(document.getElementById("emailInput"));
    afficherErreur("msgConnexion","Ecris d'abord ton email pour recevoir le lien.");
    return;
  }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email,{
    redirectTo: window.location.origin + "/nouveau-mot-de-passe.html"
  });
  if(error){ afficherErreur("msgConnexion",error.message); return; }
  afficherSucces("msgConnexion","Lien envoye a "+email+". Verifie ta boite mail.");
}

// ===== SE CONNECTER =====
async function seConnecter(){
  effacerErreur("msgConnexion");

  if(!champOK("emailInput","msgConnexion",v=>v.length>=5 && v.includes("@") && v.includes("."),"Email invalide. Ex : vous@email.com")) return;
  if(!champOK("passwordInput","msgConnexion",v=>v.length>=6,"Mot de passe : 6 caracteres minimum.")) return;

  const email=document.getElementById("emailInput").value.trim().toLowerCase();
  const mdp=document.getElementById("passwordInput").value;
  const btn=document.querySelector(".btn-connexion");
  if(btn){ btn.disabled=true; btn.textContent="Connexion..."; }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: mdp });

  if(error){
    if(btn){ btn.disabled=false; btn.textContent="Se connecter"; }
    marquerErreur(document.getElementById("emailInput"));
    marquerErreur(document.getElementById("passwordInput"));
    afficherErreur("msgConnexion","Mail ou mot de passe incorrect.");
    return;
  }

  const { data:profil } = await supabaseClient.from("profiles").select("role, email").eq("id", data.user.id).maybeSingle();

  afficherSucces("msgConnexion","Connexion reussie, redirection...");

  setTimeout(()=>{
    const role = (profil?.role || "").toLowerCase();
    const mail = (profil?.email || email || "").toLowerCase();

    // 1. SUPER ADMIN -> superAdmin.html (par rôle OU par email, au cas où le rôle n'est pas encore à jour)
    if(role === "superadmin" || role === "admin" || mail === "epainethkoutawa@gmail.com"){
      window.location.href = "superAdmin.html";
    }
    // 2. PROF -> administration.html
    else if(role === "enseignant" || role === "prof"){
      window.location.href = "administration.html";
    }
    // 3. ETUDIANT -> accueil.html
    else {
      window.location.href = "acceuil.html";
    }
  },500);
}

// ===== ENTREE DU CLAVIER = SE CONNECTER =====
document.addEventListener("DOMContentLoaded",()=>{
  ["emailInput","passwordInput"].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener("keydown",(e)=>{ if(e.key==="Enter") seConnecter(); });
    el.addEventListener("input",()=>{ el.classList.remove("champ-erreur"); effacerErreur("msgConnexion"); });
  });
});