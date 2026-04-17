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
        <Link href="/">Inicio</Link>
        <Link href="/search">Buscar</Link>
        <Link href="/sources">Fuentes</Link>
      </nav>

      <div className="site-header-actions">
        {session && ["moderator", "admin"].includes(session.user.role) ? (
          <div className="site-admin-links">
            <Link href="/moderation">Moderación</Link>
            {session.user.role === "admin" ? <Link href="/admin">Admin</Link> : null}
          </div>
        ) : null}

        {session ? <Link className="site-account-link" href="/account">Cuenta</Link> : <Link className="site-account-link" href="/sign-in">Ingresar</Link>}

        <Link className="site-map-cta" href="/map">
          Abrir mapa
        </Link>

        {session ? (
          <form action={signOutAction}>
            <button type="submit">Salir</button>
          </form>
        ) : null}
      </div>
    </header>
  );
}
