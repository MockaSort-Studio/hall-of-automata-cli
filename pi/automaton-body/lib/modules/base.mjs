import { fetchBaseAutomatonBody } from "../base-contract.mjs";
export function baseModule() {
  return { instructions: fetchBaseAutomatonBody(), tools: [] };
}