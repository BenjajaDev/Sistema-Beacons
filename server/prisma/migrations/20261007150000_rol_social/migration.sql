-- Rol de comunicación: responde los mensajes de contacto y edita los datos de
-- contacto y las redes. No crea tablas nuevas, así que no cambia el RLS.
ALTER TYPE "Role" ADD VALUE 'SOCIAL';
