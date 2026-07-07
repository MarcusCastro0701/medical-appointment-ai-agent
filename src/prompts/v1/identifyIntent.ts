import { z } from 'zod';

export const IntentSchema = z.object({
  intent: z.enum(['schedule', 'cancel', 'list_appointments', 'unknown']).describe('The user intent'),
  professionalId: z.number().optional().describe('ID of the medical professional'),
  professionalName: z.string().optional().describe('Name of the medical professional'),
  datetime: z.string().optional().describe('Appointment date and time in ISO format'),
  patientName: z.string().optional().describe('Patient name extracted from question, or the authenticated user\'s own name if scheduling for themselves without stating it explicitly'),
  reason: z.string().optional().describe('Reason for appointment (for scheduling)'),
  appointmentId: z.string().optional().describe('For cancel intent only: the id of the matching entry from user_appointments. Leave empty if no single appointment can be confidently matched'),
  confirmed: z.boolean().optional().describe('Only meaningful when pending_confirmation is present in context: true if the current message is a clear affirmative response to it, false if it is a clear negative/decline. Leave empty if the message does not address the pending confirmation at all.'),
});

export type IntentData = z.infer<typeof IntentSchema>;

export type AppointmentContext = {
  id: string;
  professionalName: string;
  specialty: string;
  datetime: string;
  patientName: string;
};

export type PendingConfirmation = {
  type: 'schedule' | 'cancel';
  professionalName?: string;
  datetime?: string;
  patientName?: string;
  reason?: string;
} | null;

export const getSystemPrompt = (
  professionals: { id: number; name: string; specialty: string }[],
  context: { userName: string; appointments: AppointmentContext[]; pendingConfirmation: PendingConfirmation },
) => {
  return JSON.stringify({
    role: 'Intent Classifier for Medical Appointments',
    task: 'Identify user intent and extract all appointment-related details',
    professionals: professionals.map(p => ({ id: p.id, name: p.name, specialty: p.specialty })),
    current_date: new Date().toISOString(),
    authenticated_user: {
      name: context.userName,
      note: 'This is the person currently logged in and chatting. If they ask to schedule or cancel without naming a patient, assume it refers to themselves unless the message clearly says otherwise (e.g. "for my dad", "pro meu pai").',
    },
    user_appointments: context.appointments,
    pending_confirmation: context.pendingConfirmation,
    confirmation_instructions: context.pendingConfirmation
      ? 'There is a pending action waiting for a yes/no answer (see pending_confirmation). The current message is very likely the user\'s response to it. Judge SEMANTICALLY, not by exact keyword match — informal, slangy, or elongated Portuguese/English affirmatives and negatives all count (e.g. "isso mesmo", "siiiiim", "pode ser", "manda ver" = confirmed:true; "nem a pau", "não quero mais", "deixa pra lá", "não não não" = confirmed:false). If the message does not address the pending confirmation at all (e.g. it asks something unrelated or starts a different request), leave confirmed empty — do not force it into yes or no.'
      : undefined,
    rules: {
      schedule: {
        description: 'User wants to book/schedule a new appointment',
        keywords: ['schedule', 'book', 'appointment', 'I want to', 'make an appointment'],
        required_fields: ['professionalId', 'datetime', 'patientName'],
        optional_fields: ['reason'],
        matching_instructions: 'CRITICAL: only set professionalId/professionalName when the current message, or a clearly resolvable earlier message in this same conversation, names a specific professional that fuzzy-matches one entry in the professionals list. If no professional was mentioned anywhere relevant, you MUST leave both professionalId and professionalName empty — never default to the first professional in the list, the most recently discussed one, or any other guess. Booking with the wrong professional is worse than asking which one.'
      },
      cancel: {
        description: 'User wants to cancel an existing appointment',
        keywords: ['cancel', 'remove', 'delete', 'cancel my appointment'],
        required_fields: ['appointmentId'],
        matching_instructions: 'Match what the user describes (professional name, date/time, or a vague reference like "that one" / "esse" / "the one you just listed") against user_appointments to find the correct id. CRITICAL: if user_appointments has more than one entry and the message gives no distinguishing detail (no professional name, no specialty, no date/time) that narrows it to exactly one, you MUST leave appointmentId empty. Never guess, never default to the first/most recent/only-one-you-can-think-of entry — an incorrect guess would cancel the wrong appointment, which is worse than asking for clarification.'
      },
      list_appointments: {
        description: 'User wants to see their own scheduled appointments',
        keywords: ['minhas consultas', 'meus agendamentos', 'o que eu tenho marcado', 'my appointments', 'what do I have scheduled'],
      },
      unknown: {
        description: 'Anything not related to scheduling, cancelling or listing appointments',
        examples: ['weather questions', 'general info', 'unrelated queries']
      }
    },
    extraction_instructions: {
      professionalId: 'Match the professional name mentioned in the question to the ID from the professionals list. Use fuzzy matching. If none was mentioned or resolvable from context, leave this field empty — do not guess.',
      professionalName: 'Extract the professional name as mentioned by the user',
      datetime: 'Parse relative dates (today, tomorrow) and times. Convert to ISO format. Use current_date as reference.',
      patientName: 'Extract the patient name from the question or context. If not stated and the user is clearly acting for themselves, copy the actual string from authenticated_user.name into this field — never output the literal text "authenticated_user.name" or any placeholder.',
      reason: 'Extract the reason/purpose for the appointment (only for scheduling)',
      appointmentId: 'Only for cancel intent — copy the actual id string of the matching entry from user_appointments. Never output a placeholder, description, or the literal text "user_appointments" — it must be the real id value or left empty.'
    },
    examples: [
      {
        input: 'I want to schedule with Dr. Alicio da Silva for tomorrow at 4pm for a check-up',
        output: { intent: 'schedule', professionalId: 1, professionalName: 'Dr. Alicio da Silva', datetime: '2026-02-12T16:00:00.000Z', reason: 'check-up' }
      },
      {
        input: 'Marca uma consulta pra mim com a Dra. Ana Pereira amanhã às 10h',
        context_note: 'In this example authenticated_user.name happens to be "Pedro Alves"',
        note: 'Patient name not stated — the user is clearly scheduling for themselves, so patientName is copied from authenticated_user.name (never leave the literal field name/placeholder as the value — always substitute the real string)',
        output: { intent: 'schedule', professionalId: 2, professionalName: 'Dra. Ana Pereira', datetime: '2026-02-12T10:00:00.000Z', patientName: 'Pedro Alves' }
      },
      {
        input: 'Agende às 15h do dia 8 de julho, por favor',
        note: 'No professional was mentioned anywhere in this conversation. professionalId and professionalName MUST stay empty — do not default to any professional from the list. Leaving them empty makes scheduling fail validation and correctly ask the user which professional they want, instead of silently booking with the wrong one.',
        output: { intent: 'schedule', datetime: '2026-07-08T15:00:00.000Z' }
      },
      {
        input: 'Cancel my appointment with Dr. Ana Pereira today at 11am',
        context_note: 'In this example user_appointments contains an entry with id "b2e4a9d0-6f2b-4a5b-9c3d-8f1e2a7b6c90" for Dr. Ana Pereira at that exact date/time',
        note: 'appointmentId is copied from that matching entry\'s real id — never leave a placeholder or description as the value, always substitute the actual id string',
        output: { intent: 'cancel', appointmentId: 'b2e4a9d0-6f2b-4a5b-9c3d-8f1e2a7b6c90', professionalId: 2, professionalName: 'Dr. Ana Pereira', datetime: '2026-02-11T11:00:00.000Z' }
      },
      {
        input: 'Cancela a consulta que você acabou de listar com a Dra. Ana Pereira',
        context_note: 'Same user_appointments entry as the previous example',
        note: 'The reference is resolved against user_appointments, not by re-parsing the assistant\'s previous natural-language reply — appointmentId is still the real id, copied verbatim from user_appointments',
        output: { intent: 'cancel', appointmentId: 'b2e4a9d0-6f2b-4a5b-9c3d-8f1e2a7b6c90', professionalName: 'Dra. Ana Pereira' }
      },
      {
        input: 'Cancele minha consulta',
        note: 'Ambiguous: user_appointments has 2+ entries and nothing here (no professional, no specialty, no date/time) narrows it to one. appointmentId MUST stay empty — do not pick one arbitrarily.',
        output: { intent: 'cancel' }
      },
      {
        conversation_context: 'The two immediately preceding messages in this same chat were the user booking an appointment with Dr. Alicio da Silva, then immediately after booking a second one with Dra. Ana Pereira. user_appointments now has both.',
        input: 'Cancele minha consulta',
        note: 'CRITICAL — do NOT default to the appointment booked most recently in the conversation. Recency is not disambiguation: "minha consulta" (singular) with two real appointments on file is exactly as ambiguous here as in the previous example, even though one of them was just discussed. appointmentId MUST stay empty.',
        output: { intent: 'cancel' }
      },
      {
        input: 'Quais consultas eu tenho marcadas?',
        output: { intent: 'list_appointments' }
      },
      {
        input: 'What is the weather today?',
        output: { intent: 'unknown' }
      },
      {
        conversation_context: 'pending_confirmation is set: {type:"schedule", professionalName:"Dr. Alicio da Silva", datetime:"2026-07-07T07:00:00.000Z", patientName:"Marina Duarte"}. The assistant just asked "Confirma o agendamento com o Dr. Alicio da Silva pra hoje às 7h?"',
        input: 'siiiiiiiiiiiimimimimim',
        note: 'Informal, elongated "sim" — still an unambiguous affirmative. Judge by meaning, not exact spelling.',
        output: { intent: 'schedule', confirmed: true }
      },
      {
        conversation_context: 'Same pending_confirmation as above',
        input: 'nem a pauuuuu não não',
        note: 'Informal, emphatic Brazilian Portuguese negation. Judge by meaning, not exact keyword.',
        output: { intent: 'schedule', confirmed: false }
      },
      {
        conversation_context: 'Same pending_confirmation as above',
        input: 'Quais profissionais vocês têm?',
        note: 'This does not address the pending confirmation at all — it is a new, unrelated question. Leave confirmed empty and classify the actual message normally; do not force it into yes or no.',
        output: { intent: 'unknown' }
      }
    ]
  });
};

export const getUserPromptTemplate = (history: { role: string; content: unknown }[]) => {
  return JSON.stringify({
    conversation: history,
    instructions: [
      'The conversation array contains the full chat history so far, oldest first',
      'The last entry is the user\'s current message — that is what you must classify',
      'Use the earlier messages only as context, e.g. to resolve references like "my appointment" or answer follow-ups about something already discussed',
      'Carefully analyze the current message to determine the user intent',
      'Extract all relevant appointment details, using earlier context if the current message alone is incomplete',
      'Convert dates and times to ISO format',
      'Match professional names to their IDs',
      'Return only the fields that are present or reasonably inferable from the conversation'
    ]
  });
};
