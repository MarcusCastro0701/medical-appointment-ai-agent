import { getSystemPrompt, getUserPromptTemplate, IntentSchema, type PendingConfirmation } from '../../prompts/v1/identifyIntent.ts';
import type { AppointmentService } from '../../services/appointmentService.ts';
import { OpenRouterService } from '../../services/openRouterService.ts';
import type { GraphState } from '../graph.ts';

// Fast, deterministic path for the overwhelming majority of confirmation replies — "sim"/"não" and close
// variants should never depend on an LLM call to be recognized correctly. Anything that doesn't match falls
// through to the LLM's semantic judgment (handles informal/slangy phrasing like "siiiim" or "nem a pau").
const CONFIRM_YES_PATTERN = /^(sim|s|yes|y|ok(ay)?|confirmo|confirmar|isso mesmo|isso a[íi]|isso|pode confirmar|beleza|claro|com certeza|manda ver|pode ser)\b/i;
const CONFIRM_NO_PATTERN = /^(n[ãa]o|n|no|nunca|negativo|deixa (pra|para) l[áa]|esquece|cancela isso)\b/i;

function detectExplicitConfirmation(message: string): boolean | undefined {
  const normalized = message.trim().toLowerCase();
  if (CONFIRM_YES_PATTERN.test(normalized)) return true;
  if (CONFIRM_NO_PATTERN.test(normalized)) return false;
  return undefined;
}

export function createIdentifyIntentNode(llmClient: OpenRouterService, appointmentService: AppointmentService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log(`🔍 Identifying intent...`);
    const history = state.messages.map((m) => ({ role: m.getType(), content: m.content }));

    try {
      const [professionals, appointments] = await Promise.all([
        appointmentService.getProfessionals(),
        appointmentService.getAppointmentsForUser(state.userId!),
      ]);

      const appointmentsList = appointments.map((appointment) => ({
        id: appointment.id,
        professionalName: appointment.professional.name,
        specialty: appointment.professional.specialty,
        datetime: appointment.datetime.toISOString(),
        patientName: appointment.patientName,
      }));

      const isConfirmationTurn = !!state.awaitingConfirmation;
      const pendingConfirmation: PendingConfirmation = isConfirmationTurn ? {
        type: state.awaitingConfirmation!,
        professionalName: state.professionalName,
        datetime: state.datetime,
        patientName: state.patientName,
        reason: state.reason,
      } : null;

      const systemPrompt = getSystemPrompt(professionals, {
        userName: state.userName ?? '',
        appointments: appointmentsList,
        pendingConfirmation,
      })
      const userPrompt = getUserPromptTemplate(history)
      const result = await llmClient.generateStructured(
        systemPrompt,
        userPrompt,
        IntentSchema,
      )
      if(!result.success){
        console.log(`⚠️  Intent identification failed: ${result.error}`);
        return {
          intent: 'unknown',
          error: result.error,
          systemError: true,
        }
      }

      const intentData = result.data!
      console.log(`✅ Intent identified: ${intentData.intent}`);

      let confirmed = false;
      if (isConfirmationTurn) {
        const rawMessage = state.messages.at(-1)?.content;
        const deterministic = typeof rawMessage === 'string' ? detectExplicitConfirmation(rawMessage) : undefined;
        confirmed = deterministic ?? (intentData.confirmed === true);
        console.log(`❓ Confirmation reading: ${deterministic !== undefined ? 'deterministic' : 'LLM'} -> ${confirmed}`);
      }

      return {
        ...intentData,
        confirmed,
        // A pending confirmation only survives into a turn that confirms it — schedulerNode/cancellerNode
        // clear it themselves after executing. Any other outcome (decline, unrelated message) drops it here,
        // so a stale "yes" can never fire against a proposal from an unrelated later turn.
        ...(isConfirmationTurn && !confirmed ? { awaitingConfirmation: undefined } : {}),
        appointmentsList,
        professionalsList: professionals,
        error: undefined,
        systemError: false,
      };

    } catch (error) {
      console.error('❌ Error in identifyIntent node:', error);
      return {
        ...state,
        intent: 'unknown',
        error: error instanceof Error ? error.message : 'Intent identification failed',
        systemError: true,
      };
    }
  };
}
