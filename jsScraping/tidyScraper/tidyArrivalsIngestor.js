require("dotenv").config();
const puppeteer = require("puppeteer");
const mysql = require("mysql2/promise");

//process.env es un objeto global en Node.js que contiene todas las variables de entorno disponibles.
//todas las claves del archivo .env se asignan al objeto process.env.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

///Funcion principal. Entra a tidy
async function getTidyArrivals() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    ],
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();

    await page.goto(process.env.TIDY_LOGIN_URL);

    await page.type(
      'input[name="ctl00$body$txtUsername"]',
      process.env.TIDY_USERNAME
    );
    await page.type(
      'input[name="ctl00$body$txtPassword"]',
      process.env.TIDY_PASSWORD
    );

    await page.keyboard.press("Enter");

    // Esperamos a que aparezca el enlace "Transfer info"
    await page.waitForSelector(
      'a.AspNet-Menu-Link[href="/View/TransferInfo/ViewTransferInfo.aspx"]',
      { visible: true }
    );

    await page.click(
      'a.AspNet-Menu-Link[href="/View/TransferInfo/ViewTransferInfo.aspx"]'
    );

    // Esperamos a que aparezca el botón "View flights"
    await page.waitForSelector(
      "#ctl00_body_ucTransferInfoFilter_lnkBtnViewFlights",
      { visible: true }
    );

    await page.click("#ctl00_body_ucTransferInfoFilter_lnkBtnViewFlights");

    // Esperamos a que aparezca la tabla de vuelos
    try {
      await page.waitForSelector(".parentrow.toggleFlightDetails", {
        visible: true,
        timeout: 1000, // Tiempo de espera predeterminado de 1 segundo
      });
    } catch (error) {
      const now = new Date().toISOString();
      //TODO: Este es el mensaje predeterminado de la web que accedemos, sería deseable evitar hardcodearlo.
      console.log("No data was found for the specified search criteria");
      console.log(`at ${now}`);
      console.log();
      console.log("Error message:");
      console.log("*** " + error + " ***");
      console.log();
      console.log("Execution continues");
      return;
    }

    // Obtenemos la info de la tabla con page.evaluate()

    /*
    page.evaluate() es una función proporcionada por Puppeteer 
    que permite ejecutar código JavaScript dentro del contexto
    de la página cargada (el navegador controlado por Puppeteer), 
    y flights almacenará el resultado que devuelve esta función.


    */
    const flights = await page.evaluate(() => {
      //Selecciona todas las filas (<tr>) del DOM que tienen las clases parentrow y toggleFlightDetails
      //Ese selector nos identifica los vuelos que en tidy se representa como una fila de una tabla.
      const rows = document.querySelectorAll(".parentrow.toggleFlightDetails");
      //Array vacío donde irán nuestros vuelos, que a su vez será devuelto a flights.
      const results = [];

      rows.forEach((row) => {
        // Para cada fila seleccionada en "rows" (es decir row), obtenemos todas las celdas (<td>) contenidas dentro de esa fila.
        // Esto devuelve un NodeList que representa las celdas asociadas a una fila específica.
        // En este contexto:
        // - Una fila ("row") representa un vuelo.
        // - El conjunto completo de filas ("rows") es un NodeList que contiene todos los vuelos extraídos del DOM
        //   mediante `document.querySelectorAll(".parentrow.toggleFlightDetails")`.
        const cells = row.querySelectorAll("td");
        // "cells": NodeList que contiene todas las celdas (<td>) de la fila actual ("row"). Se presentan ejemplos de datos:

        const flight = cells[1].innerText.trim(); //AB123
        const dateStr = cells[2].innerText.trim(); //16/01/2025
        const from_origin = cells[3].innerText.trim(); //ABC
        const ac_reg = cells[4].innerText.trim(); //ABCDE
        const status = cells[5].innerText.trim(); //ABC

        const staStr = cells[6].innerText.trim(); //1234
        const etaStr = cells[7].innerText.trim(); //1234
        const ataStr = cells[8].innerText.trim(); //1234

        const stand = cells[9].innerText.trim(); //12
        const bag_transfer_status = cells[10].innerText.trim(); //AB

        // Parseamos la fecha "dd/mm/yyyy" a "yyyy-mm-dd 00:00:00"
        const [day, month, year] = dateStr.split("/");
        const dateSQL = `${year}-${month}-${day} 00:00:00`;

        // Para horas "HHMM" => "yyyy-mm-dd HH:MM:00" necesario para mantener la consistecia en la BDD.
        function parseTime(hhmm) {
          if (!hhmm) return null;
          const hh = hhmm.substring(0, 2);
          const mm = hhmm.substring(2, 4);
          return `${year}-${month}-${day} ${hh}:${mm}:00`;
        }

        const staSQL = parseTime(staStr);
        const etaSQL = parseTime(etaStr);
        const ataSQL = parseTime(ataStr);

        const transferInfo = []; //Array para la transfer info
        //La transfer info está, según la estructura del html, en la siguiente fila.
        const transferRow = row.nextElementSibling; //Si no existe, será null.
        if (
          transferRow.classList.contains("childrow") &&
          transferRow.classList.contains("hidden")
        ) {
          const transferTable = transferRow.querySelector("table");
          if (transferTable) {
            const outboundFlightRows =
              transferTable.querySelectorAll("tr.detailsrow"); //Agrupamos todas las filas con outbund flight
            for (const outboundFlightRow of outboundFlightRows) {
              const cells = outboundFlightRow.querySelectorAll("td");

              // Asignamos valores a variables con base en los encabezados
              const outboundFlight = cells[0].innerText.trim(); // Outbound flight
              const to = cells[1].innerText.trim(); // To
              const acReg = cells[2].innerText.trim(); // AC reg
              const status = cells[3].innerText.trim(); // Status
              const totalBags = cells[4].innerText.trim(); // Total bags
              const stdEtd = cells[5].innerText.trim(); // STD / ETD
              const estimatedConnectionTime = cells[6].innerText.trim(); // Estimated connection time
              const gate = cells[7].innerText.trim(); // Gate
              const stand = cells[8].innerText.trim(); // Stand

              //Metemos estos datos al array transferInfo[]
              transferInfo.push({
                outboundFlight,
                to,
                acReg,
                status,
                totalBags,
                stdEtd,
                estimatedConnectionTime,
                gate,
                stand,
              });
            }
          }
        }

        results.push({
          flight,
          date: dateSQL, // El nombre de la propiedad es "date", pero el valor viene de "dateSQL".
          from_origin,
          ac_reg,
          status,
          sta: staSQL,
          eta: etaSQL,
          ata: ataSQL,
          stand,
          bag_transfer_status,
          transferInfo,
        });
      });
      //Asignamos los resutados a flights[]
      return results;
    });

    //Fin de const flights = await page.evaluate(...)
    //Nota:  Node.js, los objetos anidados solo se muestran como [Object] cuando están dentro de un array.
    // A diferencia de hacer console.log("Vuelos extraídos:", flights);
    //tenemos que usar stringyfy(flights, null, 2). Null indica que no sobreescribimos el método de impresión,
    // y 2 es el número de espacios.
    console.log("Vuelos extraídos:", JSON.stringify(flights, null, 2));

    //Inserción / Actualización en la base de datos

    const sql = `
      INSERT INTO tidy_flight_arrivals
      (flight, date, from_origin, ac_reg, status, sta, eta, ata, stand, bag_transfer_status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        date = VALUES(date),
        from_origin = VALUES(from_origin),
        status = VALUES(status),
        eta = VALUES(eta),
        ata = VALUES(ata),
        stand = VALUES(stand),
        bag_transfer_status = VALUES(bag_transfer_status),
        updated_at = CURRENT_TIMESTAMP
    `;

    // Vamos insertando/actualizando cada vuelo en un bucle
    for (const flightData of flights) {
      const {
        flight,
        date,
        from_origin,
        ac_reg,
        status,
        sta,
        eta,
        ata,
        stand,
        bag_transfer_status,
      } = flightData;

      try {
        const [result] = await pool.execute(sql, [
          flight,
          date,
          from_origin,
          ac_reg,
          status,
          sta,
          eta,
          ata,
          stand,
          bag_transfer_status,
        ]);
        /*
  Este fragmento de código realiza un manejo detallado del resultado de una consulta
  SQL con la instrucción INSERT ... ON DUPLICATE KEY UPDATE utilizando MySQL2 en Node.js.

  A diferencia de JDBC en Java, MySQL2 en Node.js proporciona varios indicadores clave
  para analizar el resultado de la consulta:

  - `affectedRows`: Representa la cantidad de filas que se vieron afectadas por la consulta.
    Posibles valores:
      * `1`: Se insertó una nueva fila.
      * `2`: Una fila existente fue procesada (actualizada o no cambió, pero se evaluó).

  - `changedRows`: Indica cuántas filas sufrieron cambios efectivos tras la consulta.
    Posibles valores:
      * `0`: No se realizaron cambios efectivos; los valores ya eran idénticos.
      * `>0`: Hubo cambios efectivos en los datos.

  Estos valores combinados permiten determinar con precisión si una fila fue insertada,
  actualizada o si no sufrió cambios.
*/

        // Evaluamos los resultados de la consulta con la lógica anterior:
        if (result.affectedRows === 1) {
          console.log(
            `Vuelo ${flight} ${sta} insertado a las ${new Date().toISOString()}`
          );
        } else if (result.affectedRows === 2 && result.changedRows > 0) {
          console.log(
            `Vuelo ${flight} ${sta} actualizado a las ${new Date().toISOString()}`
          );
        } else if (result.affectedRows === 2 && result.changedRows === 0) {
          console.log(
            `Vuelo ${flight} ${sta} no sufrió cambios a las ${new Date().toISOString()}`
          );
        }
      } catch (err) {
        console.error(`Error al insertar/actualizar ${flight}:`, err);
      }
    }
  } catch (error) {
    console.error("Error durante el proceso de scraping:", error);
  } finally {
    // Cerramos el navegador tras cada iteración
    await browser.close();
  }
}

//Scraping cada 3 minutos

function startTidyArrivalsLoop() {
  // Ejecutamos la primera vez de inmediato
  getTidyArrivals();

  // Luego repetimos cada 3 minutos (180.000 ms)
  setInterval(() => {
    getTidyArrivals();
  }, 3 * 60 * 1000);
}

// 5) Iniciamos el bucle al ejecutar este script
startTidyArrivalsLoop();
