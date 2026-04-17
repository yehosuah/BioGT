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
    <div className="detail-layout">
      <section className="detail-panel">
        <p className="eyebrow">Registro</p>
        <h2>Crear cuenta con correo verificado</h2>
        <form action={signUpAction} className="search-form">
          <input name="name" placeholder="Nombre público" required />
          <input name="email" placeholder="Correo" required type="email" />
          <input name="password" placeholder="Contraseña" required type="password" />
          <button type="submit">Crear cuenta</button>
        </form>
        {error ? <p>No se pudo crear la cuenta. Intenta con otro correo.</p> : null}
      </section>

      <aside className="detail-panel">
        <p className="eyebrow">Moderación obligatoria</p>
        <h2>Nada se publica automáticamente</h2>
        <p>
          Todas las observaciones, correcciones y sugerencias pasan por revisión
          antes de afectar la capa pública.
        </p>
      </aside>
    </div>
  );
}
