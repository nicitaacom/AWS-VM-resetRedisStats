import VMModule from 'vm2';
const { VM } = VMModule;


import { Redis } from "ioredis";
import moment from "moment-timezone"

// Node related
import { Buffer } from "buffer"
import { URLSearchParams } from "url"


// For freeEmailDomains - so I fetch from entiryRedis envs by correct userId (if sent from gmail cuz user.email domain might be ukr.net not only gmail.com)
import { readFileSync } from "fs"
import path from "path"


const NEXT_PUBLIC_PRODUCTION_URL = "https://www.outreach-tool.com/"
const NEXT_PUBLIC_PRODUCTION_AUTH_URL = "https://auth.outreach-tool.com/"


export const handler = async (event: Event) => {

  if (!NEXT_PUBLIC_PRODUCTION_URL || !NEXT_PUBLIC_PRODUCTION_AUTH_URL) {
   return {
    statusCode: 400,
    error: 'NEXT_PUBLIC_PRODUCTION_URL or NEXT_PUBLIC_PRODUCTION_AUTH_URL missing',
  } 
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


  // 📁 Works because CommonJS has __dirname by default
  const filePath = path.join(__dirname, "freeEmailList.txt")

  const freeEmailDomains = readFileSync(filePath, "utf-8")
    .split("\n")
    .map(domain => domain.trim().toLowerCase())
    .filter(Boolean) // remove empty lines


const imports = { Redis, moment, freeEmailDomains }
  
const vm = new VM({
  timeout: 25000, // 25 seconds to prevent Lambda timeout
  sandbox: {
    process: {
      env: { ...process.env },
    },
    // Node related
    setTimeout,
    Buffer, // required for twilio Authorization token
    URLSearchParams,
    fetch, // Pass fetch to the sandbox

    event, // Pass the event to the VM sandbox
    imports
  },
});

try {
 
  // Make sure that responseData.code it's a index.js file that comes as a result of "tsc" command with "ESNext" in tsconfig.json
  const transformedCode = responseData.code
  // Remove the export handler function line, adjusting to potentially varying spaces
  .replace("export const handler = async (event) => {", '') // Remove handler definition line
  .replace(/\};\s*$/, '') // 2. remove only the LAST `};` at end of string



  const wrappedCode = `  
    const { Redis, moment, freeEmailDomains} = imports;

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
      .replace(/\\n/g, "\n").replace(/\\/g, '')
    throw new Error(cleanedError);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
} catch (error) {
  const errorMessage: string = (error as Error)?.message || 'An unexpected error occurred';
  console.error(124,'Error executing code in VM:', errorMessage);
  return {
    statusCode: 500,
    body: JSON.stringify({
      error: 'Failed to execute the code',
      details: errorMessage,
    }),
  };
  }
};