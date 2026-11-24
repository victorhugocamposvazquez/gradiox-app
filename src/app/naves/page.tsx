import { redirect } from "next/navigation";

// Las naves pasaron a llamarse instalaciones (24 nov 2026).
export default function NavesAntiguas() {
  redirect("/instalaciones");
}
