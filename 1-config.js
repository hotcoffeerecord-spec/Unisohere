const SUPABASE_URL = "https://agwaxklgvpuqglwzaycq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Sjxn3x_8-zHoHMsjTPO67g_K7EIt662";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const CINETPAY_CONFIG = { apikey: "TEST", site_id: "TEST", mode: "test" };
const PRIX = { mensuel: 1000, trimestriel: 2999, annuel: 10000, prof_an: 15000 };
const PROGRAMMES_DEFAUT = ["Médecine", "Droit"];

// ✅ Matières par programme
const MATIERES_PAR_PROGRAMME = {
  "Médecine": ["Semiologie", "Physiologie", "Anatomie"],
  "Droit": ["Droit fiscal", "Droit juridique"]
};
const CODE_DEMO = "123456";