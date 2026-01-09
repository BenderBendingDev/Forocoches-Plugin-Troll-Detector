# 🔍 ForoCoches Troll Detector

Extensión de Chrome para detectar la probabilidad de que un usuario de ForoCoches sea troll, basándose en su actividad y fecha de registro.

## 📸 Características

- **Badge visual**: Muestra junto al nickname del OP un indicador con la probabilidad de troll
- **Código de colores**:
  - 🟢 **Verde** (0-39%): Baja probabilidad - Usuario probablemente legítimo
  - 🟡 **Amarillo** (40-69%): Probabilidad media - Precaución
  - 🔴 **Rojo** (70-100%): Alta probabilidad - Posible troll

## 📊 Algoritmo de Detección

El algoritmo calcula la probabilidad basándose en:

1. **Antigüedad de la cuenta** (50%)
   - Cuentas nuevas = Mayor probabilidad de troll
   - Cuentas antiguas = Menor probabilidad

2. **Actividad diaria** (50%)
   - Muchos mensajes/hilos por día = Mayor probabilidad (spam/troll)
   - Actividad moderada = Menor probabilidad

### Fórmula

```
Factor Antigüedad = 100 - (días_registrado / días_10_años) * 100
Factor Actividad = (mensajes_día + hilos_día * 5) / 20 * 100

Probabilidad = (Factor_Antigüedad * 0.5) + (Factor_Actividad * 0.5)
```

**Bonus/Penalizaciones:**
- Cuenta < 1 año con > 10 msgs/día: +20% probabilidad
- Cuenta > 3 años con < 2 msgs/día: -30% probabilidad

## 🚀 Instalación

### Método 1: Instalación en modo desarrollo

1. Descarga o clona este repositorio
2. Abre Chrome y navega a `chrome://extensions/`
3. Activa el **"Modo desarrollador"** (esquina superior derecha)
4. Haz clic en **"Cargar extensión sin empaquetar"**
5. Selecciona la carpeta `/Plugin`
6. ¡Listo! La extensión está activa

### Método 2: Crear iconos PNG (opcional)

Para que los iconos se muestren correctamente, puedes convertir el SVG a PNG:

```bash
# Con ImageMagick instalado:
convert -background none -resize 16x16 icons/icon.svg icons/icon16.png
convert -background none -resize 32x32 icons/icon.svg icons/icon32.png
convert -background none -resize 48x48 icons/icon.svg icons/icon48.png
convert -background none -resize 128x128 icons/icon.svg icons/icon128.png
```

O usa cualquier herramienta online como [CloudConvert](https://cloudconvert.com/svg-to-png).

## 📁 Estructura del proyecto

```
Plugin/
├── manifest.json      # Configuración de la extensión
├── content.js         # Script principal de detección
├── styles.css         # Estilos del badge
├── icons/             # Iconos de la extensión
│   └── icon.svg       # Icono fuente
└── README.md          # Este archivo
```

## 🎯 Uso

1. Navega a cualquier hilo de ForoCoches (`showthread.php`)
2. La extensión analizará automáticamente a **TODOS los usuarios** del hilo
3. Aparecerá un badge junto a cada nombre con la probabilidad
4. El **OP** (creador del hilo) tiene una 👑 corona junto a su badge
5. Pasa el ratón sobre cualquier badge para ver detalles:
   - Fecha de registro
   - Número de hilos
   - Número de mensajes
   - Mensajes por día
   - Antigüedad de la cuenta

### Ejemplo visual:
```
Putérnico 🔴 75% 👑    ← OP del hilo con alta probabilidad
AspirinaC 🟢 15%       ← Usuario veterano con baja probabilidad
NuevoCuenta 🟡 55%     ← Usuario con probabilidad media
```

## ⚙️ Configuración

Puedes ajustar los parámetros en `content.js`:

```javascript
const CONFIG = {
    PESO_ANTIGUEDAD: 0.5,      // Peso del factor antigüedad (0-1)
    PESO_ACTIVIDAD: 0.5,       // Peso del factor actividad (0-1)
    UMBRAL_ALTO: 70,           // % para considerar riesgo alto
    UMBRAL_MEDIO: 40,          // % para considerar riesgo medio
    DIAS_CUENTA_NUEVA: 365,    // Días para considerar cuenta "nueva"
    MENSAJES_DIA_ALTO: 10      // Msgs/día para considerar alta actividad
};
```

## 🔒 Privacidad

- La extensión **NO** recopila datos personales
- **NO** envía información a servidores externos
- Todo el procesamiento es local en tu navegador
- Solo accede a páginas públicas de ForoCoches

## 📝 Licencia

MIT License - Siéntete libre de usar, modificar y distribuir.

## ⚖️ Aviso Legal / Disclaimer

**IMPORTANTE:**

- Esta extensión es un **proyecto independiente** y **NO está afiliada**, patrocinada ni respaldada por ForoCoches.com ni por Link World Network S.L.
- Solo accede a **datos públicamente disponibles** en los perfiles de usuario.
- **NO recaba datos** con fines publicitarios ni comerciales.
- Es un proyecto de **código abierto sin ánimo de lucro**.
- El uso de esta extensión es **responsabilidad exclusiva del usuario**.
- Los resultados son aproximados y **no deben tomarse como verdades absolutas**.
- **NO está permitido monetizar** esta extensión ni distribuirla con fines comerciales.

El algoritmo es una herramienta orientativa basada en estadísticas públicas. Usa tu propio criterio al evaluar a otros usuarios.

## 🤝 Contribuir

¿Ideas para mejorar el algoritmo? ¿Bugs? ¡Las contribuciones son bienvenidas!

---

*Proyecto educativo y de entretenimiento - Sin afiliación con ForoCoches.com*
