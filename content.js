/**
 * ForoCoches Troll Detector
 * 
 * Detecta la probabilidad de que los usuarios de un hilo sean trolls
 * basándose en: fecha de registro, hilos abiertos y mensajes/día
 * 
 * DISCLAIMER:
 * -----------
 * Este proyecto es independiente y NO está afiliado, patrocinado ni
 * respaldado por ForoCoches.com ni por Link World Network S.L.
 * 
 * La extensión solo accede a datos públicamente disponibles en los
 * perfiles de usuario. No recaba datos con fines publicitarios ni
 * comerciales. Es un proyecto de código abierto sin ánimo de lucro.
 * 
 * El uso de esta extensión es responsabilidad del usuario.
 * 
 * @license MIT
 * @author Proyecto de código abierto
 */

(function() {
    'use strict';

    // Configuración por defecto (se sobrescribe con la del usuario)
    let CONFIG = {
        PESO_ANTIGUEDAD: 0.5,
        PESO_ACTIVIDAD: 0.5,
        UMBRAL_ALTO: 70,
        UMBRAL_MEDIO: 40,
        DIAS_CUENTA_NUEVA: 365,
        MENSAJES_DIA_ALTO: 10,
        DELAY_ENTRE_PETICIONES: 200,
        MAX_USUARIOS_POR_PAGINA: 50,
        USUARIOS_FIABLES: [],
        MOSTRAR_TOOLTIP: true,
        ANALIZAR_AUTO: true
    };

    // Caché de usuarios ya analizados
    const cacheUsuarios = new Map();

    // Meses en español para parsear fechas
    const MESES = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3,
        'may': 4, 'jun': 5, 'jul': 6, 'ago': 7,
        'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
    };

    /**
     * Carga la configuración desde chrome.storage
     */
    async function cargarConfiguracion() {
        try {
            const result = await chrome.storage.sync.get('fcTrollConfig');
            if (result.fcTrollConfig) {
                const c = result.fcTrollConfig;
                CONFIG.UMBRAL_ALTO = c.umbralAlto || 70;
                CONFIG.UMBRAL_MEDIO = c.umbralMedio || 40;
                CONFIG.PESO_ANTIGUEDAD = (c.pesoAntiguedad || 50) / 100;
                CONFIG.PESO_ACTIVIDAD = (c.pesoActividad || 50) / 100;
                CONFIG.USUARIOS_FIABLES = (c.usuariosFiables || []).map(u => u.toLowerCase());
                CONFIG.MOSTRAR_TOOLTIP = c.mostrarTooltip !== false;
                CONFIG.ANALIZAR_AUTO = c.analizarAuto !== false;
            }
            console.log('🔧 FC Troll Detector: Configuración cargada', CONFIG);
        } catch (error) {
            console.warn('FC Troll Detector: Usando configuración por defecto', error);
        }
    }

    /**
     * Escucha cambios en la configuración
     */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.tipo === 'CONFIG_ACTUALIZADA') {
            console.log('🔄 FC Troll Detector: Configuración actualizada, recargando...');
            location.reload();
        }
    });

    /**
     * Verifica si un usuario está en la lista de fiables
     */
    function esUsuarioFiable(nombreUsuario) {
        return CONFIG.USUARIOS_FIABLES.includes(nombreUsuario.toLowerCase());
    }

    /**
     * Parsea una fecha en formato "DD-mes-YYYY" (ej: "29-ene-2014")
     */
    function parsearFechaFC(fechaStr) {
        const partes = fechaStr.toLowerCase().trim().split('-');
        if (partes.length !== 3) return null;
        
        const dia = parseInt(partes[0], 10);
        const mes = MESES[partes[1]];
        const anio = parseInt(partes[2], 10);
        
        if (isNaN(dia) || mes === undefined || isNaN(anio)) return null;
        
        return new Date(anio, mes, dia);
    }

    /**
     * Calcula los días desde una fecha hasta hoy
     */
    function diasDesde(fecha) {
        const hoy = new Date();
        const diffTime = Math.abs(hoy - fecha);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Calcula la probabilidad de troll (0-100)
     */
    function calcularProbabilidadTroll(fechaRegistro, numHilos, numMensajes) {
        const diasRegistrado = diasDesde(fechaRegistro);
        
        // Factor antigüedad (0-100): más nuevo = más puntos
        const diasMaxReferencia = 365 * 10; // 10 años como referencia
        const factorAntiguedad = Math.max(0, 100 - (diasRegistrado / diasMaxReferencia) * 100);
        
        // Factor actividad: mensajes por día
        const mensajesPorDia = diasRegistrado > 0 ? numMensajes / diasRegistrado : numMensajes;
        const hilosPorDia = diasRegistrado > 0 ? numHilos / diasRegistrado : numHilos;
        
        // Actividad combinada
        const actividadDiaria = mensajesPorDia + (hilosPorDia * 5);
        
        // Factor actividad (0-100)
        const actividadMaxReferencia = 20;
        const factorActividad = Math.min(100, (actividadDiaria / actividadMaxReferencia) * 100);
        
        // Combinación ponderada con pesos configurables
        let probabilidad = (factorAntiguedad * CONFIG.PESO_ANTIGUEDAD) + 
                          (factorActividad * CONFIG.PESO_ACTIVIDAD);
        
        // Bonus: cuenta muy nueva con mucha actividad
        if (diasRegistrado < CONFIG.DIAS_CUENTA_NUEVA && mensajesPorDia > CONFIG.MENSAJES_DIA_ALTO) {
            probabilidad = Math.min(100, probabilidad * 1.2);
        }
        
        // Penalización: cuenta antigua con poca actividad
        if (diasRegistrado > 365 * 3 && mensajesPorDia < 2) {
            probabilidad = Math.max(0, probabilidad * 0.7);
        }
        
        return Math.round(probabilidad);
    }

    /**
     * Determina el nivel de riesgo basado en la probabilidad
     */
    function getNivelRiesgo(probabilidad) {
        if (probabilidad >= CONFIG.UMBRAL_ALTO) {
            return { nivel: 'alto', emoji: '🔴', clase: 'troll-alto' };
        } else if (probabilidad >= CONFIG.UMBRAL_MEDIO) {
            return { nivel: 'medio', emoji: '🟡', clase: 'troll-medio' };
        }
        return { nivel: 'bajo', emoji: '🟢', clase: 'troll-bajo' };
    }

    /**
     * Crea el elemento badge para mostrar junto al nickname
     */
    function crearBadge(probabilidad, datos, esOP = false, esFiable = false) {
        let riesgo;
        let textoExtra = '';
        
        if (esFiable) {
            // Usuario marcado como fiable
            riesgo = { nivel: 'fiable', emoji: '✅', clase: 'troll-fiable' };
            textoExtra = ' ⭐';
        } else {
            riesgo = getNivelRiesgo(probabilidad);
        }
        
        const badge = document.createElement('span');
        badge.className = `fc-troll-badge ${riesgo.clase}`;
        
        // Mostrar indicador de OP si corresponde
        const opIndicator = esOP ? ' 👑' : '';
        
        if (esFiable) {
            badge.innerHTML = `${riesgo.emoji} Fiable${opIndicator}`;
        } else {
            badge.innerHTML = `${riesgo.emoji} ${probabilidad}%${opIndicator}${textoExtra}`;
        }
        
        // Tooltip con información detallada
        if (CONFIG.MOSTRAR_TOOLTIP) {
            const tipoUsuario = esOP ? '(OP) ' : '';
            const fiableText = esFiable ? '⭐ USUARIO FIABLE (whitelist)\n' : '';
            badge.title = `${fiableText}🎯 ${tipoUsuario}Probabilidad Troll: ${probabilidad}%\n` +
                         `📅 Registro: ${datos.fechaRegistroStr}\n` +
                         `📝 Hilos: ${datos.hilos}\n` +
                         `💬 Mensajes: ${datos.mensajes}\n` +
                         `📊 Msgs/día: ${datos.mensajesDia.toFixed(2)}\n` +
                         `⏱️ Antigüedad: ${datos.diasRegistrado} días`;
        }
        
        return badge;
    }

    /**
     * Crea un badge de carga
     */
    function crearBadgeCargando() {
        const badge = document.createElement('span');
        badge.className = 'fc-troll-badge fc-troll-loading';
        badge.innerHTML = '⏳';
        badge.title = 'Analizando usuario...';
        return badge;
    }

    /**
     * Obtiene los datos del usuario desde su página de perfil
     */
    async function obtenerDatosUsuario(urlPerfil) {
        const match = urlPerfil.match(/u=(\d+)/);
        const userId = match ? match[1] : urlPerfil;
        
        // Verificar caché en memoria
        if (cacheUsuarios.has(userId)) {
            return cacheUsuarios.get(userId);
        }
        
        // Verificar caché en localStorage
        try {
            const cacheKey = `fc_troll_cache_${userId}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                // Caché válida por 24 horas
                if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
                    data.datos.fechaRegistro = new Date(data.datos.fechaRegistro);
                    cacheUsuarios.set(userId, data.datos);
                    return data.datos;
                }
            }
        } catch (e) {
            // Ignorar errores de localStorage
        }
        
        try {
            const response = await fetch(urlPerfil);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Buscar fecha de registro
            let fechaRegistroStr = null;
            const allText = doc.body.textContent;
            const fechaMatch = allText.match(/Desde\s*(\d{1,2}-[a-z]{3}-\d{4})/i);
            if (fechaMatch) {
                fechaRegistroStr = fechaMatch[1];
            }
            
            // Buscar hilos y mensajes
            let hilos = 0;
            let mensajes = 0;
            
            const textoCompleto = doc.body.textContent;
            
            const hilosMatch = textoCompleto.match(/([\d.,]+)\s*Hilos?/i);
            if (hilosMatch) {
                hilos = parseInt(hilosMatch[1].replace(/[.,]/g, ''), 10);
            }
            
            const mensajesMatch = textoCompleto.match(/([\d.,]+)\s*Mensajes?/i);
            if (mensajesMatch) {
                mensajes = parseInt(mensajesMatch[1].replace(/[.,]/g, ''), 10);
            }
            
            if (!fechaRegistroStr) {
                console.warn('FC Troll Detector: No se pudo encontrar la fecha de registro para', urlPerfil);
                return null;
            }
            
            const fechaRegistro = parsearFechaFC(fechaRegistroStr);
            if (!fechaRegistro) {
                console.warn('FC Troll Detector: No se pudo parsear la fecha:', fechaRegistroStr);
                return null;
            }
            
            const diasRegistrado = diasDesde(fechaRegistro);
            
            const datos = {
                fechaRegistro: fechaRegistro,
                fechaRegistroStr,
                hilos,
                mensajes,
                diasRegistrado,
                mensajesDia: diasRegistrado > 0 ? mensajes / diasRegistrado : mensajes
            };
            
            // Guardar en caché de memoria
            cacheUsuarios.set(userId, datos);
            
            // Guardar en localStorage
            try {
                const cacheKey = `fc_troll_cache_${userId}`;
                localStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    datos: datos
                }));
            } catch (e) {
                // Ignorar errores de localStorage
            }
            
            return datos;
            
        } catch (error) {
            console.error('FC Troll Detector: Error obteniendo datos del usuario:', error);
            return null;
        }
    }

    /**
     * Función de espera
     */
    function esperar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Encuentra todos los usuarios únicos en el hilo
     */
    function encontrarUsuarios() {
        const mainContent = document.querySelector('main');
        if (!mainContent) return [];
        
        const enlaces = mainContent.querySelectorAll('a[href*="member.php?u="]:not([href*="u=0"])');
        const usuariosMap = new Map();
        
        for (const enlace of enlaces) {
            const texto = enlace.textContent.trim();
            if (texto && !enlace.querySelector('img') && texto.length > 0 && texto.length < 50) {
                const href = enlace.href;
                const match = href.match(/u=(\d+)/);
                if (match) {
                    const userId = match[1];
                    if (!usuariosMap.has(userId)) {
                        usuariosMap.set(userId, {
                            userId,
                            nombre: texto,
                            href: href,
                            elementos: [enlace]
                        });
                    } else {
                        usuariosMap.get(userId).elementos.push(enlace);
                    }
                }
            }
        }
        
        return Array.from(usuariosMap.values());
    }

    /**
     * Procesa un usuario y añade badges a todos sus elementos
     */
    async function procesarUsuario(usuario, esElOP) {
        const esFiable = esUsuarioFiable(usuario.nombre);
        
        // Añadir badges de carga
        const badgesCargando = [];
        for (const elemento of usuario.elementos) {
            if (!elemento.nextSibling || !elemento.nextSibling.classList?.contains('fc-troll-badge')) {
                const loadingBadge = crearBadgeCargando();
                elemento.parentNode.insertBefore(document.createTextNode(' '), elemento.nextSibling);
                elemento.parentNode.insertBefore(loadingBadge, elemento.nextSibling.nextSibling);
                badgesCargando.push(loadingBadge);
            }
        }
        
        // Obtener datos del usuario
        const datos = await obtenerDatosUsuario(usuario.href);
        
        // Eliminar badges de carga
        for (const badge of badgesCargando) {
            badge.remove();
        }
        
        if (!datos) {
            return;
        }
        
        // Calcular probabilidad
        const probabilidad = calcularProbabilidadTroll(
            datos.fechaRegistro,
            datos.hilos,
            datos.mensajes
        );
        
        const logIcon = esFiable ? '⭐' : '📊';
        console.log(`${logIcon} FC Troll Detector: ${usuario.nombre}`, {
            probabilidad: `${probabilidad}%`,
            esOP: esElOP,
            esFiable,
            ...datos
        });
        
        // Añadir badges finales
        for (const elemento of usuario.elementos) {
            const siguiente = elemento.nextSibling;
            if (siguiente && siguiente.nodeType === Node.TEXT_NODE) {
                const siguienteSiguiente = siguiente.nextSibling;
                if (siguienteSiguiente && siguienteSiguiente.classList?.contains('fc-troll-badge')) {
                    continue;
                }
            }
            
            const badge = crearBadge(probabilidad, datos, esElOP, esFiable);
            elemento.parentNode.insertBefore(document.createTextNode(' '), elemento.nextSibling);
            elemento.parentNode.insertBefore(badge, elemento.nextSibling.nextSibling);
        }
    }

    /**
     * Función principal
     */
    async function ejecutarDetector() {
        // Cargar configuración primero
        await cargarConfiguracion();
        
        if (!CONFIG.ANALIZAR_AUTO) {
            console.log('⏸️ FC Troll Detector: Análisis automático desactivado');
            return;
        }
        
        console.log('🔍 FC Troll Detector: Iniciando análisis de todos los usuarios...');
        
        const usuarios = encontrarUsuarios();
        
        if (usuarios.length === 0) {
            console.warn('FC Troll Detector: No se encontraron usuarios');
            return;
        }
        
        console.log(`👥 FC Troll Detector: Encontrados ${usuarios.length} usuarios únicos`);
        
        const usuariosAAnalizar = usuarios.slice(0, CONFIG.MAX_USUARIOS_POR_PAGINA);
        
        for (let i = 0; i < usuariosAAnalizar.length; i++) {
            const usuario = usuariosAAnalizar[i];
            const esElOP = i === 0;
            
            await procesarUsuario(usuario, esElOP);
            
            if (!cacheUsuarios.has(usuario.userId) && i < usuariosAAnalizar.length - 1) {
                await esperar(CONFIG.DELAY_ENTRE_PETICIONES);
            }
        }
        
        console.log('✅ FC Troll Detector: Análisis completado');
    }

    // Ejecutar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(ejecutarDetector, 500);
        });
    } else {
        setTimeout(ejecutarDetector, 500);
    }

})();
