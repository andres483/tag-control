export function formatCLP(amount) {
  return amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
