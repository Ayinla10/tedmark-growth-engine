import { redirect } from "next/navigation";

export default function QualifiedLeadsRedirect() {
  redirect("/opportunities?stage=Qualified");
}
