import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=Token+faltante", request.url));
  }

  const admin = createAdminClient();
  let nodeSlug = "";

  try {
    // 1. Find the pending registration request
    const { data: pending, error: selectErr } = await admin
      .from("pending_registrations")
      .select("*")
      .eq("verification_token", token)
      .maybeSingle();

    if (selectErr || !pending) {
      console.error("Error finding pending registration:", selectErr);
      return NextResponse.redirect(
        new URL("/login?error=Token+de+verificacion+invalido+o+expirado", request.url)
      );
    }

    const isPatient = pending.plan === "paciente";
    const isInmo = pending.plan === "inmo";
    nodeSlug = isInmo ? "nodo-inmo" : "nodo-clinica";

    // 2. Double check if client already exists
    const { data: existingClient } = await admin
      .from("clients")
      .select("id")
      .eq("email", pending.email)
      .maybeSingle();

    let clientId = existingClient?.id;

    if (!clientId) {
      // 3. Create the client record
      const { data: newClient, error: clientErr } = await admin
        .from("clients")
        .insert({
          name: pending.full_name,
          email: pending.email,
        })
        .select("id")
        .single();

      if (clientErr || !newClient) {
        console.error("Error creating client from pending:", clientErr);
        return NextResponse.redirect(
          new URL(`/${nodeSlug}/login?error=Error+al+crear+la+cuenta`, request.url)
        );
      }
      clientId = newClient.id;
    }

    // 3.5 Create user in Supabase Auth so they can log in and reset passwords
    let authUser: { id: string } | null = null;
    const userRole = isPatient ? "paciente" : (isInmo ? "inmo" : "medico");
    try {
      const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
        email: pending.email,
        password: pending.password,
        email_confirm: true,
        user_metadata: {
          full_name: pending.full_name,
        },
        app_metadata: {
          role: userRole,
        }
      });

      if (authErr) {
        if (authErr.message.includes("already") || authErr.message.includes("registered")) {
          // Find the existing user to get their ID and update role
          const { data: listData } = await admin.auth.admin.listUsers();
          const matchedUser = listData?.users?.find(u => u.email?.toLowerCase() === pending.email.toLowerCase());
          if (matchedUser) {
            authUser = { id: matchedUser.id };
            await admin.auth.admin.updateUserById(matchedUser.id, {
              app_metadata: { role: userRole }
            });
          }
        } else {
          console.error("Auth user creation error:", authErr);
        }
      } else if (newUser?.user) {
        authUser = { id: newUser.user.id };
      }
    } catch (authEx) {
      console.error("Auth user creation exception:", authEx);
    }

    // 3.6 Insert into node-specific database schemas
    if (!isInmo && authUser?.id) {
      const clinicaAdmin = createAdminClient("nodo_clinica");
      const nameParts = pending.full_name.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      if (isPatient) {
        const dni = "TEMP-" + Math.floor(Math.random() * 100000000);
        const { error: patErr } = await clinicaAdmin
          .from("patients")
          .insert({
            user_id: authUser.id,
            first_name: firstName,
            last_name: lastName,
            dni: dni,
            email: pending.email,
          });
        if (patErr) {
          console.error("Error inserting patient into nodo_clinica.patients:", patErr);
        }
      } else {
        // Doctor / Professional
        const { error: profErr } = await clinicaAdmin
          .from("professionals")
          .insert({
            user_id: authUser.id,
            first_name: firstName,
            last_name: lastName,
            specialty: "General",
            license_number: "TEMP-" + Math.floor(Math.random() * 100000),
          });
        if (profErr) {
          console.error("Error inserting professional into nodo_clinica.professionals:", profErr);
        }
      }
    }

    // 4. Create the client unit for NODO Salud or NODO Inmo
    const { error: unitErr } = await admin
      .from("client_units")
      .insert({
        client_id: clientId,
        unit_code: isInmo ? "inmo" : "salud",
        plan: pending.plan,
        status: (isPatient || isInmo) ? "activo" : "onboarding",
        progress: (isPatient || isInmo) ? 100 : 0,
        access_url: isInmo ? "https://nodoinmo.vercel.app/" : "http://localhost:5173/",
        access_user: pending.email,
        access_password: pending.password,
      });

    if (unitErr) {
      console.error("Error creating client unit from pending:", unitErr);
      return NextResponse.redirect(
        new URL(`/${nodeSlug}/login?error=Error+al+vincular+el+nodo`, request.url)
      );
    }

    // 5. Delete the pending registration request
    await admin.from("pending_registrations").delete().eq("id", pending.id);

    // 6. Redirect to verified success screen
    return NextResponse.redirect(
      new URL(`/nodo-salud/clinica-virtual/verificado?node=${isInmo ? "inmo" : "salud"}${isPatient ? "&role=paciente" : ""}`, request.url)
    );
  } catch (err) {
    console.error("Registration verification exception:", err);
    const fallbackPath = nodeSlug ? `/${nodeSlug}/login` : "/login";
    return NextResponse.redirect(
      new URL(`${fallbackPath}?error=Error+interno+al+verificar+cuenta`, request.url)
    );
  }
}
