import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { config } from '../config/index.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import { OpenRouterService } from '../services/openRouterService.ts';
import { buildAppointmentGraph } from './graph.ts';

export async function buildGraph() {
  const classifierLlm = new OpenRouterService({ ...config, temperature: 0.1 })
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

// Entry point for langgraph.json (langgraph:serve/Studio)
export const graph = async () => {
  return buildGraph();
};
