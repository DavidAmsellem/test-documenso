#!/bin/bash

# Script para gestionar los servicios de desarrollo público
# Evita conflictos de puertos entre desarrollo local y público

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Iniciando servicios de desarrollo público...${NC}"

# Función para verificar si un puerto está en uso
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Puerto en uso
    else
        return 1  # Puerto libre
    fi
}

# Verificar conflictos de puertos comunes
echo -e "${YELLOW}🔍 Verificando conflictos de puertos...${NC}"

conflicts=false

# Puertos que vamos a usar para desarrollo público
public_ports=(3000 9100 9101 9102 2501 1101 3031 54322 54323)
port_names=("App" "Inbucket Web" "MinIO Console" "MinIO API" "SMTP" "POP3" "Trigger.dev" "PostgreSQL" "Trigger DB")

for i in "${!public_ports[@]}"; do
    port=${public_ports[$i]}
    name=${port_names[$i]}
    
    if check_port $port; then
        echo -e "${RED}❌ Puerto $port ($name) está en uso${NC}"
        conflicts=true
    else
        echo -e "${GREEN}✅ Puerto $port ($name) disponible${NC}"
    fi
done

if [ "$conflicts" = true ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Hay conflictos de puertos. Opciones:${NC}"
    echo "1. Detener desarrollo local: npm run dx:down"
    echo "2. Usar puertos diferentes automáticamente"
    echo "3. Continuar y manejar conflictos manualmente"
    echo ""
    read -p "¿Cómo quieres proceder? (1/2/3): " choice
    
    case $choice in
        1)
            echo -e "${YELLOW}📦 Deteniendo servicios de desarrollo local...${NC}"
            npm run dx:down || true
            ;;
        2)
            echo -e "${BLUE}🔧 Usando puertos alternativos automáticamente...${NC}"
            # Los puertos ya están configurados en el compose.yml
            ;;
        3)
            echo -e "${YELLOW}⚡ Continuando con conflictos...${NC}"
            ;;
        *)
            echo -e "${RED}❌ Opción inválida. Saliendo...${NC}"
            exit 1
            ;;
    esac
fi

echo ""
echo -e "${GREEN}🔧 Iniciando servicios Docker para desarrollo público...${NC}"

# Detener servicios públicos anteriores si existen
docker compose -f docker/public/compose.yml down 2>/dev/null || true

# Iniciar servicios públicos
docker compose -f docker/public/compose.yml up -d

echo ""
echo -e "${GREEN}✅ Servicios iniciados correctamente${NC}"
echo ""
echo -e "${BLUE}📋 URLs de acceso público:${NC}"
echo "• App: http://xubuntu-server.duckdns.org:3000"
echo "• Email UI: http://xubuntu-server.duckdns.org:9100"
echo "• MinIO Console: http://xubuntu-server.duckdns.org:9101"
echo "• Trigger.dev: http://xubuntu-server.duckdns.org:3031"
echo ""
echo -e "${YELLOW}💡 Para detener los servicios: npm run dx:down:public${NC}"
