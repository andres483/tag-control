export default function Support() {
  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-surface px-6 py-10">
      <h1 className="text-2xl font-bold text-text mb-2">Soporte</h1>
      <p className="text-xs text-text-secondary mb-8">TAGcontrol — Tracking de peajes en Chile</p>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-text mb-2">Contacto</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Para preguntas, problemas o sugerencias, escríbenos a{' '}
          <a href="mailto:a.villagran7@gmail.com" className="text-primary underline">
            a.villagran7@gmail.com
          </a>
          . Respondemos en 24–48 horas hábiles.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-text mb-3">Preguntas frecuentes</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-text mb-1">¿Cómo creo mi cuenta?</p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Solo necesitas un nombre y un PIN de 4 dígitos. No se requiere email — es opcional y solo se usa para recuperar tu cuenta si olvidas el PIN.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-text mb-1">¿Cómo funciona la detección de peajes?</p>
            <p className="text-sm text-text-secondary leading-relaxed">
              La app usa GPS para detectar automáticamente cuándo cruzas una plaza de peaje en las autopistas de Chile. Solo registra durante un viaje activo — nunca en segundo plano sin tu permiso.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-text mb-1">¿La app funciona sin conexión a internet?</p>
            <p className="text-sm text-text-secondary leading-relaxed">
              La detección de peajes funciona con GPS (sin internet). El historial y sincronización requieren conexión.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-text mb-1">¿Olvidé mi PIN, qué hago?</p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Si registraste un email, escríbenos a{' '}
              <a href="mailto:a.villagran7@gmail.com" className="text-primary underline">
                a.villagran7@gmail.com
              </a>{' '}
              con tu nombre de usuario y te ayudamos a recuperarlo.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-text mb-1">¿En qué autopistas funciona?</p>
            <p className="text-sm text-text-secondary leading-relaxed">
              TAGcontrol cubre las principales autopistas urbanas e interurbanas de Chile, incluyendo Autopista Central, Costanera Norte, Vespucio Norte, Vespucio Sur, y más de 80 plazas de peaje en total.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-text mb-1">¿Cómo reporto un peaje mal detectado?</p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Escríbenos a{' '}
              <a href="mailto:a.villagran7@gmail.com" className="text-primary underline">
                a.villagran7@gmail.com
              </a>{' '}
              con el nombre del peaje y la fecha aproximada del cruce. Lo revisamos y actualizamos en el siguiente release.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-text mb-2">Privacidad</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Consulta nuestra{' '}
          <a href="/privacy" className="text-primary underline">
            Política de Privacidad
          </a>{' '}
          para ver qué datos recopilamos y cómo los usamos.
        </p>
      </section>
    </div>
  );
}
