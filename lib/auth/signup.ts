type BuildSignUpPayloadInput = {
  email: string;
  password: string;
  fullName: string;
  company: string;
  appOrigin: string;
};

function sanitizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

export function buildSignUpPayload(input: BuildSignUpPayloadInput) {
  const baseOrigin = sanitizeOrigin(input.appOrigin);

  return {
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${baseOrigin}/account`,
      data: {
        full_name: input.fullName,
        company: input.company
      }
    }
  };
}
