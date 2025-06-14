const CENTURIA_USER = "";
const CENTURIA_PASSWORD = "";
const ID_CONTROL_EJECUCION = "VRI-OGP-2";

const BUCKET_NAME = "dadv-automatizaciones";
const BASE_PATH = "dev-vri-ogp/layer-raw/presupuestos";

import { chromium }  from 'playwright';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"; 

async function main() {

    const browser = await chromium.launch({"headless": false});
    const context = await browser.newContext()
    const page = await context.newPage();

    await page.goto("https://centuria.pucp.edu.pe/");
    await login(page);


    while (await page.url() != "https://daf.pucp.edu.pe/psp/FIN91PRD/EMPLOYEE/ERP/h/?tab=DEFAULT") {

        if (await page.url() == "https://centuria.pucp.edu.pe/php/proxy-centuria.php") {

            console.log("it's special");

            await page.goto("https://centuria.pucp.edu.pe/");

            await login(page);

        }

        const url = new URL(page.url());
        const errorCode = url.searchParams.get("errorCode");

        if (errorCode != null) {

            if (errorCode == "105") {

                throw new Error("ERROR: Usuario o contraseña incorrecta")

            } else if ( errorCode == "129") {

                await login(page);

            } else {

                throw new Error(`ERROR: Error desconocido - URL: ${page.url()}`)

            }
        }
    
    }

    try {

        await downloadReport(page);

    } catch (e) {

        console.log(e);
        const buffer = await page.screenshot();
        await uploadCenturiaErrorScreenshot(buffer);

    }

    await browser.close();

}





async function login(page) {

    await page.locator("//div[@class='selected']").click();
    await page.locator("//ul//span[text()='Centuria Finanzas']").click();
    await page.locator("//input[@id='userid']").fill(CENTURIA_USER);
    await page.locator("//input[@id='pwd']").fill(CENTURIA_PASSWORD);
    await page.getByRole("button", {name: "Ingresar"}).click();

}


async function downloadReport(page) {


    await page.goto("https://daf.pucp.edu.pe/psc/FIN91PRD/EMPLOYEE/ERP/c/PUC_MENU_KK.PUC_RUN_PUCKK020.GBL");
    await page.getByRole("button", {name: "Buscar"}).click();
    await page.getByRole("link", {name: ID_CONTROL_EJECUCION}).click();

    await page.getByRole("link", {name: "Monitor Procesos"}).click();

    const datetime = new Date();

    const date1 = datetime.toJSON().split("T")[0]

    const day = datetime.getDate();
    const month = datetime.getMonth() + 1;
    const year = datetime.getFullYear();

    const date2 = `${day}/${month}/${year}`;

    await page.locator("//input[@id='PMN_FILTER_WRK_FROM_DT']").fill(date2);
    await page.getByRole("button", {name: "Actualizar"}).click();

    const instance_id = await getCenturiaReportInstanceID(date1);

    await page.locator(`//span[text()='${instance_id}']/parent::div/parent::td/parent::tr/td[last()]//a`).click();
    await page.getByRole("link", {name: "Registro/Rastreo"}).click();

    const downloadPromise = page.waitForEvent("download");
    await page.locator("//a[@id='URL$1']").click();
    const download = await downloadPromise;

    //bytes
    const readable = await download.createReadStream();
    
    readable.on("data", async (chunk) => {

        await uploadCenturiaFile(chunk)

    })
    
}

async function uploadCenturiaFile(chunk) {

    const datetime = new Date();
    const date = datetime.toJSON().split("T")[0];

    const s3Client = new S3Client({});

    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `${BASE_PATH}/${date}/${date}.xlsx`,
            Body: chunk
        })
    )
}

async function uploadCenturiaErrorScreenshot(data) {

    const datetime = new Date();
    const date = datetime.toJSON().split("T")[0];

    const s3Client = new S3Client({});

    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `${BASE_PATH}/${date}/error-download.png`,
            Body: data
        })
    )

}

async function getCenturiaReportInstanceID(date) {

    const s3Client = new S3Client({});

    const response = await s3Client.send(
        new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: `${BASE_PATH}/${date}`
        })
    )

    const objects = response["Contents"];

    if (objects == undefined) {

        throw Error(`No hay ningún archivo en la ruta ${date}`)

    }

    let instance_id;
    for (let i = 0; i < objects.length; i++) {

        const segments = objects[i]["Key"].split("/");
        const extension = segments[segments.length - 1].split(".")[1];

        if (extension == "txt") {

            instance_id = segments[segments.length - 1].split(".")[0];

            break;

        } else if ( i + 1 == objects.length ) {

            throw new Error(`ERROR: No se encuentra el ID de la instancia del reporte generado en la carpeta ${date}`);

        }
    }

    console.log(instance_id);
    return instance_id;

}


await main().catch(console.error);
