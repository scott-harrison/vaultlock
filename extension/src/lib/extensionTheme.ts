/** Matches desktop `index.html` — modern-minimal dark theme. */
export function applyExtensionTheme(): void {
  const root = document.documentElement;
  root.classList.add("dark");
  root.setAttribute("data-theme", "modern-minimal-dark");
  root.lang = "en";
}
