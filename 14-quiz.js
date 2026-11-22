let QUIZ_ACTUEL=null;
let INDEX_Q=0;
let BONNES=0;
let TIMER=null;
let TEMPS_RESTANT=0;
let REPONDU=false;
document.addEventListener("DOMContentLoaded",async()=>{
await ProtegerPage("etudiant");
const params=new URLSearchParams(window.location.search);
const id=params.get("id");
if(!id){window.location.href="espacetravaille.html";return;}
const {data}=await supabaseClient.from("quiz").select("*").eq("id",id).maybeSingle();
QUIZ_ACTUEL=data;
if(!QUIZ_ACTUEL){window.location.href="espacetravaille.html";return;}
document.getElementById("titreQuiz").textContent=QUIZ_ACTUEL.titre;
document.getElementById("quizTitreIntro").textContent=QUIZ_ACTUEL.titre;
document.getElementById("quizInfoIntro").textContent=(QUIZ_ACTUEL.matiere||"")+" • "+(QUIZ_ACTUEL.questions?.length||0)+" questions • "+(QUIZ_ACTUEL.type==="examen_blanc"?"1min30 / question":"Sans timer");
if(QUIZ_ACTUEL.type==="examen_blanc"){TEMPS_RESTANT=(QUIZ_ACTUEL.questions?.length||0)*90;afficherTimer();}
});
function afficherTimer(){
const m=Math.floor(TEMPS_RESTANT/60);
const s=TEMPS_RESTANT%60;
const txt=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
const a=document.getElementById("timerBox");if(a)a.textContent=txt;
const b=document.getElementById("quizTimer");if(b)b.textContent=txt;
}
function demarrerQuiz(){
document.getElementById("quizIntro").style.display="none";
document.getElementById("quizPlay").style.display="block";
INDEX_Q=0;BONNES=0;
if(QUIZ_ACTUEL.type==="examen_blanc"){
TIMER=setInterval(()=>{
TEMPS_RESTANT--;
afficherTimer();
if(TEMPS_RESTANT<=0){clearInterval(TIMER);terminerQuiz();}
},1000);
}
afficherQuestion();
}
function afficherQuestion(){
REPONDU=false;
const q=QUIZ_ACTUEL.questions[INDEX_Q];
document.getElementById("quizProgress").textContent="Question "+(INDEX_Q+1)+" / "+QUIZ_ACTUEL.questions.length;
document.getElementById("questionText").textContent=q.question;
document.getElementById("btnSuivant").style.display="none";
const box=document.getElementById("propositions");
box.innerHTML="";
(q.propositions||[]).forEach((p,i)=>{
const b=document.createElement("button");
b.textContent=p;
b.className="btn-qcm";
b.style.background="#222";b.style.color="#fff";b.style.textAlign="left";
b.onclick=()=>{
if(REPONDU)return;
REPONDU=true;
if(i===q.bonne){BONNES++;b.style.background="#7CFC00";b.style.color="#000";}
else{b.style.background="#ff3b30";b.style.color="#fff";}
document.getElementById("btnSuivant").style.display="block";
};
box.appendChild(b);
});
}
function questionSuivante(){
if(INDEX_Q<QUIZ_ACTUEL.questions.length-1){INDEX_Q++;afficherQuestion();}
else{terminerQuiz();}
}
async function terminerQuiz(){
if(TIMER)clearInterval(TIMER);
document.getElementById("quizPlay").style.display="none";
document.getElementById("quizResult").style.display="block";
const total=QUIZ_ACTUEL.questions.length;
const note=total?Math.round((BONNES/total)*20):0;
const etoiles=note>=16?5:note>=12?4:note>=10?3:note>=6?2:note>=3?1:0;
document.getElementById("scoreFinal").textContent=BONNES+" / "+total;
document.getElementById("etoilesFinal").textContent="Note : "+Math.round((BONNES/total)*10)+" / 10 • Etoiles : "+etoiles+" / 5";
const u=await getUser();
if(u){
await supabaseClient.from("resultats_quiz").insert({user_id:u.id,quiz_id:QUIZ_ACTUEL.id,score:BONNES,total:total,etoiles_gagnees:etoiles});
const {data:p}=await supabaseClient.from("profiles").select("*").eq("id",u.id).maybeSingle();
if(p)await supabaseClient.from("profiles").update({etoiles:(p.etoiles||0)+etoiles,flamme:(p.flamme||0)+1,parties:(p.parties||0)+1,meilleur_score:Math.max(p.meilleur_score||0,BONNES)}).eq("id",u.id);
}
}