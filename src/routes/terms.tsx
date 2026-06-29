import { createFileRoute } from "@tanstack/react-router";
import TermsOfServicePage from "@/pages/TermsOfServicePage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termini di Servizio · OmbrellOne" },
      { name: "description", content: "Termini di servizio di OmbrellOne." },
    ],
  }),
  component: TermsOfServicePage,
});
