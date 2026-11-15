document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('product-list');

  // Obtener todo lo almacenado en la extensión
  const allData = await chrome.storage.local.get(null);
  const keys = Object.keys(allData);

  if (keys.length === 0) {
    container.innerHTML = '<div class="empty-state">No hay productos guardados aún.<br>Visita Amazon, MercadoLibre o Alibaba para agregar productos a la lista.</div>';
    return;
  }

  container.innerHTML = '';

  keys.forEach(urlKey => {
    const history = allData[urlKey];
    if (!Array.isArray(history) || history.length === 0) return;

    const latestEntry = history[history.length - 1];
    const firstEntry = history[0];

    // Crear tarjeta contenedor para el producto
    const card = document.createElement('div');
    card.className = 'product-card';

    // Enlace al producto (usamos https:// para mayor seguridad)
    const link = document.createElement('a');
    link.className = 'product-url';
    link.href = `https://${urlKey}`;
    link.target = '_blank';
    link.textContent = urlKey;

    // Texto de precio actual y precio inicial
    const priceInfo = document.createElement('div');
    priceInfo.className = 'price-info';
    priceInfo.textContent = `Actual: ${latestEntry.price} (Inicial: ${firstEntry.price})`;

    // Botón para desplegar historial completo
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'history-toggle';
    toggleBtn.textContent = `Ver historial (${history.length} registros)`;

    // Lista oculta con el detalle de cambios históricos
    const historyList = document.createElement('div');
    historyList.className = 'history-list';

    history.forEach((entry, index) => {
      const date = new Date(entry.timestamp).toLocaleString();
      const item = document.div || document.createElement('div');
      item.textContent = `#${index + 1}: ${entry.price} — ${date}`;
      historyList.appendChild(item);
    });

    toggleBtn.addEventListener('click', () => {
      const isVisible = historyList.style.display === 'block';
      historyList.style.display = isVisible ? 'none' : 'block';
      toggleBtn.textContent = isVisible 
        ? `Ver historial (${history.length} registros)` 
        : `Ocultar historial`;
    });

    // Ensamblar elementos
    card.appendChild(link);
    card.appendChild(priceInfo);
    card.appendChild(toggleBtn);
    card.appendChild(historyList);
    container.appendChild(card);
  });
});