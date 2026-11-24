(function () {
  "use strict";

  const CATALOGO = window.CATALOGO;
  const CLAVE_ALMACEN = "orden-pedido-motos-v1";
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MAXIMO = 9999;

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

  function nombreArchivo(extension) {
    const numero = (estado.datos.numero || "pedido").replace(/[^A-Za-z0-9_-]+/g, "-");
    return `orden-de-pedido-${numero}.${extension}`;
  }

  // ---------------------------------------------------------------------------
  // Índices del catálogo
  // ---------------------------------------------------------------------------

  const variantes = new Map();
  let orden = 0;
  for (const familia of CATALOGO.familias) {
    const anios = familia.lotes.map((l) => l.anio).filter(Boolean);
    familia.desde = anios.length ? Math.min(...anios) : null;
    familia.hasta = anios.length ? Math.max(...anios) : null;
    familia.totalColores = familia.lotes.reduce((s, l) => s + l.variantes.length, 0);
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
            `${v.codigo}-${v.variante}`,
            v.colorCodigo,
            v.color,
          ].join(" ")
        );
        variantes.set(v.id, { familia, lote, variante: v, orden: orden++ });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Estado (se guarda como borrador en este navegador)
  // ---------------------------------------------------------------------------

  function estadoVacio() {
    return {
      cantidades: {},
      datos: { numero: numeroNuevo(), fecha: fechaHoy(), cliente: "", solicitante: "", observaciones: "" },
    };
  }

  function cargarEstado() {
    const base = estadoVacio();
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_ALMACEN) || "null");
      if (guardado && typeof guardado === "object") {
        for (const [id, n] of Object.entries(guardado.cantidades || {})) {
          const cantidad = Math.min(MAXIMO, Math.max(0, parseInt(n, 10) || 0));
          if (variantes.has(id) && cantidad > 0) base.cantidades[id] = cantidad;
        }
        Object.assign(base.datos, guardado.datos || {});
      }
    } catch (error) {
      /* Sin almacenamiento disponible: se trabaja solo en memoria. */
    }
    return base;
  }

  let temporizadorGuardado = null;
  function guardar() {
    clearTimeout(temporizadorGuardado);
    temporizadorGuardado = setTimeout(() => {
      try {
        localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
      } catch (error) {
        /* Ignorado: el pedido sigue en memoria. */
      }
    }, 200);
  }

  const estado = cargarEstado();

  // ---------------------------------------------------------------------------
  // Catálogo
  // ---------------------------------------------------------------------------

  const lista = $("lista-familias");
  const nodosFamilia = new Map();
  const nodosLote = new Map();
  const nodosVariante = new Map();

  function htmlVariante(familia, lote, v) {
    const muestra = v.muestra
      ? `<span class="muestra" style="background:${escapar(v.muestra)}" title="Muestra aproximada"></span>`
      : `<span class="muestra sin-muestra" title="Sin muestra"></span>`;
    const color = v.sinNombre
      ? `${escapar(v.color)} <span class="sin-nombre">(sin nombre en la planilla)</span>`
      : escapar(v.color);
    const codigos = [v.codigo, v.variante, v.colorCodigo].filter(Boolean).join(" · ");
    const etiqueta = `Cantidad de ${familia.nombre} ${textoAnio(lote.anio)} ${lote.mercado} ${v.color}`;
    return `
      <li class="variante" data-id="${escapar(v.id)}">
        ${muestra}
        <span class="variante-info">
          <span class="variante-color">${color}</span>
          <span class="variante-codigos">${escapar(codigos)}</span>
          ${v.aviso ? `<span class="aviso">${escapar(v.aviso)}</span>` : ""}
        </span>
        <span class="cantidad">
          <button type="button" class="paso" data-paso="-1" aria-label="Restar una unidad">−</button>
          <input type="number" id="q-${escapar(v.id)}" min="0" max="${MAXIMO}" step="1" inputmode="numeric" placeholder="0" aria-label="${escapar(etiqueta)}" />
          <button type="button" class="paso" data-paso="1" aria-label="Sumar una unidad">+</button>
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

    for (const [id, cantidad] of Object.entries(estado.cantidades)) {
      pintarVariante(id, cantidad);
    }
    for (const familia of CATALOGO.familias) pintarFamilia(familia);
  }

  function pintarVariante(id, cantidad) {
    const nodo = nodosVariante.get(id);
    if (!nodo) return;
    nodo.classList.toggle("con-cantidad", cantidad > 0);
    const input = nodo.querySelector("input");
    const valor = cantidad > 0 ? String(cantidad) : "";
    if (input.value !== valor) input.value = valor;
  }

  function pintarFamilia(familia) {
    let total = 0;
    for (const lote of familia.lotes) for (const v of lote.variantes) total += estado.cantidades[v.id] || 0;
    const insignia = nodosFamilia.get(familia.id).querySelector(".familia-cantidad");
    insignia.hidden = total === 0;
    insignia.textContent = `${formatoNumero(total)} u.`;
  }

  function fijarCantidad(id, valor, desdeTeclado) {
    const datos = variantes.get(id);
    if (!datos) return;
    const cantidad = Math.min(MAXIMO, Math.max(0, Math.trunc(Number(valor) || 0)));
    if (cantidad > 0) estado.cantidades[id] = cantidad;
    else delete estado.cantidades[id];

    const nodo = nodosVariante.get(id);
    nodo.classList.toggle("con-cantidad", cantidad > 0);
    if (!desdeTeclado) pintarVariante(id, cantidad);
    pintarFamilia(datos.familia);
    renderPedido();
    guardar();
  }

  lista.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".paso");
    if (!boton) return;
    const id = boton.closest(".variante").dataset.id;
    fijarCantidad(id, (estado.cantidades[id] || 0) + Number(boton.dataset.paso));
  });

  lista.addEventListener("input", (evento) => {
    if (!evento.target.matches(".cantidad input")) return;
    const id = evento.target.closest(".variante").dataset.id;
    fijarCantidad(id, parseInt(evento.target.value, 10) || 0, true);
  });

  lista.addEventListener("change", (evento) => {
    if (!evento.target.matches(".cantidad input")) return;
    const id = evento.target.closest(".variante").dataset.id;
    pintarVariante(id, estado.cantidades[id] || 0);
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

    const totalVariantes = variantes.size;
    $("marca-sub").textContent = `Motocicletas y cuatriciclos · ${CATALOGO.familias.length} modelos · ${formatoNumero(totalVariantes)} colores`;
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
            loteOk &&
            palabras.every((p) => v.busqueda.includes(p)) &&
            (!filtros.soloCantidad || (estado.cantidades[v.id] || 0) > 0);
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
  // Orden de pedido
  // ---------------------------------------------------------------------------

  function lineasPedido() {
    return Object.entries(estado.cantidades)
      .filter(([id, n]) => n > 0 && variantes.has(id))
      .map(([id, n]) => ({ id, cantidad: n, ...variantes.get(id) }))
      .sort((a, b) => a.orden - b.orden);
  }

  function agruparPorFamilia(lineas) {
    const grupos = [];
    for (const linea of lineas) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.familia === linea.familia) {
        ultimo.lineas.push(linea);
        ultimo.total += linea.cantidad;
      } else {
        grupos.push({ familia: linea.familia, lineas: [linea], total: linea.cantidad });
      }
    }
    return grupos;
  }

  function renderPedido() {
    const lineas = lineasPedido();
    const grupos = agruparPorFamilia(lineas);
    const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);

    $("total-unidades").textContent = formatoNumero(unidades);
    $("total-renglones").textContent = formatoNumero(lineas.length);
    $("total-familias").textContent = formatoNumero(grupos.length);
    $("barra-unidades").textContent = formatoNumero(unidades);
    $("barra-renglones").textContent = formatoNumero(lineas.length);
    $("movil-unidades").textContent = formatoNumero(unidades);
    $("movil-renglones").textContent = formatoNumero(lineas.length);
    $("pedido-vacio").hidden = lineas.length > 0;

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
              .map(({ id, cantidad, lote, variante }) => {
                const muestra = variante.muestra
                  ? `<span class="muestra chica" style="background:${escapar(variante.muestra)}"></span>`
                  : `<span class="muestra chica sin-muestra"></span>`;
                const detalle = [textoAnio(lote.anio), lote.mercado, textoEdicion(lote)].filter(Boolean).join(" · ");
                const codigos = [variante.variante ? `${variante.codigo}-${variante.variante}` : variante.codigo, variante.colorCodigo]
                  .filter(Boolean)
                  .join(" · ");
                return `
                  <li class="linea">
                    ${muestra}
                    <span class="linea-texto">
                      <strong>${escapar(variante.color)}</strong>
                      <span class="linea-detalle">${escapar(detalle)}</span>
                      <span class="linea-codigos">${escapar(codigos)}</span>
                      <span class="linea-acciones">
                        <button type="button" class="boton-texto" data-ir="${escapar(id)}">Ver en el catálogo</button>
                        <button type="button" class="boton-texto peligro" data-quitar="${escapar(id)}">Quitar</button>
                      </span>
                    </span>
                    <span class="linea-cantidad">${escapar(formatoNumero(cantidad))}</span>
                  </li>`;
              })
              .join("")}
          </ol>
        </li>`
      )
      .join("");
  }

  $("lineas-pedido").addEventListener("click", (evento) => {
    const quitar = evento.target.closest("[data-quitar]");
    if (quitar) {
      fijarCantidad(quitar.dataset.quitar, 0);
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
    nodo.querySelector("input").focus({ preventScroll: true });
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
    ids.forEach((id) => pintarVariante(id, 0));
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

  const COLUMNAS = ["N.º", "Modelo", "Cód. modelo", "Año", "Mercado", "Edición", "Código", "Var.", "Cód. color", "Color", "Cant."];

  function filasDocumento(lineas) {
    return lineas.map((l, i) => [
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
      l.cantidad,
    ]);
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

  function validarPedido() {
    const lineas = lineasPedido();
    if (!lineas.length) {
      mostrarEstado("Cargá al menos una cantidad para generar la orden de pedido.", true);
      return null;
    }
    return lineas;
  }

  function generarPdf(lineas) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const ancho = doc.internal.pageSize.getWidth();
    const alto = doc.internal.pageSize.getHeight();
    const margen = 14;
    const datos = estado.datos;
    const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
    const grupos = agruparPorFamilia(lineas);
    const azul = [31, 72, 199];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("ORDEN DE PEDIDO", margen, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 97, 112);
    doc.text("Motocicletas y cuatriciclos", margen, 26);

    doc.setTextColor(20, 22, 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`N.º ${datos.numero || "—"}`, ancho - margen, 20, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Fecha: ${fechaLegible(datos.fecha) || "—"}`, ancho - margen, 26, { align: "right" });

    doc.setDrawColor(20, 22, 27);
    doc.setLineWidth(0.6);
    doc.line(margen, 30, ancho - margen, 30);

    const etiquetas = [
      ["Cliente / concesionario", datos.cliente || "—"],
      ["Solicitado por", datos.solicitante || "—"],
      ["Total de unidades", formatoNumero(unidades)],
    ];
    const columna = (ancho - margen * 2) / etiquetas.length;
    etiquetas.forEach(([etiqueta, valor], i) => {
      const x = margen + columna * i;
      doc.setFontSize(8);
      doc.setTextColor(90, 97, 112);
      doc.text(etiqueta.toUpperCase(), x, 37);
      doc.setFontSize(11);
      doc.setTextColor(20, 22, 27);
      doc.text(doc.splitTextToSize(String(valor), columna - 4)[0], x, 43);
    });

    doc.autoTable({
      head: [COLUMNAS],
      body: filasDocumento(lineas),
      foot: [[{ content: "Total de unidades", colSpan: COLUMNAS.length - 1, styles: { halign: "right" } }, formatoNumero(unidades)]],
      startY: 49,
      margin: { left: margen, right: margen, bottom: 16 },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, lineColor: [221, 225, 232], lineWidth: 0.2, textColor: [20, 22, 27] },
      headStyles: { fillColor: azul, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [241, 243, 246], textColor: [20, 22, 27], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 249, 251] },
      columnStyles: {
        0: { halign: "right", cellWidth: 9 },
        3: { cellWidth: 13 },
        7: { cellWidth: 11 },
        10: { halign: "right", cellWidth: 13, fontStyle: "bold" },
      },
    });

    let y = doc.lastAutoTable.finalY + 8;
    const asegurarEspacio = (necesario) => {
      if (y + necesario > alto - 16) {
        doc.addPage();
        y = 20;
      }
    };

    asegurarEspacio(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Resumen por modelo", margen, y);
    doc.autoTable({
      head: [["Modelo", "Renglones", "Unidades"]],
      body: grupos.map((g) => [g.familia.nombre, g.lineas.length, formatoNumero(g.total)]),
      startY: y + 2,
      margin: { left: margen, right: margen, bottom: 16 },
      tableWidth: 110,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, lineColor: [221, 225, 232], lineWidth: 0.2, textColor: [20, 22, 27] },
      headStyles: { fillColor: [20, 22, 27], textColor: 255 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right", fontStyle: "bold" } },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (datos.observaciones && datos.observaciones.trim()) {
      const texto = doc.splitTextToSize(datos.observaciones.trim(), ancho - margen * 2);
      asegurarEspacio(10 + texto.length * 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Observaciones", margen, y);
      doc.setFont("helvetica", "normal");
      doc.text(texto, margen, y + 6);
      y += 8 + texto.length * 5;
    }

    asegurarEspacio(28);
    y += 16;
    doc.setDrawColor(90, 97, 112);
    doc.setLineWidth(0.3);
    const firma = 80;
    doc.line(margen, y, margen + firma, y);
    doc.line(ancho - margen - firma, y, ancho - margen, y);
    doc.setFontSize(8);
    doc.setTextColor(90, 97, 112);
    doc.text("Firma y aclaración del solicitante", margen, y + 5);
    doc.text("Firma y aclaración de aprobación", ancho - margen - firma, y + 5);

    const paginas = doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(90, 97, 112);
      doc.text(`${datos.numero || ""}  ·  Página ${i} de ${paginas}`, ancho - margen, alto - 8, { align: "right" });
    }

    return doc.output("blob");
  }

  function generarExcel(lineas) {
    const datos = estado.datos;
    const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
    const filas = [
      ["ORDEN DE PEDIDO"],
      [],
      ["N.º de pedido", datos.numero || ""],
      ["Fecha", fechaLegible(datos.fecha)],
      ["Cliente / concesionario", datos.cliente || ""],
      ["Solicitado por", datos.solicitante || ""],
      ["Observaciones", datos.observaciones || ""],
      [],
      COLUMNAS,
      ...filasDocumento(lineas),
      [],
      [...Array(COLUMNAS.length - 2).fill(""), "Total de unidades", unidades],
    ];
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    hoja["!cols"] = [6, 16, 14, 8, 22, 26, 10, 7, 10, 36, 8].map((wch) => ({ wch }));

    const resumen = XLSX.utils.aoa_to_sheet([
      ["Modelo", "Renglones", "Unidades"],
      ...agruparPorFamilia(lineas).map((g) => [g.familia.nombre, g.lineas.length, g.total]),
      [],
      ["Total", lineas.length, unidades],
    ]);
    resumen["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Pedido");
    XLSX.utils.book_append_sheet(libro, resumen, "Resumen por modelo");
    const contenido = XLSX.write(libro, { bookType: "xlsx", type: "array" });
    return new Blob([contenido], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  $("descargar-pdf").addEventListener("click", async () => {
    const lineas = validarPedido();
    if (!lineas) return;
    if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.API.autoTable) {
      mostrarEstado("No se pudo cargar el generador de PDF. Revisá la conexión a internet y recargá la página.", true);
      return;
    }
    mostrarEstado("Generando PDF…");
    const nombre = nombreArchivo("pdf");
    if (await guardarArchivo(nombre, generarPdf(lineas))) mostrarEstado(`Listo: ${nombre}`);
  });

  $("descargar-excel").addEventListener("click", async () => {
    const lineas = validarPedido();
    if (!lineas) return;
    if (!window.XLSX) {
      mostrarEstado("No se pudo cargar el generador de Excel. Revisá la conexión a internet y recargá la página.", true);
      return;
    }
    mostrarEstado("Generando Excel…");
    const nombre = nombreArchivo("xlsx");
    if (await guardarArchivo(nombre, generarExcel(lineas))) mostrarEstado(`Listo: ${nombre}`);
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
  renderCatalogo();
  pintarDatos();
  renderPedido();
  renderAvisos();
  aplicarFiltros(false);
  setTimeout(capacidadDescargas, 0);
})();
