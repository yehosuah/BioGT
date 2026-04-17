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
    <div className="detail-layout">
      <section className="detail-panel">
        <p className="eyebrow">Cuenta pública</p>
        <h2>Ingresa para contribuir</h2>
        <form action={signInAction} className="search-form">
          <input name="email" placeholder="Correo" required type="email" />
          <input name="password" placeholder="Contraseña" required type="password" />
          <button type="submit">Ingresar</button>
        </form>
        {error ? <p>El acceso falló. Verifica tus credenciales o tu correo.</p> : null}
        {verify ? <p>Revisa tu correo para verificar la cuenta antes de colaborar.</p> : null}
      </section>

      <aside className="detail-panel">
        <p className="eyebrow">¿Aún no tienes cuenta?</p>
        <h2>Crear perfil de colaborador</h2>
        <p>
          El acceso abre el panel de contribuciones, cargas de evidencia y el
          historial de revisión.
        </p>
        <a className="pill-link" href="/sign-up">
          Crear cuenta
        </a>
      </aside>
    </div>
  );
}
