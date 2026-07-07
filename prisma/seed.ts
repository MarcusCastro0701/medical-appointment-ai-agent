import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Language = 'pt-BR' | 'en';

type ProfessionalSeed = {
  id: number;
  name: string;
  specialty: string;
};

const PROFESSIONALS_BY_LANGUAGE: Record<Language, ProfessionalSeed[]> = {
  'pt-BR': [
    { id: 1, name: 'Dr. Alicio da Silva', specialty: 'Cardiologia' },
    { id: 2, name: 'Dra. Ana Pereira', specialty: 'Dermatologia' },
    { id: 3, name: 'Dra. Carol Gomes', specialty: 'Neurologia' },
  ],
  en: [
    { id: 1, name: 'Dr. Alan Smith', specialty: 'Cardiology' },
    { id: 2, name: 'Dr. Anna Parker', specialty: 'Dermatology' },
    { id: 3, name: 'Dr. Caroline Green', specialty: 'Neurology' },
  ],
};

function isSupportedLanguage(value: string): value is Language {
  return value in PROFESSIONALS_BY_LANGUAGE;
}

async function main(): Promise<void> {
  const language = process.env.APP_LANGUAGE;

  if (!language) {
    console.warn('⚠️  APP_LANGUAGE is not set — skipping professionals seed.');
    return;
  }

  if (!isSupportedLanguage(language)) {
    throw new Error(`APP_LANGUAGE must be either "pt-BR" or "en", got "${language}"`);
  }

  const professionals = PROFESSIONALS_BY_LANGUAGE[language];

  for (const professional of professionals) {
    await prisma.professional.upsert({
      where: { id: professional.id },
      update: { name: professional.name, specialty: professional.specialty },
      create: professional,
    });
  }

  console.log(`✅ Seeded ${professionals.length} professionals (${language}).`);
}

main()
  .catch((error) => {
    process.stderr.write(`Seed error: ${String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
