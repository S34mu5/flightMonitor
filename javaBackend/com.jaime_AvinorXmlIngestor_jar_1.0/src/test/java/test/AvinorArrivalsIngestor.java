package test;


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
 * Clase principal para conectar a una base de datos MySQL (ejecutándose en un
 * contenedor Docker) y procesar datos de vuelos obtenidos desde una API en
 * formato XML.
 *
 * Funcionalidades clave: 1. Descargar y parsear un XML que contiene información
 * de vuelos. 2. Insertar o actualizar cada vuelo en la tabla `flights` de la
 * base de datos. - Se utiliza `ON DUPLICATE KEY UPDATE` para simplificar
 * inserción/actualización. 3. Registrar cambios en la puerta (`gate`) en la
 * tabla `gate_history_arrivals`. - Cada vez que la puerta cambie, se inserta un nuevo
 * registro con la nueva puerta.
 */
public class AvinorArrivalsIngestor {

    public static void main(String[] args) {

        // Creamos un ScheduledExecutorService con un solo hilo
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

        // Definimos la tarea que se repetirá cada 3 minutos
        //INICIO TAREA
        Runnable task = () -> {
            // Datos de conexión a MySQL en Docker:
            //CAMBIAR A VARIABLES DE ENTORNO EN EL FUTURO
            // Sabemos que el contenedor MySQL mapea su puerto 3306 al 3307 del host.
            String dbHost = "localhost";
            String dbPort = "3307";
            String dbName = "flights";
            String user = "root";
            String password = "root";
            String dbUrl = "jdbc:mysql://" + dbHost + ":" + dbPort + "/" + dbName;

            Connection conn = null;

            try {
                // Establecer conexión con la base de datos
                conn = DriverManager.getConnection(dbUrl, user, password);
                System.out.println("Conexión establecida con " + dbUrl);

                // URL de la API que retorna datos en formato XML
                String apiUrl = "https://asrv.avinor.no/XmlFeed/v1.0?TimeFrom=1&TimeTo=7&airport=OSL&direction=A";

                // Realizamos la petición HTTP GET a la API
                // Se necesita el casteo explícito a HttpURLConnection para usar setRequestMethod("GET"), getResponseCode(), etc.
                HttpURLConnection connection = (HttpURLConnection) new URL(apiUrl).openConnection();
                connection.setRequestMethod("GET"); // Por URL.
                connection.setRequestProperty("Accept", "application/xml");

                /*
                 * Procesar la respuesta XML:
                 *
                 * El contenido de la respuesta es un texto plano que sigue el formato XML,
                 * pero mientras siga siendo solo un texto, no es útil para acceder directamente
                 * a los nodos y atributos. Hasta que no se parsee, sigue siendo solo un conjunto
                 * de caracteres. Parsearlo lo convierte en una estructura de nodos y elementos a
                 * los que puedes acceder directamente:
                 *
                 * 1. Obtener el flujo de entrada desde la conexión HTTP:
                 *    Este método `getInputStream()` obtiene el flujo de datos de la conexión a la API de Avinor.
                 *    En este punto, la respuesta recibida desde el servidor es simplemente un flujo de texto en formato XML.
                 *    El `InputStream` es una representación del contenido de la respuesta, que será parseado a continuación.
                 *    Este flujo todavía no está estructurado; es solo una secuencia de bytes que contiene el XML sin procesar.
                 */
                InputStream xmlStream = connection.getInputStream();

                /*
                 * 2. Parsear el flujo de entrada para obtener un "Document" (DOM):
                 *    - Crea una instancia de DocumentBuilderFactory
                 *    - Crea un DocumentBuilder
                 *    - Llama a builder.parse(xmlStream) para convertir el InputStream en un Document
                 */
                DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
                DocumentBuilder builder = factory.newDocumentBuilder();
                Document doc = builder.parse(xmlStream);

                /*
                 * 3. Obtener la lista de elementos <flight> del DOM:
                 *    Cada <flight> representa un vuelo en la respuesta XML.
                 */
                NodeList flights = doc.getElementsByTagName("flight");

                // Iteramos sobre cada vuelo
                for (int i = 0; i < flights.getLength(); i++) {
                    Element flight = (Element) flights.item(i);

                    // Extraer el atributo uniqueID del elemento <flight>
                    String uniqueID = flight.getAttribute("uniqueID");
                    if (uniqueID == null || uniqueID.isEmpty()) {
                        uniqueID = "N/A";
                    }

                    /*
                     * 4. Antes de insertar/actualizar, capturamos la puerta antigua (oldGate)
                     *    para detectar posteriormente si hubo un cambio.
                     */
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

                    // Extraer los valores necesarios utilizando getElementsByTagName(...) y getLength()
                    // Se asignan valores por defecto si no existe el nodo o está vacío.
                    // airline
                    String airline;
                    if (flight.getElementsByTagName("airline").getLength() > 0) {
                        airline = flight.getElementsByTagName("airline").item(0).getTextContent();
                    } else {
                        airline = "N/A";
                    }

                    // flight_id
                    String flightId;
                    if (flight.getElementsByTagName("flight_id").getLength() > 0) {
                        flightId = flight.getElementsByTagName("flight_id").item(0).getTextContent();
                    } else {
                        flightId = "N/A";
                    }

                    // dom_int
                    String domInt;
                    if (flight.getElementsByTagName("dom_int").getLength() > 0) {
                        domInt = flight.getElementsByTagName("dom_int").item(0).getTextContent();
                    } else {
                        domInt = "N/A";
                    }

                    // Extraer el tiempo de schedule_time
                    String scheduleTime;
                    String sta = "N/A"; // Inicializamos el valor que se almacenará en la columna 'sta'

                    if (flight.getElementsByTagName("schedule_time").getLength() > 0) {
                        scheduleTime = flight.getElementsByTagName("schedule_time").item(0).getTextContent();
                        scheduleTime = scheduleTime.replace("Z", ""); // Remover la 'Z'

                        // Extraer solo la parte del tiempo (HH:mm:ss) si scheduleTime tiene el formato esperado
                        if (scheduleTime.contains("T")) {
                            sta = scheduleTime.split("T")[1]; // Divide por 'T' y toma la parte después (hora)
                        } else {
                            sta = scheduleTime; // En caso de que no haya 'T', se almacena todo
                        }
                    } else {
                        scheduleTime = "N/A";
                    }

                    // Guardar 'sta' en la base de datos si arr_dep es "A"
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

                    // check_in (si deseas guardarlo)
                    String checkIn;
                    if (flight.getElementsByTagName("check_in").getLength() > 0) {
                        checkIn = flight.getElementsByTagName("check_in").item(0).getTextContent();
                    } else {
                        checkIn = "N/A";
                    }

                    // gate
                    String gate;
                    if (flight.getElementsByTagName("gate").getLength() > 0) {
                        gate = flight.getElementsByTagName("gate").item(0).getTextContent();
                    } else {
                        gate = "N/A";
                    }

                    // status code y status time (atributos de <status>)
                    String statusCode = "N/A";
                    String statusTime = "1970-01-01T00:00:00"; // Valor por defecto compatible con DATETIME
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

                    // delayed
                    String delayed;
                    if (flight.getElementsByTagName("delayed").getLength() > 0) {
                        delayed = flight.getElementsByTagName("delayed").item(0).getTextContent();
                    } else {
                        delayed = "N/A";
                    }

                    /*
                     * 5. Insertar/Actualizar el vuelo en la tabla flights con ON DUPLICATE KEY UPDATE
                     *    para simplificar la lógica.
                     */
                    String insertOrUpdateQuery
                            = "INSERT INTO avinor_xml_arrivals (unique_id, flight_id, airline, dom_int, schedule_time, arr_dep, airport, check_in, gate, status_code, status_time, dlayed, sta) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                            + "ON DUPLICATE KEY UPDATE "
                            + "flight_id=VALUES(flight_id), airline=VALUES(airline), dom_int=VALUES(dom_int), "
                            + "schedule_time=VALUES(schedule_time), arr_dep=VALUES(arr_dep), airport=VALUES(airport), "
                            + "check_in=VALUES(check_in), gate=VALUES(gate), status_code=VALUES(status_code), "
                            + "status_time=VALUES(status_time), dlayed=VALUES(dlayed), sta=VALUES(sta)";

                    try (PreparedStatement stmt = conn.prepareStatement(insertOrUpdateQuery)) {
                        stmt.setString(1, uniqueID);
                        stmt.setString(2, flightId);
                        stmt.setString(3, airline);
                        stmt.setString(4, domInt);
                        stmt.setString(5, scheduleTime); // Fecha y hora completa (schedule_time)
                        stmt.setString(6, arrDep);
                        stmt.setString(7, airport);
                        stmt.setString(8, checkIn);
                        stmt.setString(9, gate);
                        stmt.setString(10, statusCode);
                        stmt.setString(11, statusTime);
                        stmt.setString(12, delayed);
                        stmt.setString(13, sta); // Nuevo parámetro para 'sta'

                        int affectedRows = stmt.executeUpdate();
                        Date currentDate = new Date();

                        if (affectedRows == 1) {
                            System.out.println("Vuelo " + flightId + " " + scheduleTime
                                    + " insertado correctamente a las " + currentDate);
                        } else if (affectedRows == 2) {
                            System.out.println("Vuelo " + flightId + " " + scheduleTime
                                    + " actualizado correctamente a las " + currentDate);
                        } else {
                            System.out.println("Vuelo " + flightId + " " + scheduleTime
                                    + " no sufrió cambios a las " + currentDate);
                        }
                    }

                    /*
                     * 6. Comparar la puerta anterior (oldGate) con la nueva (gate):
                     *    - Si oldGate == null => vuelo nuevo => registrar la puerta inicial (opcional).
                     *    - Si oldGate != null && !oldGate.equals(gate) => hubo cambio => insertar en gate_history_arrivals.
                     */
                    if (oldGate == null) {
                        // Vuelo nuevo => registrar la puerta si lo deseas
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
                        // El vuelo existía, ver si la puerta cambió
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
                } // Fin del for de flights

            } catch (Exception ex) {
                Logger.getLogger(AvinorArrivalsIngestor.class.getName())
                        .log(Level.SEVERE, "Error en la conexión o procesamiento", ex);
            } finally {
                // Finalmente, cerramos la conexión a la base de datos si está abierta.
                if (conn != null) {
                    try {
                        conn.close();
                    } catch (Exception e) {
                        // Ignoramos errores al cerrar
                    }
                }
            }
        };//FIN TAREA

        // Programamos la tarea para que se ejecute cada 3 minutos, sin retardo inicial. La unidad de tiempo se especifica al final.
        scheduler.scheduleAtFixedRate(task, 0, 3, TimeUnit.MINUTES);
    }
}
