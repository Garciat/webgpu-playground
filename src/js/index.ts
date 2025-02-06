globalThis.addEventListener("load", () => {
  if (!navigator.gpu) {
    showNoWebGPU();
  }
});

function showNoWebGPU() {
  document.querySelectorAll<HTMLElement>(".no-webgpu").forEach((el) => {
    el.hidden = false;
  });
}
