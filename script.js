const motores = [
  {
    nombre: "Motor 1.6L Nafta",
    tipo: "auto",
    specs: "4 cilindros · 110 HP · Inyección electrónica",
    precio: "$850.000",
    icono: "🚗",
  },
  {
    nombre: "Motor 2.0L Turbo Diésel",
    tipo: "auto",
    specs: "4 cilindros · 150 HP · Common Rail",
    precio: "$1.350.000",
    icono: "🚙",
  },
  {
    nombre: "Motor V6 3.5L",
    tipo: "auto",
    specs: "6 cilindros · 280 HP · Aspiración natural",
    precio: "$2.100.000",
    icono: "🏎️",
  },
  {
    nombre: "Motor Monocilíndrico 150cc",
    tipo: "moto",
    specs: "1 cilindro · 12 HP · Refrigeración por aire",
    precio: "$320.000",
    icono: "🏍️",
  },
  {
    nombre: "Motor Bicilíndrico 250cc",
    tipo: "moto",
    specs: "2 cilindros · 25 HP · Refrigeración líquida",
    precio: "$540.000",
    icono: "🛵",
  },
  {
    nombre: "Motor Deportivo 600cc",
    tipo: "moto",
    specs: "4 cilindros · 95 HP · Inyección múltiple",
    precio: "$980.000",
    icono: "🏍️",
  },
];

const grid = document.getElementById("product-grid");
const filterButtons = document.querySelectorAll(".filter-btn");

function renderMotores(filtro) {
  const items = filtro === "todos" ? motores : motores.filter((m) => m.tipo === filtro);

  grid.innerHTML = items
    .map(
      (m) => `
      <article class="card">
        <div class="card-media">${m.icono}</div>
        <div class="card-body">
          <span class="card-tag">${m.tipo}</span>
          <h3>${m.nombre}</h3>
          <p class="card-specs">${m.specs}</p>
          <p class="card-price">${m.precio}</p>
        </div>
      </article>
    `
    )
    .join("");
}

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderMotores(btn.dataset.filter);
  });
});

renderMotores("todos");

document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("contact-form");
const feedback = document.getElementById("form-feedback");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  if (!form.checkValidity()) {
    feedback.textContent = "Por favor completá todos los campos correctamente.";
    return;
  }

  feedback.textContent = "¡Gracias! Tu consulta fue enviada.";
  form.reset();
});
