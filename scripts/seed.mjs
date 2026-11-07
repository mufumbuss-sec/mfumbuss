import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const DEFAULT_PASSWORD = "Mufumbu2026!";

const users = [
  {
    email: "headmaster@school.com",
    profile: {
      first_name: "Mkuu",
      middle_name: "Mufumbu",
      last_name: "Shule",
      sex: "M",
      phone: "0700000001",
      role: "headmaster",
    },
  },
  {
    email: "academic@school.com",
    profile: {
      first_name: "Mwalimu",
      middle_name: "Mkuu",
      last_name: "Masomo",
      sex: "F",
      phone: "0700000002",
      role: "academic",
    },
  },
  {
    email: "teacher@school.com",
    profile: {
      first_name: "Mwalimu",
      middle_name: null,
      last_name: "Darasa",
      sex: "M",
      phone: "0700000003",
      role: "teacher",
    },
  },
  {
    email: "admin@school.com",
    profile: {
      first_name: "Msimamizi",
      middle_name: null,
      last_name: "Mfumo",
      sex: "M",
      phone: "0700000004",
      role: "headmaster",
    },
  },
];

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw error;

  return data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase()
  );
}

async function seed() {
  for (const u of users) {
    let user = await findUserByEmail(u.email);

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      });

      if (error) {
        console.log(`Kosa kuunda ${u.email}:`, error.message);
        continue;
      }

      user = data.user;
      console.log(
        `Akaunti imeundwa: ${u.email} (password ya awali: ${DEFAULT_PASSWORD})`
      );
    }

    if (user.app_metadata?.role !== u.profile.role) {
      const { error: roleError } = await supabase.auth.admin.updateUserById(
        user.id,
        { app_metadata: { role: u.profile.role } }
      );

      if (roleError) {
        console.log(
          `Kosa kuweka role metadata ${u.email}:`,
          roleError.message
        );
      } else {
        console.log(`Role metadata imewekwa: ${u.email} (${u.profile.role})`);
      }
    }

    const { data: existing, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (lookupError) {
      console.log(`Kosa kuangalia profile ${u.email}:`, lookupError.message);
      continue;
    }

    if (existing) {
      console.log(`Profile ipo tayari: ${u.email} (${u.profile.role})`);
      continue;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      first_name: u.profile.first_name,
      middle_name: u.profile.middle_name,
      last_name: u.profile.last_name,
      sex: u.profile.sex,
      phone: u.profile.phone,
      email: u.email,
      role: u.profile.role,
    });

    if (profileError) {
      console.log(`Kosa kuweka profile ${u.email}:`, profileError.message);
    } else {
      console.log(`Imekamilika: ${u.email} (${u.profile.role})`);
    }
  }

  console.log("Seed imekamilika.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
