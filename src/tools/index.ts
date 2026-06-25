import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { Config } from "../config.js";
import { createListConceptsTool } from "./listConcepts.js";
import { createReadConceptTool } from "./readConcept.js";
import { createWriteConceptTool } from "./writeConcept.js";

export { createListConceptsTool, createReadConceptTool, createWriteConceptTool };

/** Build the three knowledge tools bound to a given configuration. */
export function createKnowledgeTools(config: Config): AgentTool<any>[] {
  return [
    createListConceptsTool(config),
    createReadConceptTool(config),
    createWriteConceptTool(config),
  ];
}
