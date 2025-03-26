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
  // - No son más antiguos de 2 días (restricción temporal de Tidy)
  //
  // CONCLUSIÓN: Si un vuelo cumple estas condiciones pero no tiene LDM,
  // significa que no se puede obtener por razones ajenas al tiempo o al estado del vuelo.
  // Es probablemente un error humano o un problema en la generación/registro del LDM en la plataforma web.
  //
  const query = `
    SELECT
      flight,
      date,
      \`from\`,
      \`to\`
    FROM movement_progress
    WHERE ldm_obtained = false
      AND ATD IS NOT NULL
      AND ATD <> ''
      AND date >= DATE_SUB(NOW(), INTERVAL 2 DAY);
  `;

  // 4. Ejecutamos la query
  const [flights] = await pool.query(query);
  const now = new Date().toISOString();
  console.log("Query lanzada:", query);
  console.log("Fecha actual:", new Date().toISOString());
  console.log(
    "Fecha límite (2 días atrás):",
    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  );

  if (flights.length === 0) {
    console.error(`La query no arrojó resultados a las ${now}`);
    console.log("");
    console.log(`Ciclo terminado a las ${now}`);
    console.log("");
    await browser.close();
    return; // Salimos de la función hasta el siguiente intervalo.
  } else {
    console.log(`Array de vuelos creado a las ${now}:`);
    console.log(flights);
    console.log("");
  }

  // 5. Abrimos nueva pestaña para iniciar sesión en Tidy
  const page = await browser.newPage();
  await page.goto(process.env.TIDY_LOGIN_URL);

  // 6. Hacemos login
  await page.type(
    'input[name="ctl00$body$txtUsername"]',
    process.env.TIDY_USERNAME
  );
  await page.type(
    'input[name="ctl00$body$txtPassword"]',
    process.env.TIDY_PASSWORD
  );
  await page.keyboard.press("Enter");

  // 7. Navegamos a la sección de búsquedas de loads (SearchLoads)
  await page.waitForSelector('a[href="/View/Load/SearchLoads.aspx"]', {
    visible: true,
  });
  await page.click('a[href="/View/Load/SearchLoads.aspx"]');

  // 8. Procesamos cada vuelo que ha despegado
  for (const flight of flights) {
    /**
     * flight es un objeto con las propiedades:
     * - flight      (p.ej. "D83797")
     * - date        (objeto tipo DATE en MySQL, llega como string en JS)
     * - from        (aeropuerto origen, p.ej. "DWC")
     * - to          (aeropuerto destino, p.ej. "CPH")
     */

    // a) Ajustar número de vuelo, solo la parte numérica
    const flightNumber = flight.flight.slice(2);

    // b) Formatear la fecha para Tidy (dd/mm/yyyy)
    const flightDateJS = new Date(flight.date);
    const formattedDate = `${String(flightDateJS.getDate()).padStart(
      2,
      "0"
    )}/${String(flightDateJS.getMonth() + 1).padStart(
      2,
      "0"
    )}/${flightDateJS.getFullYear()}`;

    // c) Completar los campos en la web de Tidy
    //    1) Número de vuelo
    await page.waitForSelector('input[name="ctl00$body$txtFlightNumber"]', {
      visible: true,
    });
    await page.$eval(
      'input[name="ctl00$body$txtFlightNumber"]',
      (el) => (el.value = "")
    );
    await page.type('input[name="ctl00$body$txtFlightNumber"]', flightNumber);

    //    2) From Date
    await page.waitForSelector('input[name="ctl00$body$calFromDate$textBox"]', {
      visible: true,
    });
    await page.focus('input[name="ctl00$body$calFromDate$textBox"]');
    await page.$eval(
      'input[name="ctl00$body$calFromDate$textBox"]',
      (el) => (el.value = "")
    );
    await page.type(
      'input[name="ctl00$body$calFromDate$textBox"]',
      formattedDate
    );

    //    3) To Date
    await page.waitForSelector('input[name="ctl00$body$calToDate$textBox"]', {
      visible: true,
    });
    await page.focus('input[name="ctl00$body$calToDate$textBox"]');
    await page.$eval(
      'input[name="ctl00$body$calToDate$textBox"]',
      (el) => (el.value = "")
    );
    await page.type(
      'input[name="ctl00$body$calToDate$textBox"]',
      formattedDate
    );

    //    4) Click en botón "Search"
    await page.waitForSelector('input[name="ctl00$body$btnSearch"]', {
      visible: true,
    });
    await page.click('input[name="ctl00$body$btnSearch"]');

    // NOTA: Este bloque de código se ha comentado porque es redundante.
    // La query SQL ya filtra los vuelos más antiguos de 2 días con:
    // AND date >= DATE_SUB(NOW(), INTERVAL 2 DAY)
    // Por lo tanto, nunca deberíamos llegar a este punto con un vuelo más antiguo.
    /*
    // Nuevo: Detectar mensaje de fecha antigua
    try {
      const userMessage = await page.waitForSelector(".usermessage", {
        timeout: 1000,
      });
      if (userMessage) {
        const message = await page.$eval(
          ".usermessage",
          (el) => el.textContent
        );
        if (
          message.includes(
            "You are not allowed to search longer back in time than 2 days"
          )
        ) {
          console.error(
            `No se puede buscar LDM para ${flight.flight} (${formattedDate}) - Fecha demasiado antigua`
          );
          console.log("");

          const tooOldMessage = `Cannot search LDM - Flight date too old (more than 2 days). Tidy prevents searching flights older than 2 days.`;

          await pool.query(
            `INSERT INTO ldm_data_csv (
              flight_id,
              flight_date,
              origin,
              destination,
              ldm_text,
              ldm_obtained
            ) VALUES (?, ?, ?, ?, ?, TRUE)
            ON DUPLICATE KEY UPDATE
              ldm_text = VALUES(ldm_text),
              ldm_obtained = VALUES(ldm_obtained)`,
            [
              flight.flight,
              flight.date,
              flight.from,
              flight.to,
              tooOldMessage,
              true,
            ]
          );

          // Actualizar movement_progress
          await pool.query(
            `UPDATE movement_progress
             SET ldm_obtained = 1
             WHERE flight = ? AND date = ?`,
            [flight.flight, flight.date]
          );

          // Regresamos a la página principal de búsqueda para procesar el siguiente vuelo
          await page.goto(process.env.TIDY_SEARCHLOAD);
          continue;
        }
      }
    } catch (error) {
      // Si no hay mensaje de usuario, continuamos con la búsqueda normal del LDM
    }
    */

    // d) Intentar localizar el botón "View" del LDM
    try {
      await page.waitForSelector(
        "#ctl00_body_gridViewLoadMessages_ctl03_btnSelect",
        {
          visible: true,
          timeout: 1000,
        }
      );
      console.log(
        `Botón de View LDM encontrado para ${flight.flight} (fecha ${formattedDate}).`
      );
      console.log("");
    } catch (error) {
      // Si no existe el botón, asumimos que no hay LDM disponible
      const nowNoBtn = new Date();
      console.error(
        `No se encontró el botón de View para ${flight.flight} (${formattedDate}) a las ${nowNoBtn}:`,
        error.message
      );
      console.log("");

      const notAvailableMessage = `No LDM available at ${nowNoBtn.toISOString()}.`;

      console.log("Datos recibidos:", flight);
      console.log("Flight:", flight.flight);
      console.log("Date:", flight.date);

      await pool.query(
        `INSERT INTO ldm_data_csv (
          flight_id,
          flight_date,
          origin,
          destination,
          ldm_text,
          ldm_obtained
        ) VALUES (?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE
          ldm_text = VALUES(ldm_text),
          ldm_obtained = VALUES(ldm_obtained)`,
        [
          flight.flight, // flight_id
          flight.date, // flight_date
          flight.from, // origin
          flight.to, // destination
          notAvailableMessage,
          true,
        ]
      );

      // Regresamos a la página principal de búsqueda para procesar el siguiente vuelo
      await page.goto(process.env.TIDY_SEARCHLOAD);
      continue;
    }

    // e) Si encontramos el botón "View", lo clicamos
    await page.click("#ctl00_body_gridViewLoadMessages_ctl03_btnSelect");

    // f) Esperar que cargue la página con el LDM
    await page.waitForSelector('textarea[name="ctl00$body$txtMessage"]', {
      visible: true,
    });
    const ldmMessage = await page.$eval(
      'textarea[name="ctl00$body$txtMessage"]',
      (textarea) => textarea.value
    );
    console.log(`LDM capturado para ${flight.flight} (${formattedDate}).`);
    console.log(ldmMessage);
    console.log("");

    // g) Guardar el LDM en ldm_data_csv y actualizar movement_progress
    await pool.query(
      `INSERT INTO ldm_data_csv (
        flight_id,
        flight_date,
        origin,
        destination,
        ldm_text,
        ldm_obtained
      ) VALUES (?, ?, ?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE
        ldm_text = VALUES(ldm_text),
        ldm_obtained = VALUES(ldm_obtained)`,
      [
        flight.flight, // flight_id
        flight.date, // flight_date
        flight.from, // origin
        flight.to, // destination
        ldmMessage,
        true,
      ]
    );

    // Actualizar movement_progress (este query está bien, no necesita cambios)
    await pool.query(
      `UPDATE movement_progress
       SET ldm_obtained = 1
       WHERE flight = ? AND date = ?`,
      [flight.flight, flight.date]
    );

    const nowOk = new Date().toISOString();
    console.log(
      `LDM almacenado y ldm_obtained=true para ${flight.flight} (${formattedDate}) a las ${nowOk}`
    );
    console.log("");

    // h) Regresamos a la página de búsqueda para procesar el siguiente vuelo
    await page.goto(process.env.TIDY_SEARCHLOAD);
  }

  console.log(`Ciclo terminado a las ${now}`);
  await browser.close();
}

// Bucle que se repite cada 45 minutos
function startLDMScrapingLoop() {
  getLDMs();
  setInterval(() => {
    getLDMs();
  }, 45 * 60 * 1000);
}

// Iniciamos la función
startLDMScrapingLoop();
