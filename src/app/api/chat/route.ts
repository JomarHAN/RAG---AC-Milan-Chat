import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { DataAPIClient } from '@datastax/astra-db-ts';

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPENAI_API_KEY,
  } = process.env;

// Optional, but recommended: run on the edge runtime.
// See https://vercel.com/docs/concepts/functions/edge-functions
export const runtime = 'edge';

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY!,
});

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, {
    namespace: ASTRA_DB_NAMESPACE,
    keyspace: "milan_casa"
})

export async function POST(req: Request) {
    // Extract the `messages` from the body of the request
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1]?.content

    let docContext = ""

    const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        dimensions: 1536,
        input: lastMessage,
        encoding_format: "float"
    })

    try{
        const collection = await db.collection(ASTRA_DB_COLLECTION)
        const cursor = collection.find(null,{
            sort:{
                $vector: embedding.data[0].embedding
            },
            limit: 10
        })
        const documents = await cursor.toArray();
        const docsMap = documents.map((doc)=>doc.text)
        docContext = JSON.stringify(docsMap)
    }catch(error){
        console.error("Error fetching documents from Astra DB:", error)
    }

    const template = {
        role: "system",
        content: `
              You are a helpful assistant that can answer questions about the AC Milan.
              Use the following context to answer the question.
              The context will provide you with the most recent information about the AC Milan from wikipedia and acmilan.com.
              If the context doesn't include the information you need to answer based on your existing knowledge, and don't mention the source of your information or what context you used to answer the question.
              Format response using markdown where applicable.
              -----------------
              START CONTEXT
              ${docContext}
              END CONTEXT
              -----------------
              START QUESTION
              ${lastMessage}
              END QUESTION
              `,
      };
  
    

    // Request the OpenAI API for the response based on the prompt
    const response = await openai.chat.completions.create({
        model: 'gpt-4.1',
        stream: true,
        messages: [template, ...messages],
    });

    // Convert the response into a friendly text-stream
    const stream = OpenAIStream(response as any);

    // Respond with the stream
    return new StreamingTextResponse(stream);
}