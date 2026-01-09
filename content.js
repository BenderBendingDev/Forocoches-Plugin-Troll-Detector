/**
 * ForoCoches Troll Detector
 * 
 * Detecta la probabilidad de que los usuarios de ForoCoches sean trolls
 * basándose en: fecha de registro, hilos abiertos y mensajes/día
 * 
 * Funciona en:
 * - Hilos (showthread.php): Analiza todos los usuarios del hilo
 * - Listado de foros (forumdisplay.php): Analiza el OP de cada hilo
 * 
 * DISCLAIMER:
 * -----------
 * Este proyecto es independiente y NO está afiliado, patrocinado ni
 * respaldado por ForoCoches.com ni por Link World Network S.L.
 * 
 * @license MIT
 */

(function() {
    'use strict';

    // Configuración por defecto
    let CONFIG = {
        PESO_ANTIGUEDAD: 0.5,
        PESO_ACTIVIDAD: 0.5,
        UMBRAL_ALTO: 70,
        UMBRAL_MEDIO: 40,
        DIAS_CUENTA_NUEVA: 365,
        MENSAJES_DIA_ALTO: 10,
        DELAY_ENTRE_PETICIONES: 50,
        MAX_USUARIOS_POR_PAGINA: 50,
        MAX_HILOS_POR_PAGINA: 40,
        CONCURRENCIA_LISTADO: 6,  // Peticiones simultáneas en listado
        CONCURRENCIA_HILO: 4,     // Peticiones simultáneas en hilo
        USUARIOS_FIABLES: [],
        MOSTRAR_TOOLTIP: true,
        ANALIZAR_AUTO: true
    };

    // Caché de usuarios
    const cacheUsuarios = new Map();
    
    // Caché de OPs de hilos (threadId -> userId)
    const cacheOPsHilos = new Map();

    // Meses en español
    const MESES = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3,
        'may': 4, 'jun': 5, 'jul': 6, 'ago': 7,
        'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
    };

    // ==================== CONFIGURACIÓN ====================

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
        } catch (error) {
            console.warn('FC Troll Detector: Usando configuración por defecto');
        }
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (message.tipo === 'CONFIG_ACTUALIZADA') {
            location.reload();
        }
    });

    // ==================== UTILIDADES ====================

    function esUsuarioFiable(nombreUsuario) {
        return CONFIG.USUARIOS_FIABLES.includes(nombreUsuario.toLowerCase());
    }

    function parsearFechaFC(fechaStr) {
        const partes = fechaStr.toLowerCase().trim().split('-');
        if (partes.length !== 3) return null;
        const dia = parseInt(partes[0], 10);
        const mes = MESES[partes[1]];
        const anio = parseInt(partes[2], 10);
        if (isNaN(dia) || mes === undefined || isNaN(anio)) return null;
        return new Date(anio, mes, dia);
    }

    function diasDesde(fecha) {
        const hoy = new Date();
        const diffTime = Math.abs(hoy - fecha);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    function esperar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Procesa un array de tareas en paralelo con límite de concurrencia
     */
    async function procesarEnParalelo(items, procesarFn, concurrencia) {
        const resultados = [];
        const enProceso = new Set();
        const cola = [...items];
        
        return new Promise((resolve) => {
            const procesarSiguiente = async () => {
                if (cola.length === 0 && enProceso.size === 0) {
                    resolve(resultados);
                    return;
                }
                
                while (enProceso.size < concurrencia && cola.length > 0) {
                    const item = cola.shift();
                    const promesa = procesarFn(item)
                        .then(resultado => {
                            resultados.push(resultado);
                            enProceso.delete(promesa);
                            procesarSiguiente();
                        })
                        .catch(() => {
                            enProceso.delete(promesa);
                            procesarSiguiente();
                        });
                    enProceso.add(promesa);
                }
            };
            
            procesarSiguiente();
        });
    }

    // ==================== ALGORITMO ====================

    function calcularProbabilidadTroll(fechaRegistro, numHilos, numMensajes) {
        const diasRegistrado = diasDesde(fechaRegistro);
        
        const diasMaxReferencia = 365 * 10;
        const factorAntiguedad = Math.max(0, 100 - (diasRegistrado / diasMaxReferencia) * 100);
        
        const mensajesPorDia = diasRegistrado > 0 ? numMensajes / diasRegistrado : numMensajes;
        const hilosPorDia = diasRegistrado > 0 ? numHilos / diasRegistrado : numHilos;
        const actividadDiaria = mensajesPorDia + (hilosPorDia * 5);
        
        const actividadMaxReferencia = 20;
        const factorActividad = Math.min(100, (actividadDiaria / actividadMaxReferencia) * 100);
        
        let probabilidad = (factorAntiguedad * CONFIG.PESO_ANTIGUEDAD) + 
                          (factorActividad * CONFIG.PESO_ACTIVIDAD);
        
        if (diasRegistrado < CONFIG.DIAS_CUENTA_NUEVA && mensajesPorDia > CONFIG.MENSAJES_DIA_ALTO) {
            probabilidad = Math.min(100, probabilidad * 1.2);
        }
        
        if (diasRegistrado > 365 * 3 && mensajesPorDia < 2) {
            probabilidad = Math.max(0, probabilidad * 0.7);
        }
        
        return Math.round(probabilidad);
    }

    function getNivelRiesgo(probabilidad) {
        if (probabilidad >= CONFIG.UMBRAL_ALTO) {
            return { nivel: 'alto', emoji: '🔴', clase: 'troll-alto' };
        } else if (probabilidad >= CONFIG.UMBRAL_MEDIO) {
            return { nivel: 'medio', emoji: '🟡', clase: 'troll-medio' };
        }
        return { nivel: 'bajo', emoji: '🟢', clase: 'troll-bajo' };
    }

    // ==================== WHITELIST ====================

    async function toggleWhitelist(nombreUsuario, boton, badgeContainer) {
        const nombreLower = nombreUsuario.toLowerCase();
        const estaEnWhitelist = CONFIG.USUARIOS_FIABLES.includes(nombreLower);
        
        try {
            const result = await chrome.storage.sync.get('fcTrollConfig');
            const config = result.fcTrollConfig || {};
            let lista = config.usuariosFiables || [];
            
            if (estaEnWhitelist) {
                // Quitar de whitelist
                lista = lista.filter(u => u.toLowerCase() !== nombreLower);
                CONFIG.USUARIOS_FIABLES = CONFIG.USUARIOS_FIABLES.filter(u => u !== nombreLower);
                boton.innerHTML = '⭐';
                boton.title = `Añadir "${nombreUsuario}" a usuarios fiables`;
                boton.classList.remove('fc-whitelist-active');
                mostrarNotificacion(`❌ "${nombreUsuario}" quitado de fiables`);
            } else {
                // Añadir a whitelist
                lista.push(nombreUsuario);
                CONFIG.USUARIOS_FIABLES.push(nombreLower);
                boton.innerHTML = '★';
                boton.title = `Quitar "${nombreUsuario}" de usuarios fiables`;
                boton.classList.add('fc-whitelist-active');
                mostrarNotificacion(`✅ "${nombreUsuario}" añadido a fiables`);
            }
            
            config.usuariosFiables = lista;
            await chrome.storage.sync.set({ fcTrollConfig: config });
            
            // Actualizar todos los badges de este usuario en la página
            actualizarBadgesUsuario(nombreUsuario);
            
        } catch (error) {
            console.error('FC Troll Detector: Error actualizando whitelist:', error);
            mostrarNotificacion('❌ Error al actualizar', true);
        }
    }

    function mostrarNotificacion(mensaje, esError = false) {
        // Eliminar notificación anterior si existe
        const anterior = document.querySelector('.fc-notificacion');
        if (anterior) anterior.remove();
        
        const notif = document.createElement('div');
        notif.className = `fc-notificacion${esError ? ' fc-notif-error' : ''}`;
        notif.textContent = mensaje;
        document.body.appendChild(notif);
        
        // Mostrar con animación
        setTimeout(() => notif.classList.add('fc-notif-visible'), 10);
        
        // Ocultar después de 2 segundos
        setTimeout(() => {
            notif.classList.remove('fc-notif-visible');
            setTimeout(() => notif.remove(), 300);
        }, 2000);
    }

    function actualizarBadgesUsuario(nombreUsuario) {
        const esFiable = esUsuarioFiable(nombreUsuario);
        const badges = document.querySelectorAll(`[data-usuario="${nombreUsuario.toLowerCase()}"]`);
        
        badges.forEach(container => {
            const badge = container.querySelector('.fc-troll-badge');
            const boton = container.querySelector('.fc-whitelist-btn');
            
            if (badge && !badge.classList.contains('fc-troll-loading')) {
                const probabilidad = parseInt(badge.dataset.probabilidad) || 0;
                const esOP = badge.dataset.esop === 'true';
                const compacto = badge.classList.contains('fc-badge-compact');
                
                // Actualizar clase del badge
                badge.classList.remove('troll-alto', 'troll-medio', 'troll-bajo', 'troll-fiable');
                
                if (esFiable) {
                    badge.classList.add('troll-fiable');
                    badge.innerHTML = compacto ? '✅' : `✅ Fiable${esOP ? ' 👑' : ''}`;
                } else {
                    const riesgo = getNivelRiesgo(probabilidad);
                    badge.classList.add(riesgo.clase);
                    badge.innerHTML = `${riesgo.emoji} ${probabilidad}%${esOP ? ' 👑' : ''}`;
                }
            }
            
            if (boton) {
                if (esFiable) {
                    boton.innerHTML = '★';
                    boton.classList.add('fc-whitelist-active');
                    boton.title = `Quitar "${nombreUsuario}" de usuarios fiables`;
                } else {
                    boton.innerHTML = '⭐';
                    boton.classList.remove('fc-whitelist-active');
                    boton.title = `Añadir "${nombreUsuario}" a usuarios fiables`;
                }
            }
        });
    }

    // ==================== BADGES ====================

    function crearBadge(probabilidad, datos, esOP = false, esFiable = false, compacto = false, nombreUsuario = '') {
        let riesgo;
        
        if (esFiable) {
            riesgo = { nivel: 'fiable', emoji: '✅', clase: 'troll-fiable' };
        } else {
            riesgo = getNivelRiesgo(probabilidad);
        }
        
        const badge = document.createElement('span');
        badge.className = `fc-troll-badge ${riesgo.clase}${compacto ? ' fc-badge-compact' : ''}`;
        badge.dataset.probabilidad = probabilidad;
        badge.dataset.esop = esOP;
        
        const opIndicator = esOP ? ' 👑' : '';
        
        if (esFiable) {
            badge.innerHTML = compacto ? '✅' : `${riesgo.emoji} Fiable${opIndicator}`;
        } else {
            badge.innerHTML = `${riesgo.emoji} ${probabilidad}%${opIndicator}`;
        }
        
        if (CONFIG.MOSTRAR_TOOLTIP && datos) {
            const tipoUsuario = esOP ? '(OP) ' : '';
            const fiableText = esFiable ? '⭐ USUARIO FIABLE\n' : '';
            badge.title = `${fiableText}🎯 ${tipoUsuario}Probabilidad Troll: ${probabilidad}%\n` +
                         `📅 Registro: ${datos.fechaRegistroStr}\n` +
                         `📝 Hilos: ${datos.hilos}\n` +
                         `💬 Mensajes: ${datos.mensajes}\n` +
                         `📊 Msgs/día: ${datos.mensajesDia.toFixed(2)}\n` +
                         `⏱️ Antigüedad: ${datos.diasRegistrado} días`;
        }
        
        return badge;
    }

    function crearBotonWhitelist(nombreUsuario, esFiable, compacto = false) {
        const boton = document.createElement('button');
        boton.className = `fc-whitelist-btn${compacto ? ' fc-btn-compact' : ''}${esFiable ? ' fc-whitelist-active' : ''}`;
        boton.innerHTML = esFiable ? '★' : '⭐';
        boton.title = esFiable 
            ? `Quitar "${nombreUsuario}" de usuarios fiables`
            : `Añadir "${nombreUsuario}" a usuarios fiables`;
        
        boton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWhitelist(nombreUsuario, boton, boton.closest('.fc-badge-container'));
        });
        
        return boton;
    }

    function crearContenedorBadge(badge, botonWhitelist, nombreUsuario) {
        const container = document.createElement('span');
        container.className = 'fc-badge-container';
        container.dataset.usuario = nombreUsuario.toLowerCase();
        container.appendChild(badge);
        container.appendChild(botonWhitelist);
        return container;
    }

    function crearBadgeCargando(compacto = false) {
        const badge = document.createElement('span');
        badge.className = `fc-troll-badge fc-troll-loading${compacto ? ' fc-badge-compact' : ''}`;
        badge.innerHTML = '⏳';
        badge.title = 'Analizando...';
        return badge;
    }

    // ==================== OBTENCIÓN DE DATOS ====================

    async function obtenerDatosUsuario(urlPerfil) {
        const match = urlPerfil.match(/u=(\d+)/);
        const userId = match ? match[1] : urlPerfil;
        
        if (cacheUsuarios.has(userId)) {
            return cacheUsuarios.get(userId);
        }
        
        // Caché en localStorage
        try {
            const cacheKey = `fc_troll_cache_${userId}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
                    data.datos.fechaRegistro = new Date(data.datos.fechaRegistro);
                    cacheUsuarios.set(userId, data.datos);
                    return data.datos;
                }
            }
        } catch (e) {}
        
        try {
            const response = await fetch(urlPerfil);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            let fechaRegistroStr = null;
            const allText = doc.body.textContent;
            const fechaMatch = allText.match(/Desde\s*(\d{1,2}-[a-z]{3}-\d{4})/i);
            if (fechaMatch) {
                fechaRegistroStr = fechaMatch[1];
            }
            
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
            
            if (!fechaRegistroStr) return null;
            
            const fechaRegistro = parsearFechaFC(fechaRegistroStr);
            if (!fechaRegistro) return null;
            
            const diasRegistrado = diasDesde(fechaRegistro);
            
            const datos = {
                fechaRegistro,
                fechaRegistroStr,
                hilos,
                mensajes,
                diasRegistrado,
                mensajesDia: diasRegistrado > 0 ? mensajes / diasRegistrado : mensajes
            };
            
            cacheUsuarios.set(userId, datos);
            
            try {
                localStorage.setItem(`fc_troll_cache_${userId}`, JSON.stringify({
                    timestamp: Date.now(),
                    datos
                }));
            } catch (e) {}
            
            return datos;
        } catch (error) {
            console.error('FC Troll Detector: Error obteniendo datos:', error);
            return null;
        }
    }

    /**
     * Obtiene el userId del OP de un hilo accediendo a su primera página
     */
    async function obtenerOPDeHilo(threadId) {
        if (cacheOPsHilos.has(threadId)) {
            return cacheOPsHilos.get(threadId);
        }
        
        try {
            const url = `https://forocoches.com/foro/showthread.php?t=${threadId}`;
            const response = await fetch(url);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Buscar el primer enlace de perfil de usuario
            const mainContent = doc.querySelector('main');
            if (!mainContent) return null;
            
            const enlaces = mainContent.querySelectorAll('a[href*="member.php?u="]:not([href*="u=0"])');
            for (const enlace of enlaces) {
                const texto = enlace.textContent.trim();
                if (texto && !enlace.querySelector('img') && texto.length > 0 && texto.length < 50) {
                    const href = enlace.href;
                    const match = href.match(/u=(\d+)/);
                    if (match) {
                        const resultado = {
                            userId: match[1],
                            nombre: texto,
                            href: href.startsWith('http') ? href : `https://forocoches.com/foro/${href}`
                        };
                        cacheOPsHilos.set(threadId, resultado);
                        return resultado;
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('FC Troll Detector: Error obteniendo OP del hilo:', error);
            return null;
        }
    }

    // ==================== MODO HILO (showthread.php) ====================

    function encontrarUsuariosEnHilo() {
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
                            href,
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

    async function procesarUsuarioEnHilo(usuario, esElOP) {
        const esFiable = esUsuarioFiable(usuario.nombre);
        
        const badgesCargando = [];
        for (const elemento of usuario.elementos) {
            if (!elemento.nextSibling?.classList?.contains('fc-badge-container') && 
                !elemento.nextSibling?.classList?.contains('fc-troll-badge')) {
                const loadingBadge = crearBadgeCargando();
                elemento.parentNode.insertBefore(document.createTextNode(' '), elemento.nextSibling);
                elemento.parentNode.insertBefore(loadingBadge, elemento.nextSibling?.nextSibling);
                badgesCargando.push(loadingBadge);
            }
        }
        
        const datos = await obtenerDatosUsuario(usuario.href);
        
        for (const badge of badgesCargando) {
            badge.remove();
        }
        
        if (!datos) return;
        
        const probabilidad = calcularProbabilidadTroll(datos.fechaRegistro, datos.hilos, datos.mensajes);
        
        for (const elemento of usuario.elementos) {
            const siguiente = elemento.nextSibling;
            if (siguiente?.nodeType === Node.TEXT_NODE) {
                const ss = siguiente.nextSibling;
                if (ss?.classList?.contains('fc-badge-container') || ss?.classList?.contains('fc-troll-badge')) continue;
            }
            
            const badge = crearBadge(probabilidad, datos, esElOP, esFiable, false, usuario.nombre);
            const botonWL = crearBotonWhitelist(usuario.nombre, esFiable, false);
            const container = crearContenedorBadge(badge, botonWL, usuario.nombre);
            
            elemento.parentNode.insertBefore(document.createTextNode(' '), elemento.nextSibling);
            elemento.parentNode.insertBefore(container, elemento.nextSibling?.nextSibling);
        }
    }

    async function ejecutarEnHilo() {
        console.log('🔍 FC Troll Detector: Analizando hilo...');
        
        const usuarios = encontrarUsuariosEnHilo();
        if (usuarios.length === 0) return;
        
        console.log(`👥 Encontrados ${usuarios.length} usuarios (procesando ${CONFIG.CONCURRENCIA_HILO} en paralelo)`);
        
        const usuariosAAnalizar = usuarios.slice(0, CONFIG.MAX_USUARIOS_POR_PAGINA);
        
        // El primer usuario (OP) se procesa primero
        if (usuariosAAnalizar.length > 0) {
            await procesarUsuarioEnHilo(usuariosAAnalizar[0], true);
        }
        
        // El resto en paralelo
        if (usuariosAAnalizar.length > 1) {
            const resto = usuariosAAnalizar.slice(1);
            await procesarEnParalelo(
                resto,
                (usuario) => procesarUsuarioEnHilo(usuario, false),
                CONFIG.CONCURRENCIA_HILO
            );
        }
        
        console.log('✅ FC Troll Detector: Análisis de hilo completado');
    }

    // ==================== MODO LISTADO (forumdisplay.php) ====================

    function encontrarHilosEnListado() {
        const mainContent = document.querySelector('main');
        if (!mainContent) return [];
        
        const hilos = [];
        const procesados = new Set();
        
        // Buscar títulos de hilos por su ID
        const titulosHilos = mainContent.querySelectorAll('a[id^="thread_title_"]');
        
        for (const tituloLink of titulosHilos) {
            const threadId = tituloLink.id.replace('thread_title_', '');
            if (procesados.has(threadId)) continue;
            procesados.add(threadId);
            
            const titulo = tituloLink.textContent.trim();
            
            // Buscar el nombre del OP en el texto @Usuario
            let container = tituloLink.parentElement;
            let opNombre = null;
            let opLinkElement = null;
            
            for (let i = 0; i < 5 && container; i++) {
                const opLink = container.querySelector('a[href*="showthread.php?p="]');
                if (opLink) {
                    const opText = opLink.textContent;
                    const match = opText.match(/@([^-]+)\s*-/);
                    if (match) {
                        opNombre = match[1].trim();
                        opLinkElement = opLink;
                        break;
                    }
                }
                container = container.parentElement;
            }
            
            if (opNombre && opLinkElement) {
                hilos.push({
                    threadId,
                    titulo,
                    opNombre,
                    tituloElement: tituloLink,
                    opElement: opLinkElement
                });
            }
        }
        
        return hilos;
    }

    async function procesarHiloEnListado(hilo) {
        const esFiable = esUsuarioFiable(hilo.opNombre);
        
        // Verificar que no tenga ya un badge
        if (hilo.tituloElement.nextSibling?.nextSibling?.classList?.contains('fc-badge-container')) {
            return;
        }
        
        // Crear badge de carga junto al título
        const loadingBadge = crearBadgeCargando(true);
        hilo.tituloElement.parentNode.insertBefore(document.createTextNode(' '), hilo.tituloElement.nextSibling);
        hilo.tituloElement.parentNode.insertBefore(loadingBadge, hilo.tituloElement.nextSibling?.nextSibling);
        
        // Obtener el OP del hilo
        const opInfo = await obtenerOPDeHilo(hilo.threadId);
        
        loadingBadge.remove();
        
        if (!opInfo) return;
        
        // Obtener datos del perfil del OP
        const datos = await obtenerDatosUsuario(opInfo.href);
        
        if (!datos) return;
        
        const probabilidad = calcularProbabilidadTroll(datos.fechaRegistro, datos.hilos, datos.mensajes);
        const nombreOP = opInfo.nombre || hilo.opNombre;
        const esFiableActual = esUsuarioFiable(nombreOP);
        
        // Crear badge y botón whitelist
        const badge = crearBadge(probabilidad, datos, true, esFiableActual, true, nombreOP);
        const botonWL = crearBotonWhitelist(nombreOP, esFiableActual, true);
        const container = crearContenedorBadge(badge, botonWL, nombreOP);
        
        hilo.tituloElement.parentNode.insertBefore(document.createTextNode(' '), hilo.tituloElement.nextSibling);
        hilo.tituloElement.parentNode.insertBefore(container, hilo.tituloElement.nextSibling?.nextSibling);
    }

    async function ejecutarEnListado() {
        console.log('🔍 FC Troll Detector: Analizando listado de hilos...');
        
        const hilos = encontrarHilosEnListado();
        if (hilos.length === 0) {
            console.warn('FC Troll Detector: No se encontraron hilos');
            return;
        }
        
        console.log(`📋 Encontrados ${hilos.length} hilos (procesando ${CONFIG.CONCURRENCIA_LISTADO} en paralelo)`);
        
        const hilosAAnalizar = hilos.slice(0, CONFIG.MAX_HILOS_POR_PAGINA);
        
        // Procesar en paralelo con límite de concurrencia
        await procesarEnParalelo(
            hilosAAnalizar,
            procesarHiloEnListado,
            CONFIG.CONCURRENCIA_LISTADO
        );
        
        console.log('✅ FC Troll Detector: Análisis de listado completado');
    }

    // ==================== INICIO ====================

    async function detectarYEjecutar() {
        await cargarConfiguracion();
        
        if (!CONFIG.ANALIZAR_AUTO) {
            console.log('⏸️ FC Troll Detector: Análisis automático desactivado');
            return;
        }
        
        const url = window.location.href;
        
        if (url.includes('showthread.php')) {
            await ejecutarEnHilo();
        } else if (url.includes('forumdisplay.php')) {
            await ejecutarEnListado();
        }
    }

    // Ejecutar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(detectarYEjecutar, 500));
    } else {
        setTimeout(detectarYEjecutar, 500);
    }

})();
