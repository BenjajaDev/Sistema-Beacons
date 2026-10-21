// Se ejecuta en <head>, antes del primer pintado, para que no haya un destello
// del tema claro ni un salto al aplicar el tamaño de texto elegido.
// Archivo externo y sin dependencias: la CSP no permite scripts inline.
(function () {
  try {
    var raiz = document.documentElement;
    var tema = localStorage.getItem("signal-tema");
    if (tema === "claro") raiz.setAttribute("data-theme", "light");
    else if (tema === "oscuro") raiz.setAttribute("data-theme", "dark");
    var escala = localStorage.getItem("signal-texto");
    if (escala && /^(0\.875|1|1\.125|1\.25|1\.5)$/.test(escala)) {
      raiz.style.fontSize = Number(escala) * 100 + "%";
    }
  } catch {
    // Sin localStorage (modo privado estricto): se usan los valores del sistema.
  }
})();
