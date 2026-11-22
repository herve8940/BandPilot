---
lang: es
title: "BandPilot 2.3.15 — Consola, MIDI y ensayos desde el teléfono"
---

# BandPilot 2.3.15 — Consola, MIDI y ensayos desde el teléfono

[FR](NEW_2_3_15_FR.md) · [EN](NEW_2_3_15_EN.md) · [IT](NEW_2_3_15_IT.md) · [ES](NEW_2_3_15_ES.md) · [DE](NEW_2_3_15_DE.md)

BandPilot 2.3.15 reúne nuevos controles de consola, recuperación selectiva, grupos de software, MIDI y ensayos REAPER desde los teléfonos de los músicos.

Esta actualización corresponde a las aplicaciones de escritorio Windows, macOS Intel/Apple Silicon y Linux. Android sigue como distribución separada 2.4.0-android.5 y no incluye todas las funciones de escritorio descritas. BandStudio es una aplicación complementaria independiente.

- **Consola y monitores** — Bancos y superficies personalizables, grupos de software, pares estéreo, medidores y RTA. Los controles y destinos dependen del modelo conectado y de la mezcla seleccionada.
- **Escenas y presets** — Recuperación selectiva de entradas, salidas y FX, protecciones por familia de parámetros, vista previa y copia de seguridad. Conversión explícita de presets y escenas portables dentro del alcance X-Air/M-Air compatible.
- **Efectos y análisis** — Editores con nombres para los 61 algoritmos X-Air, tap tempo y GEQ/True EQ de 31 bandas en salidas compatibles. Mediciones con micrófono y propuestas de corrección que requieren revisión y aplicación explícita.
- **MIDI y comandos** — Aprendizaje de faders y mutes, CC absolutos o relativos, notas, Program Change, comandos favoritos y condiciones. Activación explícita por sesión y copias para comandos compatibles.
- **Ensayo y fichas** — Proyectos REAPER abiertos por pestaña, secciones, bucles, cuenta previa, tomas separadas y responsable desde el teléfono. Acordes y letras de fichas BandStudio compatibles, con pantalla completa opcional.

## Primeros pasos

### 1. Instalar y conectar

Instala la última versión de escritorio desde las descargas oficiales y exporta las escenas importantes. Explora la simulación, elige el modelo correcto y conecta en solo lectura. Lee Consola → PC antes de activar el control.

### 2. Preparar la consola

En Consola → Expert, elige mezcla principal o monitor y prepara bancos, grupos y superficies. Un grupo de software ajusta canales o envíos seleccionados; no crea un DCA físico. Define por separado la escucha de cada músico: monitor de suelo, in-ears, auriculares o desconocida.

### 3. Recuperar una escena

En Escenas y presets prepara las protecciones y el alcance. Selecciona entradas, salidas o FX y sus destinos. Revisa los valores y confirma. Usa el historial para preparar una restauración. Guardar una preferencia, grupo o selección no modifica por sí solo el audio.

### 4. Usar MIDI

Abre MIDI, selecciona el dispositivo y aprende una asignación. Indica el formato para un encoder relativo. Revisa los comandos antes de activarlos. Mantén abierta la vista de control: cerrarla, desconectar o detener desactiva la sesión. La recuperación selectiva MIDI cubre entradas, sin ganancia, phantom, routing, salidas ni FX.

### 5. Preparar REAPER

Reinstala el puente incluido con 2.3.15 aunque indique ya 1.5.0 y reinicia REAPER. Abre un proyecto por pestaña con sus medios. En Ensayar → Con mis canciones, selecciona el proyecto y verifica entradas, pistas armadas, pista Original y final. REC crea una toma separada en ese proyecto; comprueba antes las entradas de audio reales.

### 6. Asignar al responsable

En Monitores → Teléfonos crea el enlace de cada músico y asigna al responsable en su ficha. En la misma red local, su QR abre Mi monitor, Mi canción y Ensayar. El rol es revocable. El responsable elige canción, original, acompañamiento o toma, canción completa o sección, bucle y cuenta previa disponibles.

### 7. Leer acordes y letras

En el teléfono abre Mi canción y elige Acordes, Letras o Ambos. La ficha sigue el proyecto y la posición REAPER. Pantalla completa y mantener la pantalla encendida son opcionales. Si se ofrece una ficha fuente BandStudio, el responsable verifica la sincronización antes de compartirla; Volver a la ficha exportada revierte la elección. Las fichas ausentes no se generan automáticamente.

## Alcance y comprobaciones

Los presets y correcciones son puntos de partida. La medición con micrófono depende de calibración, posición, ruido y ruta de audio; no garantiza un sonido universal. No recupera una grabación ya recortada por saturación. La conversión portable cubre entradas mono independientes y parámetros seleccionados, no pistas enlazadas ni X32. X32 sigue parcial y experimental. MIDI no implica MCU/HUI, SysEx ni faders motorizados. Los tests y la simulación no certifican cada consola, controlador o sala. La simulación de consola no simula REAPER: grabar utiliza sus entradas reales.

Las capturas anteriores de la guía general y el vídeo 2.2 son ilustraciones históricas. Este tutorial describe el recorrido 2.3.15.

[BandPilot](https://herve8940.github.io/BandPilot/es.html#download) · [GitHub](https://github.com/herve8940/BandPilot/releases/latest) · [Discord](https://discord.gg/FtWwEPmwE7)
