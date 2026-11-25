import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: {
    version: "0.8.28",
    settings: {
      // Avalanche C-Chain implementa el fork "Cancun" de Ethereum (no Pectra/Prague).
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    fuji: {
      type: "http",
      chainType: "l1",
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      // La clave privada NUNCA se escribe aquí: se guarda con
      //   npx hardhat keystore set FUJI_PRIVATE_KEY
      accounts: [configVariable("FUJI_PRIVATE_KEY")],
    },
  },
});
