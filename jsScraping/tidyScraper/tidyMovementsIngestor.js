require("dotenv").config();
const puppeteer = require("puppeteer");
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");

// Ruta de descargas
const downloadPath = path.resolve(__dirname, "csv");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function clearDownloadFolder(downloadPath) {
  if (fs.existsSync(downloadPath)) {
    // Leer todos los archivos en la carpeta
    const files = fs.readdirSync(downloadPath);

    // Eliminar cada archivo
    for (const file of files) {
      const filePath = path.join(downloadPath, file);
      fs.unlinkSync(filePath); // Eliminar el archivo
      const newPath = path.join(downloadPath, "movements.csv");
      console.log(`Archivo eliminado: ${path.relative(__dirname, newPath)}`);
    }
    console.log("Carpeta de descargas limpiada correctamente.");
  } else {
    console.log("La carpeta de descargas no existe.");
  }
}

async function waitForFileDownload(downloadPath, fileName, timeout = 120000) {
  const startTime = Date.now();
  const filePath = path.join(downloadPath, fileName);

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      // Verificar si el archivo existe
      if (fs.existsSync(filePath)) {
        clearInterval(interval);
        resolve();
      }

      // Si se excede el tiempo de espera, rechazar la promesa
      if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(
          new Error("Tiempo de espera excedido para la descarga del archivo.")
        );
      }
    }, 1000); // Verificar cada segundo
  });
}
// Para horas "HHMM" => "yyyy-mm-dd HH:MM:00" necesario para mantener la consistecia en la BDD.
function parseTime(hhmm) {
  if (!hhmm) return null;
  const hh = hhmm.substring(0, 2);
  const mm = hhmm.substring(2, 4);
  return `${hh}:${mm}:00`;
}
function parseInteger(value) {
  if (value === undefined || value === null || value.trim() === "") {
    return null;
  }
  const parsedValue = parseInt(value, 10);
  return isNaN(parsedValue) ? null : parsedValue;
}

async function processCSVAndInsertIntoDatabase(filePath) {
  const data = fs.readFileSync(filePath, "utf8");
  const rows = data.split("\n").filter((row) => row.trim() !== "");
  // Ignoramos la primera fila (cabecera)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].split(";").map((cell) => cell.trim());

    const values = [
      row[0], // flight
      row[1], // date (YYYY-MM-DD)
      row[2], // from
      row[3], // to
      row[4], // ac_reg
      parseTime(row[5]), // std
      parseTime(row[6]), // atd
      parseTime(row[7]), // sta
      parseTime(row[8]), // ata
      parseTime(row[9]), // toff
      parseTime(row[10]), // tdwn
      parseInt(row[11]) || null, // atd_offset
      parseInt(row[12]) || null, // ata_offset
      parseInt(row[13]) || null, // blk_offset
      parseInt(row[14]) || null, // taxi_toff
      parseInt(row[15]) || null, // taxi_ata
      row[16] || "", // delay_codes
      row[17] || "", // cnl
    ];

    // IMPORTANTE: Usamos await.
    await pool.query(
      `
      INSERT INTO movement_progress (
        flight,
        date,
        \`from\`,
        \`to\`,
        ac_reg,
        std,
        atd,
        sta,
        ata,
        toff,
        tdwn,
        atd_offset,
        ata_offset,
        blk_offset,
        taxi_toff,
        taxi_ata,
        delay_codes,
        cnl
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        std         = VALUES(std),
        atd         = VALUES(atd),
        sta         = VALUES(sta),
        ata         = VALUES(ata),
        toff        = VALUES(toff),
        tdwn        = VALUES(tdwn),
        atd_offset  = VALUES(atd_offset),
        ata_offset  = VALUES(ata_offset),
        blk_offset  = VALUES(blk_offset),
        taxi_toff   = VALUES(taxi_toff),
        taxi_ata    = VALUES(taxi_ata),
        delay_codes = VALUES(delay_codes),
        cnl         = VALUES(cnl)
      `,
      values
    );
    let now = new Date().toISOString();
    console.log(`Fila ${i} insertada a las ${now}`);
  }
  now = new Date().toISOString();
  console.log(
    `Movimientos insertados en flights.movement_progress a las ${now}`
  );
}

async function getMovements() {
  // Ruta de descargas
  const downloadPath = path.resolve(__dirname, "csv");

  // Limpiar la carpeta de descargas antes de iniciar
  clearDownloadFolder(downloadPath);

  // Configuración de Puppeteer y MySQL (código anterior)
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      `--download.default_directory=${downloadPath}`,
    ],
    defaultViewport: null,
  });

  const page = await browser.newPage();

  // Establecer carpeta de descargas con DevTools
  const client = await page.target().createCDPSession();
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadPath,
  });

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

  // Esperamos a que el enlace esté disponible y hacemos clic
  await page.waitForSelector(
    'li.AspNet-Menu-Leaf > a.AspNet-Menu-Link[href="/View/Admin/Statistics/MovementProgress.aspx"]',
    { visible: true }
  );
  console.log("Entrando a página de movimientos...");
  await page.click(
    'li.AspNet-Menu-Leaf > a.AspNet-Menu-Link[href="/View/Admin/Statistics/MovementProgress.aspx"]'
  );

  //console.log("Entrando a página de movimientos...");

  // Esperamos a que el botón "Export" esté presente y visible
  await page.waitForSelector(
    'input[type="submit"][id="ctl00_body_btnExport"]',
    {
      visible: true,
    }
  );

  // Hacemos clic en el botón "Export", debería descargar un archivo .csv
  await page.click('input[type="submit"][id="ctl00_body_btnExport"]');
  console.log("Descargando el archivo CSV...");

  // Esperar a que el archivo se descargue
  try {
    await waitForFileDownload(downloadPath, "MovementProgressExport.csv");
    console.log("Archivo CSV descargado correctamente.");
  } catch (error) {
    console.error("Error al descargar el archivo CSV:", error.message);
    return; // Detener la ejecución si la descarga falla
  }

  // Verificar si el archivo se descargó correctamente
  const files = fs.readdirSync(downloadPath);
  const csvFile = files.find((file) => file.endsWith(".csv"));
  if (csvFile) {
    const oldPath = path.join(downloadPath, csvFile);
    const newPath = path.join(downloadPath, "movements.csv");

    // Renombrar el archivo descargado.
    fs.renameSync(oldPath, newPath);
    console.log(
      `Archivo descargado y guardado como: ${path.relative(__dirname, newPath)}`
    );
  } else {
    console.log(
      "No se encontró ningún archivo CSV en la carpeta de descargas."
    );
  }

  // Cerrar el navegador
  await browser.close();

  // Llamada a processCSVAndInsertIntoDatabase
  const csvFilePath = path.resolve(__dirname, "csv", "movements.csv");
  await processCSVAndInsertIntoDatabase(csvFilePath);
}

/*Incio de ejecución*/
function startMovementsScrapingLoop() {
  // Ejecutamos la primera vez de inmediato
  getMovements();

  // Luego repetimos cada 10 minutos (600.000 ms)
  setInterval(async () => {
    getMovements();
  }, 10 * 60 * 1000);
}

startMovementsScrapingLoop();
