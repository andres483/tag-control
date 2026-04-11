// Genera un sonido de alerta usando Web Audio API (funciona en Safari iOS)
let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Sonido de "peaje detectado": dos tonos ascendentes tipo "ding-ding" (más fuerte para auto)
 */
export function playTollSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') return; // No intentar si audio bloqueado

    // Primer tono
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 880;
    gain1.gain.setValueAtTime(0.5, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.4);

    // Segundo tono (más alto)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 1175;
    gain2.gain.setValueAtTime(0.5, ctx.currentTime + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.25);
    osc2.stop(ctx.currentTime + 0.7);

    // Tercer tono aún más alto (para que se escuche en el auto)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.value = 1400;
    gain3.gain.setValueAtTime(0.5, ctx.currentTime + 0.5);
    gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.9);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(ctx.currentTime + 0.5);
    osc3.stop(ctx.currentTime + 0.9);
  } catch {}
}

/**
 * Safari iOS necesita que el AudioContext se inicialice con un gesto del usuario.
 * Llamar esto en el primer tap (ej: al presionar "Comenzar viaje").
 */
export function initAudio() {
  try {
    // Si hay un contexto previo bloqueado, descartarlo y crear uno nuevo
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    // Reproducir silencio para desbloquear en Safari
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch {}
}
