import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(1).max(400),
  auth: z.string().min(1).max(200),
  timezone: z.string().min(1).max(80),
  userAgent: z.string().max(400).optional(),
});

const endpointSchema = z.object({ endpoint: z.string().url().max(1000) });

/** Stores (or refreshes) the push subscription for the signed-in hunter's device. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => subscriptionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        owner_id: userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        timezone: data.timezone,
        user_agent: data.userAgent ?? null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "endpoint" },
    );

    if (error) throw new Error(error.message);
    return { saved: true };
  });

/** Removes one device subscription (used when reminders are turned off on that device). */
export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => endpointSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { removed: true };
  });
