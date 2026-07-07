import { getSystemPrompt, getUserPromptTemplate, IntentSchema } from '../../prompts/v1/identifyIntent.ts';
import { professionals } from '../../services/appointmentService.ts';
import { OpenRouterService } from '../../services/openRouterService.ts';
import type { GraphState } from '../graph.ts';

export function createIdentifyIntentNode(llmClient: OpenRouterService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log(`🔍 Identifying intent...`);
    const history = state.messages.map((m) => ({ role: m.getType(), content: m.content }));

    try {
      const systemPrompt = getSystemPrompt(professionals)
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

      return {
        ...intentData,
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
