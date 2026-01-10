/**
 * FC Troll Detector - Popup Script
 * Maneja la configuración del usuario
 */

// Configuración por defecto
const CONFIG_DEFAULT = {
    umbralAlto: 70,
    umbralMedio: 40,
    pesoAntiguedad: 50,
    pesoActividad: 50,
    usuariosFiables: [],
    usuariosBlacklist: [],
    mostrarTooltip: true,
    analizarAuto: true
};

// Elementos del DOM
let elementos = {};

/**
 * Inicializa el popup
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Cachear elementos del DOM
    elementos = {
        umbralAlto: document.getElementById('umbral-alto'),
        umbralAltoValue: document.getElementById('umbral-alto-value'),
        umbralMedio: document.getElementById('umbral-medio'),
        umbralMedioValue: document.getElementById('umbral-medio-value'),
        pesoAntiguedad: document.getElementById('peso-antiguedad'),
        pesoAntiguedadValue: document.getElementById('peso-antiguedad-value'),
        pesoActividad: document.getElementById('peso-actividad'),
        pesoActividadValue: document.getElementById('peso-actividad-value'),
        nuevoUsuario: document.getElementById('nuevo-usuario'),
        btnAgregarUsuario: document.getElementById('btn-agregar-usuario'),
        listaUsuariosFiables: document.getElementById('lista-usuarios-fiables'),
        sinUsuarios: document.getElementById('sin-usuarios'),
        nuevoTroll: document.getElementById('nuevo-troll'),
        btnAgregarTroll: document.getElementById('btn-agregar-troll'),
        listaUsuariosBlacklist: document.getElementById('lista-usuarios-blacklist'),
        sinTrolls: document.getElementById('sin-trolls'),
        mostrarTooltip: document.getElementById('mostrar-tooltip'),
        analizarAuto: document.getElementById('analizar-auto'),
        btnReset: document.getElementById('btn-reset'),
        btnGuardar: document.getElementById('btn-guardar'),
        btnExportar: document.getElementById('btn-exportar'),
        inputImportar: document.getElementById('input-importar'),
        statusMessage: document.getElementById('status-message')
    };

    // Cargar configuración guardada
    await cargarConfiguracion();

    // Configurar event listeners
    configurarEventListeners();
});

/**
 * Carga la configuración desde chrome.storage
 */
async function cargarConfiguracion() {
    try {
        const result = await chrome.storage.sync.get('fcTrollConfig');
        const config = result.fcTrollConfig || CONFIG_DEFAULT;
        
        // Aplicar valores a los controles
        elementos.umbralAlto.value = config.umbralAlto;
        elementos.umbralAltoValue.textContent = config.umbralAlto;
        
        elementos.umbralMedio.value = config.umbralMedio;
        elementos.umbralMedioValue.textContent = config.umbralMedio;
        
        elementos.pesoAntiguedad.value = config.pesoAntiguedad;
        elementos.pesoAntiguedadValue.textContent = config.pesoAntiguedad + '%';
        
        elementos.pesoActividad.value = config.pesoActividad;
        elementos.pesoActividadValue.textContent = config.pesoActividad + '%';
        
        elementos.mostrarTooltip.checked = config.mostrarTooltip;
        elementos.analizarAuto.checked = config.analizarAuto;
        
        // Renderizar lista de usuarios fiables
        renderizarUsuariosFiables(config.usuariosFiables || []);
        
        // Renderizar lista de usuarios blacklist
        renderizarUsuariosBlacklist(config.usuariosBlacklist || []);
        
    } catch (error) {
        console.error('Error cargando configuración:', error);
        mostrarMensaje('Error al cargar configuración', true);
    }
}

/**
 * Guarda la configuración en chrome.storage
 */
async function guardarConfiguracion() {
    try {
        const config = {
            umbralAlto: parseInt(elementos.umbralAlto.value),
            umbralMedio: parseInt(elementos.umbralMedio.value),
            pesoAntiguedad: parseInt(elementos.pesoAntiguedad.value),
            pesoActividad: parseInt(elementos.pesoActividad.value),
            usuariosFiables: obtenerUsuariosFiables(),
            usuariosBlacklist: obtenerUsuariosBlacklist(),
            mostrarTooltip: elementos.mostrarTooltip.checked,
            analizarAuto: elementos.analizarAuto.checked
        };
        
        await chrome.storage.sync.set({ fcTrollConfig: config });
        mostrarMensaje('✓ Configuración guardada');
        
        // Notificar a las pestañas activas que la configuración cambió
        const tabs = await chrome.tabs.query({ url: '*://forocoches.com/*' });
        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, { tipo: 'CONFIG_ACTUALIZADA', config });
            } catch (e) {
                // La pestaña puede no tener el content script cargado
            }
        }
        
    } catch (error) {
        console.error('Error guardando configuración:', error);
        mostrarMensaje('Error al guardar', true);
    }
}

/**
 * Restaura la configuración por defecto
 */
async function restaurarConfiguracion() {
    elementos.umbralAlto.value = CONFIG_DEFAULT.umbralAlto;
    elementos.umbralAltoValue.textContent = CONFIG_DEFAULT.umbralAlto;
    
    elementos.umbralMedio.value = CONFIG_DEFAULT.umbralMedio;
    elementos.umbralMedioValue.textContent = CONFIG_DEFAULT.umbralMedio;
    
    elementos.pesoAntiguedad.value = CONFIG_DEFAULT.pesoAntiguedad;
    elementos.pesoAntiguedadValue.textContent = CONFIG_DEFAULT.pesoAntiguedad + '%';
    
    elementos.pesoActividad.value = CONFIG_DEFAULT.pesoActividad;
    elementos.pesoActividadValue.textContent = CONFIG_DEFAULT.pesoActividad + '%';
    
    elementos.mostrarTooltip.checked = CONFIG_DEFAULT.mostrarTooltip;
    elementos.analizarAuto.checked = CONFIG_DEFAULT.analizarAuto;
    
    renderizarUsuariosFiables([]);
    renderizarUsuariosBlacklist([]);
    
    mostrarMensaje('Valores restaurados');
}

/**
 * Configura los event listeners
 */
function configurarEventListeners() {
    // Sliders de umbrales
    elementos.umbralAlto.addEventListener('input', (e) => {
        elementos.umbralAltoValue.textContent = e.target.value;
        // Asegurar que umbral alto > umbral medio
        if (parseInt(e.target.value) <= parseInt(elementos.umbralMedio.value)) {
            elementos.umbralMedio.value = parseInt(e.target.value) - 5;
            elementos.umbralMedioValue.textContent = elementos.umbralMedio.value;
        }
    });
    
    elementos.umbralMedio.addEventListener('input', (e) => {
        elementos.umbralMedioValue.textContent = e.target.value;
        // Asegurar que umbral medio < umbral alto
        if (parseInt(e.target.value) >= parseInt(elementos.umbralAlto.value)) {
            elementos.umbralAlto.value = parseInt(e.target.value) + 5;
            elementos.umbralAltoValue.textContent = elementos.umbralAlto.value;
        }
    });
    
    // Sliders de pesos (se balancean entre sí)
    elementos.pesoAntiguedad.addEventListener('input', (e) => {
        const valor = parseInt(e.target.value);
        elementos.pesoAntiguedadValue.textContent = valor + '%';
        elementos.pesoActividad.value = 100 - valor;
        elementos.pesoActividadValue.textContent = (100 - valor) + '%';
    });
    
    elementos.pesoActividad.addEventListener('input', (e) => {
        const valor = parseInt(e.target.value);
        elementos.pesoActividadValue.textContent = valor + '%';
        elementos.pesoAntiguedad.value = 100 - valor;
        elementos.pesoAntiguedadValue.textContent = (100 - valor) + '%';
    });
    
    // Agregar usuario fiable
    elementos.btnAgregarUsuario.addEventListener('click', agregarUsuarioFiable);
    elementos.nuevoUsuario.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            agregarUsuarioFiable();
        }
    });
    
    // Agregar usuario a blacklist
    elementos.btnAgregarTroll.addEventListener('click', agregarUsuarioBlacklist);
    elementos.nuevoTroll.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            agregarUsuarioBlacklist();
        }
    });
    
    // Botones principales
    elementos.btnReset.addEventListener('click', restaurarConfiguracion);
    elementos.btnGuardar.addEventListener('click', guardarConfiguracion);
    
    // Botones de importar/exportar
    elementos.btnExportar.addEventListener('click', exportarConfiguracion);
    elementos.inputImportar.addEventListener('change', importarConfiguracion);
}

/**
 * Agrega un usuario a la lista de fiables
 */
function agregarUsuarioFiable() {
    const nombre = elementos.nuevoUsuario.value.trim();
    if (!nombre) return;
    
    const usuariosActuales = obtenerUsuariosFiables();
    
    // Verificar que no exista ya
    if (usuariosActuales.some(u => u.toLowerCase() === nombre.toLowerCase())) {
        mostrarMensaje('Usuario ya existe', true);
        return;
    }
    
    usuariosActuales.push(nombre);
    renderizarUsuariosFiables(usuariosActuales);
    elementos.nuevoUsuario.value = '';
    mostrarMensaje('Usuario añadido');
}

/**
 * Elimina un usuario de la lista de fiables
 */
function eliminarUsuarioFiable(nombre) {
    const usuariosActuales = obtenerUsuariosFiables();
    const nuevaLista = usuariosActuales.filter(u => u !== nombre);
    renderizarUsuariosFiables(nuevaLista);
}

/**
 * Obtiene la lista actual de usuarios fiables del DOM
 */
function obtenerUsuariosFiables() {
    const items = elementos.listaUsuariosFiables.querySelectorAll('li');
    return Array.from(items).map(li => li.querySelector('.user-name').textContent);
}

/**
 * Renderiza la lista de usuarios fiables
 */
function renderizarUsuariosFiables(usuarios) {
    elementos.listaUsuariosFiables.innerHTML = '';
    
    if (usuarios.length === 0) {
        elementos.sinUsuarios.style.display = 'block';
        return;
    }
    
    elementos.sinUsuarios.style.display = 'none';
    
    for (const usuario of usuarios) {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="user-name">${escapeHtml(usuario)}</span>
            <button class="btn-remove" data-usuario="${escapeHtml(usuario)}">✕ Quitar</button>
        `;
        
        li.querySelector('.btn-remove').addEventListener('click', (e) => {
            eliminarUsuarioFiable(e.target.dataset.usuario);
        });
        
        elementos.listaUsuariosFiables.appendChild(li);
    }
}

/**
 * Agrega un usuario a la blacklist
 */
function agregarUsuarioBlacklist() {
    const nombre = elementos.nuevoTroll.value.trim();
    if (!nombre) return;
    
    const usuariosActuales = obtenerUsuariosBlacklist();
    
    // Verificar que no exista ya
    if (usuariosActuales.some(u => u.toLowerCase() === nombre.toLowerCase())) {
        mostrarMensaje('Usuario ya existe', true);
        return;
    }
    
    // Verificar que no esté en la whitelist
    const usuariosFiables = obtenerUsuariosFiables();
    if (usuariosFiables.some(u => u.toLowerCase() === nombre.toLowerCase())) {
        mostrarMensaje('Usuario está en fiables', true);
        return;
    }
    
    usuariosActuales.push(nombre);
    renderizarUsuariosBlacklist(usuariosActuales);
    elementos.nuevoTroll.value = '';
    mostrarMensaje('🚫 Troll añadido');
}

/**
 * Elimina un usuario de la blacklist
 */
function eliminarUsuarioBlacklist(nombre) {
    const usuariosActuales = obtenerUsuariosBlacklist();
    const nuevaLista = usuariosActuales.filter(u => u !== nombre);
    renderizarUsuariosBlacklist(nuevaLista);
}

/**
 * Obtiene la lista actual de usuarios en blacklist del DOM
 */
function obtenerUsuariosBlacklist() {
    const items = elementos.listaUsuariosBlacklist.querySelectorAll('li');
    return Array.from(items).map(li => li.querySelector('.user-name').textContent);
}

/**
 * Renderiza la lista de usuarios en blacklist
 */
function renderizarUsuariosBlacklist(usuarios) {
    elementos.listaUsuariosBlacklist.innerHTML = '';
    
    if (usuarios.length === 0) {
        elementos.sinTrolls.style.display = 'block';
        return;
    }
    
    elementos.sinTrolls.style.display = 'none';
    
    for (const usuario of usuarios) {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="user-name">${escapeHtml(usuario)}</span>
            <button class="btn-remove btn-remove-troll" data-usuario="${escapeHtml(usuario)}">✕ Quitar</button>
        `;
        
        li.querySelector('.btn-remove').addEventListener('click', (e) => {
            eliminarUsuarioBlacklist(e.target.dataset.usuario);
        });
        
        elementos.listaUsuariosBlacklist.appendChild(li);
    }
}

/**
 * Exporta toda la configuración a un archivo JSON
 */
async function exportarConfiguracion() {
    try {
        const config = {
            umbralAlto: parseInt(elementos.umbralAlto.value),
            umbralMedio: parseInt(elementos.umbralMedio.value),
            pesoAntiguedad: parseInt(elementos.pesoAntiguedad.value),
            pesoActividad: parseInt(elementos.pesoActividad.value),
            usuariosFiables: obtenerUsuariosFiables(),
            usuariosBlacklist: obtenerUsuariosBlacklist(),
            mostrarTooltip: elementos.mostrarTooltip.checked,
            analizarAuto: elementos.analizarAuto.checked,
            // Metadatos del export
            _exportInfo: {
                version: '1.4.0',
                fecha: new Date().toISOString(),
                extension: 'FC Troll Detector'
            }
        };
        
        const jsonString = JSON.stringify(config, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Crear nombre de archivo con fecha
        const fecha = new Date().toISOString().split('T')[0];
        const nombreArchivo = `fc-troll-detector-config-${fecha}.json`;
        
        // Crear enlace de descarga y clickearlo
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        mostrarMensaje('📤 Configuración exportada');
    } catch (error) {
        console.error('Error exportando configuración:', error);
        mostrarMensaje('Error al exportar', true);
    }
}

/**
 * Importa la configuración desde un archivo JSON
 */
async function importarConfiguracion(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;
    
    try {
        const texto = await archivo.text();
        const config = JSON.parse(texto);
        
        // Validar que tiene la estructura básica esperada
        if (!validarConfiguracion(config)) {
            mostrarMensaje('Archivo no válido', true);
            return;
        }
        
        // Aplicar valores a los controles
        if (config.umbralAlto !== undefined) {
            elementos.umbralAlto.value = config.umbralAlto;
            elementos.umbralAltoValue.textContent = config.umbralAlto;
        }
        
        if (config.umbralMedio !== undefined) {
            elementos.umbralMedio.value = config.umbralMedio;
            elementos.umbralMedioValue.textContent = config.umbralMedio;
        }
        
        if (config.pesoAntiguedad !== undefined) {
            elementos.pesoAntiguedad.value = config.pesoAntiguedad;
            elementos.pesoAntiguedadValue.textContent = config.pesoAntiguedad + '%';
        }
        
        if (config.pesoActividad !== undefined) {
            elementos.pesoActividad.value = config.pesoActividad;
            elementos.pesoActividadValue.textContent = config.pesoActividad + '%';
        }
        
        if (config.mostrarTooltip !== undefined) {
            elementos.mostrarTooltip.checked = config.mostrarTooltip;
        }
        
        if (config.analizarAuto !== undefined) {
            elementos.analizarAuto.checked = config.analizarAuto;
        }
        
        // Renderizar listas de usuarios
        renderizarUsuariosFiables(config.usuariosFiables || []);
        renderizarUsuariosBlacklist(config.usuariosBlacklist || []);
        
        mostrarMensaje('📥 Configuración importada');
        
        // Limpiar el input para permitir reimportar el mismo archivo
        event.target.value = '';
        
    } catch (error) {
        console.error('Error importando configuración:', error);
        mostrarMensaje('Error al leer archivo', true);
        event.target.value = '';
    }
}

/**
 * Valida que la configuración importada tenga una estructura válida
 */
function validarConfiguracion(config) {
    // Verificar que es un objeto
    if (typeof config !== 'object' || config === null) {
        return false;
    }
    
    // Verificar que tiene al menos algunos campos esperados
    const camposEsperados = ['umbralAlto', 'umbralMedio', 'usuariosFiables', 'usuariosBlacklist'];
    const tieneCampos = camposEsperados.some(campo => config.hasOwnProperty(campo));
    
    if (!tieneCampos) {
        return false;
    }
    
    // Validar tipos si existen
    if (config.umbralAlto !== undefined && typeof config.umbralAlto !== 'number') return false;
    if (config.umbralMedio !== undefined && typeof config.umbralMedio !== 'number') return false;
    if (config.usuariosFiables !== undefined && !Array.isArray(config.usuariosFiables)) return false;
    if (config.usuariosBlacklist !== undefined && !Array.isArray(config.usuariosBlacklist)) return false;
    
    return true;
}

/**
 * Muestra un mensaje de estado temporal
 */
function mostrarMensaje(texto, esError = false) {
    elementos.statusMessage.textContent = texto;
    elementos.statusMessage.style.background = esError ? '#ff6b6b' : '#64ffda';
    elementos.statusMessage.classList.add('show');
    
    setTimeout(() => {
        elementos.statusMessage.classList.remove('show');
    }, 2000);
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
