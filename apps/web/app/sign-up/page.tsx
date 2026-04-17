import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

async function signUpAction(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await auth.api.signUpEmail({
      headers: await headers(),
      body: {
        name,
        email,
        password,
        callbackURL: "/account"
      }
    });
  } catch {
    redirect("/sign-up?error=1");
  }

  redirect("/sign-in?verify=1");
}

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getCurrentSession();
  if (session) {
    redirect("/account");
  }

  const { error } = await searchParams;

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div>
          <p className="eyebrow">Registro</p>
          <h2>Crea un perfil de colaborador con identidad pública clara</h2>
          <p>
            El nombre público acompaña tus propuestas y facilita la trazabilidad editorial dentro del
            atlas.
          </p>
        </div>

        <form action={signUpAction} className="auth-form">
          <label>
            Nombre público
            <input name="name" placeholder="Nombre visible" required />
          </label>
          <label>
            Correo
            <input name="email" placeholder="tu@correo.org" required type="email" />
          </label>
          <label>
            Contraseña
            <input name="password" placeholder="Crea una contraseña" required type="password" />
          </label>
          <button type="submit">Crear cuenta</button>
        </form>

        {error ? <p className="auth-message">No se pudo crear la cuenta. Intenta con otro correo.</p> : null}
      </section>

      <aside className="auth-aside">
        <div>
          <p className="eyebrow">Norma pública</p>
          <h2>El sistema prioriza revisión antes que volumen</h2>
          <p>
            El objetivo no es publicar rápido, sino sostener una capa pública clara, verificable y
            útil para exploración territorial.
          </p>
        </div>

        <div className="home-step-list">
          <article>
            <strong>Correo verificado</strong>
            <span>La verificación habilita el panel completo de contribuciones.</span>
          </article>
          <article>
            <strong>Moderación obligatoria</strong>
            <span>Cada aporte entra a revisión antes de afectar fichas o superficies públicas.</span>
          </article>
        </div>

        <Link className="pill-link" href="/sign-in">
          Ya tengo cuenta
        </Link>
      </aside>
    </div>
  );
}
