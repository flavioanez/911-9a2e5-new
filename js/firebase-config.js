// Configuración centralizada de Firebase
// Esta es la configuración personalizada del proyecto
const firebaseConfig = {
  apiKey: "AIzaSyDuONQSZ8ynQPc7mgn1v0U8a874SCLGeeI",
  authDomain: "bicentenario-a159d.firebaseapp.com",
  projectId: "bicentenario-a159d",
  storageBucket: "bicentenario-a159d.firebasestorage.app",
  messagingSenderId: "1021718244498",
  appId: "1:1021718244498:web:345c4c6e2c99be51504a4b"
};

// Exportar configuraciones para uso en diferentes archivos
// Este método de exportación funciona con módulos ES
export { firebaseConfig };
// También hacerlas disponibles globalmente (para compatibilidad con código existente)
// Este método permite acceder a las configuraciones sin importar el archivo
try {
window.firebaseConfig = firebaseConfig;
} catch (e) {
console.error(
  "No se pudo asignar a window. Posiblemente ejecutando en entorno no navegador."
);
}
