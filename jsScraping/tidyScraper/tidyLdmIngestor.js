require("dotenv").config();
const puppeteer = require("puppeteer");
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function getLDMs() {
  // Lanzamos el navegador con opciones
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    ],
    defaultViewport: null,
  });
  // Definir la query en una variable
  const query = `
  SELECT 
    unique_id, 
    flight_id, 
    schedule_time, 
    airline, 
    ac_reg, 
    dom_int, 
    arr_dep, 
    airport, 
    status, 
    status_code, 
    status_time
  FROM fullyscraped_combined_flights
  WHERE ldm_obtained = false;
`;

  // Usa la variable para ejecutar la consulta y crear un objeto a partir de ella.
  // En JavaScript, un objeto es una colección de pares clave-valor. Por consola se
  // imprimirá const [flights] (un array de objetos). Es más fácil de entender así.
  const [flights] = await pool.query(query);
  const now = new Date().toISOString();
  console.log("Query lanzada:", query);
  if (flights.length === 0) {
    console.error(`La query no arrojó resultados a las ${now}`);
    console.log("");
    console.log(`Ciclo terminado a las ${now}`);
    console.log("");
    await browser.close();
    return; //Salimos de la función hasta el siguiente intervalo.
  } else {
    console.log(`Array creado a las ${now}`);
    console.log(flights);
    console.log("");
  }

  // Creamos nueva pestaña. Para poder usar await dentro de una función en JavaScript, esa función debe estar declarada como async
  const page = await browser.newPage();
  // Navegamos a la página de login
  await page.goto(process.env.TIDY_LOGIN_URL);

  // Escribimos usuario y contraseña
  await page.type(
    'input[name="ctl00$body$txtUsername"]',
    process.env.TIDY_USERNAME
  );
  await page.type(
    'input[name="ctl00$body$txtPassword"]',
    process.env.TIDY_PASSWORD
  );

  // Pulsamos Enter para hacer login
  await page.keyboard.press("Enter");

  //navegamos a https://tidy.norwegian.no/View/Load/SearchLoads.aspx
  //Debemos esperar a que el elemento se cargue.
  await page.waitForSelector('a[href="/View/Load/SearchLoads.aspx"]', {
    visible: true,
  });
  await page.click('a[href="/View/Load/SearchLoads.aspx"]');

  /*
  
  Inicio del bucle. Antes un poco de teoría sobre objetos en JavaScript.
  Ejemplo nuestro array de objetos con dos vuelos fictcios:

 const flights = [
  { flight_id: "DY311", schedule_time: "2025-01-07T12:20:00.000Z" },
  { flight_id: "DY1261", schedule_time: "2025-01-07T14:10:00.000Z" },
   ];

  Si quisiéramos acceder al flight_id del primer vuelo  y guardarlo en la 
  varialble const flightId, haríamos: 

  const flightId = flights[0].flight_id;      >>>>      "DY311"

  El [0] se debe a que así seleccionamos el primer objeto del array, 
  y a partir de ahí seguimos con notación de punto.

  Conociendo la estructura de los arrays de objetos, podemos iterarlo
  con un ciclo for.

  for (const flight of flights) recorre cada elemento (objeto) del array 
  flights. flight representa el objeto de cada iteración, lo podríamos
  haber llamado de cualquier otra forma. (Por ejemplo, Aparicio.)

  En la primera ietración, el objeto flight sería:
  flight = { flight_id: "DY311", schedule_time: "2025-01-07T12:20:00.000Z" }
  
  */

  for (const flight of flights) {
    // 1. Procesar el número de vuelo
    // Slice corta los primeros dos caracteres porque en la web de Tidy solo
    // es necesario introducir el número de vuelo sin el carrier code (las dos letras).
    const flightNumber = flight.flight_id.slice(2);

    // 2. Formatear la fecha
    // Modificamos la fecha para que siga el formato requerido por Tidy (dd/mm/aaaa)
    const flightDate = new Date(flight.schedule_time); // Recuperamos y convertimos la fecha en un objeto Date
    const formattedDate = `${String(flightDate.getDate()).padStart(
      2,
      "0"
    )}/${String(flightDate.getMonth() + 1).padStart(
      2,
      "0"
    )}/${flightDate.getFullYear()}`; // Formateamos la fecha en el formato dd/mm/aaaa

    /*Se empieza a tecleear*/

    // Teclear el número de vuelo
    // Esperar a que el campo de texto para el número de vuelo esté disponible en la página
    await page.waitForSelector('input[name="ctl00$body$txtFlightNumber"]', {
      visible: true,
    });
    // Teclear el número procesado en el campo de entrada
    await page.type('input[name="ctl00$body$txtFlightNumber"]', "");
    await page.type('input[name="ctl00$body$txtFlightNumber"]', flightNumber);

    // 4. Teclear la fecha en el campo From Date
    // Esperar a que el campo "From Date" esté disponible en la página
    await page.waitForSelector('input[name="ctl00$body$calFromDate$textBox"]', {
      visible: true,
    });
    // Asegurarse de que el campo está enfocado
    await page.focus('input[name="ctl00$body$calFromDate$textBox"]');
    /* 
    
    La siguiente instrucciæon limpia el campo antes de escribir la nueva fecha con page.$eval.
    page.$eval ejecuta una función en el contexto del navegador para
    un único elemento del DOM que coincide con un selector. En este caso se
    usa para limpiar un campo input.

    En la función, input es solo un nombre descriptivo para indicar que
    representa el elemento HTML seleccionado *input[name="ctl00$body$calFromDate$textBox"]*,
    y la función lo establece a una cadena vacía. Sin usar funciones flecha esto se vería tal que:

          await page.$eval(
            'input[name="ctl00$body$calFromDate$textBox"]',
          function(elemento) {
            elemento.value = ""; 
             }
           );
     
     
     */

    await page.$eval(
      'input[name="ctl00$body$calFromDate$textBox"]',
      (input) => (input.value = "")
    );
    // Teclear la fecha formateada en el campo "From Date"
    await page.type(
      'input[name="ctl00$body$calFromDate$textBox"]',
      formattedDate
    );

    // 5. Teclear la fecha en el campo To Date
    // Esperar a que el campo "To Date" esté disponible en la página
    await page.waitForSelector('input[name="ctl00$body$calToDate$textBox"]', {
      visible: true,
    });
    // Asegurarse de que el campo está enfocado
    await page.focus('input[name="ctl00$body$calToDate$textBox"]');
    // Limpiar el campo antes de escribir la nueva fecha
    await page.$eval(
      'input[name="ctl00$body$calToDate$textBox"]',
      (input) => (input.value = "")
    );
    // Teclear la fecha formateada en el campo "To Date"
    await page.type(
      'input[name="ctl00$body$calToDate$textBox"]',
      formattedDate
    );
    // Esperar a que el botón de búsqueda "Search" esté disponible en la página
    await page.waitForSelector('input[name="ctl00$body$btnSearch"]', {
      visible: true,
    });

    // Hacer clic en el botón de búsqueda"Search"
    await page.click('input[name="ctl00$body$btnSearch"]');

    //**********TRY CATCH PORQUE EL BOTÓN VIEW PUEDE NO ESTAR******************

    try {
      await page.waitForSelector(
        "#ctl00_body_gridViewLoadMessages_ctl03_btnSelect",
        {
          visible: true,
          timeout: 1000, // 1 segundo
        }
      );
      console.log(
        // Detalle: sin backticks (``), no se pueden usar template literals para incrustar variables en una cadena.
        `#ctl00_body_gridViewLoadMessages_ctl03_btnSelect presente, asumimos que existe LDM para ${flight.flight_id} ${formattedDate} unique_id ${flight.unique_id}.`
      );
      console.log("");
    } catch (error) {
      const now = new Date();
      console.error(
        `#ctl00_body_gridViewLoadMessages_ctl03_btnSelect no encontrado. Se asume que no hay LDM para ${flight.flight_id} ${formattedDate} unique_id ${flight.unique_id} a las ${now}. Error message: `,
        error.message
      );
      console.log("");
      // Lógica alternativa si el botón no está presentenowButton
      nowButton = new Date();

      const ldmMessage = `LDM not available at the time of capture (${nowButton}) in https://tidy.norwegian.no/View/Load/SearchLoads.aspx`;
      await pool.query(
        `INSERT INTO ldm_data (
            unique_id, 
            flight_id, 
            ac_reg, 
            schedule_time, 
            status, 
            status_code, 
            status_time, 
            ldm_text, 
            ldm_obtained_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE 
            flight_id = VALUES(flight_id), 
            ac_reg = VALUES(ac_reg), 
            schedule_time = VALUES(schedule_time), 
            status = VALUES(status), 
            status_code = VALUES(status_code), 
            status_time = VALUES(status_time), 
            ldm_text = VALUES(ldm_text), 
            ldm_obtained_at = NOW()`,
        [
          flight.unique_id, // unique_id
          flight.flight_id || "N/A", // flight_id
          flight.ac_reg || "N/A", // ac_reg
          flight.schedule_time || "1970-01-01 00:00:00", // schedule_time
          flight.status || null, // status
          flight.status_code || "N/A", // status_code
          flight.status_time || "1970-01-01 00:00:00", // status_time
          ldmMessage, // ldm_text
        ]
      );

      //Volver al inicio para inroducir el siguiente vuelo.
      await page.goto("https://tidy.norwegian.no/View/Load/SearchLoads.aspx");
      // Para pasar al procesamiento del siguiente LDM.
      continue;
    }
    //Fin del try catch. A partir de aquí es la ejecución normal.

    // Hacer clic en el botón view. (Sintaxis más sencilla para seleccionar por ID)
    await page.click("#ctl00_body_gridViewLoadMessages_ctl03_btnSelect");

    //Ahora deberíamos estar en https://tidy.norwegian.no/View/Load/ViewLoadMessage.aspx

    // Capturar el texto del LDM
    await page.waitForSelector('textarea[name="ctl00$body$txtMessage"]', {
      visible: true,
    });
    const ldmMessage = await page.$eval(
      'textarea[name="ctl00$body$txtMessage"]',
      (textarea) => textarea.value
    );
    console.log(
      `LDM capturado para ${flight.flight_id} ${formattedDate} unique_id ${flight.unique_id} `
    );
    console.log(ldmMessage);
    console.log("");

    // Insertar el LDM en la base de datos
    await pool.query(
      `INSERT INTO ldm_data (
          unique_id, 
          flight_id, 
          ac_reg, 
          schedule_time, 
          status, 
          status_code, 
          status_time, 
          ldm_text, 
          ldm_obtained_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
          flight_id = VALUES(flight_id), 
          ac_reg = VALUES(ac_reg), 
          schedule_time = VALUES(schedule_time), 
          status = VALUES(status), 
          status_code = VALUES(status_code), 
          status_time = VALUES(status_time), 
          ldm_text = VALUES(ldm_text), 
          ldm_obtained_at = NOW()`,
      [
        flight.unique_id, // unique_id
        flight.flight_id || "N/A", // flight_id
        flight.ac_reg || "N/A", // ac_reg
        flight.schedule_time || "1970-01-01 00:00:00", // schedule_time
        flight.status || null, // status
        flight.status_code || "N/A", // status_code
        flight.status_time || "1970-01-01 00:00:00", // status_time
        ldmMessage, // ldm_text
      ]
    );
    const now = new Date().toISOString();
    console.log(
      `LDM almacenado para ${flight.flight_id} ${formattedDate} unique_id ${flight.unique_id} a las ${now}`
    );
    console.log("");

    // Actualizar el estado del vuelo en la base de datos
    await pool.query(
      `UPDATE fullyscraped_combined_flights SET ldm_obtained = true WHERE unique_id = ?`,
      [flight.unique_id]
    );
    console.log(
      `Marcando ldm_obtained a true para ${flight.flight_id} ${formattedDate} unique_id ${flight.unique_id} a las ${now}`
    );
    console.log("");

    console.log(`Iteración terminada a las ${now}`);
    console.log("");
    //Volver al inicio para inroducir el siguiente vuelo.

    await page.goto(process.env.TIDY_SEARCHLOAD);
  }
  console.log(`Ciclo terminado a las ${now}`);

  await browser.close();
}

/*Incio de ejecución*/
function startLDMScrapingLoop() {
  // Ejecutamos la primera vez de inmediato
  getLDMs();

  // Luego repetimos cada 3 minutos (180.000 ms)
  setInterval(() => {
    getLDMs();
  }, 3 * 60 * 1000);
}
//Iniciamos el bucle al ejecutar este script
startLDMScrapingLoop();
