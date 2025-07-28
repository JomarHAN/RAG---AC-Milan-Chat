var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import "dotenv/config";
import OpenAI from "openai";
import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
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
];
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
});
const astraDBClient = new DataAPIClient();
if (!ASTRA_DB_API_ENDPOINT) {
    throw new Error("ASTRA_DB_API_ENDPOINT is not set in environment variables.");
}
const database = astraDBClient.db(ASTRA_DB_API_ENDPOINT, { token: ASTRA_DB_APPLICATION_TOKEN, namespace: ASTRA_DB_NAMESPACE, keyspace: "milan_casa" });
const createCollection = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (similarityMetric = "dot_product") {
    const collection = yield database.createCollection(ASTRA_DB_COLLECTION !== null && ASTRA_DB_COLLECTION !== void 0 ? ASTRA_DB_COLLECTION : "", {
        vector: {
            dimension: 1536,
            metric: similarityMetric,
        }
    });
    console.log('collection', collection);
});
const loadData = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c, _d, e_2, _e, _f;
    const collection = yield database.collection(ASTRA_DB_COLLECTION !== null && ASTRA_DB_COLLECTION !== void 0 ? ASTRA_DB_COLLECTION : "");
    try {
        for (var _g = true, milanData_1 = __asyncValues(milanData), milanData_1_1; milanData_1_1 = yield milanData_1.next(), _a = milanData_1_1.done, !_a; _g = true) {
            _c = milanData_1_1.value;
            _g = false;
            const doc = _c;
            const content = yield scrapeData(doc);
            const chunks = yield splitter.splitText(content);
            try {
                for (var _h = true, chunks_1 = (e_2 = void 0, __asyncValues(chunks)), chunks_1_1; chunks_1_1 = yield chunks_1.next(), _d = chunks_1_1.done, !_d; _h = true) {
                    _f = chunks_1_1.value;
                    _h = false;
                    const chunk = _f;
                    const embedding = yield openai.embeddings.create({
                        model: "text-embedding-3-small",
                        dimensions: 1536,
                        input: chunk,
                        encoding_format: "float"
                    });
                    const res = yield collection.insertOne({
                        $vector: embedding.data[0].embedding,
                        text: chunk
                    });
                    console.log(res);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_h && !_d && (_e = chunks_1.return)) yield _e.call(chunks_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_g && !_a && (_b = milanData_1.return)) yield _b.call(milanData_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
});
const scrapeData = (url) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: {
            headless: true
        },
        gotoOptions: {
            waitUntil: "domcontentloaded"
        },
        evaluate: (page, browser) => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield page.evaluate(() => document.body.innerHTML);
            yield browser.close();
            return result;
        })
    });
    return (_a = (yield loader.scrape())) === null || _a === void 0 ? void 0 : _a.replace(/<[^>]*>?/gm, "");
});
createCollection().then(() => loadData());
