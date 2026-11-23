// Empaqueta la aplicación en un solo archivo HTML (estilos y scripts en línea)
// para publicarla como Artifact de claude.ai.
// Uso: node build-artifact.mjs [ruta-de-salida]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const leer = (f) => readFileSync(join(dir, f), 'utf8');
const html = leer('index.html');

function bloque(nombre) {
  const m = html.match(new RegExp(`<!-- artifact:${nombre}:start -->([\\s\\S]*?)<!-- artifact:${nombre}:end -->`));
  if (!m) throw new Error(`No se encontró el bloque artifact:${nombre} en index.html`);
  return m[1].trim();
}
const script = (code) => `<script>\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`;

const salida = [
  bloque('head'),
  `<style>\n${leer('styles.css')}\n</style>`,
  bloque('body'),
  script(leer('catalogo.js')),
  script(leer('app.js')),
  ''
].join('\n');

const destino = process.argv[2] || join(dir, 'dist', 'pedidos-armado.html');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, salida);
console.log(`Listo: ${destino} (${(salida.length / 1024).toFixed(1)} KB)`);
