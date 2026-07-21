// Comportamiento compartido por todas las páginas: menú móvil y año dinámico
// en el pie de página (para no repetir el error del sitio anterior, que
// quedó con "Copyright 2020" fijo y desactualizado).
document.getElementById("navToggle")?.addEventListener("click", () => {
  document.querySelector("nav.main-nav")?.classList.toggle("open");
});

document.querySelectorAll(".anio-actual").forEach((el) => {
  el.textContent = new Date().getFullYear();
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
