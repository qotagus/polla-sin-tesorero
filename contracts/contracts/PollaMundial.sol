// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PollaMundial
/// @notice Tesorería de una polla entre amigos, sin tesorero de confianza.
///         - Las reglas (cuota y porcentajes de premio) se fijan al crear el contrato y nadie puede cambiarlas.
///         - Cada amigo entra depositando exactamente la cuota.
///         - Al terminar el torneo, cualquier participante propone a los ganadores.
///         - El pozo se paga automáticamente apenas MÁS DE LA MITAD de los participantes
///           confirma la misma propuesta. Nadie puede sacar la plata por su cuenta.
contract PollaMundial {
    // ---------------------------------------------------------------------
    // Tipos y constantes
    // ---------------------------------------------------------------------

    /// ABIERTA: se aceptan inscripciones. EN_JUEGO: pozo bloqueado, se vota a los ganadores.
    /// LIQUIDADA: premios pagados, el contrato queda cerrado.
    enum Estado {
        ABIERTA,
        EN_JUEGO,
        LIQUIDADA
    }

    struct Propuesta {
        address proponente;
        address[] ganadores; // ganadores[0] = 1er lugar, ganadores[1] = 2do lugar, ...
        uint256 votos;
    }

    /// Datos generales en una sola lectura (útil para la web).
    struct Resumen {
        string nombre;
        Estado estado;
        uint256 cuota;
        uint256 pozo;
        uint256 participantes;
        uint256 propuestas;
        uint256 votosNecesarios;
        uint256 propuestaGanadora;
    }

    uint256 public constant MIN_PARTICIPANTES = 2;
    uint256 public constant MAX_LUGARES = 10;

    // ---------------------------------------------------------------------
    // Estado
    // ---------------------------------------------------------------------

    string public nombre;
    uint256 public immutable cuota; // en wei (1 AVAX = 10^18 wei)
    address public immutable organizador; // quien desplegó; no tiene ningún poder sobre los fondos

    uint8[] private porcentajes; // porcentajes[0] = % del 1er lugar, etc. Suman 100.

    Estado public estado;
    uint256 public pozo;

    address[] private participantes;
    mapping(address => bool) public esParticipante;

    Propuesta[] private propuestas; // el id de una propuesta es su posición + 1
    mapping(address => uint256) public votoDe; // id de la propuesta que apoya cada participante (0 = ninguna)
    uint256 public propuestaGanadora; // 0 mientras no se liquide

    // ---------------------------------------------------------------------
    // Eventos (quedan registrados en Snowtrace)
    // ---------------------------------------------------------------------

    event PollaCreada(string nombre, uint256 cuota, uint8[] porcentajes, address organizador);
    event ParticipanteUnido(address indexed participante, uint256 pozo);
    event PollaIniciada(address indexed iniciadaPor, uint256 participantes, uint256 pozo);
    event PropuestaCreada(uint256 indexed id, address indexed proponente, address[] ganadores);
    event VotoEmitido(address indexed votante, uint256 indexed id, uint256 votos);
    event PremioPagado(address indexed ganador, uint256 lugar, uint256 monto);
    event PollaLiquidada(uint256 indexed propuestaId, uint256 pozoRepartido);

    // ---------------------------------------------------------------------
    // Modificadores
    // ---------------------------------------------------------------------

    modifier soloParticipante() {
        require(esParticipante[msg.sender], "Solo participantes");
        _;
    }

    modifier enEstado(Estado esperado) {
        require(estado == esperado, "Accion no permitida en este estado");
        _;
    }

    // ---------------------------------------------------------------------
    // Constructor: las reglas quedan fijas para siempre
    // ---------------------------------------------------------------------

    /// @param _nombre Nombre de la polla, por ejemplo "Polla de la oficina".
    /// @param _cuota Monto exacto que debe depositar cada participante, en wei.
    /// @param _porcentajes Reparto del pozo por lugar, por ejemplo [70, 30]. Debe sumar 100.
    constructor(string memory _nombre, uint256 _cuota, uint8[] memory _porcentajes) {
        require(_cuota > 0, "La cuota debe ser mayor a 0");
        require(
            _porcentajes.length > 0 && _porcentajes.length <= MAX_LUGARES,
            "Cantidad de lugares invalida"
        );

        uint256 suma;
        for (uint256 i = 0; i < _porcentajes.length; i++) {
            require(_porcentajes[i] > 0, "Cada porcentaje debe ser mayor a 0");
            suma += _porcentajes[i];
        }
        require(suma == 100, "Los porcentajes deben sumar 100");

        nombre = _nombre;
        cuota = _cuota;
        porcentajes = _porcentajes;
        organizador = msg.sender;
        estado = Estado.ABIERTA;

        emit PollaCreada(_nombre, _cuota, _porcentajes, msg.sender);
    }

    // ---------------------------------------------------------------------
    // 1. Entrar a la polla
    // ---------------------------------------------------------------------

    /// @notice Te inscribe depositando exactamente la cuota.
    function unirseYAportar() external payable enEstado(Estado.ABIERTA) {
        require(!esParticipante[msg.sender], "Ya eres participante");
        require(msg.value == cuota, "Debes depositar exactamente la cuota");

        esParticipante[msg.sender] = true;
        participantes.push(msg.sender);
        pozo += msg.value;

        emit ParticipanteUnido(msg.sender, pozo);
    }

    // ---------------------------------------------------------------------
    // 2. Cerrar inscripciones y bloquear el pozo
    // ---------------------------------------------------------------------

    /// @notice Cualquier participante puede cerrar la inscripción cuando ya están todos.
    function iniciarPolla() external soloParticipante enEstado(Estado.ABIERTA) {
        require(participantes.length >= MIN_PARTICIPANTES, "Faltan participantes");
        require(
            participantes.length >= porcentajes.length,
            "Debe haber al menos tantos participantes como lugares premiados"
        );

        estado = Estado.EN_JUEGO;

        emit PollaIniciada(msg.sender, participantes.length, pozo);
    }

    // ---------------------------------------------------------------------
    // 3. Proponer ganadores (el "oráculo humano")
    // ---------------------------------------------------------------------

    /// @notice Propone a los ganadores en orden (1er lugar primero). Proponer cuenta como tu voto.
    /// @return id Identificador de la nueva propuesta.
    function proponerGanadores(address[] calldata _ganadores)
        external
        soloParticipante
        enEstado(Estado.EN_JUEGO)
        returns (uint256 id)
    {
        require(_ganadores.length == porcentajes.length, "Cantidad de ganadores incorrecta");

        for (uint256 i = 0; i < _ganadores.length; i++) {
            require(esParticipante[_ganadores[i]], "Un ganador no es participante");
            for (uint256 j = 0; j < i; j++) {
                require(_ganadores[i] != _ganadores[j], "Ganador repetido");
            }
        }

        Propuesta storage p = propuestas.push();
        p.proponente = msg.sender;
        p.ganadores = _ganadores;
        id = propuestas.length;

        emit PropuestaCreada(id, msg.sender, _ganadores);

        _votar(id);
    }

    // ---------------------------------------------------------------------
    // 4. Confirmar (votar) una propuesta
    // ---------------------------------------------------------------------

    /// @notice Apoya una propuesta. Cada participante tiene un voto y puede cambiarlo.
    function confirmarResultados(uint256 _id) external soloParticipante enEstado(Estado.EN_JUEGO) {
        require(_id >= 1 && _id <= propuestas.length, "Propuesta inexistente");
        _votar(_id);
    }

    // ---------------------------------------------------------------------
    // Lógica interna
    // ---------------------------------------------------------------------

    function _votar(uint256 _id) internal {
        uint256 anterior = votoDe[msg.sender];
        require(anterior != _id, "Ya apoyas esta propuesta");

        // Si cambia de opinión, su voto se mueve: no hay votos dobles.
        if (anterior != 0) {
            propuestas[anterior - 1].votos -= 1;
        }
        votoDe[msg.sender] = _id;
        propuestas[_id - 1].votos += 1;

        emit VotoEmitido(msg.sender, _id, propuestas[_id - 1].votos);

        _verificarYLiquidar(_id);
    }

    /// Si la propuesta ya tiene mayoría, paga a los ganadores en esta misma transacción.
    function _verificarYLiquidar(uint256 _id) internal {
        Propuesta storage p = propuestas[_id - 1];
        if (p.votos * 2 <= participantes.length) {
            return; // todavía no hay mayoría
        }

        // Efectos primero: el contrato se cierra ANTES de mover plata (protege contra reentrada).
        estado = Estado.LIQUIDADA;
        propuestaGanadora = _id;
        uint256 total = pozo;
        pozo = 0;

        // Calcula los montos. El 1er lugar se queda con los decimales que sobren del redondeo.
        uint256 n = p.ganadores.length;
        uint256[] memory montos = new uint256[](n);
        uint256 repartido;
        for (uint256 i = 1; i < n; i++) {
            montos[i] = (total * porcentajes[i]) / 100;
            repartido += montos[i];
        }
        montos[0] = total - repartido;

        emit PollaLiquidada(_id, total);

        // Interacciones al final: transfiere a cada ganador.
        for (uint256 i = 0; i < n; i++) {
            (bool ok, ) = p.ganadores[i].call{value: montos[i]}("");
            require(ok, "Fallo el pago a un ganador");
            emit PremioPagado(p.ganadores[i], i + 1, montos[i]);
        }
    }

    // ---------------------------------------------------------------------
    // Lecturas (gratis, no gastan gas)
    // ---------------------------------------------------------------------

    function resumen() external view returns (Resumen memory) {
        return Resumen({
            nombre: nombre,
            estado: estado,
            cuota: cuota,
            pozo: pozo,
            participantes: participantes.length,
            propuestas: propuestas.length,
            votosNecesarios: participantes.length / 2 + 1,
            propuestaGanadora: propuestaGanadora
        });
    }

    function getPorcentajes() external view returns (uint8[] memory) {
        return porcentajes;
    }

    function getParticipantes() external view returns (address[] memory) {
        return participantes;
    }

    function totalPropuestas() external view returns (uint256) {
        return propuestas.length;
    }

    function getPropuesta(uint256 _id)
        external
        view
        returns (address proponente, address[] memory ganadores, uint256 votos)
    {
        require(_id >= 1 && _id <= propuestas.length, "Propuesta inexistente");
        Propuesta storage p = propuestas[_id - 1];
        return (p.proponente, p.ganadores, p.votos);
    }
}
