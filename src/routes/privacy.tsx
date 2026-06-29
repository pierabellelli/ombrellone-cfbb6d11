import { createFileRoute } from "@tanstack/react-router";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · OmbrellOne" },
      { name: "description", content: "Informativa sulla privacy di OmbrellOne." },
    ],
  }),
  component: PrivacyPolicyPage,
});
