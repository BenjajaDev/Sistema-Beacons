// Se ejecuta en <head>, antes del primer pintado, para que no haya un destello
// del tema claro ni un salto al aplicar el tamaño de texto o el zoom elegidos.
// Archivo externo y sin dependencias: la CSP no permite scripts inline.
(function () {
  try {
    var raiz = document.documentElement;
    var tema = localStorage.getItem("signal-tema");
    if (tema === "claro") raiz.setAttribute("data-theme", "light");
    else if (tema === "oscuro") raiz.setAttribute("data-theme", "dark");
    // El sitio y el panel comparten dominio (y localStorage): el panel usa A−/A+
    // (tamaño de texto) y el sitio, Zoom−/Zoom+. Cada uno aplica solo lo suyo.
    if (raiz.getAttribute("data-app") === "panel") {
      var escala = localStorage.getItem("signal-texto");
      if (escala && /^(0\.875|1|1\.125|1\.25|1\.5)$/.test(escala)) {
        raiz.style.fontSize = Number(escala) * 100 + "%";
      }
    } else {
      // Mismos pasos que ZOOMS en preferences.ts.
      var zoom = localStorage.getItem("signal-zoom");
      if (zoom && /^(0\.8|0\.9|1\.1|1\.25|1\.5|1\.75|2)$/.test(zoom)) {
        raiz.style.setProperty("--zoom-pagina", zoom);
      }
    }
  } catch {
    // Sin localStorage (modo privado estricto): se usan los valores del sistema.
  }
})();
