import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean).join(" ")
};

const result = spawnSync("npm", ["audit", "--omit=dev", "--audit-level=high"], {
  stdio: "inherit",
  env,
  shell: true
});

process.exit(result.status ?? 1);
