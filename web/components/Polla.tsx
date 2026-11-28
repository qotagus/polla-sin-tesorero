"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  formatEther,
  type Address,
  type Hash,
} from "viem";
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { avalancheFuji } from "wagmi/chains";

import { Portada } from "@/components/Portada";
import { pollaAbi } from "@/lib/abi";
import { CHAIN_OK, CONTRACT_ADDRESS, SNOWTRACE } from "@/lib/wagmi";

const FUJI = avalancheFuji.id;
const REFRESCO_MS = 4000; // relee el contrato cada 4 s para ver lo que hacen los demás

const ESTADOS = ["Inscripciones abiertas", "En juego", "Pagada"] as const;

// ---------------------------------------------------------------------------
// Utilidades de formato
// ---------------------------------------------------------------------------

function avax(wei: bigint | undefined) {
  if (wei === undefined) return "—";
  return Number(formatEther(wei)).toLocaleString("es-CL", { maximumFractionDigits: 4 });
}

function corta(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function igual(a?: string, b?: string) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

function mensajeError(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk((err) => err instanceof UserRejectedRequestError)) {
      return "Cancelaste la firma en tu wallet. No se envió nada.";
    }
    const revertida = e.walk((err) => err instanceof ContractFunctionRevertedError);
    if (revertida instanceof ContractFunctionRevertedError && revertida.reason) {
      return `El contrato rechazó la acción: ${revertida.reason}.`;
    }
    if (/insufficient funds/i.test(e.message)) {
      return "Tu wallet no tiene AVAX de prueba suficiente. Pide más en un faucet de Fuji.";
    }
    return e.shortMessage;
  }
  return e instanceof Error ? e.message : String(e);
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function Polla() {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  if (!CHAIN_OK) {
    return (
      <Pagina>
        <Aviso tipo="error">
          NEXT_PUBLIC_CHAIN_ID debe ser 43113 (Avalanche Fuji). Corrígelo en las variables de
          entorno y vuelve a publicar.
        </Aviso>
      </Pagina>
    );
  }
  if (!CONTRACT_ADDRESS) {
    return (
      <Pagina>
        <Aviso tipo="error">
          Falta la dirección del contrato. Agrega NEXT_PUBLIC_CONTRACT_ADDRESS (empieza con 0x) en{" "}
          <code>.env.local</code> o en las variables de entorno de Vercel, y vuelve a publicar.
        </Aviso>
      </Pagina>
    );
  }
  // La wallet solo existe en el navegador: esperamos a estar en el cliente para dibujarla.
  if (!montado) return <Pagina cargando />;

  return <App contrato={CONTRACT_ADDRESS} />;
}

function App({ contrato }: { contrato: Address }) {
  const { address: yo, isConnected, chainId } = useConnection();
  const enFuji = chainId === FUJI;

  // ----- Lecturas (gratis) -------------------------------------------------
  const base = { address: contrato, abi: pollaAbi, chainId: FUJI } as const;
  const refresco = { refetchInterval: REFRESCO_MS };

  const resumenQ = useReadContract({ ...base, functionName: "resumen", query: refresco });
  const porcentajesQ = useReadContract({ ...base, functionName: "getPorcentajes" });
  const participantesQ = useReadContract({
    ...base,
    functionName: "getParticipantes",
    query: refresco,
  });

  const r = resumenQ.data;
  const porcentajes = porcentajesQ.data ?? [];
  const participantes = participantesQ.data ?? [];
  const nPropuestas = Number(r?.propuestas ?? 0n);

  const propuestasQ = useReadContracts({
    contracts: Array.from({ length: nPropuestas }, (_, i) => ({
      ...base,
      functionName: "getPropuesta" as const,
      args: [BigInt(i + 1)] as const,
    })),
    query: { ...refresco, enabled: nPropuestas > 0 },
  });

  const votosQ = useReadContracts({
    contracts: participantes.map((p) => ({
      ...base,
      functionName: "votoDe" as const,
      args: [p] as const,
    })),
    query: { ...refresco, enabled: participantes.length > 0 },
  });

  const propuestas = useMemo(
    () =>
      (propuestasQ.data ?? []).flatMap((res, i) =>
        res.status === "success"
          ? [
              {
                id: i + 1,
                proponente: res.result[0],
                ganadores: res.result[1],
                votos: res.result[2],
              },
            ]
          : [],
      ),
    [propuestasQ.data],
  );

  const votoDe = useMemo(() => {
    const m = new Map<string, number>();
    participantes.forEach((p, i) => {
      const res = votosQ.data?.[i];
      if (res?.status === "success") m.set(p.toLowerCase(), Number(res.result));
    });
    return m;
  }, [participantes, votosQ.data]);

  function refrescarTodo() {
    resumenQ.refetch();
    participantesQ.refetch();
    propuestasQ.refetch();
    votosQ.refetch();
  }

  // ----- Escrituras (gastan un poco de AVAX de prueba) --------------------
  const write = useWriteContract();
  const [tx, setTx] = useState<{ etiqueta: string; hash?: Hash } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recibo = useWaitForTransactionReceipt({
    hash: tx?.hash,
    chainId: FUJI,
    query: { enabled: !!tx?.hash },
  });

  useEffect(() => {
    if (recibo.data) {
      if (recibo.data.status === "reverted") setError("La transacción falló en la red.");
      refrescarTodo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recibo.data]);

  const ocupado = (tx !== null && !tx.hash) || (!!tx?.hash && recibo.isLoading);
  const puedeEscribir = isConnected && enFuji && !ocupado;

  async function ejecutar(etiqueta: string, enviar: () => Promise<Hash>) {
    setError(null);
    setTx({ etiqueta });
    try {
      const hash = await enviar();
      setTx({ etiqueta, hash });
    } catch (e) {
      setTx(null);
      setError(mensajeError(e));
    }
  }

  const unirse = () =>
    ejecutar("Unirme a la polla", () =>
      write.mutateAsync({ ...base, functionName: "unirseYAportar", value: r!.cuota }),
    );
  const iniciar = () =>
    ejecutar("Cerrar inscripciones", () =>
      write.mutateAsync({ ...base, functionName: "iniciarPolla" }),
    );
  const proponer = (ganadores: Address[]) =>
    ejecutar("Proponer ganadores", () =>
      write.mutateAsync({ ...base, functionName: "proponerGanadores", args: [ganadores] }),
    );
  const apoyar = (id: number) =>
    ejecutar(`Apoyar la propuesta #${id}`, () =>
      write.mutateAsync({ ...base, functionName: "confirmarResultados", args: [BigInt(id)] }),
    );

  // ----- Derivados para la pantalla ---------------------------------------
  const estado = r?.estado;
  const soyParticipante = participantes.some((p) => igual(p, yo));
  const miVoto = yo ? (votoDe.get(yo.toLowerCase()) ?? 0) : 0;
  const minimo = Math.max(2, porcentajes.length);
  const necesarios = Number(r?.votosNecesarios ?? 0n);
  const totalRepartido = r ? r.cuota * BigInt(participantes.length) : 0n;

  const etapa =
    estado === undefined ? -1 : estado === 0 ? 0 : estado === 2 ? 3 : nPropuestas > 0 ? 2 : 1;

  return (
    <Pagina
      barra={<Wallet conectado={isConnected} yo={yo} />}
      hero={
        <>
          <Portada
            participantes={participantes.length}
            contratoUrl={`${SNOWTRACE}/address/${contrato}`}
          />
          {/* Marcador: lo más importante de un vistazo */}
          <header className="marcador" id="polla">
            <div className="marcador-interior">
              <p className="marcador-nombre">{r?.nombre ?? "Cargando la polla…"}</p>
              <p className="marcador-pozo" aria-label="Pozo actual">
                <span className="marcador-cifra">
                  {avax(estado === 2 ? totalRepartido : r?.pozo)}
                </span>
                <span className="marcador-moneda">AVAX</span>
              </p>
              <p className="marcador-pie">
                {estado === 2
                  ? "repartidos entre los ganadores"
                  : "en el pozo, custodiados por el contrato"}
              </p>
              <dl className="marcador-datos">
                <div>
                  <dt>Estado</dt>
                  <dd>{estado === undefined ? "—" : ESTADOS[estado]}</dd>
                </div>
                <div>
                  <dt>Cuota</dt>
                  <dd>{avax(r?.cuota)} AVAX</dd>
                </div>
                <div>
                  <dt>Reparto</dt>
                  <dd className="reparto">
                    {porcentajes.length === 0
                      ? "—"
                      : porcentajes.map((p, i) => <span key={i}>{`${i + 1}° ${p}%`}</span>)}
                  </dd>
                </div>
                <div>
                  <dt>Participantes</dt>
                  <dd>{participantes.length}</dd>
                </div>
              </dl>
            </div>
          </header>
        </>
      }
      pie={
        <>
          Contrato{" "}
          <a href={`${SNOWTRACE}/address/${contrato}`} target="_blank" rel="noreferrer">
            {corta(contrato)} en Snowtrace
          </a>{" "}
          · Avalanche Fuji (testnet), sin dinero real.
        </>
      }
    >
      <Etapas actual={etapa} />

      {resumenQ.isError && (
        <Aviso tipo="error">
          No pude leer el contrato. Revisa que NEXT_PUBLIC_CONTRACT_ADDRESS sea la dirección
          desplegada en Fuji.
        </Aviso>
      )}

      {isConnected && !enFuji && <CambiarRed />}

      {!isConnected && (
        <Aviso>Conecta tu wallet para participar. Ver la polla no requiere wallet.</Aviso>
      )}

      <Transaccion
        tx={tx}
        confirmada={!!recibo.data && recibo.data.status === "success"}
        error={error}
        onCerrar={() => {
          setTx(null);
          setError(null);
        }}
      />

      {/* ---------- Etapa 1: inscripción ---------- */}
      {estado === 0 && (
        <section className="bloque">
          <h2>Inscripción</h2>
          {!soyParticipante ? (
            <>
              <p>
                Al unirte depositas exactamente {avax(r?.cuota)} AVAX. Las reglas de reparto ya
                están fijas en el contrato: si no te gustan, simplemente no entres.
              </p>
              <button className="boton" disabled={!puedeEscribir || !r} onClick={unirse}>
                Unirme con {avax(r?.cuota)} AVAX
              </button>
            </>
          ) : (
            <>
              <p>
                Ya estás inscrito. Cuando estén todos, cualquier participante cierra la inscripción
                y el pozo queda bloqueado: desde ese momento nadie más entra y nadie puede sacar la
                plata por su cuenta.
              </p>
              <button
                className="boton"
                disabled={!puedeEscribir || participantes.length < minimo}
                onClick={iniciar}
              >
                Cerrar inscripciones y bloquear el pozo
              </button>
              {participantes.length < minimo && (
                <p className="nota">Se necesitan al menos {minimo} participantes.</p>
              )}
            </>
          )}
        </section>
      )}

      {/* ---------- Etapas 2 y 3: proponer y votar ---------- */}
      {estado === 1 && (
        <>
          <section className="bloque">
            <h2>Resultados</h2>
            <p>
              Terminado el torneo, cualquier participante propone a los ganadores. El pozo se paga
              solo cuando {necesarios} de {participantes.length} participantes apoyan la misma
              propuesta.
            </p>
            {propuestas.length === 0 && <p className="nota">Todavía nadie propone ganadores.</p>}
            <ul className="propuestas">
              {propuestas.map((p) => (
                <li key={p.id} className={miVoto === p.id ? "propuesta mia" : "propuesta"}>
                  <div className="propuesta-cabeza">
                    <strong>Propuesta #{p.id}</strong>
                    <span className="nota">
                      de {igual(p.proponente, yo) ? "ti" : corta(p.proponente)}
                    </span>
                  </div>
                  <ol className="podio">
                    {p.ganadores.map((g, i) => (
                      <li key={g}>
                        <span className="podio-lugar">{i + 1}°</span>
                        <span className="dir">{igual(g, yo) ? "Tú" : corta(g)}</span>
                        <span className="podio-monto">
                          {avax(r ? (r.pozo * BigInt(porcentajes[i] ?? 0)) / 100n : undefined)} AVAX
                        </span>
                      </li>
                    ))}
                  </ol>
                  <Penales votos={Number(p.votos)} necesarios={necesarios} />
                  {soyParticipante &&
                    (miVoto === p.id ? (
                      <p className="etiqueta-voto">Tu voto está aquí</p>
                    ) : (
                      <button
                        className="boton secundario"
                        disabled={!puedeEscribir}
                        onClick={() => apoyar(p.id)}
                      >
                        {miVoto ? "Cambiar mi voto a esta" : "Apoyar esta propuesta"}
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          </section>

          {soyParticipante && (
            <Proponer
              participantes={participantes}
              porcentajes={porcentajes}
              yo={yo}
              deshabilitado={!puedeEscribir}
              onProponer={proponer}
            />
          )}
        </>
      )}

      {/* ---------- Etapa 4: pagada ---------- */}
      {estado === 2 && (
        <section className="bloque">
          <h2>Premios pagados</h2>
          <p>
            La propuesta #{Number(r?.propuestaGanadora ?? 0n)} alcanzó la mayoría y el contrato pagó
            en esa misma transacción. Nadie tuvo que pedirle la plata a un tesorero.
          </p>
          <ol className="podio grande">
            {propuestas
              .find((p) => p.id === Number(r?.propuestaGanadora ?? 0n))
              ?.ganadores.map((g, i) => {
                const otros = porcentajes
                  .slice(1)
                  .reduce((s, pct) => s + (totalRepartido * BigInt(pct)) / 100n, 0n);
                const monto =
                  i === 0
                    ? totalRepartido - otros
                    : (totalRepartido * BigInt(porcentajes[i])) / 100n;
                return (
                  <li key={g}>
                    <span className="podio-lugar">{i + 1}°</span>
                    <span className="dir">{igual(g, yo) ? "Tú" : corta(g)}</span>
                    <span className="podio-monto">{avax(monto)} AVAX</span>
                  </li>
                );
              })}
          </ol>
          <a
            className="boton secundario"
            href={`${SNOWTRACE}/address/${contrato}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver los pagos en Snowtrace
          </a>
        </section>
      )}

      {/* ---------- Participantes ---------- */}
      <section className="bloque">
        <h2>Participantes ({participantes.length})</h2>
        {participantes.length === 0 ? (
          <p className="nota">Nadie se ha unido todavía. El primero en entrar abre el pozo.</p>
        ) : (
          <ul className="lista">
            {participantes.map((p) => {
              const v = votoDe.get(p.toLowerCase()) ?? 0;
              return (
                <li key={p}>
                  <span className="dir">
                    {corta(p)}
                    {igual(p, yo) && <span className="tu"> (tú)</span>}
                  </span>
                  {estado === 1 && (
                    <span className="nota">{v ? `apoya la #${v}` : "sin votar"}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Pagina>
  );
}

// ---------------------------------------------------------------------------
// Piezas de la pantalla
// ---------------------------------------------------------------------------

function Pagina({
  children,
  barra,
  hero,
  pie,
  cargando,
}: {
  children?: ReactNode;
  barra?: ReactNode;
  hero?: ReactNode;
  pie?: ReactNode;
  cargando?: boolean;
}) {
  return (
    <div className="pagina">
      <nav className="barra">
        <span className="marca">Polla sin tesorero</span>
        {barra}
      </nav>
      {hero}
      <main className="contenido">{cargando ? <p className="nota">Cargando…</p> : children}</main>
      {pie && <footer className="pie">{pie}</footer>}
    </div>
  );
}

function Wallet({ conectado, yo }: { conectado: boolean; yo?: Address }) {
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();

  if (conectado && yo) {
    return (
      <button className="boton chico secundario" onClick={() => disconnect.mutate()}>
        {corta(yo)} · Desconectar
      </button>
    );
  }

  // Si el navegador anuncia wallets concretas (Core, MetaMask), mostramos esas.
  const concretos = connectors.filter((c) => c.id !== "injected");
  const opciones = concretos.length > 0 ? concretos : connectors;
  const hayWallet = typeof window !== "undefined" && "ethereum" in window;

  if (!hayWallet && concretos.length === 0) {
    return (
      <a className="boton chico" href="https://core.app/" target="_blank" rel="noreferrer">
        Instalar una wallet
      </a>
    );
  }

  return (
    <div className="wallets">
      {opciones.map((c) => (
        <button
          key={c.uid}
          className="boton chico"
          disabled={connect.isPending}
          onClick={() => connect.mutate({ connector: c })}
        >
          Conectar {c.id === "injected" ? "wallet" : c.name}
        </button>
      ))}
    </div>
  );
}

function CambiarRed() {
  const switchChain = useSwitchChain();
  return (
    <Aviso tipo="error">
      <span>Tu wallet está en otra red. Esta polla vive en Avalanche Fuji (Chain ID 43113).</span>
      <button
        className="boton chico"
        disabled={switchChain.isPending}
        onClick={() => switchChain.mutate({ chainId: FUJI })}
      >
        Cambiar a Fuji
      </button>
    </Aviso>
  );
}

const ETAPAS = ["Inscripción", "Pozo bloqueado", "Votación", "Pagado"];

function Etapas({ actual }: { actual: number }) {
  return (
    <ol className="etapas" aria-label="Etapas de la polla">
      {ETAPAS.map((e, i) => (
        <li
          key={e}
          className={i < actual ? "hecha" : i === actual ? "actual" : undefined}
          aria-current={i === actual ? "step" : undefined}
        >
          <span className="etapa-n">{i + 1}</span>
          {e}
        </li>
      ))}
    </ol>
  );
}

/** Los votos se muestran como una tanda de penales: cada gol es un voto. */
function Penales({ votos, necesarios }: { votos: number; necesarios: number }) {
  return (
    <div className="penales">
      <span className="penales-bolas" aria-hidden>
        {Array.from({ length: necesarios }, (_, i) => (
          <span key={i} className={i < votos ? "bola gol" : "bola"} />
        ))}
      </span>
      <span className="nota">
        {votos} de {necesarios} votos necesarios
      </span>
    </div>
  );
}

function Proponer({
  participantes,
  porcentajes,
  yo,
  deshabilitado,
  onProponer,
}: {
  participantes: readonly Address[];
  porcentajes: readonly number[];
  yo?: Address;
  deshabilitado: boolean;
  onProponer: (g: Address[]) => void;
}) {
  const [elegidos, setElegidos] = useState<Record<number, string>>({});
  const valores = porcentajes.map((_, i) => elegidos[i] ?? "");
  const llenos = valores.filter(Boolean);
  const completos = valores.length > 0 && llenos.length === valores.length;
  const repetidos = new Set(llenos).size !== llenos.length;

  return (
    <section className="bloque">
      <h2>Proponer ganadores</h2>
      <p>
        Elige a quién le corresponde cada lugar según la tabla final de la polla. Proponer cuenta
        como tu voto.
      </p>
      <form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          if (completos && !repetidos) onProponer(valores as Address[]);
        }}
      >
        {porcentajes.map((pct, i) => (
          <label key={i} className="campo">
            <span>
              {i + 1}° lugar ({pct}%)
            </span>
            <select
              value={valores[i]}
              onChange={(e) => setElegidos({ ...elegidos, [i]: e.target.value })}
            >
              <option value="">Elige un participante</option>
              {participantes.map((p) => (
                <option key={p} value={p}>
                  {corta(p)}
                  {igual(p, yo) ? " (tú)" : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
        {repetidos && <p className="nota error">Una misma persona no puede ocupar dos lugares.</p>}
        <button className="boton" type="submit" disabled={deshabilitado || !completos || repetidos}>
          Proponer estos ganadores
        </button>
      </form>
    </section>
  );
}

function Transaccion({
  tx,
  confirmada,
  error,
  onCerrar,
}: {
  tx: { etiqueta: string; hash?: Hash } | null;
  confirmada: boolean;
  error: string | null;
  onCerrar: () => void;
}) {
  if (error) {
    return (
      <Aviso tipo="error">
        <span>{error}</span>
        <button className="boton chico secundario" onClick={onCerrar}>
          Entendido
        </button>
      </Aviso>
    );
  }
  if (!tx) return null;
  return (
    <div className={confirmada ? "transaccion ok" : "transaccion"} role="status">
      <p>
        <strong>{tx.etiqueta}:</strong>{" "}
        {!tx.hash
          ? "firma la transacción en tu wallet…"
          : confirmada
            ? "confirmada en la red."
            : "enviada, esperando confirmación…"}
      </p>
      {tx.hash && (
        <p className="hash">
          Hash{" "}
          <a href={`${SNOWTRACE}/tx/${tx.hash}`} target="_blank" rel="noreferrer">
            {tx.hash.slice(0, 10)}…{tx.hash.slice(-8)}
          </a>{" "}
          (ver en Snowtrace)
        </p>
      )}
      {confirmada && (
        <button className="boton chico secundario" onClick={onCerrar}>
          Cerrar
        </button>
      )}
    </div>
  );
}

function Aviso({ children, tipo }: { children: ReactNode; tipo?: "error" }) {
  return <div className={tipo === "error" ? "aviso error" : "aviso"}>{children}</div>;
}
