require("dotenv").config();
const puppeteer = require("puppeteer");
const mysql = require("mysql2/promise");

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

  // 3. Consulta a la tabla movement_progress donde ldm_obtained = false
  const query = `
  SELECT
    flight,
    date,
    \`from\`,
    \`to\`
  FROM movement_progress
  WHERE ldm_obtained = false;
`;

  // 4. Ejecutamos la query
  const [flights] = await pool.query(query);
  const now = new Date().toISOString();
  console.log("Query lanzada:", query);

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

  //TODO: Modificar a partir de aquí
  for (const flight of flights) {
    /**
     * flight es un objeto con las propiedades:
     * - flight      (p.ej. "D83797")
     * - date        (objeto tipo DATE en MySQL, llega como string en JS)
     * - from        (aeropuerto origen, p.ej. "DWC")
     * - to          (aeropuerto destino, p.ej. "CPH")
     */

    // a) Ajustar número de vuelo. Tidy suele necesitar solo la parte numérica,
    //    asumiendo que las dos primeras letras son el "código" (como DY, D8, DI, etc.)
    const flightNumber = flight.flight.slice(2);

    // b) Formatear la fecha para Tidy (dd/mm/yyyy)
    //    flight.flight_date viene de la BD. Conviértelo a objeto Date en JS
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
    // Limpieza previa (por si Tidy deja rellenos antiguos)
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

      // Podemos dejar un mensaje de "no disponible" en ldm_text si lo deseas
      const notAvailableMessage = `No LDM available at ${nowNoBtn.toISOString()}.`;

      // Actualizamos la propia tabla para que no se intente nuevamente,

      console.log("Datos recibidos:", flight);
      console.log("Flight:", flight.flight);
      console.log("Date:", flight.date);

      await pool.query(
        `UPDATE ldm_data_csv
         SET ldm_text = ?, ldm_obtained = true
         WHERE flight_id = ? AND flight_date = ?`,
        [notAvailableMessage, flight.flight_id, flight.flight_date]
      );

      // Regresamos a la página principal de búsqueda para procesar el siguiente vuelo
      await page.goto(process.env.TIDY_SEARCHLOAD);
      continue; // Pasar al siguiente vuelo
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
    // Actualizar ldm_data_csv

    // Actualizar movement_progress
    await pool.query(
      `INSERT INTO ldm_data_csv (flight_id, flight_date, ldm_text, ldm_obtained)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE
         ldm_text = VALUES(ldm_text),
         ldm_obtained = VALUES(ldm_obtained)`,
      [flight.flight, flight.date, ldmMessage]
    );
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

  // Si llegamos aquí, terminamos el bucle de todos los vuelos
  console.log(`Ciclo terminado a las ${now}`);
  await browser.close();
}

// Bucle que se repite cada X minutos
function startLDMScrapingLoop() {
  // Primera ejecución inmediata
  getLDMs();

  // Posteriores ejecuciones cada 3 minutos (180.000 ms)
  setInterval(() => {
    getLDMs();
  }, 45 * 60 * 1000);
}

// Iniciamos la función
startLDMScrapingLoop();
