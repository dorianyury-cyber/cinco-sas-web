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

// Acordeón de servicios (página Servicios): en computador el hover ya
// expande la franja por CSS; el clic/toque sirve para el celular (donde no
// hay cursor) y para "fijar" una franja abierta en pantallas táctiles.
document.querySelectorAll(".servicio-panel").forEach((panel) => {
  panel.addEventListener("click", () => {
    const yaActivo = panel.classList.contains("activo");
    document.querySelectorAll(".servicio-panel.activo").forEach((p) => p.classList.remove("activo"));
    if (!yaActivo) panel.classList.add("activo");
  });
});

// Acordeón de Política/Objetivos/Alcance SGI-HSEQ (página Corporativo): un
// clic en el encabezado despliega/colapsa esa sección, para no dejar todo
// el texto de cumplimiento desplegado de una vez como un muro plano.
document.querySelectorAll(".acordeon-trigger").forEach((btn) => {
  btn.addEventListener("click", () => btn.closest(".acordeon-item")?.classList.toggle("abierto"));
});

// Cifras animadas (Corporativo): en vez de aparecer ya con el número final,
// cuentan desde 0 hasta el valor real cuando la franja entra en pantalla.
// Los años de experiencia toman su meta de aniosDeTrayectoria() en vez de
// quedar fijos en el HTML (mismo criterio que .anios-cinco, para no volver
// a quedar con un número desactualizado con el tiempo).
document.querySelectorAll("[data-contador-anios]").forEach((el) => {
  el.dataset.contador = aniosDeTrayectoria();
});
const elementosContador = document.querySelectorAll("[data-contador]");
if (elementosContador.length) {
  const animarContador = (el) => {
    const destino = parseFloat(el.dataset.contador);
    const sufijo = el.dataset.sufijo || "";
    const duracion = 1200;
    const inicio = performance.now();
    function paso(ahora) {
      const progreso = Math.min((ahora - inicio) / duracion, 1);
      const suavizado = 1 - Math.pow(1 - progreso, 3);
      el.textContent = Math.round(destino * suavizado) + sufijo;
      if (progreso < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  };
  if ("IntersectionObserver" in window) {
    const observadorContadores = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            animarContador(entrada.target);
            observadorContadores.unobserve(entrada.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    elementosContador.forEach((el) => observadorContadores.observe(el));
  } else {
    elementosContador.forEach((el) => { el.textContent = el.dataset.contador + (el.dataset.sufijo || ""); });
  }
}
