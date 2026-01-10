# 🔍 ForoCoches Troll Detector

Extensión de Chrome para detectar la probabilidad de que los usuarios de ForoCoches sean trolls, basándose en su actividad y fecha de registro.

## 📸 Características

- **Triple modo de funcionamiento**:
  - 📋 **En listados**: Muestra el badge del OP junto al título de cada hilo
  - 💬 **En hilos**: Analiza a todos los usuarios que participan
  - 🔥 **En Trending**: Analiza los 5 hilos destacados del sidebar
- **Badge visual**: Muestra junto a cada nickname un indicador con la probabilidad de troll
- **Indicador de OP**: El creador del hilo aparece con una 👑 corona
- **Panel de configuración**: Personaliza umbrales, pesos y gestiona listas de usuarios
- **Lista de usuarios fiables**: Marca usuarios de confianza que siempre aparecerán en azul
- **Lista de trolls (Blacklist)**: Marca usuarios como trolls para resaltarlos en rojo
- **Resaltado visual de trolls**: Los posts y hilos de usuarios marcados se resaltan en rojo
- **Caché inteligente**: Guarda datos durante 24h para mayor velocidad
- **Código de colores**:
  - 🚫 **Negro/Rojo** - Usuario marcado como troll (blacklist)
  - ✅ **Azul** - Usuario marcado como fiable (whitelist)
  - 🟢 **Verde** (0-39%) - Baja probabilidad - Usuario probablemente legítimo
  - 🟡 **Amarillo** (40-69%) - Probabilidad media - Precaución
  - 🔴 **Rojo** (70-100%) - Alta probabilidad - Posible troll

## 🎯 Uso

### 📋 En el listado de foros (`forumdisplay.php`)

1. Navega a cualquier foro (ej: General, Coches, etc.)
2. La extensión analizará al **OP de cada hilo** del listado
3. Aparece un badge compacto junto al título de cada hilo
4. Sabrás de un vistazo si el creador del hilo es sospechoso

```
🚫     ESTE HILO ES MENTIRA [RESALTADO ROJO] ← OP en tu blacklist (troll)
🔴 75% En dos semanas voy a Bratislava...    ← OP sospechoso
🟢 12% Peña Real Oviedo Vol. LVII            ← OP veterano
🟡 45% Sorteo 5 invis by the face            ← OP con precaución
✅     LLEVO 1 MES ESTUDIANDO ALEMÁN         ← OP en tu whitelist
```

### 🔥 En el sidebar Trending

1. En el sidebar derecho aparece la sección **Trending** con los 5 hilos más activos
2. La extensión analiza automáticamente al OP de cada hilo trending
3. Aparece un badge compacto junto al título
4. Los hilos de trolls se resaltan con borde rojo

```
🔥 Trending
──────────────────────────────
1  Noticia viral del momento 🔴 82%    ← OP sospechoso
2  Debate sobre política ✅            ← OP fiable  
3  Hilo polémico 🚫 [RESALTADO]        ← OP en blacklist
4  Pregunta random 🟢 15%              ← OP veterano
5  Sorteo de algo 🟡 48%               ← Precaución
```

### 💬 Dentro de un hilo (`showthread.php`)

1. Navega a cualquier hilo
2. La extensión analizará a **todos los usuarios** del hilo
3. Aparecerá un badge junto a cada nombre con la probabilidad
4. El **OP** tiene una 👑 corona junto a su badge
5. Pasa el ratón sobre cualquier badge para ver detalles

```
TrollConocido 🚫 Troll ← Usuario en tu blacklist (post resaltado en rojo)
Putérnico 🔴 75% 👑    ← OP del hilo con alta probabilidad
AspirinaC ✅ Fiable    ← Usuario en tu whitelist
Veterano 🟢 15%        ← Usuario veterano con baja probabilidad
NuevaCuenta 🟡 55%     ← Usuario con probabilidad media
```

## ⚙️ Panel de Configuración

Haz clic en el **icono de la extensión** para abrir el panel de configuración:

### 📊 Umbrales de Riesgo
| Opción | Descripción | Por defecto |
|--------|-------------|-------------|
| Riesgo Alto | A partir de qué % se muestra rojo | 70% |
| Riesgo Medio | A partir de qué % se muestra amarillo | 40% |

### ⚖️ Pesos del Algoritmo
| Factor | Descripción | Por defecto |
|--------|-------------|-------------|
| Antigüedad | Cuánto importa la edad de la cuenta | 50% |
| Actividad | Cuánto importa la actividad diaria | 50% |

*Los pesos se balancean automáticamente (siempre suman 100%)*

### ✅ Usuarios Fiables (Whitelist)
- Añade usuarios que consideres de confianza
- Estos usuarios siempre aparecerán con badge azul `✅ Fiable`
- Se sincronizan con tu cuenta de Chrome

### 🚫 Trolls Marcados (Blacklist)
- Marca usuarios como trolls conocidos
- Estos usuarios aparecerán con badge negro/rojo `🚫 Troll`
- Sus posts y hilos se resaltarán visualmente en rojo
- Aparece un indicador `⚠️ TROLL` sobre sus mensajes
- Se sincronizan con tu cuenta de Chrome

### ⚙️ Opciones adicionales
- **Mostrar tooltip detallado**: Activa/desactiva la información al pasar el ratón
- **Analizar automáticamente**: Activa/desactiva el análisis al cargar la página

### 📦 Importar / Exportar
- **Exportar JSON**: Descarga toda tu configuración en un archivo JSON
- **Importar JSON**: Carga una configuración desde un archivo JSON
- Perfecto para:
  - 🔄 Sincronizar entre dispositivos
  - 👥 Compartir configuración con amigos
  - 💾 Hacer backup de tus listas de usuarios
  - 🚀 Migrar a otro navegador

## 📊 Algoritmo de Detección

El algoritmo calcula la probabilidad basándose en dos factores principales:

### 1. Antigüedad de la cuenta (configurable)
- Cuentas nuevas = Mayor probabilidad de troll
- Cuentas antiguas = Menor probabilidad
- Referencia: 10 años = 0% de factor antigüedad

### 2. Actividad diaria (configurable)
- Muchos mensajes/hilos por día = Mayor probabilidad
- Actividad moderada = Menor probabilidad
- Los hilos abiertos pesan x5 más que los mensajes

### Fórmula

```
Factor Antigüedad = 100 - (días_registrado / 3650) * 100
Factor Actividad = min(100, (msgs_día + hilos_día * 5) / 20 * 100)

Probabilidad = (Factor_Antigüedad * peso_antigüedad) + (Factor_Actividad * peso_actividad)
```

### Bonus/Penalizaciones automáticas:
- Cuenta < 1 año con > 10 msgs/día: **+20%** probabilidad
- Cuenta > 3 años con < 2 msgs/día: **-30%** probabilidad

## 🚀 Instalación

### Instalación en modo desarrollo

1. Descarga o clona este repositorio
2. Abre Chrome y navega a `chrome://extensions/`
3. Activa el **"Modo desarrollador"** (esquina superior derecha)
4. Haz clic en **"Cargar extensión sin empaquetar"**
5. Selecciona la carpeta `Plugin`
6. ¡Listo! La extensión está activa

### Actualizar la extensión

Después de hacer cambios en los archivos:
1. Ve a `chrome://extensions/`
2. Busca "FC Troll Detector"
3. Haz clic en el botón 🔄 (recargar)

## 📁 Estructura del proyecto

```
Plugin/
├── manifest.json      # Configuración de la extensión (v1.6.0)
├── content.js         # Script principal (detecta listado vs hilo)
├── styles.css         # Estilos de badges, blacklist y resaltados
├── popup.html         # Panel de configuración
├── popup.css          # Estilos del panel (incluye blacklist)
├── popup.js           # Lógica del panel (whitelist + blacklist)
├── LICENSE            # Licencia MIT
└── README.md          # Este archivo
```

## 💾 Almacenamiento de datos

### Caché de usuarios (localStorage)
- Los datos de cada usuario se guardan durante **24 horas**
- Formato: `fc_troll_cache_{userId}`
- Hace la extensión mucho más rápida en visitas posteriores

### Configuración (Chrome Storage Sync)
- Tu configuración se sincroniza con tu cuenta de Chrome
- Disponible en todos tus dispositivos
- Clave: `fcTrollConfig`

## 🔒 Privacidad

- La extensión **NO** recopila datos personales
- **NO** envía información a servidores externos
- Todo el procesamiento es **local** en tu navegador
- Solo accede a páginas **públicas** de ForoCoches
- La configuración se guarda en tu cuenta de Chrome (opcional)

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

## 📋 Changelog

### v1.6.0
- ✨ **Soporte para Trending**: Analiza los 5 hilos destacados del sidebar
- ✨ Badge compacto en cada hilo trending
- ✨ Resaltado visual rojo para hilos de trolls en trending
- ✨ Procesamiento en paralelo junto con el listado principal

### v1.5.0
- ✨ **Importar/Exportar configuración**: Exporta e importa toda tu configuración en JSON
- ✨ Comparte listas de usuarios entre dispositivos o con amigos
- ✨ Backup completo de whitelist, blacklist y ajustes

### v1.4.0
- ✨ **Sistema de Blacklist**: Marca usuarios como trolls conocidos
- ✨ **Resaltado visual**: Posts e hilos de trolls resaltados en rojo
- ✨ **Badge de troll**: Nuevo badge `🚫 Troll` para usuarios blacklisted
- ✨ **Indicador en posts**: Etiqueta `⚠️ TROLL` sobre mensajes de trolls
- ✨ **Gestión desde el foro**: Botones ⭐ y 🚫 para añadir/quitar de listas
- 🔧 Panel de configuración ampliado con sección de blacklist

### v1.3.0
- ✨ Botón ⭐ junto a cada badge para gestionar whitelist
- ✨ Notificaciones al añadir/quitar usuarios de listas
- ✨ Sincronización en tiempo real de cambios

### v1.2.0
- ✨ **Soporte para listado de foros** (`forumdisplay.php`)
- ✨ Análisis del OP de cada hilo en el listado
- ✨ Badge compacto para el listado
- ✨ Caché de OPs de hilos para mayor velocidad
- 🔧 Código refactorizado y optimizado

### v1.1.0
- ✨ Panel de configuración con popup
- ✨ Lista de usuarios fiables (whitelist)
- ✨ Umbrales y pesos personalizables
- ✨ Caché persistente en localStorage (24h)
- ✨ Sincronización de configuración con Chrome
- 🐛 Corrección de bug NaN% en badges

### v1.0.0
- 🎉 Versión inicial
- Análisis de todos los usuarios del hilo
- Badge con código de colores
- Indicador de OP con corona

---

*Proyecto educativo y de entretenimiento - Sin afiliación con ForoCoches.com*
