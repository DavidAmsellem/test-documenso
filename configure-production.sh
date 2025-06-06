#!/bin/bash
# Script de configuración inicial para Documenso en producción

echo "🚀 Configuración Inicial de Documenso para Producción"
echo "====================================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para generar secrets seguros
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Función para solicitar input con valor por defecto
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local result
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " result
        echo "${result:-$default}"
    else
        read -p "$prompt: " result
        echo "$result"
    fi
}

echo -e "${BLUE}Este script te ayudará a configurar Documenso para producción.${NC}"
echo -e "${YELLOW}Asegúrate de tener la siguiente información lista:${NC}"
echo "• Dominio donde se desplegará (ej: docs.tu-empresa.com)"
echo "• Configuración SMTP para envío de emails"
echo "• Credenciales de AWS S3 o almacenamiento compatible"
echo "• Credenciales de Twilio para SMS (para autenticación SMS)"
echo ""

read -p "¿Continuar con la configuración? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Configuración cancelada."
    exit 1
fi

echo ""
echo -e "${GREEN}=== CONFIGURACIÓN BÁSICA ===${NC}"

# Configuración básica
DOMAIN=$(prompt_with_default "Dominio principal (sin https://)" "localhost")
EMAIL=$(prompt_with_default "Email del administrador" "admin@$DOMAIN")

echo ""
echo -e "${GREEN}=== CONFIGURACIÓN DE BASE DE DATOS ===${NC}"

DB_PASSWORD=$(prompt_with_default "Contraseña de PostgreSQL" "$(generate_secret)")

echo ""
echo -e "${GREEN}=== CONFIGURACIÓN DE APLICACIÓN ===${NC}"

NEXTAUTH_SECRET=$(generate_secret)
ENCRYPTION_KEY=$(generate_secret)
ENCRYPTION_SECONDARY_KEY=$(generate_secret)

echo "✅ Secrets de aplicación generados automáticamente"

echo ""
echo -e "${GREEN}=== CONFIGURACIÓN SMTP ===${NC}"

SMTP_HOST=$(prompt_with_default "Servidor SMTP" "smtp.gmail.com")
SMTP_PORT=$(prompt_with_default "Puerto SMTP" "587")
SMTP_USER=$(prompt_with_default "Usuario SMTP" "")
SMTP_PASS=$(prompt_with_default "Contraseña SMTP" "")
SMTP_FROM=$(prompt_with_default "Email remitente" "noreply@$DOMAIN")
SMTP_FROM_NAME=$(prompt_with_default "Nombre remitente" "Documenso")

echo ""
echo -e "${GREEN}=== CONFIGURACIÓN S3 ===${NC}"

USE_S3=$(prompt_with_default "¿Usar S3 para almacenamiento? (y/n)" "y")

if [[ $USE_S3 =~ ^[Yy]$ ]]; then
    S3_BUCKET=$(prompt_with_default "Nombre del bucket S3" "documenso-$DOMAIN")
    S3_REGION=$(prompt_with_default "Región de S3" "us-east-1")
    S3_ACCESS_KEY=$(prompt_with_default "Access Key ID" "")
    S3_SECRET_KEY=$(prompt_with_default "Secret Access Key" "")
    S3_ENDPOINT=$(prompt_with_default "Endpoint S3 (opcional)" "")
    
    UPLOAD_TRANSPORT="s3"
else
    UPLOAD_TRANSPORT="local"
    S3_BUCKET=""
    S3_REGION=""
    S3_ACCESS_KEY=""
    S3_SECRET_KEY=""
    S3_ENDPOINT=""
fi

echo ""
echo -e "${GREEN}=== CONFIGURACIÓN SMS (Twilio) ===${NC}"

USE_SMS=$(prompt_with_default "¿Configurar autenticación SMS con Twilio? (y/n)" "y")

if [[ $USE_SMS =~ ^[Yy]$ ]]; then
    TWILIO_SID=$(prompt_with_default "Twilio Account SID" "")
    TWILIO_TOKEN=$(prompt_with_default "Twilio Auth Token" "")
    TWILIO_PHONE=$(prompt_with_default "Número de teléfono Twilio" "+1234567890")
    SMS_PROVIDER="twilio"
else
    TWILIO_SID=""
    TWILIO_TOKEN=""
    TWILIO_PHONE=""
    SMS_PROVIDER=""
fi

echo ""
echo -e "${GREEN}=== CONFIGURACIÓN OAUTH (Opcional) ===${NC}"

USE_GOOGLE=$(prompt_with_default "¿Configurar Google OAuth? (y/n)" "n")

if [[ $USE_GOOGLE =~ ^[Yy]$ ]]; then
    GOOGLE_CLIENT_ID=$(prompt_with_default "Google Client ID" "")
    GOOGLE_CLIENT_SECRET=$(prompt_with_default "Google Client Secret" "")
else
    GOOGLE_CLIENT_ID=""
    GOOGLE_CLIENT_SECRET=""
fi

echo ""
echo -e "${YELLOW}Generando archivos de configuración...${NC}"

# Crear archivo .env para producción
cat > .env << EOF
# Configuración generada automáticamente el $(date)
# Database
POSTGRES_USER=documenso
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=documenso

# Application
PORT=3000
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXT_PRIVATE_ENCRYPTION_KEY=$ENCRYPTION_KEY
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=$ENCRYPTION_SECONDARY_KEY
NEXT_PUBLIC_WEBAPP_URL=https://$DOMAIN
NEXT_PRIVATE_INTERNAL_WEBAPP_URL=http://documenso:3000

# Email Configuration
NEXT_PRIVATE_SMTP_FROM_ADDRESS=$SMTP_FROM
NEXT_PRIVATE_SMTP_FROM_NAME=$SMTP_FROM_NAME
NEXT_PRIVATE_SMTP_HOST=$SMTP_HOST
NEXT_PRIVATE_SMTP_PORT=$SMTP_PORT
NEXT_PRIVATE_SMTP_USERNAME=$SMTP_USER
NEXT_PRIVATE_SMTP_PASSWORD=$SMTP_PASS

# File Storage
NEXT_PRIVATE_UPLOAD_TRANSPORT=$UPLOAD_TRANSPORT
NEXT_PRIVATE_UPLOAD_BUCKET=$S3_BUCKET
NEXT_PRIVATE_UPLOAD_REGION=$S3_REGION
NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID=$S3_ACCESS_KEY
NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY=$S3_SECRET_KEY
NEXT_PRIVATE_UPLOAD_ENDPOINT=$S3_ENDPOINT

# SMS Authentication
NEXT_PRIVATE_SMS_PROVIDER=$SMS_PROVIDER
TWILIO_ACCOUNT_SID=$TWILIO_SID
TWILIO_AUTH_TOKEN=$TWILIO_TOKEN
TWILIO_PHONE_NUMBER=$TWILIO_PHONE

# OAuth Providers
NEXT_PRIVATE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
NEXT_PRIVATE_GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET

# Signing Certificate
NEXT_PRIVATE_SIGNING_TRANSPORT=local
NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH=/app/cert/certificate.p12

# Production Settings
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
LOG_LEVEL=info
EOF

echo -e "${GREEN}✅ Archivo .env creado${NC}"

# Actualizar configuración de Nginx con el dominio correcto
if [ "$DOMAIN" != "localhost" ]; then
    sed -i "s/tu-dominio.com/$DOMAIN/g" docker/production/nginx.conf
    echo -e "${GREEN}✅ Configuración de Nginx actualizada${NC}"
fi

# Crear directorio para certificados
mkdir -p docker/production/ssl
mkdir -p docker/production/cert

echo ""
echo -e "${BLUE}=== RESUMEN DE CONFIGURACIÓN ===${NC}"
echo "Dominio: $DOMAIN"
echo "Email Admin: $EMAIL"
echo "SMTP: $SMTP_HOST:$SMTP_PORT"
echo "Almacenamiento: $UPLOAD_TRANSPORT"
if [ "$UPLOAD_TRANSPORT" = "s3" ]; then
    echo "S3 Bucket: $S3_BUCKET"
fi
if [ -n "$SMS_PROVIDER" ]; then
    echo "SMS: $SMS_PROVIDER ($TWILIO_PHONE)"
fi

echo ""
echo -e "${YELLOW}=== PRÓXIMOS PASOS ===${NC}"
echo "1. Si tu dominio NO es localhost:"
echo -e "   ${BLUE}./docker/production/setup-ssl.sh $DOMAIN $EMAIL${NC}"
echo ""
echo "2. Para deployment completo con Nginx y SSL:"
echo -e "   ${BLUE}cd docker/production && docker-compose -f compose-full.yml up -d${NC}"
echo ""
echo "3. Para deployment simple (solo app + DB):"
echo -e "   ${BLUE}cd docker/production && docker-compose up -d${NC}"
echo ""
echo "4. Para monitorear el sistema:"
echo -e "   ${BLUE}./docker/production/monitor.sh${NC}"
echo ""
echo -e "${GREEN}¡Configuración completada!${NC}"

# Guardar configuración para referencia
cat > deployment-info.txt << EOF
=== INFORMACIÓN DE DEPLOYMENT ===
Fecha: $(date)
Dominio: $DOMAIN
Email Admin: $EMAIL

=== CREDENCIALES IMPORTANTES ===
Base de Datos: documenso / $DB_PASSWORD
NextAuth Secret: $NEXTAUTH_SECRET

=== COMANDOS ÚTILES ===
Logs: docker-compose -f docker/production/compose-full.yml logs -f
Reiniciar: docker-compose -f docker/production/compose-full.yml restart
Backup BD: docker-compose -f docker/production/compose-full.yml exec database pg_dump -U documenso documenso > backup-\$(date +%Y%m%d).sql
Monitor: ./docker/production/monitor.sh

=== URLS ===
Aplicación: https://$DOMAIN
Health Check: https://$DOMAIN/health
EOF

echo -e "${GREEN}💾 Información guardada en deployment-info.txt${NC}"
