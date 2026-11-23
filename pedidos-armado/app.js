/*
 * Pedidos de Armado — control mensual de pedidos de armado, recepción de
 * unidades, cumplimiento de suministro y reclamaciones por daños.
 *
 * Almacenamiento:
 *  - Publicada como Artifact de claude.ai: base de datos compartida (`db`).
 *  - Abierta como archivo o en cualquier servidor: localStorage del navegador.
 */
(function () {
  'use strict';

  /* ================= constantes ================= */
  const BASE = window.CATALOGO_YAMAHA || { categorias: [], modelos: [] };
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const CORREO_RECLAMOS = 'dsais@sdm.com.do';
  const LS_KEY = 'pedidos-armado:v1';
  const COLS = ['modelos', 'pedidos', 'recepciones', 'reclamaciones', 'config'];
  const TABS = ['pedido', 'recepcion', 'cumplimiento', 'reclamaciones', 'catalogo', 'ajustes'];
  const TABS_CON_MES = ['pedido', 'recepcion', 'cumplimiento'];
  const BORRAR = { borrar: true };
  const ROLES = [['gerente', 'Gerente de tienda'], ['almacen', 'Encargado de almacén']];

  /* ================= utilidades ================= */
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const sinAcentos = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const normColor = (c) => sinAcentos(c).trim().toLowerCase().replace(/\s+/g, ' ');
  const slug = (s) => sinAcentos(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'modelo';
  const lineKey = (modeloId, color) => modeloId + '|' + normColor(color);
  const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const entero = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const capitalizar = (s) => { s = String(s).trim().replace(/\s+/g, ' '); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  const emailOk = (s) => /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(String(s || '').trim());
  const imgOk = (s) => typeof s === 'string' && s.length < 250000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s);

  function hoyISO() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function horaActual() { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  const mesActual = () => hoyISO().slice(0, 7);
  const mesValido = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  function mesLabel(m) { const [y, mm] = m.split('-'); return MESES[Number(mm) - 1] + ' ' + y; }
  function mesAdd(m, d) {
    let [y, mm] = m.split('-').map(Number);
    mm += d;
    while (mm > 12) { mm -= 12; y++; }
    while (mm < 1) { mm += 12; y--; }
    return y + '-' + pad2(mm);
  }
  const fmtFecha = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—');
  const fmtN = (n) => (Number(n) || 0).toLocaleString('es-DO');
  const ratio = (a, b) => (b > 0 ? a / b : null);
  const fmtPct = (p) => (p == null ? '—' : (Math.round(p * 1000) / 10).toLocaleString('es-DO', { maximumFractionDigits: 1 }) + '%');
  const fmtDias = (d) => (d == null ? '—' : (Math.round(d * 10) / 10).toLocaleString('es-DO', { maximumFractionDigits: 1 }));
  const diasEntre = (a, b) => Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000);
  const numeroPedido = (mes) => 'PA-' + mes;
  function formModeloVacio(categoria) {
    return { abierto: false, nombre: '', categoria: categoria || '', categoriaOtra: '', colores: [], otroColor: '', error: '' };
  }

  const MUESTRAS = {
    negro: '#1d1f24', azul: '#1f4fd1', rojo: '#c8262d', marron: '#6b4632', gris: '#8b929c', blanco: '#f4f5f7', blanca: '#f4f5f7',
    verde: '#2f7d32', celeste: '#55b8ea', naranja: '#ee6a12', amarillo: '#f2c200', camuflaje: '#5d6b3b', plata: '#c3c8cf',
    plateado: '#c3c8cf', morado: '#6a3fb0', dorado: '#c9a227', vino: '#7a1f2b', beige: '#d8c7a6', cyan: '#1fb5c9'
  };
  function muestra(color) {
    const partes = normColor(color).split(/[\/\s,-]+/).map((p) => p.replace(/s$/, '')).filter((p) => MUESTRAS[p] || MUESTRAS[p + 's']);
    const hex = partes.map((p) => MUESTRAS[p] || MUESTRAS[p + 's']);
    if (!hex.length) return 'var(--surface-2)';
    if (hex.length === 1) return hex[0];
    return 'linear-gradient(135deg, ' + hex[0] + ' 50%, ' + hex[1] + ' 50%)';
  }
  const swatch = (c) => '<span class="swatch" style="background:' + muestra(c) + '"></span>';

  /* ================= estado ================= */
  const state = { modelos: {}, pedidos: {}, recepciones: {}, reclamaciones: {}, config: {} };
  const ui = {
    tab: 'pedido',
    mes: mesActual(),
    picker: { q: '', modeloId: '', qty: {}, nuevoColor: '' },
    procesando: false,
    procFecha: hoyISO(),
    reabriendo: false,
    recep: { fecha: hoyISO(), conduce: '', nota: '', qty: {} },
    periodo: 'mes',
    recl: { modeloId: '', color: '', chasis: '', motor: '', fecha: hoyISO(), descripcion: '', reportadoPor: '', correo: '' },
    reclError: '',
    reclUltima: '',
    reclFiltro: 'todas',
    cat: { q: '', editId: '', editColor: '', error: '' },
    nm: formModeloVacio(''),
    enfocar: '',
    cfg: null,
    importData: null,
    confirm: '',
    copia: null,
    readOnly: false
  };
  const sync = { mode: 'iniciando', enArtifact: false, db: null, downloads: null, seen: new Set(), loaded: new Set(), stale: false, timer: null };

  function cfg() { return state.config.general || {}; }
  function correoReclamos() { const c = cfg().correoReclamaciones; return emailOk(c) ? c.trim() : CORREO_RECLAMOS; }
  function ready() { return sync.mode === 'local' || (sync.mode === 'nube' && COLS.every((c) => sync.seen.has(c))); }

  /* ================= almacenamiento ================= */
  function lsLoad() { try { const t = localStorage.getItem(LS_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  function lsSave() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }

  const cola = new Map();
  function put(col, id, data) {
    if (data === BORRAR) delete state[col][id];
    else state[col][id] = data;
    if (sync.mode === 'nube') dbWrite(col, id, data);
    else if (sync.mode === 'local' && !lsSave()) toast('No se pudo guardar en este navegador (almacenamiento lleno o bloqueado).', 'bad');
    scheduleRender();
  }
  function dbWrite(col, id, data) {
    const key = col + '/' + id;
    let q = cola.get(key);
    if (!q) { q = { busy: false, next: undefined }; cola.set(key, q); }
    q.next = data;
    if (!q.busy) flush(key, q);
  }
  async function flush(key, q) {
    q.busy = true;
    while (q.next !== undefined) {
      const data = q.next;
      q.next = undefined;
      await escribirDoc(key, data);
    }
    q.busy = false;
    cola.delete(key);
  }
  async function escribirDoc(key, data, reintento) {
    try {
      if (data === BORRAR) await sync.db.doc(key).delete();
      else await sync.db.doc(key).set(data);
      return true;
    } catch (e) {
      const code = e && e.code;
      if (code === 'unavailable' && !reintento) {
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));
        return escribirDoc(key, data, true);
      }
      errorEscritura(code);
      return false;
    }
  }
  function errorEscritura(code) {
    if (code === 'invalid_argument' || code === 'not_granted' || code === 'revoked') {
      if (!ui.readOnly) {
        ui.readOnly = true;
        toast('No tienes permiso para modificar estos datos. La plataforma queda en modo de solo lectura.', 'bad');
        scheduleRender();
      }
    } else if (code === 'quota_exceeded') {
      toast('Se alcanzó el límite de almacenamiento. Elimina registros antiguos para seguir guardando.', 'bad');
    } else {
      toast('No se pudo guardar el último cambio. Revisa la conexión e inténtalo de nuevo.', 'bad');
    }
  }
  async function escribirLote(items) {
    // items: [col, id, data]; en la nube se escriben de uno en uno.
    for (const [col, id, data] of items) {
      if (data === BORRAR) delete state[col][id];
      else state[col][id] = data;
    }
    if (sync.mode === 'local') { lsSave(); scheduleRender(); return true; }
    scheduleRender();
    let ok = true;
    for (const [col, id, data] of items) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await escribirDoc(col + '/' + id, data))) { ok = false; break; }
    }
    return ok;
  }

  function aplicarSnapshot(col, snap) {
    const next = {};
    for (const d of snap.docs) next[d.id] = d.data();
    for (const key of cola.keys()) {
      const i = key.indexOf('/');
      if (key.slice(0, i) !== col) continue;
      const id = key.slice(i + 1);
      if (state[col][id] !== undefined) next[id] = state[col][id];
      else delete next[id];
    }
    state[col] = next;
  }

  function iniciarLocal(enArtifact) {
    sync.mode = 'local';
    sync.enArtifact = !!enArtifact;
    const guardado = lsLoad();
    if (guardado && typeof guardado === 'object') {
      for (const c of COLS) state[c] = guardado[c] && typeof guardado[c] === 'object' ? guardado[c] : {};
    } else {
      for (const m of BASE.modelos) state.modelos[slug(m.nombre)] = { nombre: m.nombre, categoria: m.categoria, colores: m.colores.slice(), activo: true };
      lsSave();
    }
    scheduleRender();
  }

  function suscribir() {
    sync.timer = setTimeout(() => {
      if (sync.loaded.size < COLS.length) { sync.stale = true; scheduleRender(); }
    }, 10000);
    for (const c of COLS) {
      sync.db.collection(c).onSnapshot((snap) => {
        aplicarSnapshot(c, snap);
        sync.seen.add(c);
        if (!snap.metadata || !snap.metadata.fromCache) sync.loaded.add(c);
        if (sync.loaded.size === COLS.length) { clearTimeout(sync.timer); sync.stale = false; }
        scheduleRender();
      }, (err) => {
        sync.seen.add(c);
        sync.loaded.add(c);
        if (err && (err.code === 'revoked' || err.code === 'not_granted')) ui.readOnly = true;
        else toast('Se perdió la conexión con la base de datos. Recarga la página para reconectar.', 'bad');
        scheduleRender();
      });
    }
  }

  async function iniciar() {
    ui.tab = tabDeHash();
    enlazarEventos();
    render();
    const claude = window.claude;
    if (!claude || typeof claude.use !== 'function') { iniciarLocal(false); return; }
    sync.mode = 'conectando';
    claude.use('downloads').then((d) => { sync.downloads = d; }).catch(() => {});
    let db = null;
    try { db = await claude.use('db'); } catch (e) { db = null; }
    if (!db) { iniciarLocal(true); return; }
    sync.db = db;
    sync.mode = 'nube';
    suscribir();
    try {
      const user = await claude.use('user');
      if (user && typeof user.can === 'function') {
        const puede = await user.can('data.write');
        if (puede === false) { ui.readOnly = true; scheduleRender(); }
      }
    } catch (e) { /* sin información de permisos: se decide al escribir */ }
  }

  /* ================= cálculos ================= */
  function catIndex(c) { const i = BASE.categorias.indexOf(c); return i < 0 ? 999 : i; }
  function compararModelos(a, b) {
    return catIndex(a.categoria) - catIndex(b.categoria) ||
      String(a.categoria || '').localeCompare(String(b.categoria || ''), 'es') ||
      String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { numeric: true });
  }
  function modelosOrdenados() {
    return Object.entries(state.modelos).map(([id, m]) => Object.assign({ id }, m)).sort(compararModelos);
  }
  function nombreModelo(id, respaldo) { const m = state.modelos[id]; return (m && m.nombre) || respaldo || id; }
  function categorias() {
    const set = new Set(BASE.categorias);
    for (const m of Object.values(state.modelos)) if (m.categoria) set.add(m.categoria);
    return [...set];
  }
  function getPedido(mes) { return state.pedidos[mes] || null; }
  function lineasDe(p) { return ((p && p.lineas) || []).filter((l) => entero(l.cantidad) > 0); }
  function totalPedido(p) { return sum(lineasDe(p), (l) => entero(l.cantidad)); }
  function nuevoPedido(mes) {
    return { mes, numero: numeroPedido(mes), estado: 'borrador', fechaCreacion: hoyISO(), fechaProcesado: null, notas: '', lineas: [], firmas: {} };
  }
  function clonarPedido(mes) { const p = getPedido(mes); const c = p ? clone(p) : nuevoPedido(mes); c.lineas = c.lineas || []; c.firmas = c.firmas || {}; return c; }
  function guardarPedido(p) { p.actualizado = new Date().toISOString(); put('pedidos', p.mes, p); }
  function pedidoAnterior(mes) {
    const meses = Object.keys(state.pedidos).filter((m) => m < mes && totalPedido(state.pedidos[m]) > 0).sort();
    const m = meses.pop();
    return m ? state.pedidos[m] : null;
  }
  function modeloEnUso(id) {
    return Object.values(state.pedidos).some((p) => (p.lineas || []).some((l) => l.modeloId === id)) ||
      Object.values(state.recepciones).some((r) => (r.lineas || []).some((l) => l.modeloId === id));
  }

  function agrupar(lineas) {
    const map = new Map();
    for (const l of lineas) {
      if (!map.has(l.modeloId)) {
        const m = state.modelos[l.modeloId];
        map.set(l.modeloId, { modeloId: l.modeloId, nombre: nombreModelo(l.modeloId, l.modelo), categoria: (m && m.categoria) || '', lineas: [] });
      }
      map.get(l.modeloId).lineas.push(l);
    }
    const grupos = [...map.values()];
    for (const g of grupos) {
      const orden = ((state.modelos[g.modeloId] && state.modelos[g.modeloId].colores) || []).map(normColor);
      g.lineas.sort((a, b) => {
        const ia = orden.indexOf(normColor(a.color)); const ib = orden.indexOf(normColor(b.color));
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a.color).localeCompare(String(b.color), 'es');
      });
      g.pedida = sum(g.lineas, (l) => l.pedida);
      g.recibida = sum(g.lineas, (l) => l.recibida);
      g.restante = sum(g.lineas, (l) => l.restante);
      g.valida = sum(g.lineas, (l) => l.valida);
      g.cumplimiento = ratio(g.valida, g.pedida);
    }
    grupos.sort(compararModelos);
    return grupos;
  }

  function statsMes(mes) {
    const p = getPedido(mes);
    const recibidos = new Map();
    const recepciones = [];
    for (const [id, r] of Object.entries(state.recepciones)) {
      if (!r || r.mes !== mes) continue;
      const unidades = sum(r.lineas || [], (l) => entero(l.cantidad));
      recepciones.push(Object.assign({ id, unidades }, r));
      for (const l of r.lineas || []) {
        const k = lineKey(l.modeloId, l.color);
        recibidos.set(k, (recibidos.get(k) || 0) + entero(l.cantidad));
      }
    }
    recepciones.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || String(b.creado || '').localeCompare(String(a.creado || '')));
    const lineas = lineasDe(p).map((l) => {
      const pedida = entero(l.cantidad);
      const recibida = recibidos.get(lineKey(l.modeloId, l.color)) || 0;
      return Object.assign({}, l, { pedida, recibida, restante: Math.max(pedida - recibida, 0), excedente: Math.max(recibida - pedida, 0), valida: Math.min(recibida, pedida) });
    });
    const pedida = sum(lineas, (l) => l.pedida);
    const recibida = sum(lineas, (l) => l.recibida);
    const valida = sum(lineas, (l) => l.valida);
    let diasSum = 0; let diasUds = 0;
    if (p && p.fechaProcesado) {
      for (const r of recepciones) {
        const d = diasEntre(p.fechaProcesado, r.fecha);
        if (r.unidades > 0 && d >= 0) { diasSum += d * r.unidades; diasUds += r.unidades; }
      }
    }
    return {
      mes, pedido: p, lineas, recepciones, pedida, recibida, valida,
      restante: sum(lineas, (l) => l.restante), excedente: sum(lineas, (l) => l.excedente),
      cumplimiento: ratio(valida, pedida), diasSum, diasUds, diasPromedio: diasUds ? diasSum / diasUds : null
    };
  }
  function statsAnio(y) {
    const meses = [];
    for (let i = 1; i <= 12; i++) meses.push(statsMes(y + '-' + pad2(i)));
    const t = { anio: y, meses };
    for (const k of ['pedida', 'recibida', 'valida', 'restante', 'excedente', 'diasSum', 'diasUds']) t[k] = sum(meses, (m) => m[k]);
    t.cumplimiento = ratio(t.valida, t.pedida);
    t.diasPromedio = t.diasUds ? t.diasSum / t.diasUds : null;
    t.conPedido = meses.filter((m) => m.pedida > 0).length;
    return t;
  }

  /* ================= render ================= */
  let renderPendiente = false;
  function scheduleRender() {
    if (renderPendiente) return;
    renderPendiente = true;
    requestAnimationFrame(() => { renderPendiente = false; render(); });
  }

  function render() {
    const ae = document.activeElement;
    const fid = ae && ae !== document.body && ae.id ? ae.id : '';
    let val = null; let s0 = null; let s1 = null;
    if (fid && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && ae.type !== 'file' && ae.type !== 'checkbox') {
      val = ae.value;
      try { s0 = ae.selectionStart; s1 = ae.selectionEnd; } catch (e) { /* input sin selección */ }
    }
    renderCabecera();
    renderBanner();
    let html;
    if (!ready()) html = vistaCargando();
    else if (ui.tab === 'recepcion') html = vistaRecepcion();
    else if (ui.tab === 'cumplimiento') html = vistaCumplimiento();
    else if (ui.tab === 'reclamaciones') html = vistaReclamaciones();
    else if (ui.tab === 'catalogo') html = vistaCatalogo();
    else if (ui.tab === 'ajustes') html = vistaAjustes();
    else html = vistaPedido();
    $('#view').innerHTML = html;
    montarFirmas();
    if (fid) {
      const el = document.getElementById(fid);
      if (el && !el.disabled) {
        const ligado = el.dataset.bind || el.dataset.color || el.dataset.recline;
        if (val !== null && !ligado && el.value !== val) el.value = val;
        try { el.focus({ preventScroll: true }); if (s0 != null) el.setSelectionRange(s0, s1); } catch (e) { /* tipo sin selección */ }
      }
    }
    const copia = $('#copy-text');
    if (copia && ui.copia && ui.copia.seleccionar) { copia.focus(); copia.select(); ui.copia.seleccionar = false; }
    if (ui.enfocar) {
      const el = document.getElementById(ui.enfocar);
      ui.enfocar = '';
      if (el) { try { el.focus(); } catch (e) { /* sin foco */ } }
    }
  }

  function renderCabecera() {
    document.querySelectorAll('.tab').forEach((a) => {
      if (a.dataset.tab === ui.tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('#monthnav').hidden = !TABS_CON_MES.includes(ui.tab);
    const pend = Object.values(state.reclamaciones).filter((r) => r && r.estado === 'pendiente').length;
    const badge = $('#count-recl');
    badge.hidden = !pend;
    badge.textContent = pend;
    badge.setAttribute('aria-label', pend + ' por enviar');
    const selM = $('#mes-m'); const selY = $('#mes-y');
    if (!selM.options.length) selM.innerHTML = MESES.map((m, i) => '<option value="' + pad2(i + 1) + '">' + m + '</option>').join('');
    const anioAct = Number(mesActual().slice(0, 4));
    const anios = new Set([anioAct - 1, anioAct, anioAct + 1, Number(ui.mes.slice(0, 4))]);
    for (const m of Object.keys(state.pedidos)) if (mesValido(m)) anios.add(Number(m.slice(0, 4)));
    const lista = [...anios].sort((a, b) => a - b);
    const clave = lista.join(',');
    if (selY.dataset.k !== clave) { selY.innerHTML = lista.map((y) => '<option value="' + y + '">' + y + '</option>').join(''); selY.dataset.k = clave; }
    selM.value = ui.mes.slice(5, 7);
    selY.value = ui.mes.slice(0, 4);
  }

  function renderBanner() {
    let msg = ''; let kind = 'info';
    if (ui.readOnly) msg = 'Solo lectura: puedes consultar la información, pero no modificarla.';
    else if (sync.mode === 'local' && !sync.enArtifact) msg = 'Modo local: los datos se guardan solo en este navegador. Descarga un respaldo desde Ajustes con regularidad.';
    else if (sync.mode === 'local' && sync.enArtifact) { msg = 'No hay conexión con la base de datos compartida. Lo que registres se guarda solo en este navegador.'; kind = 'warn'; }
    else if (sync.mode === 'nube' && sync.stale && ready()) { msg = 'Sin conexión con la base de datos: lo que ves puede estar desactualizado.'; kind = 'warn'; }
    $('#banner').innerHTML = msg ? '<div class="banner ' + kind + '">' + esc(msg) + '</div>' : '';
  }

  function vistaCargando() {
    return '<section class="panel loading"><p><strong>' + (sync.stale ? 'No se puede conectar con la base de datos todavía.' : 'Cargando pedidos, recepciones y reclamaciones…') + '</strong></p>' +
      (sync.stale ? '<p class="muted">Revisa tu conexión a internet. La página sigue intentando conectarse.</p>' : '') + '</section>';
  }

  /* ---------- piezas comunes ---------- */
  function chipPedido(p) {
    if (!p || !totalPedido(p)) return '<span class="chip">Sin pedido</span>';
    if (p.estado === 'procesado') return '<span class="chip ok">Procesado</span>';
    return '<span class="chip warn">Borrador</span>';
  }
  function chipCumplimiento(pedida, recibida) {
    if (!pedida) return '<span class="chip">Sin pedido</span>';
    if (recibida >= pedida) return '<span class="chip ok">Completo</span>';
    if (recibida > 0) return '<span class="chip warn">Parcial</span>';
    return '<span class="chip bad">Sin recibir</span>';
  }
  function medidor(p) {
    const w = p == null ? 0 : Math.max(0, Math.min(1, p)) * 100;
    return '<span class="meter-cell"><span class="meter" role="img" aria-label="' + fmtPct(p) + '"><span style="width:' + w.toFixed(1) + '%"></span></span><span class="pct">' + fmtPct(p) + '</span></span>';
  }
  function kpi(label, valor, nota) {
    return '<div class="kpi"><span class="k-label">' + label + '</span><span class="k-value">' + valor + '</span>' + (nota ? '<span class="k-note">' + nota + '</span>' : '') + '</div>';
  }
  function kpisCumplimiento(st) {
    return '<div class="kpis">' +
      kpi('Cantidad pedida', fmtN(st.pedida), 'unidades') +
      kpi('Cantidad recibida', fmtN(st.recibida), st.excedente ? fmtN(st.excedente) + ' por encima de lo pedido' : 'unidades') +
      kpi('Cantidad restante', fmtN(st.restante), 'por recibir') +
      kpi('Cumplimiento', fmtPct(st.cumplimiento), 'unidades recibidas ÷ pedidas') +
      kpi('Entrega promedio', fmtDias(st.diasPromedio), st.diasPromedio == null ? 'se calcula con la fecha de procesado' : 'días desde el procesado') +
      '</div>';
  }
  function confirmar(clave, texto, accionOk, etiquetaOk, extra) {
    if (ui.confirm !== clave) return '';
    return '<div class="confirm-inline"><span>' + texto + '</span><button type="button" class="btn sm danger" data-action="' + accionOk + '" ' + (extra || '') + '>' + (etiquetaOk || 'Sí, eliminar') + '</button><button type="button" class="btn sm ghost" data-action="confirm-cancel">Cancelar</button></div>';
  }
  function bloqueCopia() {
    if (!ui.copia) return '';
    return '<section class="panel copy-box"><div class="panel-head"><div><h2>Copia este texto</h2><p class="muted small">El navegador no permitió copiar automáticamente. Selecciona el texto y cópialo (Ctrl+C o mantén presionado en el teléfono).</p></div><button type="button" class="btn sm" data-action="copia-cerrar">Cerrar</button></div><textarea id="copy-text" readonly>' + esc(ui.copia.texto) + '</textarea></section>';
  }

  /* ================= vista: pedido del mes ================= */
  function vistaPedido() {
    const mes = ui.mes;
    const p = getPedido(mes);
    const st = statsMes(mes);
    const hay = st.lineas.length > 0;
    const cerrado = !!(p && p.estado === 'procesado');
    const editable = !ui.readOnly && !cerrado;
    let h = '<section class="doc-head"><div class="doc-id"><p class="eyebrow">Pedido de armado de proyección</p><h1>' + esc(mesLabel(mes)) + '</h1>' +
      '<dl class="doc-meta">' +
      '<div><dt>N.º de pedido</dt><dd class="mono">' + esc((p && p.numero) || numeroPedido(mes)) + '</dd></div>' +
      '<div><dt>Creado</dt><dd>' + fmtFecha(p && p.fechaCreacion) + '</dd></div>' +
      '<div><dt>Procesado</dt><dd>' + fmtFecha(p && p.fechaProcesado) + '</dd></div>' +
      '<div><dt>Unidades</dt><dd>' + fmtN(st.pedida) + '</dd></div>' +
      '</dl></div><div class="doc-actions">' + chipPedido(p) +
      '<button type="button" class="btn" data-action="pdf-pedido"' + (hay ? '' : ' disabled') + '>Descargar PDF</button>';
    if (!ui.readOnly) {
      h += cerrado
        ? '<button type="button" class="btn" data-action="reabrir-pedir">Reabrir pedido</button>'
        : '<button type="button" class="btn primary" data-action="procesar-pedir"' + (hay ? '' : ' disabled') + '>Procesar pedido</button>';
    }
    h += '</div></section>';

    if (ui.procesando && editable && hay) {
      const faltan = ROLES.filter(([r]) => !imgOk(p && p.firmas && p.firmas[r] && p.firmas[r].imagen)).map(([, t]) => t.toLowerCase());
      h += '<section class="panel"><h2>Procesar el pedido de ' + esc(mesLabel(mes)) + '</h2>' +
        '<p>Al procesarlo se registra la fecha, las cantidades quedan bloqueadas y se descarga el documento para enviarlo al Departamento de Armado.</p>' +
        (faltan.length ? '<p class="note warn">Falta la firma digital de: ' + esc(faltan.join(' y ')) + '. El PDF saldrá con la línea en blanco para firmarlo a mano.</p>' : '<p class="note ok">El documento lleva las dos firmas digitales.</p>') +
        '<div class="inline-form"><div class="field"><label for="proc-fecha">Fecha de procesado</label><input type="date" id="proc-fecha" data-bind="procFecha" value="' + esc(ui.procFecha) + '"></div>' +
        '<button type="button" class="btn primary" data-action="procesar-ok">Procesar y descargar PDF</button>' +
        '<button type="button" class="btn ghost" data-action="procesar-cancel">Cancelar</button></div></section>';
    }
    if (ui.reabriendo && cerrado && !ui.readOnly) {
      h += '<section class="panel"><h2>Reabrir el pedido</h2><p>Podrás cambiar cantidades otra vez. Se borrarán la fecha de procesado y las firmas digitales, porque el documento firmado ya no coincidiría.</p>' +
        '<div class="actions"><button type="button" class="btn primary" data-action="reabrir-ok">Reabrir pedido</button><button type="button" class="btn ghost" data-action="reabrir-cancel">Cancelar</button></div></section>';
    }
    if (cerrado && !ui.reabriendo) {
      h += '<p class="note info">Pedido procesado el <strong>' + fmtFecha(p.fechaProcesado) + '</strong>. Las cantidades están bloqueadas. Registra las unidades que vayan llegando en <button type="button" class="linklike" data-action="ir-tab" data-tab="recepcion">Recepción</button>.</p>';
    }

    if (editable) h += '<div class="grid-split">' + panelSelector(p) + panelDetalle(p, st, true) + '</div>';
    else h += panelDetalle(p, st, false);
    if (hay) h += panelFirmas(p, editable);
    return h;
  }

  function panelSelector(p) {
    const activos = modelosOrdenados().filter((m) => m.activo !== false);
    if (!Object.keys(state.modelos).length) {
      return '<section class="panel"><h2>Agregar motocicletas</h2><div class="empty"><p><strong>El catálogo de modelos está vacío.</strong></p><p class="muted">Carga los modelos Yamaha para empezar a armar el pedido.</p>' +
        '<button type="button" class="btn primary" data-action="cargar-catalogo">Cargar catálogo Yamaha (' + BASE.modelos.length + ' modelos)</button></div></section>';
    }
    if (ui.nm.abierto) {
      return '<section class="panel"><div class="panel-head"><div><h2>Modelo nuevo</h2><p class="muted small">Escribe el nombre y marca los colores disponibles. Al crearlo queda elegido para que escribas las cantidades del pedido.</p></div></div>' + formNuevoModelo('pedido') + '</section>';
    }
    const q = sinAcentos(ui.picker.q).toLowerCase().replace(/[\s-]/g, '');
    let lista = q ? activos.filter((m) => sinAcentos(m.nombre).toLowerCase().replace(/[\s-]/g, '').includes(q) || sinAcentos(m.categoria).toLowerCase().includes(q)) : activos;
    if (q && lista.length === 1 && ui.picker.modeloId !== lista[0].id) { ui.picker.modeloId = lista[0].id; ui.picker.qty = {}; }
    const sinResultados = !!q && !lista.length;
    const sel = ui.picker.modeloId && state.modelos[ui.picker.modeloId] ? Object.assign({ id: ui.picker.modeloId }, state.modelos[ui.picker.modeloId]) : null;
    if (sel && !lista.some((m) => m.id === sel.id)) lista = [sel].concat(lista);
    const enPedido = new Map();
    for (const l of lineasDe(p)) enPedido.set(l.modeloId, (enPedido.get(l.modeloId) || 0) + entero(l.cantidad));

    let opts = '<option value="">' + (lista.length ? 'Elige un modelo…' : 'Ningún modelo coincide') + '</option>';
    let cat = null;
    for (const m of lista) {
      if (m.categoria !== cat) { if (cat !== null) opts += '</optgroup>'; cat = m.categoria; opts += '<optgroup label="' + esc(cat || 'Sin categoría') + '">'; }
      const n = enPedido.get(m.id);
      opts += '<option value="' + esc(m.id) + '"' + (sel && m.id === sel.id ? ' selected' : '') + '>' + esc(m.nombre) + (n ? ' · ' + fmtN(n) + ' en pedido' : '') + '</option>';
    }
    if (cat !== null) opts += '</optgroup>';

    let h = '<section class="panel"><div class="panel-head"><div><h2>Agregar motocicletas</h2><p class="muted small">Elige el modelo y escribe cuántas unidades necesitas de cada color.</p></div></div>' +
      '<div class="field"><label for="pk-q">Buscar modelo</label><input type="search" id="pk-q" data-bind="picker.q" data-rerender="1" autocomplete="off" placeholder="Ej. XTZ150, Crux, Raptor" value="' + esc(ui.picker.q) + '"></div>' +
      '<div class="field"><label for="pk-modelo">Modelo</label><select id="pk-modelo">' + opts + '</select></div>' +
      (sinResultados ? '<p class="note">No encontramos «' + esc(ui.picker.q.trim()) + '» en el catálogo. <button type="button" class="linklike" data-action="nm-abrir" data-nombre="' + esc(ui.picker.q.trim()) + '">Agregarlo como modelo nuevo</button></p>' : '') +
      '<button type="button" class="btn sm add-model-btn" data-action="nm-abrir">+ Agregar un modelo que no está en la lista</button>';
    if (sel) {
      const actual = new Map();
      for (const l of lineasDe(p)) if (l.modeloId === sel.id) actual.set(normColor(l.color), entero(l.cantidad));
      const colores = sel.colores || [];
      h += '<div class="picker-model"><span class="pm-name">' + esc(sel.nombre) + '</span><span class="muted small">' + esc(sel.categoria || '') + ' · ' + colores.length + (colores.length === 1 ? ' color' : ' colores') + '</span></div>';
      if (colores.length) {
        h += '<div class="color-grid">' + colores.map((c, i) => {
          const v = ui.picker.qty[c] !== undefined ? ui.picker.qty[c] : (actual.get(normColor(c)) || '');
          const ya = actual.get(normColor(c));
          return '<div class="color-row">' + swatch(c) + '<label for="pk-qty-' + i + '">' + esc(c) + '</label><span class="in-order">' + (ya ? fmtN(ya) + ' en pedido' : '') + '</span>' +
            '<input type="number" class="qty" id="pk-qty-' + i + '" data-color="' + esc(c) + '" min="0" step="1" inputmode="numeric" placeholder="0" value="' + esc(v) + '"></div>';
        }).join('') + '</div>';
      } else {
        h += '<p class="hint">Este modelo todavía no tiene colores. Agrega el primero aquí abajo.</p>';
      }
      h += '<div class="add-inline"><input type="text" id="pk-newcolor" data-bind="picker.nuevoColor" placeholder="Otro color (ej. Gris mate)" value="' + esc(ui.picker.nuevoColor) + '" aria-label="Nuevo color para ' + esc(sel.nombre) + '"><button type="button" class="btn sm" data-action="pk-addcolor">Agregar color</button></div>' +
        '<button type="button" class="btn primary block" data-action="pk-guardar">Guardar cantidades en el pedido</button>' +
        '<p class="hint">Escribe 0 para quitar un color del pedido.</p>';
    } else {
      h += '<p class="hint">Al elegir un modelo aparecen sus colores para que escribas las cantidades.</p>';
    }
    return h + '</section>';
  }

  function panelDetalle(p, st, editable) {
    const grupos = agrupar(st.lineas);
    if (!grupos.length) {
      const prev = pedidoAnterior(ui.mes);
      return '<section class="panel"><div class="panel-head"><h2>Detalle del pedido</h2></div><div class="empty">' +
        '<p><strong>Aún no hay motocicletas en el pedido de ' + esc(mesLabel(ui.mes)) + '.</strong></p>' +
        (editable ? '<p class="muted">Elige un modelo, escribe las cantidades por color y guárdalas. El pedido se crea solo con la primera línea.</p>' : '') +
        (prev && editable ? '<button type="button" class="btn" data-action="copiar-anterior" data-mes="' + esc(prev.mes) + '">Copiar el pedido de ' + esc(mesLabel(prev.mes)) + ' (' + fmtN(totalPedido(prev)) + ' uds)</button>' : '') +
        '</div></section>';
    }
    let rows = '';
    for (const g of grupos) {
      g.lineas.forEach((l, i) => {
        rows += '<tr>' + (i === 0 ? '<td class="model-cell" rowspan="' + g.lineas.length + '">' + esc(g.nombre) + '<span class="model-cat">' + esc(g.categoria) + '</span></td>' : '') +
          '<td><span class="color-cell">' + swatch(l.color) + esc(l.color) + '</span></td>' +
          '<td class="num">' + (editable
            ? '<input type="number" class="qty" id="ln-' + esc(l.id) + '" data-line="' + esc(l.id) + '" min="0" step="1" inputmode="numeric" value="' + l.pedida + '" aria-label="Cantidad pedida de ' + esc(g.nombre + ' ' + l.color) + '">'
            : fmtN(l.pedida)) + '</td>' +
          '<td class="num">' + fmtN(l.recibida) + '</td>' +
          '<td class="num' + (l.restante ? '' : ' muted') + '">' + fmtN(l.restante) + '</td>' +
          (editable ? '<td class="act"><button type="button" class="icon-btn sm" id="del-' + esc(l.id) + '" data-action="ln-del" data-line="' + esc(l.id) + '" aria-label="Quitar ' + esc(g.nombre + ' ' + l.color) + '">&times;</button></td>' : '') +
          '</tr>';
      });
      rows += '<tr class="subtotal"><td colspan="2">Total ' + esc(g.nombre) + '</td><td class="num">' + fmtN(g.pedida) + '</td><td class="num">' + fmtN(g.recibida) + '</td><td class="num">' + fmtN(g.restante) + '</td>' + (editable ? '<td></td>' : '') + '</tr>';
    }
    const c = cfg();
    let correoArmado = '';
    if (emailOk(c.correoArmado)) {
      correoArmado = '<a class="btn" href="' + esc(mailtoArmado(st)) + '">Preparar correo a Armado</a><span class="hint">Adjunta el PDF descargado antes de enviarlo.</span>';
    }
    return '<section class="panel"><div class="panel-head"><div><h2>Detalle del pedido</h2><p class="muted small">' + grupos.length + (grupos.length === 1 ? ' modelo' : ' modelos') + ' · ' + st.lineas.length + ' combinaciones de color · ' + fmtN(st.pedida) + ' unidades</p></div></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Modelo</th><th>Color</th><th class="num">Cantidad pedida</th><th class="num">Cantidad recibida</th><th class="num">Cantidad restante</th>' + (editable ? '<th><span hidden>Quitar</span></th>' : '') + '</tr></thead>' +
      '<tbody>' + rows + '</tbody><tfoot><tr><td colspan="2">Total general</td><td class="num">' + fmtN(st.pedida) + '</td><td class="num">' + fmtN(st.recibida) + '</td><td class="num">' + fmtN(st.restante) + '</td>' + (editable ? '<td></td>' : '') + '</tr></tfoot></table></div>' +
      '<div class="field"><label for="ped-notas">Observaciones para el Departamento de Armado</label><textarea id="ped-notas" placeholder="Ej. Prioridad: armar primero las XTZ150."' + (editable ? '' : ' disabled') + '>' + esc((p && p.notas) || '') + '</textarea></div>' +
      (correoArmado ? '<div class="actions">' + correoArmado + '</div>' : '') +
      '</section>';
  }

  function panelFirmas(p, editable) {
    return '<section class="panel"><div class="panel-head"><div><h2>Firmas de autorización</h2><p class="muted small">La solicitud debe ir firmada por el gerente de la tienda y el encargado de almacén. Pueden firmar aquí con el dedo o el ratón, o firmar a mano el PDF impreso.</p></div></div>' +
      '<div class="sig-grid">' + ROLES.map(([rol, titulo]) => tarjetaFirma(p, rol, titulo, editable)).join('') + '</div></section>';
  }
  function tarjetaFirma(p, rol, titulo, editable) {
    const f = (p && p.firmas && p.firmas[rol]) || {};
    const c = cfg();
    const nombre = f.nombre != null ? f.nombre : ((rol === 'gerente' ? c.gerente : c.encargado) || '');
    let cuerpo;
    if (imgOk(f.imagen)) {
      cuerpo = '<figure class="sig-image"><img src="' + f.imagen + '" alt="Firma de ' + esc(nombre || titulo) + '"></figure><p class="sig-date">Firmado el ' + fmtFecha(f.fecha) + '</p>' +
        (editable ? '<div class="sig-actions"><button type="button" class="btn sm danger" data-action="sig-borrar" data-rol="' + rol + '">Borrar firma</button></div>' : '');
    } else if (editable) {
      cuerpo = '<div class="sig-pad" data-sigpad="' + rol + '"></div><div class="sig-actions"><button type="button" class="btn sm" data-action="sig-limpiar" data-rol="' + rol + '">Limpiar</button><button type="button" class="btn sm primary" data-action="sig-guardar" data-rol="' + rol + '">Guardar firma</button></div>';
    } else {
      cuerpo = '<div class="sig-empty">Sin firma digital. Se firma a mano en el documento impreso.</div>';
    }
    return '<div class="sig-card"><div class="sig-role">' + titulo + '</div><div class="field"><label for="sig-nombre-' + rol + '">Nombre de quien firma</label><input type="text" id="sig-nombre-' + rol + '" data-rol="' + rol + '" value="' + esc(nombre) + '" placeholder="Nombre completo"' + (editable ? '' : ' disabled') + '></div>' + cuerpo + '</div>';
  }

  /* ---------- lienzo de firma ---------- */
  const lienzos = new Map();
  function montarFirmas() {
    document.querySelectorAll('[data-sigpad]').forEach((slot) => {
      const key = ui.mes + ':' + slot.dataset.sigpad;
      let pad = lienzos.get(key);
      if (!pad) { pad = crearLienzo(); lienzos.set(key, pad); }
      slot.appendChild(pad.canvas);
      slot.classList.toggle('dirty', pad.dirty);
    });
  }
  function crearLienzo() {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 180;
    canvas.setAttribute('aria-label', 'Recuadro para firmar');
    const ctx = canvas.getContext('2d');
    const tinta = '#14213d';
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = tinta; ctx.fillStyle = tinta;
    const pad = { canvas, ctx, dirty: false, dibujando: false, ultimo: null };
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      pad.dibujando = true; pad.ultimo = pos(e);
      ctx.beginPath(); ctx.arc(pad.ultimo[0], pad.ultimo[1], 1.3, 0, Math.PI * 2); ctx.fill();
      if (!pad.dirty) { pad.dirty = true; if (canvas.parentElement) canvas.parentElement.classList.add('dirty'); }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pad.dibujando) return;
      const pt = pos(e);
      ctx.beginPath(); ctx.moveTo(pad.ultimo[0], pad.ultimo[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke();
      pad.ultimo = pt;
    });
    const fin = () => { pad.dibujando = false; };
    canvas.addEventListener('pointerup', fin);
    canvas.addEventListener('pointercancel', fin);
    return pad;
  }

  /* ================= vista: recepción ================= */
  function vistaRecepcion() {
    const mes = ui.mes;
    const st = statsMes(mes);
    const p = st.pedido;
    let h = '<section class="doc-head"><div class="doc-id"><p class="eyebrow">Recepción de unidades armadas</p><h1>' + esc(mesLabel(mes)) + '</h1>' +
      '<dl class="doc-meta"><div><dt>N.º de pedido</dt><dd class="mono">' + esc((p && p.numero) || numeroPedido(mes)) + '</dd></div>' +
      '<div><dt>Procesado</dt><dd>' + fmtFecha(p && p.fechaProcesado) + '</dd></div>' +
      '<div><dt>Recepciones</dt><dd>' + st.recepciones.length + '</dd></div></dl></div>' +
      '<div class="doc-actions">' + chipCumplimiento(st.pedida, st.recibida) + '</div></section>';
    if (!st.lineas.length) {
      return h + '<section class="panel"><div class="empty"><p><strong>No hay pedido de armado para ' + esc(mesLabel(mes)) + '.</strong></p><p class="muted">Primero arma el pedido del mes; luego registra aquí las unidades que van llegando.</p>' +
        '<button type="button" class="btn primary" data-action="ir-tab" data-tab="pedido">Ir al pedido del mes</button></div></section>';
    }
    h += kpisCumplimiento(st);
    const editable = !ui.readOnly;
    const grupos = agrupar(st.lineas);
    let rows = '';
    let ahora = 0;
    for (const g of grupos) {
      g.lineas.forEach((l, i) => {
        const raw = ui.recep.qty[l.id];
        const n = entero(raw);
        ahora += n;
        rows += '<tr>' + (i === 0 ? '<td class="model-cell" rowspan="' + g.lineas.length + '">' + esc(g.nombre) + '</td>' : '') +
          '<td><span class="color-cell">' + swatch(l.color) + esc(l.color) + '</span></td>' +
          '<td class="num">' + fmtN(l.pedida) + '</td><td class="num">' + fmtN(l.recibida) + '</td>' +
          '<td class="num' + (l.restante ? '' : ' muted') + '">' + fmtN(l.restante) + '</td>' +
          (editable ? '<td class="num"><input type="number" class="qty" id="rc-' + esc(l.id) + '" data-recline="' + esc(l.id) + '" data-restante="' + l.restante + '" min="0" step="1" inputmode="numeric" placeholder="0" value="' + esc(raw == null ? '' : raw) + '" aria-label="Unidades recibidas ahora de ' + esc(g.nombre + ' ' + l.color) + '"></td>' : '') +
          '</tr>';
      });
    }
    if (editable) {
      h += '<section class="panel"><div class="panel-head"><div><h2>Registrar llegada de unidades</h2><p class="muted small">Escribe cuántas unidades llegaron de cada color en esta entrega. Puedes registrar varias entregas en el mes.</p></div>' +
        '<button type="button" class="btn sm" data-action="rc-llenar">Llenar con todo lo pendiente</button></div>' +
        '<div class="form-grid"><div class="field"><label for="rc-fecha">Fecha de recepción <span class="req">*</span></label><input type="date" id="rc-fecha" data-bind="recep.fecha" value="' + esc(ui.recep.fecha) + '"></div>' +
        '<div class="field"><label for="rc-conduce">N.º de conduce o factura</label><input type="text" id="rc-conduce" data-bind="recep.conduce" value="' + esc(ui.recep.conduce) + '" placeholder="Ej. C-004512"></div>' +
        '<div class="field"><label for="rc-nota">Nota</label><input type="text" id="rc-nota" data-bind="recep.nota" value="' + esc(ui.recep.nota) + '" placeholder="Ej. Llegó en camión 2"></div></div>' +
        '<div class="table-wrap"><table class="data"><thead><tr><th>Modelo</th><th>Color</th><th class="num">Cantidad pedida</th><th class="num">Cantidad recibida</th><th class="num">Cantidad restante</th><th class="num">Llegaron ahora</th></tr></thead><tbody>' + rows + '</tbody>' +
        '<tfoot><tr><td colspan="2">Total</td><td class="num">' + fmtN(st.pedida) + '</td><td class="num">' + fmtN(st.recibida) + '</td><td class="num">' + fmtN(st.restante) + '</td><td class="num" id="rc-total">' + fmtN(ahora) + '</td></tr></tfoot></table></div>' +
        '<div class="actions"><button type="button" class="btn primary" data-action="rc-guardar">Guardar recepción</button><span class="hint" id="rc-aviso"></span></div></section>';
    } else {
      h += '<section class="panel"><h2>Estado por color</h2><div class="table-wrap"><table class="data"><thead><tr><th>Modelo</th><th>Color</th><th class="num">Cantidad pedida</th><th class="num">Cantidad recibida</th><th class="num">Cantidad restante</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
    }
    h += '<section class="panel"><div class="panel-head"><h2>Historial de recepciones</h2></div>';
    if (!st.recepciones.length) h += '<p class="muted">Todavía no se ha registrado ninguna entrega para este pedido.</p>';
    else {
      h += '<ul class="list">' + st.recepciones.map((r) => {
        const detalle = (r.lineas || []).map((l) => esc(nombreModelo(l.modeloId, l.modelo)) + ' ' + esc(l.color) + ' <strong>' + fmtN(l.cantidad) + '</strong>').join(' · ');
        const dias = p && p.fechaProcesado ? diasEntre(p.fechaProcesado, r.fecha) : null;
        return '<li class="rec-item"><div class="rec-main"><span class="rec-date">' + fmtFecha(r.fecha) + '</span><span><strong>' + fmtN(r.unidades) + '</strong> unidades</span>' +
          (r.conduce ? '<span class="mono small">Conduce ' + esc(r.conduce) + '</span>' : '') +
          (dias != null && dias >= 0 ? '<span class="muted small">' + dias + (dias === 1 ? ' día' : ' días') + ' después del procesado</span>' : '') + '</div>' +
          '<div class="rec-lines">' + detalle + '</div>' + (r.nota ? '<p class="small muted">' + esc(r.nota) + '</p>' : '') +
          (editable ? '<div class="rec-foot"><span></span>' + (ui.confirm === 'rec:' + r.id ? confirmar('rec:' + r.id, '¿Eliminar esta recepción?', 'rec-del-ok', 'Sí, eliminar', 'data-id="' + esc(r.id) + '"') : '<button type="button" class="btn sm ghost danger" data-action="confirm-pedir" data-key="rec:' + esc(r.id) + '">Eliminar</button>') + '</div>' : '') +
          '</li>';
      }).join('') + '</ul>';
    }
    return h + '</section>';
  }

  /* ================= vista: cumplimiento ================= */
  function vistaCumplimiento() {
    const anio = ui.mes.slice(0, 4);
    let h = '<section class="doc-head"><div class="doc-id"><p class="eyebrow">Cumplimiento del suministro</p><h1>' + (ui.periodo === 'anio' ? 'Año ' + anio : esc(mesLabel(ui.mes))) + '</h1></div>' +
      '<div class="doc-actions"><div class="segmented" role="group" aria-label="Periodo del reporte">' +
      '<button type="button" data-action="periodo" data-p="mes" aria-pressed="' + (ui.periodo === 'mes') + '">Mes</button>' +
      '<button type="button" data-action="periodo" data-p="anio" aria-pressed="' + (ui.periodo === 'anio') + '">Año ' + anio + '</button></div>' +
      '<button type="button" class="btn" data-action="csv-reporte">Descargar CSV</button>' +
      '<button type="button" class="btn primary" data-action="pdf-reporte">Descargar reporte PDF</button></div></section>';
    return h + (ui.periodo === 'anio' ? cumplimientoAnio(anio) : cumplimientoMes());
  }

  function cumplimientoMes() {
    const st = statsMes(ui.mes);
    if (!st.lineas.length) {
      return '<section class="panel"><div class="empty"><p><strong>No hay pedido de armado para ' + esc(mesLabel(ui.mes)) + '.</strong></p><p class="muted">Cambia de mes arriba o mira el resumen del año.</p>' +
        '<button type="button" class="btn" data-action="periodo" data-p="anio">Ver el año ' + ui.mes.slice(0, 4) + '</button></div></section>';
    }
    const grupos = agrupar(st.lineas);
    let rows = '';
    for (const g of grupos) {
      rows += '<tr><td class="strong">' + esc(g.nombre) + '</td><td class="num">' + fmtN(g.pedida) + '</td><td class="num">' + fmtN(g.recibida) + '</td><td class="num">' + fmtN(g.restante) + '</td><td>' + medidor(g.cumplimiento) + '</td><td>' + chipCumplimiento(g.pedida, g.recibida) + '</td></tr>';
      for (const l of g.lineas) {
        rows += '<tr class="sub"><td><span class="color-cell">' + swatch(l.color) + esc(l.color) + '</span></td><td class="num">' + fmtN(l.pedida) + '</td><td class="num">' + fmtN(l.recibida) + '</td><td class="num">' + fmtN(l.restante) + '</td><td class="num">' + fmtPct(ratio(l.valida, l.pedida)) + '</td><td>' + (l.excedente ? '<span class="warn-cell">+' + fmtN(l.excedente) + ' de más</span>' : '') + '</td></tr>';
      }
    }
    let h = kpisCumplimiento(st) +
      '<section class="panel"><div class="panel-head"><div><h2>Cumplimiento por modelo</h2><p class="muted small">El cumplimiento cuenta solo hasta lo pedido; las unidades de más se muestran aparte.</p></div></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Modelo / color</th><th class="num">Cantidad pedida</th><th class="num">Cantidad recibida</th><th class="num">Cantidad restante</th><th>Cumplimiento</th><th>Estado</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td>Total</td><td class="num">' + fmtN(st.pedida) + '</td><td class="num">' + fmtN(st.recibida) + '</td><td class="num">' + fmtN(st.restante) + '</td><td>' + medidor(st.cumplimiento) + '</td><td></td></tr></tfoot></table></div></section>';
    h += '<section class="panel"><h2>Entregas recibidas</h2>';
    if (!st.recepciones.length) h += '<p class="muted">Sin entregas registradas en este mes. Regístralas en <button type="button" class="linklike" data-action="ir-tab" data-tab="recepcion">Recepción</button>.</p>';
    else {
      h += '<div class="table-wrap"><table class="data"><thead><tr><th>Fecha</th><th>Conduce / factura</th><th class="num">Unidades</th><th class="num">Días desde el procesado</th><th>Nota</th></tr></thead><tbody>' +
        st.recepciones.map((r) => {
          const d = st.pedido && st.pedido.fechaProcesado ? diasEntre(st.pedido.fechaProcesado, r.fecha) : null;
          return '<tr><td>' + fmtFecha(r.fecha) + '</td><td class="mono">' + esc(r.conduce || '—') + '</td><td class="num">' + fmtN(r.unidades) + '</td><td class="num">' + (d == null ? '—' : d) + '</td><td>' + esc(r.nota || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    return h + '</section>';
  }

  function cumplimientoAnio(anio) {
    const sa = statsAnio(anio);
    let h = '<div class="kpis">' +
      kpi('Cantidad pedida', fmtN(sa.pedida), sa.conPedido + (sa.conPedido === 1 ? ' mes con pedido' : ' meses con pedido')) +
      kpi('Cantidad recibida', fmtN(sa.recibida), sa.excedente ? fmtN(sa.excedente) + ' por encima de lo pedido' : 'unidades') +
      kpi('Cantidad restante', fmtN(sa.restante), 'por recibir') +
      kpi('Cumplimiento', fmtPct(sa.cumplimiento), 'acumulado del año') +
      kpi('Entrega promedio', fmtDias(sa.diasPromedio), 'días desde el procesado') + '</div>';
    h += '<section class="panel"><div class="panel-head"><div><h2>Cumplimiento mensual</h2><p class="muted small">Porcentaje de las unidades pedidas que ya se recibieron. Pasa el cursor o toca una barra para ver el detalle; haz clic para abrir ese mes.</p></div></div>' +
      '<div class="chart-scroll">' + grafico(sa) + '</div></section>';
    const rows = sa.meses.map((m) => {
      const p = m.pedido;
      const actual = m.mes === ui.mes ? ' is-current' : '';
      if (!m.pedida) return '<tr class="clickable' + actual + '" data-action="ir-mes" data-mes="' + m.mes + '"><td><button type="button" class="linklike" data-action="ir-mes" data-mes="' + m.mes + '">' + esc(mesLabel(m.mes)) + '</button></td><td class="muted" colspan="7">Sin pedido</td></tr>';
      return '<tr class="clickable' + actual + '" data-action="ir-mes" data-mes="' + m.mes + '"><td><button type="button" class="linklike" data-action="ir-mes" data-mes="' + m.mes + '">' + esc(mesLabel(m.mes)) + '</button></td><td class="mono">' + esc((p && p.numero) || numeroPedido(m.mes)) + '</td><td>' + chipPedido(p) + '</td><td>' + fmtFecha(p && p.fechaProcesado) + '</td>' +
        '<td class="num">' + fmtN(m.pedida) + '</td><td class="num">' + fmtN(m.recibida) + '</td><td class="num">' + fmtN(m.restante) + '</td><td>' + medidor(m.cumplimiento) + '</td></tr>';
    }).join('');
    h += '<section class="panel"><h2>Pedidos del año</h2><div class="table-wrap"><table class="data"><thead><tr><th>Mes</th><th>N.º de pedido</th><th>Estado</th><th>Procesado</th><th class="num">Pedida</th><th class="num">Recibida</th><th class="num">Restante</th><th>Cumplimiento</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="4">Total ' + anio + '</td><td class="num">' + fmtN(sa.pedida) + '</td><td class="num">' + fmtN(sa.recibida) + '</td><td class="num">' + fmtN(sa.restante) + '</td><td>' + medidor(sa.cumplimiento) + '</td></tr></tfoot></table></div></section>';
    return h;
  }

  function barra(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }
  function grafico(sa) {
    const W = 720; const H = 250; const ml = 46; const mr = 12; const mt = 24; const mb = 30;
    const iw = W - ml - mr; const ih = H - mt - mb; const banda = iw / 12; const bw = Math.min(34, banda * 0.56);
    const y = (v) => mt + ih - v * ih;
    let g = '<g class="grid">';
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      g += '<line class="' + (t === 0 ? 'base' : '') + '" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '"></line>' +
        '<text x="' + (ml - 8) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">' + (t * 100) + '%</text>';
    }
    g += '</g>';
    let barras = ''; let textos = ''; let zonas = '';
    sa.meses.forEach((m, i) => {
      const cx = ml + banda * i + banda / 2;
      const sel = m.mes === ui.mes;
      textos += '<text x="' + cx.toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle" class="' + (sel ? 'xsel' : '') + '">' + MESES_CORTOS[i] + '</text>';
      let tip;
      if (m.pedida > 0) {
        const v = m.cumplimiento || 0;
        const top = y(v); const alto = mt + ih - top; const x = cx - bw / 2;
        barras += alto > 0.5
          ? '<path class="bar' + (sel ? ' sel' : '') + '" d="' + barra(x, top, bw, alto, 4) + '"></path>'
          : '<line class="zero" x1="' + x.toFixed(1) + '" x2="' + (x + bw).toFixed(1) + '" y1="' + (mt + ih - 1) + '" y2="' + (mt + ih - 1) + '"></line>';
        if (sel) textos += '<text class="vlabel" x="' + cx.toFixed(1) + '" y="' + (top - 7).toFixed(1) + '" text-anchor="middle">' + fmtPct(v) + '</text>';
        tip = mesLabel(m.mes) + ': ' + fmtPct(m.cumplimiento) + ' · ' + fmtN(m.valida) + ' de ' + fmtN(m.pedida) + ' uds';
      } else {
        textos += '<text x="' + cx.toFixed(1) + '" y="' + (mt + ih - 6) + '" text-anchor="middle">–</text>';
        tip = mesLabel(m.mes) + ': sin pedido';
      }
      zonas += '<rect class="hit" x="' + (ml + banda * i).toFixed(1) + '" y="' + mt + '" width="' + banda.toFixed(1) + '" height="' + ih + '" data-tip="' + esc(tip) + '" data-action="ir-mes" data-mes="' + m.mes + '"></rect>';
    });
    return '<div class="chart" id="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cumplimiento mensual de ' + sa.anio + '">' + g + barras + textos + zonas + '</svg><div class="tooltip" id="chart-tip" hidden></div></div>';
  }

  /* ================= vista: reclamaciones ================= */
  function vistaReclamaciones() {
    const f = ui.recl;
    const editable = !ui.readOnly;
    const mods = modelosOrdenados();
    const m = f.modeloId ? state.modelos[f.modeloId] : null;
    const destino = correoReclamos();
    let opts = '<option value="">Elige el modelo…</option>';
    let cat = null;
    for (const x of mods) {
      if (x.categoria !== cat) { if (cat !== null) opts += '</optgroup>'; cat = x.categoria; opts += '<optgroup label="' + esc(cat || 'Sin categoría') + '">'; }
      opts += '<option value="' + esc(x.id) + '"' + (x.id === f.modeloId ? ' selected' : '') + '>' + esc(x.nombre) + '</option>';
    }
    if (cat !== null) opts += '</optgroup>';
    const colores = (m && m.colores) || [];
    const chasis = f.chasis.trim();
    let h = bloqueCopia();
    h += '<div class="grid-split wide-left"><section class="panel"><div class="panel-head"><div><h2>Reportar daño o defecto</h2><p class="muted small">Registra la unidad afectada y envía la reclamación por correo.</p></div></div>' +
      '<div class="destino"><span class="small muted">Se envía a</span><span class="mono">' + esc(destino) + '</span><button type="button" class="btn sm ghost" data-action="copiar-destino">Copiar dirección</button></div>';
    if (editable) {
      h += '<form id="recl-form" novalidate class="panel-body" style="display:flex;flex-direction:column;gap:12px">' +
        '<div class="form-grid">' +
        '<div class="field"><label for="recl-modelo">Modelo <span class="req">*</span></label><select id="recl-modelo" data-bind="recl.modeloId" data-rerender="1">' + opts + '</select></div>' +
        '<div class="field"><label for="recl-color">Color</label><select id="recl-color" data-bind="recl.color"' + (m ? '' : ' disabled') + '><option value="">' + (m ? 'Sin especificar' : 'Elige el modelo') + '</option>' +
        colores.map((c) => '<option value="' + esc(c) + '"' + (c === f.color ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></div>' +
        '</div><div class="form-grid">' +
        '<div class="field"><label for="recl-chasis">Número de chasis <span class="req">*</span></label><input type="text" id="recl-chasis" class="mono upper" data-bind="recl.chasis" maxlength="30" autocomplete="off" spellcheck="false" value="' + esc(f.chasis) + '" placeholder="17 caracteres (VIN)">' +
        '<div class="field-foot"><span id="recl-chasis-aviso" class="' + (chasis && chasis.length !== 17 ? 'warn' : '') + '">' + (chasis && chasis.length !== 17 ? 'El VIN suele tener 17 caracteres' : '') + '</span><span id="recl-chasis-n">' + chasis.length + '/17</span></div></div>' +
        '<div class="field"><label for="recl-motor">Número de motor</label><input type="text" id="recl-motor" class="mono upper" data-bind="recl.motor" maxlength="30" autocomplete="off" spellcheck="false" value="' + esc(f.motor) + '"></div>' +
        '<div class="field"><label for="recl-fecha">Fecha en que se detectó</label><input type="date" id="recl-fecha" data-bind="recl.fecha" value="' + esc(f.fecha) + '"></div>' +
        '</div>' +
        '<div class="field"><label for="recl-desc">Descripción del fallo <span class="req">*</span></label><textarea id="recl-desc" data-bind="recl.descripcion" placeholder="Ej. Tanque con abolladura en el lado izquierdo; rayón en el guardafango delantero.">' + esc(f.descripcion) + '</textarea></div>' +
        '<div class="form-grid"><div class="field"><label for="recl-por">Reportado por</label><input type="text" id="recl-por" data-bind="recl.reportadoPor" value="' + esc(f.reportadoPor) + '" placeholder="Nombre"></div>' +
        '<div class="field"><label for="recl-correo">Correo de quien reporta <span class="req">*</span></label><input type="email" id="recl-correo" data-bind="recl.correo" value="' + esc(f.correo) + '" placeholder="nombre@empresa.com" autocomplete="email"></div></div>' +
        (ui.reclError ? '<p class="note bad" role="alert">' + esc(ui.reclError) + '</p>' : '') +
        '<div class="actions"><button type="submit" class="btn primary">Registrar y enviar correo</button></div>' +
        '<p class="hint">Se abrirá tu programa de correo con el mensaje listo para ' + esc(destino) + '. Revisa y pulsa Enviar allí.</p>' +
        '</form>';
    }
    h += '</section>';

    const todas = Object.entries(state.reclamaciones).map(([id, r]) => Object.assign({ id }, r)).filter((r) => r && r.numero)
      .sort((a, b) => String(b.creado || b.fecha || '').localeCompare(String(a.creado || a.fecha || '')));
    const cuenta = { todas: todas.length, pendiente: 0, enviada: 0, resuelta: 0 };
    for (const r of todas) if (cuenta[r.estado] !== undefined) cuenta[r.estado]++;
    const lista = ui.reclFiltro === 'todas' ? todas : todas.filter((r) => r.estado === ui.reclFiltro);
    const filtros = [['todas', 'Todas'], ['pendiente', 'Por enviar'], ['enviada', 'Enviadas'], ['resuelta', 'Resueltas']];
    h += '<section class="panel"><div class="panel-head"><div><h2>Reclamaciones registradas</h2></div><div class="filters" role="group" aria-label="Filtrar reclamaciones">' +
      filtros.map(([k, t]) => '<button type="button" class="filter-btn" data-action="recl-filtro" data-f="' + k + '" aria-pressed="' + (ui.reclFiltro === k) + '">' + t + ' (' + cuenta[k] + ')</button>').join('') + '</div></div>';
    if (!todas.length) h += '<div class="empty"><p><strong>No hay reclamaciones registradas.</strong></p><p class="muted">Cuando una unidad llegue con un daño o defecto, completa el formulario con el modelo, el chasis y la descripción del fallo.</p></div>';
    else if (!lista.length) h += '<p class="muted">No hay reclamaciones en este filtro.</p>';
    else h += '<div class="claims">' + lista.map((r) => tarjetaReclamo(r, editable)).join('') + '</div>';
    h += '</section></div>';
    return h;
  }

  function chipReclamo(estado) {
    if (estado === 'resuelta') return '<span class="chip ok">Resuelta</span>';
    if (estado === 'enviada') return '<span class="chip info">Enviada</span>';
    return '<span class="chip warn">Por enviar</span>';
  }
  function tarjetaReclamo(r, editable) {
    const nueva = r.id === ui.reclUltima;
    let h = '<article class="claim' + (nueva ? ' is-new' : '') + '"><div class="claim-head"><span class="claim-num">' + esc(r.numero) + '</span>' + chipReclamo(r.estado) + '<span class="muted small">' + fmtFecha(r.fecha) + '</span></div>';
    if (nueva && r.estado === 'pendiente') {
      h += '<p class="note info">Reclamación registrada. Tu programa de correo debería abrirse con el mensaje listo; si no se abre, usa «Enviar correo» o «Copiar texto». Cuando lo envíes, márcala como enviada.</p>';
    }
    h += '<dl class="claim-facts"><div><dt>Modelo</dt><dd>' + esc(nombreModelo(r.modeloId, r.modelo)) + '</dd></div><div><dt>Color</dt><dd>' + esc(r.color || '—') + '</dd></div>' +
      '<div><dt>Chasis</dt><dd class="mono">' + esc(r.chasis) + '</dd></div><div><dt>Motor</dt><dd class="mono">' + esc(r.motor || '—') + '</dd></div></dl>' +
      '<p class="claim-desc">' + esc(r.descripcion) + '</p>' +
      '<p class="small muted">Reportado por ' + esc(r.reportadoPor || '—') + (r.correo ? ' · ' + esc(r.correo) : '') +
      (r.enviadaFecha ? ' · Enviada el ' + fmtFecha(r.enviadaFecha) : '') + (r.resueltaFecha ? ' · Resuelta el ' + fmtFecha(r.resueltaFecha) : '') + '</p>' +
      '<div class="claim-actions"><a class="btn sm" href="' + esc(mailtoReclamo(r)) + '">Enviar correo</a><button type="button" class="btn sm" data-action="recl-copiar" data-id="' + esc(r.id) + '">Copiar texto</button>';
    if (editable) {
      if (r.estado === 'pendiente') h += '<button type="button" class="btn sm primary" data-action="recl-estado" data-id="' + esc(r.id) + '" data-estado="enviada">Marcar como enviada</button>';
      else if (r.estado === 'enviada') h += '<button type="button" class="btn sm" data-action="recl-estado" data-id="' + esc(r.id) + '" data-estado="resuelta">Marcar como resuelta</button>';
      else h += '<button type="button" class="btn sm ghost" data-action="recl-estado" data-id="' + esc(r.id) + '" data-estado="enviada">Reabrir</button>';
      if (ui.confirm !== 'recl:' + r.id) h += '<button type="button" class="btn sm ghost danger" data-action="confirm-pedir" data-key="recl:' + esc(r.id) + '">Eliminar</button>';
    }
    h += '</div>';
    if (editable) h += confirmar('recl:' + r.id, '¿Eliminar la reclamación ' + esc(r.numero) + '?', 'recl-del-ok', 'Sí, eliminar', 'data-id="' + esc(r.id) + '"');
    return h + '</article>';
  }

  function textoReclamo(r) {
    const c = cfg();
    return 'Saludos,\n\nPor medio de la presente reportamos una unidad con daño o defecto:\n\n' +
      'Reclamación: ' + r.numero + '\n' +
      'Fecha: ' + fmtFecha(r.fecha) + '\n' +
      'Modelo: ' + nombreModelo(r.modeloId, r.modelo) + '\n' +
      'Color: ' + (r.color || 'Sin especificar') + '\n' +
      'Chasis: ' + r.chasis + '\n' +
      'Número de motor: ' + (r.motor || 'Sin especificar') + '\n\n' +
      'Descripción del fallo:\n' + r.descripcion + '\n\n' +
      'Reportado por: ' + (r.reportadoPor || '') + '\n' +
      'Correo de contacto: ' + (r.correo || '') + '\n' +
      (c.tienda ? 'Tienda: ' + c.tienda + '\n' : '') +
      '\nQuedamos atentos a su respuesta.';
  }
  function asuntoReclamo(r) { return 'Reclamación ' + r.numero + ' · ' + nombreModelo(r.modeloId, r.modelo) + ' · Chasis ' + r.chasis; }
  function mailtoReclamo(r) {
    return 'mailto:' + correoReclamos() + '?subject=' + encodeURIComponent(asuntoReclamo(r)) + '&body=' + encodeURIComponent(textoReclamo(r));
  }
  function mailtoArmado(st) {
    const grupos = agrupar(st.lineas);
    let cuerpo = 'Saludos,\n\nAdjunto el pedido de armado de ' + mesLabel(st.mes) + ' (' + ((st.pedido && st.pedido.numero) || numeroPedido(st.mes)) + ').\n\n';
    for (const g of grupos) cuerpo += g.nombre + ': ' + g.lineas.map((l) => l.color + ' ' + l.pedida).join(', ') + ' (total ' + g.pedida + ')\n';
    cuerpo += '\nTotal general: ' + st.pedida + ' unidades.\n\nFavor proceder con el armado.';
    return 'mailto:' + cfg().correoArmado.trim() + '?subject=' + encodeURIComponent('Pedido de armado ' + mesLabel(st.mes)) + '&body=' + encodeURIComponent(cuerpo);
  }
  function siguienteNumeroReclamo() {
    const anio = hoyISO().slice(0, 4);
    let max = 0;
    for (const r of Object.values(state.reclamaciones)) {
      const m = /^RC-(\d{4})-(\d+)$/.exec((r && r.numero) || '');
      if (m && m[1] === anio) max = Math.max(max, Number(m[2]));
    }
    return 'RC-' + anio + '-' + String(max + 1).padStart(4, '0');
  }

  /* ================= modelo nuevo (pedido y catálogo) ================= */
  function coloresDisponibles() {
    const vistos = new Map();
    for (const m of Object.values(state.modelos)) {
      for (const c of (m && m.colores) || []) {
        const k = normColor(c);
        const v = vistos.get(k);
        if (v) v.n++; else vistos.set(k, { nombre: c, n: 1 });
      }
    }
    for (const c of ui.nm.colores) { const k = normColor(c); if (!vistos.has(k)) vistos.set(k, { nombre: c, n: 0 }); }
    return [...vistos.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es')).map((v) => v.nombre);
  }
  function formNuevoModelo(contexto) {
    const f = ui.nm;
    const cats = categorias();
    const catSel = f.categoria || cats[0];
    const elegidos = new Set(f.colores.map(normColor));
    const chips = coloresDisponibles().map((c) => '<button type="button" class="color-pick" data-action="nm-color" data-color="' + esc(c) + '" aria-pressed="' + elegidos.has(normColor(c)) + '">' + swatch(c) + esc(c) + '</button>').join('');
    return '<div class="nm-form">' +
      '<div class="form-grid">' +
      '<div class="field"><label for="nm-nombre">Nombre del modelo <span class="req">*</span></label><input type="text" id="nm-nombre" class="upper" data-bind="nm.nombre" autocomplete="off" value="' + esc(f.nombre) + '" placeholder="Ej. XTZ250 LANDER"></div>' +
      '<div class="field"><label for="nm-categoria">Categoría</label><select id="nm-categoria" data-bind="nm.categoria" data-rerender="1">' +
      cats.map((c) => '<option value="' + esc(c) + '"' + (c === catSel ? ' selected' : '') + '>' + esc(c) + '</option>').join('') +
      '<option value="__otra"' + (f.categoria === '__otra' ? ' selected' : '') + '>Otra categoría…</option></select></div>' +
      (f.categoria === '__otra' ? '<div class="field"><label for="nm-categoria-otra">Nombre de la categoría</label><input type="text" id="nm-categoria-otra" data-bind="nm.categoriaOtra" value="' + esc(f.categoriaOtra) + '"></div>' : '') +
      '</div>' +
      '<fieldset class="color-fieldset"><legend class="label">Colores disponibles <span class="req">*</span> <span class="muted">· ' + (f.colores.length ? f.colores.length + (f.colores.length === 1 ? ' elegido: ' : ' elegidos: ') + esc(f.colores.join(', ')) : 'toca para marcar') + '</span></legend>' +
      '<div class="color-picks">' + chips + '</div>' +
      '<div class="add-inline"><input type="text" id="nm-otro" data-bind="nm.otroColor" value="' + esc(f.otroColor) + '" placeholder="Otro color que no está (ej. Gris mate)" aria-label="Otro color"><button type="button" class="btn sm" data-action="nm-otro">Agregar color</button></div>' +
      '</fieldset>' +
      (f.error ? '<p class="note bad" role="alert">' + esc(f.error) + '</p>' : '') +
      '<div class="actions"><button type="button" class="btn primary" data-action="nm-crear" data-ctx="' + contexto + '">' + (contexto === 'pedido' ? 'Crear modelo y escribir cantidades' : 'Agregar modelo') + '</button>' +
      (contexto === 'pedido' ? '<button type="button" class="btn ghost" data-action="nm-cerrar">Cancelar</button>' : '') + '</div>' +
      '</div>';
  }
  function agregarColoresNm(texto) {
    for (const x of String(texto || '').split(/[,;\n]/)) {
      const v = capitalizar(x);
      if (v && !ui.nm.colores.some((y) => normColor(y) === normColor(v))) ui.nm.colores.push(v);
    }
  }

  /* ================= vista: catálogo ================= */
  function vistaCatalogo() {
    const editable = !ui.readOnly;
    const cats = categorias();
    const todos = modelosOrdenados();
    let h = '';
    if (editable) {
      h += '<section class="panel"><div class="panel-head"><div><h2>Agregar un modelo nuevo</h2><p class="muted small">Para motocicletas que todavía no están en la lista. Marca los colores disponibles o escribe uno nuevo.</p></div></div>' + formNuevoModelo('catalogo') + '</section>';
    }
    const q = sinAcentos(ui.cat.q).toLowerCase().replace(/[\s-]/g, '');
    const lista = q ? todos.filter((m) => sinAcentos(m.nombre).toLowerCase().replace(/[\s-]/g, '').includes(q) || (m.colores || []).some((c) => normColor(c).includes(q))) : todos;
    h += '<section class="panel"><div class="panel-head"><div><h2>Modelos y colores</h2><p class="muted small">' + todos.length + ' modelos · ' + todos.filter((m) => m.activo === false).length + ' ocultos</p></div>' +
      '<div class="field" style="width:min(280px,100%)"><label for="cat-q">Buscar</label><input type="search" id="cat-q" data-bind="cat.q" data-rerender="1" value="' + esc(ui.cat.q) + '" placeholder="Modelo o color"></div></div>';
    if (!todos.length) {
      h += '<div class="empty"><p><strong>El catálogo está vacío.</strong></p>' + (editable ? '<button type="button" class="btn primary" data-action="cargar-catalogo">Cargar catálogo Yamaha (' + BASE.modelos.length + ' modelos)</button>' : '') + '</div>';
      return h + '</section>';
    }
    if (!lista.length) h += '<p class="muted">Ningún modelo coincide con la búsqueda.</p>';
    let cat = null;
    let abierto = false;
    for (const m of lista) {
      if (m.categoria !== cat) {
        if (abierto) h += '</div></div>';
        cat = m.categoria;
        h += '<div class="cat-group"><h3>' + esc(cat || 'Sin categoría') + ' <span class="muted small">' + lista.filter((x) => x.categoria === cat).length + '</span></h3><div>';
        abierto = true;
      }
      h += filaModelo(m, editable, cats);
    }
    if (abierto) h += '</div></div>';
    return h + '</section>';
  }
  function filaModelo(m, editable, cats) {
    const editando = editable && ui.cat.editId === m.id;
    let h = '<div class="model-item' + (m.activo === false ? ' is-off' : '') + '"><div class="model-name">' + esc(m.nombre) + (m.activo === false ? '<span class="chip plain">Oculto</span>' : '') + '</div>' +
      '<div class="tags">' + (m.colores || []).map((c) => '<span class="color-tag' + (editando ? '' : ' static') + '">' + swatch(c) + esc(c) +
        (editando ? '<button type="button" data-action="cat-color-del" data-id="' + esc(m.id) + '" data-color="' + esc(c) + '" aria-label="Quitar color ' + esc(c) + '">&times;</button>' : '') + '</span>').join('') +
      ((m.colores || []).length ? '' : '<span class="muted small">Sin colores</span>') + '</div>' +
      '<div>' + (editable ? (editando ? '<button type="button" class="btn sm primary" data-action="cat-listo">Listo</button>' : '<button type="button" class="btn sm" data-action="cat-editar" data-id="' + esc(m.id) + '">Editar</button>') : '') + '</div>';
    if (editando) {
      h += '<div class="model-edit"><div class="form-grid">' +
        '<div class="field"><label for="cat-edit-nombre">Nombre</label><input type="text" id="cat-edit-nombre" class="upper" data-id="' + esc(m.id) + '" value="' + esc(m.nombre) + '"></div>' +
        '<div class="field"><label for="cat-edit-cat">Categoría</label><select id="cat-edit-cat" data-id="' + esc(m.id) + '">' + cats.map((c) => '<option value="' + esc(c) + '"' + (c === m.categoria ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label for="cat-edit-color">Agregar color</label><div class="add-inline"><input type="text" id="cat-edit-color" data-bind="cat.editColor" value="' + esc(ui.cat.editColor) + '" placeholder="Ej. Gris mate"><button type="button" class="btn sm" data-action="cat-color-add" data-id="' + esc(m.id) + '">Agregar</button></div></div>' +
        '</div>' + (ui.cat.error ? '<p class="note bad" role="alert">' + esc(ui.cat.error) + '</p>' : '') +
        '<div class="actions"><button type="button" class="btn sm" data-action="cat-toggle" data-id="' + esc(m.id) + '">' + (m.activo === false ? 'Mostrar en el pedido' : 'Ocultar del pedido') + '</button>' +
        (ui.confirm === 'cat:' + m.id ? confirmar('cat:' + m.id, '¿Eliminar ' + esc(m.nombre) + ' del catálogo?', 'cat-del-ok', 'Sí, eliminar', 'data-id="' + esc(m.id) + '"')
          : '<button type="button" class="btn sm ghost danger" data-action="cat-del-pedir" data-id="' + esc(m.id) + '">Eliminar modelo</button>') +
        '</div></div>';
    }
    return h + '</div>';
  }

  /* ================= vista: ajustes ================= */
  function vistaAjustes() {
    const editable = !ui.readOnly;
    if (!ui.cfg) ui.cfg = Object.assign({ tienda: '', gerente: '', encargado: '', correoReclamaciones: CORREO_RECLAMOS, correoArmado: '' }, clone(cfg()));
    const d = ui.cfg;
    const dis = editable ? '' : ' disabled';
    const campo = (id, label, key, tipo, ph, ayuda) => '<div class="field"><label for="' + id + '">' + label + '</label><input type="' + tipo + '" id="' + id + '" data-bind="cfg.' + key + '" value="' + esc(d[key] || '') + '" placeholder="' + esc(ph) + '"' + dis + '>' + (ayuda ? '<span class="hint">' + ayuda + '</span>' : '') + '</div>';
    let h = '<section class="panel"><div class="panel-head"><div><h2>Datos de los documentos</h2><p class="muted small">Aparecen en el PDF del pedido y en los correos. Los nombres se usan como sugerencia en las firmas.</p></div></div>' +
      '<div class="form-grid">' + campo('cfg-tienda', 'Tienda o sucursal', 'tienda', 'text', 'Ej. Tienda Santiago') +
      campo('cfg-gerente', 'Gerente de tienda', 'gerente', 'text', 'Nombre completo') +
      campo('cfg-encargado', 'Encargado de almacén', 'encargado', 'text', 'Nombre completo') + '</div>' +
      '<div class="form-grid">' + campo('cfg-correo-recl', 'Correo para reclamaciones', 'correoReclamaciones', 'email', CORREO_RECLAMOS, 'Destino del botón «Enviar correo» de las reclamaciones.') +
      campo('cfg-correo-armado', 'Correo del Departamento de Armado (opcional)', 'correoArmado', 'email', 'armado@empresa.com', 'Si lo llenas, el pedido muestra un botón para preparar el correo.') + '</div>' +
      (editable ? '<div class="actions"><button type="button" class="btn primary" data-action="cfg-guardar">Guardar datos</button></div>' : '') + '</section>';

    const n = (c) => Object.keys(state[c]).length;
    const modo = sync.mode === 'nube' ? 'Los datos se guardan en la base de datos compartida de esta página: todas las personas con acceso ven la misma información.'
      : 'Los datos se guardan solo en este navegador. Descarga un respaldo con regularidad para no perderlos.';
    h += '<section class="panel"><div class="panel-head"><div><h2>Respaldo de datos</h2><p class="muted small">' + modo + '</p></div></div>' +
      '<p class="small">' + n('modelos') + ' modelos · ' + n('pedidos') + ' pedidos · ' + n('recepciones') + ' recepciones · ' + n('reclamaciones') + ' reclamaciones</p>' +
      '<div class="actions"><button type="button" class="btn" data-action="respaldo-descargar">Descargar respaldo (.json)</button>' +
      (editable ? '<label class="btn" for="respaldo-archivo">Importar respaldo</label><input type="file" id="respaldo-archivo" accept="application/json,.json" hidden>' : '') + '</div>';
    if (ui.importData) {
      const t = ui.importData;
      h += '<div class="note warn"><p><strong>Importar respaldo del ' + fmtFecha(t.exportado) + '.</strong> Contiene ' + Object.keys(t.modelos).length + ' modelos, ' + Object.keys(t.pedidos).length + ' pedidos, ' + Object.keys(t.recepciones).length + ' recepciones y ' + Object.keys(t.reclamaciones).length + ' reclamaciones. Los registros con el mismo identificador se reemplazan; los demás se conservan.</p>' +
        '<div class="actions" style="margin-top:8px"><button type="button" class="btn primary" data-action="import-ok">Importar</button><button type="button" class="btn ghost" data-action="import-cancel">Cancelar</button></div></div>';
    }
    h += '</section>';
    if (editable) {
      const faltan = BASE.modelos.filter((m) => !state.modelos[slug(m.nombre)]).length;
      h += '<section class="panel"><div class="panel-head"><div><h2>Catálogo base Yamaha</h2><p class="muted small">' + (faltan ? 'Hay ' + faltan + ' modelos del catálogo base que no están en tu lista.' : 'Tu catálogo tiene todos los modelos del catálogo base.') + '</p></div>' +
        '<button type="button" class="btn" data-action="cargar-catalogo"' + (faltan ? '' : ' disabled') + '>Agregar modelos faltantes</button></div></section>';
    }
    return h;
  }

  /* ================= acciones ================= */
  function guardarSelector() {
    const id = ui.picker.modeloId;
    const m = state.modelos[id];
    if (!m) return;
    const p = clonarPedido(ui.mes);
    if (p.estado === 'procesado') return;
    let cambios = 0;
    for (const c of m.colores || []) {
      const raw = ui.picker.qty[c];
      if (raw === undefined) continue;
      const n = entero(raw);
      const idx = p.lineas.findIndex((l) => l.modeloId === id && normColor(l.color) === normColor(c));
      if (idx >= 0) {
        if (n > 0) { if (entero(p.lineas[idx].cantidad) !== n) { p.lineas[idx].cantidad = n; p.lineas[idx].modelo = m.nombre; cambios++; } }
        else { p.lineas.splice(idx, 1); cambios++; }
      } else if (n > 0) {
        p.lineas.push({ id: uid(), modeloId: id, modelo: m.nombre, color: c, cantidad: n });
        cambios++;
      }
    }
    ui.picker.qty = {};
    if (!cambios) { toast('No hay cambios que guardar. Escribe las cantidades por color.'); scheduleRender(); return; }
    guardarPedido(p);
    const total = sum(p.lineas.filter((l) => l.modeloId === id), (l) => entero(l.cantidad));
    toast(m.nombre + ': ' + fmtN(total) + ' unidades en el pedido', 'ok');
  }
  function agregarColorModelo(id, texto) {
    const m = state.modelos[id];
    const color = capitalizar(texto || '');
    if (!m || !color) return false;
    if ((m.colores || []).some((c) => normColor(c) === normColor(color))) { toast('Ese color ya existe en ' + m.nombre + '.'); return false; }
    const nm = clone(m);
    nm.colores = (nm.colores || []).concat(color);
    put('modelos', id, nm);
    return true;
  }
  function cambiarLinea(id, valor) {
    if (String(valor).trim() === '') { scheduleRender(); return; }
    const p = clonarPedido(ui.mes);
    if (p.estado === 'procesado') return;
    const l = p.lineas.find((x) => x.id === id);
    if (!l) return;
    const n = entero(valor);
    if (n === entero(l.cantidad)) return;
    if (n === 0) p.lineas = p.lineas.filter((x) => x.id !== id);
    else l.cantidad = n;
    guardarPedido(p);
  }
  async function cargarCatalogo() {
    const faltan = BASE.modelos.filter((m) => !state.modelos[slug(m.nombre)]);
    if (!faltan.length) { toast('El catálogo ya tiene todos los modelos base.'); return; }
    toast('Cargando ' + faltan.length + ' modelos…');
    const ok = await escribirLote(faltan.map((m) => ['modelos', slug(m.nombre), { nombre: m.nombre, categoria: m.categoria, colores: m.colores.slice(), activo: true }]));
    if (ok) toast('Catálogo cargado: ' + faltan.length + ' modelos', 'ok');
  }
  function procesarPedido() {
    const p = clonarPedido(ui.mes);
    if (!totalPedido(p)) return;
    p.estado = 'procesado';
    p.fechaProcesado = /^\d{4}-\d{2}-\d{2}$/.test(ui.procFecha) ? ui.procFecha : hoyISO();
    guardarPedido(p);
    ui.procesando = false;
    generarPdfPedido(ui.mes);
  }
  function reabrirPedido() {
    const p = clonarPedido(ui.mes);
    p.estado = 'borrador';
    p.fechaProcesado = null;
    for (const [rol] of ROLES) if (p.firmas[rol]) p.firmas[rol] = { nombre: p.firmas[rol].nombre || '' };
    guardarPedido(p);
    ui.reabriendo = false;
    toast('Pedido reabierto. Ya puedes modificar las cantidades.', 'ok');
  }
  function guardarFirma(rol) {
    const key = ui.mes + ':' + rol;
    const pad = lienzos.get(key);
    if (!pad || !pad.dirty) { toast('Dibuja la firma en el recuadro antes de guardarla.'); return; }
    const input = document.getElementById('sig-nombre-' + rol);
    const nombre = input ? input.value.trim() : '';
    if (!nombre) { toast('Escribe el nombre de quien firma.'); if (input) input.focus(); return; }
    const p = clonarPedido(ui.mes);
    p.firmas[rol] = { nombre, imagen: pad.canvas.toDataURL('image/png'), fecha: hoyISO() };
    lienzos.delete(key);
    guardarPedido(p);
    toast('Firma guardada', 'ok');
  }
  function guardarRecepcion() {
    const st = statsMes(ui.mes);
    const lineas = [];
    for (const l of st.lineas) {
      const n = entero(ui.recep.qty[l.id]);
      if (n > 0) lineas.push({ modeloId: l.modeloId, modelo: nombreModelo(l.modeloId, l.modelo), color: l.color, cantidad: n });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ui.recep.fecha)) { toast('Indica la fecha de recepción.'); return; }
    if (!lineas.length) { toast('Escribe cuántas unidades llegaron de al menos un color.'); return; }
    const unidades = sum(lineas, (l) => l.cantidad);
    put('recepciones', uid(), { mes: ui.mes, fecha: ui.recep.fecha, conduce: ui.recep.conduce.trim(), nota: ui.recep.nota.trim(), lineas, creado: new Date().toISOString() });
    ui.recep.qty = {}; ui.recep.conduce = ''; ui.recep.nota = '';
    toast('Recepción registrada: ' + fmtN(unidades) + ' unidades', 'ok');
  }
  function registrarReclamo() {
    const f = ui.recl;
    let error = '';
    if (!f.modeloId || !state.modelos[f.modeloId]) error = 'Elige el modelo de la unidad.';
    else if (!f.chasis.trim()) error = 'Escribe el número de chasis.';
    else if (!f.descripcion.trim()) error = 'Describe el fallo que presenta la unidad.';
    else if (!emailOk(f.correo)) error = 'Escribe un correo válido de quien reporta (ej. nombre@empresa.com).';
    ui.reclError = error;
    if (error) { scheduleRender(); return; }
    const id = uid();
    const r = {
      numero: siguienteNumeroReclamo(), fecha: /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) ? f.fecha : hoyISO(),
      modeloId: f.modeloId, modelo: nombreModelo(f.modeloId), color: f.color || '',
      chasis: f.chasis.trim().toUpperCase(), motor: f.motor.trim().toUpperCase(), descripcion: f.descripcion.trim(),
      reportadoPor: f.reportadoPor.trim(), correo: f.correo.trim(), estado: 'pendiente', creado: new Date().toISOString()
    };
    put('reclamaciones', id, r);
    ui.reclUltima = id;
    ui.reclFiltro = 'todas';
    ui.recl = { modeloId: '', color: '', chasis: '', motor: '', fecha: hoyISO(), descripcion: '', reportadoPor: f.reportadoPor, correo: f.correo };
    abrirEnlace(mailtoReclamo(r));
  }
  function abrirEnlace(href) {
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener';
    a.hidden = true;
    document.body.appendChild(a);
    try { a.click(); } catch (e) { /* el visor puede bloquear el enlace */ }
    a.remove();
  }
  function copiar(texto, ok) {
    const fallback = () => { ui.copia = { texto, seleccionar: true }; scheduleRender(); };
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) { fallback(); return; }
      navigator.clipboard.writeText(texto).then(() => toast(ok || 'Copiado', 'ok'), fallback);
    } catch (e) { fallback(); }
  }
  function crearModelo(contexto) {
    const f = ui.nm;
    agregarColoresNm(f.otroColor);
    f.otroColor = '';
    const nombre = f.nombre.trim().replace(/\s+/g, ' ').toUpperCase();
    const categoria = f.categoria === '__otra' ? capitalizar(f.categoriaOtra) : (f.categoria || categorias()[0] || 'Sin categoría');
    const colores = f.colores.slice();
    const existente = Object.entries(state.modelos).find(([, m]) => String(m.nombre).toUpperCase() === nombre);
    let error = '';
    if (!nombre) error = 'Escribe el nombre del modelo.';
    else if (existente && existente[1].activo !== false && contexto !== 'pedido') error = nombre + ' ya está en el catálogo.';
    else if (!categoria) error = 'Escribe el nombre de la nueva categoría.';
    else if (!existente && !colores.length) error = 'Marca al menos un color disponible o escribe uno nuevo.';
    f.error = error;
    if (error) { ui.enfocar = !nombre ? 'nm-nombre' : ''; scheduleRender(); return; }
    let id;
    if (existente) {
      id = existente[0];
      const m = clone(existente[1]);
      const nuevos = colores.filter((c) => !(m.colores || []).some((y) => normColor(y) === normColor(c)));
      const estabaOculto = m.activo === false;
      if (estabaOculto || nuevos.length) {
        m.activo = true;
        m.colores = (m.colores || []).concat(nuevos);
        put('modelos', id, m);
      }
      toast(nombre + (estabaOculto ? ' estaba oculto y ya está disponible otra vez.' : ' ya estaba en el catálogo; quedó elegido.') + (nuevos.length ? ' Se agregaron ' + nuevos.length + ' colores.' : ''), 'ok');
    } else {
      id = slug(nombre);
      let i = 2;
      while (state.modelos[id]) id = slug(nombre) + '-' + i++;
      put('modelos', id, { nombre, categoria, colores, activo: true, creado: new Date().toISOString() });
      toast(contexto === 'pedido' ? nombre + ' creado. Escribe las cantidades por color y guárdalas.' : nombre + ' agregado al catálogo. Ya puedes pedirlo en «Pedido del mes».', 'ok');
    }
    ui.nm = formModeloVacio(f.categoria);
    ui.picker.modeloId = id;
    ui.picker.qty = {};
    ui.picker.q = '';
    if (contexto === 'pedido') ui.enfocar = 'pk-qty-0';
    scheduleRender();
  }
  function guardarAjustes() {
    const d = ui.cfg || {};
    if (d.correoReclamaciones && !emailOk(d.correoReclamaciones)) { toast('El correo para reclamaciones no es válido.', 'bad'); return; }
    if (d.correoArmado && !emailOk(d.correoArmado)) { toast('El correo del Departamento de Armado no es válido.', 'bad'); return; }
    const limpio = {};
    for (const k of ['tienda', 'gerente', 'encargado', 'correoReclamaciones', 'correoArmado']) limpio[k] = String(d[k] || '').trim();
    if (!limpio.correoReclamaciones) limpio.correoReclamaciones = CORREO_RECLAMOS;
    put('config', 'general', limpio);
    ui.cfg = null;
    toast('Datos guardados', 'ok');
  }
  function respaldoJSON() {
    return JSON.stringify({ app: 'pedidos-armado', version: 1, exportado: hoyISO(), modelos: state.modelos, pedidos: state.pedidos, recepciones: state.recepciones, reclamaciones: state.reclamaciones, config: state.config }, null, 2);
  }
  function leerRespaldo(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(String(reader.result));
        if (!d || d.app !== 'pedidos-armado') throw new Error('formato');
        const t = { exportado: d.exportado || '' };
        for (const c of COLS) {
          t[c] = {};
          const src = d[c] && typeof d[c] === 'object' ? d[c] : {};
          for (const [id, doc] of Object.entries(src)) {
            if (/^[A-Za-z0-9_.~:@+-]{1,120}$/.test(id) && id !== '.' && id !== '..' && doc && typeof doc === 'object' && !Array.isArray(doc)) t[c][id] = doc;
          }
        }
        ui.importData = t;
      } catch (e) {
        toast('El archivo no es un respaldo válido de Pedidos de Armado.', 'bad');
      }
      scheduleRender();
    };
    reader.readAsText(file);
  }
  async function importarRespaldo() {
    const t = ui.importData;
    if (!t) return;
    ui.importData = null;
    const items = [];
    for (const c of COLS) for (const [id, doc] of Object.entries(t[c])) items.push([c, id, doc]);
    toast('Importando ' + items.length + ' registros…');
    if (await escribirLote(items)) toast('Respaldo importado: ' + items.length + ' registros', 'ok');
  }

  /* ================= PDF y CSV ================= */
  const AZUL = [29, 63, 191]; const TINTA = [16, 24, 40]; const GRIS = [95, 107, 128]; const LINEA = [220, 226, 235]; const SUAVE = [241, 244, 249];
  function nuevoPdf() {
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J || !J.API || typeof J.API.autoTable !== 'function') {
      toast('No se pudo cargar el generador de PDF. Revisa la conexión a internet y recarga la página.', 'bad');
      return null;
    }
    return new J({ unit: 'mm', format: 'letter' });
  }
  function encabezadoPdf(doc, titulo, subtitulo, meta) {
    const W = doc.internal.pageSize.getWidth(); const M = 16;
    doc.setFillColor(...AZUL); doc.rect(0, 0, W, 3.2, 'F');
    const tienda = cfg().tienda;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...AZUL);
    doc.text(((tienda ? tienda + ' · ' : '') + 'Motocicletas Yamaha').toUpperCase(), M, 13);
    doc.setFontSize(16); doc.setTextColor(...TINTA); doc.text(titulo, M, 20.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...GRIS); doc.text(subtitulo, M, 26.5);
    const bw = 66; const bx = W - M - bw; const by = 8; const fila = 5.4; const bh = 4 + meta.length * fila;
    doc.setDrawColor(...LINEA); doc.setLineWidth(0.3); doc.roundedRect(bx, by, bw, bh, 1.5, 1.5, 'S');
    meta.forEach(([k, v], i) => {
      const yy = by + 5.6 + i * fila;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIS); doc.text(k.toUpperCase(), bx + 3, yy);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TINTA); doc.text(String(v), bx + bw - 3, yy, { align: 'right' });
    });
    return Math.max(34, by + bh + 7);
  }
  function piePdf(doc) {
    const n = doc.getNumberOfPages(); const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
    const gen = 'Generado el ' + fmtFecha(hoyISO()) + ' a las ' + horaActual() + ' · Pedidos de Armado';
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINEA); doc.setLineWidth(0.3); doc.line(16, H - 13, W - 16, H - 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS);
      doc.text(gen, 16, H - 8.5);
      doc.text('Página ' + i + ' de ' + n, W - 16, H - 8.5, { align: 'right' });
    }
  }
  function kpisPdf(doc, y, items) {
    const W = doc.internal.pageSize.getWidth(); const M = 16; const gap = 3; const n = items.length;
    const w = (W - 2 * M - gap * (n - 1)) / n; const h = 16;
    items.forEach(([k, v], i) => {
      const x = M + i * (w + gap);
      doc.setFillColor(...SUAVE); doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GRIS); doc.text(k.toUpperCase(), x + 3, y + 5.5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...TINTA); doc.text(String(v), x + 3, y + 12.6);
    });
    return y + h + 7;
  }
  const estiloTabla = {
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.2, lineColor: LINEA, lineWidth: 0.2, textColor: TINTA },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    footStyles: { fillColor: TINTA, textColor: 255, fontStyle: 'bold' },
    margin: { left: 16, right: 16, bottom: 20, top: 18 },
    showFoot: 'lastPage'
  };
  const der = (t) => ({ content: String(t), styles: { halign: 'right' } });
  const subtotal = (t, span) => ({ content: t, colSpan: span, styles: { fontStyle: 'bold', fillColor: SUAVE } });
  const derSub = (t) => ({ content: String(t), styles: { halign: 'right', fontStyle: 'bold', fillColor: SUAVE } });

  function generarPdfPedido(mes) {
    const st = statsMes(mes);
    const p = st.pedido;
    if (!p || !st.lineas.length) return;
    const doc = nuevoPdf();
    if (!doc) return;
    const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight(); const M = 16;
    const numero = p.numero || numeroPedido(mes);
    let y = encabezadoPdf(doc, 'SOLICITUD DE PEDIDO DE ARMADO', 'Pedido de armado de proyección · ' + mesLabel(mes).toUpperCase(), [
      ['N.º de pedido', numero], ['Fecha de emisión', fmtFecha(hoyISO())],
      ['Fecha de procesado', p.fechaProcesado ? fmtFecha(p.fechaProcesado) : 'Pendiente'], ['Estado', p.estado === 'procesado' ? 'Procesado' : 'Borrador']
    ]);
    const c = cfg();
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...TINTA);
    const intro = doc.splitTextToSize('Para: Departamento de Armado. Solicitamos el armado de las siguientes unidades correspondientes al pedido de ' + mesLabel(mes) + (c.tienda ? ', para ' + c.tienda : '') + '.', W - 2 * M);
    doc.text(intro, M, y); y += intro.length * 4.6 + 2;
    const grupos = agrupar(st.lineas);
    const body = [];
    for (const g of grupos) {
      g.lineas.forEach((l, i) => {
        const row = [];
        if (i === 0) row.push({ content: g.nombre, rowSpan: g.lineas.length, styles: { fontStyle: 'bold', valign: 'middle', fontSize: 10.5 } });
        row.push(l.color, der(fmtN(l.pedida)));
        body.push(row);
      });
      body.push([subtotal('Total ' + g.nombre, 2), derSub(fmtN(g.pedida))]);
    }
    doc.autoTable(Object.assign({}, estiloTabla, {
      startY: y,
      head: [['MODELO', 'COLOR', der('CANTIDAD PEDIDA')]],
      body,
      foot: [[{ content: 'TOTAL GENERAL', colSpan: 2 }, der(fmtN(st.pedida))]],
      columnStyles: { 0: { cellWidth: 62 }, 2: { cellWidth: 42 } }
    }));
    y = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
    doc.text(grupos.length + (grupos.length === 1 ? ' modelo' : ' modelos') + ' · ' + st.lineas.length + ' combinaciones de color · ' + fmtN(st.pedida) + ' unidades', M, y);
    y += 7;
    if (p.notas && p.notas.trim()) {
      const lineas = doc.splitTextToSize(p.notas.trim(), W - 2 * M);
      if (y + 6 + lineas.length * 4.4 > H - 22) { doc.addPage(); y = 22; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...TINTA); doc.text('OBSERVACIONES', M, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text(lineas, M, y); y += lineas.length * 4.4 + 5;
    }
    bloqueFirmasPdf(doc, y, p);
    piePdf(doc);
    descargar('pedido-armado-' + numero + '.pdf', doc.output('blob'));
  }
  function bloqueFirmasPdf(doc, y, p) {
    const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight(); const M = 16;
    if (y + 58 > H - 18) { doc.addPage(); y = 24; }
    y += 2;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TINTA); doc.text('AUTORIZACIÓN', M, y); y += 4.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
    doc.text('Firmas requeridas para que el Departamento de Armado proceda con este pedido.', M, y); y += 5;
    const gap = 14; const cw = (W - 2 * M - gap) / 2; const c = cfg();
    ROLES.forEach(([rol, titulo], i) => {
      const x = M + i * (cw + gap);
      const f = (p.firmas && p.firmas[rol]) || {};
      const nombre = (f.nombre || (rol === 'gerente' ? c.gerente : c.encargado) || '').trim();
      const lineaY = y + 24;
      if (imgOk(f.imagen)) { try { doc.addImage(f.imagen, 'PNG', x + (cw - 70) / 2, y + 1, 70, 21); } catch (e) { /* imagen no válida */ } }
      doc.setDrawColor(...TINTA); doc.setLineWidth(0.35); doc.line(x, lineaY, x + cw, lineaY);
      doc.setFontSize(9.5);
      if (nombre) { doc.setFont('helvetica', 'bold'); doc.setTextColor(...TINTA); doc.text(nombre, x, lineaY + 5); }
      else { doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRIS); doc.text('Nombre: _______________________________', x, lineaY + 5); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
      doc.text(titulo.toUpperCase(), x, lineaY + 10);
      doc.text('Fecha: ' + (f.fecha && imgOk(f.imagen) ? fmtFecha(f.fecha) : '______ / ______ / __________'), x, lineaY + 15);
    });
  }

  function generarPdfReporte() {
    const doc0 = ui.periodo === 'anio' ? null : statsMes(ui.mes);
    if (doc0 && !doc0.lineas.length) { toast('No hay pedido en ' + mesLabel(ui.mes) + ' para reportar.'); return; }
    const doc = nuevoPdf();
    if (!doc) return;
    if (ui.periodo === 'anio') pdfReporteAnio(doc, ui.mes.slice(0, 4));
    else pdfReporteMes(doc, doc0);
  }
  function pdfReporteMes(doc, st) {
    const p = st.pedido; const numero = (p && p.numero) || numeroPedido(st.mes);
    let y = encabezadoPdf(doc, 'REPORTE DE CUMPLIMIENTO', 'Suministro de unidades armadas · ' + mesLabel(st.mes).toUpperCase(), [
      ['N.º de pedido', numero], ['Fecha de procesado', p && p.fechaProcesado ? fmtFecha(p.fechaProcesado) : 'Pendiente'],
      ['Entregas registradas', st.recepciones.length], ['Fecha de emisión', fmtFecha(hoyISO())]
    ]);
    y = kpisPdf(doc, y, [['Pedidas', fmtN(st.pedida)], ['Recibidas', fmtN(st.recibida)], ['Restantes', fmtN(st.restante)], ['Cumplimiento', fmtPct(st.cumplimiento)], ['Entrega prom. (días)', fmtDias(st.diasPromedio)]]);
    const body = [];
    for (const g of agrupar(st.lineas)) {
      g.lineas.forEach((l, i) => {
        const row = [];
        if (i === 0) row.push({ content: g.nombre, rowSpan: g.lineas.length, styles: { fontStyle: 'bold', valign: 'middle' } });
        row.push(l.color, der(fmtN(l.pedida)), der(fmtN(l.recibida)), der(fmtN(l.restante)), der(fmtPct(ratio(l.valida, l.pedida))));
        body.push(row);
      });
      body.push([subtotal('Total ' + g.nombre, 2), derSub(fmtN(g.pedida)), derSub(fmtN(g.recibida)), derSub(fmtN(g.restante)), derSub(fmtPct(g.cumplimiento))]);
    }
    doc.autoTable(Object.assign({}, estiloTabla, {
      startY: y,
      head: [['MODELO', 'COLOR', der('PEDIDA'), der('RECIBIDA'), der('RESTANTE'), der('CUMPL.')]],
      body,
      foot: [[{ content: 'TOTAL', colSpan: 2 }, der(fmtN(st.pedida)), der(fmtN(st.recibida)), der(fmtN(st.restante)), der(fmtPct(st.cumplimiento))]],
      columnStyles: { 0: { cellWidth: 44 } }
    }));
    y = doc.lastAutoTable.finalY + 9;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TINTA);
    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 22; }
    doc.text('ENTREGAS RECIBIDAS', 16, y);
    if (st.recepciones.length) {
      doc.autoTable(Object.assign({}, estiloTabla, {
        startY: y + 3,
        head: [['FECHA', 'CONDUCE / FACTURA', der('UNIDADES'), der('DÍAS DESDE PROCESADO'), 'NOTA']],
        body: st.recepciones.map((r) => {
          const d = p && p.fechaProcesado ? diasEntre(p.fechaProcesado, r.fecha) : null;
          return [fmtFecha(r.fecha), r.conduce || '—', der(fmtN(r.unidades)), der(d == null ? '—' : d), r.nota || ''];
        })
      }));
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRIS); doc.text('Sin entregas registradas.', 16, y + 6);
    }
    piePdf(doc);
    descargar('cumplimiento-' + st.mes + '.pdf', doc.output('blob'));
  }
  function pdfReporteAnio(doc, anio) {
    const sa = statsAnio(anio);
    let y = encabezadoPdf(doc, 'REPORTE DE CUMPLIMIENTO', 'Suministro de unidades armadas · AÑO ' + anio, [
      ['Meses con pedido', sa.conPedido], ['Fecha de emisión', fmtFecha(hoyISO())]
    ]);
    y = kpisPdf(doc, y, [['Pedidas', fmtN(sa.pedida)], ['Recibidas', fmtN(sa.recibida)], ['Restantes', fmtN(sa.restante)], ['Cumplimiento', fmtPct(sa.cumplimiento)], ['Entrega prom. (días)', fmtDias(sa.diasPromedio)]]);
    doc.autoTable(Object.assign({}, estiloTabla, {
      startY: y,
      head: [['MES', 'N.º PEDIDO', 'ESTADO', 'PROCESADO', der('PEDIDA'), der('RECIBIDA'), der('RESTANTE'), der('CUMPL.')]],
      body: sa.meses.map((m) => {
        const p = m.pedido;
        if (!m.pedida) return [mesLabel(m.mes), { content: 'Sin pedido', colSpan: 7, styles: { textColor: GRIS } }];
        return [mesLabel(m.mes), (p && p.numero) || numeroPedido(m.mes), p && p.estado === 'procesado' ? 'Procesado' : 'Borrador', fmtFecha(p && p.fechaProcesado),
          der(fmtN(m.pedida)), der(fmtN(m.recibida)), der(fmtN(m.restante)), der(fmtPct(m.cumplimiento))];
      }),
      foot: [[{ content: 'TOTAL ' + anio, colSpan: 4 }, der(fmtN(sa.pedida)), der(fmtN(sa.recibida)), der(fmtN(sa.restante)), der(fmtPct(sa.cumplimiento))]]
    }));
    piePdf(doc);
    descargar('cumplimiento-' + anio + '.pdf', doc.output('blob'));
  }
  function celdaCsv(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function generarCsv() {
    const meses = ui.periodo === 'anio' ? statsAnio(ui.mes.slice(0, 4)).meses : [statsMes(ui.mes)];
    const filas = [['Mes', 'N.º de pedido', 'Estado', 'Fecha de procesado', 'Modelo', 'Color', 'Cantidad pedida', 'Cantidad recibida', 'Cantidad restante', 'Cumplimiento (%)']];
    for (const st of meses) {
      const p = st.pedido;
      for (const g of agrupar(st.lineas)) {
        for (const l of g.lineas) {
          const r = ratio(l.valida, l.pedida);
          filas.push([mesLabel(st.mes), (p && p.numero) || numeroPedido(st.mes), p && p.estado === 'procesado' ? 'Procesado' : 'Borrador', fmtFecha(p && p.fechaProcesado), g.nombre, l.color, l.pedida, l.recibida, l.restante, r == null ? '' : (Math.round(r * 1000) / 10)]);
        }
      }
    }
    if (filas.length === 1) { toast('No hay datos de pedidos en este periodo.'); return; }
    const nombre = 'cumplimiento-' + (ui.periodo === 'anio' ? ui.mes.slice(0, 4) : ui.mes) + '.csv';
    descargar(nombre, '﻿' + filas.map((f) => f.map(celdaCsv).join(',')).join('\r\n'));
  }

  async function descargar(nombre, data) {
    if (sync.downloads) {
      try {
        const r = await sync.downloads.save({ filename: nombre, data });
        if (r && r.status === 'saved') toast('Descargado: ' + nombre, 'ok');
      } catch (e) {
        const code = e && e.code;
        if (code === 'declined') return;
        if (code === 'rate_limited') toast('Ya hay una descarga esperando tu confirmación.');
        else toast('No se pudo descargar el archivo en esta vista.', 'bad');
      }
      return;
    }
    if (sync.enArtifact || sync.mode === 'nube') { toast('La descarga de archivos no está disponible en esta vista.', 'bad'); return; }
    try {
      const tipo = nombre.endsWith('.pdf') ? 'application/pdf' : nombre.endsWith('.csv') ? 'text/csv;charset=utf-8' : 'application/json';
      const blob = data instanceof Blob ? data : new Blob([data], { type: tipo });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre; a.hidden = true;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Descargado: ' + nombre, 'ok');
    } catch (e) {
      toast('No se pudo descargar el archivo.', 'bad');
    }
  }

  /* ================= avisos ================= */
  let toastTimer = null;
  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (kind === 'bad' ? ' bad' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'bad' ? 6000 : 3500);
  }

  /* ================= eventos ================= */
  function tabDeHash() { const h = (location.hash || '').replace('#', ''); return TABS.includes(h) ? h : 'pedido'; }
  function irTab(tab) {
    if (!TABS.includes(tab)) return;
    ui.confirm = '';
    if (location.hash !== '#' + tab) location.hash = tab;
    else { ui.tab = tab; scheduleRender(); }
    window.scrollTo(0, 0);
  }
  function cambiarMes(m) {
    if (!mesValido(m) || m === ui.mes) return;
    ui.mes = m;
    ui.procesando = false; ui.reabriendo = false; ui.confirm = '';
    ui.recep.qty = {};
    ui.picker.qty = {};
    scheduleRender();
  }
  function setRuta(obj, ruta, valor) {
    const partes = ruta.split('.');
    let o = obj;
    for (let i = 0; i < partes.length - 1; i++) { if (o[partes[i]] == null) o[partes[i]] = {}; o = o[partes[i]]; }
    o[partes[partes.length - 1]] = valor;
  }

  const acciones = {
    'mes-prev': () => cambiarMes(mesAdd(ui.mes, -1)),
    'mes-next': () => cambiarMes(mesAdd(ui.mes, 1)),
    'ir-tab': (el) => irTab(el.dataset.tab),
    'ir-mes': (el) => { cambiarMes(el.dataset.mes); ui.periodo = 'mes'; scheduleRender(); },
    'cargar-catalogo': () => cargarCatalogo(),
    'pk-guardar': () => guardarSelector(),
    'pk-addcolor': () => {
      if (agregarColorModelo(ui.picker.modeloId, ui.picker.nuevoColor)) { toast('Color agregado a ' + nombreModelo(ui.picker.modeloId), 'ok'); ui.picker.nuevoColor = ''; }
    },
    'ln-del': (el) => cambiarLinea(el.dataset.line, 0),
    'copiar-anterior': (el) => {
      const prev = getPedido(el.dataset.mes);
      if (!prev) return;
      const p = clonarPedido(ui.mes);
      p.lineas = lineasDe(prev).map((l) => ({ id: uid(), modeloId: l.modeloId, modelo: nombreModelo(l.modeloId, l.modelo), color: l.color, cantidad: entero(l.cantidad) }));
      guardarPedido(p);
      toast('Se copiaron ' + fmtN(totalPedido(p)) + ' unidades de ' + mesLabel(prev.mes) + '. Ajusta las cantidades que cambien.', 'ok');
    },
    'procesar-pedir': () => { ui.procesando = true; ui.procFecha = hoyISO(); scheduleRender(); },
    'procesar-cancel': () => { ui.procesando = false; scheduleRender(); },
    'procesar-ok': () => procesarPedido(),
    'reabrir-pedir': () => { ui.reabriendo = true; scheduleRender(); },
    'reabrir-cancel': () => { ui.reabriendo = false; scheduleRender(); },
    'reabrir-ok': () => reabrirPedido(),
    'pdf-pedido': () => generarPdfPedido(ui.mes),
    'sig-limpiar': (el) => {
      const pad = lienzos.get(ui.mes + ':' + el.dataset.rol);
      if (pad) { pad.ctx.clearRect(0, 0, pad.canvas.width, pad.canvas.height); pad.dirty = false; if (pad.canvas.parentElement) pad.canvas.parentElement.classList.remove('dirty'); }
    },
    'sig-guardar': (el) => guardarFirma(el.dataset.rol),
    'sig-borrar': (el) => {
      const p = clonarPedido(ui.mes);
      const f = p.firmas[el.dataset.rol] || {};
      p.firmas[el.dataset.rol] = { nombre: f.nombre || '' };
      guardarPedido(p);
    },
    'rc-llenar': () => {
      for (const l of statsMes(ui.mes).lineas) ui.recep.qty[l.id] = l.restante ? String(l.restante) : '';
      scheduleRender();
    },
    'rc-guardar': () => guardarRecepcion(),
    'confirm-pedir': (el) => { ui.confirm = el.dataset.key; scheduleRender(); },
    'confirm-cancel': () => { ui.confirm = ''; scheduleRender(); },
    'rec-del-ok': (el) => { ui.confirm = ''; put('recepciones', el.dataset.id, BORRAR); toast('Recepción eliminada'); },
    'periodo': (el) => { ui.periodo = el.dataset.p === 'anio' ? 'anio' : 'mes'; scheduleRender(); },
    'pdf-reporte': () => generarPdfReporte(),
    'csv-reporte': () => generarCsv(),
    'recl-filtro': (el) => { ui.reclFiltro = el.dataset.f; scheduleRender(); },
    'recl-estado': (el) => {
      const r = state.reclamaciones[el.dataset.id];
      if (!r) return;
      const n = clone(r);
      n.estado = el.dataset.estado;
      if (n.estado === 'enviada' && !n.enviadaFecha) n.enviadaFecha = hoyISO();
      if (n.estado === 'resuelta') n.resueltaFecha = hoyISO();
      else delete n.resueltaFecha;
      put('reclamaciones', el.dataset.id, n);
      if (ui.reclUltima === el.dataset.id) ui.reclUltima = '';
    },
    'recl-copiar': (el) => {
      const r = state.reclamaciones[el.dataset.id];
      if (r) copiar('Para: ' + correoReclamos() + '\nAsunto: ' + asuntoReclamo(r) + '\n\n' + textoReclamo(r), 'Texto del correo copiado');
    },
    'recl-del-ok': (el) => { ui.confirm = ''; put('reclamaciones', el.dataset.id, BORRAR); toast('Reclamación eliminada'); },
    'copiar-destino': () => copiar(correoReclamos(), 'Dirección copiada'),
    'copia-cerrar': () => { ui.copia = null; scheduleRender(); },
    'nm-abrir': (el) => {
      ui.nm.abierto = true;
      ui.nm.error = '';
      if (el.dataset.nombre) ui.nm.nombre = el.dataset.nombre.toUpperCase();
      ui.enfocar = el.dataset.nombre ? 'nm-otro' : 'nm-nombre';
      scheduleRender();
    },
    'nm-cerrar': () => { ui.nm = formModeloVacio(ui.nm.categoria); scheduleRender(); },
    'nm-color': (el) => {
      const c = el.dataset.color;
      const i = ui.nm.colores.findIndex((y) => normColor(y) === normColor(c));
      if (i >= 0) ui.nm.colores.splice(i, 1); else ui.nm.colores.push(c);
      ui.nm.error = '';
      scheduleRender();
    },
    'nm-otro': () => {
      if (!ui.nm.otroColor.trim()) { ui.enfocar = 'nm-otro'; scheduleRender(); return; }
      agregarColoresNm(ui.nm.otroColor);
      ui.nm.otroColor = '';
      ui.nm.error = '';
      ui.enfocar = 'nm-otro';
      scheduleRender();
    },
    'nm-crear': (el) => crearModelo(el.dataset.ctx),
    'cat-editar': (el) => { ui.cat.editId = el.dataset.id; ui.cat.editColor = ''; ui.cat.error = ''; ui.confirm = ''; scheduleRender(); },
    'cat-listo': () => { ui.cat.editId = ''; ui.cat.error = ''; ui.confirm = ''; scheduleRender(); },
    'cat-color-add': (el) => { if (agregarColorModelo(el.dataset.id, ui.cat.editColor)) ui.cat.editColor = ''; },
    'cat-color-del': (el) => {
      const m = state.modelos[el.dataset.id];
      if (!m) return;
      const n = clone(m);
      n.colores = (n.colores || []).filter((c) => c !== el.dataset.color);
      put('modelos', el.dataset.id, n);
    },
    'cat-toggle': (el) => {
      const m = state.modelos[el.dataset.id];
      if (!m) return;
      const n = clone(m);
      n.activo = m.activo === false;
      put('modelos', el.dataset.id, n);
    },
    'cat-del-pedir': (el) => {
      if (modeloEnUso(el.dataset.id)) { ui.cat.error = 'Este modelo aparece en pedidos o recepciones. Ocúltalo del pedido en lugar de eliminarlo.'; scheduleRender(); return; }
      ui.confirm = 'cat:' + el.dataset.id; scheduleRender();
    },
    'cat-del-ok': (el) => { ui.confirm = ''; ui.cat.editId = ''; put('modelos', el.dataset.id, BORRAR); toast('Modelo eliminado del catálogo'); },
    'cfg-guardar': () => guardarAjustes(),
    'respaldo-descargar': () => descargar('respaldo-pedidos-armado-' + hoyISO() + '.json', respaldoJSON()),
    'import-ok': () => importarRespaldo(),
    'import-cancel': () => { ui.importData = null; scheduleRender(); }
  };

  function enlazarEventos() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || el.disabled) return;
      const fn = acciones[el.dataset.action];
      if (!fn) return;
      if (el.tagName === 'TR' && e.target.closest('button, a, input')) return;
      fn(el, e);
    });

    document.addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.target.id === 'recl-form') registrarReclamo();
    });

    document.addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.bind) {
        setRuta(ui, el.dataset.bind, el.value);
        if (el.dataset.rerender && el.tagName !== 'SELECT') scheduleRender();
      }
      if (el.id && el.id.startsWith('pk-qty-')) ui.picker.qty[el.dataset.color] = el.value;
      if (el.dataset.recline) {
        ui.recep.qty[el.dataset.recline] = el.value;
        let total = 0;
        let excede = false;
        document.querySelectorAll('[data-recline]').forEach((i) => {
          const n = entero(i.value); total += n;
          if (n > Number(i.dataset.restante)) excede = true;
        });
        const t = $('#rc-total'); if (t) t.textContent = fmtN(total);
        const a = $('#rc-aviso'); if (a) a.textContent = excede ? 'Hay colores con más unidades que las pendientes; se registrarán como excedente.' : '';
      }
      if (el.id === 'recl-chasis') {
        const n = el.value.trim().length;
        const c = $('#recl-chasis-n'); if (c) c.textContent = n + '/17';
        const a = $('#recl-chasis-aviso');
        if (a) { const mal = n > 0 && n !== 17; a.textContent = mal ? 'El VIN suele tener 17 caracteres' : ''; a.className = mal ? 'warn' : ''; }
      }
    });

    document.addEventListener('change', (e) => {
      const el = e.target;
      if (el.id === 'mes-m' || el.id === 'mes-y') { cambiarMes($('#mes-y').value + '-' + $('#mes-m').value); return; }
      if (el.id === 'pk-modelo') { ui.picker.modeloId = el.value; ui.picker.qty = {}; ui.picker.nuevoColor = ''; scheduleRender(); return; }
      if (el.dataset.bind) {
        // Los campos de texto ya se guardan con «input»; al pulsar Enter el navegador
        // dispara «change» después de la acción y devolvería el texto ya usado.
        if (el.tagName === 'SELECT' || el.type === 'date') setRuta(ui, el.dataset.bind, el.value);
        if (el.id === 'recl-modelo') ui.recl.color = '';
        if (el.dataset.rerender) scheduleRender();
        return;
      }
      if (el.dataset.line) { cambiarLinea(el.dataset.line, el.value); return; }
      if (el.id === 'ped-notas') {
        const p = clonarPedido(ui.mes);
        if ((p.notas || '') === el.value) return;
        p.notas = el.value;
        guardarPedido(p);
        return;
      }
      if (el.id && el.id.startsWith('sig-nombre-')) {
        const p = clonarPedido(ui.mes);
        const rol = el.dataset.rol;
        p.firmas[rol] = Object.assign({}, p.firmas[rol] || {}, { nombre: el.value.trim() });
        guardarPedido(p);
        return;
      }
      if (el.id === 'cat-edit-nombre') {
        const nombre = el.value.trim().replace(/\s+/g, ' ').toUpperCase();
        const m = state.modelos[el.dataset.id];
        if (!m || !nombre || nombre === m.nombre) return;
        if (Object.entries(state.modelos).some(([id, x]) => id !== el.dataset.id && String(x.nombre).toUpperCase() === nombre)) { ui.cat.error = 'Ya existe un modelo llamado ' + nombre + '.'; scheduleRender(); return; }
        ui.cat.error = '';
        put('modelos', el.dataset.id, Object.assign(clone(m), { nombre }));
        return;
      }
      if (el.id === 'cat-edit-cat') {
        const m = state.modelos[el.dataset.id];
        if (m) put('modelos', el.dataset.id, Object.assign(clone(m), { categoria: el.value }));
        return;
      }
      if (el.id === 'respaldo-archivo' && el.files && el.files[0]) { leerRespaldo(el.files[0]); el.value = ''; }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const el = e.target;
      if (el.id === 'pk-newcolor') { e.preventDefault(); acciones['pk-addcolor'](); }
      else if (el.id === 'nm-otro') { e.preventDefault(); acciones['nm-otro'](); }
      else if (el.id === 'nm-nombre') { e.preventDefault(); const o = document.getElementById('nm-otro'); if (o) o.focus(); }
      else if (el.id === 'cat-edit-color') { e.preventDefault(); const b = document.querySelector('[data-action="cat-color-add"]'); if (b) acciones['cat-color-add'](b); }
      else if (el.dataset && el.dataset.line) { e.preventDefault(); el.blur(); }
    });

    // Información emergente del gráfico
    document.addEventListener('pointermove', (e) => {
      const tip = $('#chart-tip');
      if (!tip) return;
      const hit = e.target.closest && e.target.closest('.hit');
      if (!hit) { tip.hidden = true; return; }
      const box = $('#chart').getBoundingClientRect();
      tip.textContent = hit.dataset.tip;
      tip.style.left = Math.max(70, Math.min(box.width - 70, e.clientX - box.left)) + 'px';
      tip.style.top = (e.clientY - box.top) + 'px';
      tip.hidden = false;
    });

    window.addEventListener('hashchange', () => { ui.tab = tabDeHash(); ui.confirm = ''; scheduleRender(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
}());
