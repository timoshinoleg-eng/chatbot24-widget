/**
 * Sentiment Analysis Module
 * Detects negative sentiment and triggers escalation
 */

export interface SentimentResult {
  score: number; // -1 (negative) to +1 (positive)
  label: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE';
  shouldEscalate: boolean;
  confidence: number;
}

// Negative keywords in Russian
const negativeWords = [
  'плохо', 'ужасно', 'отвратительно', 'ненавижу', 'грустно', 'зол', 'зла',
  'разочарован', 'разочарована', 'жалко', 'печально', 'тревожно', 'страшно',
  'бесит', 'бешусь', 'злюсь', 'обидно', 'обида', 'злость', 'ярость',
  'фигня', 'дерьмо', 'бред', 'тупо', 'надоело', 'устал', 'проблема',
  'проблемы', 'не работает', 'сломалось', 'ошибка', 'ошибки', 'плохой',
  'ужасный', 'отвратительный', 'ужасная', 'отвратительная', 'недоволен',
  'недовольна', 'жалоба', 'жалуюсь', 'кошмар', 'катастрофа', 'ужас',
  'сплошное разочарование', 'не помогает', 'бесполезно', 'враньё',
  'обман', 'развод', 'кидалово', 'мошенники', 'не рекомендую'
];

// Positive keywords in Russian
const positiveWords = [
  'хорошо', 'отлично', 'замечательно', 'супер', 'класс', 'круто', 'рад',
  'рада', 'счастлив', 'счастлива', 'доволен', 'довольна', 'люблю',
  'обожаю', 'восторг', 'восхищён', 'восхищена', 'прекрасно', 'шикарно',
  'благодарен', 'благодарна', 'спасибо', 'благодарю', 'рекомендую',
  'советую', 'лучший', 'лучшая', 'отличный', 'отличная', 'прекрасный',
  'прекрасная', 'замечательный', 'замечательная', 'счастье', 'радость',
  'удовольствие', 'комфортно', 'уютно', 'приятно', 'полезно', 'эффективно'
];

// Escalation triggers - more severe negative signals
const escalationTriggers = [
  'мошенничество', 'суды', 'юрист', 'адвокат', 'прокуратура', 'письмо',
  'жалоба в', 'отмена', 'возврат денег', 'верните деньги', 'верните мне',
  'угрожаю', 'пожалуюсь', 'в суд', 'разбирательство', 'проверка',
  'напишу everywhere', 'везде расскажу', 'порчу репутацию', 'уничтожу',
  'разнесу', 'всё пропало', 'катастрофа', 'трагедия', 'невыносимо',
  'убийство', 'самоубийство', 'покончу', 'умру', 'смерть'
];

export function analyzeSentiment(text: string): SentimentResult {
  const lowerText = text.toLowerCase();
  
  let negativeCount = 0;
  let positiveCount = 0;
  let escalationCount = 0;

  // Count negative words
  for (const word of negativeWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    const matches = lowerText.match(regex);
    if (matches) {
      negativeCount += matches.length;
    }
  }

  // Count positive words
  for (const word of positiveWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    const matches = lowerText.match(regex);
    if (matches) {
      positiveCount += matches.length;
    }
  }

  // Count escalation triggers
  for (const trigger of escalationTriggers) {
    if (lowerText.includes(trigger)) {
      escalationCount++;
    }
  }

  // Calculate sentiment score
  const totalWords = lowerText.split(/\s+/).length;
  const sentimentWords = negativeCount + positiveCount;
  
  let score = 0;
  if (sentimentWords > 0) {
    score = (positiveCount - negativeCount) / Math.max(sentimentWords, 5);
  }

  // Normalize score to -1 to +1 range
  score = Math.max(-1, Math.min(1, score));

  // Determine label
  let label: SentimentResult['label'] = 'NEUTRAL';
  if (score < -0.3) {
    label = 'NEGATIVE';
  } else if (score > 0.3) {
    label = 'POSITIVE';
  }

  // Determine if escalation is needed
  // Escalate if: very negative score OR escalation triggers found
  const shouldEscalate = score < -0.5 || escalationCount > 0 || negativeCount >= 3;

  // Calculate confidence based on word density
  const confidence = Math.min(1, sentimentWords / Math.max(totalWords * 0.1, 5));

  return {
    score,
    label,
    shouldEscalate,
    confidence
  };
}

export function getSentimentColor(label: SentimentResult['label']): string {
  switch (label) {
    case 'POSITIVE':
      return 'text-green-600 bg-green-50';
    case 'NEGATIVE':
      return 'text-red-600 bg-red-50';
    case 'NEUTRAL':
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

export function getSentimentEmoji(label: SentimentResult['label']): string {
  switch (label) {
    case 'POSITIVE':
      return '😊';
    case 'NEGATIVE':
      return '😞';
    case 'NEUTRAL':
    default:
      return '😐';
  }
}
