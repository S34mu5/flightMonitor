# Avinor Flight Data Ingestion Project: FlightMonitor

## **Description**
This project is designed to scrape, ingest, and manage flight data from public APIs (XML) and web platforms. It processes arrival and departure flight details, stores them in a structured database, and provides tools for historical tracking and querying of flight-related data. The system is divided into distinct modules: database management, backend Java ingestion, and JavaScript web scraping.

---

## **Folder Structure**
```plaintext
| .gitignore
| estructura.txt
+---db
|       diagram.png
|       flights.sql
|
+---javaBackend
|   |---com.jaime_AvinorXmlIngestor_jar_1.0
|   |       .env
|   |       pom.xml
|   |
|   +---src
|   |   +---main
|   |   |   ---java
|   |   |       ---com
|   |   |           ---jaime
|   |   |               Config.java
|   |   |               Ingestor.java
|   |   |               IngestorMachines.java
|   |   |
|   |   ---test
|   |       ---java
|   |           ---test
|   |               AvinorArrivalsIngestor.java
|   |               AvinorDeparturesIngestor.java
|   |
|   ---target
|       AvinorXmlIngestor-1.0.jar
|       original-AvinorXmlIngestor-1.0.jar
|       +---classes
|       |   .netbeans_automatic_build
|       |   ---com
|       |       ---jaime
|       |           Config.class
|       |           Ingestor.class
|       |           IngestorMachines.class
|       +---generated-sources
|       |   ---annotations
|       +---generated-test-sources
|       |   ---test-annotations
|       +---maven-archiver
|       |       pom.properties
|       +---maven-status
|       |   ---maven-compiler-plugin
|       |       +---compile
|       |       |       createdFiles.lst
|       |       |       inputFiles.lst
|       |       ---testCompile
|       |           ---default-testCompile
|       |               createdFiles.lst
|       |               inputFiles.lst
|       ---test-classes
|           .netbeans_automatic_build
|           ---test
|               AvinorArrivalsIngestor.class
|               AvinorDeparturesIngestor.class
+---jsScraping
    ---tidyScraper
        .env
        tidyArrivalsIngestor.js
        tidyLdmIngestor.js


