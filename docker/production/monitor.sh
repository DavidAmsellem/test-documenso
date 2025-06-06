#!/bin/bash
# Script de monitoreo para Documenso en producción

echo "📊 Estado del Sistema Documenso"
echo "================================"

# Función para verificar estado de servicio
check_service() {
    local service=$1
    local status=$(docker-compose -f docker/production/compose-full.yml ps -q $service 2>/dev/null)
    
    if [ -n "$status" ]; then
        local health=$(docker inspect --format='{{.State.Health.Status}}' $status 2>/dev/null)
        if [ "$health" = "healthy" ]; then
            echo "✅ $service: Saludable"
        elif [ "$health" = "unhealthy" ]; then
            echo "❌ $service: No saludable"
        else
            echo "🟡 $service: En ejecución (sin healthcheck)"
        fi
    else
        echo "❌ $service: No ejecutándose"
    fi
}

# Verificar servicios
echo "🔍 Estado de los servicios:"
check_service "nginx"
check_service "documenso"
check_service "database"
check_service "redis"

echo ""

# Verificar conectividad HTTP/HTTPS
echo "🌐 Verificación de conectividad:"
if curl -f -s http://localhost:80/health > /dev/null; then
    echo "✅ HTTP (puerto 80): Accesible"
else
    echo "❌ HTTP (puerto 80): No accesible"
fi

if curl -f -s -k https://localhost:443/health > /dev/null; then
    echo "✅ HTTPS (puerto 443): Accesible"
else
    echo "❌ HTTPS (puerto 443): No accesible"
fi

echo ""

# Verificar uso de recursos
echo "💻 Uso de recursos:"
echo "CPU:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep documenso

echo ""

# Verificar espacio en disco
echo "💾 Espacio en disco:"
df -h | grep -E "(Filesystem|/dev/)"

echo ""

# Verificar logs recientes
echo "📋 Logs recientes (últimas 10 líneas):"
echo "--- Aplicación ---"
docker-compose -f docker/production/compose-full.yml logs --tail=10 documenso 2>/dev/null || echo "No se pueden obtener logs de la aplicación"

echo ""
echo "--- Nginx ---"
docker-compose -f docker/production/compose-full.yml logs --tail=10 nginx 2>/dev/null || echo "No se pueden obtener logs de Nginx"

echo ""

# Verificar certificados SSL
echo "🔒 Estado de certificados SSL:"
if [ -f "./ssl/fullchain.pem" ]; then
    EXPIRY=$(openssl x509 -in ./ssl/fullchain.pem -text -noout | grep "Not After" | cut -d: -f2-)
    echo "✅ Certificado SSL presente"
    echo "   Expira: $EXPIRY"
else
    echo "❌ No se encontró certificado SSL"
fi

echo ""

# Verificar base de datos
echo "🗄️  Estado de la base de datos:"
DB_STATUS=$(docker-compose -f docker/production/compose-full.yml exec -T database pg_isready -U documenso 2>/dev/null)
if echo "$DB_STATUS" | grep -q "accepting connections"; then
    echo "✅ Base de datos: Conectiva y operativa"
    
    # Contar documentos (ejemplo)
    DOC_COUNT=$(docker-compose -f docker/production/compose-full.yml exec -T database psql -U documenso -t -c "SELECT COUNT(*) FROM documents;" 2>/dev/null | tr -d ' ')
    if [[ "$DOC_COUNT" =~ ^[0-9]+$ ]]; then
        echo "   Documentos en BD: $DOC_COUNT"
    fi
else
    echo "❌ Base de datos: No disponible"
fi

echo ""
echo "⚙️  Comandos útiles:"
echo "   Ver logs en vivo:    docker-compose -f docker/production/compose-full.yml logs -f"
echo "   Reiniciar servicios: docker-compose -f docker/production/compose-full.yml restart"
echo "   Backup de BD:        docker-compose -f docker/production/compose-full.yml exec database pg_dump -U documenso documenso > backup-\$(date +%Y%m%d).sql"
echo "   Verificar SSL:       curl -I https://tu-dominio.com"
