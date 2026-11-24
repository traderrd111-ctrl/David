#!/usr/bin/env python3
"""Genera pedidos/datos.js a partir de las planillas de pedidos/fuentes/.

Uso:
    python3 pedidos/herramientas/generar_datos.py

Lee las planillas tal cual fueron recibidas (separadas por "|"), completa las
filas de continuación, traduce colores y mercados al español, agrupa los
modelos por familia y deja anotadas las inconsistencias que encuentra en la
planilla. Si aparece un color o un mercado sin traducción, el script se detiene
y avisa cuál falta, para que se agregue en los diccionarios de abajo.
"""

import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FUENTES = RAIZ / "fuentes"
SALIDA = RAIZ / "datos.js"

MESES = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}

MERCADOS = {
    "DOM/PER": "Rep. Dominicana / Perú",
    "DOM": "Rep. Dominicana",
    "PER": "Perú",
    "ZAF": "Sudáfrica",
    "USA": "Estados Unidos",
    "USA(AMA)": "Estados Unidos (AMA)",
    "PHL": "Filipinas",
    "THA": "Tailandia",
    "CAN": "Canadá",
    "AUS": "Australia",
    "EUR": "Europa",
    "FRA(FIM)": "Francia (FIM)",
    "": "Sin especificar",
}

# Nombre de color tal como aparece en la planilla (en mayúsculas) -> español.
COLORES = {
    "WHITE": "Blanco",
    "BLUE": "Azul",
    "GREEN": "Verde",
    "GRAY": "Gris",
    "BLACK": "Negro",
    "ORANGE": "Naranja",
    "CAMO": "Camuflaje",
    "MAT LIGHT GRAY METALLIC 4": "Gris claro metalizado mate 4",
    "MAT DARK GRAY METALLIC 6": "Gris oscuro metalizado mate 6",
    "MAT DARK GRAY METALLIC 9": "Gris oscuro metalizado mate 9",
    "MAT DARK GRAY METALLIC D": "Gris oscuro metalizado mate D",
    "MAT YELLOWISH GRAY METALLIC 2": "Gris amarillento metalizado mate 2",
    "MAT GRAYISH YELLOW METALLIC 2": "Amarillo grisáceo metalizado mate 2",
    "MAT DARK PURPPLISH BLUE ME 1": "Azul violáceo oscuro metalizado mate 1",
    "DEEP PURPLISH BLUE METALLIC C": "Azul violáceo profundo metalizado C",
    "DEEP PURPLISH BLUE SOLID E": "Azul violáceo profundo sólido E",
    "DARK PURPLISH BLUE SOLID N": "Azul violáceo oscuro sólido N",
    "BLUE SOLID A": "Azul sólido A",
    "CYAN SOLID A": "Cian sólido A",
    "VIVID RED SOLID K": "Rojo vivo sólido K",
    "BLUISH WHITE METALLIC 2": "Blanco azulado metalizado 2",
    "BLUISH WHITE PEARL 1": "Blanco azulado perlado 1",
    "PURPLISH WHITE SOLID 1": "Blanco violáceo sólido 1",
    "SILKY WHITE": "Blanco sedoso",
    "BLUISH GRAY COCKTAIL 2": "Gris azulado cóctel 2",
    "DARK BLUISH GRAY METALLIC 7": "Gris azulado oscuro metalizado 7",
    "DARK GRAY METALLIC G": "Gris oscuro metalizado G",
    "BLACK METALLIC X": "Negro metalizado X",
    "BALCK METALLIC X": "Negro metalizado X",
    "BLACK METALLIC J": "Negro metalizado J",
    "LIGHT REDDISH YELLOW SOLID 1": "Amarillo rojizo claro sólido 1",
    "DARK GRAYISH YELLOW SOLID 1": "Amarillo grisáceo oscuro sólido 1",
    "DARK GRAYISH LEAF GREEN SL 5": "Verde hoja grisáceo oscuro SL 5",
    "LIGHT LEAF GREEN SOLID 8": "Verde hoja claro sólido 8",
}

# Cuando una fila trae el código de color pero no el nombre, se toma el nombre
# que ese mismo código tiene en otras filas de la planilla.
NOMBRE_POR_CODIGO = {
    "MLNM4": "MAT LIGHT GRAY METALLIC 4",
    "MDNM6": "MAT DARK GRAY METALLIC 6",
    "DPBMC": "DEEP PURPLISH BLUE METALLIC C",
    "SMX": "BLACK METALLIC X",
    "BWM2": "BLUISH WHITE METALLIC 2",
    "BWP1": "BLUISH WHITE PEARL 1",
    "PWS1": "PURPLISH WHITE SOLID 1",
    "SW": "SILKY WHITE",
}

# Tono que corresponde a cada código de color; sirve para detectar filas donde
# el código y el nombre no coinciden.
TONO_POR_CODIGO = {
    "DPBMC": "BLUE",
    "DPBSE": "BLUE",
    "SBE": "BLUE",
    "SMX": "BLACK",
    "MBL2": "BLACK",
    "PWS1": "WHITE",
    "BWM2": "WHITE",
    "BWC1": "WHITE",
    "MLNM4": "GRAY",
    "MDNM6": "GRAY",
    "MDNMD": "GRAY",
}

# Muestra aproximada de cada color, solo como ayuda visual.
MUESTRAS = {
    "Blanco": "#f3f2ee",
    "Azul": "#24368f",
    "Verde": "#2f7d3b",
    "Gris": "#8b8f94",
    "Negro": "#1b1c1f",
    "Naranja": "#e2671c",
    "Camuflaje": "linear-gradient(135deg,#5d5a3a 0 35%,#3b4a2b 35% 65%,#8b7b51 65%)",
    "Gris claro metalizado mate 4": "#a6a9ac",
    "Gris oscuro metalizado mate 6": "#46494e",
    "Gris oscuro metalizado mate 9": "#4c4f55",
    "Gris oscuro metalizado mate D": "#3e4146",
    "Gris amarillento metalizado mate 2": "#8e8a74",
    "Amarillo grisáceo metalizado mate 2": "#8f8565",
    "Azul violáceo oscuro metalizado mate 1": "#2b2f56",
    "Azul violáceo profundo metalizado C": "#232c70",
    "Azul violáceo profundo sólido E": "#26358e",
    "Azul violáceo oscuro sólido N": "#283068",
    "Azul sólido A": "#2c62c6",
    "Cian sólido A": "#17a3c7",
    "Rojo vivo sólido K": "#c81f2b",
    "Blanco azulado metalizado 2": "#e2e7ee",
    "Blanco azulado perlado 1": "#e8edf4",
    "Blanco violáceo sólido 1": "#eeedf4",
    "Blanco sedoso": "#efece4",
    "Gris azulado cóctel 2": "#6b7a8a",
    "Gris azulado oscuro metalizado 7": "#3e4a5a",
    "Gris oscuro metalizado G": "#4f535a",
    "Negro metalizado X": "#1e1f23",
    "Negro metalizado J": "#1c1d21",
    "Amarillo rojizo claro sólido 1": "#f1ae2f",
    "Amarillo grisáceo oscuro sólido 1": "#8a7d4e",
    "Verde hoja grisáceo oscuro SL 5": "#4a5a3e",
    "Verde hoja claro sólido 8": "#7db141",
}

# Ediciones especiales que aparecen en la columna REMARKS.
EDICIONES = [
    ("50th Anniversary version", "Edición 50.º aniversario"),
    ("70th Anniversary version", "Edición 70.º aniversario"),
    ("70th anniversary", "Edición 70.º aniversario"),
    ("3rd colour", "Tercer color"),
]

NOMBRES_COMERCIALES = {
    "TENERE700": "Ténéré 700",
    "TRACER9 GT+": "Tracer 9 GT+",
    "TRACER9 GT": "Tracer 9 GT",
    "TRACER 9": "Tracer 9",
    "MT-10SP": "MT-10 SP",
    "SEROW250": "Serow 250",
    "KODIAK450": "Kodiak 450",
    "GRIZZLY700": "Grizzly 700",
    "RAPTOR700R": "Raptor 700R",
}

# Palabras de las versiones de cuatriciclos que se traducen.
PALABRAS_VERSION = {"STD": "Estándar", "CAMO": "Camuflaje", "HUNTING": "Caza"}


def slug(texto):
    texto = texto.replace("+", " plus ")
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", texto.lower()).strip("-")


def nombre_comercial(texto):
    return NOMBRES_COMERCIALES.get(texto.upper(), texto)


def leer(ruta, columnas):
    filas = []
    for numero, linea in enumerate(ruta.read_text(encoding="utf-8").splitlines(), start=1):
        if not linea.strip() or linea.startswith("#"):
            continue
        campos = [c.strip() for c in linea.split("|")]
        if len(campos) != columnas:
            sys.exit(f"{ruta.name}:{numero}: se esperaban {columnas} columnas y hay {len(campos)}")
        filas.append((numero, campos))
    return filas


def fecha(texto, contexto):
    mes, anio = texto.split("-")
    if mes.upper() not in MESES:
        sys.exit(f"{contexto}: mes desconocido en «{texto}»")
    return f"20{anio}-{MESES[mes.upper()]:02d}"


def traducir_color(original, contexto):
    clave = original.upper()
    if clave not in COLORES:
        sys.exit(f"{contexto}: falta traducir el color «{original}» en COLORES")
    return COLORES[clave]


def separar_edicion(observacion):
    """Devuelve (nombre comercial base, edición traducida)."""
    for ingles, espanol in EDICIONES:
        if observacion.lower().endswith(ingles.lower()):
            base = observacion[: -len(ingles)].strip()
            return base, espanol
    return observacion, ""


class Avisos:
    def __init__(self):
        self.lista = []

    def agregar(self, archivo, linea, texto):
        self.lista.append({"archivo": archivo, "linea": linea, "texto": texto})


def armar_variante(codigo, variante, color_codigo, color_original, contexto, avisos, archivo, linea):
    datos = {"codigo": codigo, "variante": variante, "colorCodigo": color_codigo}
    nombre = color_original
    if not nombre and color_codigo in NOMBRE_POR_CODIGO:
        nombre = NOMBRE_POR_CODIGO[color_codigo]
        datos["nombreDeducido"] = True
    if nombre:
        datos["color"] = traducir_color(nombre, contexto)
        datos["muestra"] = MUESTRAS.get(datos["color"])
        if datos["muestra"] is None:
            sys.exit(f"{contexto}: falta la muestra del color «{datos['color']}» en MUESTRAS")
    else:
        datos["color"] = f"Color {color_codigo}"
        datos["muestra"] = None
        datos["sinNombre"] = True
        avisos.agregar(archivo, linea, f"El color {color_codigo} ({codigo}-{variante}) no tiene nombre en la planilla.")

    tono = TONO_POR_CODIGO.get(color_codigo)
    if tono and color_original:
        normalizado = color_original.upper().replace("BALCK", "BLACK")
        if tono not in normalizado:
            texto = (f"La planilla indica el código de color {color_codigo} con el nombre "
                     f"«{color_original}». Verificar antes de confirmar.")
            datos["aviso"] = texto
            avisos.agregar(archivo, linea, f"{codigo}-{variante}: {texto}")
    return datos


def leer_motocicletas(avisos):
    archivo = "motocicletas.txt"
    filas = leer(FUENTES / archivo, 12)
    lotes = []
    actual = None

    for indice, (linea, campos) in enumerate(filas):
        modelo, anio, obs, spec, inicio, fin, codigo, variante, _pack, _n, color_codigo, color_nombre = campos
        contexto = f"{archivo}:{linea}"

        if not codigo:
            avisos.agregar(archivo, linea,
                           f"Fila con color {color_codigo} {color_nombre}".strip()
                           + " sin código de modelo ni variante: no se incluyó.")
            continue

        es_encabezado = any([modelo, anio, obs, spec, inicio, fin])
        if es_encabezado:
            if not modelo:
                modelo, motivo = deducir_modelo(filas, indice, obs, codigo, lotes)
                avisos.agregar(archivo, linea, f"El lote {codigo} no tiene modelo en la planilla; se asignó {modelo} ({motivo}).")
            if spec not in MERCADOS:
                sys.exit(f"{contexto}: falta traducir el mercado «{spec}» en MERCADOS")
            if not spec:
                avisos.agregar(archivo, linea, f"El lote {codigo} ({modelo}) no indica mercado.")
            if not anio:
                avisos.agregar(archivo, linea, f"El lote {codigo} ({modelo} {obs}) no indica año de modelo.")
            base, edicion = separar_edicion(obs)
            actual = {
                "linea": linea,
                "modelo": modelo,
                "anio": int("20" + anio) if anio else None,
                "base": nombre_comercial(base) if base else "",
                "edicion": edicion,
                "mercadoCodigo": spec,
                "mercado": MERCADOS[spec],
                "inicio": fecha(inicio, contexto),
                "fin": fecha(fin, contexto),
                "variantes": [],
            }
            if actual["fin"] < actual["inicio"]:
                avisos.agregar(archivo, linea, f"El lote {codigo} ({modelo} {anio}) termina la producción ({fin}) antes de empezarla ({inicio}).")
            lotes.append(actual)

        actual["variantes"].append(
            armar_variante(codigo, variante, color_codigo, color_nombre, contexto, avisos, archivo, linea)
        )

    # Mismo color (código y nombre) repetido dentro de un lote.
    for lote in lotes:
        vistos = {}
        for v in lote["variantes"]:
            clave = (v["colorCodigo"], v["color"])
            if clave in vistos:
                texto = f"{vistos[clave]} y {v['codigo']}-{v['variante']} figuran con el mismo color ({v['color']})."
                v.setdefault("aviso", texto)
                avisos.agregar(archivo, lote["linea"], texto)
            vistos[clave] = f"{v['codigo']}-{v['variante']}"

    # Mismo código de modelo en distintos años.
    por_codigo = {}
    for lote in lotes:
        for v in lote["variantes"]:
            por_codigo.setdefault((v["codigo"], v["variante"]), []).append(lote)
    for (codigo, variante), lista in por_codigo.items():
        anios = sorted({l["anio"] for l in lista if l["anio"]})
        if len(lista) > 1:
            avisos.agregar(archivo, lista[0]["linea"],
                           f"El código {codigo}-{variante} se repite en los años {', '.join(map(str, anios))}.")

    # El nombre de la familia sale del nombre comercial cuando el modelo usa uno solo.
    bases_por_modelo = {}
    for lote in lotes:
        bases_por_modelo.setdefault(lote["modelo"], set()).add(lote["base"])
    for lote in lotes:
        bases = bases_por_modelo[lote["modelo"]]
        familia = next(iter(bases)) if len(bases) == 1 and "" not in bases else lote["modelo"]
        lote["familia"] = familia
        partes = []
        if lote["base"] and lote["base"] != familia:
            partes.append(lote["base"])
        if lote["edicion"]:
            partes.append(lote["edicion"])
        lote["edicion"] = " · ".join(partes)
        lote["extras"] = []
        lote["categoria"] = "Motocicletas"
        for v in lote["variantes"]:
            v["id"] = f"{v['codigo']}-{v['variante']}-{lote['anio'] or 'sa'}"
    return lotes


def deducir_modelo(filas, indice, obs, codigo, lotes):
    if obs and lotes and lotes[-1]["base"] and separar_edicion(obs)[0] and nombre_comercial(separar_edicion(obs)[0]) == lotes[-1]["base"]:
        return lotes[-1]["modelo"], f"mismo nombre comercial que la fila anterior: {obs}"
    for _, campos in filas[indice + 1:]:
        if campos[0] and campos[6][:3] == codigo[:3]:
            return campos[0], f"el código {codigo} es de la misma serie que {campos[6]}"
    sys.exit(f"No se pudo deducir el modelo del lote {codigo}")


def leer_cuatriciclos(avisos):
    archivo = "cuatriciclos.txt"
    filas = leer(FUENTES / archivo, 6)
    items = []
    anio = None
    for linea, (modelo, nombre, techo, malacate, anio_txt, color) in filas:
        if anio_txt:
            anio = int("20" + anio_txt)
        if modelo:
            items.append({"linea": linea, "modelo": modelo, "nombre": nombre, "anio": anio,
                          "malacate": bool(malacate), "techo": bool(techo), "colores": []})
        elif nombre:
            items[-1]["nombre"] += " " + nombre
        if color:
            items[-1]["colores"].append(color)

    lotes = []
    nombres_por_codigo = {}
    for item in items:
        primera, *resto = item["nombre"].split()
        familia = nombre_comercial(primera)
        version = " ".join(PALABRAS_VERSION.get(p.upper(), p) for p in resto)
        nombres_por_codigo.setdefault(item["nombre"], set()).add(item["modelo"])
        contexto = f"{archivo}:{item['linea']}"
        lote = {
            "linea": item["linea"],
            "modelo": item["modelo"],
            "anio": item["anio"],
            "familia": familia,
            "edicion": version,
            "mercadoCodigo": "",
            "mercado": "",
            "inicio": "",
            "fin": "",
            "extras": [e for e, activo in (("Con malacate", item["malacate"]), ("Con techo", item["techo"])) if activo],
            "categoria": "Cuatriciclos",
            "variantes": [],
        }
        for color in item["colores"]:
            v = armar_variante(item["modelo"], "", "", color, contexto, avisos, archivo, item["linea"])
            v["id"] = f"{slug(item['modelo'])}-{item['anio']}-{slug(color)}"
            lote["variantes"].append(v)
        lotes.append(lote)

    for nombre, codigos in nombres_por_codigo.items():
        if len(codigos) > 1:
            texto = f"Los modelos {' y '.join(sorted(codigos))} figuran con el mismo nombre ({nombre}). Verificar si YFM700 corresponde a otra versión."
            primera = min(l["linea"] for l in lotes if l["modelo"] in codigos)
            avisos.agregar(archivo, primera, texto)
            for lote in lotes:
                if lote["modelo"] in codigos:
                    lote["aviso"] = texto
    return lotes


def armar_catalogo():
    avisos = Avisos()
    lotes = leer_motocicletas(avisos) + leer_cuatriciclos(avisos)

    familias = {}
    for lote in lotes:
        clave = (lote["categoria"], lote["familia"])
        if clave not in familias:
            familias[clave] = {
                "id": slug(f"{lote['categoria']}-{lote['familia']}"),
                "nombre": lote["familia"],
                "categoria": lote["categoria"],
                "modelos": [],
                "lotes": [],
            }
        familia = familias[clave]
        if lote["modelo"] not in familia["modelos"]:
            familia["modelos"].append(lote["modelo"])
        familia["lotes"].append(lote)

    ids_familia = [f["id"] for f in familias.values()]
    if len(ids_familia) != len(set(ids_familia)):
        sys.exit(f"Identificadores de familia repetidos: {sorted(i for i in ids_familia if ids_familia.count(i) > 1)}")

    ids = set()
    for familia in familias.values():
        familia["lotes"].sort(key=lambda l: (l["anio"] or 9999, l["mercado"], l["inicio"], l["modelo"]))
        for n, lote in enumerate(familia["lotes"], start=1):
            lote["id"] = f"{familia['id']}-{n}"
            for campo in ("base", "linea", "familia", "categoria"):
                lote.pop(campo, None)
            for v in lote["variantes"]:
                if v["id"] in ids:
                    sys.exit(f"Identificador repetido: {v['id']}")
                ids.add(v["id"])

    return {
        "generado": date.today().isoformat(),
        "familias": list(familias.values()),
        "avisos": avisos.lista,
    }


def escribir(catalogo):
    partes = [
        "// Archivo generado por herramientas/generar_datos.py a partir de fuentes/*.txt.",
        "// No editar a mano: corregir la planilla o el script y volver a generarlo.",
        "window.CATALOGO = {",
        f'  "generado": {json.dumps(catalogo["generado"])},',
        '  "familias": [',
    ]
    familias = []
    for familia in catalogo["familias"]:
        cabecera = {k: v for k, v in familia.items() if k != "lotes"}
        lotes = ",\n".join("      " + json.dumps(l, ensure_ascii=False) for l in familia["lotes"])
        familias.append(
            "    " + json.dumps(cabecera, ensure_ascii=False)[:-1] + ', "lotes": [\n' + lotes + "\n    ]}"
        )
    partes.append(",\n".join(familias))
    partes.append("  ],")
    avisos = ",\n".join("    " + json.dumps(a, ensure_ascii=False) for a in catalogo["avisos"])
    partes.append('  "avisos": [\n' + avisos + "\n  ]")
    partes.append("};")
    SALIDA.write_text("\n".join(partes) + "\n", encoding="utf-8")


def main():
    catalogo = armar_catalogo()
    escribir(catalogo)
    variantes = sum(len(l["variantes"]) for f in catalogo["familias"] for l in f["lotes"])
    lotes = sum(len(f["lotes"]) for f in catalogo["familias"])
    print(f"{len(catalogo['familias'])} familias, {lotes} lotes, {variantes} variantes de color -> {SALIDA}")
    print(f"{len(catalogo['avisos'])} avisos:")
    for aviso in catalogo["avisos"]:
        print(f"  {aviso['archivo']}:{aviso['linea']}: {aviso['texto']}")


if __name__ == "__main__":
    main()
