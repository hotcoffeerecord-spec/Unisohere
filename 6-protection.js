async function ProtegerPage(roleAttendu){
const {data}=await supabaseClient.auth.getUser();
if(!data.user){window.location.href="connexion.html";return;}
const {data:profil}=await supabaseClient.from("profiles").select("*").eq("id",data.user.id).maybeSingle();
if(!profil){window.location.href="connexion.html";return;}
if(roleAttendu==="admin"&&profil.role!=="admin"){window.location.href="accueil.html";return;}
if(roleAttendu==="enseignant"&&profil.role!=="enseignant"&&profil.role!=="admin"){window.location.href="accueil.html";return;}
if(roleAttendu==="etudiant"&&profil.role==="enseignant"){window.location.href="administration.html";return;}
window.PROFIL_ACTUEL=profil;}