function assertLocalSupabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DEV_USER provisioning requires a valid local Supabase URL.");
  }

  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("DEV_USER provisioning only accepts a local Supabase URL.");
  }
}

function findUserByEmail(users, email) {
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function provisionDevUser({ config, listUsers, createUser, authenticate, listMemberships, createWorkspace }) {
  assertLocalSupabaseUrl(config.url);

  const email = config.email.trim().toLowerCase();
  if (!email || !config.password) {
    throw new Error("DEV_USER_EMAIL and DEV_USER_PASSWORD are required.");
  }

  const existingUser = findUserByEmail(await listUsers(), email);
  const user = existingUser ?? await createUser({
    email,
    password: config.password,
    emailConfirm: true
  });

  await authenticate({ email, password: config.password });

  const memberships = await listMemberships(user.id);
  if (memberships.length > 0) {
    return {
      userId: user.id,
      createdUser: existingUser === null,
      createdWorkspace: false,
      orgId: memberships[0].orgId
    };
  }

  const workspace = await createWorkspace(user);
  return {
    userId: user.id,
    createdUser: existingUser === null,
    createdWorkspace: true,
    orgId: workspace.orgId
  };
}

module.exports = { provisionDevUser };
