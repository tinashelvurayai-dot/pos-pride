import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cashierEmail, cashierPassword, normalizeCode1, MANAGER_EMAIL } from "@/lib/cashier-auth";

const MANAGER_PASSWORD = "Access151!";
const DEFAULT_CASHIER = { name: "Cashier", code1: "CD12345", code2: "POTENT" };

async function assertManager(context: { supabase: { rpc: Function }; userId: string }) {
  const { data } = await (context.supabase.rpc as (n: string, a: unknown) => Promise<{ data: unknown }>)(
    "has_role",
    { _user_id: context.userId, _role: "manager" },
  );
  if (data !== true) throw new Error("Forbidden");
}

/**
 * Creates the shop's manager account and the starter cashier if they are not
 * there yet. Idempotent: existing accounts are never touched.
 */
export const ensureAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = list?.users ?? [];
  const manager = users.find((u) => u.email?.toLowerCase() === MANAGER_EMAIL.toLowerCase());

  let managerId = manager?.id;
  if (!managerId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: MANAGER_EMAIL,
      password: MANAGER_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Manager" },
    });
    if (error) throw new Error(error.message);
    managerId = data.user?.id;
  }
  if (managerId) {
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: managerId, full_name: "Manager", active: true }, { onConflict: "id" });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: managerId, role: "manager" }, { onConflict: "user_id,role" });
  }

  const { count } = await supabaseAdmin
    .from("cashier_accounts")
    .select("id", { count: "exact", head: true });
  if (!count) {
    await upsertCashierAccount({
      name: DEFAULT_CASHIER.name,
      code1: DEFAULT_CASHIER.code1,
      code2: DEFAULT_CASHIER.code2,
      active: true,
    });
  }
  return { ok: true };
});

type CashierInput = {
  id?: string;
  name: string;
  code1: string;
  code2?: string;
  active?: boolean;
};

async function upsertCashierAccount(input: CashierInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const code1 = normalizeCode1(input.code1);
  const email = cashierEmail(code1);
  if (!code1) throw new Error("Code 1 is required");

  let userId: string | null = null;
  if (input.id) {
    const { data: row } = await supabaseAdmin
      .from("cashier_accounts")
      .select("user_id")
      .eq("id", input.id)
      .maybeSingle();
    userId = row?.user_id ?? null;
  }

  if (userId) {
    const updates: { email?: string; password?: string; user_metadata?: Record<string, unknown> } = {
      email,
      user_metadata: { full_name: input.name },
    };
    if (input.code2?.trim()) updates.password = cashierPassword(input.code2);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ...updates,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
  } else {
    if (!input.code2?.trim()) throw new Error("Code 2 is required for a new cashier");
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: cashierPassword(input.code2),
      email_confirm: true,
      user_metadata: { full_name: input.name },
    });
    if (error) throw new Error(error.message);
    userId = data.user?.id ?? null;
  }
  if (!userId) throw new Error("Could not create the cashier account");

  await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: userId, full_name: input.name, cashier_id: code1, active: input.active ?? true },
      { onConflict: "id" },
    );
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "cashier" }, { onConflict: "user_id,role" });

  const row = {
    ...(input.id ? { id: input.id } : {}),
    user_id: userId,
    name: input.name,
    code1,
    active: input.active ?? true,
  };
  const { error: upsertError } = await supabaseAdmin
    .from("cashier_accounts")
    .upsert(row, { onConflict: "user_id" });
  if (upsertError) throw new Error(upsertError.message);
  return { ok: true, code1 };
}

export const saveCashier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CashierInput) => data)
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    return upsertCashierAccount(data);
  });

export const deleteCashier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("cashier_accounts")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();
    await supabaseAdmin.from("cashier_accounts").delete().eq("id", data.id);
    if (row?.user_id) await supabaseAdmin.auth.admin.deleteUser(row.user_id);
    return { ok: true };
  });
