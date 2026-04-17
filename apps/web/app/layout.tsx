import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: "BioMap Guatemala",
  description:
    "Atlas público de biodiversidad para explorar áreas protegidas, especies y trazabilidad de datos en Guatemala."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <div className="page-chrome">
          <SiteHeader />
          <main>{children}</main>
          <footer className="site-footer">
            <div>
              <strong>BioMap Guatemala</strong>
              <p>
                Atlas público para explorar biodiversidad con geoprivacidad, lectura territorial y
                procedencia visible.
              </p>
            </div>
            <div>
              <span>Modelo público</span>
              <p>Sin coordenadas exactas ni exportaciones de ocurrencias sensibles.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
