import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Polla sin tesorero",
  description:
    "El pozo de la polla custodiado por un contrato en Avalanche Fuji: se paga solo cuando la mayoría confirma a los ganadores.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
