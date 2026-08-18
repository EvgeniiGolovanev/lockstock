type SignUpPlan = "starter" | "operations" | "business" | "enterprise";
type OnboardingMode = "trial" | "paid";
type PostSignUpPath = "/account" | `/payment?onboarding=paid&plan=${SignUpPlan}`;

type BuildSignUpPayloadInput = {
  email: string;
  password: string;
  fullName: string;
  company: string;
  selectedPlan: SignUpPlan;
  onboardingMode: OnboardingMode;
  appOrigin: string;
};

const POST_SIGN_UP_ORG_STORAGE_KEY = "lockstock.orgId";

function sanitizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

export function buildPostSignUpPath(
  input: Pick<BuildSignUpPayloadInput, "onboardingMode" | "selectedPlan">
): PostSignUpPath {
  if (input.onboardingMode === "trial") {
    return "/account";
  }

  return `/payment?onboarding=paid&plan=${input.selectedPlan}`;
}

function buildEmailRedirectPath(input: Pick<BuildSignUpPayloadInput, "onboardingMode">) {
  return input.onboardingMode === "trial" ? "/account" : "/payment";
}

export function rememberPostSignUpWorkspace(storage: Pick<Storage, "setItem">, orgId: string | null | undefined) {
  if (!orgId) {
    return;
  }

  storage.setItem(POST_SIGN_UP_ORG_STORAGE_KEY, orgId);
}

export function buildSignUpPayload(input: BuildSignUpPayloadInput) {
  const baseOrigin = sanitizeOrigin(input.appOrigin);
  const redirectPath = buildEmailRedirectPath(input);

  return {
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${baseOrigin}${redirectPath}`,
      data: {
        full_name: input.fullName,
        company: input.company,
        selected_plan: input.selectedPlan,
        onboarding_mode: input.onboardingMode
      }
    }
  };
}
