# Avinor Flight Data Ingestion Project: FlightMonitor

## Description

This project is designed to scrape, ingest, and manage flight data from public APIs (XML) and web platforms. It processes arrival and departure flight details, stores them in a structured database, and provides tools for historical tracking and querying of flight-related data. The system is divided into distinct modules: database management, backend Java ingestion, and JavaScript web scraping.

## Project Structure

```
.
├── .gitignore
├── estructura.txt
├── db
│   ├── diagram.png
│   └── flights.sql
├── javaBackend
│   ├── com.jaime_AvinorXmlIngestor_jar_1.0
│   │   ├── .env
│   │   └── pom.xml
│   ├── src
│   │   ├── main/java/com/jaime
│   │   │   ├── Config.java
│   │   │   ├── Ingestor.java
│   │   │   └── IngestorMachines.java
│   │   └── test/java/test
│   │       ├── AvinorArrivalsIngestor.java
│   │       └── AvinorDeparturesIngestor.java
│   └── target
│       ├── AvinorXmlIngestor-1.0.jar
│       ├── original-AvinorXmlIngestor-1.0.jar
│       └── [build files...]
└── jsScraping
    └── tidyScraper
        ├── .env
        ├── tidyArrivalsIngestor.js
        └── tidyLdmIngestor.js
```

## Components

### Database Schema

The database is structured to efficiently store and manage flight information:

- **ERD Diagram**: Available at `db/diagram.png`
- **Schema Script**: Located at `db/flights.sql`

#### Key Tables

- **avinor_xml_arrivals / avinor_xml_departures**
  - Stores flight data scraped from public APIs
- **gate_history_arrivals / gate_history_departures**
  - Tracks historical gate assignments and changes
- **tidy_flight_arrivals**
  - Contains flight arrivals from the Tidy platform
- **ldm_data**
  - Stores Load Message (LDM) information for flights

### Backend (Java)

The Java backend uses Maven for dependency management and includes:

#### Dependencies
- mysql-connector-java
- dotenv-java

#### Key Components

- **Config.java**
  - Manages environment variables and configuration
  - Handles database and API URL settings

- **Ingestor.java**
  - Main ingestion controller
  - Orchestrates arrival and departure data processing

- **IngestorMachines.java**
  - Manages database connections
  - Handles XML data fetching and parsing
  - Updates database records
  - Maintains gate change history


### Web Scraping (JavaScript)

Node.js-based scraping module using Puppeteer for web interaction. This module requires valid authentication credentials to access the target platforms.

#### Prerequisites

- Valid web platform credentials
- Appropriate access permissions for the flight data system
- Node.js and Puppeteer installed

#### Authentication Configuration

Add the following credentials to your `.env` file:

```env
TIDY_USERNAME=your_tidy_username
TIDY_PASSWORD=your_tidy_password
```

**Note**: Contact the appropriate department to obtain the necessary credentials. Access is restricted to authorized personnel only.

#### Scripts

- **tidyArrivalsIngestor.js**
  - Requires valid system credentials
  - Scrapes arrival data using authorized access
  - Updates tidy_flight_arrivals table

- **tidyLdmIngestor.js**
  - Requires valid system credentials
  - Extracts Load Message (LDM) data
  - Updates ldm_data table
  - Flags processed flights in fullyscraped_combined_flights



#### Scripts

- **tidyArrivalsIngestor.js**
  - Scrapes Tidy platform arrival data
  - Updates tidy_flight_arrivals table

- **tidyLdmIngestor.js**
  - Extracts Load Message (LDM) data
  - Updates ldm_data table
  - Flags processed flights in fullyscraped_combined_flights

## Setup

### Environment Variables

Create `.env` files in both `javaBackend` and `jsScraping/tidyScraper` directories with the following structure:

```env
DB_HOST=your_host
DB_USER=your_username
DB_PASS=your_password
DB_NAME=your_database
API_URL=your_api_url
```

Replace the placeholder values with your actual configuration details.
