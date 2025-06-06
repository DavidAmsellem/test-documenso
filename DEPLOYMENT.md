# 🚀 Deployment de Documenso en Producción

Esta guía te ayudará a desplegar Documenso con autenticación SMS en un servidor de producción.

## 📋 Prerequisitos

- Docker y Docker Compose instalados
- Dominio configurado (DNS apuntando al servidor)
- Puertos 80 y 443 abiertos en el firewall
- Al menos 2GB de RAM y 10GB de espacio libre

## 🛠️ Configuración Rápida

### 1. Configuración Inicial Automatizada

```bash
./configure-production.sh
```

Este script te guiará a través de la configuración de:

- ✅ Dominio y certificados SSL
- ✅ Base de datos PostgreSQL
- ✅ Configuración SMTP para emails
- ✅ AWS S3 para almacenamiento de archivos
- ✅ Twilio para autenticación SMS
- ✅ OAuth con Google (opcional)

### 2. Deployment Completo (Recomendado)

Para un deployment completo con Nginx, SSL y todos los servicios:

```bash
cd docker/production
docker-compose -f compose-full.yml up -d
```

### 3. Deployment Simple

Para un deployment básico solo con la aplicación:

```bash
cd docker/production
docker-compose up -d
```

## 🔒 Configuración SSL

### Automática con Let's Encrypt

```bash
./docker/production/setup-ssl.sh tu-dominio.com admin@tu-dominio.com
```

### Manual

1. Coloca tus certificados en `docker/production/ssl/`:
   - `fullchain.pem` - Certificado completo
   - `privkey.pem` - Clave privada

## 📊 Monitoreo

### Script de Monitoreo

```bash
./docker/production/monitor.sh
```

Muestra:

- Estado de todos los servicios
- Uso de recursos
- Estado de certificados SSL
- Conectividad HTTP/HTTPS
- Logs recientes

### Comandos Útiles

```bash
# Ver logs en tiempo real
docker-compose -f docker/production/compose-full.yml logs -f

# Ver logs de un servicio específico
docker-compose -f docker/production/compose-full.yml logs -f documenso

# Reiniciar servicios
docker-compose -f docker/production/compose-full.yml restart

# Ver estado de servicios
docker-compose -f docker/production/compose-full.yml ps

# Backup de base de datos
docker-compose -f docker/production/compose-full.yml exec database pg_dump -U documenso documenso > backup-$(date +%Y%m%d).sql
```

## 🗃️ Estructura de Archivos

```
docker/production/
├── compose.yml              # Deployment básico
├── compose-full.yml         # Deployment completo con Nginx
├── nginx.conf              # Configuración de Nginx
├── setup-ssl.sh           # Script para configurar SSL
├── monitor.sh             # Script de monitoreo
└── ssl/                   # Certificados SSL
    ├── fullchain.pem
    └── privkey.pem
```

## ⚙️ Variables de Entorno Importantes

### Base de Datos

- `POSTGRES_USER` - Usuario de PostgreSQL
- `POSTGRES_PASSWORD` - Contraseña de PostgreSQL
- `POSTGRES_DB` - Nombre de la base de datos

### Aplicación

- `NEXTAUTH_SECRET` - Secret para NextAuth (32+ caracteres)
- `NEXT_PUBLIC_WEBAPP_URL` - URL pública de la aplicación
- `NEXT_PRIVATE_ENCRYPTION_KEY` - Clave de encriptación

### Email (SMTP)

- `NEXT_PRIVATE_SMTP_HOST` - Servidor SMTP
- `NEXT_PRIVATE_SMTP_PORT` - Puerto SMTP
- `NEXT_PRIVATE_SMTP_USERNAME` - Usuario SMTP
- `NEXT_PRIVATE_SMTP_PASSWORD` - Contraseña SMTP

### SMS (Twilio)

- `TWILIO_ACCOUNT_SID` - SID de cuenta de Twilio
- `TWILIO_AUTH_TOKEN` - Token de autenticación de Twilio
- `TWILIO_PHONE_NUMBER` - Número de teléfono de Twilio

### Almacenamiento (S3)

- `NEXT_PRIVATE_UPLOAD_BUCKET` - Nombre del bucket
- `NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID` - Access Key
- `NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY` - Secret Key

## 🚨 Troubleshooting

### La aplicación no inicia

1. Verificar logs:

   ```bash
   docker-compose -f docker/production/compose-full.yml logs documenso
   ```

2. Verificar variables de entorno:

   ```bash
   cat .env
   ```

3. Verificar conectividad de base de datos:
   ```bash
   docker-compose -f docker/production/compose-full.yml exec database pg_isready -U documenso
   ```

### Problemas con SSL

1. Verificar que el dominio apunte al servidor:

   ```bash
   nslookup tu-dominio.com
   ```

2. Verificar puertos abiertos:

   ```bash
   netstat -tlnp | grep -E ':80|:443'
   ```

3. Regenerar certificados:
   ```bash
   ./docker/production/setup-ssl.sh tu-dominio.com admin@tu-dominio.com
   ```

### Problemas con SMS

1. Verificar credenciales de Twilio en `.env`
2. Verificar logs de la aplicación para errores de SMS
3. Probar credenciales directamente en el dashboard de Twilio

### Base de datos lenta

1. Verificar uso de recursos:

   ```bash
   docker stats
   ```

2. Optimizar configuración de PostgreSQL si es necesario

## 🔧 Mantenimiento

### Backups Automáticos

Crear un cron job para backups diarios:

```bash
# Editar crontab
crontab -e

# Agregar línea para backup diario a las 2:00 AM
0 2 * * * cd /ruta/a/documenso && docker-compose -f docker/production/compose-full.yml exec -T database pg_dump -U documenso documenso > backups/backup-$(date +\%Y\%m\%d).sql
```

### Actualizaciones

1. Hacer backup de la base de datos
2. Detener servicios: `docker-compose -f docker/production/compose-full.yml down`
3. Actualizar código: `git pull`
4. Reconstruir imagen: `docker-compose -f docker/production/compose-full.yml build`
5. Iniciar servicios: `docker-compose -f docker/production/compose-full.yml up -d`

### Renovación de Certificados SSL

Los certificados de Let's Encrypt se renuevan automáticamente. Para renovación manual:

```bash
docker run --rm -v $(pwd)/ssl:/etc/letsencrypt -v $(pwd)/certbot:/var/www/certbot certbot/certbot renew
```

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs con `./docker/production/monitor.sh`
2. Consulta la documentación oficial de Documenso
3. Verifica que todas las variables de entorno estén configuradas correctamente

## 🎉 ¡Listo!

Una vez desplegado, tu instancia de Documenso estará disponible en:

- **Aplicación**: https://tu-dominio.com
- **Health Check**: https://tu-dominio.com/health

¡La autenticación SMS estará completamente funcional y lista para usar!
