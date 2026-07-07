import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { config } from '../config/index.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import { OpenRouterService } from '../services/openRouterService.ts';
import { buildAppointmentGraph } from './graph.ts';

export async function buildGraph() {
  const llmClient = new OpenRouterService(config)
  const appointmentService = new AppointmentService()

  const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
  await checkpointer.setup();

  return buildAppointmentGraph(
    llmClient,
    appointmentService,
    checkpointer,
  );
}
