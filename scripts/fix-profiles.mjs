import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function fix() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const list = [
    { email: "mkuu@shule.ac.tz", first_name: "Juma", middle_name: "Hassan", last_name: "Mwaipopo", sex: "M", phone: "0754000001", role: "headmaster" },
    { email: "masomo@shule.ac.tz", first_name: "Asha", middle_name: "Omari", last_name: "Kimaro", sex: "F", phone: "0754000002", role: "academic" },
    { email: "mwalimu1@shule.ac.tz", first_name: "Peter", middle_name: "John", last_name: "Mshana", sex: "M", phone: "0754000003", role: "teacher" },
    { email: "mwalimu2@shule.ac.tz", first_name: "Rehema", middle_name: "Salum", last_name: "Nyerere", sex: "F", phone: "0754000004", role: "teacher" },
  ];
  for (const u of list) {
    const found = users.users.find(x => x.email === u.email);
    if (!found) continue;
    const { error } = await supabase.from("profiles").upsert({
      id: found.id,
      first_name: u.first_name,
      middle_name: u.middle_name,
      last_name: u.last_name,
      sex: u.sex,
      phone: u.phone,
      email: u.email,
      role: u.role,
    });
    if (error) console.log("ERR", u.email, error.message);
    else console.log("OK", u.email);
  }
  console.log("done");
}

fix();
