"use client";

import { PretextTitle } from "@/components/pretext-title";

export function PretextHero({
  title,
  kicker,
  body
}: {
  title: string;
  kicker: string;
  body: string;
}) {
  return (
    <section className="hero-shell">
      <div className="hero-copy">
        <p className="hero-kicker">{kicker}</p>
        <PretextTitle
          as="h1"
          className="pretext-headline"
          font='600 70px "Fraunces"'
          lineHeight={78}
          text={title}
        />
        <p className="hero-body">{body}</p>
      </div>
      <div className="hero-orbit">
        <div className="orbit-card">
          <strong>Mapa primero</strong>
          <span>Explora departamentos, áreas protegidas y celdas públicas desde una sola superficie.</span>
        </div>
        <div className="orbit-card orbit-card-secondary">
          <strong>Visuales y contexto</strong>
          <span>Las especies combinan fotos o fallback gráfico, quick facts y procedencia visible.</span>
        </div>
      </div>
    </section>
  );
}
