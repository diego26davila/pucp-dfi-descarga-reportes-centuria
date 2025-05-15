### Configuraciones antes de ejecutar el código
1. Instalar buscadores:
   - Especificar la ubicación de los archivos con la variable de entorno PLAYWRIGHT_BROWSERS_PATH.
   - Ejecutar el siguiente comando:
     ```
     npx playwright install chromium
     ```
2. Instalar modulos NPM:
   - Los modulos ya están indicados en el archivo package.json. Solo ejecutar dentro de la carpeta del proyecto:
     ```
     npm install
     ```
3. Si se ejecutará en su máquina local, primero debe autenticarse a AWS desde la línea de comandos. Si es en una región que usa IAM Identity Center (ej. us-east-1), el login se inicia con el siguiente comando:
     ```
     aws sso login
     ```
4. Ingresar credenciales del sistema Centuria y luego ejecutar el código
