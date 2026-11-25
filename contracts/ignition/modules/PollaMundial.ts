import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Valores por defecto. Se pueden cambiar con un archivo de parámetros:
//   npx hardhat ignition deploy ignition/modules/PollaMundial.ts --network fuji --parameters ignition/parametros.json
export default buildModule("PollaMundialModule", (m) => {
  const nombre = m.getParameter("nombre", "Polla de los amigos");
  const cuota = m.getParameter("cuota", 10_000_000_000_000_000n); // 0.01 AVAX en wei
  const porcentajes = m.getParameter("porcentajes", [70, 30]); // 1er lugar 70 %, 2do lugar 30 %

  const polla = m.contract("PollaMundial", [nombre, cuota, porcentajes]);

  return { polla };
});
