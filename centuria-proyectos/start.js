const CENTURIA_USER = "";
const CENTURIA_PASSWORD = "";
const ID_CONTROL_EJECUCION = "VRI-OGP-2";

const BUCKET_NAME = "dadv-automatizaciones";
const BASE_PATH = "dev-vri-ogp/layer-raw/presupuestos";

import { chromium } from 'playwright';
import { S3Client, PutObjectCommand} from '@aws-sdk/client-s3';

async function main() {

    const browser = await chromium.launch({"headless": false});
    const context = await browser.newContext()
    const page = await context.newPage();

    await page.goto("https://centuria.pucp.edu.pe/");
    var solPage = await login(context, page);

    while (await solPage.url() != "https://daf.pucp.edu.pe/psp/FIN91PRD/EMPLOYEE/ERP/h/?tab=DEFAULT") {

        const url = new URL(solPage.url());
        const errorCode = url.searchParams.get("errorCode");

        if (errorCode != null) {

            if (errorCode == "105") {

                throw new Error("ERROR: Usuario o contraseña incorrecta")

            } else if ( errorCode == "129" ) {

                solPage = await login(context, solPage);
 
            } else {

                throw new Error(`ERROR: Error desconocido - URL: ${solPage.url()}`)

            }
        }
    }

    try {

        await startReportGeneration(solPage);

    } catch (e) {

        console.log(e);
        const buffer = await solPage.screenshot();
        await uploadCenturiaErrorScreenshot(buffer);

    }

    await browser.close();

}

async function login(context, page) {

    await page.getByPlaceholder("Ingrese su usuario").fill(CENTURIA_USER);
    await page.getByPlaceholder("Ingrese su contraseña").fill(CENTURIA_PASSWORD);

    const [solPage] = await Promise.all([
        context.waitForEvent("page"),
        page.getByRole("button", {name: "Ingresar"}).click()
    ]);

    return solPage;

}


async function startReportGeneration(page) {

    await page.goto("https://daf.pucp.edu.pe/psc/FIN91PRD/EMPLOYEE/ERP/c/PUC_MENU_KK.PUC_RUN_PUCKK020.GBL");
    
    await page.getByRole("button", {name: "Buscar"}).click();
    await page.getByRole("link", {name: ID_CONTROL_EJECUCION}).click();

    const datetime = new Date();

    const date = datetime.toJSON().split("T")[0];
    const to_year = datetime.getFullYear() + 3;
    const from_year = datetime.getFullYear() - 1;

    await page.locator("//input[@id='PUC_RUN_KK020_BP_FROM']").fill(`${from_year}`);
    await page.locator("//input[@id='PUC_RUN_KK020_BP_TO']").fill(`${to_year}`);
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
