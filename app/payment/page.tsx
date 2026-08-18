import type { Metadata } from "next";
import { LockstockPayment } from "@/components/lockstock-payment";

export const metadata: Metadata = {
  title: "Choose your plan | LockStock",
  description: "Start a LockStock trial or choose monthly or annual billing."
};

export default function PaymentPage() {
  return <LockstockPayment />;
}
