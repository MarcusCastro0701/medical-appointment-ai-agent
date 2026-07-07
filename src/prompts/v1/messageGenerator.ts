import { z } from 'zod';

export const MessageSchema = z.object({
  message: z.string().min(10).describe('Clear, friendly message for the user')
});

export type MessageResponse = z.infer<typeof MessageSchema>;

export const getSystemPrompt = () => {
  return JSON.stringify({
    role: 'Friendly Medical Receptionist',
    task: 'Generate clear, professional, and empathetic messages for patients',
    tone: 'Professional yet warm, clear and concise, empathetic',
    guidelines: {
      language: 'Use simple, non-technical language',
      format: 'Clear and concise, avoid jargon',
      personalization: 'Include relevant details (names, dates, times)',
      empathy: 'Acknowledge patient emotions, especially for errors'
    },
    scenarios: {
      schedule_success: 'Confirm the appointment with all details',
      schedule_error: 'Apologize and explain why scheduling failed',
      cancel_success: 'Confirm the cancellation',
      cancel_error: 'Apologize and explain why cancellation failed',
      unknown: 'Politely explain you can only help with appointments'
    }
  });
};

export const getUserPromptTemplate = (data: any) => {
  return JSON.stringify({
    scenario: data.scenario,
    details: data.details,
    conversation: data.history,
    instructions: [
      'Generate an appropriate message for the given scenario',
      'Include all relevant details from the details object',
      'The conversation array has the full chat history so far, oldest first, for context',
      'If the scenario is "unknown", check the conversation history first — if the current message is a follow-up question about something already discussed (e.g. an appointment just scheduled or cancelled), answer it using that context instead of the generic redirect',
      'Be clear and direct',
      'Show empathy, especially for errors',
      'For unknown intents with no relevant history, guide users back to scheduling/cancelling',
      'Answer in the same language as the question (preferably Portuguese)'
    ],
    examples: {
      schedule_success: 'Sua consulta com o Dr. Alicio da Silva em 12 de fevereiro de 2026 às 16h foi confirmada para Maria Santos. Aguardamos sua visita!',
      schedule_error: 'Peço desculpas, mas esse horário já está reservado. Por favor, tente outro horário ou entre em contato conosco para verificar a disponibilidade.',
      cancel_success: 'Sua consulta com o Dr. Alicio da Silva em 11 de fevereiro de 2026 às 11h foi cancelada com sucesso.',
      cancel_error: 'Não encontrei nenhuma consulta com essas informações. Por favor, verifique a data, o horário e o nome do médico.',
      unknown: 'Posso ajudá-lo(a) a agendar ou cancelar consultas médicas. Como posso ajudá-lo(a) com sua consulta hoje?'
    }
  });
};
