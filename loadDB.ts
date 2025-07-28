import "dotenv/config";
import OpenAI from "openai";
import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

const { OPENAI_API_KEY, ASTRA_DB_NAMESPACE, ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_API_ENDPOINT, ASTRA_DB_COLLECTION } = process.env;

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

const milanData = [
    "https://www.acmilan.com/en/club/history",
    "https://www.acmilan.com/en/club/palmares/all-the-trophies",
    "https://www.acmilan.com/en/club/casa-milan/casa-milan",
    "https://www.acmilan.com/en/club/venues/san-siro",
    "https://www.acmilan.com/en/club/venues/san-siro/how-to-reach",
    "https://www.acmilan.com/en/club/venues/san-siro/regulations",
    "https://www.acmilan.com/en/club/palmares/2007-fifa-club-world-cup",
    "https://www.acmilan.com/en/club/palmares/uefa-champions-league",
    "https://www.acmilan.com/en/club/the-club",
    "https://www.acmilan.com/en/club/the-club/anti-racism-guidelines",
    "https://www.acmilan.com/en/club/management",
    "https://www.acmilan.com/en/club/sponsor",
    "https://www.acmilan.com/en/club/casa-milan/casa-milan",
    "https://www.acmilan.com/en/academy/milan-academy/all-the-milan-academies",
    "https://www.acmilan.com/en/season/active/schedule/all",
    "https://en.wikipedia.org/wiki/AC_Milan"
]

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
})

const astraDBClient = new DataAPIClient()

if (!ASTRA_DB_API_ENDPOINT) {
    throw new Error("ASTRA_DB_API_ENDPOINT is not set in environment variables.");
  }

const database = astraDBClient.db(ASTRA_DB_API_ENDPOINT, { token: ASTRA_DB_APPLICATION_TOKEN, namespace: ASTRA_DB_NAMESPACE, keyspace: "milan_casa" })

const createCollection = async (similarityMetric: SimilarityMetric = "dot_product") => {
    const collection = await database.createCollection(ASTRA_DB_COLLECTION ?? "", {
        vector: {
            dimension: 1536,
            metric: similarityMetric,
        }
    })
    console.log('collection', collection)
}

const loadData = async () => {
    const collection = await database.collection(ASTRA_DB_COLLECTION ?? "")
    for await (const doc of milanData) {
        const content = await scrapeData(doc)
        const chunks = await splitter.splitText(content);
        for await (const chunk of chunks) {
            const embedding = await openai.embeddings.create({
                model: "text-embedding-3-small",
                dimensions: 1536,
                input: chunk,
                encoding_format: "float"
            })

            const res = await collection.insertOne({
                $vector: embedding.data[0].embedding,
                text: chunk
            })
            console.log(res)
        }
    }
}

const scrapeData = async (url: string) => {
    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: {
            headless: true
        },
        gotoOptions: {
            waitUntil: "domcontentloaded"
        },
        evaluate: async (page, browser) => {
            const result = await page.evaluate(() => document.body.innerHTML)
            await browser.close()
            return result
        }
    })
    return (await loader.scrape())?.replace(/<[^>]*>?/gm, "")
}

createCollection().then(() => loadData())
