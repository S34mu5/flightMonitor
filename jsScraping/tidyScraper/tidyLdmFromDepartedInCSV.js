require("dotenv").config();
const puppeteer = require("puppeteer");
const mysql = require("mysql2/promise");

/**
 * Script para obtener LDMs (Load Data Messages) de vuelos que ya han despegado.
 *
 * Este script es una versión optimizada que solo busca LDMs para vuelos que:
 * 1. No tienen LDM almacenado (ldm_obtained = false)
 * 2. Ya han despegado (tienen ATD - Actual Time of Departure)
 *
 * La razón de esta optimización es que los LDMs generalmente solo están disponibles
 * después de que el vuelo ha despegado. Buscar LDMs antes del despegue resulta en
 * búsquedas innecesarias y consumo de recursos.
 */

// 1. Crear pool de conexiones a MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function getLDMs() {
  // 2. Abrimos el navegador con configuración deseada
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    ],
    defaultViewport: null,
  });

  // 3. Consulta a la tabla movement_progress
  // IMPORTANTE: Solo seleccionamos vuelos que:
  // - No tienen LDM (ldm_obtained = false)
  // - Han despegado (ATD IS NOT NULL AND ATD <> '')
  const query = `
    SELECT
      flight,
      date,
      \`from\`,
      \`to\`
    FROM movement_progress
    WHERE ldm_obtained = false
      AND ATD IS NOT NULL
      AND ATD <> '';
  `;

  // ... existing code ...
}
