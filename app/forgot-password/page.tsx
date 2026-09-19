import { PasswordRecovery } from "@/components/password-recovery";
export const metadata = { title: "Password recovery | LockStock", robots: { index: false, follow: false } };
export default function Page() { return <PasswordRecovery mode="request" />; }
