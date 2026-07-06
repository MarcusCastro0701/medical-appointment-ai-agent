export type ModelConfig = {
  apiKey: string;
  httpReferer: string;
  xTitle: string;

  provider: {
    sort: {
      by: string;
      partition: string;
    };
  };

  models: string[];
  temperature: number;
};

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error('OPENROUTER_API_KEY is not set in environment variables');
}

export const config: ModelConfig = {
  apiKey,
  httpReferer: '',
  xTitle: 'Medical Appointment Agent',
  models: [
    // https://openrouter.ai/models?fmt=cards&max_price=0&supported_parameters=response_format
    'nvidia/nemotron-3-super-120b-a12b:free',
  ],
  provider: {
    sort: {
      by: 'throughput', // Route to model with highest throughput (fastest response)
      partition: 'none',
    },
  },
  temperature: 0.7,
};
