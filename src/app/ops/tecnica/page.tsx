import { redirect } from "next/navigation";

// Las fichas técnicas ya no tienen pantalla propia: cada una es una pestaña de su cliente.
export default function FichasTecnicas() {
  redirect("/ops");
}
