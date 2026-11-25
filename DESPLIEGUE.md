# Paso a paso para publicar la Polla sin tesorero

Esta guía cubre lo que tienen que hacer ustedes, porque usa sus wallets y sus cuentas. El código ya está escrito y probado (20 pruebas automáticas en verde).

**Regla de oro:** la clave privada y la frase semilla nunca se pegan en un chat, en el código, en GitHub ni en Vercel.

---

## 0. Antes de empezar

- [ ] Una wallet **solo de pruebas** (Core o MetaMask) con la red **Avalanche Fuji, Chain ID 43113**.
- [ ] AVAX de prueba en esa wallet (con 0,5 AVAX sobra). Faucets: [Avalanche Builder](https://build.avax.network/console/primary-network/faucet) o [QuickNode](https://faucet.quicknode.com/avalanche/fuji).
- [ ] **Tres wallets para la demo**, porque el pozo se paga cuando vota más de la mitad. La forma fácil es una wallet por integrante. Otra opción es crear 3 cuentas en la misma wallet y pasarles unos 0,1 AVAX de prueba desde la principal.

---

## 1. Desplegar el contrato con Remix (recomendado, unos 10 minutos)

Remix funciona en el navegador. Firmas con tu wallet, así que nunca tocas la clave privada.

1. Abre [remix.ethereum.org](https://remix.ethereum.org).
2. En el explorador de archivos crea `PollaMundial.sol` y pega el contenido de `contracts/contracts/PollaMundial.sol`.
3. Pestaña **Solidity Compiler** (ícono "S"):
   - Compiler: **0.8.28**.
   - En **Advanced Configurations**: EVM Version **cancun** y Optimization activada con **200** runs.
   - Presiona **Compile PollaMundial.sol**. Debe aparecer un check verde.
   - *Por qué "cancun":* Avalanche todavía no soporta versiones más nuevas de la EVM. Si Remix compila para "prague", el despliegue puede fallar.
4. Pestaña **Deploy & Run Transactions**:
   - Environment: **Injected Provider** (tu wallet). Acepta la conexión.
   - Confirma que abajo diga **Custom (43113) network**. Si dice 43114, estás en mainnet: cámbiate a Fuji.
   - Contract: **PollaMundial**.
   - Abre la flecha junto a **Deploy** y completa los campos:
     - `_nombre`: `Polla de los amigos` (o el nombre que quieran)
     - `_cuota`: `10000000000000000` (son 0,01 AVAX expresados en wei, la unidad mínima)
     - `_porcentajes`: `[70,30]`
   - Presiona **transact** y confirma en tu wallet.
5. En **Deployed Contracts** aparece el contrato. Copia la dirección (empieza con `0x`) y **guárdala**: va en Vercel, en el README y en el video.
6. Revisa el contrato en `https://testnet.snowtrace.io/address/TU_DIRECCION`. La transacción de creación debe decir **Success**.

### Alternativa: Hardhat en tu computador

Necesitas Node.js 22 o superior. En PowerShell, dentro de la carpeta `contracts`:

```bash
npm install
npx hardhat test                               # 20 pruebas en verde
npx hardhat keystore set FUJI_PRIVATE_KEY      # pega la clave TÚ en la terminal (no en un chat)
npx hardhat ignition deploy ignition/modules/PollaMundial.ts --network fuji
```

El último comando imprime la dirección del contrato. Por defecto crea la polla con 0,01 AVAX de cuota y reparto 70/30. Para cambiarlo, edita los valores en `ignition/modules/PollaMundial.ts`.

### Opcional: verificar el código en Snowtrace

Suma puntos, pero no es obligatorio. En la página del contrato en Snowtrace busca **Verify & Publish**. Elige Solidity single file, compilador v0.8.28, licencia MIT, optimización activada con 200 runs y EVM cancun, y pega el código. Si se complica, sáltalo.

---

## 2. Subir el código a GitHub (repositorio **público**)

Antes de subir, confirma que **no** subes `node_modules`, `.env` ni `.env.local`. Los `.gitignore` ya los excluyen.

Elige una opción:

- **A. Que lo suba Claude:** conecta tu cuenta de GitHub en claude.ai (Settings → Connectors), crea un repositorio público vacío y dile a Claude cómo se llama.
- **B. GitHub Desktop:** File → Add local repository → la carpeta `polla-mundial` → Publish repository, **desmarcando "Keep this code private"**.
- **C. Desde la web:** en github.com, New repository (Public) → "uploading an existing file" → arrastra el **contenido** de la carpeta `polla-mundial` → Commit.

Después completa en el `README.md` la dirección del contrato, el enlace a Snowtrace, la URL de la demo y los nombres del equipo.

---

## 3. Publicar la demo en Vercel

1. Entra a [vercel.com](https://vercel.com) con tu cuenta de GitHub → **Add New → Project** → importa el repositorio.
2. **Root Directory:** `web` (importante).
3. **Environment Variables:**
   - `NEXT_PUBLIC_CONTRACT_ADDRESS` = la dirección del paso 1
   - `NEXT_PUBLIC_CHAIN_ID` = `43113`
4. **Deploy.** Al terminar tendrás `algo.vercel.app`.

Si después vuelves a desplegar el contrato y cambia la dirección, actualiza la variable en Vercel y haz **Redeploy**. Next.js copia las variables a la página al momento de construirla.

---

## 4. Probar la demo de punta a punta (y generar la transacción para el jurado)

Usa el navegador del computador con la extensión de la wallet. En el celular, abre la URL desde el navegador interno de la app Core o MetaMask.

1. **Wallet 1:** Conectar → si aparece el aviso rojo, **Cambiar a Fuji** → **Unirme con 0,01 AVAX**. Bajo el botón aparece el **hash con enlace a Snowtrace**: esa es tu transacción verificable.
2. **Wallets 2 y 3:** Unirme.
3. Cualquiera de las tres: **Cerrar inscripciones y bloquear el pozo**.
4. **Wallet 1:** elige 1° y 2° lugar → **Proponer estos ganadores**. Queda 1 de 2 votos.
5. **Wallet 2:** **Apoyar esta propuesta**. Con 2 de 3 votos el contrato paga solo. El marcador pasa a "Pagada" y en Snowtrace se ven los pagos.

Para cambiar de wallet, cambia la cuenta activa en la extensión. La página se actualiza sola.

**Consejo:** despliega un contrato para ensayar y **otro limpio para el video y para el jurado**. Una polla ya pagada no se puede volver a jugar.

---

## Problemas frecuentes

| Síntoma | Qué hacer |
| --- | --- |
| "insufficient funds" | Pide AVAX en el faucet para *esa* cuenta. |
| Aviso rojo "Tu wallet está en otra red" | Botón **Cambiar a Fuji** (43113, no 43114). |
| "No pude leer el contrato" | La dirección en Vercel está mal o es de otra red. Corrígela y haz Redeploy. |
| "Falta la dirección del contrato" | No agregaste `NEXT_PUBLIC_CONTRACT_ADDRESS` en Vercel (o en `.env.local`). |
| Falla el build en Vercel | Revisa que Root Directory sea `web`. |
| Remix falla al desplegar | Revisa compilador 0.8.28 + EVM cancun, y que la wallet esté en 43113. |
| "El contrato rechazó la acción: ..." | El mensaje explica la regla que no se cumplió (por ejemplo, "Ya eres participante"). |
