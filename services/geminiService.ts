import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { MUNICIPALITY_NAME, MOCK_SCHOOLS } from '../constants';

const SYSTEM_INSTRUCTION = `
Você é o "Edu", o assistente virtual oficial da Secretaria de Educação do município de ${MUNICIPALITY_NAME}.
Sua função é auxiliar pais e responsáveis no processo de matrícula escolar online.

Informações importantes que você deve saber:
- O período de matrícula está aberto.
- Documentos necessários: Certidão de Nascimento ou RG do aluno, CPF do aluno (se tiver), RG e CPF do responsável, Comprovante de Residência atualizado, Cartão de Vacinação.
- Para alunos com deficiência, é necessário apresentar laudo médico.
- O sistema permite escolher até 3 escolas de preferência, mas a alocação depende da disponibilidade e proximidade.
- Escolas disponíveis no sistema agora: ${MOCK_SCHOOLS.map(s => s.name + " (" + s.types.join(", ") + ")").join("; ")}.

Diretrizes de comportamento:
- Seja sempre educado, empático e claro.
- Responda de forma concisa.
- Se não souber a resposta, oriente o usuário a ligar para a Secretaria de Educação no número 156.
- Ajude a explicar como preencher o formulário se o usuário tiver dúvidas.
- Se o usuário perguntar sobre vagas, informe que eles devem consultar a disponibilidade no passo de seleção de escola, mas que você pode listar as escolas existentes.
`;

let chatSession: Chat | null = null;
let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
}

export const getChatSession = (): Chat => {
  if (!chatSession) {
    const client = getAiClient();
    chatSession = client.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });
  }
  return chatSession;
};

export const sendMessageToGemini = async (message: string): Promise<AsyncIterable<string>> => {
  const chat = getChatSession();
  
  // Create a generator that yields strings from the stream
  async function* streamGenerator() {
    try {
      const result = await chat.sendMessageStream({ message });
      
      for await (const chunk of result) {
        const responseChunk = chunk as GenerateContentResponse;
        if (responseChunk.text) {
          yield responseChunk.text;
        }
      }
    } catch (error) {
      console.error("Error communicating with Gemini:", error);
      yield "Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente em alguns instantes.";
    }
  }

  return streamGenerator();
};

export const resetChat = () => {
    chatSession = null;
}