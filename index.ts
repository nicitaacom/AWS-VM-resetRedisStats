import VMModule from 'vm2';
const { VM } = VMModule;


import { Redis } from "ioredis";
import { Resend } from 'resend' 
import crypto from 'crypto'
import moment from "moment-timezone"



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

const encoder = new TextEncoder()
const decoder = new TextDecoder()

  const imports = {Redis,Resend,crypto,encoder,decoder,moment}
  
const vm = new VM({
  timeout: 25000, // 25 seconds to prevent Lambda timeout
  sandbox: {
    process: {
      env: { ...process.env },
    },
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
  .replace("};", ''); // Remove only the last closing `};`




  const wrappedCode = `  
    const { Redis, Resend, crypto, encoder, decoder, moment } = imports;

    (async () => {
      try {
        const result = await (async () => { 
          ${transformedCode} 
        })();

        if (result?.statusCode !== 200 {
          throw new Error(result.body);
        }

        return result;
      } catch (error) {
        return { statusCode: 400, body: error.message };
      }
    })();
  `;
      
  

 // Execute the wrapped code in the VM
  const result = await vm.run(wrappedCode);

  if (result?.statusCode !== 200) {
    const cleanedError = result.body.replace(/\\n/g, "\n").replace(/\\/g, '').replace(/\\/g, '')
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