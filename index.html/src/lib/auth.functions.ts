import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_HABITS, internalEmailFor, registerSchema } from "./auth-defaults";

export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = data.userId.trim().toLowerCase();

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (taken) return { ok: false as const, error: "That User ID is already taken." };

    const authEmail = internalEmailFor(userId);
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { user_id: userId, full_name: data.fullName },
    });
    if (createError || !created.user) {
      return { ok: false as const, error: createError?.message ?? "Could not create the account." };
    }

    const uid = created.user.id;
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: uid,
      full_name: data.fullName,
      username: data.username,
      user_id: userId,
      email: data.email ? data.email : null,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      return { ok: false as const, error: "Could not create the profile. Try another User ID." };
    }

    await supabaseAdmin
      .from("habits")
      .insert(DEFAULT_HABITS.map((h, i) => ({ ...h, owner_id: uid, sort_order: i })));

    return { ok: true as const, authEmail };
  });

export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().trim().min(1).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = data.userId.trim().toLowerCase();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return { ok: false as const };
    return { ok: true as const, authEmail: internalEmailFor(userId) };
  });
