#!/bin/bash
# Script para crear un paquete de deployment mínimo

echo "📦 Creando paquete de deployment para producción..."

# Crear directorio de deployment
mkdir -p deployment-package
cd deployment-package

# Archivos de configuración esenciales
echo "📋 Copiando archivos de configuración..."
cp ../package.json .
cp ../package-lock.json .
cp ../tsconfig.json .
cp ../turbo.json .
cp ../*.config.* .

# Apps necesarias
echo "🏗️ Copiando aplicaciones..."
cp -r ../apps/remix .
mkdir -p apps
mv remix apps/

# Packages necesarios  
echo "📚 Copiando packages..."
cp -r ../packages .

# Scripts de deployment
echo "🚀 Copiando scripts de deployment..."
cp ../configure-production.sh .
cp ../deploy-production.sh .
cp ../demo-deployment.sh .
cp ../DEPLOYMENT.md .
cp ../PRODUCTION_READY.md .

# Configuración Docker
echo "🐳 Copiando configuración Docker..."
cp -r ../docker .

# Assets si existen
if [ -d "../assets" ]; then
    cp -r ../assets .
fi

# Crear archivo .dockerignore optimizado
cat > .dockerignore << 'EOF'
node_modules
.git
.gitignore
README.md
.env.local
.env.development
.next
coverage
.coverage
.nyc_output
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
*.tsbuildinfo
EOF

echo "✅ Paquete de deployment creado en ./deployment-package"
echo "📏 Tamaño del paquete:"
du -sh deployment-package

echo ""
echo "📋 Para usar este paquete:"
echo "1. Comprimir: tar -czf documenso-deployment.tar.gz deployment-package"
echo "2. Subir al servidor"
echo "3. Extraer: tar -xzf documenso-deployment.tar.gz"
echo "4. cd deployment-package && ./configure-production.sh"
