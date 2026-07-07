import { getSystemPrompt, getUserPromptTemplate, MessageSchema } from '../../prompts/v1/messageGenerator.ts';
import { OpenRouterService } from '../../services/openRouterService.ts';
import type { GraphState } from '../graph.ts';
import { AIMessage } from 'langchain';

const UNAVAILABLE_MESSAGE = 'Estamos com instabilidade técnica no momento e não conseguimos processar sua mensagem. Por favor, tente novamente em alguns instantes.';

export function createMessageGeneratorNode(llmClient: OpenRouterService) {
    return async (state: GraphState): Promise<Partial<GraphState>> => {
        console.log(`💬 Generating response message...`);

        if (state.systemError) {
            console.log(`⚠️  Upstream system error, skipping message LLM call: ${state.error}`);
            return {
                actionSuccess: false,
                messages: [
                    ...state.messages,
                    new AIMessage(UNAVAILABLE_MESSAGE)
                ],
            };
        }

        try {
            // schedulerNode/cancellerNode always clear awaitingConfirmation except when returning a fresh proposal.
            const isProposal = !!state.awaitingConfirmation;
            const scenario = isProposal
                ? `${state.awaitingConfirmation}_confirm_needed`
                : `${state.intent ?? 'unknown'}_${state.actionSuccess ? 'success' : 'error'}`
            const needsAppointmentsContext = state.intent === 'list_appointments' || state.intent === 'cancel' || state.awaitingConfirmation === 'cancel';
            const details = {
                professionalName: state.professionalName,
                datetime: state.datetime,
                patientName: state.patientName,
                reason: state.reason,
                error: state.actionError,
                appointments: needsAppointmentsContext ? state.appointmentsList : undefined,
                userName: state.userName,
                userEmail: state.userEmail,
                availableProfessionals: state.professionalsList,
            }

            const history = state.messages.map((m) => ({ role: m.getType(), content: m.content }));

            const systemPrompt = getSystemPrompt()
            const userPrompt = getUserPromptTemplate({ scenario, details, history })

            const result = await llmClient.generateStructured(
                systemPrompt,
                userPrompt,
                MessageSchema,
            )
            console.log(`✅ Message generated:`, result.data?.message ?? result.data ?? result);

            if (result.error) {
                console.log(`⚠️  Message generation failed: ${result.error}`);
                return {
                    actionSuccess: state.actionSuccess ?? false,
                    messages: [
                        ...state.messages,
                        new AIMessage(UNAVAILABLE_MESSAGE)
                    ],
                };
            }


            return {

                messages: [
                    ...state.messages,
                    new AIMessage(result.data!.message)
                ],
            };
        } catch (error) {
            console.error('❌ Error in messageGenerator node:', error);
            return {
                actionSuccess: state.actionSuccess ?? false,
                messages: [
                    ...state.messages,
                    new AIMessage(UNAVAILABLE_MESSAGE)
                ],
            };
        }
    };
}
