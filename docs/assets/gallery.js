// All four panels are readable and linkable when JavaScript is disabled.
const gallery = document.querySelector('.gallery');
if (gallery) {
  const list = gallery.querySelector('.view-links');
  const tabs = Array.from(list.querySelectorAll('[data-view]'));
  const panels = tabs.map(tab => document.getElementById(tab.hash.slice(1)));
  function select(index) {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[i].hidden = !active;
    });
  }
  list.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    const panel = panels[index];
    tab.id = 'tab-' + panel.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      select(index);
      history.replaceState(null, '', tab.hash);
    });
    tab.addEventListener('keydown', event => {
      const last = tabs.length - 1;
      const next = { ArrowLeft: (index + last) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: last }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      tabs[next].focus();
      tabs[next].click();
    });
  });
  function followFragment() {
    const index = tabs.findIndex(tab => tab.hash === location.hash);
    if (index >= 0) select(index);
  }
  select(0);
  followFragment();
  window.addEventListener('hashchange', followFragment);
}
