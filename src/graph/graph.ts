import {
  StateGraph,
  START,
  END,
  MessagesZodMeta,
} from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import { withLangGraph } from "@langchain/langgraph/zod";
import type { BaseMessage } from '@langchain/core/messages';

import { createSchedulerNode } from './nodes/schedulerNode.ts';
import { createCancellerNode } from './nodes/cancellerNode.ts';
import { createListAppointmentsNode } from './nodes/listAppointmentsNode.ts';
import { createIdentifyIntentNode} from "./nodes/identifyIntentNode.ts";
import { createMessageGeneratorNode } from "./nodes/messageGeneratorNode.ts";

import { z } from "zod/v3";
import { OpenRouterService } from "../services/openRouterService.ts";
import { AppointmentService } from "../services/appointmentService.ts";

const AppointmentContextSchema = z.object({
  id: z.string(),
  professionalName: z.string(),
  specialty: z.string(),
  datetime: z.string(),
  patientName: z.string(),
});

const ProfessionalContextSchema = z.object({
  id: z.number(),
  name: z.string(),
  specialty: z.string(),
});

const AppointmentStateAnnotation = z.object({
  messages: withLangGraph(
    z.custom<BaseMessage[]>(),
    
    MessagesZodMeta),

  patientName: z.string().optional(),
  userId: z.number().optional(),
  userName: z.string().optional(),
  userEmail: z.string().optional(),

  intent: z.enum(['schedule', 'cancel', 'list_appointments', 'unknown']).optional(),
  professionalId: z.number().optional(),
  professionalName: z.string().optional(),
  datetime: z.string().optional(),
  reason: z.string().optional(),
  appointmentId: z.string().optional(),
  appointmentsList: z.array(AppointmentContextSchema).optional(),
  professionalsList: z.array(ProfessionalContextSchema).optional(),

  awaitingConfirmation: z.enum(['schedule', 'cancel']).optional(),
  confirmed: z.boolean().optional(),

  actionSuccess: z.boolean().optional(),
  actionError: z.string().optional(),
  appointmentData: z.any().optional(),

  error: z.string().optional(),
  systemError: z.boolean().optional(),
});

export type GraphState = z.infer<typeof AppointmentStateAnnotation>;

export function buildAppointmentGraph(classifierLlm: OpenRouterService, narratorLlm: OpenRouterService, appoinmentService: AppointmentService, checkpointer?: BaseCheckpointSaver) {


  const workflow = new StateGraph({
    stateSchema: AppointmentStateAnnotation,
  })
    .addNode('identifyIntent', createIdentifyIntentNode(classifierLlm, appoinmentService))
    .addNode('schedule', createSchedulerNode(appoinmentService))
    .addNode('cancel', createCancellerNode(appoinmentService))
    .addNode('listAppointments', createListAppointmentsNode())
    .addNode('message', createMessageGeneratorNode(narratorLlm))

    .addEdge(START, 'identifyIntent')

    .addConditionalEdges(
      'identifyIntent',
      (state: GraphState): string => {
        if (state.error) {
          return 'message';
        }

        if (state.awaitingConfirmation && state.confirmed) {
          console.log(`➡️  Confirmed — executing pending ${state.awaitingConfirmation}`);
          return state.awaitingConfirmation;
        }

        if (!state.intent || state.intent === 'unknown') {
          return 'message';
        }

        console.log(`➡️  Routing based on intent: ${state.intent}`);
        return state.intent
      },
      {
        schedule: 'schedule',
        cancel: 'cancel',
        list_appointments: 'listAppointments',
        message: 'message',
      }
    )

    .addEdge('schedule', 'message')
    .addEdge('cancel', 'message')
    .addEdge('listAppointments', 'message')
    .addEdge('message', END);

  return workflow.compile({ checkpointer });
}
