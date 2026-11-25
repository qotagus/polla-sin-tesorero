// ABI del contrato PollaMundial (copiado de contracts/artifacts después de compilar).
// Si cambias el contrato, vuelve a copiarlo.
export const pollaAbi = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_nombre",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "_cuota",
        "type": "uint256"
      },
      {
        "internalType": "uint8[]",
        "name": "_porcentajes",
        "type": "uint8[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "participante",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "pozo",
        "type": "uint256"
      }
    ],
    "name": "ParticipanteUnido",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "nombre",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "cuota",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint8[]",
        "name": "porcentajes",
        "type": "uint8[]"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "organizador",
        "type": "address"
      }
    ],
    "name": "PollaCreada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "iniciadaPor",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "participantes",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "pozo",
        "type": "uint256"
      }
    ],
    "name": "PollaIniciada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "propuestaId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "pozoRepartido",
        "type": "uint256"
      }
    ],
    "name": "PollaLiquidada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "ganador",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "lugar",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "monto",
        "type": "uint256"
      }
    ],
    "name": "PremioPagado",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "proponente",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address[]",
        "name": "ganadores",
        "type": "address[]"
      }
    ],
    "name": "PropuestaCreada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "votante",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "votos",
        "type": "uint256"
      }
    ],
    "name": "VotoEmitido",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAX_LUGARES",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_PARTICIPANTES",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_id",
        "type": "uint256"
      }
    ],
    "name": "confirmarResultados",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "cuota",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "esParticipante",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "estado",
    "outputs": [
      {
        "internalType": "enum PollaMundial.Estado",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getParticipantes",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPorcentajes",
    "outputs": [
      {
        "internalType": "uint8[]",
        "name": "",
        "type": "uint8[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_id",
        "type": "uint256"
      }
    ],
    "name": "getPropuesta",
    "outputs": [
      {
        "internalType": "address",
        "name": "proponente",
        "type": "address"
      },
      {
        "internalType": "address[]",
        "name": "ganadores",
        "type": "address[]"
      },
      {
        "internalType": "uint256",
        "name": "votos",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "iniciarPolla",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nombre",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "organizador",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pozo",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "_ganadores",
        "type": "address[]"
      }
    ],
    "name": "proponerGanadores",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "propuestaGanadora",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "resumen",
    "outputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "nombre",
            "type": "string"
          },
          {
            "internalType": "enum PollaMundial.Estado",
            "name": "estado",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "cuota",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "pozo",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "participantes",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "propuestas",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "votosNecesarios",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "propuestaGanadora",
            "type": "uint256"
          }
        ],
        "internalType": "struct PollaMundial.Resumen",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalPropuestas",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unirseYAportar",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "votoDe",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
