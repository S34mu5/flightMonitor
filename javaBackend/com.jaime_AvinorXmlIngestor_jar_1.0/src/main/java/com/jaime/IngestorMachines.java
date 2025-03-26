package com.jaime;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Date;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/**
 * IngestorMachines es una clase encargada de programar y ejecutar tareas de
 * ingesta de datos (llegadas y salidas de vuelos) desde la API de Avinor en
 * formato XML. Cada método configura y lanza un ScheduledExecutorService que se
 * repite periódicamente para:
 * <ul>
 * <li>Conectarse a una base de datos MySQL.</li>
 * <li>Obtener, parsear y guardar los datos de vuelos (arrivals o
 * departures).</li>
 * <li>Actualizar la tabla correspondiente si el registro ya existe ( cláusula
 * ON DUPLICATE KEY UPDATE).</li>
 * <li>Registrar el cambio de puertas en una tabla de historial (gate
 * history).</li>
 * <li>Duplicar ciertos vuelos (p.ej., de aerolíneas DY o D8) en tablas
 * dedicadas.</li>
 * </ul>
 *
 * @author Jaime Villalba
 * @version 1.0
 */
public class IngestorMachines {

    /**
     * Configura y ejecuta la tarea de ingesta de datos de llegadas (arrivals)
     * desde la API de Avinor.
     * <p>
     * Pasos generales del proceso:
     * <ol>
     * <li>Crea un {@link ScheduledExecutorService} con un único hilo.</li>
     * <li>Programa la ejecución de la tarea cada 3 minutos.</li>
     * <li>Establece conexión con la base de datos MySQL y prepara la URL de la
     * API de llegadas.</li>
     * <li>Realiza la petición HTTP GET y obtiene un {@link Document} DOM
     * parseando el XML.</li>
     * <li>Itera sobre cada nodo &lt;flight&gt; para extraer y normalizar campos
     * (p. ej. eliminar 'Z').</li>
     * <li>Inserta o actualiza el vuelo en la tabla
     * <code>avinor_xml_arrivals</code> mediante
     * <em>ON DUPLICATE KEY UPDATE</em>.</li>
     * <li>Si el vuelo corresponde a DY o D8, también se guarda/actualiza en
     * <code>dy_xml_arrivals</code>.</li>
     * <li>Registra la puerta inicial o el cambio de puerta en la tabla
     * <code>gate_history_arrivals</code>.</li>
     * <li>Cierra la conexión a la base de datos al finalizar.</li>
     * </ol>
     */
    public static void runArrivalsIngestor() {
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

        Runnable task = () -> {
            // Datos de conexión a MySQL 
            String dbHost = Config.DB_HOST;
            String dbPort = Config.DB_PORT;
            String dbName = Config.DB_NAME;
            String user = Config.DB_USER;
            String password = Config.DB_PASSWORD;
            String dbUrl = "jdbc:mysql://" + dbHost + ":" + dbPort + "/" + dbName;

            Connection conn = null;

            try {
                conn = DriverManager.getConnection(dbUrl, user, password);
                System.out.println(" runArrivalsIngestor: conexión establecida con " + dbUrl);

                // URL de la API que retorna datos en XML (llegadas)
                String apiUrl = Config.API_URL_ARRIVALS;

                // Petición HTTP GET
                HttpURLConnection connection = (HttpURLConnection) new URL(apiUrl).openConnection();
                connection.setRequestMethod("GET");
                connection.setRequestProperty("Accept", "application/xml");

                // 1. Obtener y parsear el flujo de entrada
                InputStream xmlStream = connection.getInputStream();
                DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
                DocumentBuilder builder = factory.newDocumentBuilder();
                Document doc = builder.parse(xmlStream);

                // 2. Extraer elementos <flight>
                NodeList flights = doc.getElementsByTagName("flight");

                // 3. Iterar sobre cada vuelo y preparar inserciones/actualizaciones
                for (int i = 0; i < flights.getLength(); i++) {
                    Element flight = (Element) flights.item(i);

                    // Unique ID
                    String uniqueID = flight.getAttribute("uniqueID");
                    if (uniqueID == null || uniqueID.isEmpty()) {
                        uniqueID = "N/A";
                    }

                    // Captura la puerta antigua para comprobar cambios posteriores
                    String oldGate = null;
                    {
                        String selectOldGate = "SELECT gate FROM avinor_xml_arrivals WHERE unique_id = ?";
                        try (PreparedStatement stmtOldGate = conn.prepareStatement(selectOldGate)) {
                            stmtOldGate.setString(1, uniqueID);
                            try (ResultSet rsOldGate = stmtOldGate.executeQuery()) {
                                if (rsOldGate.next()) {
                                    oldGate = rsOldGate.getString("gate");
                                }
                            }
                        }
                    }

                    // Airline
                    String airline;
                    if (flight.getElementsByTagName("airline").getLength() > 0) {
                        airline = flight.getElementsByTagName("airline").item(0).getTextContent();
                    } else {
                        airline = "N/A";
                    }

                    // Flight ID
                    String flightId;
                    if (flight.getElementsByTagName("flight_id").getLength() > 0) {
                        flightId = flight.getElementsByTagName("flight_id").item(0).getTextContent();
                    } else {
                        flightId = "N/A";
                    }

                    // Dom/Int
                    String domInt;
                    if (flight.getElementsByTagName("dom_int").getLength() > 0) {
                        domInt = flight.getElementsByTagName("dom_int").item(0).getTextContent();
                    } else {
                        domInt = "N/A";
                    }

                    // schedule_time y extracción de STA
                    // El formato schedule_time por defecto sería tal que 2025-01-16T10:00:00Z, "Z" no es admitida en DATETIME en MySQL.
                    String scheduleTime;
                    String sta = "N/A";
                    if (flight.getElementsByTagName("schedule_time").getLength() > 0) {
                        scheduleTime = flight.getElementsByTagName("schedule_time").item(0).getTextContent();
                        scheduleTime = scheduleTime.replace("Z", "");
                        if (scheduleTime.contains("T")) {
                            sta = scheduleTime.split("T")[1];
                        } else {
                            sta = scheduleTime;
                        }
                    } else {
                        scheduleTime = "N/A";
                    }

                    // arr_dep
                    String arrDep = "N/A";
                    if (flight.getElementsByTagName("arr_dep").getLength() > 0) {
                        arrDep = flight.getElementsByTagName("arr_dep").item(0).getTextContent();
                    }

                    // airport
                    String airport;
                    if (flight.getElementsByTagName("airport").getLength() > 0) {
                        airport = flight.getElementsByTagName("airport").item(0).getTextContent();
                    } else {
                        airport = "N/A";
                    }

                    // check_in Disponible sólo para salidas.
                    String checkIn;
                    if (flight.getElementsByTagName("check_in").getLength() > 0) {
                        checkIn = flight.getElementsByTagName("check_in").item(0).getTextContent();
                    } else {
                        checkIn = "N/A";
                    }

                    // gate Disponible sólo para salidas.
                    String gate;
                    if (flight.getElementsByTagName("gate").getLength() > 0) {
                        gate = flight.getElementsByTagName("gate").item(0).getTextContent();
                    } else {
                        gate = "N/A";
                    }
                    //TODO: Si status_code = 'C' (Cancelado), sería deseable que statusTime no muestre el valor por defecto "1970-01-01T00:00:00"
                    //status code y status time (atributos de <status>)
                    //status time por defecto sería tal que 2025-01-16T10:00:00Z, "Z" no es admitida en DATETIME en MySQL. 
                    String statusCode = "N/A";
                    String statusTime = "1970-01-01T00:00:00"; // Valor por defecto compatible con DATETIME en MySQL.
                    if (flight.getElementsByTagName("status").getLength() > 0) {
                        Element statusElem = (Element) flight.getElementsByTagName("status").item(0);
                        if (statusElem.hasAttribute("code")) {
                            statusCode = statusElem.getAttribute("code");
                        }
                        if (statusElem.hasAttribute("time")) {
                            statusTime = statusElem.getAttribute("time");
                            statusTime = statusTime.replace("Z", "");
                        }
                    }

                    // belt. Disponible sólo para llegadas.
                    String belt;
                    if (flight.getElementsByTagName("belt").getLength() > 0) {
                        belt = flight.getElementsByTagName("belt").item(0).getTextContent();
                    } else {
                        belt = "N/A";
                    }

                    // delayed
                    String delayed;
                    if (flight.getElementsByTagName("delayed").getLength() > 0) {
                        delayed = flight.getElementsByTagName("delayed").item(0).getTextContent();
                    } else {
                        delayed = "N/A";
                    }

                    // 4. Inserción/actualización de datos en avinor_xml_arrivals
                    String insertOrUpdateQuery
                            = "INSERT INTO avinor_xml_arrivals ("
                            + "  unique_id, flight_id, airline, dom_int, schedule_time, arr_dep, "
                            + "  airport, check_in, gate, belt, status_code, status_time, dlayed, sta, last_update"
                            + ") VALUES ("
                            + "  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()"
                            + ") ON DUPLICATE KEY UPDATE "
                            + "  flight_id=VALUES(flight_id), airline=VALUES(airline), dom_int=VALUES(dom_int), "
                            + "  schedule_time=VALUES(schedule_time), arr_dep=VALUES(arr_dep), airport=VALUES(airport), "
                            + "  check_in=VALUES(check_in), gate=VALUES(gate), belt=VALUES(belt), status_code=VALUES(status_code), "
                            + "  status_time=VALUES(status_time), dlayed=VALUES(dlayed), sta=VALUES(sta), "
                            + "  last_update=NOW()";

                    try (PreparedStatement stmt = conn.prepareStatement(insertOrUpdateQuery)) {
                        stmt.setString(1, uniqueID);
                        stmt.setString(2, flightId);
                        stmt.setString(3, airline);
                        stmt.setString(4, domInt);
                        stmt.setString(5, scheduleTime);
                        stmt.setString(6, arrDep);
                        stmt.setString(7, airport);
                        stmt.setString(8, checkIn);
                        stmt.setString(9, gate);
                        stmt.setString(10, belt);
                        stmt.setString(11, statusCode);
                        stmt.setString(12, statusTime);
                        stmt.setString(13, delayed);
                        stmt.setString(14, sta);

                        int affectedRows = stmt.executeUpdate();
                        Date currentDate = new Date();

                        if (affectedRows == 1) {
                            System.out.println("Vuelo " + flightId + " " + scheduleTime
                                    + " insertado correctamente a las " + currentDate);
                        } else if (affectedRows == 2) {
                            System.out.println("Vuelo " + flightId + " " + scheduleTime
                                    + " actualizado correctamente a las " + currentDate);
                        }

                        // 5. Insertar/actualizar también en dy_xml_arrivals si la aerolínea es DY o D8
                        if ("DY".equals(airline) || "D8".equals(airline)) {
                            String insertOrUpdateDYQuery
                                    = "INSERT INTO dy_xml_arrivals ("
                                    + "  unique_id, flight_id, airline, dom_int, schedule_time, arr_dep, "
                                    + "  airport, check_in, gate, belt, status_code, status_time, dlayed, sta, last_update"
                                    + ") VALUES ("
                                    + "  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()"
                                    + ") ON DUPLICATE KEY UPDATE "
                                    + "  flight_id=VALUES(flight_id), airline=VALUES(airline), dom_int=VALUES(dom_int), "
                                    + "  schedule_time=VALUES(schedule_time), arr_dep=VALUES(arr_dep), airport=VALUES(airport), "
                                    + "  check_in=VALUES(check_in), gate=VALUES(gate), belt=VALUES(belt), status_code=VALUES(status_code), "
                                    + "  status_time=VALUES(status_time), dlayed=VALUES(dlayed), sta=VALUES(sta), last_update=NOW()";

                            try (PreparedStatement stmtDY = conn.prepareStatement(insertOrUpdateDYQuery)) {
                                stmtDY.setString(1, uniqueID);
                                stmtDY.setString(2, flightId);
                                stmtDY.setString(3, airline);
                                stmtDY.setString(4, domInt);
                                stmtDY.setString(5, scheduleTime);
                                stmtDY.setString(6, arrDep);
                                stmtDY.setString(7, airport);
                                stmtDY.setString(8, checkIn);
                                stmtDY.setString(9, gate);
                                stmtDY.setString(10, belt);
                                stmtDY.setString(11, statusCode);
                                stmtDY.setString(12, statusTime);
                                stmtDY.setString(13, delayed);
                                stmtDY.setString(14, sta);

                                int dyAffectedRows = stmtDY.executeUpdate();
                                if (dyAffectedRows == 1) {
                                    System.out.println("Vuelo " + flightId + " " + scheduleTime
                                            + " insertado en dy_xml_arrivals.");
                                } else if (dyAffectedRows == 2) {
                                    System.out.println("Vuelo " + flightId + " " + scheduleTime
                                            + " actualizado en dy_xml_arrivals.");
                                } else {
                                    System.out.println("Vuelo " + flightId + " " + scheduleTime
                                            + " no sufrió cambios en dy_xml_arrivals.");
                                }
                            }
                        } else {
                            System.out.println("Vuelo " + flightId + " " + scheduleTime
                                    + " no sufrió cambios a las " + currentDate);
                        }
                    }

                    // 6. Comprobar cambio de puerta y registrarlo en gate_history_arrivals si corresponde
                    if (oldGate == null) {
                        // Vuelo nuevo, insertamos en gate_history_departures.
                        String insertGateHistory
                                = "INSERT INTO gate_history_arrivals (unique_id, gate, update_time, flight_id, dom_int, schedule_time, airport) "
                                + "VALUES (?, ?, NOW(), ?, ?, ?, ?)";
                        try (PreparedStatement gateHistoryStmt = conn.prepareStatement(insertGateHistory)) {
                            gateHistoryStmt.setString(1, uniqueID);
                            gateHistoryStmt.setString(2, gate);
                            gateHistoryStmt.setString(3, flightId);
                            gateHistoryStmt.setString(4, domInt);
                            gateHistoryStmt.setString(5, scheduleTime);
                            gateHistoryStmt.setString(6, airport);
                            gateHistoryStmt.executeUpdate();
                            System.out.println("Vuelo nuevo. Puerta registrada en historial para "
                                    + flightId + ": " + gate);
                        }
                    } else {
                         // Vuelo existente; revisamos si cambió de puerta. Si es distinta, insertamos el cambio en gate_history_departures
                        if (!oldGate.equals(gate)) {
                            String insertGateHistory
                                    = "INSERT INTO gate_history_arrivals (unique_id, gate, update_time, flight_id, dom_int, schedule_time, airport) "
                                    + "VALUES (?, ?, NOW(), ?, ?, ?, ?)";
                            try (PreparedStatement gateHistoryStmt = conn.prepareStatement(insertGateHistory)) {
                                gateHistoryStmt.setString(1, uniqueID);
                                gateHistoryStmt.setString(2, gate);
                                gateHistoryStmt.setString(3, flightId);
                                gateHistoryStmt.setString(4, domInt);
                                gateHistoryStmt.setString(5, scheduleTime);
                                gateHistoryStmt.setString(6, airport);
                                gateHistoryStmt.executeUpdate();
                                System.out.println("Cambio de puerta registrado para el vuelo "
                                        + flightId + ". Puerta ahora: " + gate);
                            }
                        }
                    }
                } // fin for

            } catch (Exception ex) {
                Logger.getLogger(IngestorMachines.class.getName())
                        .log(Level.SEVERE, "Error en la conexión o procesamiento", ex);
                ex.printStackTrace();
            } finally {
                // Cierra la conexión a la base de datos si está abierta.
                if (conn != null) {
                    try {
                        conn.close();
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        };

        // Inicia la tarea cada 3 minutos sin retardo inicial
        scheduler.scheduleAtFixedRate(task, 0, 3, TimeUnit.MINUTES);
    }

    /**
     * Configura y ejecuta la tarea de ingesta de datos de salidas (departures)
     * desde la API de Avinor.
     * <p>
     * Pasos generales del proceso:
     * <ol>
     * <li>Crea un {@link ScheduledExecutorService} con un único hilo.</li>
     * <li>Programa la ejecución de la tarea cada 3 minutos.</li>
     * <li>Establece conexión con la base de datos MySQL y prepara la URL de la
     * API de salidas.</li>
     * <li>Realiza la petición HTTP GET y obtiene un {@link Document} DOM
     * parseando el XML.</li>
     * <li>Itera sobre cada nodo &lt;flight&gt; para extraer y normalizar
     * campos.</li>
     * <li>Inserta o actualiza el vuelo en la tabla
     * <code>avinor_xml_departures</code> mediante
     * <em>ON DUPLICATE KEY UPDATE</em>.</li>
     * <li>Si el vuelo corresponde a DY o D8, también se guarda/actualiza en
     * <code>dy_xml_departures</code>.</li>
     * <li>Registra la puerta inicial o el cambio de puerta en la tabla
     * <code>gate_history_departures</code>.</li>
     * <li>Cierra la conexión a la base de datos al finalizar.</li>
     * </ol>
     */
    public static void runDeparturesIngestor() {
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

        Runnable task = () -> {
            // Datos de conexión a MySQL 
            String dbHost = Config.DB_HOST;
            String dbPort = Config.DB_PORT;
            String dbName = Config.DB_NAME;
            String user = Config.DB_USER;
            String password = Config.DB_PASSWORD;
            String dbUrl = "jdbc:mysql://" + dbHost + ":" + dbPort + "/" + dbName;

            Connection conn = null;

            try {
                conn = DriverManager.getConnection(dbUrl, user, password);
                System.out.println("runDeparturesIngestor: conexión establecida con " + dbUrl);

                // URL de la API que retorna datos en XML (salidas)
                String apiUrl = Config.API_URL_DEPARTURES;

                // Petición HTTP GET
                HttpURLConnection connection = (HttpURLConnection) new URL(apiUrl).openConnection();
                connection.setRequestMethod("GET");
                connection.setRequestProperty("Accept", "application/xml");

                // 1. Obtener y parsear el flujo de entrada
                InputStream xmlStream = connection.getInputStream();
                DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
                DocumentBuilder builder = factory.newDocumentBuilder();
                Document doc = builder.parse(xmlStream);

                // 2. Extraer elementos <flight>
                NodeList flights = doc.getElementsByTagName("flight");

                // 3. Iterar sobre cada vuelo y preparar inserciones/actualizaciones
                for (int i = 0; i < flights.getLength(); i++) {
                    Element flight = (Element) flights.item(i);

                    // Unique ID
                    String uniqueID = flight.getAttribute("uniqueID");
                    if (uniqueID == null || uniqueID.isEmpty()) {
                        uniqueID = "N/A";
                    }

                    // Capturar la puerta antigua
                    String oldGate = null;
                    {
                        String selectOldGate = "SELECT gate FROM avinor_xml_departures WHERE unique_id = ?";
                        try (PreparedStatement stmtOldGate = conn.prepareStatement(selectOldGate)) {
                            stmtOldGate.setString(1, uniqueID);
                            try (ResultSet rsOldGate = stmtOldGate.executeQuery()) {
                                if (rsOldGate.next()) {
                                    oldGate = rsOldGate.getString("gate");
                                }
                            }
                        }
                    }

                    // Airline
                    String airline;
                    if (flight.getElementsByTagName("airline").getLength() > 0) {
                        airline = flight.getElementsByTagName("airline").item(0).getTextContent();
                    } else {
                        airline = "N/A";
                    }

                    // Flight ID
                    String flightId;
                    if (flight.getElementsByTagName("flight_id").getLength() > 0) {
                        flightId = flight.getElementsByTagName("flight_id").item(0).getTextContent();
                    } else {
                        flightId = "N/A";
                    }

                    // Dom/Int
                    String domInt;
                    if (flight.getElementsByTagName("dom_int").getLength() > 0) {
                        domInt = flight.getElementsByTagName("dom_int").item(0).getTextContent();
                    } else {
                        domInt = "N/A";
                    }

                    // schedule_time y extracción de STD
                    // El formato schedule_time por defecto sería tal que 2025-01-16T10:00:00Z, "Z" no es admitida en DATETIME en MySQL.
                    String scheduleTime;
                    String std = "N/A";
                    if (flight.getElementsByTagName("schedule_time").getLength() > 0) {
                        scheduleTime = flight.getElementsByTagName("schedule_time").item(0).getTextContent();
                        scheduleTime = scheduleTime.replace("Z", "");
                        if (scheduleTime.contains("T")) {
                            std = scheduleTime.split("T")[1];
                        } else {
                            std = scheduleTime;
                        }
                    } else {
                        scheduleTime = "N/A";
                    }

                    // arr_dep
                    String arrDep = "N/A";
                    if (flight.getElementsByTagName("arr_dep").getLength() > 0) {
                        arrDep = flight.getElementsByTagName("arr_dep").item(0).getTextContent();
                    }

                    // airport
                    String airport;
                    if (flight.getElementsByTagName("airport").getLength() > 0) {
                        airport = flight.getElementsByTagName("airport").item(0).getTextContent();
                    } else {
                        airport = "N/A";
                    }

                    // check_in. Disponible sólo para salidas.
                    String checkIn;
                    if (flight.getElementsByTagName("check_in").getLength() > 0) {
                        checkIn = flight.getElementsByTagName("check_in").item(0).getTextContent();
                    } else {
                        checkIn = "N/A";
                    }

                    // gate Disponible sólo para salidas.
                    String gate;
                    if (flight.getElementsByTagName("gate").getLength() > 0) {
                        gate = flight.getElementsByTagName("gate").item(0).getTextContent();
                    } else {
                        gate = "N/A";
                    }
                    //TODO: Si status_code = 'C' (Cancelado), sería deseable que statusTime no muestre el valor por defecto "1970-01-01T00:00:00"
                    //status code y status time (atributos de <status>)
                    //status time por defecto sería tal que 2025-01-16T10:00:00Z, "Z" no es admitida en DATETIME en MySQL. 
                    String statusCode = "N/A";
                    String statusTime = "1970-01-01T00:00:00"; // Valor por defecto compatible con DATETIME en MySQL.
                    if (flight.getElementsByTagName("status").getLength() > 0) {
                        Element statusElem = (Element) flight.getElementsByTagName("status").item(0);
                        if (statusElem.hasAttribute("code")) {
                            statusCode = statusElem.getAttribute("code");
                        }
                        if (statusElem.hasAttribute("time")) {
                            statusTime = statusElem.getAttribute("time");
                            statusTime = statusTime.replace("Z", "");
                        }
                    }

                    // belt. Disponible sólo para llegadas.
                    String belt;
                    if (flight.getElementsByTagName("belt").getLength() > 0) {
                        belt = flight.getElementsByTagName("belt").item(0).getTextContent();
                    } else {
                        belt = "N/A";
                    }

                    // delayed
                    String delayed;
                    if (flight.getElementsByTagName("delayed").getLength() > 0) {
                        delayed = flight.getElementsByTagName("delayed").item(0).getTextContent();
                    } else {
                        delayed = "N/A";
                    }

                    // 4. Inserción/actualización de datos en avinor_xml_departures
                    String insertOrUpdateQuery
                            = "INSERT INTO avinor_xml_departures ("
                            + "  unique_id, flight_id, airline, dom_int, schedule_time, arr_dep, "
                            + "  airport, check_in, gate, belt, status_code, status_time, dlayed, std, last_update"
                            + ") VALUES ("
                            + "  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()"
                            + ") ON DUPLICATE KEY UPDATE "
                            + "  flight_id=VALUES(flight_id), airline=VALUES(airline), dom_int=VALUES(dom_int), "
                            + "  schedule_time=VALUES(schedule_time), arr_dep=VALUES(arr_dep), airport=VALUES(airport), "
                            + "  check_in=VALUES(check_in), gate=VALUES(gate), belt=VALUES(belt), status_code=VALUES(status_code), "
                            + "  status_time=VALUES(status_time), dlayed=VALUES(dlayed), std=VALUES(std), last_update=NOW()";

                    try (PreparedStatement stmt = conn.prepareStatement(insertOrUpdateQuery)) {
                        stmt.setString(1, uniqueID);
                        stmt.setString(2, flightId);
                        stmt.setString(3, airline);
                        stmt.setString(4, domInt);
                        stmt.setString(5, scheduleTime);
                        stmt.setString(6, arrDep);
                        stmt.setString(7, airport);
                        stmt.setString(8, checkIn);
                        stmt.setString(9, gate);
                        stmt.setString(10, belt);
                        stmt.setString(11, statusCode);
                        stmt.setString(12, statusTime);
                        stmt.setString(13, delayed);
                        stmt.setString(14, std);

                        int affectedRows = stmt.executeUpdate();
                        Date currentDate = new Date();

                        if (affectedRows == 1) {
                            System.out.println("Vuelo " + flightId + " " + scheduleTime
                                    + " insertado correctamente a las " + currentDate);
                        } else if (affectedRows == 2) {
                            System.out.println("Vuelo " + flightId + " " + scheduleTime
                                    + " actualizado correctamente a las " + currentDate);
                        }

                        // 5. Insertar/actualizar también en dy_xml_departures si la aerolínea es DY o D8
                        if ("DY".equals(airline) || "D8".equals(airline)) {
                            String insertOrUpdateDYQuery
                                    = "INSERT INTO dy_xml_departures ("
                                    + "  unique_id, flight_id, airline, dom_int, schedule_time, arr_dep, "
                                    + "  airport, check_in, gate, belt, status_code, status_time, dlayed, std, last_update"
                                    + ") VALUES ("
                                    + "  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()"
                                    + ") ON DUPLICATE KEY UPDATE "
                                    + "  flight_id=VALUES(flight_id), airline=VALUES(airline), dom_int=VALUES(dom_int), "
                                    + "  schedule_time=VALUES(schedule_time), arr_dep=VALUES(arr_dep), airport=VALUES(airport), "
                                    + "  check_in=VALUES(check_in), gate=VALUES(gate), belt=VALUES(belt), status_code=VALUES(status_code), "
                                    + "  status_time=VALUES(status_time), dlayed=VALUES(dlayed), std=VALUES(std), last_update=NOW()";

                            try (PreparedStatement stmtDY = conn.prepareStatement(insertOrUpdateDYQuery)) {
                                stmtDY.setString(1, uniqueID);
                                stmtDY.setString(2, flightId);
                                stmtDY.setString(3, airline);
                                stmtDY.setString(4, domInt);
                                stmtDY.setString(5, scheduleTime);
                                stmtDY.setString(6, arrDep);
                                stmtDY.setString(7, airport);
                                stmtDY.setString(8, checkIn);
                                stmtDY.setString(9, gate);
                                stmtDY.setString(10, belt);
                                stmtDY.setString(11, statusCode);
                                stmtDY.setString(12, statusTime);
                                stmtDY.setString(13, delayed);
                                stmtDY.setString(14, std);

                                int dyAffectedRows = stmtDY.executeUpdate();
                                if (dyAffectedRows == 1) {
                                    System.out.println("Vuelo " + flightId + " " + scheduleTime
                                            + " insertado en dy_xml_departures.");
                                } else if (dyAffectedRows == 2) {
                                    System.out.println("Vuelo " + flightId + " " + scheduleTime
                                            + " actualizado en dy_xml_departures.");
                                } else {
                                    System.out.println("Vuelo " + flightId + " " + scheduleTime
                                            + " no sufrió cambios en dy_xml_departures.");
                                }
                            }
                        } else {
                            System.out.println("Vuelo " + flightId + " " + scheduleTime
                                    + " no sufrió cambios a las " + currentDate);
                        }
                    }

                    // 6. Comprobar cambio de puerta y registrarlo en gate_history_departures si corresponde
                    if (oldGate == null) {
                        // Vuelo nuevo, insertamos en gate_history_departures.
                        String insertGateHistory
                                = "INSERT INTO gate_history_departures (unique_id, gate, update_time, flight_id, dom_int, schedule_time, airport) "
                                + "VALUES (?, ?, NOW(), ?, ?, ?, ?)";
                        try (PreparedStatement gateHistoryStmt = conn.prepareStatement(insertGateHistory)) {
                            gateHistoryStmt.setString(1, uniqueID);
                            gateHistoryStmt.setString(2, gate);
                            gateHistoryStmt.setString(3, flightId);
                            gateHistoryStmt.setString(4, domInt);
                            gateHistoryStmt.setString(5, scheduleTime);
                            gateHistoryStmt.setString(6, airport);
                            gateHistoryStmt.executeUpdate();
                            System.out.println("Vuelo nuevo. Puerta registrada en historial para "
                                    + flightId + ": " + gate);
                        }
                    } else {
                        // Vuelo existente; revisamos si cambió de puerta. Si es distinta, insertamos el cambio en gate_history_departures
                        if (!oldGate.equals(gate)) {
                            String insertGateHistory
                                    = "INSERT INTO gate_history_departures (unique_id, gate, update_time, flight_id, dom_int, schedule_time, airport) "
                                    + "VALUES (?, ?, NOW(), ?, ?, ?, ?)";
                            try (PreparedStatement gateHistoryStmt = conn.prepareStatement(insertGateHistory)) {
                                gateHistoryStmt.setString(1, uniqueID);
                                gateHistoryStmt.setString(2, gate);
                                gateHistoryStmt.setString(3, flightId);
                                gateHistoryStmt.setString(4, domInt);
                                gateHistoryStmt.setString(5, scheduleTime);
                                gateHistoryStmt.setString(6, airport);
                                gateHistoryStmt.executeUpdate();
                                System.out.println("Cambio de puerta registrado para el vuelo "
                                        + flightId + ". Puerta ahora: " + gate);
                            }
                        }
                    }
                } // fin for
            } catch (Exception ex) {
                Logger.getLogger(IngestorMachines.class.getName())
                        .log(Level.SEVERE, "Error en la conexión o procesamiento", ex);
            } finally {
                // Cierra la conexión a la base de datos si está abierta
                if (conn != null) {
                    try {
                        conn.close();
                    } catch (Exception e) {
                        // Ignoramos errores al cerrar
                    }
                }
            }
        };

        // Inicia la tarea cada 3 minutos sin retardo inicial
        scheduler.scheduleAtFixedRate(task, 0, 3, TimeUnit.MINUTES);
    }
}
