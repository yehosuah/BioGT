import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

async function signInAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await auth.api.signInEmail({
      headers: await headers(),
      body: {
        email,
        password,
        rememberMe: true
      }
    });
  } catch {
    redirect("/sign-in?error=1");
  }

  redirect("/account");
}

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; verify?: string }>;
}) {
  const session = await getCurrentSession();
  if (session) {
    redirect("/account");
  }

  const { error, verify } = await searchParams;

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div>
          <p className="eyebrow">Cuenta pública</p>
          <h2>Ingresa para contribuir con evidencia y contexto</h2>
          <p>
            El acceso abre tu espacio de contribuciones, seguimiento de revisión y edición de perfil
            público.
          </p>
        </div>

        <form action={signInAction} className="auth-form">
          <label>
            Correo
            <input name="email" placeholder="tu@correo.org" required type="email" />
          </label>
          <label>
            Contraseña
            <input name="password" placeholder="Tu contraseña" required type="password" />
          </label>
          <button type="submit">Ingresar</button>
        </form>

        {error ? <p className="auth-message">El acceso falló. Verifica tus credenciales.</p> : null}
        {verify ? <p className="auth-message">Revisa tu correo y verifica la cuenta antes de colaborar.</p> : null}
      </section>

      <aside className="auth-aside">
        <div>
          <p className="eyebrow">Antes de publicar</p>
          <h2>Nada entra directo a la capa pública</h2>
          <p>
            Toda observación, corrección o propuesta editorial pasa por revisión. El flujo prioriza
            evidencia, contexto y trazabilidad.
          </p>
        </div>

        <div className="home-step-list">
          <article>
            <strong>Sube evidencia</strong>
            <span>Adjunta archivos, fechas, nombres y notas para cada propuesta.</span>
          </article>
          <article>
            <strong>Sigue la revisión</strong>
            <span>Consulta decisiones, solicitudes de cambio e historial de aportes aprobados.</span>
          </article>
        </div>

        <Link className="pill-link" href="/sign-up">
          Crear cuenta
        </Link>
      </aside>
    </div>
  );
}
