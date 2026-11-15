// 1. Configuración de selectores CSS por plataforma
const STORE_SELECTORS = {
  mercadolibre: {
    priceContainer: '.ui-pdp-price__second-line .andes-money-amount',
    fraction: '.ui-pdp-price__second-line .andes-money-amount__fraction',
    cents: '.ui-pdp-price__second-line .andes-money-amount__cents',
    currency: '.ui-pdp-price__second-line .andes-money-amount__currency-symbol'
  },
  amazon: {
    priceContainer: '#corePrice_feature_div .a-price, #corePriceDisplay_desktop_feature_div .a-price',
    whole: '.a-price-whole',
    fraction: '.a-price-fraction',
    currency: '.a-price-symbol'
  },
  alibaba: {
    priceContainer: '.price-list .price-item, .module-pdp-price .price',
    rawText: '.price-list .price-item, .module-pdp-price .price'
  }
};

// 2. Normalizar URL como identificador único del producto (sin parámetros de rastreo)
function getProductId() {
  const url = new URL(window.location.href);
  return `${url.hostname}${url.pathname}`;
}

// 3. Extraer precio actual y elemento contenedor según el sitio
function extractProductData() {
  const host = window.location.hostname;

  if (host.includes('mercadolibre')) {
    const container = document.querySelector(STORE_SELECTORS.mercadolibre.priceContainer);
    const fractionEl = document.querySelector(STORE_SELECTORS.mercadolibre.fraction);
    const centsEl = document.querySelector(STORE_SELECTORS.mercadolibre.cents);
    const currencyEl = document.querySelector(STORE_SELECTORS.mercadolibre.currency);

    if (!container || !fractionEl) return null;

    const whole = fractionEl.innerText.replace(/\./g, '').replace(/,/g, '');
    const cents = centsEl ? centsEl.innerText : '00';
    const currency = currencyEl ? currencyEl.innerText.trim() : '$';
    return {
      price: parseFloat(`${whole}.${cents}`),
      currency,
      container
    };
  }

  if (host.includes('amazon')) {
    const container = document.querySelector(STORE_SELECTORS.amazon.priceContainer);
    if (!container) return null;

    const wholeEl = container.querySelector(STORE_SELECTORS.amazon.whole);
    const fractionEl = container.querySelector(STORE_SELECTORS.amazon.fraction);
    const currencyEl = container.querySelector(STORE_SELECTORS.amazon.currency);

    if (!wholeEl) return null;

    const whole = wholeEl.innerText.replace(/[^0-9]/g, '');
    const fraction = fractionEl ? fractionEl.innerText.replace(/[^0-9]/g, '') : '00';
    const currency = currencyEl ? currencyEl.innerText.trim() : '$';
    return {
      price: parseFloat(`${whole}.${fraction}`),
      currency,
      container
    };
  }

  if (host.includes('alibaba')) {
    const container = document.querySelector(STORE_SELECTORS.alibaba.priceContainer);
    if (!container) return null;

    const text = container.innerText.trim();
    const match = text.match(/([^\d.,\s]+)?\s*([\d.,]+)/);
    if (!match) return null;

    const currency = match[1] || 'US$';
    const numeric = parseFloat(match[2].replace(/,/g, ''));
    return { price: numeric, currency, container };
  }

  return null;
}

// 4. Buscar precio de hace ~30 días o el último cambio de precio distinto al actual
function findReferenceRecord(history, currentPrice) {
  if (!history || history.length === 0) return null;

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const targetTime = Date.now() - THIRTY_DAYS_MS;

  // Buscar registro más cercano a hace 30 días (con margen de +/- 7 días)
  const monthAgoRecords = history.filter(
    item => Math.abs(item.timestamp - targetTime) <= 7 * 24 * 60 * 60 * 1000
  );

  if (monthAgoRecords.length > 0) {
    return { record: monthAgoRecords[0], label: 'vs. mes pasado' };
  }

  // Si no hay dato de hace un mes, buscar el último precio diferente registrado
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].price !== currentPrice) {
      const dateStr = new Date(history[i].timestamp).toLocaleDateString();
      return { record: history[i], label: `vs. último cambio (${dateStr})` };
    }
  }

  // Si el precio nunca ha cambiado desde el primer registro
  const firstDate = new Date(history[0].timestamp).toLocaleDateString();
  return { record: history[0], label: `sin cambios desde ${firstDate}` };
}

// 5. Renderizar la insignia junto al precio
function renderBadge(container, currentPrice, currency, comparison) {
  if (document.getElementById('pt-price-badge')) return;

  const badge = document.createElement('span');
  badge.id = 'pt-price-badge';
  badge.className = 'pt-badge-container';

  if (!comparison) {
    badge.classList.add('pt-price-neutral');
    badge.textContent = '📌 Precio inicial guardado';
    container.insertAdjacentElement('afterend', badge);
    return;
  }

  const oldPrice = comparison.record.price;
  const diffReal = currentPrice - oldPrice;
  const diffPercent = ((diffReal / oldPrice) * 100).toFixed(2);

  if (diffReal < 0) {
    badge.classList.add('pt-price-down');
    badge.textContent = `📉 ${diffPercent}% (${currency}${diffReal.toFixed(2)}) ${comparison.label}`;
  } else if (diffReal > 0) {
    badge.classList.add('pt-price-up');
    badge.textContent = `📈 +${diffPercent}% (+${currency}${diffReal.toFixed(2)}) ${comparison.label}`;
  } else {
    badge.classList.add('pt-price-neutral');
    badge.textContent = `➖ 0.00% (${currency}0.00) ${comparison.label}`;
  }

  container.insertAdjacentElement('afterend', badge);
}

// 6. Flujo principal
async function initTracker() {
  const data = extractProductData();
  if (!data || isNaN(data.price)) return;

  const productId = getProductId();
  const storage = await chrome.storage.local.get([productId]);
  const history = storage[productId] || [];

  const comparison = findReferenceRecord(history, data.price);
  renderBadge(data.container, data.price, data.currency, comparison);

  // Guardar registro nuevo si es la primera vez o si el precio cambió respecto al último guardado
  const lastEntry = history[history.length - 1];
  const oneDayPassed = lastEntry ? (Date.now() - lastEntry.timestamp) > 86400000 : true;

  if (!lastEntry || lastEntry.price !== data.price || oneDayPassed) {
    history.push({ price: data.price, timestamp: Date.now() });
    await chrome.storage.local.set({ [productId]: history });
  }
}

// Ejecutar tras cargar el DOM (con ligero retraso para sitios SPA/dinámicos)
setTimeout(initTracker, 1500);