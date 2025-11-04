// Simple theme toggle that persists choice in localStorage
(function(){
  const key = 'site-theme';
  const body = document.body;
  function applyTheme(t){
    if (t === 'light') { body.classList.remove('theme-dark'); body.classList.add('theme-light'); }
    else { body.classList.remove('theme-light'); body.classList.add('theme-dark'); }
  }
  // read stored value or system preference
  let theme = localStorage.getItem(key);
  if (!theme) {
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    theme = prefersLight ? 'light' : 'dark';
  }
  applyTheme(theme);

  function toggle(){
    theme = (theme === 'light') ? 'dark' : 'light';
    localStorage.setItem(key, theme);
    applyTheme(theme);
  }

  function attach() {
    const btns = document.querySelectorAll('#theme-toggle');
    btns.forEach(btn => btn.addEventListener('click', toggle));
  }

  // If DOM already ready, attach immediately, otherwise wait
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
