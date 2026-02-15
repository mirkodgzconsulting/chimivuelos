# Plan de Portal de Clientes - Chimivuelos

## 1. Análisis de Situación Actual

- **Autenticación**: Ya usamos Supabase Auth. Los clientes se crean como usuarios con rol `client`.
- **Datos Relacionales**: `vuelos`, `encomiendas`, y `transfers` están correctamente vinculados via `client_id` al `auth.uid()`.
- **Infraestructura**: Tenemos acciones de servidor (`manage-clients.ts`, etc.) que soportan lógica segura.

## 2. Estrategia de Sesión (Login Inteligente)

Implementaremos una redirección basada en roles en el `middleware.ts` o en la página de login:

- **Admin**: Redirige a `/dashboard` (Actual).
- **Cliente**: Redirige a `/portal` (Nueva ruta).

## 3. Estructura del Portal (Nueva Ruta `(client)`)

Crearemos un grupo de rutas aislado para los clientes, optimizado para móviles:

```
src/app/(client)/
├── layout.tsx        # Diseño simplificado (Mobile-First) con menú inferior.
├── page.tsx          # Dashboard Principal (Resumen de servicios activos).
├── vuelos/           # Lista de Vuelos y descarga de tickets.
├── encomiendas/      # Rastreo de envíos.
├── giros/            # Estado de transferencias.
└── perfil/           # Datos personales básicos.
```

## 4. Funcionalidad "Dinámica"

El Dashboard detectará automáticamente qué servicios tiene activos el cliente:

- Si tiene **Vuelos Pendientes** -> Muestra tarjeta de "Próximo Vuelo".
- Si tiene **Encomiendas en Tránsito** -> Muestra estado "En Camino".
- Si no tiene servicios activos -> Muestra botones para contactar/cotizar.

## 5. Seguridad de Datos

Crearemos un nuevo archivo de acciones `src/app/actions/client-portal.ts` que:

- Solo permita consultas donde `client_id == auth.uid()`.
- Garantice que un cliente NUNCA vea datos de otro.

## 6. Próximos Pasos Técnicos

1.  **Crear Layout Cliente**: Diseño limpio, sin sidebar complejo, enfocado en tarjetas.
2.  **Configurar Middleware**: Asegurar que `/portal` sea solo para rol `client`.
3.  **Desarrollar Dashboard**: Conectar con datos reales de `manage-flights`, etc.
