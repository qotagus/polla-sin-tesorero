import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress, parseEther } from "viem";

const CUOTA = parseEther("0.01");

describe("PollaMundial", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [organizador, ana, beto, caro, dani] = await viem.getWalletClients();

  // Despliega una polla y, opcionalmente, inscribe a algunas wallets.
  async function crearPolla(
    porcentajes: number[] = [70, 30],
    inscritos = [ana, beto, caro],
    cuota = CUOTA,
  ) {
    const polla = await viem.deployContract("PollaMundial", [
      "Polla de prueba",
      cuota,
      porcentajes,
    ]);
    for (const w of inscritos) {
      await polla.write.unirseYAportar({ value: cuota, account: w.account });
    }
    return polla;
  }

  async function pollaEnJuego(porcentajes: number[] = [70, 30], inscritos = [ana, beto, caro]) {
    const polla = await crearPolla(porcentajes, inscritos);
    await polla.write.iniciarPolla({ account: inscritos[0].account });
    return polla;
  }

  describe("Creación (reglas fijas)", function () {
    it("guarda nombre, cuota y porcentajes", async function () {
      const polla = await crearPolla([60, 30, 10], []);
      const r = await polla.read.resumen();
      assert.equal(r.nombre, "Polla de prueba");
      assert.equal(r.cuota, CUOTA);
      assert.equal(r.estado, 0); // ABIERTA
      assert.deepEqual(await polla.read.getPorcentajes(), [60, 30, 10]);
      assert.equal(await polla.read.organizador(), getAddress(organizador.account.address));
    });

    it("rechaza porcentajes que no suman 100", async function () {
      await assert.rejects(
        viem.deployContract("PollaMundial", ["Mala", CUOTA, [70, 20]]),
        /Los porcentajes deben sumar 100/,
      );
    });

    it("rechaza un porcentaje en 0 y una cuota en 0", async function () {
      await assert.rejects(
        viem.deployContract("PollaMundial", ["Mala", CUOTA, [100, 0]]),
        /Cada porcentaje debe ser mayor a 0/,
      );
      await assert.rejects(
        viem.deployContract("PollaMundial", ["Mala", 0n, [100]]),
        /La cuota debe ser mayor a 0/,
      );
    });
  });

  describe("1. unirseYAportar", function () {
    it("inscribe con la cuota exacta y suma al pozo", async function () {
      const polla = await crearPolla([70, 30], []);
      await viem.assertions.emitWithArgs(
        polla.write.unirseYAportar({ value: CUOTA, account: ana.account }),
        polla,
        "ParticipanteUnido",
        [getAddress(ana.account.address), CUOTA],
      );
      assert.equal(await polla.read.pozo(), CUOTA);
      assert.equal(await polla.read.esParticipante([ana.account.address]), true);
    });

    it("rechaza un monto distinto a la cuota", async function () {
      const polla = await crearPolla([70, 30], []);
      await viem.assertions.revertWith(
        polla.write.unirseYAportar({ value: CUOTA / 2n, account: ana.account }),
        "Debes depositar exactamente la cuota",
      );
    });

    it("no deja inscribirse dos veces", async function () {
      const polla = await crearPolla([70, 30], [ana]);
      await viem.assertions.revertWith(
        polla.write.unirseYAportar({ value: CUOTA, account: ana.account }),
        "Ya eres participante",
      );
    });
  });

  describe("2. iniciarPolla", function () {
    it("solo un participante puede iniciarla", async function () {
      const polla = await crearPolla();
      await viem.assertions.revertWith(
        polla.write.iniciarPolla({ account: dani.account }),
        "Solo participantes",
      );
    });

    it("exige al menos tantos participantes como lugares premiados", async function () {
      const polla = await crearPolla([50, 30, 20], [ana, beto]);
      await viem.assertions.revertWith(
        polla.write.iniciarPolla({ account: ana.account }),
        "Debe haber al menos tantos participantes como lugares premiados",
      );
    });

    it("bloquea el pozo: nadie más puede entrar", async function () {
      const polla = await pollaEnJuego();
      assert.equal((await polla.read.resumen()).estado, 1); // EN_JUEGO
      await viem.assertions.revertWith(
        polla.write.unirseYAportar({ value: CUOTA, account: dani.account }),
        "Accion no permitida en este estado",
      );
    });
  });

  describe("3. proponerGanadores", function () {
    it("no se puede proponer antes de iniciar", async function () {
      const polla = await crearPolla();
      await viem.assertions.revertWith(
        polla.write.proponerGanadores([[beto.account.address, caro.account.address]], {
          account: ana.account,
        }),
        "Accion no permitida en este estado",
      );
    });

    it("valida cantidad, participantes y repetidos", async function () {
      const polla = await pollaEnJuego();
      await viem.assertions.revertWith(
        polla.write.proponerGanadores([[beto.account.address]], { account: ana.account }),
        "Cantidad de ganadores incorrecta",
      );
      await viem.assertions.revertWith(
        polla.write.proponerGanadores([[beto.account.address, dani.account.address]], {
          account: ana.account,
        }),
        "Un ganador no es participante",
      );
      await viem.assertions.revertWith(
        polla.write.proponerGanadores([[beto.account.address, beto.account.address]], {
          account: ana.account,
        }),
        "Ganador repetido",
      );
    });

    it("proponer cuenta como el voto de quien propone", async function () {
      const polla = await pollaEnJuego();
      await polla.write.proponerGanadores([[beto.account.address, caro.account.address]], {
        account: ana.account,
      });
      const [proponente, ganadores, votos] = await polla.read.getPropuesta([1n]);
      assert.equal(proponente, getAddress(ana.account.address));
      assert.deepEqual(ganadores, [getAddress(beto.account.address), getAddress(caro.account.address)]);
      assert.equal(votos, 1n);
      assert.equal(await polla.read.votoDe([ana.account.address]), 1n);
    });
  });

  describe("4. confirmarResultados y liquidación", function () {
    it("con mayoría paga 70/30 en la misma transacción y cierra la polla", async function () {
      const polla = await pollaEnJuego(); // 3 participantes, pozo 0.03
      await polla.write.proponerGanadores([[beto.account.address, caro.account.address]], {
        account: ana.account,
      }); // 1 de 3: aún no

      const pozo = CUOTA * 3n;
      assert.equal((await polla.read.resumen()).estado, 1); // sigue EN_JUEGO

      const tx = polla.write.confirmarResultados([1n], { account: caro.account }); // 2 de 3: mayoría
      await viem.assertions.balancesHaveChanged(tx, [
        { address: beto.account.address, amount: (pozo * 70n) / 100n },
        { address: caro.account.address, amount: (pozo * 30n) / 100n },
        { address: polla.address, amount: -pozo },
      ]);

      const r = await polla.read.resumen();
      assert.equal(r.estado, 2); // LIQUIDADA
      assert.equal(r.pozo, 0n);
      assert.equal(r.propuestaGanadora, 1n);
      assert.equal(await publicClient.getBalance({ address: polla.address }), 0n);
    });

    it("emite PremioPagado y PollaLiquidada", async function () {
      const polla = await pollaEnJuego();
      await polla.write.proponerGanadores([[beto.account.address, caro.account.address]], {
        account: ana.account,
      });
      const pozo = CUOTA * 3n;
      const hash = await polla.write.confirmarResultados([1n], { account: beto.account });
      await viem.assertions.emitWithArgs(hash, polla, "PollaLiquidada", [1n, pozo]);
      await viem.assertions.emitWithArgs(hash, polla, "PremioPagado", [
        getAddress(beto.account.address),
        1n,
        (pozo * 70n) / 100n,
      ]);
    });

    it("un no participante no puede votar", async function () {
      const polla = await pollaEnJuego();
      await polla.write.proponerGanadores([[beto.account.address, caro.account.address]], {
        account: ana.account,
      });
      await viem.assertions.revertWith(
        polla.write.confirmarResultados([1n], { account: dani.account }),
        "Solo participantes",
      );
    });

    it("no se puede votar dos veces la misma propuesta", async function () {
      const polla = await pollaEnJuego([100], [ana, beto, caro, dani]);
      await polla.write.proponerGanadores([[beto.account.address]], { account: ana.account });
      await viem.assertions.revertWith(
        polla.write.confirmarResultados([1n], { account: ana.account }),
        "Ya apoyas esta propuesta",
      );
    });

    it("con 4 participantes, 2 votos no alcanzan (se necesitan 3)", async function () {
      const polla = await pollaEnJuego([100], [ana, beto, caro, dani]);
      await polla.write.proponerGanadores([[beto.account.address]], { account: ana.account });
      await polla.write.confirmarResultados([1n], { account: beto.account });
      const r = await polla.read.resumen();
      assert.equal(r.estado, 1); // sigue EN_JUEGO
      assert.equal(r.votosNecesarios, 3n);
      await polla.write.confirmarResultados([1n], { account: caro.account });
      assert.equal((await polla.read.resumen()).estado, 2);
    });

    it("un tramposo no puede bloquear: las propuestas compiten y los votos se pueden cambiar", async function () {
      const polla = await pollaEnJuego([100], [ana, beto, caro, dani]);
      // Ana propone la verdad: ganó Beto.
      await polla.write.proponerGanadores([[beto.account.address]], { account: ana.account });
      // Dani hace trampa y se propone a sí mismo (2 propuestas en competencia).
      await polla.write.proponerGanadores([[dani.account.address]], { account: dani.account });
      // Caro se equivoca y apoya la de Dani...
      await polla.write.confirmarResultados([2n], { account: caro.account });
      assert.equal((await polla.read.getPropuesta([2n]))[2], 2n);
      // ...y luego cambia su voto a la verdadera. El voto se mueve, no se duplica.
      await polla.write.confirmarResultados([1n], { account: caro.account });
      assert.equal((await polla.read.getPropuesta([2n]))[2], 1n);
      assert.equal((await polla.read.getPropuesta([1n]))[2], 2n);
      // Beto confirma: 3 de 4, se paga la propuesta verdadera.
      await viem.assertions.balancesHaveChanged(
        polla.write.confirmarResultados([1n], { account: beto.account }),
        [{ address: polla.address, amount: -(CUOTA * 4n) }],
      );
      assert.equal((await polla.read.resumen()).propuestaGanadora, 1n);
    });

    it("reparte todo el pozo aunque los porcentajes no den exacto (sobrante al 1er lugar)", async function () {
      const cuota = 1_000_003n; // monto raro para forzar decimales
      const polla = await crearPolla([50, 30, 20], [ana, beto, caro], cuota);
      await polla.write.iniciarPolla({ account: ana.account });
      const pozo = cuota * 3n;
      await polla.write.proponerGanadores(
        [[caro.account.address, ana.account.address, beto.account.address]],
        { account: ana.account },
      );
      const segundo = (pozo * 30n) / 100n;
      const tercero = (pozo * 20n) / 100n;
      await viem.assertions.balancesHaveChanged(
        polla.write.confirmarResultados([1n], { account: caro.account }),
        [
          { address: caro.account.address, amount: pozo - segundo - tercero },
          { address: polla.address, amount: -pozo },
        ],
      );
      assert.equal(await publicClient.getBalance({ address: polla.address }), 0n);
    });

    it("después de liquidar, todo queda cerrado", async function () {
      const polla = await pollaEnJuego();
      await polla.write.proponerGanadores([[beto.account.address, caro.account.address]], {
        account: ana.account,
      });
      await polla.write.confirmarResultados([1n], { account: beto.account });
      await viem.assertions.revertWith(
        polla.write.proponerGanadores([[ana.account.address, caro.account.address]], {
          account: caro.account,
        }),
        "Accion no permitida en este estado",
      );
      await viem.assertions.revertWith(
        polla.write.confirmarResultados([1n], { account: caro.account }),
        "Accion no permitida en este estado",
      );
    });
  });
});
