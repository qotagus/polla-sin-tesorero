import { createConfig, http } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { isAddress, type Address } from "viem";

// Red del hackathon: Avalanche Fuji C-Chain (testnet). Mainnet sería 43114.
export const FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
export const SNOWTRACE = "https://testnet.snowtrace.io";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? avalancheFuji.id);
export const CHAIN_OK = CHAIN_ID === avalancheFuji.id;

// La dirección del contrato viene de una variable de entorno, nunca escrita a mano en el código.
const rawAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
export const CONTRACT_ADDRESS: Address | undefined = isAddress(rawAddress)
  ? (rawAddress as Address)
  : undefined;

export const config = createConfig({
  chains: [avalancheFuji],
  // injected() funciona con las extensiones de navegador (Core, MetaMask, Rabby...).
  connectors: [injected()],
  transports: {
    [avalancheFuji.id]: http(FUJI_RPC),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
