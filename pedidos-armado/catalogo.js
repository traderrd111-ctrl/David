/*
 * Catálogo base de motocicletas Yamaha.
 * Se usa para llenar el catálogo la primera vez o para agregar los modelos
 * que falten. Los colores se pueden editar desde la pestaña «Catálogo».
 */
window.CATALOGO_YAMAHA = {
  categorias: [
    'Calle y trabajo',
    'Scooter',
    'Doble propósito',
    'Deportiva y naked',
    'Aventura y touring',
    'Competencia',
    'Infantil y recreativa',
    'ATV / Cuatrimoto'
  ],
  modelos: [
    // Calle y trabajo
    { nombre: 'CRUX', categoria: 'Calle y trabajo', colores: ['Negro', 'Azul', 'Rojo', 'Marrón'] },
    { nombre: 'CRYPTON', categoria: 'Calle y trabajo', colores: ['Negro', 'Rojo', 'Gris'] },
    { nombre: 'YCZ110', categoria: 'Calle y trabajo', colores: ['Negro', 'Azul', 'Rojo'] },
    { nombre: 'YB125', categoria: 'Calle y trabajo', colores: ['Negro', 'Rojo', 'Azul'] },
    { nombre: 'YBR125', categoria: 'Calle y trabajo', colores: ['Negro', 'Rojo', 'Azul'] },
    { nombre: 'DT125', categoria: 'Calle y trabajo', colores: ['Azul', 'Verde', 'Blanco'] },
    { nombre: 'AG200', categoria: 'Calle y trabajo', colores: ['Azul'] },
    { nombre: 'FZ125', categoria: 'Calle y trabajo', colores: ['Azul', 'Negro', 'Gris'] },
    { nombre: 'FZ150', categoria: 'Calle y trabajo', colores: ['Azul', 'Negro', 'Gris'] },
    { nombre: 'FZ250', categoria: 'Calle y trabajo', colores: ['Azul', 'Negro', 'Gris'] },
    { nombre: 'XSR155', categoria: 'Calle y trabajo', colores: ['Azul', 'Negro', 'Gris'] },

    // Scooter
    { nombre: 'RAY Z', categoria: 'Scooter', colores: ['Azul', 'Blanco', 'Verde'] },
    { nombre: 'BWS 125', categoria: 'Scooter', colores: ['Azul', 'Negro', 'Blanco'] },
    { nombre: 'FASCINO 125', categoria: 'Scooter', colores: ['Azul', 'Rojo', 'Blanco'] },
    { nombre: 'AEROX 155', categoria: 'Scooter', colores: ['Azul', 'Negro', 'Gris'] },
    { nombre: 'NMAX 155', categoria: 'Scooter', colores: ['Azul', 'Negro', 'Gris', 'Blanco'] },
    { nombre: 'XMAX 300', categoria: 'Scooter', colores: ['Azul', 'Negro', 'Gris'] },

    // Doble propósito
    { nombre: 'XTZ125', categoria: 'Doble propósito', colores: ['Azul', 'Negro', 'Blanco'] },
    { nombre: 'XTZ150', categoria: 'Doble propósito', colores: ['Azul', 'Negro', 'Blanco'] },
    { nombre: 'XTZ250', categoria: 'Doble propósito', colores: ['Azul', 'Negro', 'Blanco'] },

    // Deportiva y naked
    { nombre: 'MT15', categoria: 'Deportiva y naked', colores: ['Azul', 'Negro', 'Gris'] },
    { nombre: 'MT03', categoria: 'Deportiva y naked', colores: ['Azul', 'Negro', 'Gris'] },
    { nombre: 'MT07', categoria: 'Deportiva y naked', colores: ['Azul', 'Negro', 'Gris'] },
    { nombre: 'MT09', categoria: 'Deportiva y naked', colores: ['Azul', 'Negro', 'Gris'] },
    { nombre: 'MT10', categoria: 'Deportiva y naked', colores: ['Azul', 'Negro', 'Gris'] },
    { nombre: 'YZF-R15', categoria: 'Deportiva y naked', colores: ['Azul', 'Negro', 'Gris'] },
    { nombre: 'YZF-R3', categoria: 'Deportiva y naked', colores: ['Azul', 'Negro'] },
    { nombre: 'YZF-R7', categoria: 'Deportiva y naked', colores: ['Azul', 'Negro'] },
    { nombre: 'YZF-R1', categoria: 'Deportiva y naked', colores: ['Azul', 'Negro'] },
    { nombre: 'XSR700', categoria: 'Deportiva y naked', colores: ['Azul', 'Negro', 'Gris'] },
    { nombre: 'XSR900', categoria: 'Deportiva y naked', colores: ['Azul', 'Negro', 'Gris'] },

    // Aventura y touring
    { nombre: 'TENERE', categoria: 'Aventura y touring', colores: ['Gris', 'Azul', 'Negro'] },
    { nombre: 'TRACER 9', categoria: 'Aventura y touring', colores: ['Gris', 'Azul', 'Negro'] },

    // Competencia (motocross / enduro)
    { nombre: 'YZ65', categoria: 'Competencia', colores: ['Azul', 'Blanco'] },
    { nombre: 'YZ85', categoria: 'Competencia', colores: ['Azul'] },
    { nombre: 'YZ85LW', categoria: 'Competencia', colores: ['Azul'] },
    { nombre: 'YZ125', categoria: 'Competencia', colores: ['Azul', 'Blanco'] },
    { nombre: 'YZ125X', categoria: 'Competencia', colores: ['Azul', 'Blanco'] },
    { nombre: 'YZ125FX', categoria: 'Competencia', colores: ['Azul', 'Blanco'] },
    { nombre: 'YZ250', categoria: 'Competencia', colores: ['Azul'] },
    { nombre: 'YZ250X', categoria: 'Competencia', colores: ['Azul'] },
    { nombre: 'YZ250F', categoria: 'Competencia', colores: ['Azul', 'Blanco'] },
    { nombre: 'YZ250FX', categoria: 'Competencia', colores: ['Azul', 'Blanco'] },
    { nombre: 'YZ450F', categoria: 'Competencia', colores: ['Azul', 'Blanco'] },
    { nombre: 'YZ450FX', categoria: 'Competencia', colores: ['Azul', 'Blanco'] },
    { nombre: 'WR250F', categoria: 'Competencia', colores: ['Azul'] },
    { nombre: 'WR450', categoria: 'Competencia', colores: ['Azul', 'Blanco'] },

    // Infantil y recreativa
    { nombre: 'PW50', categoria: 'Infantil y recreativa', colores: ['Azul'] },
    { nombre: 'TTR50', categoria: 'Infantil y recreativa', colores: ['Azul'] },
    { nombre: 'TTR110', categoria: 'Infantil y recreativa', colores: ['Azul'] },
    { nombre: 'TTR125', categoria: 'Infantil y recreativa', colores: ['Azul'] },
    { nombre: 'TTR230', categoria: 'Infantil y recreativa', colores: ['Azul'] },

    // ATV / Cuatrimoto
    { nombre: 'RAPTOR 90', categoria: 'ATV / Cuatrimoto', colores: ['Azul', 'Negro/Blanco'] },
    { nombre: 'RAPTOR 110', categoria: 'ATV / Cuatrimoto', colores: ['Azul'] },
    { nombre: 'RAPTOR 700', categoria: 'ATV / Cuatrimoto', colores: ['Azul', 'Naranja/ES', 'Negro/ES', 'Celeste'] },
    { nombre: 'YFZ450R', categoria: 'ATV / Cuatrimoto', colores: ['Azul'] },
    { nombre: 'GRIZZLY 700', categoria: 'ATV / Cuatrimoto', colores: ['Verde', 'Rojo', 'Camuflaje'] },
    { nombre: 'KODIAK 450', categoria: 'ATV / Cuatrimoto', colores: ['Verde', 'Rojo'] },
    { nombre: 'KODIAK 700', categoria: 'ATV / Cuatrimoto', colores: ['Verde', 'Rojo'] }
  ]
};
