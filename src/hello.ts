/**
 * Hello utility - basic greeting functions.
 * @packageDocumentation
 */

 /**
  * Greet with a name.
  * @param name - Name to greet (default: "World")
  * @returns Greeting string
  */
 export function greet(name: string = "World"): string {
   return `Hello, ${name}!`;
 }

 /**
  * Get the version.
  * @returns Version string
  */
 export function getVersion(): string {
   return "1.0.0";
 }