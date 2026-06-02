# DelfinPorra 2026

Aplicación web para organizar una porra del Mundial 2026. Está pensada para Delfin Tubes, pero se puede desplegar como una instancia independiente para otros grupos cambiando configuración, base de datos y nombre visible.

## Qué incluye

- Registro con correo y contraseña.
- Aprobación manual de nuevos usuarios por parte del administrador.
- Panel de jugador separado del panel de administrador.
- Apuestas por fase de grupos, eliminatorias y máximo goleador.
- Clasificación general, evolución por usuario e historial de resultados.
- Panel de administración para publicar resultados oficiales, gestionar usuarios y enviar resúmenes.
- Correos de aceptación/rechazo y resumen diario si se configura SMTP.
- Diseño responsive para PC y móvil.

## Cómo funciona la porra

Los jugadores rellenan sus apuestas antes del cierre. La aplicación bloquea todas las apuestas 24 horas antes del primer partido del Mundial.

En fase de grupos se apuesta con 1/X/2:

- `1`: gana la selección local.
- `X`: empate.
- `2`: gana la selección visitante.

En eliminatorias se selecciona qué selección pasa a la siguiente ronda. Los cruces se van rellenando automáticamente a partir de las apuestas de grupos y de rondas anteriores.

El máximo goleador se escribe libremente. Al evaluar el Mundial, el administrador introducirá el nombre oficial y se podrán revisar nombres parecidos si alguien lo escribió de forma distinta.

## Puntuación

- Partido acertado de fase de grupos: 2 puntos.
- Acertar todos los partidos de un mismo grupo: 8 puntos.
- Equipo acertado en dieciseisavos: 5 puntos en su sitio, 3 puntos fuera de sitio.
- Equipo acertado en octavos: 6 puntos.
- Equipo acertado en cuartos: 7 puntos.
- Equipo acertado en semifinales: 7 puntos.
- Equipo acertado en tercer y cuarto puesto: 7 puntos.
- Equipo acertado finalista: 8 puntos.
- Acertar tercer clasificado: 8 puntos.
- Acertar el campeón: 10 puntos.
- Acertar el máximo goleador: 10 puntos.

## Desempates

Si hay empate dentro de un grupo, el jugador puede ordenar manualmente los equipos empatados con los botones `Subir` y `Bajar`. El administrador puede hacer lo mismo con la clasificación real si FIFA decide un empate por sorteo u otro criterio externo.

Si dos participantes empatan a puntos en la clasificación general, se desempata por:

1. Acierto del campeón.
2. Acierto del máximo goleador.
3. Más equipos acertados en la final.
4. Más equipos acertados en semifinales.
5. Más equipos acertados en cuartos.
6. Más equipos acertados en octavos.
7. Más equipos acertados en dieciseisavos.
8. Más aciertos en fase de grupos.
9. Si siguen empatados, comparten posición y premio.

## Arranque local

Instala dependencias:

```bash
npm install
```

Crea la configuración local:

```bash
copy .env.example .env
```

Arranca frontend y backend en desarrollo:

```bash
npm run dev
```

Abre:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

Usuario administrador inicial:

- Correo: `demo@porra.local`
- Contraseña: `demo1234`

## Producción

Genera la versión optimizada:

```bash
npm run build
```

Arranca el servidor:

```bash
npm start
```

El servidor sirve la aplicación desde el puerto configurado en `.env` o, por defecto, `4000`.

## Bases de datos separadas

La aplicación usa SQLite. Para tener una porra de Delfin y otra personal en el mismo servidor, lo recomendable es ejecutar dos instancias con bases de datos distintas:

- DelfinPorra empresa: `data/delfinporra.db`
- Porra personal: `data/personalporra.db`

Cada instancia puede tener su propio puerto, nombre, usuarios, correos y datos. Esto evita mezclar participantes, pagos y resultados entre grupos.

## Despliegue previsto

La opción recomendada para bajo coste es un servidor Hetzner Cloud CX23 con Ubuntu. Cuando la aplicación esté lista:

- Crear servidor en Hetzner.
- Subir el repositorio desde GitHub.
- Configurar `.env`, base de datos y SMTP.
- Activar HTTPS.
- Configurar copias de seguridad.
- Crear una segunda instancia si se quiere una porra personal separada.
