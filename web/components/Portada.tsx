"use client";

import { useEffect, useRef } from "react";

import type { Escena } from "./escena3d";

/**
 * Portada: cancha en 3D con el pozo como torre de monedas (una por participante).
 * La escena se carga aparte; si el navegador no tiene WebGL, queda un fondo de cancha en CSS.
 */
export function Portada({
  participantes,
  contratoUrl,
}: {
  participantes: number;
  contratoUrl: string;
}) {
  const lienzo = useRef<HTMLDivElement>(null);
  const escena = useRef<Escena | null>(null);
  const ultimo = useRef(participantes);
  ultimo.current = participantes;

  useEffect(() => {
    let cancelado = false;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("./escena3d").then(({ montarEscena }) => {
      if (cancelado || !lienzo.current) return;
      escena.current = montarEscena(lienzo.current, { monedas: ultimo.current, reducido });
      if (escena.current) lienzo.current.dataset.listo = "1";
    });
    return () => {
      cancelado = true;
      escena.current?.destruir();
      escena.current = null;
    };
  }, []);

  useEffect(() => {
    escena.current?.setMonedas(participantes);
  }, [participantes]);

  return (
    <section className="portada" aria-labelledby="portada-titulo">
      <div className="portada-lienzo" ref={lienzo} />
      <div className="portada-texto">
        <h1 id="portada-titulo">Polla sin tesorero</h1>
        <p className="portada-bajada">
          El pozo de la polla queda guardado en un contrato de Avalanche. Las reglas se fijan antes
          de jugar y el premio se paga solo cuando la mayoría confirma a los ganadores.
        </p>
        <div className="portada-acciones">
          <a className="boton portada-cta" href="#polla">
            Entrar a la polla
          </a>
          <a className="portada-enlace" href={contratoUrl} target="_blank" rel="noreferrer">
            Ver el contrato en Snowtrace
          </a>
        </div>
      </div>
      <p className="portada-leyenda" aria-live="polite">
        {participantes === 0
          ? "El pozo está vacío: la primera moneda la pone el primero que se une."
          : `${participantes} ${participantes === 1 ? "moneda" : "monedas"} en el pozo, una por participante.`}
      </p>
    </section>
  );
}
