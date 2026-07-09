import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { config } from '../config/index.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import { OpenRouterService } from '../services/openRouterService.ts';
import { buildAppointmentGraph } from './graph.ts';

export async function buildGraph() {
  // Classification/extraction must be consistent and rule-following, not creative — low temperature.
  const classifierLlm = new OpenRouterService({ ...config, temperature: 0.1 })
  // Narration benefits from natural, varied phrasing — keep the higher default temperature.
  const narratorLlm = new OpenRouterService(config)
  const appointmentService = new AppointmentService()

  const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
  await checkpointer.setup();

  return buildAppointmentGraph(
    classifierLlm,
    narratorLlm,
    appointmentService,
    checkpointer,
  );
}

// Entry point expected by langgraph.json (`./src/graph/factory.ts:graph`) for `langgraph:serve`/Studio.
export const graph = async () => {
  return buildGraph();
};
