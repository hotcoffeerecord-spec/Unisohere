document.addEventListener("DOMContentLoaded",async()=>{
await ProtegerPage("admin");
chargerAdmin();
});
function changerTabAdmin(tab,btn){
document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
if(btn)btn.classList.add("active");
["profs","paiements","cours","users"].forEach(t=>{
document.getElementById("tab-"+t+"-admin").style.display=t===tab?"block":"none";
});
}
async function chargerAdmin(){
const {data:users}=await supabaseClient.from("profiles").select("*");
document.getElementById("statUsers").textContent=users?.length||0;
document.getElementById("statProfs").textContent=(users||[]).filter(u=>u.role==="enseignant").length;
const {data:mods}=await supabaseClient.from("modules").select("*, profiles:enseignant_id(full_name)");
document.getElementById("statCours").textContent=mods?.length||0;
const {data:abos}=await supabaseClient.from("abonnements").select("*");
const {data:achats}=await supabaseClient.from("achats_fascicules").select("*");
const valides=[...(abos||[]).filter(a=>a.statut==="valide"),...(achats||[]).filter(a=>a.statut==="valide")];
const revenuPlateforme=valides.reduce((s,a)=>s+((a.prix||a.prix_payé||0)*0.3),0);
document.getElementById("statRevenu").textContent=Math.round(revenuPlateforme)+" FCFA";
const {data:progs}=await supabaseClient.from("programmes").select("*").order("nom");
document.getElementById("listeProgrammes").innerHTML=(progs||[]).map(p=>`<div class="item"><div><b>${p.nom}</b><span>${p.actif?"Actif":"Inactif"}</span></div><button class="del" onclick="supprimerProgramme('${p.id}')">Supprimer</button></div>`).join("")||`<div class="empty">Aucun programme.</div>`;
const attente=(users||[]).filter(u=>u.role==="enseignant"&&u.statut_enseignant==="en_attente");
document.getElementById("listeProfsAttente").innerHTML=attente.length?attente.map(u=>`<div class="item"><div><b>${u.full_name||u.email}</b><span>${u.email} • ${u.programme||""}</span></div><div style="display:flex;gap:8px"><button class="btn" style="margin:0;width:auto;padding:8px 14px" onclick="validerProf('${u.id}')">Valider</button><button class="del" onclick="refuserProf('${u.id}')">Refuser</button></div></div>`).join(""):`<div class="empty">Aucun prof en attente.</div>`;
const enAttente=(abos||[]).filter(a=>a.statut==="en_attente");
document.getElementById("listePaiements").innerHTML=enAttente.length?enAttente.map(a=>`<div class="item"><div><b>${a.type} • ${a.plan}</b><span>${a.prix} FCFA • ${a.methode} • ${a.numero_paiement||""}</span></div><button class="btn" style="margin:0;width:auto;padding:8px 14px" onclick="validerPaiement('${a.id}','${a.type}','${a.user_id}','${a.plan}','${a.prix}')">Valider</button></div>`).join(""):`<div class="empty">Aucun paiement en attente.</div>`;
document.getElementById("listeTousCours").innerHTML=(mods||[]).map(m=>`<div class="item"><div><b>${m.titre}</b><span>${m.type} • ${m.matiere} • ${m.profiles?.full_name||""}</span></div><button class="del" onclick="supprimerCoursAdmin('${m.id}')">Supprimer</button></div>`).join("")||`<div class="empty">Aucun cours.</div>`;
document.getElementById("listeUsers").innerHTML=(users||[]).map(u=>`<div class="item"><div><b>${u.full_name||u.email}</b><span>${u.role} • ${u.email}</span></div><button class="del" onclick="supprimerUser('${u.id}')">Supprimer</button></div>`).join("")||`<div class="empty">Aucun utilisateur.</div>`;
}
async function ajouterProgramme(){
const nom=document.getElementById("nouveauProgramme").value.trim();
if(!nom)return;
await supabaseClient.from("programmes").insert({nom});
document.getElementById("nouveauProgramme").value="";
chargerAdmin();
}
async function supprimerProgramme(id){if(!confirm("Supprimer ce programme ?"))return;await supabaseClient.from("programmes").delete().eq("id",id);chargerAdmin();}
async function validerProf(id){await supabaseClient.from("profiles").update({statut_enseignant:"valide"}).eq("id",id);chargerAdmin();}
async function refuserProf(id){await supabaseClient.from("profiles").update({statut_enseignant:"refuse"}).eq("id",id);chargerAdmin();}
async function validerPaiement(id,type,user_id,plan,prix){
await supabaseClient.from("abonnements").update({statut:"valide"}).eq("id",id);
if(type==="premium_etudiant"){
let mois=plan==="annuel"?12:plan==="trimestriel"?3:1;
let fin=new Date();fin.setMonth(fin.getMonth()+mois);
await supabaseClient.from("profiles").update({premium:true,premium_plan:plan,premium_expire_le:fin.toISOString()}).eq("id",user_id);
}
if(type==="abonnement_prof"){
let fin=new Date();fin.setFullYear(fin.getFullYear()+1);
await supabaseClient.from("profiles").update({statut_enseignant:"valide",abonnement_prof_expire_le:fin.toISOString()}).eq("id",user_id);
}
await supabaseClient.from("notifications").insert({user_id:user_id,titre:"Paiement valide",message:"Ton paiement de "+prix+" FCFA a ete valide. Merci !",type:"premium"});
chargerAdmin();
}
async function supprimerCoursAdmin(id){if(!confirm("Supprimer ce cours ?"))return;await supabaseClient.from("modules").delete().eq("id",id);chargerAdmin();}
async function supprimerUser(id){if(!confirm("Supprimer cet utilisateur ?"))return;await supabaseClient.from("profiles").delete().eq("id",id);chargerAdmin();}