(function () {
  "use strict";

  const CATALOGO = window.CATALOGO;
  const CLAVE_ALMACEN = "orden-pedido-motos-v2";
  const CLAVE_ANTERIOR = "orden-pedido-motos-v1";
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MAXIMO = 9999;

  // Destinos del pedido. Para sumar o quitar un dealer, editar esta lista.
  const DESTINOS = [
    { id: "jfk", nombre: "Sucursal Yamaha JFK", columna: "JFK", grupo: "sucursal" },
    { id: "jarabacoa", nombre: "Jarabacoa", columna: "Jarabacoa", grupo: "dealers" },
    { id: "higuey", nombre: "Higüey", columna: "Higüey", grupo: "dealers" },
    { id: "santiago", nombre: "Santiago", columna: "Santiago", grupo: "dealers" },
    { id: "barahona", nombre: "Barahona", columna: "Barahona", grupo: "dealers" },
  ];

  const GRUPOS = [
    { id: "sucursal", nombre: "Sucursal Yamaha JFK", modalidad: "Pedido de sucursal", columna: "Sucursal" },
    { id: "dealers", nombre: "Red de dealers", modalidad: "Preventa", columna: "Dealers · preventa" },
  ];
  for (const grupo of GRUPOS) grupo.destinos = DESTINOS.filter((d) => d.grupo === grupo.id);
  const grupoDe = (destino) => GRUPOS.find((g) => g.id === destino.grupo);
  const DEALERS = GRUPOS.find((g) => g.id === "dealers").destinos;

  // Qué parte del pedido se ve en el panel y se descarga.
  const AMBITOS = [
    { id: "todos", nombre: "Pedido completo", detalle: "todos los destinos", destinos: DESTINOS },
    ...GRUPOS.flatMap((grupo) => {
      if (grupo.destinos.length === 1) {
        const d = grupo.destinos[0];
        return [{ id: d.id, nombre: d.nombre, detalle: grupo.modalidad.toLowerCase(), destinos: [d] }];
      }
      return [
        { id: grupo.id, nombre: grupo.nombre, detalle: grupo.modalidad.toLowerCase(), destinos: grupo.destinos },
        ...grupo.destinos.map((d) => ({ id: d.id, nombre: `Dealer ${d.nombre}`, detalle: grupo.modalidad.toLowerCase(), destinos: [d] })),
      ];
    }),
  ];
  const ambitoPorId = new Map(AMBITOS.map((a) => [a.id, a]));
  const etiquetaAmbito = (ambito) => `${ambito.nombre} (${ambito.detalle})`;

  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------

  function escapar(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function normalizar(texto) {
    return String(texto ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }

  function mesAnio(valor) {
    if (!valor) return "";
    const [anio, mes] = valor.split("-");
    return `${MESES[Number(mes) - 1]} ${anio}`;
  }

  function fechaHoy() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function fechaLegible(iso) {
    if (!iso) return "";
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  }

  function numeroNuevo() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `OP-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function formatoNumero(n) {
    return Number(n).toLocaleString("es-AR");
  }

  function plural(n, uno, varios) {
    return `${formatoNumero(n)} ${n === 1 ? uno : varios}`;
  }

  function textoAnio(anio) {
    return anio ? String(anio) : "Sin año";
  }

  function textoEdicion(lote) {
    return [lote.edicion, ...(lote.extras || [])].filter(Boolean).join(" · ");
  }

  function codigoCompleto(v) {
    return v.variante ? `${v.codigo}-${v.variante}` : v.codigo;
  }

  function nombreArchivo(ambito, extension) {
    const numero = (estado.datos.numero || "pedido").replace(/[^A-Za-z0-9_-]+/g, "-");
    const sufijo = ambito.id === "todos" ? "completo" : normalizar(ambito.nombre).replace(/[^a-z0-9]+/g, "-");
    return `orden-de-pedido-${numero}-${sufijo}.${extension}`;
  }

  const suma = (lista, f) => lista.reduce((s, x) => s + f(x), 0);

  // ---------------------------------------------------------------------------
  // Índices del catálogo
  // ---------------------------------------------------------------------------

  const variantes = new Map();
  let orden = 0;
  for (const familia of CATALOGO.familias) {
    const anios = familia.lotes.map((l) => l.anio).filter(Boolean);
    familia.desde = anios.length ? Math.min(...anios) : null;
    familia.hasta = anios.length ? Math.max(...anios) : null;
    familia.totalColores = suma(familia.lotes, (l) => l.variantes.length);
    for (const lote of familia.lotes) {
      for (const v of lote.variantes) {
        v.busqueda = normalizar(
          [
            familia.nombre,
            familia.modelos.join(" "),
            lote.modelo,
            textoAnio(lote.anio),
            lote.mercado,
            textoEdicion(lote),
            v.codigo,
            v.variante,
            codigoCompleto(v),
            v.colorCodigo,
            v.color,
          ].join(" ")
        );
        variantes.set(v.id, { familia, lote, variante: v, orden: orden++ });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Estado: cantidades[idVariante][idDestino]. Se guarda como borrador en el navegador.
  // ---------------------------------------------------------------------------

  function estadoVacio() {
    return {
      cantidades: {},
      ambito: "todos",
      datos: { numero: numeroNuevo(), fecha: fechaHoy(), cliente: "", solicitante: "", observaciones: "" },
    };
  }

  function leerAlmacen(clave) {
    try {
      return JSON.parse(localStorage.getItem(clave) || "null");
    } catch (error) {
      return null;
    }
  }

  function cargarEstado() {
    const base = estadoVacio();
    const guardado = leerAlmacen(CLAVE_ALMACEN);
    if (guardado && typeof guardado === "object") {
      for (const [id, porDestino] of Object.entries(guardado.cantidades || {})) {
        if (!variantes.has(id) || typeof porDestino !== "object") continue;
        for (const d of DESTINOS) {
          const n = Math.min(MAXIMO, Math.max(0, parseInt(porDestino[d.id], 10) || 0));
          if (n > 0) (base.cantidades[id] ||= {})[d.id] = n;
        }
      }
      if (ambitoPorId.has(guardado.ambito)) base.ambito = guardado.ambito;
      Object.assign(base.datos, guardado.datos || {});
    } else {
      // Del borrador anterior (sin destinos) solo se conservan los datos del encabezado.
      const anterior = leerAlmacen(CLAVE_ANTERIOR);
      if (anterior && anterior.datos) Object.assign(base.datos, anterior.datos);
    }
    return base;
  }

  let temporizadorGuardado = null;
  function guardarYa() {
    clearTimeout(temporizadorGuardado);
    try {
      localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
    } catch (error) {
      /* Sin almacenamiento disponible: el pedido sigue en memoria. */
    }
  }

  function guardar() {
    clearTimeout(temporizadorGuardado);
    temporizadorGuardado = setTimeout(guardarYa, 200);
  }

  window.addEventListener("pagehide", guardarYa);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") guardarYa();
  });

  const estado = cargarEstado();

  function cantidad(id, destinoId) {
    const fila = estado.cantidades[id];
    return (fila && fila[destinoId]) || 0;
  }

  function totalVariante(id, destinos = DESTINOS) {
    return suma(destinos, (d) => cantidad(id, d.id));
  }

  // ---------------------------------------------------------------------------
  // Catálogo
  // ---------------------------------------------------------------------------

  const lista = $("lista-familias");
  const nodosFamilia = new Map();
  const nodosLote = new Map();
  const nodosVariante = new Map();
  document.documentElement.style.setProperty("--destinos", DESTINOS.length);

  function htmlEncabezadoColumnas() {
    const grupos = GRUPOS.filter((g) => g.destinos.length)
      .map((g) => `<span class="col-grupo" data-grupo="${g.id}" style="grid-column: span ${g.destinos.length}" title="${escapar(`${g.nombre} · ${g.modalidad}`)}">${escapar(g.columna)}</span>`)
      .join("");
    const nombres = DESTINOS.map((d) => `<span class="col-nombre" title="${escapar(d.nombre)}">${escapar(d.columna)}</span>`).join("");
    return `
      <div class="encabezado-columnas" aria-hidden="true">
        <span></span>
        <span class="col-color">Color</span>
        <span class="celdas">${grupos}<span></span>${nombres}<span class="col-nombre">Total</span></span>
      </div>`;
  }

  function htmlVariante(familia, lote, v) {
    const muestra = v.muestra
      ? `<span class="muestra" style="background:${escapar(v.muestra)}" title="Muestra aproximada"></span>`
      : `<span class="muestra sin-muestra" title="Sin muestra"></span>`;
    const color = v.sinNombre
      ? `${escapar(v.color)} <span class="sin-nombre">(sin nombre en la planilla)</span>`
      : escapar(v.color);
    const codigos = [v.codigo, v.variante, v.colorCodigo].filter(Boolean).join(" · ");
    const descripcion = `${familia.nombre} ${textoAnio(lote.anio)} ${lote.mercado} ${v.color}`.replace(/\s+/g, " ");
    const celdas = DESTINOS.map(
      (d) => `
          <label class="celda" data-destino="${d.id}" data-grupo="${d.grupo}">
            <span class="celda-etiqueta">${escapar(d.columna)}</span>
            <input type="number" min="0" max="${MAXIMO}" step="1" inputmode="numeric" placeholder="0" data-destino="${d.id}" aria-label="${escapar(`${d.nombre}: ${descripcion}`)}" />
          </label>`
    ).join("");
    return `
      <li class="variante" data-id="${escapar(v.id)}">
        ${muestra}
        <span class="variante-info">
          <span class="variante-color">${color}</span>
          <span class="variante-codigos">${escapar(codigos)}</span>
          ${v.aviso ? `<span class="aviso">${escapar(v.aviso)}</span>` : ""}
        </span>
        <span class="celdas">
          ${celdas}
          <span class="celda celda-total">
            <span class="celda-etiqueta">Total</span>
            <output class="total-fila">0</output>
          </span>
        </span>
      </li>`;
  }

  function htmlLote(familia, lote) {
    const produccion = lote.inicio ? `Producción ${mesAnio(lote.inicio)} – ${mesAnio(lote.fin)}` : "";
    const chips = [lote.edicion, ...(lote.extras || [])]
      .filter(Boolean)
      .map((t) => `<span class="chip">${escapar(t)}</span>`)
      .join("");
    return `
      <section class="lote" data-id="${escapar(lote.id)}">
        <div class="lote-cabecera">
          <span class="lote-anio">${escapar(textoAnio(lote.anio))}</span>
          ${lote.mercado ? `<span class="lote-mercado">${escapar(lote.mercado)}</span>` : ""}
          <span class="lote-modelo">${escapar(lote.modelo)}</span>
          ${produccion ? `<span class="lote-prod">${escapar(produccion)}</span>` : ""}
          ${chips}
        </div>
        ${lote.aviso ? `<span class="aviso">${escapar(lote.aviso)}</span>` : ""}
        ${htmlEncabezadoColumnas()}
        <ul class="variantes">
          ${lote.variantes.map((v) => htmlVariante(familia, lote, v)).join("")}
        </ul>
      </section>`;
  }

  function htmlFamilia(familia) {
    const anios =
      familia.desde && familia.hasta
        ? familia.desde === familia.hasta
          ? String(familia.desde)
          : `${familia.desde}–${familia.hasta}`
        : "Sin año";
    return `
      <summary>
        <span class="familia-flecha" aria-hidden="true"></span>
        <span class="familia-titulo">
          <span class="familia-nombre">${escapar(familia.nombre)}</span>
          <span class="familia-meta">
            <span class="etiqueta">${escapar(familia.categoria)}</span>
            <span class="mono">${escapar(familia.modelos.join(" · "))}</span>
            <span>${escapar(anios)}</span>
            <span>${escapar(plural(familia.totalColores, "color", "colores"))}</span>
          </span>
        </span>
        <span class="familia-cantidad" hidden></span>
      </summary>
      <div class="familia-cuerpo">
        ${familia.lotes.map((lote) => htmlLote(familia, lote)).join("")}
      </div>`;
  }

  function renderCatalogo() {
    const fragmento = document.createDocumentFragment();
    for (const familia of CATALOGO.familias) {
      const nodo = document.createElement("details");
      nodo.className = "familia";
      nodo.dataset.id = familia.id;
      nodo.innerHTML = htmlFamilia(familia);
      nodosFamilia.set(familia.id, nodo);
      fragmento.appendChild(nodo);
    }
    lista.appendChild(fragmento);
    lista.querySelectorAll(".lote").forEach((n) => nodosLote.set(n.dataset.id, n));
    lista.querySelectorAll(".variante").forEach((n) => nodosVariante.set(n.dataset.id, n));

    for (const id of Object.keys(estado.cantidades)) pintarVariante(id);
    for (const familia of CATALOGO.familias) pintarFamilia(familia);
  }

  function pintarVariante(id, salvoDestino) {
    const nodo = nodosVariante.get(id);
    if (!nodo) return;
    for (const d of DESTINOS) {
      const n = cantidad(id, d.id);
      const celda = nodo.querySelector(`.celda[data-destino="${d.id}"]`);
      celda.classList.toggle("con-valor", n > 0);
      if (d.id === salvoDestino) continue;
      const input = celda.querySelector("input");
      const valor = n > 0 ? String(n) : "";
      if (input.value !== valor) input.value = valor;
    }
    const total = totalVariante(id);
    nodo.querySelector(".total-fila").textContent = formatoNumero(total);
    nodo.classList.toggle("con-cantidad", total > 0);
  }

  function pintarFamilia(familia) {
    let total = 0;
    for (const lote of familia.lotes) for (const v of lote.variantes) total += totalVariante(v.id);
    const insignia = nodosFamilia.get(familia.id).querySelector(".familia-cantidad");
    insignia.hidden = total === 0;
    insignia.textContent = `${formatoNumero(total)} u.`;
  }

  function fijarCantidad(id, destinoId, valor, desdeTeclado) {
    const datos = variantes.get(id);
    if (!datos) return;
    const n = Math.min(MAXIMO, Math.max(0, Math.trunc(Number(valor) || 0)));
    const fila = estado.cantidades[id] || {};
    if (n > 0) fila[destinoId] = n;
    else delete fila[destinoId];
    if (Object.keys(fila).length) estado.cantidades[id] = fila;
    else delete estado.cantidades[id];

    pintarVariante(id, desdeTeclado ? destinoId : null);
    pintarFamilia(datos.familia);
    renderPedido();
    guardar();
  }

  lista.addEventListener("input", (evento) => {
    const input = evento.target;
    if (!input.matches(".celda input")) return;
    fijarCantidad(input.closest(".variante").dataset.id, input.dataset.destino, parseInt(input.value, 10) || 0, true);
  });

  lista.addEventListener("change", (evento) => {
    if (!evento.target.matches(".celda input")) return;
    pintarVariante(evento.target.closest(".variante").dataset.id);
  });

  // ---------------------------------------------------------------------------
  // Filtros
  // ---------------------------------------------------------------------------

  const filtros = { texto: "", categoria: "", anio: "", mercado: "", soloCantidad: false };

  function prepararFiltros() {
    const anios = new Set();
    const mercados = new Set();
    let sinAnio = false;
    for (const familia of CATALOGO.familias) {
      for (const lote of familia.lotes) {
        if (lote.anio) anios.add(lote.anio);
        else sinAnio = true;
        if (lote.mercado) mercados.add(lote.mercado);
      }
    }
    const selectorAnio = $("filtro-anio");
    [...anios].sort().forEach((a) => selectorAnio.add(new Option(String(a), String(a))));
    if (sinAnio) selectorAnio.add(new Option("Sin año", "sin"));

    const selectorMercado = $("filtro-mercado");
    [...mercados].sort((a, b) => a.localeCompare(b, "es")).forEach((m) => selectorMercado.add(new Option(m, m)));

    $("marca-sub").textContent = `Motocicletas y cuatriciclos · ${CATALOGO.familias.length} modelos · ${formatoNumero(variantes.size)} colores`;
    $("nombres-dealers").textContent = DEALERS.map((d) => d.nombre).join(", ");
  }

  function hayFiltroDeBusqueda() {
    return Boolean(filtros.texto || filtros.anio || filtros.mercado || filtros.soloCantidad);
  }

  function aplicarFiltros(ajustarApertura) {
    const palabras = normalizar(filtros.texto).split(/\s+/).filter(Boolean);
    const abrir = hayFiltroDeBusqueda();
    let familiasVisibles = 0;
    let coloresVisibles = 0;

    for (const familia of CATALOGO.familias) {
      let familiaVisible = false;
      const categoriaOk = !filtros.categoria || familia.categoria === filtros.categoria;
      for (const lote of familia.lotes) {
        let loteVisible = false;
        const loteOk =
          categoriaOk &&
          (!filtros.anio || (lote.anio ? String(lote.anio) : "sin") === filtros.anio) &&
          (!filtros.mercado || lote.mercado === filtros.mercado);
        for (const v of lote.variantes) {
          const visible =
            loteOk && palabras.every((p) => v.busqueda.includes(p)) && (!filtros.soloCantidad || totalVariante(v.id) > 0);
          nodosVariante.get(v.id).hidden = !visible;
          if (visible) {
            loteVisible = true;
            coloresVisibles++;
          }
        }
        nodosLote.get(lote.id).hidden = !loteVisible;
        if (loteVisible) familiaVisible = true;
      }
      const nodo = nodosFamilia.get(familia.id);
      nodo.hidden = !familiaVisible;
      if (familiaVisible) familiasVisibles++;
      if (ajustarApertura) nodo.open = abrir && familiaVisible;
    }

    $("conteo").textContent = `${plural(familiasVisibles, "modelo", "modelos")} · ${plural(coloresVisibles, "color", "colores")}`;
    $("sin-resultados").hidden = familiasVisibles > 0;
  }

  let temporizadorBusqueda = null;
  $("buscar").addEventListener("input", (evento) => {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(() => {
      filtros.texto = evento.target.value.trim();
      aplicarFiltros(true);
    }, 150);
  });

  document.querySelectorAll(".segmento").forEach((boton) => {
    boton.addEventListener("click", () => {
      document.querySelectorAll(".segmento").forEach((b) => b.classList.toggle("activo", b === boton));
      filtros.categoria = boton.dataset.categoria;
      aplicarFiltros(false);
    });
  });

  $("filtro-anio").addEventListener("change", (e) => {
    filtros.anio = e.target.value;
    aplicarFiltros(true);
  });

  $("filtro-mercado").addEventListener("change", (e) => {
    filtros.mercado = e.target.value;
    aplicarFiltros(true);
  });

  $("solo-cantidad").addEventListener("change", (e) => {
    filtros.soloCantidad = e.target.checked;
    aplicarFiltros(true);
  });

  $("expandir-todo").addEventListener("click", () => {
    nodosFamilia.forEach((nodo) => {
      if (!nodo.hidden) nodo.open = true;
    });
  });

  $("contraer-todo").addEventListener("click", () => {
    nodosFamilia.forEach((nodo) => (nodo.open = false));
  });

  $("quitar-filtros").addEventListener("click", () => {
    Object.assign(filtros, { texto: "", categoria: "", anio: "", mercado: "", soloCantidad: false });
    $("buscar").value = "";
    $("filtro-anio").value = "";
    $("filtro-mercado").value = "";
    $("solo-cantidad").checked = false;
    document.querySelectorAll(".segmento").forEach((b) => b.classList.toggle("activo", b.dataset.categoria === ""));
    aplicarFiltros(true);
  });

  // ---------------------------------------------------------------------------
  // Cálculos del pedido
  // ---------------------------------------------------------------------------

  /** Renglones del pedido dentro de un ámbito, con la cantidad de cada destino. */
  function lineasPedido(ambito) {
    return Object.keys(estado.cantidades)
      .filter((id) => variantes.has(id))
      .map((id) => {
        const por = {};
        for (const d of ambito.destinos) por[d.id] = cantidad(id, d.id);
        return { id, por, total: suma(ambito.destinos, (d) => por[d.id]), ...variantes.get(id) };
      })
      .filter((l) => l.total > 0)
      .sort((a, b) => a.orden - b.orden);
  }

  function agruparPorFamilia(lineas, destinos) {
    const grupos = [];
    for (const linea of lineas) {
      let grupo = grupos[grupos.length - 1];
      if (!grupo || grupo.familia !== linea.familia) {
        grupo = { familia: linea.familia, lineas: [], total: 0, por: Object.fromEntries(destinos.map((d) => [d.id, 0])) };
        grupos.push(grupo);
      }
      grupo.lineas.push(linea);
      grupo.total += linea.total;
      for (const d of destinos) grupo.por[d.id] += linea.por[d.id];
    }
    return grupos;
  }

  /** Grupos de destino con más de un destino que aparecen junto a otros grupos (subtotal "Red de dealers"). */
  function gruposConSubtotal(ambito) {
    const presentes = GRUPOS.filter((g) => g.destinos.some((d) => ambito.destinos.includes(d)));
    if (presentes.length < 2) return [];
    return presentes.filter((g) => g.destinos.length > 1);
  }

  /** Filas del resumen por destino: [destino, modalidad, renglones, unidades] y su tipo. */
  function resumenDestinos(ambito) {
    const lineas = lineasPedido(ambito);
    const subtotales = gruposConSubtotal(ambito);
    const filas = [];
    for (const grupo of GRUPOS) {
      const destinos = grupo.destinos.filter((d) => ambito.destinos.includes(d));
      if (!destinos.length) continue;
      if (subtotales.includes(grupo)) {
        const delGrupo = lineas.filter((l) => destinos.some((d) => l.por[d.id] > 0));
        filas.push({
          tipo: "grupo",
          celdas: [`${grupo.nombre} (subtotal)`, grupo.modalidad, delGrupo.length, suma(delGrupo, (l) => suma(destinos, (d) => l.por[d.id]))],
        });
      }
      for (const d of destinos) {
        const delDestino = lineas.filter((l) => l.por[d.id] > 0);
        filas.push({
          tipo: subtotales.includes(grupo) ? "detalle" : "destino",
          celdas: [d.nombre, grupo.modalidad, delDestino.length, suma(delDestino, (l) => l.por[d.id])],
        });
      }
    }
    return { filas, renglones: lineas.length, unidades: suma(lineas, (l) => l.total) };
  }

  /** Columnas de cantidades para un ámbito: cada destino, subtotales de grupo y total. */
  function columnasCantidad(ambito) {
    const subtotales = gruposConSubtotal(ambito);
    const columnas = ambito.destinos.map((d) => ({ titulo: d.columna, valor: (fila) => fila.por[d.id] }));
    for (const grupo of subtotales) {
      columnas.push({ titulo: `Total ${grupo.nombre.toLowerCase()}`, valor: (fila) => suma(grupo.destinos, (d) => fila.por[d.id] || 0), subtotal: true });
    }
    columnas.push({ titulo: "Total", valor: (fila) => fila.total, total: true });
    return columnas;
  }

  // ---------------------------------------------------------------------------
  // Panel de la orden de pedido
  // ---------------------------------------------------------------------------

  function prepararPanel() {
    const filas = [];
    for (const grupo of GRUPOS) {
      if (!grupo.destinos.length) continue;
      if (grupo.destinos.length === 1) {
        const d = grupo.destinos[0];
        filas.push(`<tr class="fila-grupo" data-grupo="${grupo.id}"><th scope="row">${escapar(d.nombre)}<span class="modalidad">${escapar(grupo.modalidad)}</span></th><td><span data-resumen="${d.id}">0</span> u.</td></tr>`);
      } else {
        filas.push(`<tr class="fila-grupo" data-grupo="${grupo.id}"><th scope="row">${escapar(grupo.nombre)}<span class="modalidad">${escapar(grupo.modalidad)}</span></th><td><span data-resumen="grupo-${grupo.id}">0</span> u.</td></tr>`);
        for (const d of grupo.destinos) {
          filas.push(`<tr class="fila-dealer"><th scope="row">${escapar(d.nombre)}</th><td><span data-resumen="${d.id}">0</span> u.</td></tr>`);
        }
      }
    }
    $("resumen-destinos").innerHTML = filas.join("");

    const selector = $("ambito");
    for (const ambito of AMBITOS) selector.add(new Option(etiquetaAmbito(ambito), ambito.id));
    selector.value = estado.ambito;
  }

  function ambitoActual() {
    return ambitoPorId.get(estado.ambito) || AMBITOS[0];
  }

  function textoAlcance(ambito) {
    if (ambito.id === "todos") return "El PDF y el Excel traen el resumen por destino, el detalle consolidado y el pedido de cada destino por separado.";
    if (ambito.destinos.length > 1) return `El PDF y el Excel traen el resumen de ${ambito.nombre.toLowerCase()}, su detalle consolidado y el pedido de cada uno por separado.`;
    return `El PDF y el Excel traen solo el pedido de ${ambito.destinos[0].nombre}.`;
  }

  function resaltarColumnas(ambito) {
    const activos = new Set(ambito.destinos.map((d) => d.id));
    lista.querySelectorAll(".celda[data-destino]").forEach((celda) => {
      celda.classList.toggle("atenuada", !activos.has(celda.dataset.destino));
    });
  }

  function renderPedido() {
    const completo = lineasPedido(AMBITOS[0]);
    const totalDestino = (d) => suma(completo, (l) => l.por[d.id]);
    for (const d of DESTINOS) document.querySelectorAll(`[data-resumen="${d.id}"]`).forEach((n) => (n.textContent = formatoNumero(totalDestino(d))));
    const totalGrupo = {};
    for (const grupo of GRUPOS) {
      totalGrupo[grupo.id] = suma(grupo.destinos, totalDestino);
      document.querySelectorAll(`[data-resumen="grupo-${grupo.id}"]`).forEach((n) => (n.textContent = formatoNumero(totalGrupo[grupo.id])));
    }
    const total = suma(completo, (l) => l.total);
    $("resumen-total").textContent = formatoNumero(total);
    $("barra-sucursal").textContent = formatoNumero(totalGrupo.sucursal || 0);
    $("barra-dealers").textContent = formatoNumero(totalGrupo.dealers || 0);
    $("barra-total").textContent = formatoNumero(total);
    $("movil-sucursal").textContent = formatoNumero(totalGrupo.sucursal || 0);
    $("movil-dealers").textContent = formatoNumero(totalGrupo.dealers || 0);
    $("movil-total").textContent = formatoNumero(total);

    const ambito = ambitoActual();
    const lineas = lineasPedido(ambito);
    const grupos = agruparPorFamilia(lineas, ambito.destinos);
    $("ambito-nota").textContent = lineas.length
      ? `${plural(lineas.length, "renglón", "renglones")} · ${plural(grupos.length, "modelo", "modelos")} · ${plural(suma(lineas, (l) => l.total), "unidad", "unidades")}. ${textoAlcance(ambito)}`
      : textoAlcance(ambito);
    $("pedido-vacio").hidden = lineas.length > 0;
    $("pedido-vacio").textContent = completo.length
      ? `No hay cantidades cargadas para ${ambito.nombre}.`
      : "Todavía no hay cantidades cargadas. Abrí un modelo del catálogo y escribí la cantidad de cada color en la columna del destino.";

    $("lineas-pedido").innerHTML = grupos
      .map(
        (grupo) => `
        <li>
          <div class="grupo-cabecera">
            <span class="grupo-nombre">${escapar(grupo.familia.nombre)}</span>
            <span class="grupo-total">${escapar(formatoNumero(grupo.total))} u.</span>
          </div>
          <ol class="grupo-lineas">
            ${grupo.lineas
              .map(({ id, por, total: totalLinea, lote, variante }) => {
                const muestra = variante.muestra
                  ? `<span class="muestra chica" style="background:${escapar(variante.muestra)}"></span>`
                  : `<span class="muestra chica sin-muestra"></span>`;
                const detalle = [textoAnio(lote.anio), lote.mercado, textoEdicion(lote)].filter(Boolean).join(" · ");
                const codigos = [codigoCompleto(variante), variante.colorCodigo].filter(Boolean).join(" · ");
                const chips = ambito.destinos
                  .filter((d) => por[d.id] > 0)
                  .map((d) => `<span class="chip-destino" data-grupo="${d.grupo}">${escapar(d.columna)} ${escapar(formatoNumero(por[d.id]))}</span>`)
                  .join("");
                return `
                  <li class="linea">
                    ${muestra}
                    <span class="linea-texto">
                      <strong>${escapar(variante.color)}</strong>
                      <span class="linea-detalle">${escapar(detalle)}</span>
                      <span class="linea-codigos">${escapar(codigos)}</span>
                      <span class="linea-destinos">${chips}</span>
                      <span class="linea-acciones">
                        <button type="button" class="boton-texto" data-ir="${escapar(id)}">Ver en el catálogo</button>
                        <button type="button" class="boton-texto peligro" data-quitar="${escapar(id)}">Quitar</button>
                      </span>
                    </span>
                    <span class="linea-cantidad">${escapar(formatoNumero(totalLinea))}</span>
                  </li>`;
              })
              .join("")}
          </ol>
        </li>`
      )
      .join("");
  }

  $("ambito").addEventListener("change", (e) => {
    estado.ambito = e.target.value;
    resaltarColumnas(ambitoActual());
    renderPedido();
    guardar();
    mostrarEstado("");
  });

  $("lineas-pedido").addEventListener("click", (evento) => {
    const quitar = evento.target.closest("[data-quitar]");
    if (quitar) {
      // Quita solo las cantidades de los destinos que se están viendo.
      const id = quitar.dataset.quitar;
      for (const d of ambitoActual().destinos) fijarCantidad(id, d.id, 0);
      return;
    }
    const ir = evento.target.closest("[data-ir]");
    if (ir) irAVariante(ir.dataset.ir);
  });

  function irAVariante(id) {
    const datos = variantes.get(id);
    const nodo = nodosVariante.get(id);
    if (!datos || !nodo) return;
    if (nodo.hidden) $("quitar-filtros").click();
    nodosFamilia.get(datos.familia.id).open = true;
    cerrarPanelMovil();
    nodo.scrollIntoView({ behavior: "smooth", block: "center" });
    const destino = ambitoActual().destinos.find((d) => cantidad(id, d.id) > 0) || ambitoActual().destinos[0];
    nodo.querySelector(`input[data-destino="${destino.id}"]`).focus({ preventScroll: true });
  }

  // Datos del encabezado del pedido
  const camposDatos = {
    numero: $("numero-pedido"),
    fecha: $("fecha-pedido"),
    cliente: $("cliente"),
    solicitante: $("solicitante"),
    observaciones: $("observaciones"),
  };

  function pintarDatos() {
    for (const [clave, campo] of Object.entries(camposDatos)) campo.value = estado.datos[clave] || "";
  }

  for (const [clave, campo] of Object.entries(camposDatos)) {
    campo.addEventListener("input", () => {
      estado.datos[clave] = campo.value;
      guardar();
    });
  }

  $("datos-pedido").addEventListener("submit", (e) => e.preventDefault());

  // Nuevo pedido con confirmación dentro de la página
  $("nuevo-pedido").addEventListener("click", () => {
    $("confirmar-nuevo").hidden = false;
    $("nuevo-pedido").hidden = true;
  });

  $("confirmar-no").addEventListener("click", () => {
    $("confirmar-nuevo").hidden = true;
    $("nuevo-pedido").hidden = false;
  });

  $("confirmar-si").addEventListener("click", () => {
    const limpio = estadoVacio();
    const ids = Object.keys(estado.cantidades);
    estado.cantidades = limpio.cantidades;
    estado.datos = limpio.datos;
    ids.forEach((id) => pintarVariante(id));
    CATALOGO.familias.forEach(pintarFamilia);
    pintarDatos();
    renderPedido();
    guardar();
    $("confirmar-nuevo").hidden = true;
    $("nuevo-pedido").hidden = false;
    mostrarEstado("Pedido nuevo listo para cargar.");
  });

  // Panel en pantallas angostas
  function cerrarPanelMovil() {
    $("panel-pedido").classList.remove("abierto");
  }

  $("abrir-pedido").addEventListener("click", () => {
    $("panel-pedido").classList.add("abierto");
    $("panel-pedido").scrollTop = 0;
  });

  $("cerrar-pedido").addEventListener("click", cerrarPanelMovil);

  // ---------------------------------------------------------------------------
  // Documentos descargables
  // ---------------------------------------------------------------------------

  const COLUMNAS_DETALLE = ["N.º", "Modelo", "Cód. modelo", "Año", "Mercado", "Edición", "Código", "Var.", "Cód. color", "Color"];

  function valoresDetalle(l, i) {
    return [
      i + 1,
      l.familia.nombre,
      l.lote.modelo,
      l.lote.anio || "Sin año",
      l.lote.mercado || "—",
      textoEdicion(l.lote) || "—",
      l.variante.codigo,
      l.variante.variante || "—",
      l.variante.colorCodigo || "—",
      l.variante.color,
    ];
  }

  // En el PDF la matriz necesita menos columnas de texto para que entren todos los destinos.
  const COLUMNAS_DETALLE_COMPACTO = ["N.º", "Modelo", "Cód. modelo", "Año", "Mercado", "Código", "Cód. color", "Color"];

  function valoresDetalleCompacto(l, i) {
    const edicion = textoEdicion(l.lote);
    return [
      i + 1,
      edicion ? `${l.familia.nombre} · ${edicion}` : l.familia.nombre,
      l.lote.modelo,
      l.lote.anio || "Sin año",
      l.lote.mercado || "—",
      codigoCompleto(l.variante),
      l.variante.colorCodigo || "—",
      l.variante.color,
    ];
  }

  function mostrarEstado(texto, esError) {
    const nodo = $("estado-descarga");
    nodo.textContent = texto;
    nodo.classList.toggle("error", Boolean(esError));
  }

  let descargasPromesa = null;
  function capacidadDescargas() {
    if (!descargasPromesa) {
      descargasPromesa =
        window.claude && typeof window.claude.use === "function"
          ? Promise.resolve(window.claude.use("downloads")).catch(() => null)
          : Promise.resolve(undefined);
    }
    return descargasPromesa;
  }

  async function guardarArchivo(nombre, blob) {
    const descargas = await capacidadDescargas();
    if (descargas) {
      try {
        await descargas.save({ filename: nombre, data: blob });
        return true;
      } catch (error) {
        if (error && error.code === "declined") mostrarEstado("Descarga cancelada.");
        else if (error && error.code === "rate_limited") mostrarEstado("Hay otra descarga esperando confirmación. Probá de nuevo en unos segundos.", true);
        else mostrarEstado("No se pudo guardar el archivo en esta vista. Abrí la página en un navegador de escritorio.", true);
        return false;
      }
    }
    if (descargas === null) {
      mostrarEstado("Esta vista no permite descargar archivos. Abrí la página en un navegador.", true);
      return false;
    }
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  }

  // --- PDF -------------------------------------------------------------------

  const TINTA = [20, 22, 27];
  const GRIS = [90, 97, 112];
  const AZUL = [31, 72, 199];
  const COLOR_GRUPO = { sucursal: [11, 114, 104], dealers: [106, 50, 201] };
  const FONDO_PIE = [241, 243, 246];

  function estiloTabla(extra) {
    return Object.assign(
      {
        theme: "grid",
        margin: { left: 12, right: 12, bottom: 16, top: 16 },
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.4, lineColor: [221, 225, 232], lineWidth: 0.2, textColor: TINTA, overflow: "linebreak" },
        headStyles: { fillColor: AZUL, textColor: 255, fontStyle: "bold" },
        footStyles: { fillColor: FONDO_PIE, textColor: TINTA, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 249, 251] },
      },
      extra
    );
  }

  function generarPdf(ambito) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const ancho = doc.internal.pageSize.getWidth();
    const alto = doc.internal.pageSize.getHeight();
    const M = 12;
    const datos = estado.datos;
    const lineas = lineasPedido(ambito);
    const resumen = resumenDestinos(ambito);
    const varios = ambito.destinos.length > 1;
    let y = 0;

    const espacio = (necesario) => {
      if (y + necesario > alto - 18) {
        doc.addPage();
        y = 18;
      }
    };
    const titulo = (texto, color, tamano) => {
      espacio(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(tamano || 11);
      doc.setTextColor(...(color || TINTA));
      doc.text(texto, M, y);
      doc.setTextColor(...TINTA);
      y += 3;
    };
    const tabla = (opciones) => {
      doc.autoTable(estiloTabla(Object.assign({ startY: y }, opciones)));
      y = doc.lastAutoTable.finalY + 9;
    };

    // Encabezado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("ORDEN DE PEDIDO", M, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GRIS);
    doc.text(`Motocicletas y cuatriciclos · ${etiquetaAmbito(ambito)}`, M, 24);
    doc.setTextColor(...TINTA);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`N.º ${datos.numero || "—"}`, ancho - M, 18, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Fecha: ${fechaLegible(datos.fecha) || "—"}`, ancho - M, 24, { align: "right" });
    doc.setDrawColor(...TINTA);
    doc.setLineWidth(0.6);
    doc.line(M, 28, ancho - M, 28);

    const datosCabecera = [
      ["Empresa", datos.cliente || "—"],
      ["Solicitado por", datos.solicitante || "—"],
    ];
    if (varios) {
      for (const fila of resumen.filas.filter((f) => f.tipo !== "detalle")) datosCabecera.push([fila.celdas[0].replace(" (subtotal)", ""), `${formatoNumero(fila.celdas[3])} u.`]);
      datosCabecera.push([ambito.id === "todos" ? "Total del pedido" : `Total ${ambito.nombre.toLowerCase()}`, `${formatoNumero(resumen.unidades)} u.`]);
    } else {
      const d = ambito.destinos[0];
      datosCabecera.push(["Destino", `${d.nombre} · ${grupoDe(d).modalidad}`]);
      datosCabecera.push(["Total de unidades", `${formatoNumero(resumen.unidades)} u.`]);
    }
    const anchoDato = (ancho - M * 2) / datosCabecera.length;
    datosCabecera.forEach(([etiqueta, valor], i) => {
      const x = M + anchoDato * i;
      doc.setFontSize(7.5);
      doc.setTextColor(...GRIS);
      doc.text(etiqueta.toUpperCase(), x, 34);
      doc.setFontSize(10.5);
      doc.setTextColor(...TINTA);
      doc.setFont("helvetica", i >= 2 ? "bold" : "normal");
      doc.text(doc.splitTextToSize(String(valor), anchoDato - 3)[0], x, 40);
      doc.setFont("helvetica", "normal");
    });
    y = 50;

    if (varios) {
      // Resumen por destino
      titulo("Resumen por destino");
      tabla({
        head: [["Destino", "Modalidad", "Renglones", "Unidades"]],
        body: resumen.filas.map((f) => {
          const celdas = f.celdas.map((c, i) => (i >= 2 ? formatoNumero(c) : c));
          if (f.tipo === "detalle") celdas[0] = `    ${celdas[0]}`;
          if (f.tipo === "grupo") return celdas.map((content) => ({ content, styles: { fontStyle: "bold" } }));
          return celdas;
        }),
        foot: [[ambito.id === "todos" ? "Total del pedido" : `Total ${ambito.nombre.toLowerCase()}`, "", formatoNumero(resumen.renglones), formatoNumero(resumen.unidades)]],
        tableWidth: 150,
        columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
        footStyles: { fillColor: FONDO_PIE, textColor: TINTA, fontStyle: "bold", halign: "right" },
      });

      // Resumen por modelo y destino
      const columnas = columnasCantidad(ambito);
      const grupos = agruparPorFamilia(lineas, ambito.destinos);
      const totalesPorColumna = columnas.map((c) => suma(grupos, (g) => c.valor(g)));
      titulo("Resumen por modelo");
      tabla({
        head: [["Modelo", ...columnas.map((c) => c.titulo)]],
        body: grupos.map((g) => [g.familia.nombre, ...columnas.map((c) => formatoNumero(c.valor(g)))]),
        foot: [["Total", ...totalesPorColumna.map(formatoNumero)]],
        columnStyles: Object.fromEntries(columnas.map((c, i) => [i + 1, { halign: "right", fontStyle: c.total || c.subtotal ? "bold" : "normal" }])),
        footStyles: { fillColor: FONDO_PIE, textColor: TINTA, fontStyle: "bold", halign: "right" },
      });

      // Detalle consolidado con una columna por destino
      doc.addPage();
      y = 18;
      titulo(ambito.id === "todos" ? "Detalle consolidado de todos los destinos" : `Detalle consolidado · ${ambito.nombre}`, null, 12);
      tabla({
        head: [[...COLUMNAS_DETALLE_COMPACTO, ...columnas.map((c) => c.titulo)]],
        body: lineas.map((l, i) => [...valoresDetalleCompacto(l, i), ...columnas.map((c) => (c.valor(l) ? formatoNumero(c.valor(l)) : "—"))]),
        foot: [[{ content: "Totales", colSpan: COLUMNAS_DETALLE_COMPACTO.length, styles: { halign: "right" } }, ...totalesPorColumna.map(formatoNumero)]],
        styles: { font: "helvetica", fontSize: 7, cellPadding: 1.2, lineColor: [221, 225, 232], lineWidth: 0.2, textColor: TINTA },
        columnStyles: Object.assign(
          { 0: { halign: "right", cellWidth: 8 }, 3: { cellWidth: 11 } },
          Object.fromEntries(columnas.map((c, i) => [COLUMNAS_DETALLE_COMPACTO.length + i, { halign: "right", cellWidth: 15, fontStyle: c.total || c.subtotal ? "bold" : "normal" }]))
        ),
        footStyles: { fillColor: FONDO_PIE, textColor: TINTA, fontStyle: "bold", halign: "right" },
      });
    }

    // Pedido de cada destino por separado
    for (const grupo of GRUPOS) {
      const destinos = grupo.destinos.filter((d) => ambito.destinos.includes(d));
      if (!destinos.length) continue;
      if (varios) {
        doc.addPage();
        y = 18;
        const unidadesGrupo = suma(lineas, (l) => suma(destinos, (d) => l.por[d.id]));
        titulo(`${grupo.nombre} · ${grupo.modalidad.toLowerCase()} · ${formatoNumero(unidadesGrupo)} u.`, COLOR_GRUPO[grupo.id], 13);
        y += 4;
      }
      for (const d of destinos) {
        const propias = lineasPedido(ambitoPorId.get(d.id));
        if (varios && destinos.length > 1) {
          titulo(`${d.nombre} · ${formatoNumero(suma(propias, (l) => l.total))} u.`, COLOR_GRUPO[grupo.id]);
        }
        if (!propias.length) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(...GRIS);
          doc.text("Sin unidades pedidas.", M, y + 3);
          doc.setTextColor(...TINTA);
          y += 12;
          continue;
        }
        tabla({
          head: [[...COLUMNAS_DETALLE, "Cant."]],
          body: propias.map((l, i) => [...valoresDetalle(l, i), formatoNumero(l.total)]),
          foot: [[{ content: `Total ${d.nombre}`, colSpan: COLUMNAS_DETALLE.length, styles: { halign: "right" } }, formatoNumero(suma(propias, (l) => l.total))]],
          headStyles: { fillColor: COLOR_GRUPO[grupo.id], textColor: 255, fontStyle: "bold" },
          columnStyles: { 0: { halign: "right", cellWidth: 8 }, 3: { cellWidth: 12 }, 7: { cellWidth: 10 }, [COLUMNAS_DETALLE.length]: { halign: "right", cellWidth: 13, fontStyle: "bold" } },
          footStyles: { fillColor: FONDO_PIE, textColor: TINTA, fontStyle: "bold", halign: "right" },
        });
      }
    }

    // Observaciones y firmas
    if (datos.observaciones && datos.observaciones.trim()) {
      const texto = doc.splitTextToSize(datos.observaciones.trim(), ancho - M * 2);
      espacio(12 + texto.length * 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Observaciones", M, y);
      doc.setFont("helvetica", "normal");
      doc.text(texto, M, y + 6);
      y += 10 + texto.length * 5;
    }
    espacio(30);
    y += 16;
    doc.setDrawColor(...GRIS);
    doc.setLineWidth(0.3);
    const firma = 80;
    doc.line(M, y, M + firma, y);
    doc.line(ancho - M - firma, y, ancho - M, y);
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text("Firma y aclaración del solicitante", M, y + 5);
    doc.text("Firma y aclaración de aprobación", ancho - M - firma, y + 5);

    const paginas = doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...GRIS);
      doc.text(`${datos.numero || ""} · ${ambito.nombre}`, M, alto - 8);
      doc.text(`Página ${i} de ${paginas}`, ancho - M, alto - 8, { align: "right" });
    }

    return doc.output("blob");
  }

  // --- Excel -----------------------------------------------------------------

  function nombreHoja(texto, usadas) {
    let nombre = texto.replace(/[:\\/?*[\]]/g, " ").slice(0, 31);
    let n = 2;
    while (usadas.has(nombre)) nombre = `${texto.slice(0, 28)} ${n++}`;
    usadas.add(nombre);
    return nombre;
  }

  function generarExcel(ambito) {
    const datos = estado.datos;
    const lineas = lineasPedido(ambito);
    const resumen = resumenDestinos(ambito);
    const columnas = columnasCantidad(ambito);
    const grupos = agruparPorFamilia(lineas, ambito.destinos);
    const totalesPorColumna = columnas.map((c) => suma(grupos, (g) => c.valor(g)));
    const etiquetaTotal = ambito.id === "todos" ? "Total del pedido" : `Total ${ambito.nombre.toLowerCase()}`;
    const libro = XLSX.utils.book_new();
    const usadas = new Set();

    // Hoja de resumen
    const filas = [
      ["ORDEN DE PEDIDO"],
      ["Alcance", etiquetaAmbito(ambito)],
      [],
      ["N.º de pedido", datos.numero || ""],
      ["Fecha", fechaLegible(datos.fecha)],
      ["Empresa", datos.cliente || ""],
      ["Solicitado por", datos.solicitante || ""],
      ["Observaciones", datos.observaciones || ""],
      [],
      ["UNIDADES POR DESTINO"],
      ["Destino", "Modalidad", "Renglones", "Unidades"],
      ...resumen.filas.map((f) => (f.tipo === "detalle" ? [`   ${f.celdas[0]}`, ...f.celdas.slice(1)] : f.celdas)),
      [etiquetaTotal, "", resumen.renglones, resumen.unidades],
      [],
      ["UNIDADES POR MODELO"],
      ["Modelo", ...columnas.map((c) => c.titulo)],
      ...grupos.map((g) => [g.familia.nombre, ...columnas.map((c) => c.valor(g))]),
      ["Total", ...totalesPorColumna],
    ];
    const hojaResumen = XLSX.utils.aoa_to_sheet(filas);
    hojaResumen["!cols"] = [{ wch: 30 }, { wch: 20 }, ...columnas.map(() => ({ wch: 14 }))];
    XLSX.utils.book_append_sheet(libro, hojaResumen, nombreHoja("Resumen", usadas));

    // Detalle consolidado
    if (ambito.destinos.length > 1) {
      const hoja = XLSX.utils.aoa_to_sheet([
        [...COLUMNAS_DETALLE, ...columnas.map((c) => c.titulo)],
        ...lineas.map((l, i) => [...valoresDetalle(l, i), ...columnas.map((c) => c.valor(l))]),
        [],
        [...Array(COLUMNAS_DETALLE.length - 1).fill(""), "Totales", ...totalesPorColumna],
      ]);
      hoja["!cols"] = [6, 16, 14, 8, 22, 24, 10, 7, 10, 36].map((wch) => ({ wch })).concat(columnas.map(() => ({ wch: 13 })));
      XLSX.utils.book_append_sheet(libro, hoja, nombreHoja(ambito.id === "todos" ? "Consolidado" : `Consolidado ${ambito.nombre}`, usadas));
    }

    // Una hoja por destino
    for (const d of ambito.destinos) {
      const propias = lineasPedido(ambitoPorId.get(d.id));
      const hoja = XLSX.utils.aoa_to_sheet([
        [`${d.nombre} · ${grupoDe(d).modalidad}`],
        [],
        [...COLUMNAS_DETALLE, "Cantidad"],
        ...propias.map((l, i) => [...valoresDetalle(l, i), l.total]),
        [],
        [...Array(COLUMNAS_DETALLE.length - 1).fill(""), `Total ${d.nombre}`, suma(propias, (l) => l.total)],
      ]);
      hoja["!cols"] = [6, 16, 14, 8, 22, 24, 10, 7, 10, 36, 10].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(libro, hoja, nombreHoja(d.nombre, usadas));
    }

    const contenido = XLSX.write(libro, { bookType: "xlsx", type: "array" });
    return new Blob([contenido], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function validarPedido(ambito) {
    if (!lineasPedido(ambito).length) {
      mostrarEstado(
        ambito.id === "todos"
          ? "Cargá al menos una cantidad para generar la orden de pedido."
          : `No hay cantidades cargadas para ${ambito.nombre}. Elegí otro destino en «Ver y descargar» o cargá cantidades en su columna.`,
        true
      );
      return false;
    }
    return true;
  }

  $("descargar-pdf").addEventListener("click", async () => {
    const ambito = ambitoActual();
    if (!validarPedido(ambito)) return;
    if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.API.autoTable) {
      mostrarEstado("No se pudo cargar el generador de PDF. Revisá la conexión a internet y recargá la página.", true);
      return;
    }
    mostrarEstado("Generando PDF…");
    const nombre = nombreArchivo(ambito, "pdf");
    if (await guardarArchivo(nombre, generarPdf(ambito))) mostrarEstado(`Listo: ${nombre}`);
  });

  $("descargar-excel").addEventListener("click", async () => {
    const ambito = ambitoActual();
    if (!validarPedido(ambito)) return;
    if (!window.XLSX) {
      mostrarEstado("No se pudo cargar el generador de Excel. Revisá la conexión a internet y recargá la página.", true);
      return;
    }
    mostrarEstado("Generando Excel…");
    const nombre = nombreArchivo(ambito, "xlsx");
    if (await guardarArchivo(nombre, generarExcel(ambito))) mostrarEstado(`Listo: ${nombre}`);
  });

  // ---------------------------------------------------------------------------
  // Observaciones sobre la planilla
  // ---------------------------------------------------------------------------

  function renderAvisos() {
    $("cantidad-avisos").textContent = CATALOGO.avisos.length;
    $("lista-avisos").innerHTML = CATALOGO.avisos
      .map((a) => `<li><span class="mono">${escapar(a.archivo)}:${escapar(a.linea)}</span> — ${escapar(a.texto)}</li>`)
      .join("");
  }

  // ---------------------------------------------------------------------------
  // Inicio
  // ---------------------------------------------------------------------------

  prepararFiltros();
  prepararPanel();
  renderCatalogo();
  pintarDatos();
  resaltarColumnas(ambitoActual());
  renderPedido();
  renderAvisos();
  aplicarFiltros(false);
  setTimeout(capacidadDescargas, 0);
})();
