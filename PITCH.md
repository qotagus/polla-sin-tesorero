# Guion del video (unos 90 segundos) y preguntas del jurado

## Guion

**1. Problema (10 s)**
"En toda polla alguien guarda la plata. Y ese tesorero se demora en pagar, se equivoca en el reparto o, en el peor caso, desaparece. Todo depende de confiar en una persona."

**2. Solución (15 s)**
"La Polla sin tesorero guarda el pozo en un smart contract en Avalanche. Las reglas se fijan al inicio y el contrato paga solo cuando la mayoría del grupo confirma a los ganadores."

**3. Demo en vivo (40 s)** *(con la polla ya creada y las wallets listas)*
- "Me conecto con mi wallet y me uno depositando 0,01 AVAX." *(mostrar el hash y abrir Snowtrace: Success)*
- "Mis amigos ya entraron. Cerramos la inscripción: el pozo queda bloqueado y nadie lo puede sacar."
- "Terminado el torneo, propongo a los ganadores: 70 % al primero y 30 % al segundo."
- "Un segundo amigo confirma. Con 2 de 3 votos, el contrato paga en la misma transacción." *(mostrar el marcador en "Pagada" y los pagos en Snowtrace)*

**4. Por qué blockchain (10 s)**
"Nadie puede cambiar los porcentajes, sacar la plata o pagarse a sí mismo. Lo garantiza el código, a la vista de todos, sin un intermediario."

**5. Siguientes pasos (10 s)**
"Agregaríamos un plazo con devolución automática si no hay acuerdo, una fábrica para crear muchas pollas desde la misma página y conexión con los resultados oficiales de los partidos."

> Ojo con la fecha: el Mundial 2026 ya se jugó. Presenten la idea como "la polla del próximo Mundial o de cualquier torneo" (Copa América, Champions o la liga del trabajo).

## Consejos para grabar

- Ensayen con un contrato y graben con **otro recién desplegado**.
- Tengan abiertas las 3 cuentas y Snowtrace en otra pestaña antes de grabar.
- Fuji confirma en segundos, pero si algo tarda, corten el video ahí: no hace falta mostrar la espera.

## Preguntas probables del jurado (todo el equipo debería saber responderlas)

**¿Qué hace cada función?**
- `constructor`: crea la polla con nombre, cuota y porcentajes. Revisa que los porcentajes sumen 100. Después nadie los puede cambiar.
- `unirseYAportar`: te inscribe solo si depositas exactamente la cuota y no estabas inscrito.
- `iniciarPolla`: un participante cierra la inscripción. Exige al menos 2 personas y al menos tantas como lugares premiados.
- `proponerGanadores`: un participante propone el podio. Valida que sean participantes, que no se repitan y que la cantidad calce con los lugares. Proponer cuenta como su voto.
- `confirmarResultados`: apoya una propuesta. Cada persona tiene un voto y puede moverlo. Si una propuesta supera la mitad, se paga.
- `_verificarYLiquidar` (interna): calcula los montos, marca la polla como pagada y transfiere. El 1° lugar recibe el sobrante del redondeo, así que el contrato queda en 0.

**¿Qué pasa si alguien propone ganadores falsos?**
Nadie lo apoya. Los demás proponen el resultado correcto y votan por él. Las propuestas compiten entre sí, así que un tramposo no puede bloquear ni reiniciar la votación.

**¿Quién decide el resultado? ¿No hay un oráculo?**
El oráculo es el propio grupo ("oráculo humano"): la mayoría confirma lo que dice la app de la polla. Para un grupo de amigos es suficiente. Una versión más avanzada podría leer resultados oficiales con un oráculo como Chainlink.

**¿Y si nunca se ponen de acuerdo?**
En este prototipo el pozo queda bloqueado. Es una limitación conocida, y la solución es un plazo con devolución automática.

**¿Es seguro?**
Sigue el patrón "verificar, cambiar el estado y recién ahí pagar". La polla se marca como pagada **antes** de transferir, así que nadie puede volver a entrar a mitad del pago. Tiene 20 pruebas automáticas, incluido el caso del tramposo. No está auditado: es un prototipo en testnet.

**¿Por qué Avalanche?**
Confirma en segundos y con comisiones bajas, y la C-Chain es compatible con Ethereum: Solidity, MetaMask y las herramientas de siempre.

**¿El organizador tiene algún poder especial?**
No. Solo paga el despliegue. Cualquier participante puede cerrar la inscripción y nadie, ni siquiera quien creó la polla, puede mover el pozo sin mayoría.
