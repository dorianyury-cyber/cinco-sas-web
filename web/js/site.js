// Comportamiento compartido por todas las páginas: menú móvil y año dinámico
// en el pie de página (para no repetir el error del sitio anterior, que
// quedó con "Copyright 2020" fijo y desactualizado).
document.getElementById("navToggle")?.addEventListener("click", () => {
  document.querySelector("nav.main-nav")?.classList.toggle("open");
});

document.querySelectorAll(".anio-actual").forEach((el) => {
  el.textContent = new Date().getFullYear();
});
