# Contexto del Sistema (Multi-Nodo / Multi-Vertical)
Estamos realizando un refactor crítico en nuestra aplicación para unificar el sistema de autenticación y control de accesos entre nuestros diferentes nodos (Inmo, Finanzas, Clínica, E-commerce). Actualmente, el flujo de registro e invitaciones permite cambiar contraseñas de forma aislada y genera conflictos cuando un usuario pertenece a múltiples nodos, rompiendo los accesos cruzados.

## Objetivo del Refactor
Migrar hacia un modelo de **Usuario Global Único** con credenciales centralizadas (un único correo y contraseña para todo el ecosistema), desacoplando la autenticación de las membresías y roles específicos por cada nodo.

---

## Estructura de Nodos y Roles Actuales

### 1. Nodo Inmo
- **Super Admin:** Comprador de la suscripción del nodo.
- **Administrador:** Invitado por el Super Admin con permisos totales de gestión.
- **Empleado:** Permisos granulares asignados por el Super Admin o Administrador.
- **Propietario:** Usuario que puede ver ciertas cuestiones relacionadas a las propiedades que estan en la inmobiliaria.
- **Inquilino:** Usuario que puede ver los meses pagos y estados de pagos del alquiler y a su vez podra ver el contrato y efectuar reclamos por problemas en la propiedad.


### 2. Nodo Finanzas
- **Super Admin:** Comprador de la suscripción.
- **Administrador:** Invitado por el Super Admin con rol administrativo.

### 3. Nodo Clínica
- **Super Admin:** Comprador del nodo, dividido en dos perfiles de acceso:
  - **Rol Médico:** Suscripción PRO (acceso total indefinido mientras pague) o Trial/Demo (7 días de acceso total).
  - **Rol Paciente:** Suscripción Gratuita (sin límite de tiempo, funciones limitadas) o Suscripción PRO (historial de consultas, estudios médicos, recetas, etc.).

### 4. Nodo E-commerce
- **Super Admin:** Comprador del nodo (hereda estructura de roles similar a Nodo Inmo para futuras expansiones).

---

## Requerimientos Técnicos para el Refactor

1. **Unificación de Credenciales (Auth):**
   - La tabla/entidad de usuarios debe ser global. Un usuario existe una sola vez por correo electrónico en todo el sistema.
   - El flujo de login valida contra esta tabla global. La contraseña se gestiona en un solo lugar (perfil global del usuario), eliminando la posibilidad de cambiar contraseñas independientes por cada nodo al que sea invitado.

2. **Desacoplamiento de Permisos (Membresías por Nodo):**
   - Implementar o refactorizar la relación de usuarios a nodos mediante una tabla intermedia (ej. `node_memberships`) que almacene: `user_id`, `node_id`, `role` (super_admin, admin, empleado, colega, medico, paciente) y metadatos de suscripción si aplican (ej. estado de trial, tipo pro/free).

3. **Selector de Nodos (Header Superior Derecho):**
   - Asegurar que al cambiar de nodo desde la UI, la sesión del usuario global se mantenga intacta, conmutando únicamente el contexto y validando los permisos correspondientes al nuevo `node_id`.

4. **Corrección de Flujos de Invitación y Registro:**
   - Cuando se invita a un usuario existente (por email) a un nuevo nodo, **no** se debe crear un usuario nuevo ni pisar sus credenciales; simplemente se le debe asociar un nuevo tenant (nodo al que se lo invito) con un rol especifico (definido por el super admin o administrador del nodo que invita).
   - Si el usuario no existe en el sistema, se crea el registro global y se le asigna la invitación inicial donde se realiza el proceso de asignacion de contraseña y confirmacion.
   -REGISTRO: Si el usuario compra un nodo por primera vez o sea no existe ese mail dentro de la base de datos de usuarios (en todos los nodos) debo realizar el proceso de registro con creacion de contraseña. 
   Ahora caso contrario el usuario compra otro nodo se deben respetar las credenciales de este usuario correspondienta al primer nodo que este compro. 
5. **Diseño y Estructura de Plantillas de Correo (Emails):**
   El sistema debe generar dinámicamente el body del correo según el estado del usuario:

   - **Plantilla 1: Primera vez en la plataforma (Usuario Nuevo)**
     - **Asunto:** ¡Bienvenido! Activa tu cuenta y define tu contraseña.
     - **Contenido del Body:** Mensaje de bienvenida institucional indicando que se ha creado su acceso inicial al nodo.
     - **Acción / Botón Principal:** Un botón de llamada a la acción (*Call to Action*) que lo redirija al flujo seguro de la aplicación para configurar su contraseña por primera vez y verificar su correo.

   - **Plantilla 2: Usuario Existente (Compra de nuevo nodo / Nueva invitación)**
     - **Recomendación UX/UI:** Desde el punto de vista de la experiencia de usuario y seguridad, **la mejor práctica es llevar al usuario directamente al Login general**, integrando allí mismo la opción de recuperación de contraseña. Esto evita generar confusión con múltiples enlaces de tokens complejos o reconfiguraciones de claves innecesarias.
     - **Asunto:** ¡Te sumaste a un nuevo nodo en nuestra plataforma!
     - **Contenido del Body:** Explicar claramente que su cuenta ya existe, que se le ha vinculado de forma exitosa el nuevo nodo a su perfil global y recordarle que debe utilizar la contraseña que ya venía usando en sus nodos anteriores.
     - **Acción / Botones (Doble CTA):**
       1. **Botón Principal ("Ingresar al nuevo nodo"):** Redirige directo a la pantalla de Login general (o al selector de nodos si ya mantiene sesión activa).
       2. **Botón Secundario / Enlace ("¿No recuerdas tu contraseña?"):** Lo dirige directamente a la vista de recuperación de contraseña (`/forgot-password`) dentro del mismo flujo de autenticación, permitiéndole blanquearla de forma rápida si la olvidó.
 Para este punto 5 quiero que tengas en cuenta que todo lo que es a nivel ui en cuanto a branding y logo que se adjunta y demas todo tenga el mismo criterio que usamos en nodo clinica.
 
 7. **Gestión de Creación de Usuarios desde el Dashboard (Administración Central):**
   - **Funcionalidad:** Permitir al administrador/operador dar de alta un nuevo usuario y asignarlo directamente a cualquier nodo desde el dashboard de gestión.
   - **Validación de Duplicidad:** El backend debe validar en el momento si el correo electrónico ingresado ya existe en la base de datos global:
     - *Si ya existe:* El dashboard debe aplicar las mismas reglas de negocio del Caso B (no sobrescribir credenciales, asociar silenciosamente la nueva membresía, registrar la fecha de alta actual y disparar el correo informativo correspondiente para usuarios existentes).
     - *Si no existe:* Se crea el usuario global y se dispara el flujo del Caso A (configuración inicial de contraseña).
   - **Parámetros Obligatorios en el Formulario del Dashboard:**
     - Nodo de destino (`node_id`).
     - Rol asignado dentro del nodo (`role`).
     - Tipo de membresía / suscripción (según aplique al nodo seleccionado).
     - Fecha de alta de la suscripción (registrada automáticamente con la fecha y hora del sistema al momento de ejecutar la creación).

Por favor, analiza nuestra base de código actual, identifica los puntos críticos donde se rompen los accesos y propón un plan de refactorización paso a paso para implementar esta arquitectura de usuario global y membresías por nodo.