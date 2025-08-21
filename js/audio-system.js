/**
 * 🔊 Sistema de Notificaciones de Audio - BDT Panel
 * Detecta cambios en tiempo real y reproduce sonidos diferenciados
 * Basado en el tutorial del sistema de audio
 */

class AudioNotificationSystem {
    constructor() {
        this.config = {
            enabled: true,
            volume: 0.7,
            newSound: '/sounds/franklin-notification-gta-v.mp3',
            updateSound: '/sounds/billete-papa.mp3',
            showVisualFallback: true
        };
        
        this.stats = {
            totalNotifications: 0,
            newElements: 0,
            updates: 0,
            errors: 0,
            lastNotification: null
        };
        
        this.observers = new Map();
        this.lastKnownState = new Map();
        this.isInitialized = false;
        
        this.init();
    }
    
    /**
     * Inicializar el sistema de audio
     */
    init() {
        this.loadConfig();
        // this.createAudioPanel(); // Función no existe, comentada para evitar error
        this.setupEventListeners();
        this.startMonitoring();
        this.isInitialized = true;
        
        console.log('🔊 Sistema de Audio BDT inicializado');
        this.showVisualNotification('Sistema de audio activado', 'success');
    }
    
    /**
     * Cargar configuración desde localStorage
     */
    loadConfig() {
        const savedConfig = localStorage.getItem('bdt-audio-config');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                this.config = { ...this.config, ...parsed };
            } catch (e) {
                console.warn('Error cargando configuración de audio:', e);
            }
        }
        
        const savedStats = localStorage.getItem('bdt-audio-stats');
        if (savedStats) {
            try {
                const parsed = JSON.parse(savedStats);
                this.stats = { ...this.stats, ...parsed };
            } catch (e) {
                console.warn('Error cargando estadísticas de audio:', e);
            }
        }
    }
    
    /**
     * Guardar configuración en localStorage
     */
    saveConfig() {
        localStorage.setItem('bdt-audio-config', JSON.stringify(this.config));
        localStorage.setItem('bdt-audio-stats', JSON.stringify(this.stats));
    }
    
   
    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Toggle de audio
        const audioToggle = document.getElementById('audio-enabled');
        if (audioToggle) {
            audioToggle.addEventListener('change', (e) => {
                this.config.enabled = e.target.checked;
                this.saveConfig();
                this.showVisualNotification(
                    `Audio ${this.config.enabled ? 'activado' : 'desactivado'}`,
                    this.config.enabled ? 'success' : 'warning'
                );
            });
        }
        
        // Control de volumen
        const volumeControl = document.getElementById('audio-volume');
        const volumeDisplay = document.getElementById('volume-display');
        if (volumeControl && volumeDisplay) {
            volumeControl.addEventListener('input', (e) => {
                this.config.volume = e.target.value / 100;
                volumeDisplay.textContent = e.target.value + '%';
                this.saveConfig();
            });
        }
        
        // Selectores de sonido
        const newSoundSelect = document.getElementById('audio-sound-select');
        const updateSoundSelect = document.getElementById('audio-update-select');
        
        if (newSoundSelect) {
            newSoundSelect.addEventListener('change', (e) => {
                this.config.newSound = e.target.value;
                this.saveConfig();
            });
        }
        
        if (updateSoundSelect) {
            updateSoundSelect.addEventListener('change', (e) => {
                this.config.updateSound = e.target.value;
                this.saveConfig();
            });
        }
        
        // Fallback visual
        const visualFallback = document.getElementById('visual-fallback');
        if (visualFallback) {
            visualFallback.addEventListener('change', (e) => {
                this.config.showVisualFallback = e.target.checked;
                this.saveConfig();
            });
        }
    }
    
    /**
     * Iniciar monitoreo de cambios
     */
    startMonitoring() {
        // Monitorear formularios
        this.monitorForms();
        
        // Monitorear elementos dinámicos
        this.monitorDynamicElements();
        
        // Monitorear Firebase si está disponible
        if (window.db && window.onSnapshot) {
            this.monitorFirebaseChanges();
        }
        
        // Monitorear cambios en el DOM
        this.monitorDOMChanges();
    }
    
    /**
     * Monitorear formularios
     */
    monitorForms() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            // Detectar envíos de formulario
            form.addEventListener('submit', () => {
                this.playNewSound();
                this.updateStats('newElements');
            });
            
            // Detectar cambios en inputs
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    this.playUpdateSound();
                    this.updateStats('updates');
                });
            });
        });
    }
    
    /**
     * Monitorear elementos dinámicos
     */
    monitorDynamicElements() {
        // Monitorear botones de acción
        const buttons = document.querySelectorAll('button[onclick], a[onclick]');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                this.playUpdateSound();
                this.updateStats('updates');
            });
        });
        
        // Monitorear cambios en tablas (si existen)
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        this.playNewSound();
                        this.updateStats('newElements');
                    }
                });
            });
            
            observer.observe(table, {
                childList: true,
                subtree: true
            });
            
            this.observers.set(table, observer);
        });
    }
    
    /**
     * Monitorear cambios en Firebase
     */
    monitorFirebaseChanges() {
        try {
            // Monitorear colección de redirección
            const redireccionRef = window.db && window.collection ? window.collection(window.db, 'redireccion') : null;
            
            if (redireccionRef && window.onSnapshot) {
                window.onSnapshot(redireccionRef, (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            this.playNewSound();
                            this.updateStats('newElements');
                            this.showVisualNotification('Nuevo documento agregado', 'success');
                        } else if (change.type === 'modified') {
                            this.playUpdateSound();
                            this.updateStats('updates');
                            this.showVisualNotification('Documento actualizado', 'info');
                        }
                    });
                });
            }
        } catch (error) {
            console.warn('Error configurando monitoreo Firebase:', error);
        }
    }
    
    /**
     * Monitorear cambios generales en el DOM
     */
    monitorDOMChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    // Detectar nuevos elementos
                    if (mutation.addedNodes.length > 0) {
                        const hasSignificantNodes = Array.from(mutation.addedNodes).some(node => 
                            node.nodeType === Node.ELEMENT_NODE && 
                            !node.classList?.contains('audio-notification') &&
                            node.tagName !== 'SCRIPT'
                        );
                        
                        if (hasSignificantNodes) {
                            this.playNewSound();
                            this.updateStats('newElements');
                        }
                    }
                }
                
                // Detectar cambios de atributos importantes
                if (mutation.type === 'attributes') {
                    const importantAttributes = ['class', 'style', 'data-status'];
                    if (importantAttributes.includes(mutation.attributeName)) {
                        this.playUpdateSound();
                        this.updateStats('updates');
                    }
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'data-status']
        });
        
        this.observers.set('dom', observer);
    }
    
    /**
     * Reproducir sonido para nuevos elementos
     */
    playNewSound() {
        if (!this.config.enabled) return;
        
        try {
            const audio = new Audio(this.config.newSound);
            audio.volume = this.config.volume;
            audio.play().catch(error => {
                console.warn('Error reproduciendo sonido nuevo:', error);
                this.updateStats('errors');
                if (this.config.showVisualFallback) {
                    this.showVisualNotification('Nuevo elemento detectado', 'success');
                }
            });
        } catch (error) {
            console.warn('Error creando audio nuevo:', error);
            this.updateStats('errors');
            if (this.config.showVisualFallback) {
                this.showVisualNotification('Nuevo elemento detectado', 'success');
            }
        }
    }
    
    /**
     * Reproducir sonido para actualizaciones
     */
    playUpdateSound() {
        if (!this.config.enabled) return;
        
        try {
            const audio = new Audio(this.config.updateSound);
            audio.volume = this.config.volume;
            audio.play().catch(error => {
                console.warn('Error reproduciendo sonido actualización:', error);
                this.updateStats('errors');
                if (this.config.showVisualFallback) {
                    this.showVisualNotification('Elemento actualizado', 'info');
                }
            });
        } catch (error) {
            console.warn('Error creando audio actualización:', error);
            this.updateStats('errors');
            if (this.config.showVisualFallback) {
                this.showVisualNotification('Elemento actualizado', 'info');
            }
        }
    }
    
    /**
     * Probar sonido
     */
    testSound(type) {
        if (type === 'new') {
            this.playNewSound();
        } else if (type === 'update') {
            this.playUpdateSound();
        }
    }
    
    /**
     * Actualizar estadísticas
     */
    updateStats(type) {
        this.stats.totalNotifications++;
        this.stats[type]++;
        this.stats.lastNotification = new Date().toLocaleString();
        
        // Actualizar UI
        this.updateStatsDisplay();
        this.saveConfig();
    }
    
    /**
     * Actualizar display de estadísticas
     */
    updateStatsDisplay() {
        const elements = {
            'stat-total': this.stats.totalNotifications,
            'stat-new': this.stats.newElements,
            'stat-updates': this.stats.updates,
            'stat-errors': this.stats.errors,
            'last-notification': this.stats.lastNotification || 'Ninguna'
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }
    
    /**
     * Reiniciar estadísticas
     */
    resetStats() {
        this.stats = {
            totalNotifications: 0,
            newElements: 0,
            updates: 0,
            errors: 0,
            lastNotification: null
        };
        
        this.updateStatsDisplay();
        this.saveConfig();
        this.showVisualNotification('Estadísticas reiniciadas', 'info');
    }
    
    /**
     * Toggle del panel de audio
     */
    toggleAudioPanel() {
        const panel = document.getElementById('audio-panel-section');
        const toggleText = document.getElementById('audio-toggle-text');
        
        if (panel && toggleText) {
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                toggleText.textContent = 'Ocultar';
            } else {
                panel.style.display = 'none';
                toggleText.textContent = 'Mostrar';
            }
        }
    }
    
    /**
     * Mostrar notificación visual
     */
    showVisualNotification(message, type = 'info') {
        if (!this.config.showVisualFallback) return;
        
        const notification = document.createElement('div');
        notification.className = `audio-notification alert alert-${type === 'success' ? 'success' : type === 'warning' ? 'warning' : type === 'error' ? 'danger' : 'info'} alert-dismissible fade show`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <strong>🔊 Audio BDT:</strong> ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
    
    /**
     * Destruir el sistema (cleanup)
     */
    destroy() {
        // Limpiar observers
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers.clear();
        
        // Remover panel
        const panel = document.getElementById('audio-control-panel');
        if (panel) {
            panel.remove();
        }
        
        this.isInitialized = false;
        console.log('🔊 Sistema de Audio BDT destruido');
    }
}

// Inicializar el sistema cuando el DOM esté listo
let audioSystem = null;

function initAudioSystem() {
    if (!audioSystem) {
        audioSystem = new AudioNotificationSystem();
        
        // Hacer disponible globalmente
        window.audioSystem = audioSystem;
    }
}

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAudioSystem);
} else {
    initAudioSystem();
}

// Exportar para uso como módulo
export { AudioNotificationSystem, audioSystem };
