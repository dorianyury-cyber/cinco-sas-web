// Comportamiento compartido por todas las páginas: menú móvil y año dinámico
// en el pie de página (para no repetir el error del sitio anterior, que
// quedó con "Copyright 2020" fijo y desactualizado).
document.getElementById("navToggle")?.addEventListener("click", () => {
  document.querySelector("nav.main-nav")?.classList.toggle("open");
});

document.querySelectorAll(".anio-actual").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// Años de trayectoria desde la fundación (29 de diciembre de 2009) — se
// calcula solo, para no volver a quedar con un número fijo desactualizado
// (como pasaba con "más de una década" o el "15+" de la franja de cifras).
const FUNDACION = new Date(2009, 11, 29);
function aniosDeTrayectoria() {
  const hoy = new Date();
  let anios = hoy.getFullYear() - FUNDACION.getFullYear();
  const aunNoCumpleAnios = hoy.getMonth() < FUNDACION.getMonth() ||
    (hoy.getMonth() === FUNDACION.getMonth() && hoy.getDate() < FUNDACION.getDate());
  if (aunNoCumpleAnios) anios -= 1;
  return anios;
}
document.querySelectorAll(".anios-cinco").forEach((el) => {
  el.textContent = aniosDeTrayectoria();
});

// Animación sutil de aparición al hacer scroll (tarjetas, filas de servicio,
// etc.) — si el navegador no soporta IntersectionObserver, se muestran
// directamente sin animar.
const elementosReveal = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && elementosReveal.length) {
  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          entrada.target.classList.add("in-view");
          observador.unobserve(entrada.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  elementosReveal.forEach((el) => observador.observe(el));
} else {
  elementosReveal.forEach((el) => el.classList.add("in-view"));
}
