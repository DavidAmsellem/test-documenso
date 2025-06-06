#!/bin/bash
# Script para configurar SSL con Let's Encrypt

DOMAIN=${1:-tu-dominio.com}
EMAIL=${2:-admin@tu-dominio.com}

echo "🔒 Configurando SSL para $DOMAIN..."

# Crear directorio para certificados
mkdir -p ./ssl
mkdir -p ./certbot

# Crear configuración temporal de Nginx sin SSL
cat > nginx-temp.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name tu-dominio.com www.tu-dominio.com;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            proxy_pass http://documenso:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF

# Reemplazar el dominio en la configuración temporal
sed -i "s/tu-dominio.com/$DOMAIN/g" nginx-temp.conf

# Iniciar Nginx temporal
echo "🌐 Iniciando Nginx temporal para validación..."
docker run -d --name nginx-temp \
    -p 80:80 \
    -v $(pwd)/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
    -v $(pwd)/certbot:/var/www/certbot \
    nginx:alpine

# Esperar a que Nginx esté listo
sleep 5

# Obtener certificado con Certbot
echo "📜 Obteniendo certificado SSL..."
docker run --rm \
    -v $(pwd)/certbot:/var/www/certbot \
    -v $(pwd)/ssl:/etc/letsencrypt \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

# Verificar si se obtuvo el certificado
if [ -f "./ssl/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ Certificado SSL obtenido exitosamente!"
    
    # Copiar certificados al directorio correcto
    cp ./ssl/live/$DOMAIN/fullchain.pem ./ssl/fullchain.pem
    cp ./ssl/live/$DOMAIN/privkey.pem ./ssl/privkey.pem
    
    # Actualizar la configuración de Nginx con el dominio correcto
    sed -i "s/tu-dominio.com/$DOMAIN/g" nginx.conf
    
    echo "🔧 Configuración de Nginx actualizada."
else
    echo "❌ Error: No se pudo obtener el certificado SSL."
    echo "Verifica que:"
    echo "1. El dominio $DOMAIN apunte a esta IP"
    echo "2. Los puertos 80 y 443 estén abiertos"
    echo "3. No haya otro servicio usando el puerto 80"
fi

# Limpiar Nginx temporal
echo "🧹 Limpiando configuración temporal..."
docker stop nginx-temp
docker rm nginx-temp
rm nginx-temp.conf

echo "🔒 Configuración SSL completada."
echo "📋 Próximos pasos:"
echo "   1. Ejecutar: docker-compose -f compose-full.yml up -d"
echo "   2. Configurar renovación automática del certificado"
