# Usar una imagen base de Java 17
FROM eclipse-temurin:17-jdk-alpine

# Configurar el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar el archivo .jar generado por Maven al contenedor
COPY target/AvinorXmlIngestor-1.0.jar app.jar

# Copiar el archivo de configuración .env al contenedor MALA IDEA! MEJOR MAPEAR.
COPY .env .env

# Exponer el puerto 3307 para la conexión con MySQL si es necesario, O USAR localhost????
EXPOSE 3307

# Comando para ejecutar la aplicación
CMD ["java", "-jar", "app.jar"]
