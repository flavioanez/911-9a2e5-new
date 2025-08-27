/**
 * 🔊 Integración de Audio para cPanel BDT
 * Sistema específico para manejar sonidos en las acciones del panel de control
 */

// Configuración específica del panel
const panelAudioConfig = {
    enabled: true,
    volume: 0.8,
    sounds: {
        cardAction: '/sounds/franklin-notification-gta-v.mp3',    // Cuando se hace clic en una acción
        cardSuccess: '/sounds/billete-papa.mp3',                 // Cuando la acción se completa
        cardError: '/sounds/franklin-notification-gta-v.mp3',    // Cuando hay un error
        userLogin: '/sounds/billete-papa.mp3',                   // Cuando el admin hace login
        userLogout: '/sounds/franklin-notification-gta-v.mp3',   // Cuando el admin hace logout
        newCard: '/sounds/billete-papa.mp3',                     // Cuando aparece una NUEVA card
        cardUpdate: '/sounds/franklin-notification-gta-v.mp3'    // Cuando una card se ACTUALIZA
    },
    notifications: {
        showVisual: true,
        duration: 3000,
        position: 'top-right'
    }
};

// Clase específica para el audio del panel
class PanelAudioSystem {
    constructor() {
        this.config = { ...panelAudioConfig };
        this.stats = {
            totalActions: 0,
            successfulActions: 0,
            failedActions: 0,
            loginEvents: 0
        };
        
        this.loadConfig();
        this.init();
    }
    
    init() {
        console.log('🔊 Sistema de Audio del Panel BDT inicializado');
        this.createPanelAudioControls();
        this.setupEventListeners();
    }
    
    loadConfig() {
        const saved = localStorage.getItem('panel-audio-config');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge inteligente: preservar nuevos sonidos y configuraciones
                this.config = {
                    ...this.config,
                    ...parsed,
                    sounds: {
                        ...this.config.sounds,  // Sonidos por defecto (incluye newCard y cardUpdate)
                        ...parsed.sounds        // Sonidos personalizados del usuario
                    }
                };
            } catch (e) {
                console.warn('Error cargando configuración de audio del panel:', e);
            }
        }
    }
    
    saveConfig() {
        localStorage.setItem('panel-audio-config', JSON.stringify(this.config));
        localStorage.setItem('panel-audio-stats', JSON.stringify(this.stats));
    }
    
    createPanelAudioControls() {
        // Crear controles compactos para el panel
        const controlsHTML = `
            <div class="card mt-3" id="panel-audio-controls" style="border-left: 4px solid #667eea; display:none">
                <div class="card-header bg-light">
                    <h6 class="mb-0 d-flex justify-content-between align-items-center">
                        <span><i class="fa fa-volume-up text-primary"></i> Audio del Panel</span>
                        <button class="btn btn-sm btn-outline-primary" onclick="panelAudio.toggleControls()">
                            <i class="fa fa-cog"></i>
                        </button>
                    </h6>
                </div>
                <div class="card-body p-2" id="panel-audio-body" style="display: none;">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="custom-control custom-switch">
                                <input type="checkbox" class="custom-control-input" id="panel-audio-enabled" ${this.config.enabled ? 'checked' : ''}>
                                <label class="custom-control-label" for="panel-audio-enabled">
                                    <small>Activar sonidos</small>
                                </label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <small>Volumen: <span id="panel-volume-display">${Math.round(this.config.volume * 100)}%</span></small>
                            <input type="range" class="custom-range" id="panel-audio-volume" 
                                   min="0" max="100" value="${Math.round(this.config.volume * 100)}">
                        </div>
                    </div>
                    <div class="row mt-2">
                        <div class="col-md-6">
                            <small>Sonido Nueva Card:</small>
                            <select class="form-control form-control-sm" id="panel-new-card-sound">
                                <option value="/sounds/billete-papa.mp3" ${this.config.sounds.newCard === '/sounds/billete-papa.mp3' ? 'selected' : ''}>Billete Papa</option>
                                <option value="/sounds/franklin-notification-gta-v.mp3" ${this.config.sounds.newCard === '/sounds/franklin-notification-gta-v.mp3' ? 'selected' : ''}>Franklin GTA</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <small>Sonido Actualización:</small>
                            <select class="form-control form-control-sm" id="panel-update-card-sound">
                                <option value="/sounds/billete-papa.mp3" ${this.config.sounds.cardUpdate === '/sounds/billete-papa.mp3' ? 'selected' : ''}>Billete Papa</option>
                                <option value="/sounds/franklin-notification-gta-v.mp3" ${this.config.sounds.cardUpdate === '/sounds/franklin-notification-gta-v.mp3' ? 'selected' : ''}>Franklin GTA</option>
                            </select>
                        </div>
                    </div>
                    <div class="row mt-2">
                        <div class="col-md-12">
                            <div class="d-flex justify-content-between text-center">
                                <div>
                                    <small class="text-muted">Activaciones</small>
                                    <div class="font-weight-bold text-primary" id="panel-total-actions">${this.stats.totalActions}</div>
                                </div>
                                <div>
                                    <small class="text-muted">Exitosas</small>
                                    <div class="font-weight-bold text-success" id="panel-successful-actions">${this.stats.successfulActions}</div>
                                </div>
                                <div>
                                    <small class="text-muted">Errores</small>
                                    <div class="font-weight-bold text-danger" id="panel-failed-actions">${this.stats.failedActions}</div>
                                </div>
                                <div>
                                    <small class="text-muted">Logins</small>
                                    <div class="font-weight-bold text-info" id="panel-login-events">${this.stats.loginEvents}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Insertar después del navbar
        const navbar = document.querySelector('.navbar');
        if (navbar && navbar.parentNode) {
            navbar.insertAdjacentHTML('afterend', controlsHTML);
        }
        
        console.log('🔊 Controles de audio del panel creados');
    }
    
    setupEventListeners() {
        // Toggle de audio
        const audioToggle = document.getElementById('panel-audio-enabled');
        if (audioToggle) {
            audioToggle.addEventListener('change', (e) => {
                this.config.enabled = e.target.checked;
                this.saveConfig();
                this.showNotification(
                    `Audio del panel ${this.config.enabled ? 'activado' : 'desactivado'}`,
                    this.config.enabled ? 'success' : 'warning'
                );
            });
        }
        
        // Control de volumen
        const volumeControl = document.getElementById('panel-audio-volume');
        const volumeDisplay = document.getElementById('panel-volume-display');
        if (volumeControl && volumeDisplay) {
            volumeControl.addEventListener('input', (e) => {
                this.config.volume = e.target.value / 100;
                volumeDisplay.textContent = e.target.value + '%';
                this.saveConfig();
            });
        }
        
        // Selector de sonido para nueva card
        const newCardSoundSelect = document.getElementById('panel-new-card-sound');
        if (newCardSoundSelect) {
            newCardSoundSelect.addEventListener('change', (e) => {
                this.config.sounds.newCard = e.target.value;
                this.saveConfig();
                // Reproducir sonido de prueba
                this.playSound('newCard');
                this.showNotification('Sonido de nueva card actualizado', 'success');
            });
        }
        
        // Selector de sonido para actualización de card
        const updateCardSoundSelect = document.getElementById('panel-update-card-sound');
        if (updateCardSoundSelect) {
            updateCardSoundSelect.addEventListener('change', (e) => {
                this.config.sounds.cardUpdate = e.target.value;
                this.saveConfig();
                // Reproducir sonido de prueba
                this.playSound('cardUpdate');
                this.showNotification('Sonido de actualización actualizado', 'info');
            });
        }
        
        console.log('🔊 Event listeners del panel configurados');
    }
    
    toggleControls() {
        const body = document.getElementById('panel-audio-body');
        if (body) {
            body.style.display = body.style.display === 'none' ? 'block' : 'none';
        }
    }
    

    
    playSound(soundType) {
        if (!this.config.enabled) return;
        
        const soundPath = this.config.sounds[soundType];
        if (!soundPath) {
            console.warn(`Sonido no encontrado: ${soundType}`);
            return;
        }
        
        try {
            const audio = new Audio(soundPath);
            audio.volume = this.config.volume;
            audio.play().catch(error => {
                console.warn(`Error reproduciendo sonido ${soundType}:`, error);
                this.stats.failedActions++;
                this.updateStatsDisplay();
            });
        } catch (error) {
            console.warn(`Error creando audio ${soundType}:`, error);
            this.stats.failedActions++;
            this.updateStatsDisplay();
        }
    }
    
    playCardActionSound(action, userId) {
        this.playSound('cardAction');
        this.stats.totalActions++;
        this.updateStatsDisplay();
        
        if (this.config.notifications.showVisual) {
            this.showNotification(
                `🎯 Acción: ${action} - Usuario: ${userId}`,
                'info'
            );
        }
    }
    
    playCardSuccessSound(action, userId, message) {
        this.playSound('cardSuccess');
        this.stats.successfulActions++;
        this.updateStatsDisplay();
        
        if (this.config.notifications.showVisual) {
            this.showNotification(`✅ ${message}`, 'success');
        }
    }
    
    playCardErrorSound(action, userId, error) {
        this.playSound('cardError');
        this.stats.failedActions++;
        this.updateStatsDisplay();
        
        if (this.config.notifications.showVisual) {
            this.showNotification(`❌ Error en ${action}: ${error}`, 'error');
        }
    }
    
    playLoginSound() {
        this.playSound('userLogin');
        this.stats.loginEvents++;
        this.updateStatsDisplay();
        
        if (this.config.notifications.showVisual) {
            this.showNotification('🔐 Administrador conectado', 'success');
        }
    }
    
    playLogoutSound() {
        this.playSound('userLogout');
        
        if (this.config.notifications.showVisual) {
            this.showNotification('👋 Administrador desconectado', 'info');
        }
    }
    
    playNewCardSound(userId) {
        this.playSound('newCard');
        this.stats.totalActions++;
        this.updateStatsDisplay();
        
        if (this.config.notifications.showVisual) {
            this.showNotification(`🆕 Nueva card: Usuario ${userId} apareció`, 'success');
        }
    }
    
    playCardUpdateSound(userId) {
        this.playSound('cardUpdate');
        this.stats.successfulActions++;
        this.updateStatsDisplay();
    }
    
    updateStatsDisplay() {
        // Actualizar elementos visuales con IDs específicos
        const elements = {
            'panel-total-actions': this.stats.totalActions,
            'panel-successful-actions': this.stats.successfulActions,
            'panel-failed-actions': this.stats.failedActions,
            'panel-login-events': this.stats.loginEvents
        };
        
        // Actualizar los elementos en el DOM
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
        
        this.saveConfig();
    }
    
    showNotification(message, type = 'info') {
        if (!this.config.notifications.showVisual) return;
        
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'success' ? 'success' : type === 'warning' ? 'warning' : type === 'error' ? 'danger' : 'info'} alert-dismissible fade show panel-notification`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            animation: slideInRight 0.3s ease-out;
            border-left: 4px solid ${type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : type === 'error' ? '#dc3545' : '#17a2b8'};
        `;

        
        document.body.appendChild(notification);
        
        // Auto-remove
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, this.config.notifications.duration);
    }
    
    resetStats() {
        this.stats = {
            totalActions: 0,
            successfulActions: 0,
            failedActions: 0,
            loginEvents: 0
        };
        this.updateStatsDisplay();
        this.showNotification('Estadísticas del panel reiniciadas', 'info');
    }
}

// Inicializar el sistema de audio del panel
let panelAudio = null;

function initPanelAudio() {
    if (!panelAudio) {
        panelAudio = new PanelAudioSystem();
        window.panelAudio = panelAudio;
        console.log('🔊 Sistema de audio del panel inicializado');
    }
}

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPanelAudio);
} else {
    initPanelAudio();
}

// Funciones globales para usar en panel.js
window.playPanelActionSound = function(action, userId) {
    if (panelAudio) {
        panelAudio.playCardActionSound(action, userId);
    }
};

window.playPanelSuccessSound = function(action, userId, message) {
    if (panelAudio) {
        panelAudio.playCardSuccessSound(action, userId, message);
    }
};

window.playPanelErrorSound = function(action, userId, error) {
    if (panelAudio) {
        panelAudio.playCardErrorSound(action, userId, error);
    }
};

window.playPanelLoginSound = function() {
    if (panelAudio) {
        panelAudio.playLoginSound();
    }
};

window.playPanelLogoutSound = function() {
    if (panelAudio) {
        panelAudio.playLogoutSound();
    }
};

window.playPanelNewCardSound = function(userId) {
    if (panelAudio) {
        panelAudio.playNewCardSound(userId);
    }
};

window.playPanelCardUpdateSound = function(userId) {
    if (panelAudio) {
        panelAudio.playCardUpdateSound(userId);
    }
};

// Exportar para uso como módulo
export { PanelAudioSystem, panelAudio };
