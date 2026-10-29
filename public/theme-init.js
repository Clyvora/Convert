try {
  const theme = localStorage.getItem('clyvora-theme');
  document.documentElement.dataset.theme = theme === 'light' || theme === 'auto' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
} catch {
  document.documentElement.dataset.theme = 'dark';
}
