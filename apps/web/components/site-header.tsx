import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/server-session";

async function signOutAction() {
  "use server";

  await auth.api.signOut({
    headers: await headers()
  });
  redirect("/");
}

export async function SiteHeader() {
  const session = await getCurrentSession();

  return (
    <header className="site-header">
      <Link className="site-logo" href="/">
        <span className="site-logo-mark">BG</span>
        <span>
          <strong>BioMap Guatemala</strong>
          <small>Atlas público de biodiversidad</small>
        </span>
      </Link>

      <nav className="site-nav" aria-label="Principal">
        <Link href="/map">Mapa</Link>
        <Link href="/search">Buscar</Link>
        <Link href="/sources">Fuentes</Link>
        {session ? <Link href="/account">Cuenta</Link> : <Link href="/sign-in">Ingresar</Link>}
        {session && ["moderator", "admin"].includes(session.user.role) ? (
          <Link href="/moderation">Moderación</Link>
        ) : null}
        {session?.user.role === "admin" ? <Link href="/admin">Admin</Link> : null}
        {session ? (
          <form action={signOutAction}>
            <button type="submit">Salir</button>
          </form>
        ) : null}
      </nav>
    </header>
  );
}
