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
    De no usar page.evaluate(), no podemos "traer" al contexto de Node
    la información recolectada y guardarla en const flights.



    */
    const flights = await page.evaluate(() => {
      //Selecciona todas las filas (<tr>) del DOM que tienen las clases parentrow y toggleFlightDetails
      //Ese selector nos identifica los vuelos que en tidy se representa como una fila de una tabla.
      const rows = document.querySelectorAll(".parentrow.toggleFlightDetails");
      //Array vacío donde irán nuestros vuelos, que a su vez será devuelto a flights dentro del contexto de Node.js. (Es la gracia de Node)
      const arrivalFlightsArray = [];

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

        arrivalFlightsArray.push({
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
      return arrivalFlightsArray;
    });

    //Fin de const flights = await page.evaluate(...)
    //Nota:  En Node.js, los objetos anidados se muestran como [Object] cuando están dentro de un array.
    // A diferencia de hacer console.log("Vuelos extraídos:", flights),
    //tenemos que usar stringyfy(flights, null, 2). Null indica que no sobreescribimos el método de impresión,
    // y 2 es el número de espacios. También elimino las comillas que mete stringyfy.
    console.log(
      "Vuelos extraídos:",
      JSON.stringify(flights, null, 2).replace(/"/g, "")
    );

    //Inserción / Actualización en la base de datos

    //TRANSACCIÓN

    // Obtener conexión e iniciar transacción
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // INSERT para arrivals
      const sqlArrivals = `
        INSERT INTO tidy_flight_arrivals
        (
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
          updated_at
        )
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

      // INSERT para transfer info
      const insertTransferSQL = `
        INSERT INTO tidy_transfer_info_arrivals
        (
          outbound_flight,
          \`to\`,
          ac_reg,
          status,
          total_bags,
          std_etd,
          estimated_connection_time,
          gate,
          stand,
          inbound_flight,
          inbound_ac_reg,
          inbound_sta
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          ac_reg = VALUES(ac_reg),
          status = VALUES(status),
          total_bags = VALUES(total_bags),
          std_etd = VALUES(std_etd),
          estimated_connection_time = VALUES(estimated_connection_time),
          gate = VALUES(gate),
          stand = VALUES(stand)
      `;

      // Función auxiliar para stdEtd "HHMM" -> "HH:MM:00", manteniendo el formato de la web. Hay motivos para no reutilizar parseTime().
      //TODO: Investigar cómo implementar fecha, ya que la web nos fuerza a asumir misma la misma fecha que el inbound flight.
      //TODO: Una mala gestión de la fecha tendría implicaciones para vuelos con transfers para el día siguiente (llegadas tardías).
      function parseStdEtd(stdEtd) {
        if (!stdEtd || stdEtd.length < 3) {
          return "00:00:00";
        }
        const hh = stdEtd.substring(0, 2);
        const mm = stdEtd.substring(2, 4);
        return `${hh}:${mm}:00`;
      }

      // Insertar/actualizar en tidy_flight_arrivals
      for (const f of flights) {
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
        } = f;
        // Guardamos el resultado en una variable para evaluar cambios y loguearlos.
        const [resultArrivals] = await connection.execute(sqlArrivals, [
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
    actualizada o si no sufrió cambios. Se usará la misma lógica para evaluar cambios en la información de transfer.
  */

        // Logs:
        if (resultArrivals.affectedRows === 1) {
          console.log(`Vuelo ${flight} STA ${sta} insertado.`);
        } else if (
          resultArrivals.affectedRows === 2 &&
          resultArrivals.changedRows > 0
        ) {
          console.log(`Vuelo ${flight} STA ${sta} actualizado.`);
        } else if (
          resultArrivals.affectedRows === 2 &&
          resultArrivals.changedRows === 0
        ) {
          console.log(`Vuelo ${flight} STA ${sta} sin cambios.`);
        }
      }

      // Insertar/actualizar en tidy_transfer_info_arrivals
      for (const f of flights) {
        // Iteramos sobre cada fila de transfer (t) dentro del array transferInfo del vuelo actual (f)
        for (const t of f.transferInfo) {
          const stdEtdSql = parseStdEtd(t.stdEtd);
          // t.totalBags, 10 indica que debe interpretar el string como un número en base 10. En caso de errores, devolvemos cero.
          // TODO: Investigar las implicaciones de devolver 0 por defecto. Valorar si es mejor devolver null.
          const totalBags = parseInt(t.totalBags, 10) || 0;

          // Guardamos el resultado en una variable para evaluar cambios y loguearlos
          const [resultTransfer] = await connection.execute(insertTransferSQL, [
            t.outboundFlight, // outbound_flight
            t.to, // `to`
            t.acReg, // ac_reg
            t.status, // status
            totalBags, // total_bags
            stdEtdSql, // std_etd
            t.estimatedConnectionTime, // estimated_connection_time
            t.gate, // gate
            t.stand, // stand

            // FKs
            f.flight, // inbound_flight
            f.ac_reg, // inbound_ac_reg
            f.sta, // inbound_sta
          ]);

          console.log("Valores a insertar:", {
            outbound_flight: t.outboundFlight,
            inbound_flight: f.flight,
            inbound_ac_reg: f.ac_reg,
            inbound_sta: f.sta,
          });
          console.log("Resultados de la consulta transfers:", {
            affectedRows: resultTransfer.affectedRows,
            changedRows: resultTransfer.changedRows,
            insertId: resultTransfer.insertId, // Debugging
          });

          // Lógica de manejo corregida (NUEVOS COMENTARIOS)
          // 1. Si hay insertId > 0: Es una inserción nueva
          // 2. Si no hay insertId pero changedRows > 0: Actualización con cambios
          // 3. Si no hay insertId y changedRows = 0: Actualización sin cambios
          if (resultTransfer.insertId) {
            // Registro nuevo insertado (auto-increment)
            console.log(
              `Transfer insertado: Inbound ${f.flight} con ${t.totalBags} maletas >>> Outbound: ${t.outboundFlight}.`
            );
          } else {
            if (resultTransfer.changedRows > 0) {
              // Registro existente actualizado con cambios
              console.log(
                `Transfer actualizado: Inbound ${f.flight}, con ${t.totalBags} maletas >>> Outbound: ${t.outboundFlight}.`
              );
            } else {
              // Registro existente sin cambios
              console.log(
                `Transfer sin cambios: Inbound ${f.flight}, con ${t.totalBags} maletas >>> Outbound: ${t.outboundFlight}.`
              );
            }
          }
        }
      }

      // Si todo salió bien, comiteamos la transacción. Debería eliminar el err.1452.
      await connection.commit();
      const now = new Date().toISOString();
      console.log("");
      console.log(`Transacción completada a las ${now}`);
    } catch (transError) {
      // Si algo sale mal dentro de la transacción, rollback
      await connection.rollback();
      console.error("Error en la transacción, rollback:", transError.message);
    } finally {
      // Liberamos la conexión
      connection.release();
    }

    // FIN DE LA TRANSACCIÓN.
  } catch (error) {
    console.error("Error durante el proceso de scraping:", error);
  } finally {
    // Cerramos el navegador
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
