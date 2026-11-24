# BandPilot

[Français](README.md) · [English](README.en.md) · [Deutsch](README.de.md) · **Español** · [Italiano](README.it.md)

**De la prueba de sonido al concierto.** Prepara las entradas del grupo, ajusta la mezcla de monitores de cada músico y ten a mano el repertorio. BandPilot controla la mesa desde la red local.

[Descargar BandPilot](https://herve8940.github.io/BandPilot/es.html#download) · [Guía de inicio](docs/USER_GUIDE_ES.md) · [Notas de la versión](docs/RELEASE_NOTES.md#release-es)

[![Mesa · Interfaz en francés en modo de simulación](docs/images/bandpilot-3.0/hero.jpg)](https://herve8940.github.io/BandPilot/es.html#view-mixer)

## Instala BandPilot

| Versión de escritorio 3.0.1 | Descargas |
| --- | --- |
| Windows | [Windows (.exe)](https://github.com/herve8940/BandPilot/releases/download/v3.0.1/BandPilot-Windows-3.0.1.exe) |
| macOS | [Apple Silicon](https://github.com/herve8940/BandPilot/releases/download/v3.0.1/BandPilot-macOS-3.0.1-arm64.dmg) · [Intel](https://github.com/herve8940/BandPilot/releases/download/v3.0.1/BandPilot-macOS-3.0.1-x64.dmg) |
| Linux | [AppImage](https://github.com/herve8940/BandPilot/releases/download/v3.0.1/BandPilot-Linux-3.0.1-x86_64.AppImage) · [Debian / Ubuntu](https://github.com/herve8940/BandPilot/releases/download/v3.0.1/BandPilot-Linux-3.0.1-amd64.deb) |

[Todos los archivos y sumas SHA-256](https://github.com/herve8940/BandPilot/releases/tag/v3.0.1)

**Aplicación Android autónoma.** En una tableta Android, el APK controla la mesa sin ordenador. Para acceder a tu mezcla de monitores desde el teléfono, solo tienes que escanear el QR que comparta el grupo. [Descargar el APK · 2.4.0-android.5](https://github.com/herve8940/BandPilot/releases/download/android-v2.4.0-android.5/BandPilot-Android-2.4.0-android.5-universal.apk)

## Tu primera prueba de sonido

1. Instala BandPilot y abre la simulación para familiarizarte con los controles.
2. Conecta el ordenador y la mesa a la misma red local y selecciona la mesa detectada.
3. Elige los instrumentos y comprueba las entradas y las salidas de monitores antes de confirmar la prueba.

Empieza con una escena vacía o con una guardada. Cuando confirmas una nueva prueba con el grupo, las entradas que no usas y sus envíos quedan en silencio. Se mantienen la ganancia de los previos y la alimentación fantasma. Asigna una salida a cada músico. En Monitores → Teléfonos puedes compartir el QR de su mezcla en la red local. Guardar la formación actualiza los enlaces sin cambiar el audio.

Ordena los temas durante el ensayo. En el escenario puedes seguir el repertorio y abrir el PDF de la canción que estás tocando. En el ordenador, el puente REAPER conecta los proyectos de ensayo con el repertorio. REAPER se descarga por separado.

[Tutorial de prueba de sonido guiada](docs/TUTO_MON_INGE_SON_ES.md) · [Sitio oficial](https://herve8940.github.io/BandPilot/es.html)

## Mesas

- **Behringer XR18 / X18 · Midas MR18** — Seis salidas Aux físicas para monitores. La XR18 se ha detectado en un equipo real. El perfil de la MR18 se ha comprobado en simulación.
- **Behringer XR12 · Midas MR12** — Dos salidas Aux físicas para monitores. La grabadora USB es estéreo. La grabación multipista en un ordenador requiere otro modelo.
- **Behringer X32 · Rack · Compact · Producer · Core** — Compatibilidad parcial y experimental. La mezcla básica y los envíos a buses están disponibles. Las escenas completas y los monitores por teléfono siguen en desarrollo.

[Matriz de compatibilidad detallada (FR)](docs/multi-model.md)

## Ejecutar el proyecto en local

Con Node.js 22.13 o posterior, ejecuta estos comandos desde la raíz del repositorio y abre la dirección que muestre Vite.

```sh
npm run ci:deps
npm --prefix web ci
npm run studio
```

[Contribuir](CONTRIBUTING.md) · [Comunicar un problema](https://github.com/herve8940/BandPilot/issues/new/choose) · [Licencia MIT](LICENSE)

<!-- community:start -->
## La comunidad BandPilot en Discord

Haz preguntas, comparte tu experiencia y propone mejoras para BandPilot. Conversaciones en francés o inglés.

[Únete al Discord](https://discord.gg/FtWwEPmwE7) · [Descubre los canales](docs/COMMUNITY_ES.md)
<!-- community:end -->

<!-- community-badge:start -->
[![Discord](https://img.shields.io/badge/Discord-BandPilot-5865F2?logo=discord&logoColor=white)](https://discord.gg/FtWwEPmwE7)
<!-- community-badge:end -->

<!-- support:start -->
## Apoya BandPilot

El apoyo voluntario ayuda a dedicar tiempo a las correcciones, las pruebas con mesas y las guías en cinco idiomas. Los comentarios, las traducciones y compartir el proyecto también ayudan.

[Apoyar en Ko-fi](https://ko-fi.com/bandpilot) · [Cómo ayudar al proyecto](docs/SUPPORT_ES.md) · [Contribuir](CONTRIBUTING.md)
<!-- support:end -->
