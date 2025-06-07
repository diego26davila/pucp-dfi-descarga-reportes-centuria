const CENTURIA_USER = "";
const CENTURIA_PASSWORD = "";
const ID_CONTROL_EJECUCION = "VRI-OGP";

const BUCKET_NAME = "dadv-automatizaciones";
const BASE_PATH = "dev-vri-ogp/layer-raw/solicitudes";

import { chromium } from 'playwright';
import { S3Client, PutObjectCommand} from '@aws-sdk/client-s3';

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

        await startReportGeneration(page);

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


async function startReportGeneration(page) {

    await page.goto("https://daf.pucp.edu.pe/psc/FIN91PRD/EMPLOYEE/ERP/c/PUC_MENU_PO.PUC_RUN_PUCPO006.GBL");
    await page.getByRole("button", {name: "Buscar"}).click();
    await page.getByRole("link", {name: ID_CONTROL_EJECUCION}).click();

    const datetime = new Date();

    const date = datetime.toJSON().split("T")[0]
    const year = datetime.getFullYear();

    await page.locator("//input[@id='PUC_RUN_PO006_REQ_DT_FROM']").fill(`01/01/${year}`);
    await page.locator("//input[@id='PUC_RUN_PO006_REQ_DT_TO']").fill(`31/12/${year}`);
    await page.getByRole("button", {name: "Ejec"}).click();
    await page.getByRole("button", {name: "Aceptar"}).click();

    const instance_id = await page.locator("//span[@id='PRCSRQSTDLG_WRK_DESCR100']").textContent();
    console.log(instance_id);
    
    const id = instance_id.split(":")[1];

    await createIDFile(id, date);

}

async function createIDFile(instance_id, date) {

    const s3Client = new S3Client({});

    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `${BASE_PATH}/${date}/${instance_id}.txt`,
            Body: "Hola soy Diego"
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
            Key: `${BASE_PATH}/${date}/error-generate.png`,
            Body: data
        })
    )

}

main().catch(console.error);
