
package com.jaime;

import io.github.cdimascio.dotenv.Dotenv;

/**
 *
 * @author Jaime Villalba
 */
public class Config {

    public static final String DB_HOST;
    public static final String DB_PORT;
    public static final String DB_NAME;
    public static final String DB_USER;
    public static final String DB_PASSWORD;
    public static final String API_URL_ARRIVALS;
    public static final String API_URL_DEPARTURES;

    // Bloque estático para inicializar las variables. Se ejecuta para cargar las variables de entorno una vez cuando se carga la clase en memoria
    static {
        Dotenv dotenv = Dotenv.load();
        DB_HOST = dotenv.get("DB_HOST"); 
        DB_PORT = dotenv.get("DB_PORT");    
        DB_NAME = dotenv.get("DB_NAME");
        DB_USER = dotenv.get("DB_USER");
        DB_PASSWORD = dotenv.get("DB_PASSWORD");
        API_URL_ARRIVALS = dotenv.get("API_URL_ARRIVALS");
        API_URL_DEPARTURES = dotenv.get("API_URL_DEPARTURES");
    }

}
