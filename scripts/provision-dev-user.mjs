import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { provisionDevUser } = require("./provision-dev-user-core.js");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function localStatus() {
  return JSON.parse(execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8" }));
}

async function main() {
  const status = localStatus();
  const config = {
    email: requireEnv("DEV_USER_EMAIL"),
    password: requireEnv("DEV_USER_PASSWORD"),
    url: status.API_URL,
    company: process.env.DEV_USER_COMPANY?.trim() || "LockStock Development"
  };
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const anon = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  let accessToken;

  const result = await provisionDevUser({
    config,
    async listUsers() {
      const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw new Error(`Failed to list local Auth users: ${error.message}`);
      return data.users;
    },
    async createUser(input) {
      const { data, error } = await service.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: input.emailConfirm
      });
      if (error || !data.user) throw new Error(`Failed to create local Auth user: ${error?.message ?? "no user returned"}`);
      return data.user;
    },
    async authenticate(input) {
      const { data, error } = await anon.auth.signInWithPassword(input);
      if (error || !data.session) throw new Error(`Local credentials could not sign in: ${error?.message ?? "no session returned"}`);
      accessToken = data.session.access_token;
    },
    async listMemberships(userId) {
      const { data, error } = await service.from("org_users").select("org_id").eq("user_id", userId);
      if (error) throw new Error(`Failed to check local workspace membership: ${error.message}`);
      return (data ?? []).map((membership) => ({ orgId: membership.org_id }));
    },
    async createWorkspace() {
      const userClient = createClient(status.API_URL, status.ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } }
      });
      const { data, error } = await userClient.rpc("create_organization_with_owner", {
        p_name: config.company,
        p_plan: "starter",
        p_start_trial: true
      });
      if (error || !data) throw new Error(`Failed to create local development workspace: ${error?.message ?? "no workspace returned"}`);
      return { orgId: data.id };
    }
  });

  console.log(JSON.stringify({ ...result, email: config.email.trim().toLowerCase() }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
