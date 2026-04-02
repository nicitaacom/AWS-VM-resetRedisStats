"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const vm2_1 = __importDefault(require("vm2"));
const { VM } = vm2_1.default;
const ioredis_1 = require("ioredis");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
// Node related
const buffer_1 = require("buffer");
const url_1 = require("url");
const NEXT_PUBLIC_PRODUCTION_URL = "https://www.outreach-tool.com/";
const NEXT_PUBLIC_PRODUCTION_AUTH_URL = "https://auth.outreach-tool.com/";
const handler = async (event) => {
    if (!NEXT_PUBLIC_PRODUCTION_URL || !NEXT_PUBLIC_PRODUCTION_AUTH_URL) {
        return {
            statusCode: 400,
            error: 'NEXT_PUBLIC_PRODUCTION_URL or NEXT_PUBLIC_PRODUCTION_AUTH_URL missing',
        };
    }
    const response = await fetch(`${NEXT_PUBLIC_PRODUCTION_AUTH_URL}api/lambda/VM-resetRedisStats`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": NEXT_PUBLIC_PRODUCTION_URL, // Non-null assertion, validated above
        },
        cache: "no-cache", // Should be no cache to improve security
    });
    if (!response.ok) {
        const errorMessage = await response.text(); // Get the error message from the response body
        throw new Error(`Error ${response.status}: ${errorMessage || "Unknown error"}`);
    }
    const responseData = await response.json();
    const imports = { Redis: ioredis_1.Redis, moment: moment_timezone_1.default };
    const vm = new VM({
        timeout: 25000,
        sandbox: {
            process: {
                env: { ...process.env },
            },
            // Node related
            setTimeout,
            Buffer: buffer_1.Buffer,
            URLSearchParams: // required for twilio Authorization token
            url_1.URLSearchParams,
            fetch,
            event,
            imports
        },
    });
    try {
        // Make sure that responseData.code it's a index.js file that comes as a result of "tsc" command with "ESNext" in tsconfig.json
        const transformedCode = responseData.code
            // Remove the export handler function line, adjusting to potentially varying spaces
            .replace("export const handler = async (event) => {", '') // Remove handler definition line
            .replace(/\};\s*$/, ''); // 2. remove only the LAST `};` at end of string
        const wrappedCode = `  
    const { Redis, moment } = imports;

   (async () => {
          const response = await (async () => { 
            ${transformedCode} 
          })();
          return response
      })();
  `;
        // Execute the wrapped code in the VM
        const result = await vm.run(wrappedCode);
        if (result?.statusCode !== 200) {
            const cleanedError = (typeof result?.body === 'string' ? result.body : JSON.stringify(result ?? 'undefined result'))
                .replace(/\\n/g, "\n").replace(/\\/g, '');
            throw new Error(cleanedError);
        }
        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    }
    catch (error) {
        const errorMessage = error?.message || 'An unexpected error occurred';
        console.error(124, 'Error executing code in VM:', errorMessage);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to execute the code',
                details: errorMessage,
            }),
        };
    }
};
exports.handler = handler;
