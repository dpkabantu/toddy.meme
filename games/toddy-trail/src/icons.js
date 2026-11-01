// TODDY Trail icons: small inline SVG pictures (no files to load, they take the colour of the text around them).
const P = {
  sound: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.2 9a4.2 4.2 0 0 1 0 6M17.6 6.6a7.6 7.6 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  mute: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  music: '<path d="M9 4.5v11.2a3 3 0 1 0 2 2.8V8.6l7-1.6v6.7a3 3 0 1 0 2 2.8V3.5L9 4.5z"/>',
  expand: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  collapse: '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.4"/><rect x="13.5" y="5" width="4" height="14" rx="1.4"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  home: '<path d="M4 11.2L12 4l8 7.2V20h-5.2v-5.4H9.2V20H4z"/>',
  gift: '<path d="M4 10h16v3H4zM5.5 13.5h13V20h-13z"/><path d="M12 10v10M12 10C10 10 7.5 9.2 8 7.2 8.5 5.4 11 6 12 10zM12 10c2 0 4.5-.8 4-2.8C15.5 5.4 13 6 12 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  exit: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};
export function ico(name, cls) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '1em'); s.setAttribute('height', '1em'); s.setAttribute('fill', 'currentColor'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
  s.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
  s.innerHTML = P[name] || '';   // fixed strings from this file only
  return s;
}
export const setIco = (el, name) => { el.textContent = ''; el.append(ico(name)); };
