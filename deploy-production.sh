#!/bin/bash
# Script de deployment para producción de Documenso

echo "🚀 Iniciando deployment de Documenso a producción..."

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json. Asegúrate de estar en el directorio raíz del proyecto."
    exit 1
fi

# Verificar que Docker esté ejecutándose
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está ejecutándose. Por favor, inicia Docker."
    exit 1
fi

# Crear directorio de producción si no existe
mkdir -p production-deployment

# Verificar si existe .env.production
if [ ! -f ".env.production" ]; then
    echo "❌ Error: No se encontró .env.production. Por favor, configura las variables de entorno."
    exit 1
fi

echo "✅ Verificaciones iniciales completadas."

# Hacer backup de la base de datos si ya existe
echo "📦 Realizando backup de la base de datos (si existe)..."
docker-compose -f docker/production/compose.yml exec database pg_dump -U documenso documenso > backup-$(date +%Y%m%d-%H%M%S).sql 2>/dev/null || echo "ℹ️  No hay base de datos existente para respaldar."

# Detener servicios existentes
echo "🛑 Deteniendo servicios existentes..."
docker-compose -f docker/production/compose.yml down

# Limpiar imágenes antigas (opcional)
echo "🧹 Limpiando imágenes Docker antigas..."
docker image prune -f

# Construir la nueva imagen
echo "🏗️  Construyendo nueva imagen de Documenso..."
docker build -t documenso/documenso:latest -f apps/remix/Dockerfile .

# Verificar que la imagen se construyó correctamente
if [ $? -ne 0 ]; then
    echo "❌ Error: Falló la construcción de la imagen Docker."
    exit 1
fi

echo "✅ Imagen construida exitosamente."

# Copiar variables de entorno para Docker Compose
echo "⚙️  Configurando variables de entorno..."
cp .env.production .env

# Iniciar servicios de producción
echo "🚀 Iniciando servicios de producción..."
docker-compose -f docker/production/compose.yml up -d

# Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios estén listos..."
sleep 30

# Verificar que los servicios están ejecutándose
echo "🔍 Verificando estado de los servicios..."
docker-compose -f docker/production/compose.yml ps

# Ejecutar migraciones de base de datos
echo "🗄️  Ejecutando migraciones de base de datos..."
docker-compose -f docker/production/compose.yml exec documenso npm run db:migrate:deploy

# Verificar que la aplicación está respondiendo
echo "🌐 Verificando que la aplicación está respondiendo..."
sleep 10
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ ¡Aplicación desplegada exitosamente!"
    echo "🌐 La aplicación está disponible en: http://localhost:3000"
    echo "📋 Para ver los logs: docker-compose -f docker/production/compose.yml logs -f"
else
    echo "⚠️  La aplicación puede no estar respondiendo aún. Verifica los logs:"
    echo "   docker-compose -f docker/production/compose.yml logs"
fi

echo ""
echo "📋 Comandos útiles para administración:"
echo "   Ver logs:           docker-compose -f docker/production/compose.yml logs -f"
echo "   Reiniciar:          docker-compose -f docker/production/compose.yml restart"
echo "   Detener:            docker-compose -f docker/production/compose.yml down"
echo "   Backup DB:          docker-compose -f docker/production/compose.yml exec database pg_dump -U documenso documenso > backup.sql"
echo ""
echo "🔧 Próximos pasos recomendados:"
echo "   1. Configurar certificado SSL/TLS"
echo "   2. Configurar reverse proxy (Nginx/Traefik)"
echo "   3. Configurar monitoreo y logs"
echo "   4. Configurar backups automáticos"
