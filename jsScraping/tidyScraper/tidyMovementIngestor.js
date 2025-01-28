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

async function getMovements() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      `--download.default_directory=${downloadPath}`, // Especifica la carpeta de descargas definida arriba.
    ],
    defaultViewport: null,
  });

  // Creamos nueva pestaña. Para poder usar await dentro de una función en JavaScript, esa función debe estar declarada como async
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
  console.log("Movements page takes a while to load... Please wait.");

  await page.click(
    'li.AspNet-Menu-Leaf > a.AspNet-Menu-Link[href="/View/Admin/Statistics/MovementProgress.aspx"]'
  );

  console.log("Movements page takes a while to load... Please wait.2222222");

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

  // Esperar a que la descarga se complete, puede prolongarse mucho. De manera que pordriamos considerar 
  // la descarga finalizada cuando MovementProgressExport.csv se encuentre. Este script lo 
  //recorrera mas adelante y lo eliminara cuando acabe, de manera que siempre habra un MovementProgressExport.csv
  // nuevo en cada ejecucion.
  await new Promise((resolve) => setTimeout(resolve, 5000)); 

  // Verificar si el archivo se descargó correctamente, la descarga puede ser muy lenta
  const files = fs.readdirSync(downloadPath);
  const csvFile = files.find((file) => file.endsWith(".csv"));
  if (csvFile) {
    const oldPath = path.join(downloadPath, csvFile);
    const newPath = path.join(downloadPath, "movements.csv");

    // No es necesario renombrar el archivo descargado
    fs.renameSync(oldPath, newPath);
    console.log(`Archivo descargado y guardado como: ${newPath}`);
  } else {
    console.log(
      "No se encontró ningún archivo CSV en la carpeta de descargas."
    );
  }
}
//await browser.close();

getMovements();
