var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
// Optional, but recommended: run on the edge runtime.
// See https://vercel.com/docs/concepts/functions/edge-functions
export const runtime = 'edge';
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
export function POST(req) {
    return __awaiter(this, void 0, void 0, function* () {
        // Extract the `messages` from the body of the request
        const { messages } = yield req.json();
        // Request the OpenAI API for the response based on the prompt
        const response = yield openai.chat.completions.create({
            model: 'gpt-4.1',
            stream: true,
            messages: messages,
        });
        // Convert the response into a friendly text-stream
        const stream = OpenAIStream(response);
        // Respond with the stream
        return new StreamingTextResponse(stream);
    });
}
